# Runbook — standing up the permanent pairing server

Audience: the project owner, on or with access to the Ugreen NAS. An agent
session cannot perform the steps in this file — they require your own
Cloudflare login, the same reason `scripts/pocb-session.ps1` is run by hand
(see `scripts/CLAUDE.md`).

This repo must already be cloned somewhere on the NAS (or wherever you're
running `docker compose` from) before starting — step 5 assumes it.

## 1. Copy the secrets onto the NAS

Put the `.p8` private key somewhere on the NAS outside any git checkout,
e.g. `/volume1/appletune/secrets/AuthKey.p8`. Apple names the downloaded
file `AuthKey_<KEYID>.p8` — rename it to exactly `AuthKey.p8`, since
`docker-compose.yml`'s volume mount hardcodes that filename. This path
(without the filename) is what `SECRETS_DIR` in `deploy/.env` points at.

## 2. Create the named Cloudflare Tunnel

On any machine with `cloudflared` installed and your Cloudflare login:

```bash
cloudflared tunnel login
cloudflared tunnel create appletune-pairing
```

This prints a tunnel ID and writes a credentials file locally — the stack
in this repo does NOT use that credentials file (see step 4), so it does
not need to be copied anywhere.

## 3. Route your domain to the tunnel

```bash
cloudflared tunnel route dns appletune-pairing pairing.<your-domain>
```

Replace `pairing.<your-domain>` with the subdomain you want. Since the
domain is already on Cloudflare DNS, this just adds a CNAME automatically —
no nameserver changes needed.

**This only creates the DNS record — it does not yet tell the tunnel what
to forward requests to.** That's the next step.

## 4. Configure where the tunnel sends traffic

In the Cloudflare Zero Trust dashboard: Networks -> Tunnels -> select
`appletune-pairing` -> Public Hostname -> Add a public hostname.

- Subdomain/domain: the same `pairing.<your-domain>` from step 3
- Service Type: `HTTP`
- URL: `app:8787`

This is the step that's easy to skip because everything still *looks*
fine without it — `cloudflared` connects and registers successfully
either way. Without this, every request reaches the tunnel and gets
routed nowhere, which reads as "the tunnel is up but the site is down."

## 5. Get a run token for the container

```bash
cloudflared tunnel token appletune-pairing
```

This prints a single long string. That is `TUNNEL_TOKEN` in `deploy/.env`.
Treat it like a password — it is sufficient on its own to run the tunnel.

## 6. Fill in deploy/.env

On the NAS, in the `deploy/` folder of this repo (already cloned there
per the note at the top of this file):

```bash
cp .env.example .env
# edit .env: APPLE_TEAM_ID, APPLE_KEY_ID (same values as your local .env),
# SECRETS_DIR=/volume1/appletune/secrets, TUNNEL_TOKEN=<from step 5>
```

`deploy/.env` is gitignored. Never commit it.

## 7. Bring the stack up

```bash
cd deploy
docker compose up -d
docker compose logs -f
```

Expect `cloudflared` to log a successful registration, and `app` to log
`Pairing server listening on http://0.0.0.0:8787`.

## 8. Verify

```bash
curl https://pairing.<your-domain>/api/version
```

Expected: `{"commit":"no-git"}` — NOT a real commit hash. `.git` is
deliberately excluded from the Docker build context (see `.dockerignore`
and `deploy/Dockerfile`'s comments), so the container always reports
`"no-git"`; `pairing-server.js` treats this as a normal, handled case.
The point of this check is the JSON response itself, over real HTTPS —
proof the whole chain (Cloudflare edge -> tunnel -> container) works, not
the specific value returned.

Full end-to-end validation (QR pairing from a phone, reboot survival) is
`docs/NAS_DEPLOY_RESULT.md` — do that next.

## 9. Deploying an update later

After changing anything under `public/tv/`, `pairing-server.js`, or
`test-token.js` and pushing/pulling those changes onto the NAS:

```bash
cd deploy
git -C .. pull
docker compose up -d --build
```

The image is baked at build time, so a plain `git pull` alone does not
take effect until the container is rebuilt.
