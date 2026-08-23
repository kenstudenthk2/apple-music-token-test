# The real Android host app — design

Audience: whoever implements or reviews this work (agent or human). Read this
before touching `android-app/` or the new GitHub Actions workflow.

## Why

Sub-project 2 of 3 toward "an installable app" (see
`docs/superpowers/specs/2026-08-23-nas-hosting-design.md`, sub-project 1,
already shipped — a permanent HTTPS URL now exists). `android/` is
deliberately a disposable G1 test harness (`android/CLAUDE.md`: "Do not add
features. If it starts growing a UI, it has stopped being a controlled
test.") and must not become the product. This is a new, separate app that
loads the real TV UI at the now-permanent URL.

Sub-project 3 (release signing, `docs/INSTALL.md`, the secret-scan script —
what gate G7 actually requires) follows once this is done.

## Decision record

| Question | Answer | Why |
|---|---|---|
| New folder or reuse `android/`? | New: `android-app/` | `android/CLAUDE.md` forbids growing features there; keeps the disposable test and the real product from tangling |
| Package name | `tv.appletune.player` | Distinct from `tv.appletune.pocb`, so both can be installed side by side if ever useful for comparison |
| App display name | AppleTune | Matches the brand already used throughout the live UI (nav bar, prototype title) |
| Is the URL hardcoded in source? | No — a GitHub Actions workflow-dispatch input, same as POC-B's `POCB_URL` | Repo is confirmed **public** (`gh repo view`); hardcoding the owner's real home domain into committed source would expose it in public git history permanently |
| Signing | Debug, for this sub-project | Debug-signed APKs sideload fine on Android TV (proven by POC-B); proper release signing is deliberately deferred to sub-project 3 (G7) |

## What gets built

| File | Basis | Change from the source it's based on |
|---|---|---|
| `android-app/app/src/main/java/tv/appletune/player/MainActivity.java` | Copy of `android/app/src/main/java/tv/appletune/pocb/MainActivity.java` | Package renamed `tv.appletune.pocb` → `tv.appletune.player`; `BuildConfig.POCB_URL` → `BuildConfig.APP_URL`; the "no URL compiled in" message updated to reference the new Gradle property name; log tag `POCB` → `APPLETUNE`. WebView configuration (Widevine grant, `setMediaPlaybackRequiresUserGesture(false)`, BACK bridge via `__onAndroidBack`, exit bridge, error display) is copied **unchanged** — it is already proven on real hardware (`docs/POCB_RESULT.md`, `docs/G4_RESULT.md`) and this design does not revisit it. |
| `android-app/app/build.gradle.kts` | Copy of `android/app/build.gradle.kts` | `namespace`/`applicationId` → `tv.appletune.player`; `POCB_URL` build config field → `APP_URL`; Gradle property read renamed `pocbUrl` → `appUrl`; app name string changed to "AppleTune" (see below) |
| `android-app/app/src/main/AndroidManifest.xml` | Copy of `android/app/src/main/AndroidManifest.xml` | No structural change — same touchscreen/leanback `not-required` declarations, same dual launcher intent-filters (phone + TV), same banner/icon reference |
| `android-app/app/src/main/res/values/strings.xml` | New (POC-B inlines nothing comparable — its label is implicit) | `app_name = "AppleTune"` |
| `android-app/app/src/main/res/drawable/banner.xml` | Copy of `android/app/src/main/res/drawable/banner.xml` | Unchanged — same near-black ground, same accent-red play-circle mark, already vector (no binary assets) |
| `android-app/build.gradle.kts` | Copy of `android/build.gradle.kts` | Unchanged content, new location |
| `android-app/settings.gradle.kts` | Copy of `android/settings.gradle.kts` | Project name updated to match the new module |
| `android-app/gradle.properties` | Copy of `android/gradle.properties` | Unchanged |
| `android-app/CLAUDE.md` | New | Folder menu + rules — the mirror image of `android/CLAUDE.md`'s "this is disposable," stating instead "this is the product; changes here should be deliberate" |
| `.github/workflows/appletune-apk.yml` | Copy of `.github/workflows/pocb-apk.yml` | `url` input description updated; URL validation's accepted-path check narrows to `*/tv/*` (POC-B's version also accepted `*/pocb/`, not relevant here); `working-directory: android` → `android-app`; Gradle property `-PpocbUrl` → `-PappUrl`; artifact name `pocb-apk` → `appletune-apk`; the BuildConfig/dex verification steps carry over unchanged in structure, checking for `APP_URL`/the new artifact path instead |
| Root `CLAUDE.md` | Modify | Add a menu row for `android-app/`, next to the existing `android/` row, so both are distinguishable at a glance |

## Explicit non-goals

- Does not touch `android/` (the POC-B harness stays exactly as it is).
- Does not implement release signing, `docs/INSTALL.md`, or
  `scripts/apk-secret-scan.sh` — sub-project 3.
- Does not change any WebView configuration logic — that is proven and
  out of scope for this design.
- Does not change `pairing-server.js`, `deploy/`, or anything from
  sub-project 1.

## Testing

Because this repo has no local Android SDK/Gradle toolchain available (same
constraint sub-project 1 hit with Docker — confirmed absent, not just
sandboxed), the build itself can only be verified by actually running the
new GitHub Actions workflow and inspecting its output, the same way POC-B's
own workflow is the only thing that has ever built it. The implementation
task should:

1. Get the code to compile logically (careful reading, matching the
   existing proven file line for line except the documented renames).
2. Actually dispatch `appletune-apk.yml` with a real (or the owner's real)
   URL and confirm the workflow's own verification steps pass (BuildConfig
   carries the host, the dex contains it, the artifact uploads) — the
   workflow already does this checking itself, inherited from POC-B's.
3. Sideloading and running on a real TV is the owner's own step, same as
   every other physical-device verification in this project.
