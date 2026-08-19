# AppleTune TV — Project Charter

**Version**: 1.0
**Date**: 2026-08-19
**Repo**: `C:\Users\Kilson\github\apple-music-token-test` (branch `main`)
**Owner of this document**: SeniorProjectManager (management layer)
**Status**: ACTIVE — this charter governs every agent task on this project.

---

## 0. Where We Are Right Now

| Fact | State |
|---|---|
| Apple Developer account + MusicKit identifier | DONE |
| Developer Token (ES256 JWT) → HTTP 200 from `api.music.apple.com` | DONE (`test-token.js`, `test-token.test.js`) |
| POC-A: QR/code phone pairing → Music User Token → library API call | DONE, PASSING (`pairing-server.js`, `public/activate.html`, `tv-client.js`) |
| POC-B: full-track playback in an Android TV WebView | **NOT DONE — top project risk** |
| Security hardening (device secret, rate limit) | NOT DONE |
| Android app | DOES NOT EXIST YET |

Prior art proving feasibility: **Radon Tunes** (`com.brkchen.music`), a working third-party Apple Music client on Android TV. Playback is achievable; the unknown is the specific WebView/DRM configuration.

---

## 1. Scope

### 1.1 v1 IS

| # | In scope |
|---|---|
| S1 | Android / Google TV app (single APK), min SDK 24, leanback launcher entry |
| S2 | Login by **phone pairing only**: TV shows a QR code + short code, phone browser authorizes via MusicKit JS `music.authorize()` |
| S3 | Persist the Music User Token on the TV device (encrypted at rest) so login happens once |
| S4 | Playback of **full tracks** (subscriber account) via MusicKit JS inside a WebView, Widevine DRM |
| S5 | Browse: user's Library — Playlists, Albums, Artists, Songs, Recently Added |
| S6 | Search (Apple Music catalog + library) with on-screen keyboard |
| S7 | Now Playing screen: art, title/artist, progress, play/pause, next/prev, seek |
| S8 | Full D-pad remote navigation (no touch, no mouse, no pointer assumptions) |
| S9 | 10-foot UI: min 24sp body text, visible focus state on every focusable element, safe-area margins |
| S10 | Playback controls respond to TV remote media keys (PLAY/PAUSE, NEXT, PREV) |
| S11 | Self-hosted pairing server over HTTPS with device-secret auth + rate limiting |

### 1.2 v1 IS **NOT**

| # | Explicitly out of scope for v1 |
|---|---|
| N1 | Google Play Store publication (sideload / internal test track only) |
| N2 | Any platform other than Android TV — no phone UI, no Fire TV cert, no tvOS, no web app |
| N3 | Offline / downloaded playback |
| N4 | Apple Music **Radio** stations, live stations, Apple Music 1 |
| N5 | Lyrics, Sing, spatial audio, Dolby Atmos |
| N6 | Music videos / video content |
| N7 | Editing playlists, adding/removing library items, likes/dislikes, "Love" |
| N8 | Multi-user / profile switching on one TV |
| N9 | Chromecast / AirPlay send or receive |
| N10 | Recommendations ("For You"), Browse/Charts tabs |
| N11 | Any premium visual polish beyond a clean, functional 10-foot UI (animations, shaders, motion design) |
| N12 | Analytics, telemetry, crash reporting SaaS |
| N13 | Multi-tenant / multi-user hosting of the pairing server (single-user self-host only) |

**Scope-creep rule**: anything not listed in 1.1 requires a VOTE (§4) to enter scope. Absent a passed vote, it is out.

---

## 2. Phase Gates

Every gate has a PASS criterion that a person or script can check mechanically. No gate is "mostly passed". A gate is PASS or FAIL. **You may not start work on gate N+1 until gate N is PASS**, except where "Parallel OK" is stated.

