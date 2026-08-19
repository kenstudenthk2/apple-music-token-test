# android/ — POC-B WebView host

A single-Activity Android app whose entire job is to load the POC-B harness
inside a real `android.webkit.WebView` on real TV hardware. It exists to answer
gate **G1** and nothing else.

| File | Owns |
|---|---|
| `app/src/main/java/tv/appletune/pocb/MainActivity.java` | The WebView and its settings — the only interesting file |
| `app/src/main/AndroidManifest.xml` | TV declarations: leanback launcher, no touchscreen required, banner |
| `app/build.gradle.kts` | SDK levels and the `POCB_URL` build input |
| `app/src/main/res/drawable/banner.xml` | Leanback launcher banner, vector so there are no binary assets |
| `../.github/workflows/pocb-apk.yml` | Cloud build. Produces the APK; nobody builds this locally |

## Rules

1. **No dependencies.** No AndroidX, no AppCompat, no Leanback library, nothing.
   The platform WebView is the thing under test; every library added here is one
   more candidate explanation for a failure.
2. **Do not add features.** This is not the product. If it starts growing a UI,
   it has stopped being a controlled test.
3. **The harness URL is a build input**, never a constant in source — the
   cloudflared hostname changes on every restart. Pass `-PpocbUrl=…`.
4. **HTTPS only.** `usesCleartextTraffic` is false and the workflow rejects a
   non-HTTPS URL. EME, and therefore Widevine, is blocked outside a secure
   context; an http build would fail the gate for the wrong reason.
5. **Never let a failure render as a black screen.** Load errors, HTTP errors,
   and a missing URL all draw readable text. A blank TV tells us nothing.

## The two settings that decide the gate

Both live in `MainActivity.configure()`:

- **`onPermissionRequest` granting `PROTECTED_MEDIA_ID`** — a WebView denies the
  Widevine media-drm permission unless the host app grants it. Chrome grants it
  for you; a WebView does not. Without it, EME key-session creation fails and
  the player falls back to the unprotected stream, which for Apple Music is the
  30-second preview. This is the single most likely cause of "works in TV
  Chrome, fails in our app".
- **`setMediaPlaybackRequiresUserGesture(false)`** — defaults to true. A D-pad
  remote cannot produce the gesture the WebView waits for, so playback would
  never start.

If POC-B fails, check that both are still present before concluding anything
about the device.

## Building

Nobody builds this locally. Run the **Build POC-B APK** workflow on GitHub,
paste the tunnel URL, and download `pocb-apk` from the run's Artifacts.

The APK is **debug-signed**, which sideloads onto Android TV fine. Release
signing is gate G7 work and is deliberately not done here.

## Diagnosing a failure

The app mirrors the harness's own console into logcat under the tag `POCB`, and
enables `setWebContentsDebuggingEnabled`, so `chrome://inspect` can attach to
the WebView from a laptop on the same network.

```
adb logcat -s POCB
```

It also logs which WebView implementation is in use (`WebView.getCurrentWebViewPackage`).
That version is a real variable across TV devices and belongs in the result.
