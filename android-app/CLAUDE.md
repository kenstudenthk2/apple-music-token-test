# android-app/ — The real AppleTune host app

Unlike `android/` (a disposable G1 test harness — see its own `CLAUDE.md`),
this **is** the product. A single-Activity WebView host, pointed at the
permanent NAS-hosted TV app, meant to be installed and kept.

| File | Owns | Load it when |
|---|---|---|
| `app/src/main/java/tv/appletune/player/MainActivity.java` | The WebView and its settings — copied verbatim from POC-B's proven configuration, see the file's own header comment | You are changing how the app hosts the WebView |
| `app/src/main/AndroidManifest.xml` | TV declarations: leanback launcher, no touchscreen required, banner | Rarely — matches POC-B's manifest structure exactly |
| `app/build.gradle.kts` | SDK levels, `APP_URL` build config field (read from the environment, not a Gradle property — see below) | Changing the app's identity (package name, version) or how the URL is injected |
| `app/src/main/res/drawable/banner.xml` | Leanback launcher banner, vector so there are no binary assets | Changing the app's visual identity |
| `../.github/workflows/appletune-apk.yml` | Cloud build. Produces the APK; nobody builds this locally | You are changing the build/CI process |

## Rules

1. **No dependencies.** No AndroidX, no AppCompat, no Leanback library —
   matches `android/`'s own rule.
2. **The permanent URL is never a workflow input.** It lives only in the
   `APP_URL` GitHub repository secret, read via `System.getenv("APP_URL")`
   at build time. This repo is public; a `workflow_dispatch` input is
   echoed into the run's public log, which would permanently expose a URL
   that (unlike POC-B's short-lived tunnel) never changes. No agent
   session should type, print, or otherwise handle the real URL value —
   the owner sets the secret themselves.
3. **Never touch `android/`.** It is a separate, disposable test harness
   with its own rules; this folder existing does not change that.
4. **Debug signing only, for now.** Release signing, `docs/INSTALL.md`,
   and the secret-scan script are a separate, later sub-project (gate
   G7) — not yet done.

## Building

Nobody builds this locally (no Android SDK/Gradle toolchain assumed
present). Run the **Build AppleTune APK** workflow on GitHub Actions and
download `appletune-apk` from the run's Artifacts. The workflow reads the
`APP_URL` secret itself — set it once via `gh secret set APP_URL` or the
GitHub UI (Settings > Secrets and variables > Actions) before the first run.

The APK is **debug-signed**, which sideloads onto Android TV fine.