### G0 — Foundation (DONE)
- **PASS**: `npm test` exits 0; `node test-token.js` prints HTTP 200 from `api.music.apple.com`; `pairing-server.js` + `public/activate.html` + `tv-client.js` complete a pairing round-trip and `tv-client.js` prints ≥1 playlist name from `/v1/me/library/playlists`.
- **FAIL**: any non-zero exit, any HTTP 401/403, or `tv-client.js` prints zero playlists.
- **Status**: ✅ PASS (POC-A).

### G1 — POC-B: Real Full-Track Playback ⚠️ HIGHEST RISK, DO THIS FIRST
- **Setup constraints (all mandatory)**: a **physical** Android TV / Google TV device (no emulator, no TV Chrome browser), page loaded in an **Android `WebView`**, served over **HTTPS** with a certificate the device trusts.
- **PASS**: a chosen catalog track plays audio **from 0:00 to its natural end**; the observed final playback position equals the track's catalog `durationInMillis` ±3000 ms; a screen recording or logged `playbackTime` trace proves it.
- **FAIL** (any one of these):
  - Playback stops at ~30 s (**preview = FAIL, full stop**);
  - `MediaKeys` / Widevine error, `NotSupportedError`, or EME unavailable in the WebView;
  - Audio only plays in TV Chrome but not in the WebView;
  - Requires user gesture that a D-pad remote cannot produce.
- **Deliverable**: `docs/POCB_RESULT.md` with device model, Android/WebView version, Widevine security level (L1/L3), the exact WebView settings required, and the recording/trace.
- **If FAIL**: STOP. Escalate to the human user with the failure mode and the two fallback options (native ExoPlayer + Widevine, or Radon-Tunes-style approach) — do NOT pick a fallback unilaterally.
- **Status**: ✅ **PASSED** (2026-08-19). A full catalog track played end to end inside `android.webkit.WebView` on physical Android TV hardware, via `pocb-playback-test.apk` — no 30-second preview. Token path was `paired (phone)` on both desktop and TV, so the Music User Token is **not** device-bound and the QR device-login architecture stands. Evidence artifacts (device model, WebView version, Widevine level, recording) are still outstanding — a documentation debt tracked in `docs/POCB_RESULT.md`, not a doubt about the result.
- **Consequence**: G2 becomes the critical path, and token lifetime/refresh — untested, and required by G5 — becomes the largest remaining unknown.

### G2 — Security Hardening (Parallel OK with G1)
- **PASS**, all four verified by an automated test in `pairing-server.test.js`:
  1. A request presenting only the 4-char code and **no** device secret returns HTTP 401 and no token;
  2. The device secret is generated on the TV, ≥32 bytes of CSPRNG entropy, sent only over TLS, never logged;
  3. \>5 code-redemption attempts from one IP within 60 s return HTTP 429;
  4. Pairing sessions expire ≤300 s after creation and codes are single-use.
- Plus: `git ls-files` returns zero matches for `*.p8`, `.env`, or any Music User Token literal.
- **FAIL**: any of the four tests failing, or any secret found tracked in git.
- **Status**: ✅ **PASSED** (2026-08-19). `pairing-server.test.js` — 14 tests, all four criteria — passes, and every one of them failed against the previous server first, which is the evidence the vulnerability was real. `user_code` and `device_code` are now separate: no route returns a Music User Token in response to a `user_code`. See `docs/decisions/ESCALATION-002-pairing-security-design.md`.

