# Android Host App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new, installable Android TV app ("AppleTune") that loads the real live TV UI at the project's now-permanent NAS-hosted URL, built via a GitHub Actions workflow that never exposes that URL in a public log.

**Architecture:** A new top-level `android-app/` Gradle project (parallel to, never touching, the disposable `android/` POC-B test harness), reusing POC-B's already-proven `MainActivity.java` WebView configuration unchanged except for naming. The permanent URL is injected at build time from a GitHub repository secret (`APP_URL`) via an environment variable, never a workflow input, never committed to source.

**Tech Stack:** Android (Java, no dependencies — no AndroidX, no AppCompat, no Leanback library), Gradle 8.7 / AGP 8.5.2, GitHub Actions.

## Global Constraints

- Zero dependencies in the Android module: no AndroidX, no AppCompat, no Leanback library — matches `android/`'s own rule, and the only thing meant to matter here is the platform WebView.
- The permanent URL never enters git history, never enters a workflow **input** (those are echoed into public logs on this public repo) — only a GitHub repository secret, read via `System.getenv("APP_URL")` at build time.
- No agent session types, prints, or otherwise handles the owner's real URL value — the owner sets the `APP_URL` secret themselves.
- `android/` (the POC-B harness) is never modified by this plan.
- Debug signing only — release signing, `docs/INSTALL.md`, and the secret-scan script are explicitly out of scope (a later sub-project, gate G7).
- Every new folder gets a `CLAUDE.md` menu in the same task that creates it; every new file gets a row in its folder's menu in the same task that creates it.

---

### Task 1: Gradle project scaffolding

**Files:**
- Create: `android-app/settings.gradle.kts`
- Create: `android-app/build.gradle.kts`
- Create: `android-app/gradle.properties`

**Interfaces:**
- Produces: a Gradle project named `appletune` with one module, `:app` (created in Task 2), using AGP `8.5.2`, Google + Maven Central repositories.

- [ ] **Step 1: Create `android-app/settings.gradle.kts`**

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "appletune"
include(":app")
```

- [ ] **Step 2: Create `android-app/build.gradle.kts`**

```kotlin
// Root build file. Deliberately almost empty: this module has no shared
// configuration to hoist, and every plugin version is pinned in app/.
plugins {
    id("com.android.application") version "8.5.2" apply false
}
```

- [ ] **Step 3: Create `android-app/gradle.properties`**

```
org.gradle.jvmargs=-Xmx2048m
android.useAndroidX=true
android.nonTransitiveRClass=true
```

- [ ] **Step 4: Verify**

Run: `test -f android-app/settings.gradle.kts && test -f android-app/build.gradle.kts && test -f android-app/gradle.properties && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add android-app/settings.gradle.kts android-app/build.gradle.kts android-app/gradle.properties
git commit -m "Scaffold the android-app/ Gradle project

Root-level project files only — no app module yet. Parallel to android/
(the disposable POC-B test harness), never touching it. Named 'appletune'
rather than reusing android/'s 'appletune-pocb' root project name."
```

---

### Task 2: App module Gradle config and app name

**Files:**
- Create: `android-app/app/build.gradle.kts`
- Create: `android-app/app/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: nothing from Task 1 directly (sibling files), but must exist for the `:app` module Task 1's `settings.gradle.kts` already declares.
- Produces: a `BuildConfig.APP_URL` string field, sourced from the `APP_URL` environment variable at build time (empty string if unset — Task 4's `MainActivity` handles that case, matching POC-B's own "no URL compiled in" fallback). `@string/app_name` = `"AppleTune"`, consumed by Task 3's manifest.

- [ ] **Step 1: Create `android-app/app/build.gradle.kts`**

