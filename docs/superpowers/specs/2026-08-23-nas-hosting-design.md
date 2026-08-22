# NAS hosting for pairing-server.js — design

Audience: whoever implements or reviews the deployment work (agent or human).
Read this before touching `deploy/` or `pairing-server.js`'s bind logic.

## Why

`pairing-server.js` and the live TV app only run today behind a **temporary**
Cloudflare quick tunnel (`*.trycloudflare.com`), started by hand each session
via `scripts/pocb-session.ps1`. The hostname changes every restart, and the
POC-B test APK has that hostname compiled in at build time. Gate G5/G7 work —
a real Android host app and a release build — both need a **stable** URL to
point at first. This is that piece.

Sub-project 1 of 3 toward "an installable app": hosting (this doc), the real
Android host app, and release packaging follow once this is done.

## Decision record

| Question | Answer | Why |
|---|---|---|
| Where does the server run permanently? | The owner's Ugreen NAS (Docker) | Always-on by design, keeps the `.p8` off any rented/cloud machine — see chat 2026-08-23 |
| How is it reached from the internet? | A **named** Cloudflare Tunnel, not the temporary quick-tunnel used in dev | No router port-forward, no dynamic DNS, TLS terminated at Cloudflare's edge |
| Domain | Owner's existing domain, already on Cloudflare DNS | No nameserver migration needed |
| Token persistence (ESCALATION-003) | Deferred — stays "re-pair every cold start" | Owner's explicit call; not required for a first usable app |
| Monetization / paid distribution | Out of scope, not pursued | Flagged 2026-08-23: charging for access to the user's own Apple Music subscription via MusicKit very likely violates the Apple Developer Program License Agreement and risks the developer account this project depends on. This build is for personal use. |

## Architecture

```
Phone / TV browser
      |  HTTPS
      v
Cloudflare edge  (TLS terminates here; your domain's DNS)
      |  outbound tunnel connection (cloudflared-initiated, no inbound port)
      v
Ugreen NAS — Docker Compose stack
  ┌─────────────────────────────────────────────┐
  │  cloudflared  --forwards to-->  app          │
  │  (tunnel client)                (pairing-    │
  │                                   server.js)  │
  └─────────────────────────────────────────────┘
        both containers share one internal
        Docker network; nothing is published
        to the NAS's host network or router
```

## Components

| File | Purpose |
|---|---|
| `deploy/Dockerfile` | `node:20-alpine`, copies only what `npm run pair` needs (root `*.js`, `package.json`) — no dev/test files, no dependencies to install (zero-dep project), runs as a non-root user |
| `deploy/docker-compose.yml` | Two services (`app`, `cloudflared`) on one internal network. `app` binds `0.0.0.0:${PORT}` (`PORT` defaults to 8787, the same default `pairing-server.js` already uses) — safe, since the port is never published to the host or router, only reachable inside the compose network |
| `deploy/.env.example` | Template listing the required variables, incl. `TUNNEL_TOKEN` |
| `deploy/RUNBOOK.md` | The owner-run steps: create the tunnel, route DNS, get a run token |
| `deploy/CLAUDE.md` | Folder menu entry + secrets rule for this subtree |
| `docs/HOME_SETUP.md` (append) | Point at the new permanent path as an alternative to the temporary tunnel session |

**Revised during planning:** `cloudflared` runs in token mode
(`cloudflared tunnel run` with a `TUNNEL_TOKEN` env var, obtained via
`cloudflared tunnel token <name>`) rather than a mounted `config.yml` +
`credentials.json`. Same architecture, one fewer file and no volume needed
for the tunnel client — Cloudflare's own recommended approach for a
containerized sidecar.

## Required code change

`pairing-server.js`'s `server.listen(PORT, "127.0.0.1", ...)` becomes
`server.listen(PORT, process.env.HOST || "127.0.0.1", ...)`. Local dev
(`npm run pair`) is unaffected — nothing sets `HOST` there. Only
`deploy/docker-compose.yml` sets `HOST=0.0.0.0`, and only inside the isolated
compose network. Not an auth-surface change: it does not touch how the
pairing code, device secret, or Music User Token are handled — see
`docs/CLAUDE.md` §Auth for what does count.

No change needed to the QR activate-link logic — `pairing-server.js:274`
already derives the public origin from `x-forwarded-proto` /
`Host`, written with a reverse proxy already in mind.

## Secrets handling

`.p8` lives in a directory on the NAS **outside** the git checkout,
bind-mounted read-only into the `app` container at runtime. `deploy/.env`
(holding `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `SECRETS_DIR`, and `TUNNEL_TOKEN`)
is gitignored and never leaves the NAS. None of these are ever baked into
the Docker image or committed. `deploy/CLAUDE.md` states this rule
explicitly so it survives handoff to a future session.

## What the owner runs themselves

Creating the named tunnel needs the owner's own Cloudflare login — no agent
can do this, same reason `scripts/pocb-session.ps1` cannot be hosted by an
agent (README in `scripts/CLAUDE.md`). The implementation step produces a
short runbook with the exact commands:

```
cloudflared tunnel login
cloudflared tunnel create <name>
cloudflared tunnel route dns <name> <subdomain>.<domain>
```

The owner runs these once on/for the NAS; the resulting `credentials.json`
is what `deploy/cloudflared/config.yml` and the compose file reference.

## Testing

1. Activate page loads over HTTPS at the real domain.
2. A QR pairing round-trip works from a phone on **cellular data**, not home
   Wi-Fi — proves internet reachability, not just LAN resolution.
3. The stack comes back up on its own after a NAS reboot (Docker restart
   policy: `unless-stopped`).

## Explicit non-goals

- Does not touch the Android app. `android/` stays the disposable G1 test
  harness; a real host app is sub-project 2.
- Does not touch release signing (G7) — sub-project 3.
- Does not implement token persistence (ESCALATION-003) — deferred by the
  owner's own choice, recorded above.
- Does not implement or plan any paid/subscription distribution — see
  Decision record.
