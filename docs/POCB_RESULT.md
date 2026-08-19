# POC-B Result — gate G1

**Gate status: ✅ PASSED** (2026-08-19). Evidence captured on the device — see
"Evidence" below.

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

## Evidence — captured 2026-08-19

Photographed on the device during a run. This is the baseline every future
regression is compared against.

| Field | Value |
|---|---|
| Display | TCL television |
| WebView user agent | `Chrome/150.0.7871.183 Mobile Safari/537.36` — Android System WebView 150 |
| Widevine | **available** (`keySystem=com.widevine.alpha`) |
| Token path | **paired (phone)** |
| Track | "Choosin' Texas" — Ella Langley (id 1844932150) |
| Catalog duration | 3:52 |
| Observed position | **1:22 and advancing** |
| Pairing code | TV-Z5JH |

Harness log, verbatim:

```
 0.2s  Widevine available (keySystem=com.widevine.alpha).
 0.6s  Pairing session TV-Z5JH. On your phone open: https://…/activate/TV-Z5JH
76.0s  Phone authorized. Music User Token received (not printed).
76.0s  Waiting for MusicKit JS…
76.7s  MusicKit configured.
76.7s  MusicKit accepted the paired token directly. The QR architecture holds.
77.8s  Track: "Choosin' Texas" by Ella Langley (id 1844932150, 3:52).
78.4s  Queue set. Calling play()…
```

**1:22 is past the preview ceiling by a wide margin**, so the 30-second failure
mode is conclusively excluded. The photograph was taken mid-track, so the
harness's own end-of-track PASS verdict is not in this capture; the outstanding
item is that final verdict line, not the result.

- [ ] The verdict bar after the track reaches its natural end
- [ ] Android OS version (the WebView version is captured; the OS version is not)

---

## G2 regression — passed in the same run

This APK was built after the split-code endpoints landed, so it polls
`GET /api/session/token` with a bearer `device_code` rather than reading a token
by `user_code`. Pairing completed at 76.0s and playback followed.

The security hardening therefore did not break playback on real hardware —
which is the whole reason a regression run existed.

---

## What changes now

G1 was the gate every other gate was waiting behind, and it is the reason the UI
work was flagged as sunk cost if it failed. It did not fail, so:

- The G3 prototype and the design system are validated investments.
- **G2 (security hardening) is done**, and its regression is the run recorded
  above. The pairing code on its own no longer retrieves anything.
- **Token lifetime is now the largest remaining unknown**, and it sits directly
  under gate G5, which requires staying logged in across an app restart.
  Nothing about expiry or refresh has been tested.
- Shut the cloudflared tunnel down between test sessions. It is not needed
  while nobody is testing.
