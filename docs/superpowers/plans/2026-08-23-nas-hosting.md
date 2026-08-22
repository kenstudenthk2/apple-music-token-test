# NAS Hosting for pairing-server.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get `pairing-server.js` running permanently on the owner's Ugreen NAS, reachable at a stable HTTPS URL through a named Cloudflare Tunnel, so later work (a real Android host app, release packaging) has a fixed address to build against.

**Architecture:** A `docker-compose.yml` under `deploy/` runs two containers on one internal Docker network — `app` (the existing `pairing-server.js`, containerized with zero new dependencies) and `cloudflared` (Cloudflare's tunnel client, connecting outbound to a named tunnel using a `TUNNEL_TOKEN`). No port is published to the NAS's host network or router; `cloudflared` is the only way in, and it only dials out.

**Tech Stack:** Node.js (`node:20-alpine`), Docker Compose, `cloudflare/cloudflared` official image. No new npm dependencies — this remains a zero-dependency project.

## Global Constraints

- Zero dependencies: the app itself installs nothing new. Only infra tooling (Docker, cloudflared) is added, outside `package.json`.
- Never commit secrets: `.p8`, any `.env`/`deploy/.env`, and the Cloudflare `TUNNEL_TOKEN` never enter git, an image layer, or a log line.
- Every new folder gets a `CLAUDE.md` menu in the same task that creates it; every new file gets a row in its folder's menu in the same task that creates it (root `CLAUDE.md` §"Any new file is added to its folder's menu").
- No port-forwarding, no dynamic DNS: `cloudflared` is outbound-only, per the approved design (`docs/superpowers/specs/2026-08-23-nas-hosting-design.md`).
- Creating the actual named Cloudflare Tunnel requires the owner's own Cloudflare login — no task in this plan can execute that step; each such task hands the owner exact commands and stops.
- This plan does not touch the Android app, release signing, or token persistence (ESCALATION-003) — all explicitly out of scope per the design doc.

---

### Task 1: Configurable listen host in pairing-server.js

**Files:**
- Modify: `pairing-server.js:33` (add), `pairing-server.js:456-464` (`main()`)
- Test: `pairing-server.test.js`

**Interfaces:**
- Produces: `resolveHost()` — exported function, no arguments, returns a string. `process.env.HOST || "127.0.0.1"`. Later Docker Compose work (Task 4) sets `HOST=0.0.0.0` in the container's environment; nothing else changes this variable.

- [ ] **Step 1: Write the failing tests**

Add to `pairing-server.test.js`, in the `require` list at the top:

```js
const {
  SESSION_TTL_MS,
  createServer,
  deviceCodeIndex,
  failures,
  generateCode,
  resolveHost,
  sessions,
} = require("./pairing-server");
```

Add a new section near the bottom of the file, after the last existing test:

```js
/* ---------------------------------------------------------------- *
 * Listen host — Docker Compose needs 0.0.0.0, local dev needs 127.0.0.1
 * ---------------------------------------------------------------- */

test("resolveHost defaults to loopback when HOST is unset", () => {
  const original = process.env.HOST;
  delete process.env.HOST;
  try {
    assert.equal(resolveHost(), "127.0.0.1");
  } finally {
    if (original === undefined) delete process.env.HOST;
    else process.env.HOST = original;
  }
});

test("resolveHost honours HOST when set, for the Docker Compose network", () => {
  const original = process.env.HOST;
  process.env.HOST = "0.0.0.0";
  try {
    assert.equal(resolveHost(), "0.0.0.0");
  } finally {
    if (original === undefined) delete process.env.HOST;
    else process.env.HOST = original;
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `resolveHost is not a function` (it is not exported yet).

- [ ] **Step 3: Implement `resolveHost` and use it**

In `pairing-server.js`, right after the `PORT` constant (currently line 33):

```js
const PORT = Number(process.env.PORT || 8787);
// Local dev binds loopback only. The Docker Compose network (deploy/) sets
// HOST=0.0.0.0 so the cloudflared sidecar can reach this container by its
// service name — see docs/superpowers/specs/2026-08-23-nas-hosting-design.md.
function resolveHost() {
  return process.env.HOST || "127.0.0.1";
}
```

Change `main()` (currently lines 456-464) from:

```js
function main() {
  loadEnvFile();
  const server = createServer(createDeveloperTokenProvider());

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Pairing server listening on http://localhost:${PORT}`);
    console.log("Start the TV side with: node tv-client.js");
  });
}
```

to:

```js
function main() {
  loadEnvFile();
  const server = createServer(createDeveloperTokenProvider());
  const host = resolveHost();

  server.listen(PORT, host, () => {
    console.log(`Pairing server listening on http://${host}:${PORT}`);
    console.log("Start the TV side with: node tv-client.js");
  });
}
```

Add `resolveHost` to the module's existing `module.exports` block (find it near the bottom of the file, alongside `createServer`, `generateCode`, etc., and add `resolveHost` to that same object).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests including the two new ones, 100% of the existing suite still green (this change is additive; nothing about `createServer` or request handling changed).

- [ ] **Step 5: Commit**

```bash
git add pairing-server.js pairing-server.test.js
git commit -m "Make the pairing server's listen host configurable via HOST

