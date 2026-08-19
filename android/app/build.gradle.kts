plugins {
    id("com.android.application")
}

android {
    namespace = "tv.appletune.pocb"
    compileSdk = 34

    defaultConfig {
        applicationId = "tv.appletune.pocb"
        // Android 5.0. Android TV never shipped below this, and WebView is an
        // updatable system component from 5.0 onward, which is what we are
        // actually testing.
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        // The tunnel hostname changes every time cloudflared restarts, so the
        // URL is a build input rather than a constant in the source. The CI
        // workflow passes -PpocbUrl=... ; a local build without it produces an
        // APK that explains itself on screen instead of showing a blank page.
        buildConfigField(
            "String",
            "POCB_URL",
            "\"${project.findProperty("pocbUrl") ?: ""}\""
        )
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        // Debug only. A release build would need a keystore, and a debug-signed
        // APK sideloads onto Android TV perfectly well. Signing belongs to
        // gate G7, not to this test.
        getByName("debug") {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// No dependencies on purpose — no AndroidX, no AppCompat, no Leanback library.
// The only thing under test is the platform WebView, and every library added
// here is another variable that could explain a failure.
dependencies {
}
