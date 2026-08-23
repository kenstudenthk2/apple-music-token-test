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