Local dev is unaffected — nothing sets HOST there, so the default stays
127.0.0.1. The Docker Compose network (coming next) sets HOST=0.0.0.0 so
the cloudflared sidecar can reach this container by service name; a
container port is never published to the NAS's host network or router,
so this is not an exposure change."
```

---

### Task 2: Scaffold the deploy/ folder and register it in the root menu

**Files:**
- Create: `deploy/CLAUDE.md`
- Modify: `CLAUDE.md` (root menu table)

**Interfaces:**
- Produces: the `deploy/` folder existing with a menu file later tasks append rows to. No code interface — this is scaffolding.

- [ ] **Step 1: Create `deploy/CLAUDE.md`**

```markdown
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
```

- [ ] **Step 2: Add a row to the root `CLAUDE.md` menu table**

Find the `## Menu` table in the root `CLAUDE.md` and add a row (matching the existing table's format exactly):

```markdown
| [`deploy/`](deploy/CLAUDE.md) | Permanent hosting for the pairing server (Docker + Cloudflare Tunnel) | You are deploying, redeploying, or changing how the app is hosted long-term |
```

- [ ] **Step 3: Verify the menu links resolve**

Run: `test -f deploy/CLAUDE.md && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add deploy/CLAUDE.md CLAUDE.md
git commit -m "Scaffold deploy/ for permanent NAS hosting

Empty menu for now; the next tasks fill in the Dockerfile, compose file,
and runbook, each adding its own row here as it lands."
```

---

### Task 3: Dockerfile and build-context hygiene

**Files:**
- Create: `deploy/Dockerfile`
- Create: `.dockerignore` (repo root — this is where Docker looks for it when the build context is the repo root)
- Modify: `deploy/CLAUDE.md` (menu row)

**Interfaces:**
- Consumes: none from earlier tasks (uses `pairing-server.js`, `test-token.js`, `public/` as they already exist).
- Produces: a buildable image tagged from `deploy/Dockerfile`, exposing port `8787`, running as the non-root `node` user, with `HOST` and `PORT` set as environment defaults matching Task 1's `resolveHost()`/existing `PORT` logic.

- [ ] **Step 1: Create `.dockerignore` at the repo root**

```
.git
node_modules
android
docs
scripts
secure
.env
*.p8
*.test.js
dist
deploy/.env
```

This matters even though the Dockerfile never `COPY`s these paths: without it, Docker still uploads the whole build context (including `secure/`, `.env`, any `.p8`) to the daemon before deciding what to copy. Excluding them here means they never leave the host filesystem in the first place.

- [ ] **Step 2: Create `deploy/Dockerfile`**

