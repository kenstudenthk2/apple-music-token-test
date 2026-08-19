# POC-B Runbook — full-track playback on a real device

**Audience: the human project owner. This is gate G1, the highest risk on the project.**

The gate: a real Apple Music catalog track must play **from 0:00 to its natural
end** inside an **Android WebView** on a **physical** Android TV / Google TV
device, over **HTTPS**. Stopping near 30 seconds is a preview, and a preview is
a **FAIL** — not a partial pass.

The harness decides this itself and prints one of two verdicts in a bar you can
read from the sofa. You do not have to interpret anything.

---

## ⚠️ Read this first — the tunnel is public

The tunnel URL is reachable by anyone on the internet who has it. Two
consequences, both real:

1. **The known pairing gap is now exposed.** Anyone who guesses a live 4-character
   pairing code can retrieve the Music User Token attached to it. There are
   ~1M codes and no rate limiting — this is charter gate **G2**, still open.
   In practice nobody is guessing a random `*.trycloudflare.com` hostname, but
   the exposure is real while the tunnel is up.
2. **Treat the URL as a secret.** Do not post it anywhere. It changes every time
   the tunnel restarts, which is a feature.

**Shut the tunnel down as soon as the test is done.** Ask me to stop it, or close
the terminal running `cloudflared`.

The Apple `.p8` private key never leaves this machine. Only the developer token
(designed to be public) and the pairing endpoints are exposed.

---

## What is running right now

| Piece | Where |
|---|---|
| Pairing server | `localhost:8787` on this machine |
| HTTPS tunnel | cloudflared quick tunnel → that port |
| Harness page | `<TUNNEL>/pocb/` |
| Phone auth page | `<TUNNEL>/activate/<CODE>` — the harness prints the full link |

The tunnel hostname is in the chat message alongside this file. It is not
written here because it changes on every restart.

---

## Stage 0 — desktop browser (2 minutes, do this first)

Cheapest possible check. It proves the token path and playback work at all,
before any device variables are involved.

1. Open `<TUNNEL>/pocb/` in Chrome on your computer.
2. A pairing code appears. Open the printed link on your phone.
3. Sign in to Apple Music on the phone and authorize.
4. Watch the harness.

**Already verified by me on this machine:** secure context `true`, Widevine
`available`, pairing session created, no JavaScript errors. What is *not*
verified is everything past that point, because it needs your Apple account —
I do not sign in to your accounts.

| Stage 0 result | What it means |
|---|---|
| PASS | The architecture works in a normal browser. Proceed to stage 1. |
| FAIL at "token path: on-device authorize()" | **Important finding.** MusicKit would not accept the phone-obtained token; the QR design needs rethinking. Stop and tell me. |
| FAIL at ~30 s | Preview fallback. Stop and tell me — this is the failure mode we most feared. |

Stage 0 passing does **not** pass the gate. Desktop Chrome is not an Android TV WebView.

---

## Stage 1 — the TV's own browser (optional, 5 minutes)

If your TV has any browser, load `<TUNNEL>/pocb/` in it. This isolates *the
device's* DRM from *the WebView's* DRM.

- Works here but fails in stage 2 → the problem is WebView configuration, which
  is fixable in our app.
- Fails here too → the problem is the device's Widevine level. Note whether the
  harness says Widevine `available` or `UNAVAILABLE`.

---

## Stage 2 — Android WebView (this is the actual gate)

We need the page running inside `android.webkit.WebView`, not inside Chrome.

**Recommended route: TV Bro.** It is an open-source Android TV browser built
directly on Android WebView, so it exercises the same code path our app would.
Sideload it, open the harness URL, and read the verdict.

- Source: `https://github.com/truefedex/tv-bro` (also on F-Droid)
- It is a third-party app. Install it only if you are comfortable doing so.

**Caveat, stated plainly:** TV Bro is a *proxy* for our WebView, not our WebView.
It sets its own `WebSettings`. A PASS in TV Bro is strong evidence but is not
final; a FAIL in TV Bro is close to conclusive. The definitive test is our own
APK, which does not exist yet — building it is gate G7 work and it is
deliberately not being done before we know the answer here.

---

## What to send me

Whatever happens, I need these six things for `docs/POCB_RESULT.md`:

1. The **verdict bar** text, exactly.
2. A **photo or screenshot of the log panel** — the timestamps are the evidence.
3. **Device model** and **Android version**.
4. Which **stage** (0, 1 or 2) and which **browser/app**.
5. The **Widevine** cell: `available` or `UNAVAILABLE`.
6. The **Token path** cell: `paired (phone)` or `on-device authorize()`.

Item 6 matters as much as the verdict. If it says `on-device authorize()`, then
even a PASS means the phone-QR architecture did not do its job and the design
question reopens.

---

## If it fails

Do not pick a fallback yourself, and I will not pick one either — charter §4.5
makes gate-failure fallbacks a decision for you, taken with the evidence in
hand. The two known options are native ExoPlayer with Widevine, or a
Radon-Tunes-style approach. Which one is right depends entirely on *how* it
failed, which is why the log matters more than the verdict.
