# AppleTune TV — TV UX Research & Reference Report

Research date: 2026-08-19
Scope: Android TV / Google TV app for Apple Music, QR-code phone login, 10-foot UI.
Author: UX Researcher agent

> **Evidence policy for this document.** Every factual claim carries a URL. Claims I could
> not verify from a primary source are marked **[UNVERIFIED]** with a note on what would
> confirm them. Design concepts in section 3 are proposals, not findings — they are labelled
> as such.

---

## 1. Executive Summary — five things a designer can act on today

1. **You do not need to extract colours from album art — Apple already gives them to you.**
   The Apple Music API `Artwork` object ships `bgColor` and `textColor1`–`textColor4` as hex
   strings alongside a `url` containing `{w}x{h}` placeholders you substitute at request time.
   That is a designer-grade, per-album palette for free, with zero canvas work, zero CORS
   pain, and zero main-thread cost. Build the whole ambient Now-Playing treatment on those
   five tokens.
   (https://developer.apple.com/documentation/applemusicapi/artwork — field list corroborated by
   https://pkg.go.dev/github.com/minchao/go-apple-music and https://nicholasgriffin.dev/blog/building-a-recently-played-widget-with-apple-music)

2. **Kill the audio-reactive visualizer idea early.** Apple Music playback is DRM-protected
   (EME on web, `MPMusicPlayerController` on native); raw PCM is not exposed, so a Web Audio
   `AnalyserNode` gets nothing. Any "reactive" motion must be *fake* — driven by BPM, track
   position, or a free-running clock. Decide this before a designer draws a spectrum bar.
   (https://developer.apple.com/forums/thread/85739, https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)

3. **Time-synced lyrics are not available through the public API.** `Song` exposes `hasLyrics`
   but no documented endpoint returns the lyric text, let alone timings; the only known routes
   are private endpoints that Apple states may be blocked at any time. Design the Now-Playing
   screen so lyrics are an *optional slot that can stay empty forever*, not a hero feature.
   (https://developer.apple.com/forums/thread/698127, https://github.com/rryam/MusanovaKit)

4. **Focus must change at least two properties, never colour alone.** Google's TV focus system
   specifies scale factors of **1.025x / 1.05x / 1.1x**, glow elevation **2–32dp**, and requires
   adjusting at least one of scale, border, glow, or colour — with three mandatory states
   (default / focused / pressed). Colour-only focus fails colour-blind users and is invisible
   from 3 m. Bake scale + glow into the component library on day one.
   (https://developer.android.com/design/ui/tv/guides/styles/focus-system)

5. **Now-Playing is a burn-in surface, not a poster.** Music plays for hours with nobody
   touching the remote, so a static centred square is the single worst thing you can ship on
   an OLED. Plexamp explicitly moves elements around on its Now-Playing screen to avoid burn-in,
   and Jellyfin routes idle music playback into a screensaver. Budget an idle/ambient mode from
   the start — it is a requirement, not a delighter.
   (https://forums.plex.tv/t/chromecast-with-google-tv-music-now-playing-screen-ambient-mode/646715,
   https://jellyfin.org/posts/androidtv-v0.19.0/, https://www.tomsguide.com/tvs/oled-tvs-burn-in-from-these-common-mistakes-prevent-it-with-3-settings)

---

## 2. Per-app teardown

| App | Navigation model | Now-Playing treatment | One thing worth stealing |
|---|---|---|---|
| **Apple Music on tvOS** | Focus engine with parallax: focused cards tilt in response to the remote's touch surface, up to five visual focus states, layered LSR assets animated by the system. Min recommended card target 250×150pt. | Album art with track list beside it; **animated (motion) artwork plays on the initial album view, then stops when the layout collapses to centred art**. Reduce Motion in Accessibility disables it. | The *layered* focus idea: depth + motion, not a border. Also: motion artwork as an intro moment rather than a permanent loop — cheap, and dodges burn-in. (https://developers.apple.com/design/human-interface-guidelines/inputs/focus-and-selection, https://discussions.apple.com/thread/255113940, https://talk.tidbits.com/t/preventing-animated-cover-art-on-apple-tv/31973) |
| **Spotify on Android TV / Google TV** | 2023 redesign: **left sidebar** for Home / Your Library / Account, background imagery behind content rows. | Redesigned Now-Playing; users report the **initial focus lands on Play rather than the scrub bar**, making rewind awkward, and complain the newer layout is less readable. | Steal the left-sidebar shell (D-pad-friendly: vertical = category, horizontal = items). **Avoid** their mistake — set initial focus on the control the user most likely wants, and keep the scrub bar reachable in one press. (https://www.flatpanelshd.com/news.php?subaction=showfull&id=1699595432, https://community.spotify.com/t5/Android/Android-app-now-playing-new-layout/td-p/7056766) |
| **YouTube / YouTube Music on Android TV** | Standard rows; a **"Display" button** on the playback screen toggles between **Artwork / Lyrics / Video**. | Three interchangeable full-screen modes; Lyrics shows live synced lyrics beside album art; Artwork mode turns the TV into an ambient music player with the video switched off. | **The Display toggle is the single best pattern in this whole report.** One button, three Now-Playing personalities, no menu depth. Copy the affordance verbatim. (https://www.androidcentral.com/apps-software/android-tv/youtube-on-android-tv-spices-up-music-videos-with-on-screen-lyrics-and-album-art, https://www.androidpolice.com/youtube-android-tv-display-setting-rollout/) |
| **YouTube "Ambient Mode" (web/mobile)** | n/a — a rendering mode, not navigation. | Colours from the media **spill out and blend into the surrounding UI** as a soft glow instead of black bars. | The exact visual grammar for our adaptive background — and Apple's `bgColor` gives us the input for free. (https://www.popsci.com/diy/youtube-ambient-mode-off-on/) |
| **Plexamp / Plex on TV** | Plexamp is primarily a phone/desktop player; a Chromecast-with-Google-TV Now-Playing/ambient screen is a long-running community request. | **"UltraBlur"** — album art is blurred and recoloured to give every artist/album page its own look. **12+ visualizers**, four visual themes. Now-Playing shows art, artist, album, track, and *what's next*, and **deliberately moves elements around to avoid burn-in**. | Two things: UltraBlur as the background recipe, and *"up next" on the Now-Playing screen* — it removes a whole navigation trip. (https://www.plex.tv/plexamp/, https://forums.plex.tv/t/chromecast-with-google-tv-music-now-playing-screen-ambient-mode/646715) |
| **Jellyfin for Android TV** | Leanback-style browse; 0.19 added voice search and an inactivity popup. | 0.16+ **added music playback to the screensaver, replacing the old Now-Playing screensaver**; 0.18/0.19 added seek/FF/RW, queue management, and media sessions so phones and other apps can control playback. | The **idle → screensaver handoff for music**, and **media session registration** (lets the Google TV system UI and a phone control playback). Both are unglamorous and both are table stakes. (https://jellyfin.org/posts/androidtv-v0.16.0/, https://jellyfin.org/posts/androidtv-v0.19.0/) |
| **Radon Tunes (`com.brkchen.music`)** — closest direct competitor | Third-party Apple Music client for Android TV. Surfaces Apple Music's curated shelves: **Listen Now / For You, New Music, Top Charts**. Requires an active Apple Music subscription. | TV-optimised playback UI with **standard transport only**: play/pause, next/prev, shuffle, repeat. No evidence of ambient, lyrics, or visualizer modes. | Its **shelf taxonomy** (mirror Apple's own sections rather than inventing your own IA). Its **gap is your opportunity**: the Now-Playing screen is plain transport controls — that is exactly the surface AppleTune TV should out-design. (https://play.google.com/store/apps/details?id=com.brkchen.music, https://apkpure.com/radon-tunes-for-apple-music/com.brkchen.music, https://www.amazon.com/Radon-Tunes-for-Apple-Music/dp/B0FPRHB215) |
| **Radon Tunes — QR login specifically** | Users report the flow as: **scan QR → a sign-in webpage opens on the phone → sign in to Apple Music**, and that on iPhone you must **disable Safari's pop-up blocker first**, or the auth window never opens. | — | The **warning, not the pattern**: MusicKit's authorize flow opens a popup, and mobile Safari's popup blocker silently kills it. Our QR landing page must either avoid a popup entirely (same-tab redirect) or show an explicit "if nothing happened, enable pop-ups" recovery state. This is the #1 predictable support ticket. (https://radon-tunes.en.softonic.com/android, https://apkpure.com/radon-tunes-for-apple-music/com.brkchen.music) **[PARTLY UNVERIFIED]** — sourced from store listings and third-party mirrors, not from the developer. Confirm by installing the app. |
| **Tidal on Android TV** | — | — | **[UNVERIFIED]** I could not find a reliable description of Tidal's Android TV Now-Playing UI. Treat as an open research item; do not cite Tidal in design rationale until someone has hands-on. |

---

## 3. Now-Playing concept catalogue

These are **design proposals**, informed by the prior art above. Difficulty is for plain
HTML/CSS/JS in a WebView (or the equivalent Compose-for-TV effort), on TV-class hardware —
which is roughly a low-end phone from five years ago, so GPU budget is the binding constraint.

**Shared foundation for all of them:** `artwork.bgColor` + `textColor1..4` from the Apple Music
API, plus `artwork.url` requested at two sizes (a large one for the hero, a tiny one you can
upscale for cheap blur backdrops).

### C1 — Adaptive Ambient Wash (the default)
Full-bleed background built purely from Apple's `bgColor`, with a large soft radial gradient
tinted by `textColor2`/`textColor3` drifting slowly behind the art. Text uses `textColor1`.
Album art sits off-centre with a long soft shadow in a darkened `bgColor`.
**Why it works on TV:** black bars look broken on a 65" panel; a wall of colour reads as
intentional from 3 m. Contrast is largely guaranteed because Apple derived the text colours
*against* that background. Zero image processing.
**Difficulty: Low.** Two divs, a CSS custom property per colour, one `@keyframes` on `transform`.

### C2 — UltraBlur Backdrop
Album art requested at ~40×40, scaled to fill the screen with `filter: blur(80px) saturate(1.4)`
plus a dark scrim, art crisp on top. Plexamp's signature look.
**Why it works on TV:** every album gets a bespoke background with no art direction; the blur
hides compression artifacts of the tiny source; it feels expensive.
**Difficulty: Low–Medium.** Blur on a full-screen layer is the one place TV GPUs choke — blur a
*small* element then scale it up, never blur a 1920px layer. (Recipe reference: https://www.plex.tv/plexamp/)

### C3 — Rotating Vinyl
Album art masked into a circle, with a CSS-drawn record (concentric `repeating-radial-gradient`
grooves, centre label = the art scaled down), rotating at a constant slow speed; a tonearm SVG
swings in on play and out on pause. Rotation pauses when playback pauses.
**Why it works on TV:** it is a continuously-moving object, so it is a *burn-in-safe* hero, and
it reads instantly as "music is playing" from across a room — no text needed.
**Difficulty: Medium.** `transform: rotate()` on a composited layer is nearly free; the tonearm
and the pause/resume easing are the fiddly part. Prior art to lift:
https://github.com/jefferey/scratchable-turntable (SVG + vanilla JS),
https://github.com/ApolloEagle/vinyl-spin (React/Tailwind component),
https://www.pyxofy.com/css-animation-turntable-part-1/ (step-by-step CSS).
**Caution:** a circular mask crops square cover art badly for some albums — keep C1/C2 as the
default and vinyl as a mode.

### C4 — Mesh-Gradient Drift
Four or five large blurred radial blobs coloured from `bgColor` + `textColor2..4`, each animated
on its own slow, prime-numbered duration so the composite never visibly loops. Album art small
and off-centre.
**Why it works on TV:** organic, never-repeating motion is the most burn-in-safe background
possible, and it looks like a screensaver you'd choose deliberately. Also survives the case
where art is unavailable.
**Difficulty: Medium.** Pure CSS is achievable; the trap is animating `filter: blur` (don't —
blur once, animate only `transform`/`opacity`).

### C5 — The "Display" Toggle (structural, not visual)
One remote-reachable button that cycles Now-Playing between **Artwork → Lyrics → Ambient**,
persisting the choice. Lifted directly from YouTube on Android TV.
**Why it works on TV:** it converts what would be a settings menu three levels deep into a single
D-pad press. TV users will not go hunting; they will press the one visible thing.
**Difficulty: Low.** It's a state machine and a chip. The value is in *not* building a settings screen.
(https://www.androidcentral.com/apps-software/android-tv/youtube-on-android-tv-spices-up-music-videos-with-on-screen-lyrics-and-album-art)

### C6 — Idle Ambient / Screensaver Mode
After N seconds with no remote input (suggest 30–60 s; verify with usability testing), controls
fade out entirely, album art shrinks and begins a slow drift across the screen, metadata reduces
to a small line that repositions each track. Any D-pad press restores the full UI instantly.
**Why it works on TV:** this is the *actual* dominant use case — music playing, remote on the
sofa, nobody looking. It is also the burn-in mitigation. Jellyfin ships exactly this pattern; Plexamp
moves elements for the same reason.
**Difficulty: Medium.** Easy to animate, easy to get *wrong*: the restore must be instant and must
not consume the keypress that woke it, or every user's first press after idling gets eaten.
(https://jellyfin.org/posts/androidtv-v0.16.0/)

### C7 — Full-Screen Time-Synced Lyrics
Current line large and in `textColor1`, adjacent lines dimmed to `textColor3`, vertical scroll on
the beat, over the C1/C2 background.
**Why it works on TV:** the TV is the only screen in the house where a whole room can read along;
YouTube shipped it on Android TV precisely for sing-alongs.
**Difficulty: High — and currently blocked.** Not a rendering problem: the public Apple Music API
does not expose lyric text or timings (`hasLyrics` only). Build the *slot*, ship it dark, and treat
any lyrics source as a separate legal/technical investigation.
(https://developer.apple.com/forums/thread/698127)

### C8 — Motion Artwork Passthrough
Where Apple supplies animated/motion artwork for an album, play it as the hero for the first
~10–15 s of a track, then settle to the still. Apple's own tvOS behaviour is close to this:
animated on the initial album view, still once the layout collapses.
**Why it works on TV:** it's the artist's own art direction, at full screen, for free — and the
"play then settle" shape avoids an infinite loop burning the panel.
**Difficulty: High.** Chiefly an availability question: motion artwork is documented for Apple Music
for Artists and shown on iOS/desktop, but I **could not verify** whether motion artwork assets are
retrievable through the public Apple Music API / MusicKit JS for third-party clients. **Verify before
committing any design to this.** Also honour Reduce Motion.
(https://help.apple.com/itc/albummotionguide/en.lproj/static.html, https://artists.apple.com/support/5544-create-motion-artwork, https://discussions.apple.com/thread/255113940)

### C9 — Pseudo-Reactive Pulse (the honest visualizer)
A ring, bloom, or gentle scale-breathe on the album art driven by **track position and tempo**,
not by audio analysis. If BPM is unavailable, a slow 4–6 s sine breathe reads as "musical" anyway.
**Why it works on TV:** viewers at 3 m cannot tell a real FFT from a plausible one; what they
register is "the screen is alive." And it is the only visualizer that is *possible* here.
**Difficulty: Low–Medium.** One `requestAnimationFrame` loop mutating a CSS variable.
**Do not** promise a real spectrum analyser — DRM makes it impossible (see Exec Summary #2).

### C10 — Up-Next Rail
A single low-profile row at the bottom of Now-Playing showing the next 3–5 tracks, focusable
with D-pad Down, dismissed with Back.
**Why it works on TV:** Plexamp puts "what's playing next" on the Now-Playing screen for a reason —
queue inspection is the most common reason a user picks the remote back up, and this saves a
whole navigation round-trip. It also gives Now-Playing a legitimate Down target, which the
D-pad focus graph needs anyway.
**Difficulty: Low.**

**Recommended default stack:** C1 + C2 as the background, C10 as the only persistent chrome,
C6 as the idle state, C5 as the way to reach C3/C7 later.

---

## 4. Hard-constraint cheat sheet (real numbers)

### Safe area / overscan
| Item | Value | Source |
|---|---|---|
| Design reference resolution | 960 × 540 dp (MDPI); ship 1080p assets | https://developer.android.com/design/ui/tv/guides/styles/layouts |
| Horizontal safe margin | **48dp** (5% of 960) — Google's layout guide also cites **58dp** for content side margins | ibid. |
| Vertical safe margin | **27dp**, commonly rounded to **24dp** (5% of 540); alt. spec 28dp | ibid. |
| Equivalent at 1080p | ≈ **96px** left/right, **54px** top/bottom | derived from the 5% rule |
| Rule of thumb | Assume up to **10%** may be cut on older sets; keep *critical* content inside 5%, let backgrounds bleed past | https://spot.pcc.edu/~mgoodman/developer.android.com/preview/tv/design/style.html |

### Grid & cards
| Item | Value |
|---|---|
| Columns | 12 |
| Column width | 52dp |
| Gutter | 20dp |
| Vertical spacing between rows | 4dp baseline unit |
| Card width by cards-per-row | 1→844dp · 2→412dp · 3→268dp · 4→196dp · 5→124dp |

(https://developer.android.com/design/ui/tv/guides/styles/layouts)

**Items per row:** Google's card-width table tops out at 5 cards across the safe width. More than
5 full-size cards on screen means each is under ~124dp and the title becomes unreadable at 3 m.
Rows may of course *scroll* beyond 5 — but 5 is the visible ceiling. A hard "max N items in a row"
rule is **[UNVERIFIED]** — Google publishes card widths, not a row-length cap.

### Typography
| Item | Value | Source |
|---|---|---|
| Absolute minimum | **12sp** | https://spot.pcc.edu/~mgoodman/developer.android.com/preview/tv/design/style.html |
| Recommended default body | **18sp** | ibid. |
| Practical minimum for comfortable 3 m reading | **~24pt** per TV design practitioners | https://uxdesign.cc/guidelines-designing-for-television-experience-524f19ab6357 |
| Typeface | Roboto is the TV system face; **avoid thin/light weights**, use sans-serif, enable anti-aliasing | https://developer.android.com/design/ui/tv/guides/styles/typography |
| Type scale | 15 styles (Display/Headline/Title/Body/Label ×3). Google defers concrete sp values to Material 3 type-scale tokens | ibid. + https://m3.material.io/styles/typography/type-scale-tokens |

### Focus
| Item | Value | Source |
|---|---|---|
| Scale on focus | **1.025x / 1.05x / 1.1x** (smaller factor for larger elements) | https://developer.android.com/design/ui/tv/guides/styles/focus-system |
| Glow elevation range | **2dp – 32dp** (glow is the common card treatment) | ibid. |
| Tonal elevation | levels **+1 to +5** surface overlays | ibid. |
| Required states | default / focused / pressed, plus enabled / disabled / selected modifiers | ibid. |
| Rule | Must change **at least one** of scale, border, glow, colour — in practice **use two**: colour alone fails colour-blind users and is invisible at distance | ibid. |
| Layout consequence | Pad containers so a focused item scaling to 1.1x does **not** overlap neighbours or get clipped by the row's overflow | ibid. |
| Apple TV equivalent | min card focus target **250×150pt**; supply assets at the *focused* (larger) size so they stay sharp | https://developers.apple.com/design/human-interface-guidelines/inputs/focus-and-selection |

### D-pad navigation rules
- **Axis discipline:** horizontal = items within a category; vertical = between categories. Never mix.
  (https://developer.android.com/design/ui/tv/guides/foundations/navigation-on-tv)
- Every focusable element must be reachable; the next focus target must be **guessable before pressing**.
- **BACK** = previous destination; repeated BACK must eventually land on the Google TV launcher.
  Do **not** gate exit behind a confirmation, and do **not** draw an on-screen back button — the
  remote has one. Splash screens must not be in the back stack. (ibid.)
- **HOME** leaves your app entirely and is not yours to intercept.
- Confirmation dialogs only for destructive / purchase / irreversible actions; BACK must dismiss them.
- **Menu depth:** Google specifies a *fixed start destination* (first screen shown = last screen before
  the launcher) rather than a numeric depth limit. A hard "max 3 levels" figure is **[UNVERIFIED]**;
  the enforceable rule is "every screen is escapable by repeated BACK, and the path back is short."
- **Text entry is hostile.** D-pad on-screen keyboards are slow and error-prone; Google steers apps to
  voice input and external keyboards. **This is the entire justification for QR-code login** — offloading
  an email + password to the phone removes the single worst TV interaction there is. Same logic applies
  to search: offer voice, never rely on typed text. (ibid.)
- **Hover does not exist.** There is no cursor, so nothing may depend on hover; every hover affordance
  must become a focus affordance.
- **Free scrolling does not exist.** D-pad up/down scrolls a list item-by-item; each item must be
  individually selectable. Long continuous scroll surfaces (e.g. a wall of 200 tracks) are punishing —
  paginate or chunk into rows. (ibid.)

### Burn-in (OLED)
- Modern OLED TVs mitigate with **Pixel Shift** (whole image moved 1–2 px every few minutes),
  Auto Logo Brightness (dims persistent static regions), and Pixel Refresh — but these are the TV's
  defence, not yours. (https://www.samsung.com/hk_en/support/tv-audio-video/how-to-troubleshoot-burn-in-or-image-retention-on-your-samsung-oled-tv/, https://www.viewsonic.com/library/gaming/oled-burn-in-what-it-is-why-it-happens-and-how-to-stop-it/)
- Practical guidance: dynamic backgrounds, reduced/hidden persistent HUD, dark mode, idle screensaver
  after 5–10 minutes. (https://black-screen.cc/blog/oled-burn-in-prevention-guide)
- **Design consequence for us:** no permanently-fixed bright element (logo, progress bar, static
  centred square) on a screen that runs for hours. Move things, fade things, or hand off to C6.

### Accessibility on TV
- **Reduce Motion** must disable vinyl rotation, mesh drift, motion artwork, and pulse. tvOS exposes it
  at Settings ▸ Accessibility ▸ Motion; Android has an equivalent animation-scale setting.
  (https://talk.tidbits.com/t/preventing-animated-cover-art-on-apple-tv/31973)
- Contrast: using `textColor1..4` against `bgColor` inherits Apple's own contrast pairing — but
  **verify against WCAG AA anyway**, because these colours are art-derived and some albums produce
  low-contrast pairs. Add a programmatic contrast check with a neutral fallback.
- Focus must be perceivable without colour (see focus rules).
- Do not encode meaning in colour alone; do not rely on animation to communicate state.
- **[UNVERIFIED]** I did not locate a TV-specific WCAG profile with distinct numeric targets; assume
  standard WCAG 2.x AA and enlarge from there for viewing distance.

### Google TV / Android TV Play Store requirements (high level)
| Requirement | Detail |
|---|---|
| Banner asset | **320 × 180 px** full-size banner |
| App icon | at least **160 × 160 px** at xhdpi |
| Launcher entry | `ACTION_MAIN` intent with `CATEGORY_LEANBACK_LAUNCHER` |
| Touchscreen | `<uses-feature android:name="android.hardware.touchscreen" android:required="false" />` |
| D-pad operability | **All** functionality reachable with 5-way D-pad (unless a game controller is genuinely required) |
| Media controls | Center = play/pause; Left/Right = rewind/fast-forward |
| Back button | Must be able to reach the Android TV home screen |
| Orientation | Landscape, no letterboxing |
| Overscan | No text or functionality cut off at screen edges |
| Background | Non-transparent, fills the whole screen |
| minSdk | 31 or lower for device compatibility (TV-Ready tier) |
| Architecture | 64-bit compliance required from **1 August 2026** |

(https://developer.android.com/docs/quality-guidelines/tv-app-quality)

> **Also worth doing, from the Jellyfin teardown:** register a **MediaSession** so Google TV's system
> UI and a paired phone can control playback. It is a small piece of work that makes the app feel
> native. (https://jellyfin.org/posts/androidtv-v0.19.0/)

---

## 5. Referenced repos & links

### Spatial navigation (D-pad focus on the web)
- **https://github.com/NoriginMedia/Norigin-Spatial-Navigation** — React-hooks spatial navigation for
  browsers, smart TVs, CTVs; works with keyboard, remote, and joystick; used on Tizen, webOS, Fire TV.
  *Steal:* the whole focus engine if the UI is a WebView — do not hand-roll focus graphs.
- **https://github.com/bamlab/react-tv-space-navigation** — React Native wrapper over **LRUD**;
  declarative, cross-platform (Android TV / tvOS / web TV).
  *Steal:* the declarative API shape (`<SpatialNavigationNode>` style), and LRUD's core algorithm
  even if you write your own bindings.
- **https://github.com/topics/spatial-navigation** — broader survey of alternatives.

### Colour extraction (fallback only — prefer Apple's `bgColor`)
- **https://github.com/Vibrant-Colors/node-vibrant** — semantic swatches (Vibrant, Muted, DarkVibrant,
  DarkMuted, LightVibrant, LightMuted); quantisation can run in a **WebWorker** so the TV's weak main
  thread doesn't stall. *Steal:* the six-role colour taxonomy and the WebWorker pattern.
- **https://github.com/lokesh/color-thief** — leaner, one dominant colour + palette via canvas.
  *Steal:* use only if you need a single tint and nothing else.
- Comparison: https://npm-compare.com/colorthief,node-vibrant

### Vinyl / turntable
- **https://github.com/jefferey/scratchable-turntable** — vanilla JS + SVG, Web Audio scratching.
  *Steal:* the SVG record and tonearm geometry.
- **https://github.com/ApolloEagle/vinyl-spin** — small React/TS/Tailwind spinning-vinyl component.
  *Steal:* the minimal CSS keyframe + mask approach.
- **https://github.com/subhajitroycode/record-player** — React turntable with needle movement, wired to
  Spotify Web Playback. *Steal:* the play/pause → rotation + tonearm state coupling.
- **https://github.com/bitu467/record-player** — plain HTML/CSS/JS turntable.
- Tutorials: https://www.pyxofy.com/css-animation-turntable-part-1/ ·
  https://www.pyxofy.com/css-animation-turntable-part-2/ ·
  https://codepen.io/mikkelrask/pen/wvZNbEN

### Now-Playing / TV clients to study
- **https://github.com/jellyfin/jellyfin-androidtv** — production Android TV media client; read its
  music screensaver and MediaSession code.
- **https://github.com/sregg/spotify-tv** — unofficial Spotify Android TV app; a small, readable
  reference for a TV music shell. (Likely unmaintained — **[UNVERIFIED]** currency.)
- **https://github.com/gloaysa/whatsplaying** — album-art Now-Playing display project.
- **https://github.com/rryam/MusanovaKit** — explores *private* Apple Music endpoints incl. lyrics.
  **Reference only — do not ship against private endpoints; Apple states they may be blocked at any time.**

### Platform documentation
- Android TV design foundations: https://developer.android.com/design/ui/tv/guides/foundations/design-for-tv
- Navigation on TV: https://developer.android.com/design/ui/tv/guides/foundations/navigation-on-tv
- Focus system: https://developer.android.com/design/ui/tv/guides/styles/focus-system
- Layouts: https://developer.android.com/design/ui/tv/guides/styles/layouts
- Typography: https://developer.android.com/design/ui/tv/guides/styles/typography
- TV app quality / Play requirements: https://developer.android.com/docs/quality-guidelines/tv-app-quality
- Leanback layouts: https://developer.android.com/training/tv/playback/leanback/layouts
- Apple HIG — Focus and selection: https://developers.apple.com/design/human-interface-guidelines/inputs/focus-and-selection
- Apple Music API — Artwork object: https://developer.apple.com/documentation/applemusicapi/artwork
- Apple Music album motion guidelines: https://help.apple.com/itc/albummotionguide/en.lproj/static.html
- Material 3 type scale tokens: https://m3.material.io/styles/typography/type-scale-tokens

### Practitioner guidance
- https://pascalpotvin.medium.com/designing-a-10ft-ui-ae2ca0da08b7
- https://uxdesign.cc/guidelines-designing-for-television-experience-524f19ab6357
- https://noriginmedia.com/10-tips-for-ui-ux-design-on-smart-tv/
- https://spyro-soft.com/blog/media-and-entertainment/8-ux-ui-best-practices-for-designing-user-friendly-tv-apps
- https://developer.amazon.com/docs/fire-tv/design-and-user-experience-guidelines.html

---

## 6. Open research items (do not design around these until verified)

1. **Motion artwork availability to third parties** via public Apple Music API / MusicKit JS. Blocks C8.
2. **Any lawful lyrics source** with timings for a third-party Apple Music client. Blocks C7.
3. **Radon Tunes hands-on** — install it, record the QR login flow and the Now-Playing screen. Everything
   in this report about it comes from store listings and third-party mirrors.
4. **Tidal Android TV** teardown — no reliable source found.
5. **Idle-timeout value** for C6 (30 s / 60 s / 120 s). Decide by usability test, not by argument.
6. **Contrast audit** of `bgColor` vs `textColor1..4` across a real album sample — how often does Apple's
   own pairing fail WCAG AA, and what's the fallback?