```dockerfile
# Zero-dependency Node app (see package.json "engines": node >=18). No
# npm install step is needed — this base image only provides the runtime.
#
# Build from the REPO ROOT, not this folder:
#   docker build -f deploy/Dockerfile -t appletune-pairing .
# docker-compose.yml (next task) sets this via `context: ..`.
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY pairing-server.js test-token.js ./
COPY public ./public

# node:20-alpine already ships an unprivileged "node" user/group.
USER node

ENV PORT=8787
ENV HOST=0.0.0.0
EXPOSE 8787

# /api/version will report "no-git" in this container: .git is intentionally
# excluded (.dockerignore) to avoid shipping repo history into a running
# container. pairing-server.js already treats a checkout without .git as a
# normal, handled case — this is that same fallback, not a new failure mode.
CMD ["node", "pairing-server.js"]
```

- [ ] **Step 3: Build the image and verify it starts**

Run:
```bash
docker build -f deploy/Dockerfile -t appletune-pairing:test .
docker run --rm -d --name appletune-pairing-test \
  -e APPLE_PRIVATE_KEY_PATH=/nonexistent.p8 \
  -p 18787:8787 appletune-pairing:test
sleep 1
curl -s http://localhost:18787/api/version
docker stop appletune-pairing-test
```

Expected: the `curl` prints `{"commit":"no-git"}`. The server starts and answers `/api/version` even with a bogus `APPLE_PRIVATE_KEY_PATH`, because that path is only read lazily when a route actually needs a developer token (`buildDeveloperToken()`, called from a provider function — see `pairing-server.js:64-74`), not at startup. This confirms the image and its entrypoint work before any real Apple credentials are involved.

If `docker` is not available in the environment running this task, skip this step and note it explicitly in the task's completion notes — Task 6 (end-to-end validation) re-verifies this on the actual NAS regardless.

- [ ] **Step 4: Add a row to `deploy/CLAUDE.md`'s menu table**

```markdown
| `Dockerfile` | Builds the `pairing-server.js` image. Build context is the repo root — see the file's own header comment | You are changing what the image contains or how it starts |
```

- [ ] **Step 5: Commit**

```bash
git add deploy/Dockerfile .dockerignore deploy/CLAUDE.md
git commit -m "Add the pairing-server Docker image

Builds from the repo root so it can reach public/, pairing-server.js, and
test-token.js. .git is deliberately excluded from the build context —
/api/version falls back to \"no-git\", the same handled case an ordinary
checkout without .git already produces."
```

---

### Task 4: Docker Compose stack (app + cloudflared)

**Files:**
- Create: `deploy/docker-compose.yml`
- Create: `deploy/.env.example`
- Modify: `deploy/CLAUDE.md` (menu rows)

**Interfaces:**
- Consumes: `deploy/Dockerfile` (Task 3), `resolveHost()`'s `HOST` env var contract (Task 1).
- Produces: a `docker compose up` stack with services named `app` and `cloudflared` on one Compose-managed network, where `cloudflared` reaches the server at `http://app:8787`.

- [ ] **Step 1: Create `deploy/.env.example`**

```
# Copy this file to deploy/.env and fill in real values.
# deploy/.env is gitignored — never commit it.

# Apple Developer credentials — same three values test-token.js already
# needs locally. See docs/HOME_SETUP.md for where these come from.
APPLE_TEAM_ID=
APPLE_KEY_ID=

# Absolute path ON THE NAS to the .p8 private key file. Mounted read-only
# into the app container at /secrets/AuthKey.p8 — see docker-compose.yml.
SECRETS_DIR=/volume1/appletune/secrets

# From `cloudflared tunnel token <name>` after creating the tunnel —
# see deploy/RUNBOOK.md. Treat this like a password.
TUNNEL_TOKEN=
```

- [ ] **Step 2: Create `deploy/docker-compose.yml`**

