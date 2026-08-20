# Apple Music on tvOS — UX Teardown for an Android TV Client

**Researched:** 2026-08-20
**Purpose:** inform an Android TV / Google TV Apple Music client (WebView + MusicKit JS, D-pad only, dark #0B0B10 design system, 5% overscan, `transform`/`opacity`-only animation).

## Evidence policy

Every number in this document is tagged:

- **[PUBLISHED]** — taken from Apple's own documentation, with a URL. Quotable, reliable.
- **[DERIVED]** — arithmetic on published values; the derivation is shown.
- **[THIRD-PARTY]** — measured or reimplemented by a named external developer, not Apple. Directionally right, not authoritative.
- **[ESTIMATE]** — my inference. Not verified. Treat as a starting value to tune, never as a spec.

**What I could not verify.** I have no screenshots of tvOS Apple Music and did not run the app. Everything about the *visual* Now Playing layout below is reconstructed from Apple Support's prose descriptions plus a written third-party walkthrough. Pixel positions in the wireframe are **[ESTIMATE]** unless marked otherwise. Apple publishes essentially **no** motion timings or easing curves for tvOS — the HIG Motion page explicitly says "No additional considerations for … tvOS" and contains no duration values on any platform. Anyone who quotes you a tvOS focus animation duration as an Apple number is inventing it.

---

## 1. Screen inventory

Apple's tvOS Music app has changed shape across releases (tab bar → sidebar in the TV app in tvOS 17.2; Liquid Glass in tvOS 26). The table below is the stable core that has held across tvOS 14–26. Where a row set is not documented by Apple I mark it.

| Screen | Sections, in documented order | What each section holds | Source |
|---|---|---|---|
| **Listen Now** | Top Picks → recently played → new releases → personalised mixes / albums / playlists → interviews | "play your favourites and discover personalised recommendations of albums, playlists and custom mixes all in one place"; navigate **down** through rows, **left/right** within a row | [Apple Support — Listen Now](https://support.apple.com/en-nz/guide/tv/atvb05364f5f/14.0/tvos), [iDownloadBlog](https://www.idownloadblog.com/2020/10/12/guide-apple-music-on-apple-tv/) |
| **Browse** (labelled **New** in some releases) | Featured videos/albums → Apple's picks → New music → Listen by mood → What's hot → Recently updated | Editorial, curated. Mixed card shapes: 16:9 video cards and 1:1 album cards in the same screen | [Apple Support — Music at a glance](https://support.apple.com/guide/tv/apple-music-at-a-glance-atvb9380f7dd/tvos), [iDownloadBlog](https://www.idownloadblog.com/2020/10/12/guide-apple-music-on-apple-tv/) |
| **Videos** (present in some releases; folded into Browse in others) | Featured → New → Genre → Essentials → Live music | All 16:9 | [iDownloadBlog](https://www.idownloadblog.com/2020/10/12/guide-apple-music-on-apple-tv/) |
| **Radio** | Featured stations (Apple Music 1, Apple Music Hits, Apple Music Country) → Shows hosted by artists/experts → New shows → Shows by genre → **Local Broadcasters** → **International Broadcasters** | Always-on live stations first, on-demand shows below, third-party broadcast last | [Apple Support — Radio](https://support.apple.com/guide/tv/listen-to-radio-stations-atvbb0d46f79/tvos) |
| **Library** | Pins (up to 6) → Recently Added → Playlists → Artists → Albums → Songs → Music Videos → Made For You → Composers → Genre rows | Sidebar / split-view navigation, not a scrolling row stack. Each category supports play, shuffle, filter, sort | [Apple Support — Library](https://support.apple.com/guide/tv/library-atvb9ed3ea39/tvos) |
| **Search** | Search field + on-screen keyboard → browsable genre / theme categories when the field is empty → results grouped by type when it is not | Searches "artists, songs, **lyrics**, albums, and more" — lyrics search is a documented capability | [Apple Support](https://support.apple.com/guide/tv/apple-music-at-a-glance-atvb9380f7dd/tvos), [iDownloadBlog](https://www.idownloadblog.com/2020/10/12/guide-apple-music-on-apple-tv/) |

**Structural facts worth copying**

- **Library is a split view, everything else is a row stack.** This matters: the tab bar is *pinned* on split-view screens and *scrolls away* on row-stack screens. [PUBLISHED] — [HIG Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- **Row count per screen is not fixed and not published.** Apple's own rows are server-driven editorial. Do not hard-code a row count.
- **Items visible per row is a function of card width, not a fixed count.** See the grid table in §4 — Apple publishes column widths, and a horizontal row uses the same widths. At the published 5-column width (320 pt) a row shows 5 full cards plus a partial 6th.
- **tvOS 26 (Sept 2025)** applied the "Liquid Glass" material across the system; the Music app was described as receiving the largest change, giving "albums and lists a 3D look with implied depth", with a translucent top bar that refracts content behind it. Also added: karaoke mode via iPhone-as-microphone, and real-time lyric translation with pronunciation. — [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-tv-brings-a-beautiful-redesign-and-enhanced-home-entertainment-experience/), [AppleInsider](https://appleinsider.com/articles/25/09/15/tvos-26-is-out-now-with-karaoke-mode-redesign-and-big-sound-upgrades)

---

## 2. Now Playing teardown

### 2.1 Documented behaviour (all [PUBLISHED], Apple Support)

From [Control music playback on Apple TV](https://support.apple.com/guide/tv/control-music-playback-atvbef12564e/tvos):

1. Selecting a song starts playback and shows **"playback controls and a timeline showing elapsed and remaining time."**
2. **"After several moments, the screen simplifies to show only the current song."** — controls auto-hide. This is the single most important Now Playing behaviour on tvOS.
3. Controls are re-revealed by a gesture (swipe/tap on the Siri Remote touch surface). The HIG describes this pattern generally: "resting a thumb on the remote indicates where to swipe to reveal an info area." — [HIG Remotes](https://developer.apple.com/design/human-interface-guidelines/remotes)
4. **Queue:** "The Now Playing queue shows all the songs in an album, songs and videos in a playlist, or what's next in a station. Items in the queue appear in a row **with the currently playing song in the centre.**" — the queue is a *horizontal* row, centre-anchored, not a vertical list.
5. **Queue-row controls:** shuffle, repeat (song / queue / off), autoplay ("continues to extend the queue with similar songs"), add to library, More.
6. **Lyrics:** "As the song plays, lyrics appear onscreen, scrolling in time with the song." You can navigate through lyrics to a specific line and **jump playback to that point**. Lyrics are toggled by a Lyrics button "at the bottom of the screen". Requires an Apple Music subscription.
7. **Info:** "Select Info, then select Go to Album or Go to Artist."
8. Song-level buttons documented by [iDownloadBlog](https://www.idownloadblog.com/2020/10/12/guide-apple-music-on-apple-tv/): **Add (+)**, **More (…)**, **AirPlay**, **Lyrics**. Album playback adds **Shuffle**, **Repeat**, **Autoplay**.
9. **Sing** (Apple TV 4K 3rd gen): vocal level adjusted with the **Volume buttons**. tvOS 26 adds iPhone-as-mic via QR code and lyric translation with pronunciation.

### 2.2 Gestures, and their D-pad equivalents

| Siri Remote (2nd gen clickpad) | Documented effect | Your D-pad equivalent |
|---|---|---|
| Press clickpad centre | Play / Pause | `DPAD_CENTER` / `KEYCODE_MEDIA_PLAY_PAUSE` |
| Play/Pause button | Play / Pause | `KEYCODE_MEDIA_PLAY_PAUSE` |
| Press **left** on clickpad ring | Restart song / previous | `DPAD_LEFT` when transport not focused, **or** `KEYCODE_MEDIA_PREVIOUS` |
| Press **right** on clickpad ring | Skip ahead / next | `DPAD_RIGHT`, **or** `KEYCODE_MEDIA_NEXT` |
| Circle finger around clickpad ring (silver remote) | Fine scrub along timeline | **No equivalent exists.** Substitute: focus the progress bar, then LEFT/RIGHT = ±10 s, held = accelerating scrub |
| Swipe **down** on touch surface | Reveal info/controls area | `DPAD_DOWN` from artwork → focus enters transport row |
| Swipe **up** | Reveal queue / lyrics region | `DPAD_UP` from artwork → focus enters queue row |
| Back button | Parent screen; hold = Home | `KEYCODE_BACK` |

The gesture→D-pad mapping is [ESTIMATE] on which direction reveals which region — Apple documents *that* gestures reveal controls, not *which* direction reveals *what*.

### 2.3 Wireframe — 1920 × 1080

**Reconstructed, not observed.** Positions are [ESTIMATE]; only the safe-area inset (60/80 pt) is [PUBLISHED]. Four states shown, including the idle "simplified" state Apple documents.

```
STATE A — controls revealed (first few seconds after start, or after a gesture)
┌────────────────────────────────────────────────────────────────────────────────┐ 0
│  ← 80pt →                                                            ← 80pt →  │
│    ┌──────────────────── safe area 1760 × 960 ────────────────────────────┐    │ 60
│    │                                                                      │    │
│    │                        ┌──────────────────┐                          │    │
│    │                        │                  │                          │    │
│    │                        │                  │                          │    │
│    │                        │   ALBUM ART      │  ~520 × 520              │    │
│    │                        │   1:1, centred   │  vertically high,        │    │
│    │                        │                  │  optical centre ~y=420   │    │
│    │                        │                  │                          │    │
│    │                        └──────────────────┘                          │    │
│    │                                                                      │    │
│    │                       Song Title            Title 2, 57pt            │    │
│    │                       Artist — Album        Body/Subtitle, 29–38pt   │    │
│    │                                                                      │    │
│    │        0:42  ▬▬▬▬▬▬▬▬▬●───────────────────────────  -3:18            │    │
│    │              progress bar, ~1200pt wide, ~6pt tall                   │    │
│    │                                                                      │    │
│    │              ( + )   ( ⤫ )   ( ⟲ )   ( ∞ )   (Lyrics)  ( … )         │    │
│    │               Add   Shuffle Repeat Autoplay  Lyrics   More           │    │
│    │              transport row — focusable, ~80pt tall buttons           │    │
│    └──────────────────────────────────────────────────────────────────────┘    │ 1020
└────────────────────────────────────────────────────────────────────────────────┘ 1080

STATE B — idle / "simplified to show only the current song"
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│                          ┌──────────────────────┐                              │
│                          │                      │                              │
│                          │     ALBUM ART        │   artwork remains, may       │
│                          │                      │   scale up slightly          │
│                          │                      │                              │
│                          └──────────────────────┘                              │
│                                                                                │
│                              Song Title                                        │
│                              Artist                                            │
│                                                                                │
│      background: heavily blurred, colour-sampled from the artwork,             │
│      slowly drifting. Controls, progress and buttons all faded to 0.           │
└────────────────────────────────────────────────────────────────────────────────┘

STATE C — queue revealed (documented: "currently playing song in the centre")
│                                                                                │
│     ┌────┐  ┌────┐  ┌──────────┐  ┌────┐  ┌────┐                               │
│  ···│ -2 │  │ -1 │  │  NOW ▶   │  │ +1 │  │ +2 │···   centre-anchored row,     │
│     └────┘  └────┘  └──────────┘  └────┘  └────┘      current item scaled up   │
│                                                                                │

STATE D — lyrics on
│                                                                                │
│   ┌──────┐      previous line, dimmed                                          │
│   │ ART  │      ACTIVE LINE — brighter, larger                                 │
│   │small │      next line, dimmed                                              │
│   └──────┘      next line, dimmed                                              │
│                 (line-by-line focusable; selecting a line seeks to it)          │
```

**The ambient background.** Apple Support does not describe the Now Playing background. Every written account and Apple's own marketing language ("wrapping people in a rich, cinematic experience") point to an artwork-derived, blurred, slowly-drifting field — the same family as the iOS/macOS Now Playing background and the tvOS 26 "implied depth" language. Treat the specific treatment as **[ESTIMATE]**. What is safe to say: it is derived from the current artwork, it is low-contrast enough not to fight the text, and it is not Apple-red.

---

## 3. The focus system

This is the part that makes tvOS feel expensive, and the part with the least published numbers.

### 3.1 Focus states — [PUBLISHED]

Source: [HIG — Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)

> "In tvOS, focusable items can have up to **five different states**, each of which is visually distinct."

| State | Apple's definition (verbatim) |
|---|---|
| **Unfocused** | "The viewer hasn't brought focus to the item. Unfocused items appear less prominent than focused items." |
| **Focused** | "A focused item visually stands out from other onscreen content through **elevation to the foreground, illumination, and animation**." |
| **Highlighted** | "A focused item provides instant visual feedback when people choose it (e.g., a button might briefly invert its colors and animate before transitioning to its selected appearance)." |
| **Selected** | "The viewer has chosen or activated the item in some way." |
| **Unavailable** | "The viewer can't bring focus to the item or choose it. An unavailable item appears inactive." |

Note the three mechanisms Apple names for the focused state — **elevation, illumination, animation**. Colour is deliberately absent, and the Color page says so explicitly:

> "**Avoid using only color to indicate focus.** Subtle scaling and responsive animation are the primary ways to denote interactivity when an element is in focus." — [HIG Color](https://developer.apple.com/design/human-interface-guidelines/color) [PUBLISHED]

### 3.2 Parallax / lift — [PUBLISHED] mechanism, [THIRD-PARTY] numbers

Apple's description, verbatim from [HIG — Images](https://developer.apple.com/design/human-interface-guidelines/images):

> "**Parallax** is a subtle visual effect the system uses to convey depth and dynamism when an element is in focus. As an element comes into focus, the system **elevates it to the foreground**, **gently sways it** while applying **illumination that makes the surface appear to shine**. Out-of-focus content **dims** and the focused element **expands**."

> "A layered image consists of **2 to 5 distinct layers**." The background layer **must be opaque** ("you'll get an error if it's not"). Foreground = characters/text, middle = secondary content and shadows, background = opaque backdrop.

> "**Keep layering simple and subtle** — Parallax is designed to be **almost unnoticeable**. Excessive 3D effects can appear unrealistic and jarring."

> "**Leave a safe zone around foreground layers** — When focused, content on some layers may be cropped as the layered image scales and moves."

App icons **must** be layered images; other focusable images are "strongly encouraged but optional". Runtime layered images use the `.lcr` format, generated by Xcode's `layerutil`.

**tvOS 17+ added a second, simpler effect.** The `highlight` hover effect "adds a **perspective shift and specular shine** to the focused item as you swipe the remote", and is applicable to any focusable view without authoring layered art. The default for Buttons and NavigationLinks is the `lift` effect. — [Swift with Majid](https://swiftwithmajid.com/2020/03/25/hover-effect-in-swiftui/), [WWDC23 "The SwiftUI cookbook for focus"](https://developer.apple.com/videos/play/wwdc2023/10162/)

**Numbers.** Apple publishes none. The most credible external reimplementation is [devsign.co — Creating focus effects in tvOS](https://devsign.co/notes/custom-focus-effects-in-tvos), whose author reproduced the effect on custom views:

| Property | Value | Tag |
|---|---|---|
| Focused scale | **1.1×** | [THIRD-PARTY] |
| Shadow offset | 0 x, **+16 pt** y | [THIRD-PARTY] |
| Shadow blur radius | **25 pt** | [THIRD-PARTY] |
| Shadow alpha | **0.3** | [THIRD-PARTY] |
| Parallax translate | **±4 pt** horizontal, **±4 pt** vertical | [THIRD-PARTY] |
| Parallax tilt | **±10°** horizontal, **±10°** vertical | [THIRD-PARTY] |
| Press-down animation | **0.1 s**, spring damping **0.9** | [THIRD-PARTY] |
| Press-up animation | **0.2 s**, spring damping **0.9** | [THIRD-PARTY] |
| Focus-in / focus-out duration | **not published, not measured** | — |

For the missing focus-in duration, **[ESTIMATE] 200–250 ms** with a decelerating curve, and focus-*out* slightly faster than focus-in (~150 ms) so the outgoing card clears before the incoming one lands. This is inference from how the effect reads on video, not a measurement. Tune it on a real TV.

### 3.3 Focus ring — the answer is "no, and then partly yes"

- **Classic tvOS: no focus ring.** Focus is communicated by scale + elevation (shadow) + specular shine + dimming of everything else. The HIG never describes a ring or outline for content cards.
- **`UIFocusHaloEffect` exists** (UIKit) and "draws a halo around the focus item", with a `Position` enum controlling placement. It is used for small controls and text-bearing elements, not for artwork cards. A [developer forum thread](https://developer.apple.com/forums/thread/808907) notes the halo does not respect `cornerRadius` on `UIImageView` — i.e. it is not intended as the artwork treatment.
- **Practical read:** for artwork, **no ring**. For dense text controls where scale alone is ambiguous, a halo / soft outline is legitimate tvOS vocabulary.

### 3.4 Row scrolling and where focus parks

Apple does not publish the parking rule. What is documented:

- The focus engine "determines where the focus should move to next by looking horizontally or vertically in the direction that the user is moving toward" — [Brightec](https://www.brightec.co.uk/blog/tvos-focus-engine)
- `UIFocusGuide` exists precisely because that geometric search fails at layout seams — an "invisible, focusable region that can redirect focus to other views."
- Focus changes carry a `UIFocusAnimationCoordinator`; **"Apple may shorten or speed up the animations depending on how fast the user is moving between focusable elements."** [PUBLISHED behaviour, via Brightec] This is a real and copyable idea: **when the user hammers the D-pad, collapse the animation.**
- Swipe scrolling "starts fast then slows down based on swipe strength. Swiping on the edge allows very fast scrolling." — [HIG Remotes](https://developer.apple.com/design/human-interface-guidelines/remotes)
- **"Make partially hidden content look symmetrical (equal width on each side)"** — [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout) [PUBLISHED]. This is a strong hint that rows are **centre-parked**, not leading-parked: a leading-parked row shows a partial card only on the right.
- The Now Playing queue is explicitly centre-anchored ("currently playing song in the centre"). [PUBLISHED]

**Read:** tvOS content rows park the focused card at or near the **horizontal centre** of the safe area, with symmetric partial cards bleeding off both edges. **[ESTIMATE]** for browse rows; **[PUBLISHED]** for the Now Playing queue.

Vertically: focus moving down a row stack scrolls the stack so the focused row sits in the upper-middle band, with the row title above it. Exact parking line **[ESTIMATE]**.

### 3.5 Other published focus rules

- **"Provide a default focused element on every screen."** When a view appears, one element must already hold focus. — HIG
- **"Avoid displaying a pointer."** "People expect to navigate a fixed number of items by changing focus, not by trying to drag a tiny pointer around a huge screen."
- **"In a full-screen experience, let people use gestures to interact with the content, not to move focus."** — this is exactly the Now Playing idle state: no focus shown, gestures act on the media.
- **"Supply assets for the larger, focused size to ensure they always look sharp"**, and **"make sure the larger item doesn't crowd the surrounding interface"** — i.e. reserve the 10% scale headroom in your gutters.

---

## 4. HIG numbers table

All rows [PUBLISHED] unless marked. tvOS renders at **1920 × 1080 points @1x** and **3840 × 2160 px @2x**, so **1 pt = 1 px at 1080p**.

| Property | Value | Source |
|---|---|---|
| **Safe area — top / bottom** | **60 pt** | [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout) |
| **Safe area — left / right** | **80 pt** | [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout) |
| Safe area as % of 1920×1080 | **4.17% horizontal, 5.56% vertical** | [DERIVED] 80/1920, 60/1080 |
| Usable safe content box | **1760 × 960 pt** | [DERIVED] |
| Older HIG value, still widely cited | 90 px sides / 60 px top-bottom | [Marvel](https://marvelapp.com/blog/designing-for-television/) — **superseded**; current HIG says 80 pt |
| **Grid: 2-column** | 860 pt wide, 40 pt gap | HIG Layout |
| **Grid: 3-column** | 560 pt, 40 pt gap | HIG Layout |
| **Grid: 4-column** | 410 pt, 40 pt gap | HIG Layout |
| **Grid: 5-column** | 320 pt, 40 pt gap | HIG Layout |
| **Grid: 6-column** | 260 pt, 40 pt gap | HIG Layout |
| **Grid: 7-column** | 217 pt, 40 pt gap | HIG Layout |
| **Grid: 8-column** | 184 pt, 40 pt gap | HIG Layout |
| **Grid: 9-column** | 160 pt, 40 pt gap | HIG Layout |
| **Minimum vertical spacing between rows** | **100 pt** | HIG Layout |
| Grid arithmetic check | 5×320 + 4×40 = 1760 ✓ ; 3×560 + 2×40 = 1760 ✓ ; 2×860 + 40 = 1760 ✓ | [DERIVED] — confirms the 80 pt side inset |
| **Tab bar height** | **68 pt**, cannot be changed | [HIG Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) |
| **Tab bar top edge** | **46 pt** from top of screen, cannot be changed | HIG Tab bars |
| Tab bar appearance | Translucent by default; **only the selected tab is opaque**; selected tab gains a **drop shadow** when the bar has focus | HIG Tab bars |
| Tab bar scroll behaviour | Scrolls offscreen by default; **pinned when the screen contains a split view** (e.g. Library, Settings) | HIG Tab bars |
| Tab bar overflow | Rightmost item truncated with a fade; a left fade also appears once scrollable | HIG Tab bars |
| Menu / Back key | **"Focus always returns to the tab bar at the top"** | HIG Tab bars |
| **Type — Title 1** | Medium **76 pt** / 96 pt leading (emphasis: Bold) | [HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography) |
| **Type — Title 2** | Medium **57** / 66 | HIG Typography |
| **Type — Title 3** | Medium **48** / 56 | HIG Typography |
| **Type — Headline** | Medium **38** / 46 | HIG Typography |
| **Type — Subtitle 1** | Regular **38** / 46 | HIG Typography |
| **Type — Callout** | Medium **31** / 38 | HIG Typography |
| **Type — Body** | Medium **29** / 36 | HIG Typography |
| **Type — Caption 1** | Medium **25** / 32 | HIG Typography |
| **Type — Caption 2** | Medium **23** / 30 | HIG Typography |
| **Default text size** | **29 pt** | HIG Typography |
| **Minimum text size** | **23 pt** | HIG Typography |
| Font weights | "**Avoid light font weights.** Prefer Regular, Medium, Semibold, or Bold. Avoid Ultralight, Thin, and Light." | HIG Typography |
| Typefaces | SF Pro is the tvOS system font; New York also available. "Minimize typeface variety — use only one or two." | HIG Typography |
| **Minimum focusable size** | **Apple publishes no number.** Third-party guides cite ~250 × 150 pt for cards; unsourced to Apple | [THIRD-PARTY] |
| Buttons — tvOS specifics | **"No additional considerations for tvOS."** | [HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) |
| Motion — tvOS specifics | **"No additional considerations for … tvOS."** No durations published on any platform | [HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion) |
| **Colour — palette** | "Consider choosing a **limited color palette** that coordinates with your app logo. **Subtle** use of color can help you communicate your brand **while deferring to the content**." | [HIG Color](https://developer.apple.com/design/human-interface-guidelines/color) |
| **Colour — focus** | "**Avoid using only color to indicate focus.** Subtle scaling and responsive animation are the primary ways to denote interactivity." | HIG Color |
| **Colour — testing** | "Test tvOS apps on **multiple brands of HD and 4K TVs**, and with different display settings." | HIG Color |
| Layered images | **2 to 5 layers**; background layer must be opaque; `.lcr` at runtime via `layerutil` | [HIG Images](https://developer.apple.com/design/human-interface-guidelines/images) |
| Top Shelf image | **1920 × 720 px** | [tvOS-guidelines summary](https://github.com/BasThomas/tvOS-guidelines) [THIRD-PARTY] |
| Launch image | **1920 × 1080 px** | [tvOS-guidelines summary](https://github.com/BasThomas/tvOS-guidelines) [THIRD-PARTY] |
| Audio on tvOS | "The system plays audio **only when people initiate it**"; tvOS does **not** play sounds for alerts or notifications | [HIG Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio) |
| Split view default | ⅓ primary pane / ⅔ secondary | [tvOS-guidelines summary](https://github.com/BasThomas/tvOS-guidelines) [THIRD-PARTY] |
| Segmented control | Fewer than 7 segments | [tvOS-guidelines summary](https://github.com/BasThomas/tvOS-guidelines) [THIRD-PARTY] |

**Comparison to our design system:** our 5% uniform overscan is **more conservative horizontally** than Apple (5% = 96 px vs Apple's 80 pt) and **slightly tighter vertically** (5% = 54 px vs Apple's 60 pt). Recommend moving to Apple's asymmetric **80 / 60**, which buys 32 px of extra horizontal content width per side and is the value Apple's own grid arithmetic is built around.

---

## 5. Copy / adapt / avoid

The line is: **platform conventions are free; brand identity is not.** Apple's own trademark guidance says you may not use an Apple trademark "in a manner that would imply Apple's affiliation with or endorsement, sponsorship, or support of a third party product or service" ([Apple Legal](https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html)). Separately, **if you use MusicKit or MusicKit JS you are contractually bound by the [Apple Music Identity Guidelines](https://marketing.services.apple/apple-music-identity-guidelines)** — that is us.

### ✅ COPY — platform conventions, uncontroversial

| Element | Why it's free |
|---|---|
| **Five focus states** (unfocused / focused / highlighted / selected / unavailable) | Published interaction guidance for the platform, not a brand asset |
| **Scale + elevation + dimming as the focus signal**, not a colour ring | Interaction convention; also just the correct 10-foot pattern |
| **80/60 pt safe area, 40 pt gaps, 100 pt row spacing** | Published layout guidance; these are engineering constants |
| **Type scale ratios** (76 / 57 / 48 / 38 / 31 / 29 / 25 / 23) and the 23 pt floor | Legibility constants for 3 m viewing. Copy the *sizes*; use your own typeface |
| **Tab bar at the top that scrolls away, pinned in split views; Back returns focus to it** | Navigation convention |
| **Row stack + horizontal rows; centre-parked focus; symmetric partial cards** | Layout convention |
| **Controls auto-hide on Now Playing; gesture to reveal** | Interaction convention |
| **Centre-anchored queue row with the current item in the middle** | Interaction convention |
| **Time-synced lyrics, select-a-line-to-seek** | Function, not identity — and MusicKit supplies the lyric data |
| **Default focus on every screen; never show a pointer** | Published guidance |
| **Collapse animations when the user navigates fast** | Behaviour, not appearance |

### ⚠️ ADAPT — right idea, must be visibly ours

| Element | The adaptation |
|---|---|
| **Parallax tilt on artwork** | Apple's version needs multi-layer `.lcr` art we don't have and can't generate from a flat album cover. **Do a single-plane version:** scale + shadow + a *subtle* directional specular sweep driven by focus direction. Apple's own docs tell third parties to "come up with something distinctly different" rather than mimic the system effect. Keep tilt well under the [THIRD-PARTY] ±10° — **[ESTIMATE] ±3–4°** reads as premium; more reads as a knock-off |
| **The 1.1× focus scale** | 1.1 is a third-party reimplementation's read, not Apple's number. Pick our own and commit — **[ESTIMATE] 1.06–1.08** with a stronger shadow gives similar lift with less reflow pressure in a WebView |
| **Liquid Glass / translucency** | Do not attempt to reproduce tvOS 26's refraction. On our dark #0B0B10 base, a flat elevated surface with a 1 px hairline reads better and costs nothing. Also: `backdrop-filter` is not a `transform`/`opacity` property and would violate our animation constraint if animated |
| **Ambient artwork background** | Deriving a blurred, colour-sampled background from the current artwork is a universal music-player convention (Spotify, YouTube Music, Plex all do it). Fine to do. Make the *motion* and *grain* ours |
| **Apple Music brand red #D60017** | **This is the one to get right.** Using Apple Music's exact extracted red as our accent, in an app that plays Apple Music, is the clearest possible implication of endorsement. **Use our own accent colour.** The HIG itself says to pick "a limited color palette that coordinates with **your app logo**" |
| **Tab labels "Listen Now / Browse / Radio / Library / Search"** | Largely generic and several are shared with other services. Safe as functional labels. But do not typeset them in Apple's mark styling |

### ❌ AVOID — trademark and Identity-Guidelines problems

| Element | The problem |
|---|---|
| **The Apple Music logo, note-mark, or any Apple-supplied badge as our app identity or nav icon** | Identity Guidelines: use only official artwork, unmodified, and only as a *link-out badge* — "never replace the music notes with the Apple logo", "do not create custom badges", no rotation, tilt, animation, shadows or glows. An animated badge inside a focus effect violates this outright |
| **#D60017 as our primary brand / accent colour** | See above. It is the single most recognisable non-verbal Apple Music signal |
| **Naming the app "Apple Music for Android TV" or similar** | Implies affiliation. Also: "Apple Music" must never be translated, transliterated, or made possessive. Prefer "*OurName* — a client for Apple Music", with the trademark used descriptively |
| **Pixel-cloning the Now Playing screen and passing it off as Apple's** | Trade dress. Convention-matching is fine; a screenshot-identical reproduction is not |
| **Apple's system fonts (SF Pro, New York)** | Licensed for use on Apple platforms. On Android TV use Inter / Roboto / a licensed alternative with a similar metric feel |
| **The `.lcr` layered-image format and Apple's parallax asset pipeline** | Not available off-platform and not licensed |
| **tvOS system iconography (SF Symbols)** | Licensed for Apple platforms only. Use Material Symbols or our own |
| **Any UI implying Apple built, endorsed, or supports the app** | Includes Apple-styled loading screens, an Apple-logo splash, or "Powered by Apple" phrasing |

**One-line rule for the team:** *copy the physics, not the paint.*

---

## 6. Gap list — our design vs tvOS, ranked by user cost

| # | Gap | User cost | Fix |
|---|---|---|---|
| **1** | **Focus animation constrained to `transform`/`opacity`** — Apple's lift uses an animated *shadow* (offset 16, radius 25, alpha 0.3) growing with focus, which we cannot animate | **High.** Scale alone reads flat; elevation is half the "expensive" feeling. Without it, focus is ambiguous at 3 m | Pre-render two shadow layers as sibling elements and cross-fade their `opacity` (allowed), or put a static shadow on a pseudo-element that is `scale`-d with the card. Do **not** animate `box-shadow` |
| **2** | **Focus parking rule undefined in our design** | **High.** If our rows are leading-parked, the focused card sits at the left edge with a single partial card on the right — visibly cheaper than tvOS, and the user loses the "what's next" preview on both sides | Centre-park the focused card in the safe area; keep symmetric partial cards bleeding both edges (Apple: "make partially hidden content look symmetrical") |
| **3** | **No documented auto-hide on Now Playing** | **High.** tvOS's defining Now Playing behaviour is that it *becomes a poster* when idle. Persistent chrome on a 65″ screen playing background music is actively unpleasant | Add: controls fade out after ~5 s idle ([ESTIMATE]; Apple says "after several moments"); any D-pad key restores them |
| **4** | **Overscan mismatch: our uniform 5% vs Apple's 80/60 pt** | **Medium.** 5% horizontal costs us 16 px of content width per side and breaks the 40 pt-gap grid arithmetic that makes tvOS rows line up | Switch to 80 pt / 60 pt (4.17% / 5.56%). Adopt the 40 pt gap and 100 pt row spacing so column widths land on Apple's published values |
| **5** | **#D60017 as our accent** | **Medium** for the user, **high** for the project. Users won't notice; Apple's legal team might, and it fails the Identity Guidelines we're bound to via MusicKit JS | Pick a distinct accent. Reserve red for destructive actions only |
| **6** | **No fast-navigation animation collapse** | **Medium.** Holding a D-pad direction across a long row with a 250 ms transition per item feels laggy and queues up. tvOS explicitly shortens animations under fast input | Track time since last focus change; below ~120 ms, drop the transition duration toward 0 |
| **7** | **Type floor** | **Medium.** Anything under 23 pt / 23 px at 1080p is unreadable at 3 m. Easy to violate accidentally with rem scaling on secondary metadata | Enforce a 23 px hard floor in the token layer; default body 29 px |
| **8** | **No specular / illumination component in our focus state** | **Medium.** Apple names *illumination* as one of three focus mechanisms. Scale + shadow alone is 2 of 3 | Add a `linear-gradient` overlay element whose `opacity` and `transform: translateX` animate on focus — both allowed properties |
| **9** | **Queue not centre-anchored** | **Low–Medium.** Apple's queue explicitly centres the current track. A left-anchored list loses "where am I in this album" at a glance | Centre-anchor the queue row; scale up the current item |
| **10** | **Light font weights** | **Low but avoidable.** Apple: "avoid Ultralight, Thin, and Light" — they smear on TV panels and over chroma-subsampled HDMI | Restrict tokens to Regular / Medium / Semibold / Bold |
| **11** | **Tab bar geometry** | **Low.** 68 pt tall, 46 pt from top is Apple's fixed value; matching it is free familiarity | Match it, or at minimum keep the bar in that band |
| **12** | **No lyric-line seek** | **Low.** A delight feature, not a blocker — but it is documented tvOS behaviour and MusicKit exposes timed lyrics | Make lyric lines focusable; select = seek |

---

## Sources

- [HIG — Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)
- [HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [HIG — Images (layered images, parallax)](https://developer.apple.com/design/human-interface-guidelines/images)
- [HIG — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [HIG — Remotes](https://developer.apple.com/design/human-interface-guidelines/remotes)
- [HIG — Designing for tvOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos)
- [HIG — Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio)
- [HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [HIG — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple Support — Music app at a glance](https://support.apple.com/guide/tv/apple-music-at-a-glance-atvb9380f7dd/tvos)
- [Apple Support — Control music playback (Now Playing)](https://support.apple.com/guide/tv/control-music-playback-atvbef12564e/tvos)
- [Apple Support — Listen Now](https://support.apple.com/en-nz/guide/tv/atvb05364f5f/14.0/tvos)
- [Apple Support — Library](https://support.apple.com/guide/tv/library-atvb9ed3ea39/tvos)
- [Apple Support — Radio](https://support.apple.com/guide/tv/listen-to-radio-stations-atvbb0d46f79/tvos)
- [Apple Music Identity Guidelines](https://marketing.services.apple/apple-music-identity-guidelines)
- [Apple Legal — Guidelines for third parties](https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html)
- [Apple Developer — Licensing and trademarks](https://developer.apple.com/licensing-trademarks/)
- [Apple Newsroom — Apple TV redesign (tvOS 26)](https://www.apple.com/newsroom/2025/06/apple-tv-brings-a-beautiful-redesign-and-enhanced-home-entertainment-experience/)
- [AppleInsider — tvOS 26 release](https://appleinsider.com/articles/25/09/15/tvos-26-is-out-now-with-karaoke-mode-redesign-and-big-sound-upgrades)
- [devsign.co — Creating focus effects in tvOS](https://devsign.co/notes/custom-focus-effects-in-tvos) (third-party measurements)
- [Brightec — tvOS Focus Engine](https://www.brightec.co.uk/blog/tvos-focus-engine)
- [Swift with Majid — Hover effect in SwiftUI](https://swiftwithmajid.com/2020/03/25/hover-effect-in-swiftui/)
- [WWDC23 — The SwiftUI cookbook for focus](https://developer.apple.com/videos/play/wwdc2023/10162/)
- [UIFocusHaloEffect](https://developer.apple.com/documentation/uikit/uifocushaloeffect) / [forum thread on halo + cornerRadius](https://developer.apple.com/forums/thread/808907)
- [BasThomas/tvOS-guidelines](https://github.com/BasThomas/tvOS-guidelines) (third-party summary)
- [iDownloadBlog — Apple Music on Apple TV guide](https://www.idownloadblog.com/2020/10/12/guide-apple-music-on-apple-tv/)
- [Marvel — Designing for television](https://marvelapp.com/blog/designing-for-television/)
