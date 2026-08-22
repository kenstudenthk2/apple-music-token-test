# Runbook — standing up the permanent pairing server

Audience: the project owner, on or with access to the Ugreen NAS. An agent
session cannot perform the steps in this file — they require your own
Cloudflare login, the same reason `scripts/pocb-session.ps1` is run by hand
(see `scripts/CLAUDE.md`).

## 1. Copy the secrets onto the NAS

Put `AuthKey.p8` somewhere on the NAS outside any git checkout, e.g.
`/volume1/appletune/secrets/AuthKey.p8`. This path is what `SECRETS_DIR`
in `deploy/.env` points at (without the filename).

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

## 4. Get a run token for the container

```bash
cloudflared tunnel token appletune-pairing
```

This prints a single long string. That is `TUNNEL_TOKEN` in `deploy/.env`.
Treat it like a password — it is sufficient on its own to run the tunnel.

## 5. Fill in deploy/.env

On the NAS, in the `deploy/` folder of this repo:

```bash
cp .env.example .env
# edit .env: APPLE_TEAM_ID, APPLE_KEY_ID (same values as your local .env),
# SECRETS_DIR=/volume1/appletune/secrets, TUNNEL_TOKEN=<from step 4>
```

`deploy/.env` is gitignored. Never commit it.

## 6. Bring the stack up

```bash
cd deploy
docker compose up -d
docker compose logs -f
```

Expect `cloudflared` to log a successful registration, and `app` to log
`Pairing server listening on http://0.0.0.0:8787`.

## 7. Verify

```bash
curl https://pairing.<your-domain>/api/version
```

Expected: `{"commit":"<7-char hash>"}` — a JSON response over real HTTPS,
proving the whole chain (Cloudflare edge -> tunnel -> container) works.

Full end-to-end validation (QR pairing from a phone, reboot survival) is
`docs/NAS_DEPLOY_RESULT.md` — do that next.