```yaml
services:
  app:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    restart: unless-stopped
    environment:
      APPLE_TEAM_ID: ${APPLE_TEAM_ID}
      APPLE_KEY_ID: ${APPLE_KEY_ID}
      APPLE_PRIVATE_KEY_PATH: /secrets/AuthKey.p8
    volumes:
      - ${SECRETS_DIR}/AuthKey.p8:/secrets/AuthKey.p8:ro
    networks:
      - internal
    # Deliberately no `ports:` — nothing is published to the NAS's host
    # network. cloudflared is the only way in. See deploy/CLAUDE.md rule 2.

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    networks:
      - internal
    depends_on:
      - app

networks:
  internal:
```

- [ ] **Step 3: Validate the compose file parses and wires as expected**

Run: `docker compose -f deploy/docker-compose.yml config`
Expected: prints the fully resolved config with no errors. `TUNNEL_TOKEN`/`APPLE_TEAM_ID`/etc. show as empty strings if `deploy/.env` does not exist yet locally — that is expected in this dev environment; the NAS deployment (Task 6) is where real values are supplied.

If a local smoke test of the two-container network is possible (Docker available, willing to use dummy values), an engineer can additionally run:

```bash
cd deploy
cp .env.example .env
# edit .env: leave TUNNEL_TOKEN blank if you don't have a real tunnel yet —
# cloudflared will fail to authenticate, which is fine for this check; it
# still proves the `app` container is reachable from `cloudflared` by name.
echo "dummy key material" > /tmp/AuthKey.p8
sed -i "s#SECRETS_DIR=.*#SECRETS_DIR=/tmp#" .env
docker compose up -d app
docker compose exec app wget -qO- http://localhost:8787/api/version
docker compose down
```

