# scripts/ — Dev tooling

Zero-dependency Node. Nothing here ships to the device.

| File | Purpose | Run with |
|---|---|---|
| `serve-prototype.js` | Static server for `public/`. Deliberately separate from `pairing-server.js` so the prototype is reviewable **without** the Apple `.p8` present. | `npm run prototype` → http://localhost:8788/tv/ |
| `build-prototype.js` | Inlines the prototype's CSS and ES modules into one self-contained `dist/prototype.html` for review or publishing. | `npm run build:prototype` |
| `pocb-session.ps1` | Brings up the pairing server, an HTTPS tunnel and a matching APK, **from your own shell**. An agent cannot host this: background processes it starts are reaped when its turn ends, which kills the tunnel and leaves the APK pointing at a dead hostname. | `.\scripts\pocb-session.ps1` |
| `token-lifetime.js` | Measures how long a Music User Token stays valid — the last untested assumption under gate G5. | `npm run token-lifetime` |

## Rules

1. **No dependencies.** Node built-ins only, same as the rest of the repo.
2. **No background processes.** Never append `&`, never leave a server running
   after a task. Assume the dev server is already up; if it is not, ask.
3. **A script that reads `.env` or the `.p8` must say so in the table above and
   explain why.** `serve-prototype.js` and `build-prototype.js` deliberately do
   not, so the prototype stays reviewable on a machine with no private key.
   `token-lifetime.js` is the exception: it re-mints a developer token on every
   probe, which is the entire point of it — a stale developer token would make
   it measure the wrong credential.
4. `build-prototype.js` is a dumb text substitution, not a bundler. It supports
   named `import`/`export` only. If you need `export default`, change the source
   module instead of teaching the bundler new tricks.
5. Anything the bundler cannot inline is **reported, not silently dropped** —
   keep it that way.

## token-lifetime.js — the confounder it exists to remove

A developer token expires after one hour, so a bare 401 on a library call
cannot tell you which credential died. Every probe mints a **fresh** developer
token and makes two calls:

| catalog (developer token only) | library (developer token + MUT) | Conclusion |
|---|---|---|
| 200 | 200 | both still valid |
| 200 | 401/403 | **the Music User Token expired** — the answer we want |
| not 200 | anything | our own developer token is broken; the library result proves nothing |

Never weaken that second call to a single probe. A one-call version would
report "expired" every hour, for the wrong credential, and the number would be
confidently wrong.

The token is written to `secure/token-probe.json`, which `.gitignore` already
excludes, and is never printed to the console or into the CSV.
