# ESCALATION-003: Should the TV remember the listener between restarts?

- **GATE**: G5 — Integration
- **CLASS**: Auth / login (charter §4.5 — "token storage, token lifetime") — **human decision, not a vote**
- **STATUS**: awaiting the project owner. Nothing is blocked: the live app works
  today, it simply pairs again on every cold start.
- **RAISED BY**: the agent team, while wiring the live screens.

## What is being asked

Gate G5's PASS criterion includes:

> app restarted → still logged in (no re-pairing)

Today the live app keeps the Music User Token in `sessionStorage`, which
survives a reload and dies with the process. On a television that means **every
time you switch the TV on, you scan a QR code again.**

Meeting G5 means storing the token somewhere that outlives the app. That is a
decision about where a credential to a person's Apple Music account lives on a
device that may sit in a shared living room, so it is not mine to make.

## What is actually being stored

One opaque string that grants read and write access to the owner's Apple Music
library for as long as it remains valid. Not a password, not recoverable into
one, and it cannot be used to sign in to anything else — but it is not harmless
either.

**How long it stays valid is still unknown.** `scripts/token-lifetime.js` exists
to measure it and has not been run for long enough yet. That answer changes this
decision: a token that survives months is worth protecting carefully; one that
dies daily makes the whole question smaller.

## Options

| | Option | What it means | Cost |
|---|---|---|---|
| **A** | **Do not persist.** Pair on every cold start. | G5's "still logged in" criterion is not met and would have to be amended. Honest, zero new storage risk, and genuinely annoying. | None |
| **B** | **Persist in Android `EncryptedSharedPreferences`**, keyed by the hardware-backed keystore, and hand it to the WebView at boot. | The platform's standard answer. Survives restarts; protected at rest by the device keystore; readable only by our app's own UID. | Moderate — the token has to cross from the native host into the page, which is a new interface that did not exist before |
| **C** | **Persist on the pairing server**, keyed to the TV's `device_code`, and re-fetch it at boot. | Nothing sensitive on the TV at all. But the server becomes a store of user tokens, which is a much larger thing to secure than the stateless in-memory design we have now, and it undoes some of what G2 just bought. | High |

## Recommendation

**B, but not yet — measure the lifetime first.**

- A is the honest default while the answer is unknown, and it is what the code
  does today. It is not a failure, it is a deliberate hold.
- B is the right destination. `EncryptedSharedPreferences` is what Android
  provides for exactly this, and keeping the token on the one device that needs
  it beats centralising every listener's token on a server.
- C should not be chosen for convenience. Turning the pairing server from a
  stateless relay into a credential store is a security posture change, and
  we would be doing it a week after closing a hole in that same server.

Two things worth knowing before you choose:

1. **A shared living room is a real threat model.** Persisting means the next
   person to switch on that television is signed in as you. Whether that is
   acceptable is a judgement about your household, not a technical fact — and
   it is the main reason this is your call.
2. **Sequencing matters.** If `token-lifetime.js` shows the token expires in
   hours, B buys much less than it costs, and the interesting problem becomes
   refresh rather than storage.

## What I have done in the meantime

- The live app uses `sessionStorage` — survives a reload, dies with the process.
  Deliberately the weakest option, so nothing is quietly persisted while this is
  undecided.
- `onAuthLost` clears the stored token and returns the viewer to the pairing
  screen, so an expired token never leaves the app in a broken state.
- No code writes the token to disk, to a file, or to a log anywhere.

## Answer

_Awaiting the project owner._
