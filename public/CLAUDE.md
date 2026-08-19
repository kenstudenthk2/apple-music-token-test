# public/ — Served files

| Path | What it is | Rules |
|---|---|---|
| `tv/` | The TV front end | See [`tv/CLAUDE.md`](tv/CLAUDE.md) |
| `activate.html` | The phone-side Apple Music authorization page | ⚠️ **Auth surface — read below before touching** |

## ⚠️ activate.html is an auth surface

This page is the only place in the project that calls `music.authorize()` and
the only place a Music User Token exists in a browser. It is therefore governed
by the stop-and-ask rule, not by a vote.

**Escalate to the human user before changing any of these:**

- the call to `music.authorize()` or anything around it
- how the Music User Token is read, held, or posted to the backend
- the `MusicKit.configure()` arguments, including the `app` identity
- where the developer token comes from
- the pairing code parsing, or the endpoint the token is posted to
- anything that changes what the user is being asked to consent to

**Safe to change without escalating:** wording, layout, styling, error message
text, and accessibility of the page — as long as the user can still tell what
they are authorizing and for which device.

## Never

- Never log, display, or persist a Music User Token. Not to the console, not to
  `localStorage`, not into a file, not into a commit.
- Never inline the developer token into this page. It is fetched at runtime.
- Never load MusicKit JS from anywhere other than Apple's own CDN.