### G3 — TV UI Prototype (design frames the user can SEE)
- **PASS**: clickable/navigable HTML prototype (no backend required) covering all 5 screens — Pairing/QR, Library Home, Playlist/Album detail, Search, Now Playing — rendered at 1920×1080, delivered as an Artifact URL **and** screenshots in `docs/ui/`. Human user views it and records a decision.
- **FAIL**: fewer than 5 screens, or not viewable at 1080p, or the user cannot open it without running a build tool.
- **Status**: ✅ **PASSED** (2026-08-19). All five screens built in `public/tv/`, published as a self-contained Artifact, navigation verified end to end in Chrome with exactly one focus ring at every step. The project owner reviewed it and recorded a decision: keep the rotating-vinyl Now Playing treatment, keep the shelf order as drawn, defer phone-as-remote text entry, nothing missing. See `docs/beta/PROTOTYPE_REVIEW.md`.
- **Note on gate order**: G3 ran in parallel with G1 rather than after it, at the user's explicit direction to produce something viewable. That is a deliberate, recorded deviation from the gate order below, and it does not reduce G1's priority: if G1 fails, this UI work is sunk cost.

### G4 — D-pad Navigation
- **PASS**, verified on the real device with a real remote (or `adb shell input keyevent` script `scripts/dpad-sweep.sh`):
  1. Every interactive element is reachable using only UP/DOWN/LEFT/RIGHT/CENTER/BACK;
  2. The focused element is visually unambiguous in a screenshot at every step;
  3. BACK from any screen returns to the logical parent. On Home, BACK exits the app when nothing is playing, and raises an exit confirmation when playback is in progress. **Both paths are exercised.** (Amended by [VOTE-003](../docs/decisions/VOTE-003-back-at-root.md) — the original wording contradicted the navigation model and would have shipped an unguarded BACK that kills playback.);
  4. No focus trap: a scripted sweep of 200 random D-pad events never leaves focus on a non-visible or null element.
- **FAIL**: any element reachable only by pointer, any invisible focus state, any focus trap in the 200-event sweep.

### G5 — Integration: Login → Browse → Play
- **PASS**: from a freshly installed APK on the device, one uninterrupted run: pair via phone → library list appears → open a playlist → start a track → track plays to completion → app restarted → still logged in (no re-pairing). Recorded end to end.
- **FAIL**: any step requiring a laptop, a keyboard, `adb`, or a re-pair after restart.

### G6 — User Beta Test
- **PASS**: the human user completes the protocol in §7 unaided, and files ≥1 feedback form; all issues the user marks **Blocker** are resolved and re-verified.
- **FAIL**: user cannot complete pairing or start playback without agent assistance, or any open Blocker.

### G7 — Packaging & Handover
- **PASS**: signed release APK builds from a clean checkout with one documented command; APK contains **no** `.p8`, no developer token, no user token (verified by `scripts/apk-secret-scan.sh` over the unzipped APK); `docs/INSTALL.md` lets the user sideload it; app version + build date visible in the app's About screen.
- **FAIL**: build requires undocumented manual steps, or the secret scan finds any hit.

### Gate Order
```
G0 ✅ ──► G1 (POC-B)  ──►  G3 ──► G4 ──► G5 ──► G6 ──► G7
     └──► G2 (parallel with G1)  ──────────┘
```

---

## 3. Rules Every Agent Must Follow