Expected: `{"commit":"no-git"}` (or a real short commit hash if `.git` happens to be present in the environment's checkout — either is fine; it proves the app container serves traffic).

- [ ] **Step 4: Add rows to `deploy/CLAUDE.md`'s menu table**

```markdown
| `docker-compose.yml` | The two-container stack (`app`, `cloudflared`) | You are changing how the containers are wired, their env vars, or restart policy |
| `.env.example` | Template for `deploy/.env` (gitignored, never commit the real one) | You need to know which variables the stack requires |
```

- [ ] **Step 5: Commit**

```bash
git add deploy/docker-compose.yml deploy/.env.example deploy/CLAUDE.md
git commit -m "Add the Docker Compose stack: app + cloudflared sidecar

No ports published to the host — cloudflared is the only ingress and it
only dials out. app and cloudflared share one internal network so the
tunnel can reach the pairing server by its service name."
```

---

### Task 5: Runbook for the owner's manual Cloudflare steps

**Files:**
- Create: `deploy/RUNBOOK.md`
- Modify: `docs/HOME_SETUP.md` (append a short pointer)
- Modify: `deploy/CLAUDE.md` (menu row)

**Interfaces:**
- Consumes: `deploy/.env.example`'s variable names (Task 4) — the runbook explains how to obtain each one.
- Produces: nothing code-facing. This is documentation the owner follows by hand; no later task depends on its internal structure, only on the fact that following it produces a filled-in `deploy/.env` and a routed tunnel hostname.

- [ ] **Step 1: Create `deploy/RUNBOOK.md`**

```markdown
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
```

- [ ] **Step 2: Append a pointer in `docs/HOME_SETUP.md`**

Find the end of the file (after its last numbered section, "If something
fails") and append:

```markdown

---

## 7. Permanent hosting, instead of a per-session tunnel

Everything above brings up a **temporary** session for local development.
For a permanent deployment on the owner's own NAS — a stable URL that
survives reboots and doesn't need `pocb-session.ps1` running — see
`deploy/RUNBOOK.md` instead.
```

- [ ] **Step 3: Add a row to `deploy/CLAUDE.md`'s menu table**

```markdown
| `RUNBOOK.md` | The manual, owner-run steps: Cloudflare Tunnel creation, DNS routing, `deploy/.env`, first `docker compose up` | You are standing up the stack for the first time, or rotating the tunnel token |
```

- [ ] **Step 4: Commit**

```bash
git add deploy/RUNBOOK.md docs/HOME_SETUP.md deploy/CLAUDE.md
git commit -m "Add the runbook for standing up the permanent NAS deployment

Documents only — the Cloudflare Tunnel creation steps need the owner's
own login and cannot be run by an agent session."
```

---

### Task 6: End-to-end validation on the real NAS

**Files:**
- Create: `docs/NAS_DEPLOY_RESULT.md`
- Modify: `docs/CLAUDE.md` (menu row)

**Interfaces:**
- Consumes: a working stack from Tasks 1-5, brought up by the owner following `deploy/RUNBOOK.md`.
- Produces: a written, evidence-backed record of whether the deployment actually works — this repo's own convention (see `docs/G4_RESULT.md`, `docs/POCB_RESULT.md`): "Evidence or it did not happen."

This task is executed by the owner (or an agent with real access to the NAS and domain), not by an agent working from a sandboxed dev checkout — none of Tasks 1-5 required real secrets or NAS access; this one does.

- [ ] **Step 1: Bring the stack up on the NAS**

Follow `deploy/RUNBOOK.md` steps 1-6 if not already done.

- [ ] **Step 2: Verify HTTPS reachability**

```bash
curl -sI https://pairing.<your-domain>/api/version
```

Expected: `HTTP/2 200`, and the body is `{"commit":"<hash>"}`.

- [ ] **Step 3: Verify a real QR pairing round-trip from cellular data**

On a phone with Wi-Fi turned OFF (cellular data only, to prove this isn't
just resolving on the home LAN):

1. Start a session: `curl -X POST https://pairing.<your-domain>/api/session`
   — note the `activate_url`.
2. Open that URL on the phone over cellular data.
3. Complete the MusicKit authorization.
4. Confirm the TV-side poll (`GET /api/session/token` with the printed
   `device_code`) returns `"status":"authorized"`.

- [ ] **Step 4: Verify reboot survival**

```bash
# On the NAS
docker compose restart
# or, more realistically, reboot the NAS itself and wait for it to come
# back up, then:
docker compose ps
curl -sI https://pairing.<your-domain>/api/version
```

Expected: both containers show `Up`, and the `curl` still succeeds — the
`restart: unless-stopped` policy in `docker-compose.yml` (Task 4) is what's
being verified here.

- [ ] **Step 5: Record the result**

Create `docs/NAS_DEPLOY_RESULT.md` following the shape of
`docs/POCB_RESULT.md` — a status line, an evidence table, and what is/isn't
proven. Fill in the actual values observed in Steps 2-4:

```markdown
# NAS Deployment Result

**Status: <PASSED | FAILED>** (<date>)

Verifies that pairing-server.js runs permanently and is reachable over the
public internet through the deploy/ Docker Compose stack.

| Check | Result |
|---|---|
| HTTPS reachable at the real domain | |
| QR pairing round-trip from cellular data | |
| Survives a container restart | |
| Survives a full NAS reboot | |

## Evidence

<paste curl output, timestamps, whatever was actually observed>

## What this does not prove

- Long-running stability over days/weeks — this is a point-in-time check.
- Behaviour if the NAS loses power ungracefully mid-write — not tested.
```

- [ ] **Step 6: Add a row to `docs/CLAUDE.md`'s menu table**

```markdown
| `NAS_DEPLOY_RESULT.md` | Everyone | Records whether the permanent NAS deployment actually works end-to-end |
```

- [ ] **Step 7: Commit**

```bash
git add docs/NAS_DEPLOY_RESULT.md docs/CLAUDE.md
git commit -m "Record NAS deployment validation result

Evidence for the hosting sub-project: HTTPS reachability, a real QR
pairing round-trip from cellular data, and restart/reboot survival."
```
