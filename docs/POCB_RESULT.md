# POC-B Result — gate G1

**Gate status: 🟡 NOT PASSED. Stage 0 passed; the gate itself is stage 2.**

The gate wording has not moved: a catalog track must play from 0:00 to its
natural end inside an **Android WebView** on a **physical** Android TV device
over HTTPS. A desktop browser cannot pass it, however well it does.

| Stage | Environment | Result | Date |
|---|---|---|---|
| 0 | Desktop Chrome (Windows), over the cloudflared tunnel | ✅ **PASS** — full track played to the end | 2026-08-19 |
| 1 | The TV's own browser | not run | — |
| 2 | Android WebView on the TV (our APK) | **not run — this is the gate** | — |

---

## Stage 0 — what it actually proved

Two separate things, and the second one matters more than the playback.

### 1. The pipeline works end to end

Pairing → phone authorization → Music User Token → MusicKit configured →
catalog track played from 0:00 to its natural end. No 30-second preview.

That rules out a whole class of failure: the developer token is right, the
storefront and charts calls work, MusicKit accepts our app identity, and Apple
serves full-length audio to this account.

### 2. ⭐ MusicKit accepted the phone-paired token directly

The harness reported **`TOKEN PATH: paired (phone)`**. It did *not* fall back to
`authorize()` on the device.

This is the load-bearing assumption of the entire product, and until now it had
never been tested. The original concern, in the project owner's own words, was:

> 唔可以假設 Backend 喺電話取得 Apple Music 授權之後,就可以直接將 Music User
> Token 畀 Android TV。Apple 對 Music User Token 有 app／device 授權限制。

**That concern does not hold here.** A Music User Token obtained in Safari on a
phone was accepted by MusicKit JS in a different browser on a different device
and used to play protected content. There is no device binding in this path.

Scope of the claim, stated precisely so it is not over-read:

| Proven | Not proven |
|---|---|
| The token is portable **across devices** | Portability across a *different* app identity — never tested, and never needed: both ends use our one MusicKit identifier |
| It is portable **across browsers** | That it survives long-term. Expiry and refresh behaviour is untested — see below |
| It works for **catalog playback** | Anything about a WebView, which is stage 2 |

**Consequence:** the QR device-login architecture stands. The TV never needs an
Apple sign-in of its own. Design work can continue on that basis.

---

## What stage 0 did *not* test

Do not let a green bar on a desktop imply any of these:

1. **Android WebView.** Chrome grants the Widevine media-drm permission to
   itself; a WebView denies it unless the host app calls
   `request.grant(...)` for `PROTECTED_MEDIA_ID`. This is the single most likely
   cause of a stage 2 failure and is exactly why stage 2 exists.
2. **TV hardware.** Desktop Chrome had Widevine `available`. A TV SoC may be
   Widevine L3, or have a broken CDM, or lack one entirely.
3. **Autoplay without a gesture.** A desktop click satisfied any gesture
   requirement. A D-pad remote cannot produce one — hence
   `setMediaPlaybackRequiresUserGesture(false)` in the APK.
4. **Token lifetime.** The whole test ran within minutes of authorization.
   Nothing here says how long a Music User Token stays valid, what happens when
   it expires, or whether it can be refreshed without re-pairing. Gate G5
   requires surviving an app restart; that is still open.

---

## Next

Run stage 2 with `pocb-playback-test.apk` on the physical TV.

Record these six, per `docs/POCB_RUNBOOK.md`:
verdict text · log screenshot · device model · Android version · Widevine cell ·
token path cell.

If stage 2 fails, do not pick a fallback — charter §4.5 makes gate-failure
fallbacks the project owner's decision, taken with the log in hand, because
*how* it failed determines which fallback is even relevant.