1. **No secrets in the repo.** `.env`, `secure/*`, and `*.p8` stay in `.gitignore` and stay untracked. Never paste a private key, developer token, or Music User Token into a file, a commit, a log line, or a chat message.
2. **Never ship the `.p8` in the APK.** The signing key lives only on the pairing server. The TV app receives a short-lived developer token from the server; it never mints one.
3. **Max 3 files changed per task.** If a task needs a 4th file, stop and split it into subtasks first. Report the split to the management layer.
4. **Bug ⇒ failing test first.** Write a test that reproduces the bug and demonstrably fails, then fix until it passes. No fix lands without its reproducing test.
5. **STOP-AND-ASK on auth/login.** Any change to how login, pairing, tokens, token storage, token refresh, or session expiry works is escalated to the **human user** before implementation. Not a vote — a human decision (§4.5).
6. **Simple scripts over frameworks.** Plain Node (zero-dep, as `pairing-server.js` already is), plain HTML/CSS/JS, plain shell. No React/Vue/webpack/Gradle plugins/Docker unless a passed vote records the justification.
7. **Describe the approach and get approval before writing code.** Applies to every non-trivial task (per the user's global rules).
8. **No background processes.** Never append `&`, never `run_in_background` a dev server, never leave a process running after a task.
9. **No server-startup commands as part of a task.** Assume the dev server is already running; if it is not, ask.
10. **Evidence or it did not happen.** Every gate claim is backed by a command's output, a screenshot, or a recording committed under `docs/`. "It looks right" is not a PASS.
11. **Stay in scope.** Do not add features from §1.2. Do not add "premium" polish that was not asked for.
12. **Absolute paths only** in commands and reports.
13. **Report FAIL loudly.** If a check fails, say so with the raw output. Never soften, never partially claim a gate.
14. **Ask before anything irreversible** — deleting files, force-pushing, rotating the Apple key, publishing anything externally.
15. **Images/assets from approved sources only** (Unsplash, `https://picsum.photos/`). No Pexels (403s). Apple/Apple Music trademarks used only per Apple's Identity Guidelines.
16. **One task = one gate.** Every task in §6 names the gate it serves. Work that serves no gate is not started.
17. **Load by menu, never by sweep.** Every folder owns a `CLAUDE.md` listing what is inside it. Read the root `CLAUDE.md`, pick your folder, read that folder's `CLAUDE.md`, and stop. Do not `grep -r` the repo to orient yourself, and do not load `docs/` wholesale — list a document's headings first, then read only the section you need. Any new file must be added to its folder's menu in the same task that creates it.
18. **One task = one session.** Start a fresh session per task so no task inherits another's context. When a session grows long, compact it before continuing rather than carrying the whole history forward. Hand the next session a pointer to a file, never a transcript.
19. **Match the model to the task.** Simple, mechanical, well-specified work (renaming, formatting, boilerplate, a single-file edit against a written spec, running a check and reporting output) runs on **Sonnet 5 at medium effort**. Work that needs judgement (architecture, design, security, debugging an unknown failure, anything at a gate boundary, anything auth-adjacent) runs on **Opus 5**. The dispatching agent records the choice when it is not obvious. When genuinely unsure, use Opus 5 — a wrong answer costs more than the tokens saved.

---

## 4. Decision Protocol (Voting)

### 4.1 Who votes
The standing voting panel is **5 agents**:

| Seat | Agent |
|---|---|
| 1 | SeniorProjectManager (chair, votes, breaks nothing) |
| 2 | Software Architect |
| 3 | Frontend/TV Developer |
| 4 | Backend Architect |
| 5 | QA / Test Results Analyzer |

If a seat is unavailable, the chair may substitute UX Architect (for design questions) or Security Architect (for infra questions) and must record the substitution in the vote record.

### 4.2 What a proposal looks like
Every vote is opened with exactly this block, written to `docs/decisions/VOTE-<nnn>-<slug>.md`:

```
VOTE-<nnn>: <one-line title>
GATE: <G0..G7>
QUESTION: <a single question answerable by choosing one option>
OPTIONS:
  A) <option> — cost: <effort> — risk: <risk>
  B) <option> — cost: <effort> — risk: <risk>
  C) <option, optional>
RECOMMENDATION: <chair's recommendation + one sentence why>
DEADLINE: <this turn / next turn>
```
Max 3 options. A question with more than 3 viable options is not ready to vote — narrow it first.

### 4.3 Counting
- 5 votes cast, 1 each. Abstention is allowed but counts toward neither side.
- **Majority = more votes than any other option, with at least 3 votes cast in total.** With 5 voters and ≤3 options, the leader wins.
- Each vote must include a one-line reason. A vote with no reason is void.
- Result recorded at the bottom of the same `VOTE-<nnn>` file: tally, winner, dissents.

### 4.4 Ties
- On a tie, the chair re-opens **one** re-vote round with the tied options only and the dissenting reasons summarized.
- If the re-vote also ties → **escalate to the human user**, with both options, their costs, and the split reasoning. Work on that decision pauses until the user answers.

### 4.5 NON-votable decision classes (human user only)
Agents may not vote on, and must escalate to the human:

| Class | Examples |
|---|---|
| **Auth / login** | pairing flow changes, token storage/lifetime, device secret design, adding any OAuth/account system, anything that touches `music.authorize()` |
| **Apple account risk** | anything that could get the developer account flagged, key rotation, ToS-boundary behavior |
| **Spend** | paid hosting, paid domain, paid services, Play Store fees |
| **Distribution** | publishing anywhere public, sharing an APK outside the user |
| **Scope changes** | adding anything from §1.2 to v1 |
| **Gate FAIL fallbacks** | e.g. choosing native ExoPlayer after a G1 FAIL |

---

## 5. Agent Roster & RACI

**R** = Responsible (does it) · **A** = Accountable (one per row) · **C** = Consulted · **I** = Informed

| Workstream | PM | Architect | Research | UX Arch. | UI Designer | Frontend/TV | Backend | QA |
|---|---|---|---|---|---|---|---|---|
| Charter & gate enforcement | **A/R** | C | I | I | I | I | I | C |
| G1 POC-B: WebView/DRM spike | A | C | **R** | I | I | **R** | I | C |
| G2 Security hardening | A | C | C | I | I | I | **R** | **R** (tests) |
| G3 TV UI prototype | A | I | I | **R** (structure/CSS) | **R** (visuals) | C | I | C |
| G4 D-pad navigation | A | I | I | **R** | C | **R** | I | **R** (sweep) |
| G5 Integration build | A | **R** | I | I | I | **R** | C | **R** |
| G6 Beta test with user | **A/R** | I | I | C | I | C | C | **R** (log/triage) |
| G7 Packaging & docs | A | C | I | I | I | **R** | C | **R** (secret scan) |
| Vote administration | **A/R** | C | C | C | I | C | C | C |

Named agents: `Senior Project Manager`, `Software Architect`, `general-purpose` (research), `UX Architect`, `UI Designer`, `Frontend Developer` (TV), `Backend Architect`, `Test Results Analyzer` / `API Tester` (QA).

---

## 6. Task Board

Status: `DONE` · `IN PROGRESS` · `TODO` · `BLOCKED`

| # | Task | Owner | Gate | Status |
|---|---|---|---|---|
| T01 | ES256 developer token generation + smoke test vs `api.music.apple.com` | Backend | G0 | **DONE** |
| T02 | `pairing-server.js` — in-memory sessions, `TV-XXXX` codes | Backend | G0 | **DONE** |
| T03 | `public/activate.html` — MusicKit JS v3 + `music.authorize()` | Frontend | G0 | **DONE** |
| T04 | `tv-client.js` — poll for authorization, call `/v1/me/library/playlists` | Frontend | G0 | **DONE** |
| T05 | `test-token.test.js` — automated token test | QA | G0 | **DONE** |
| T06 | Research: Android WebView + Widevine + MusicKit JS requirements; produce a settings checklist | Research | G1 | TODO |
| T07 | Minimal Android WebView harness APK (one Activity, one WebView, loads an HTTPS URL) | Frontend/TV | G1 | TODO |
| T08 | HTTPS for the pairing server on LAN (trusted cert on device) | Backend | G1 | TODO |
| T09 | **POC-B run: full track to natural end on real device; write `docs/POCB_RESULT.md`** | Frontend/TV + QA | G1 | TODO |
| T10 | TV-side device secret: generate, store, send on every token fetch | Backend | G2 | **BLOCKED — auth change, needs human approval (Rule 5)** |
| T11 | Rate limit code redemption (5/60s/IP → 429) | Backend | G2 | TODO |
| T12 | Session TTL 300 s + single-use codes | Backend | G2 | TODO |
| T13 | `pairing-server.test.js` covering G2 criteria 1–4 | QA | G2 | TODO |
| T14 | Repo secret audit (`git ls-files` scan; confirm `secure/`, `.env`, `*.p8` untracked) | QA | G2 | TODO |
| T15 | UX: 10-foot layout system — grid, focus states, type scale, safe areas | UX Architect | G3 | TODO |
| T16 | UI frames: Pairing/QR, Library Home, Playlist detail, Search, Now Playing | UI Designer | G3 | TODO |
| T17 | Navigable HTML prototype at 1920×1080 + screenshots to `docs/ui/` | Frontend | G3 | TODO |
| T18 | **User review of the prototype (SHOW THE USER)** | PM + user | G3 | TODO |
| T19 | Focus engine: roving focus, spatial nav, BACK handling | Frontend/TV | G4 | TODO |
| T20 | `scripts/dpad-sweep.sh` — 200 random keyevents, assert no focus trap | QA | G4 | TODO |
| T21 | Media key handling (PLAY/PAUSE/NEXT/PREV) | Frontend/TV | G4 | TODO |
| T22 | Encrypted token persistence on device (survives restart) | Backend | G5 | **BLOCKED — auth change, needs human approval (Rule 5)** |
| T23 | Library browse screens wired to real API | Frontend/TV | G5 | TODO |
| T24 | Search screen + on-screen keyboard | Frontend/TV | G5 | TODO |
| T25 | Now Playing + transport controls wired to MusicKit | Frontend/TV | G5 | TODO |
| T26 | End-to-end recorded run (install → pair → browse → play → restart) | QA | G5 | TODO |
| T27 | Beta build + `docs/BETA_GUIDE.md` + feedback form | PM | G6 | TODO |
| T28 | **User beta session (SHOW THE USER)** | user | G6 | TODO |
| T29 | Blocker triage + fixes from beta feedback | PM → owners | G6 | TODO |
| T30 | Release signing + one-command build | Frontend/TV | G7 | TODO |
| T31 | `scripts/apk-secret-scan.sh` over the unzipped APK | QA | G7 | TODO |
| T32 | `docs/INSTALL.md` sideload guide + About screen version | PM | G7 | TODO |

---

## 7. Beta Test Protocol

### 7.1 What the user is asked to do (G6, ~20 minutes)
The user gets the APK, `docs/BETA_GUIDE.md`, and this task list. They do it alone — agents do not coach mid-run.

| Step | Task given to the user | We are measuring |
|---|---|---|
| B1 | Sideload the APK and open the app | install friction, cold start |
| B2 | Log in using your phone, no help | pairing discoverability, QR scannability from the sofa |
| B3 | Find and play any song from your library | browse comprehension, time to first audio |
| B4 | Let one song play all the way to the end | G1 regression in the real app |
| B5 | Search for an artist and play a track | search + on-screen keyboard usability |
| B6 | Pause, skip forward, go back one track | transport control discoverability |
| B7 | Press BACK until you exit, then reopen the app | back-stack sanity, session persistence |
| B8 | Try to break it: mash the remote for 60 s | crashes, focus traps |

### 7.2 Data collected

**Per step (user fills in `docs/beta/BETA_FEEDBACK.md`, copied from a template):**

| Field | Values |
|---|---|
| Completed? | Yes / Yes-with-struggle / No |
| Time taken | seconds (user's rough estimate is fine) |
| Severity if a problem | **Blocker** / Annoying / Cosmetic |
| What did you expect to happen? | free text |
| What actually happened? | free text |

**Overall:**
- "Would you use this instead of your current setup?" Yes / No / Not yet — plus why (one sentence).
- Top 3 things to fix, ranked by the user.
- Device model + Android version + TV brand.

**Collected automatically (no SaaS, local only):** `adb logcat` capture during the session, saved to `docs/beta/logcat-<date>.txt`; a screen recording if the user is willing.

### 7.3 How feedback becomes decisions

| Feedback class | Handling |
|---|---|
| **Blocker** | Becomes a task immediately; G6 cannot PASS while one is open; Rule 4 applies (failing test first). No vote needed. |
| **Annoying**, and the fix is inside §1.1 scope | PM proposes; fix goes on the board for the current gate. |
| **Annoying**, and the fix needs something from §1.2 | Opens a VOTE (§4.2) to change scope. |
| **Cosmetic** | Logged in `docs/beta/BACKLOG.md`. Not fixed in v1 unless the user ranks it top-3. |
| Anything touching login/pairing | **Escalate to the user, no vote** (Rule 5). |
| Contradicts an earlier passed vote | Re-vote with the user's feedback attached as new evidence. |

**The user's top-3 ranking overrides agent prioritisation.** A vote cannot demote something the user ranked #1.

---

## 8. Risk Register

Likelihood/Impact: H / M / L.

| # | Risk | L | I | Mitigation | Owner | Trigger to escalate |
|---|---|---|---|---|---|---|
| **R1** | **MusicKit JS in an Android WebView cannot play full tracks (Widevine/EME unavailable, or 30 s preview only)** — kills the entire architecture | **M** | **H** | Do G1 first, before ANY app code. Test on the real device early. Document exact WebView settings. Study Radon Tunes' approach as proof of an alternate path. | Frontend/TV + Research | Any G1 FAIL → stop all work, escalate to user with fallback options |
| R2 | Widevine L3-only device downgrades or blocks Apple Music streams | M | H | Record security level in `docs/POCB_RESULT.md`; test on a second device before concluding | Research | Playback works on one device, fails on another |
| R3 | Music User Token leaks — code-only retrieval (known gap (a)) | H (today) | H | G2 T10 device secret + G2 T11 rate limit; never leave localhost until G2 PASS | Backend | Any deployment attempt before G2 PASS |
| R4 | Apple developer account flagged / MusicKit access revoked for a non-approved client | L | H | Stay within MusicKit JS ToS; no scraping, no private endpoints; no public distribution in v1 (§1.2 N1) | PM | Any warning email from Apple |
| R5 | Developer token expiry / rotation breaks a running TV | M | M | Server mints short-lived tokens on request; TV never caches a token past its `exp`; refresh path tested in G5 | Backend | Token error in G5 run |
| R6 | Autoplay / user-gesture policy blocks playback start from a D-pad | M | M | Prove in G1 that a D-pad CENTER press satisfies the gesture requirement; if not, native fallback | Frontend/TV | Playback needs a touch event |
| R7 | Focus traps / unreachable UI on a real remote | M | M | G4 automated 200-event sweep + real-remote pass | QA | Any sweep failure |
| R8 | HTTPS on LAN with a device-trusted cert is painful | M | M | T08 spike early; fall back to a tunnel only with user approval (spend = non-votable) | Backend | >1 day lost on certs |
| R9 | Scope creep into §1.2 (lyrics, recommendations, polish) | H | M | Rules 11 & 16; every task names a gate; scope changes need a vote | PM | Any task with no gate |
| R10 | Agent task sprawl (>3 files, half-finished changes) | M | M | Rule 3; PM rejects oversized tasks at intake | PM | Task touches a 4th file |
| R11 | User can't complete beta unaided | M | M | G3 prototype review (T18) catches UX problems before code | UX Architect | Any B1–B3 marked "No" |
| R12 | Secret committed to git or bundled into the APK | L | H | Rules 1–2, T14 repo audit, T31 APK scan, `.gitignore` already covers `*.p8` / `.env` / `secure/*` | QA | Any scan hit → rotate key, escalate |

---

## 9. Amendment

This charter changes only via a passed VOTE (§4) or a direct instruction from the human user. Every amendment bumps the version at the top and is logged in `docs/decisions/`.
