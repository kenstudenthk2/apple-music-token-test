# AppleTune TV — Repository Menu

**Read this file first. Read only the folder CLAUDE.md you actually need.**

This repo is organised so that no agent ever has to load the whole tree into
context. Every folder owns a `CLAUDE.md` describing what is inside it and what
the rules are for touching it. Load the menu, pick your folder, load that
folder's `CLAUDE.md`, and stop there.

## Context discipline (mandatory)

1. **Load by menu, not by search.** Use this table to find your folder. Do not
   `grep -r` the repo to orient yourself.
2. **One task = one session.** Start a fresh session per task. When a session
   grows long, compact it before continuing rather than carrying the whole
   history forward.
3. **Read the narrowest thing that answers the question.** A folder `CLAUDE.md`
   before a document; a document's heading list (`grep -n '^#'`) before the
   document; a specific line range before a whole file.
4. **Never load `docs/` wholesale.** Those files are long by design. Each one
   states its own audience at the top — skip the ones not addressed to you.
5. **Do not read `.pen`, `.p8`, `.env`, or anything under `secure/`.**
6. **Match the model to the task.** Simple, mechanical, well-specified work runs
   on **Sonnet 5 at medium effort**. Work needing judgement — architecture,
   design, security, debugging an unknown failure, anything at a gate boundary
   or auth-adjacent — runs on **Opus 5**. When unsure, use Opus 5.
7. **Any new file is added to its folder's menu in the same task that creates
   it.** A file nobody can find from the menu does not exist.

## Menu

| Path | What lives there | Load it when |
|---|---|---|
| [`docs/`](docs/CLAUDE.md) | Charter, gates, rules, decisions, research, design specs | You need to know the rules, a gate criterion, or a past decision |
| [`public/tv/`](public/tv/CLAUDE.md) | The TV app front end — screens, styles, navigation | You are building or changing anything the viewer sees on the TV |
| [`public/activate.html`](public/CLAUDE.md) | The phone-side authorization page | ⚠️ Auth surface — read `public/CLAUDE.md` before touching |
| [`android/`](android/CLAUDE.md) | The POC-B WebView host app (gate G1) | You are changing how the TV app hosts the WebView, or building the test APK |
| [`scripts/`](scripts/CLAUDE.md) | Dev servers and the prototype bundler | You need to run, serve, or bundle the prototype |
| root `*.js` | Token minting, pairing backend, TV client | ⚠️ Auth surface — see `docs/CLAUDE.md` §Auth before touching |

## Root files at a glance

| File | Purpose |
|---|---|
| `test-token.js` | Mints the Apple Music **developer token** (ES256 JWT). Also exports the JWT/DER helpers. |
| `test-token.test.js` | Tests for the above. `npm test`. |
| `pairing-server.js` | The QR pairing backend. Serves the developer token and the activate page. |
| `tv-client.js` | CLI stand-in for the TV during POC-A. Polls for authorization, reads the library. |
| `package.json` | npm scripts — see below. |

## Commands

```bash
npm test               # unit tests
npm start              # developer-token smoke test -> expects HTTP 200
npm run pair           # pairing backend on :8787 (needs the .p8)
npm run tv             # TV stand-in client
npm run prototype      # static server for the TV prototype on :8788 (no .p8 needed)
npm run build:prototype  # bundle the prototype into dist/prototype.html
```

## Hard rules (apply everywhere, no exceptions)

1. **Never commit or print secrets.** `.env`, `secure/*`, `*.p8`, developer
   tokens, and Music User Tokens stay out of files, logs, commits, and chat.
2. **Never put the `.p8` in an APK.** It lives on the server only.
3. **Max 3 files changed per task.** A 4th file means the task must be split.
4. **A bug gets a failing test first**, then the fix.
5. **Anything touching auth, login, pairing, or tokens stops and asks the human
   user.** It is not a vote and not an agent decision.
6. **Simple scripts over frameworks.** Zero-dependency Node, plain HTML/CSS/JS.
7. **Evidence or it did not happen.** Gate claims need command output, a
   screenshot, or a recording.

Full rule list and the gate definitions: [`docs/PROJECT_CHARTER.md`](docs/PROJECT_CHARTER.md).