```kotlin
plugins {
    id("com.android.application")
}

android {
    namespace = "tv.appletune.player"
    compileSdk = 34

    defaultConfig {
        applicationId = "tv.appletune.player"
        // Android 5.0. Android TV never shipped below this, and WebView is an
        // updatable system component from 5.0 onward, which is what actually
        // matters for playback.
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        // Unlike POC-B's per-session tunnel URL (a Gradle -P property, fed by
        // a workflow_dispatch input), this URL is permanent. A dispatch input
        // is echoed into the run's log, which is public on this public repo —
        // so the URL comes from the APP_URL repository secret via an
        // environment variable instead. GitHub Actions masks a secret's
        // literal value in all step output automatically, wherever it
        // appears — see docs/superpowers/specs/2026-08-23-android-app-design.md.
        buildConfigField(
            "String",
            "APP_URL",
            "\"${System.getenv("APP_URL") ?: ""}\""
        )
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        // Debug only. A release build would need a keystore; signing belongs
        // to a later sub-project (gate G7), not to this one.
        getByName("debug") {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// No dependencies on purpose — no AndroidX, no AppCompat, no Leanback
// library. Matches android/'s own rule: the platform WebView is the only
// thing that should matter here.
dependencies {
}
```

- [ ] **Step 2: Create `android-app/app/src/main/res/values/strings.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">AppleTune</string>
</resources>
```

- [ ] **Step 3: Verify**

Run: `grep -q 'tv.appletune.player' android-app/app/build.gradle.kts && grep -q 'AppleTune' android-app/app/src/main/res/values/strings.xml && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add android-app/app/build.gradle.kts android-app/app/src/main/res/values/strings.xml
git commit -m "Add the app module's Gradle config, sourcing APP_URL from the environment

BuildConfig.APP_URL reads System.getenv(\"APP_URL\") rather than a Gradle
-P property, because the CI workflow (a later task) injects it from a
repository secret, not a workflow_dispatch input — the input pattern
POC-B uses is fine for a short-lived tunnel URL, but would permanently
leak this app's real, permanent URL into a public build log."
```

---

### Task 3: Manifest and TV launcher banner

**Files:**
- Create: `android-app/app/src/main/AndroidManifest.xml`
- Create: `android-app/app/src/main/res/drawable/banner.xml`

