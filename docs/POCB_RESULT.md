# POC-B Result — gate G1

**Gate status: ✅ PASSED** (2026-08-19), on the project owner's direct
observation. See "Evidence gap" below — the pass is recorded, the paperwork the
charter asks for is not yet complete.

The gate asked: does a catalog track play from 0:00 to its natural end inside an
**Android WebView** on a **physical** Android TV device over HTTPS? It does.

| Stage | Environment | Result |
|---|---|---|
| 0 | Desktop Chrome (Windows), over the cloudflared tunnel | ✅ PASS — full track, no preview |
| 1 | The TV's own browser | skipped — went straight to the real test |
| 2 | **`android.webkit.WebView` on the TV, via `pocb-playback-test.apk`** | ✅ **PASS — this is the gate** |

Token path on **both** stages: **`paired (phone)`**.

---

## The two things this settles

### 1. Full-track playback works in an Android WebView

No 30-second preview. The failure mode the whole project was hedging against
did not occur.

Concretely, this means the two WebView settings in `MainActivity.configure()`
were the right ones and are load-bearing:

- `onPermissionRequest` granting `PROTECTED_MEDIA_ID` — a WebView denies the
  Widevine media-drm permission unless the host app grants it. Chrome grants it
  to itself; a WebView does not.
- `setMediaPlaybackRequiresUserGesture(false)` — a D-pad remote cannot produce
  the gesture the WebView otherwise waits for.

**Do not remove either.** If playback ever regresses to 30 seconds, check these
two before investigating anything else.

### 2. ⭐ The Music User Token is not device-bound

The harness reported `TOKEN PATH: paired (phone)` on the TV as well. MusicKit
accepted a token obtained in Safari on a phone and used it, inside a WebView on
a completely different device, to play protected content. It never fell back to
`authorize()`.

This retires the uncertainty the project was founded on. In the owner's own
words at the outset:

> 唔可以假設 Backend 喺電話取得 Apple Music 授權之後,就可以直接將 Music User
> Token 畀 Android TV。Apple 對 Music User Token 有 app／device 授權限制,所以
> 呢部分要先做實機技術驗證。

The verification is done and the constraint does not hold on this path. **The QR
device-login architecture stands.** The TV never needs an Apple sign-in of its
own, and the design in `docs/design/` can be built as drawn.

---

## Scope — what is proven, stated so it is not over-read

| Proven | Not proven |
|---|---|
| Full-track playback in an Android WebView on real TV hardware | That it works on *other* TV hardware. One device is one data point |
| The token is portable across devices, browsers, and into a WebView | Portability across a *different* app identity — untested, and not needed |
| Widevine negotiates successfully through our WebView configuration | The device's Widevine security level (L1 vs L3) was not recorded |
| Playback starts with no user gesture | Long-session behaviour: nothing here ran for hours |
| | **Token lifetime, expiry and refresh.** The test ran minutes after authorization. Gate G5 requires surviving an app restart without re-pairing — still open, and it is now the biggest remaining unknown |

---

## Evidence gap

Charter rule 10 is "evidence or it did not happen", and the G1 PASS criterion
asks for a screen recording or a logged `playbackTime` trace, plus device model,
Android/WebView version, and Widevine level. The pass is recorded on the
owner's direct observation of the harness verdict; those artifacts are not yet
attached.

Still worth capturing, because they are the baseline every future regression is
compared against:

- [ ] Device model and Android version
- [ ] WebView implementation and version — the app logs it: `adb logcat -s POCB`
- [ ] The Widevine cell from the harness (`available` / `UNAVAILABLE`)
- [ ] A photo of the verdict bar and log panel

This is a documentation debt, not a reason to doubt the result.

---

## What changes now

G1 was the gate every other gate was waiting behind, and it is the reason the UI
work was flagged as sunk cost if it failed. It did not fail, so:

- The G3 prototype and the design system are validated investments.
- **G2 (security hardening) becomes the critical path.** The pairing code alone
  is still sufficient to retrieve a Music User Token, and there is no rate
  limiting. That was tolerable while the whole direction was in doubt; it is not
  tolerable now that we are building on it.
- **Shut down the cloudflared tunnel.** It exposes that gap to the internet and
  has served its purpose.
- Token lifetime moves to the top of the risk register, since G5 depends on it
  and nothing about it has been tested.
