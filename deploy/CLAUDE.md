# deploy/ — Permanent hosting for pairing-server.js

Everything needed to run `pairing-server.js` permanently on the owner's own
hardware (an Ugreen NAS, via Docker), reached through a named Cloudflare
Tunnel. Design record: `docs/superpowers/specs/2026-08-23-nas-hosting-design.md`.

This is NOT the same thing as `scripts/serve-prototype.js` or the dev-only
`scripts/pocb-session.ps1` tunnel session — those are for local development.
This folder is for the one deployment meant to stay up.

## Menu

| File | Owns | Load it when |
|---|---|---|
| `Dockerfile` | Builds the `pairing-server.js` image. Build context is the repo root — see the file's own header comment | You are changing what the image contains or how it starts |
| `docker-compose.yml` | The two-container stack (`app`, `cloudflared`) | You are changing how the containers are wired, their env vars, or restart policy |
| `.env.example` | Template for `deploy/.env` (gitignored, never commit the real one) | You need to know which variables the stack requires |
| `RUNBOOK.md` | The manual, owner-run steps: Cloudflare Tunnel creation, DNS routing, `deploy/.env`, first `docker compose up` | You are standing up the stack for the first time, or rotating the tunnel token |

## Rules

1. **Never commit a secret from this folder.** `.p8`, `deploy/.env`, and the
   Cloudflare `TUNNEL_TOKEN` are read from files/variables outside git —
   never baked into an image layer, never in a file tracked here.
2. **No port is ever published to the host network.** `cloudflared` is the
   only ingress path, and it only makes outbound connections. Adding a
   `ports:` mapping to `docker-compose.yml` defeats the reason this exists.
3. **The Docker build context is the repo root**, not this folder — the
   image needs `pairing-server.js`, `test-token.js`, and `public/` from
   there. See `deploy/Dockerfile`'s own comments once it exists.
4. **Creating the actual Cloudflare Tunnel needs the owner's own Cloudflare
   login.** No agent session can do this — see `deploy/RUNBOOK.md` once it
   exists, and `scripts/CLAUDE.md`'s note on `pocb-session.ps1` for the same
   reasoning applied elsewhere in this repo.