**Interfaces:**
- Consumes: `@string/app_name` (Task 2), `.MainActivity` (Task 4 — the manifest references it before it exists, which is fine; Gradle only needs the Java file present by the time compilation actually runs, not by this task's commit).
- Produces: a manifest declaring the TV leanback launcher entry point, no touchscreen requirement, and the app's icon/banner.

- [ ] **Step 1: Create `android-app/app/src/main/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <!--
      Android TV declarations.

      A TV device has no touchscreen, so touchscreen must be declared
      not-required or the app is filtered out. Leanback is what puts the app on
      the TV home row; it is marked not-required so the same APK still installs
      on a phone or tablet for comparison testing.
    -->
    <uses-feature
        android:name="android.hardware.touchscreen"
        android:required="false" />
    <uses-feature
        android:name="android.software.leanback"
        android:required="false" />

    <application
        android:allowBackup="false"
        android:banner="@drawable/banner"
        android:icon="@drawable/banner"
        android:label="@string/app_name"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="false"
        android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="landscape"
            android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|smallestScreenSize|uiMode">

            <!-- Phone/tablet launcher, so the same APK can be A/B tested. -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Android TV home screen. -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
```

- [ ] **Step 2: Create `android-app/app/src/main/res/drawable/banner.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<!--
  Android TV requires a banner for the leanback launcher. Drawn as a vector so
  the module stays free of binary assets: a play triangle on the app's own
  near-black ground, in the same accent used by the live app.
-->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="320dp"
    android:height="180dp"
    android:viewportWidth="320"
    android:viewportHeight="180">

    <path
        android:fillColor="#0B0B10"
        android:pathData="M0,0 h320 v180 h-320 z" />

    <path
        android:fillColor="#FA2D48"
        android:pathData="M160,90 m-46,0 a46,46 0 1,0 92,0 a46,46 0 1,0 -92,0 z" />

    <path
        android:fillColor="#0B0B10"
        android:pathData="M147,68 L191,90 L147,112 z" />
</vector>
```

- [ ] **Step 3: Verify**

Run: `grep -q 'LEANBACK_LAUNCHER' android-app/app/src/main/AndroidManifest.xml && grep -q '320' android-app/app/src/main/res/drawable/banner.xml && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add android-app/app/src/main/AndroidManifest.xml android-app/app/src/main/res/drawable/banner.xml
git commit -m "Add the manifest and TV launcher banner

Identical in structure to android/'s POC-B manifest and banner — same
touchscreen/leanback not-required declarations, same dual launcher
intent-filters, same vector banner style. No behavioral changes, just a
new home for the real product."
```

---

### Task 4: MainActivity — the WebView host

**Files:**
- Create: `android-app/app/src/main/java/tv/appletune/player/MainActivity.java`

**Interfaces:**
- Consumes: `BuildConfig.APP_URL` (Task 2).
- Produces: nothing anything else in this plan depends on — this is the leaf of the dependency chain, verified only by the CI build in Task 7.

- [ ] **Step 1: Create `android-app/app/src/main/java/tv/appletune/player/MainActivity.java`**

This is `android/app/src/main/java/tv/appletune/pocb/MainActivity.java` with exactly these changes and nothing else: package `tv.appletune.pocb` → `tv.appletune.player`; log tag `"POCB"` → `"APPLETUNE"`; `BuildConfig.POCB_URL` → `BuildConfig.APP_URL`; the "no URL compiled in" message rewritten to describe the `APP_URL` secret instead of a Gradle `-P` flag. The WebView configuration itself (Widevine permission grant, `setMediaPlaybackRequiresUserGesture(false)`, the `__onAndroidBack` bridge, the `AndroidHost.exit()` bridge, error display) is copied **verbatim** — do not modify any of `configure()`, `onBackPressed()`, or the `Host` inner class. It is already proven correct on real hardware (`docs/POCB_RESULT.md`, `docs/G4_RESULT.md`) and revisiting it is out of scope for this task.

```java
package tv.appletune.player;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * AppleTune host — a single WebView, pointed at the permanent NAS-hosted TV
 * app. Configuration copied verbatim from the POC-B test harness
 * (android/app/src/main/java/tv/appletune/pocb/MainActivity.java), which
 * proved these exact settings correct on real Android TV hardware.
 *
 * The interesting part of this file is {@link #configure(WebView)}. Everything
 * else is plumbing so that failures are visible on a television instead of
 * being a black screen.
 */
public class MainActivity extends Activity {

    private static final String TAG = "APPLETUNE";

    private WebView web;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0B0B10"));

        status = new TextView(this);
        status.setTextColor(Color.parseColor("#F5F6F8"));
        status.setBackgroundColor(Color.parseColor("#14141B"));
        status.setTextSize(22f);
        status.setPadding(48, 48, 48, 48);
        status.setGravity(Gravity.CENTER);
        status.setVisibility(View.GONE);

        web = new WebView(this);
        configure(web);

        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(status, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        String url = BuildConfig.APP_URL;
        if (url == null || url.trim().isEmpty()) {
            showMessage(
                    "No URL was compiled into this APK.\n\n" +
                    "Set the APP_URL repository secret (Settings > Secrets and " +
                    "variables > Actions) and re-run the \"Build AppleTune APK\" " +
                    "workflow on GitHub.");
            return;
        }

        Log.i(TAG, "WebView package: " + webViewPackage());
        Log.i(TAG, "Loading " + url);
        web.loadUrl(url);
    }

    /**
     * The part that actually matters.
     *
     * Two settings here are the usual reason a page that plays in TV Chrome
     * shows a blank player or a 30-second preview inside a WebView:
     *
     *   onPermissionRequest / PROTECTED_MEDIA_ID
     *       A WebView denies the Widevine media-drm permission unless the host
     *       app grants it. Chrome grants it for you; a WebView does not. Without
     *       the grant below, EME key-session creation fails and the player
     *       silently falls back to whatever unprotected stream exists — which,
     *       for Apple Music, is the 30-second preview.
     *
     *   setMediaPlaybackRequiresUserGesture(false)
     *       Defaults to true. A D-pad remote cannot produce the touch gesture
     *       the WebView is waiting for, so playback would never start at all.
     */
    private void configure(WebView view) {
        WebSettings settings = view.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        // The app is served over HTTPS and must stay that way: EME is
        // blocked outside a secure context.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // Lets `adb shell` + chrome://inspect attach to this WebView, which is
        // how a DRM failure gets diagnosed if the on-screen log is not enough.
        WebView.setWebContentsDebuggingEnabled(true);

        // Only our own pages are ever loaded, and the bridge exposes exactly one
        // argument-free method, so the surface is a single "close the app".
        view.addJavascriptInterface(new Host(), "AndroidHost");

        view.setBackgroundColor(Color.parseColor("#0B0B10"));

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Grant PROTECTED_MEDIA_ID. See the note above — this single
                // call is the difference between full playback and a preview.
                Log.i(TAG, "Granting WebView permissions: " + join(request.getResources()));
                request.grant(request.getResources());
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                // Mirror the app's log into logcat so the evidence survives
                // even if the screen is photographed badly.
                Log.i(TAG, "console[" + message.messageLevel() + "] " + message.message()
                        + " (" + message.sourceId() + ":" + message.lineNumber() + ")");
                return true;
            }
        });

        view.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    fail("Could not load the app.\n\n"
                            + error.getDescription() + " (code " + error.getErrorCode() + ")\n\n"
                            + request.getUrl());
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    fail("The server returned HTTP " + response.getStatusCode() + ".\n\n"
                            + request.getUrl() + "\n\n"
                            + "Is the NAS deployment still running?");
                }
            }
        });
    }

    /**
     * The one thing the page cannot do for itself: leave.
     *
     * A web page cannot finish an Activity, so without this the app's own
     * "exit" could only ever draw a screen that claimed to have exited. Kept to
     * a single method that takes no arguments and returns nothing, because a
     * JavaScript bridge is reachable by any page the WebView loads.
     */
    private class Host {
        @android.webkit.JavascriptInterface
        public void exit() {
            runOnUiThread(MainActivity.this::finish);
        }
    }

    /** Report which WebView implementation is actually in use — it is a variable. */
    private String webViewPackage() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.content.pm.PackageInfo info = WebView.getCurrentWebViewPackage();
            if (info != null) {
                return info.packageName + " " + info.versionName;
            }
        }
        return "unknown (API " + Build.VERSION.SDK_INT + ")";
    }

    private static String join(String[] values) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.length; i += 1) {
            if (i > 0) builder.append(", ");
            builder.append(values[i]);
        }
        return builder.length() == 0 ? "(none)" : builder.toString();
    }

    private void fail(String message) {
        Log.e(TAG, message.replace('\n', ' '));
        showMessage(message);
    }

    /** A WebView that fails to load renders as pure black. Never let that happen. */
    private void showMessage(String message) {
        status.setText(message);
        status.setVisibility(View.VISIBLE);
        web.setVisibility(View.GONE);
    }

    /**
     * Give the page first refusal on BACK.
     *
     * A hardware BACK press does not produce a DOM keydown — Android routes it
     * straight here. So every back handler the web app registers is invisible
     * to the remote, and the naive version of this method would go directly to
     * WebView history: from Now Playing, BACK would leave the app's own screen
     * stack entirely and reload the previous page.
     *
     * The page answers synchronously via __onAndroidBack; only if it declines
     * do we fall back to history, and then to leaving the app.
     */
    @Override
    public void onBackPressed() {
        if (web == null || web.getVisibility() != View.VISIBLE) {
            super.onBackPressed();
            return;
        }

        web.evaluateJavascript(
                "(function(){try{return !!(window.__onAndroidBack && window.__onAndroidBack())}"
                        + "catch(e){return false}})()",
                value -> {
                    if ("true".equals(value)) {
                        return; // The page consumed it.
                    }
                    if (web.canGoBack()) {
                        web.goBack();
                    } else {
                        finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }
}
```

- [ ] **Step 2: Verify**

Run: `grep -q 'package tv.appletune.player' android-app/app/src/main/java/tv/appletune/player/MainActivity.java && grep -q 'BuildConfig.APP_URL' android-app/app/src/main/java/tv/appletune/player/MainActivity.java && echo OK`
Expected: `OK`

This cannot be compiled locally (no Android SDK/Gradle toolchain available in this environment — confirmed absent, not merely sandboxed, the same constraint the NAS hosting sub-project hit with Docker). Task 7 is where this actually gets built, via the real GitHub Actions workflow.

- [ ] **Step 3: Commit**

```bash
git add android-app/app/src/main/java/tv/appletune/player/MainActivity.java
git commit -m "Add MainActivity, the WebView host — config copied verbatim from POC-B

Package renamed, log tag renamed, BuildConfig field renamed, the
no-URL-compiled-in message updated to describe the APP_URL secret. The
WebView configuration itself — Widevine permission grant, no-gesture
playback, the __onAndroidBack bridge, the exit bridge, error display —
is unchanged from android/app/.../pocb/MainActivity.java, which proved
these exact settings correct on real hardware (docs/POCB_RESULT.md,
docs/G4_RESULT.md). Not verified by a local build — no Android
toolchain in this environment; Task 7 builds it for real via CI."
```

---

### Task 5: Folder menus

**Files:**
- Create: `android-app/CLAUDE.md`
- Modify: `CLAUDE.md` (root menu table)

**Interfaces:**
- Produces: nothing code-facing — pure documentation, following this repo's own menu-discipline rule.

- [ ] **Step 1: Create `android-app/CLAUDE.md`**

```markdown
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
```

- [ ] **Step 2: Add a row to the root `CLAUDE.md`'s menu table**

Add a row directly after the existing `android/` row:

```markdown
| [`android-app/`](android-app/CLAUDE.md) | The real AppleTune host app | You are changing the installable app itself — not the disposable G1 test harness |
```

- [ ] **Step 3: Verify**

Run: `test -f android-app/CLAUDE.md && grep -q 'android-app/' CLAUDE.md && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add android-app/CLAUDE.md CLAUDE.md
git commit -m "Add android-app/'s folder menu and register it at the root

Mirrors android/CLAUDE.md's structure but states the opposite intent:
this folder is the product, not a disposable test."
```

---

### Task 6: The CI build workflow

**Files:**
- Create: `.github/workflows/appletune-apk.yml`

**Interfaces:**
- Consumes: the `APP_URL` repository secret (must already be set by the owner — Task 7's first step).
- Produces: a GitHub Actions artifact named `appletune-apk` containing `app-debug.apk`.

- [ ] **Step 1: Create `.github/workflows/appletune-apk.yml`**

```yaml
name: Build AppleTune APK

# Unlike POC-B's workflow, this takes no dispatch input — the URL is
# permanent, so it lives in the APP_URL repository secret instead. A
# workflow_dispatch input would be echoed into this run's public log
# (this repo is public); a secret is masked in all output automatically.
# Set it once: gh secret set APP_URL, or Settings > Secrets and variables
# > Actions in the GitHub UI.
on:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      APP_URL: ${{ secrets.APP_URL }}

    steps:
      - name: Check out
        uses: actions/checkout@v4

      - name: Reject a URL that cannot work
        run: |
          if [ -z "$APP_URL" ]; then
            echo "::error::APP_URL repository secret is not set. Settings > Secrets and variables > Actions > New repository secret."
            exit 1
          fi
          # HTTPS is not a style preference here: EME, and therefore Widevine,
          # is blocked outside a secure context, so an http:// build would fail
          # for a reason that has nothing to do with the app itself.
          case "$APP_URL" in
            https://*) ;;
            *) echo "::error::APP_URL must start with https:// — EME is blocked outside a secure context."; exit 1 ;;
          esac
          case "$APP_URL" in
            */tv/*) ;;
            *) echo "::error::APP_URL should point at .../tv/..."; exit 1 ;;
          esac
          echo "APP_URL passed validation (value not printed — see secret masking)."

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"

      - name: Set up Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: "8.7"

      - name: Build debug APK
        working-directory: android-app
        run: gradle assembleDebug --no-daemon --stacktrace

      - name: Confirm the URL was compiled in
        working-directory: android-app
        run: |
          set -u
          APK=app/build/outputs/apk/debug/app-debug.apk
          HOST=$(echo "$APP_URL" | sed -E 's#https?://([^/]+).*#\1#')

          echo "== APK contents =="
          ls -lh "$APK"
          unzip -l "$APK"

          # Two independent checks, same shape as POC-B's. The generated
          # source is direct evidence the environment variable arrived; the
          # dex scan proves it survived into the package. Neither check ever
          # prints $APP_URL itself — only $HOST, and GitHub Actions masks
          # any occurrence of the full secret value regardless, but the host
          # alone is not the full URL and is not masked, which is fine: it is
          # not sensitive on its own once DNS for it is already public.
          if ! find app/build/generated -name BuildConfig.java -exec grep -q "$HOST" {} +; then
            echo "::error::APP_URL did not reach the generated BuildConfig — the secret may be empty or malformed."
            exit 1
          fi
          echo "OK — BuildConfig carries the configured host"

          if ! unzip -l "$APK" | grep -q 'classes.*\.dex'; then
            echo "::error::The APK contains no dex file — the app sources were not compiled in."
            exit 1
          fi

          if unzip -p "$APK" 'classes*.dex' | grep -qa "$HOST"; then
            echo "OK — the configured host is present in the packaged dex."
          else
            echo "::error::The configured host is not in the packaged dex. The app would show the 'no URL' screen."
            exit 1
          fi

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: appletune-apk
          path: android-app/app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
          retention-days: 7
```

- [ ] **Step 2: Verify**

Run: `grep -q 'secrets.APP_URL' .github/workflows/appletune-apk.yml && ! grep -q 'inputs.url' .github/workflows/appletune-apk.yml && echo OK`
Expected: `OK` (confirms the secret is used and no dispatch input exists)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/appletune-apk.yml
git commit -m "Add the AppleTune APK build workflow

Modeled on .github/workflows/pocb-apk.yml, with the one deliberate
difference: no workflow_dispatch input. The URL comes from the APP_URL
repository secret via env:, since this repo is public and an input
would be echoed into the run's permanent public log — fine for POC-B's
short-lived tunnel URL, not fine for this app's permanent one."
```

---

### Task 7: Set the secret and build a real APK

**Files:** none — this task sets a repository secret and dispatches/verifies a workflow run.

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: a downloaded `appletune-apk` artifact (`app-debug.apk`), confirmed by the workflow's own verification steps to carry the configured URL.

This task has one step that is the owner's alone (setting the secret — no agent session should see or type the real URL), and the rest can be executed by an agent with `gh` access, since dispatching and inspecting a public repo's own Actions runs needs no special hardware, unlike the NAS deployment's Task 6.

- [ ] **Step 1: Owner sets the repository secret**

Ask the owner to run this themselves (or set it via the GitHub UI:
Settings > Secrets and variables > Actions > New repository secret,
name `APP_URL`, value `https://pairing.<their-domain>/tv/`):

```bash
gh secret set APP_URL
```
(this prompts for the value interactively — it is never typed into a
chat message, a file, or a command an agent session runs)

Confirm it's set without ever reading the value:
```bash
gh secret list
```
Expected: `APP_URL` appears in the list (value itself is never shown by this command).

- [ ] **Step 2: Dispatch the build**

```bash
gh workflow run "Build AppleTune APK"
```

- [ ] **Step 3: Wait for and inspect the run**

```bash
gh run list --workflow "Build AppleTune APK" --limit 1
gh run watch <run-id-from-above> --exit-status
```

Expected: the run completes successfully. If it fails, `gh run view <run-id> --log-failed` shows which step failed — most likely either "Reject a URL that cannot work" (secret not set, or malformed) or "Confirm the URL was compiled in" (something about the Gradle build didn't pick up the environment variable — re-check Task 2's `System.getenv("APP_URL")` wiring).

- [ ] **Step 4: Download and hand off the artifact**

```bash
gh run download <run-id> -n appletune-apk
```

This produces `app-debug.apk` locally. Sideloading it onto the actual TV
and confirming it runs is the owner's own step from here — same as every
other physical-device verification in this project (`docs/POCB_RESULT.md`,
`docs/G4_RESULT.md`).

- [ ] **Step 5: Record the result and commit if anything changed**

If the build succeeded, no code changes are needed — this task only
produces evidence, not files. Report the outcome (run URL, artifact
downloaded) to the owner directly; no commit for this task unless a
prior task's file needed a follow-up fix, in which case that fix gets
its own task, not folded in here.
