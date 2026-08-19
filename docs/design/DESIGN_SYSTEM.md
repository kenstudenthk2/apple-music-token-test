# AppleTune TV — Design System

**Audience:** Frontend developers building the TV UI, and anyone reviewing its visual decisions.
**Platform:** Android TV / Google TV, browser-rendered UI
**Input:** D-pad only (UP / DOWN / LEFT / RIGHT / OK / BACK). No touch, no pointer, no keyboard.
**Reference canvas:** 1920 x 1080. Verified at 1280 x 720 and 3840 x 2160.
**Tokens:** `public/tv/styles/tokens.css` — import it first, before any component stylesheet.

Every number below is given at the 1080p reference. Multiply by 0.667 for 720p and by 2.0 for
4K; the token system does this automatically because all dimensions are expressed in `rem` and
the root font-size is `clamp(8px, 0.8333333vw, 40px)`.

---

## 1. Foundations and rationale

### 1.1 Root scaling — why viewport-driven rem

`1rem = 16px` at 1920px wide. The root font-size is a pure function of viewport **width**, so the
whole interface is one uniform scale factor away from the reference design at any panel
resolution. Consequences a developer must respect:

- **Never write a `px` value in component CSS.** A hardcoded 24px is 24px at 4K too, i.e. half
  the intended size. The only `px` in the entire system is the root font-size clamp itself.
- Width-driven (not height-driven) means a 16:10 or 21:9 panel gets a shorter or taller page,
  never a wider one. Content is capped by the safe area, so nothing overflows sideways.
- The clamp floor (8px) keeps text legible if the app is ever rendered in a 640px debug webview;
  the ceiling (40px) stops an 8K panel from producing absurd type.

### 1.2 Overscan safe area — why 5%

Consumer TVs still crop 3-5% of the signal, and many "Full pixel / Just scan" modes are off by
default. 5% on all sides is the Android TV guidance and our worst case.

| Resolution | Left/right inset | Top/bottom inset | Usable content box |
|---|---|---|---|
| 1280 x 720  | 64px  | 36px  | 1152 x 648  |
| 1920 x 1080 | 96px  | 54px  | 1728 x 972  |
| 3840 x 2160 | 192px | 108px | 3456 x 1944 |

Rule: **nothing readable or focusable may sit outside the safe box.** Backgrounds, art bleed,
gradient masks and the "peek" of the next tile in a shelf may extend to the panel edge. The one
sanctioned exception is decorative focus overflow — a focused tile at the start of a row grows
11.5px to the left and its ring adds another 8px, total 19.5px into a 96px margin. The element
itself remains entirely inside the safe box; only its glow leaves it.

### 1.3 Colour — why near-black, not black

`--surface-0: #0B0B10` (~4% relative luminance).

- **OLED:** pure `#000` switches pixels fully off. A card lifting off a fully-off field reads as
  a hard cut with no perceived depth, and near-black gradients band badly against it.
- **Edge-lit LCD:** `#000` exposes backlight bleed and local-dimming halos — a focused, glowing
  tile drags a visible grey cloud around with it.
- `#0B0B10` still reads as cinema-dark in a dark room but leaves headroom for four
  distinguishable elevation surfaces above it (`#14141B`, `#1E1E27`, `#2A2A35`, `#363644`), each
  roughly one perceptual step apart.
- The +5 on the blue channel counteracts the warm gamma most TVs ship in "Standard" picture mode,
  so the UI reads neutral rather than brown on a factory-default set.

`--text-primary` is `#F5F6F8`, not `#FFFFFF`. Pure white on near-black at 3 m causes visible
halation/bloom on LCD panels; 96% white keeps glyph edges crisp without losing contrast (18.1:1).

Accent splits into a **fill** colour and a **text** colour. `--accent-500 #FA2D48` is 4.9:1 on
`--surface-0` — fine for large text and comfortably over the 3:1 threshold for non-text UI
components, but not safe for 24px body copy. Any accent-coloured text at body size must use
`--accent-300 #FF8496` (7.1:1).

### 1.4 Album-art adaptive accent

`--art-accent` defaults to `--accent-500` and is overwritten at runtime by the colour extractor.
Three derived tokens follow it automatically: `--art-accent-soft` (22% wash), `--art-glow` (46%,
used by the focus glow) and `--art-bloom` (the radial background gradient on Now Playing).

Extractor contract:

1. Extract the dominant vibrant swatch from the 600px artwork.
2. Clamp to **L\* 45-75** and **chroma >= 0.08** in OKLCH. This is what stops a near-white
   ambient record or a muddy brown live album from producing an invisible or filthy accent.
3. Re-check contrast against `--surface-0`. If still under 3:1, discard and keep the fallback.
4. Write **only** `--art-accent`. Never touch `--accent-500` and never touch `--focus-ring` — the
   focus affordance must be identical on every screen and every album, or users lose the one
   anchor they have.
5. Cross-fade a track change over `--dur-slow` (400ms) by fading two static full-bleed layers
   with `opacity`. Do not transition `background-color` on a large element.

### 1.5 Type — why 24px is the floor

The governing constraint is angular size, not pixel size. A 55" 1080p panel at 3 m puts 24px at
roughly the same visual angle as 9px on a laptop at 60 cm. That is the **floor**, not the
comfort point, so:

| Token | 1080p | rem | Use |
|---|---|---|---|
| `--fs-display`  | 64px | 4rem     | Now Playing track title, QR headline |
| `--fs-title-lg` | 44px | 2.75rem  | Screen titles ("Your Library"), error titles |
| `--fs-title`    | 36px | 2.25rem  | Shelf headings, dialog titles |
| `--fs-title-sm` | 32px | 2rem     | Nav items, primary buttons |
| `--fs-body-lg`  | 28px | 1.75rem  | **Preferred body.** Card primary label, list titles |
| `--fs-body`     | 24px | 1.5rem   | **Minimum body.** Secondary labels, metadata |
| `--fs-caption`  | 20px | 1.25rem  | Non-essential, duplicated metadata only |

Caption size is below the readable floor by design. It may only carry information that is
duplicated or inferable elsewhere on screen (a track count next to a visible list, an already
announced "Updated today"). It must never be the sole carrier of meaning.

Line-heights tighten as size grows (`--lh-tight 1.1` for display, `--lh-body 1.45` for paragraphs)
because TV lines are short and large type looks loose at 1.4+. Timecodes use
`font-variant-numeric: tabular-nums` so `0:59 -> 1:00` does not shift the layout every second.

### 1.6 Spacing — why 32px is the minimum sibling gap

An 8px base grid, but the operative rule is the **focus-collision rule**: a focused 288px tile
grows to 311px, i.e. 11.5px per side, plus a 4px offset and a 4px ring = 19.5px of visual
overflow per side. Two adjacent focusable elements therefore need at least 32px
(`--space-4`) between them so the focused one never touches its neighbour. Shelves are separated
by 48px (`--space-5`) so vertical D-pad movement reads as a distinct jump.

### 1.7 Motion — the performance contract

TV SoCs have weak GPUs and no fast path for repaint-heavy properties. This is stated at the top
of `tokens.css` and is non-negotiable:

- **Animate only `transform` and `opacity`.**
- **Never animate** `width`, `height`, `top/left/right/bottom`, `margin`, `padding`, `box-shadow`,
  `filter`, `border-width`, `background-color`, `border-radius`.
- Elevation changes are done by cross-fading two pseudo-element layers that each carry a
  **static** `box-shadow`.
- `will-change: transform` goes on the focusable element **only while a row is actually moving**,
  and is removed afterwards. Permanent `will-change` exhausts TV VRAM and causes texture
  thrashing on Amlogic-class chips.
- Budget: under ~6 simultaneously animating layers per screen.

Durations: `--dur-focus: 200ms`. Below ~140ms the scale change reads as a flicker once you add
the 2-3 frames of TV picture-processing lag; above ~320ms it feels sluggish when a user holds the
D-pad to scroll a long row. Easing is **ease-out only** — `cubic-bezier(0.20, 0, 0, 1)`. Spring
and bounce curves are banned: on a held key-repeat they make the whole UI look like it is
wobbling, and they roughly double the animated frame count.

---

## 2. Focus state — the exact spec

Focus is the single most important visual in this product. It must be identifiable from 3 m by a
viewer who is not looking directly at it. It is therefore expressed on **four simultaneous
channels**, never on colour alone.

| Channel | Value |
|---|---|
| Scale | `1.08` tiles/cards, `1.12` small controls (`data-size="sm"`), `1.02` full-width elements (`data-size="lg"`) |
| Ring colour | `#FFFFFF` (`--focus-ring`) — neutral, 21:1 on every surface, never derived from `--art-accent` |
| Ring width | `4px` (`--focus-ring-width`) |
| Ring offset | `4px` gap between element edge and ring (`--focus-ring-offset`) |
| Ring liner | `1px rgba(11,11,16,0.9)` outside the white ring, so it survives on light artwork |
| Glow | `0 0 32px 8px var(--art-glow)` — 32px blur, 8px spread, artwork accent at 46% alpha |
| Elevation | `--elev-1` -> `--elev-3` by opacity cross-fade of two static shadow layers |
| Stacking | `z-index: 1` — the focused element always paints above its siblings |
| Duration | `200ms` (`--dur-focus`), `cubic-bezier(0.20, 0, 0, 1)`, no overshoot |
| Press (OK down) | `scale(1.08 * 0.96)` for `90ms`, released on key-up |

Implementation is `.focusable` + `[data-focused="true"]` in `tokens.css`. The scale lives on the
element; the ring and glow live on `::after` with a pre-rendered `box-shadow` faded in via
`opacity`, so no shadow is ever interpolated.

**Invariants**

- Exactly one element in the document carries `[data-focused="true"]` at any instant.
- The browser's native outline is suppressed (`:focus, :focus-visible { outline: none }`) and
  fully replaced — the default 1-2px outline is invisible at 3 m.
- Focus never disappears. On BACK, on data load, on screen transition, the app must move focus
  to a defined target before the old one unmounts. If focus is ever lost, restore it to the
  first focusable element of the current screen.
- Scroll containers get `padding: 24px; margin: -24px` so the scaled tile plus its ring is never
  clipped by `overflow: hidden`.
- Focus scale is *decorative overflow only*: an element must be fully readable at scale 1.0. Never
  encode information (a hidden label, a revealed button) that only exists in the focused state
  without also having a non-motion cue.

---

## 3. Component specs

### 3.1 Content card — album / playlist tile

| | Value |
|---|---|
| Art | 288 x 288, `--radius-md` (12px), `object-fit: cover` |
| Label block | 72px tall, starts 12px below the art |
| Title | 28px / `--fw-medium` / `--text-primary`, 1 line, ellipsis |
| Subtitle | 24px / `--fw-regular` / `--text-secondary`, 1 line, ellipsis |
| Total footprint | 288 x 372 |
| Gap to next tile | 32px |

**Unfocused:** art on `--surface-2` placeholder, `--elev-1`, `--rim-light` on the art, subtitle
in `--text-secondary`.

**Focused:** `scale(1.08)` -> visual 311 x 402; white 4px ring at 4px offset around the *whole
tile* (art + label block), artwork glow, elevation cross-fades to `--elev-3`, subtitle lifts to
`--text-primary`. If the title is truncated, a marquee starts after a **600ms dwell** and runs as
`transform: translateX()` only, 60px/s, 1200ms pause at each end; it stops immediately on blur.

**Active / playing:** a 4px `--art-accent` bar across the bottom of the art plus a 40px equaliser
glyph top-left on a `--surface-scrim` chip. Colour is never the only marker — the glyph carries it
for colour-blind viewers.

**At the row edges:** the first tile's left edge sits at the safe-area left (96px). When focused it
grows 11.5px left and the ring adds 8px, ending 76px from the panel edge — inside the crop margin
and safe. Same mirrored on the right. There are no scroll arrows (nothing can click them).

### 3.2 Horizontal shelf / row

| | Value |
|---|---|
| Header height | 56px — 36px title at safe-x, optional 20px `--text-tertiary` count on the right |
| Header -> strip gap | 16px |
| Strip height | 372px |
| Shelf block | 444px + 48px bottom gap = **492px** pitch |
| Visible tiles | 5 full (5 x 288 + 4 x 32 = 1568px) + a 160px peek of the 6th |

The 160px peek is deliberate: it is the only cue that the row continues, since there are no
scrollbars or arrows on a TV.

**Scrolling behaviour (lazy scroll):** focusing tiles 0, 1 and 2 does not move the strip. From
index 3 onward the strip translates to `-(i - 2) * 320px` so the focused tile settles in the
third slot, `transform: translateX()`, 260ms, `--ease-in-out`. This keeps context on both sides
instead of pinning focus to the left edge.

**Edge masks:** a 96px `linear-gradient` to `--surface-0` on the right while more content exists,
and on the left once `translateX < 0`. Masks are static background layers whose `opacity` is
toggled — never animated width.

**End of row:** pressing RIGHT on the last tile does nothing visible except a 90ms
`translateX(-16px)` nudge-and-return on the strip, which tells the user "this is the end" without
moving focus. LEFT on the first tile does the mirror.

**Empty shelf:** the shelf is removed from the DOM entirely. A visible-but-empty row is a focus
trap.

### 3.3 Top nav

| | Value |
|---|---|
| Height | 96px, full-bleed `--surface-1`, 1px `--surface-hairline` bottom border |
| Items | Home / Listen Now / Browse / Library / Search |
| Item | 64px tall pill, padding 0 32px, 32px `--fw-medium` label, 32px gap |
| Inactive | `--text-secondary` |
| Active | `--surface-3` pill fill + `--text-primary` + a 4px `--accent-500` bar on the pill's bottom edge |
| Right cluster | 24px `--text-tertiary` clock, 56px round avatar, 32px from safe-x right |
| Focused | `data-size="sm"` -> `scale(1.12)`, white ring, glow, `--elev-2` |

Active state uses fill **and** a bar, so it is distinguishable from focus (ring + scale) at a
glance. Both can be present at once: the active tab, when focused, shows the accent bar inside a
white ring.

**Behaviour:** UP from the first shelf moves focus into the nav. When the user scrolls past shelf
one, the nav collapses with `transform: translateY(-96px)` + `opacity: 0` over 260ms to give
content room, and returns whenever focus reaches shelf one again. It never collapses while it
holds focus.

### 3.4 Now-playing bar (persistent, on Home / Library / Search)

| | Value |
|---|---|
| Footprint | 1728 x 128, anchored at the bottom of the safe area |
| Surface | `--surface-3`, `--radius-lg` (16px), `--elev-3` |
| Progress | 4px bar flush along the bar's top edge, `--art-accent` fill on `--surface-4` track, scaled with `transform: scaleX()` — never animated width |
| Artwork | 96px square, `--radius-sm`, 16px inset |
| Text | 24px gap after art: title 28px `--text-primary`, artist 24px `--text-secondary` |
| Mini transport | 3 x 64px round buttons (prev / play-pause / next), 24px gap, 32px from the right edge |
| Focus | The bar is a single `data-size="lg"` target -> `scale(1.02)` + ring. OK opens full Now Playing |

Inside the bar, LEFT/RIGHT moves between the three mini transport buttons once the bar has focus;
UP returns to the content shelves. Buffering replaces the progress fill with a 900ms
`translateX` shimmer band; the bar never changes height.

### 3.5 Transport controls (Now Playing screen)

Row of five, horizontally centred, 32px gaps, total 592px wide:

| Control | Size | Icon | Fill |
|---|---|---|---|
| Shuffle | 88px round | 40px | `--surface-3` |
| Previous | 88px round | 40px | `--surface-3` |
| **Play / Pause** | 112px round | 48px | `--accent-500`, icon `--text-on-accent` |
| Next | 88px round | 40px | `--surface-3` |
| Repeat | 88px round | 40px | `--surface-3` |

**Focused:** `data-size="sm"` -> `scale(1.12)`, white ring, artwork glow, `--elev-2`.
**Toggled on (shuffle / repeat):** fill becomes `--accent-tint-12`, icon becomes `--accent-300`,
**and** a 8px dot appears 8px under the button. The dot is what makes the state readable without
colour. Repeat-one additionally shows a "1" badge.
**Disabled** (e.g. Previous on the first track of a queue): `opacity: 0.4`, icon
`--text-disabled`, and the control is **removed from the D-pad order** — the D-pad skips straight
over it rather than parking focus somewhere that does nothing.
**Default focus on entering Now Playing:** Play/Pause.

The seek bar above the controls is 1728 x 8px, `--radius-pill`, with a 24px round knob that
appears only when the bar is focused. Focused seek bar: LEFT/RIGHT scrubs in 10s steps
(hold = 30s steps after 1s), OK commits, BACK cancels and restores the previous position.
Timecodes sit at both ends, 24px `--font-num`, tabular.

### 3.6 QR pairing screen

| | Value |
|---|---|
| Card | 896 x 704, centred, `--surface-1`, `--radius-xl` (24px), `--elev-3` |
| Background | `--art-bloom` at 40% opacity over `--surface-0` |
| Headline | 64px `--fw-semibold`, "Sign in to Apple Music", 64px from the card top |
| Body | 28px `--text-secondary`, max 2 lines, "Scan this code with your phone camera, or go to applemusic.link/tv" |
| QR plate | 464 x 464 **white** (`#FFFFFF`), `--radius-lg`, containing a 400 x 400 QR with a 32px quiet zone |
| Pair code | 44px `--font-num`, tabular, letter-spacing `0.12em`, e.g. `K7Q — 4M2` |
| Expiry | 24px `--text-tertiary`, "Code expires in 4:52", counts down once per second |
| Action | One pill button, 88px tall, padding 0 48px, 28px label, "Get a new code" |

The QR plate is white on purpose: phone scanners are far more reliable with a light quiet zone,
and it is the one place in this dark UI where a bright block is justified — it is small (24% of
the screen area) and it is the task.

**Only one focusable element exists on this screen** ("Get a new code"), and it holds focus from
mount. This is important: a D-pad user who mashes any direction must never end up with nothing
focused on the first screen they ever see.

**Expired state:** the QR plate dims to 30% opacity, a 44px `--warning` "Code expired" label
overlays it, the countdown is replaced by "Press OK to get a new code", and the button label
changes to "Get a new code". Nothing moves; the change is opacity plus text.

### 3.7 Loading / skeleton

Skeletons are **shape-matched** to the content they replace — same dimensions, same radii, so
nothing reflows when the real data lands.

| | Value |
|---|---|
| Block fill | `--surface-2` |
| Shimmer | A gradient band at 8% white, translated across the block with `transform: translateX(-100% -> 200%)`, 900ms (`--dur-ambient`), `linear`, infinite |
| Home skeleton | 3 shelves x 6 tiles (288 x 288 art block + 20px title bar at 60% width + 16px subtitle bar at 40% width) |
| List skeleton | 8 rows of 96px |
| Minimum display | 400ms — if data arrives sooner, hold the skeleton to that floor so it does not flash |
| Timeout | 10s -> switch to the error state |

**Focus during loading:** skeletons are **not** focusable. Focus stays where it was; if the
screen is new, focus parks on the nav until the first real shelf mounts, then moves to shelf 1
tile 0. Never let focus land on a skeleton — it can be pressed and does nothing.

In-control loading (a transport button awaiting the API) keeps the button focusable and swaps the
icon for a 40px spinner (`transform: rotate`, 900ms linear), with the button at `opacity: 0.7`.

### 3.8 Error state

Full-screen, centred in the safe area, max content width 896px:

| | Value |
|---|---|
| Icon | 96px, `--danger` |
| Title | 44px `--fw-semibold` `--text-primary`, 32px below the icon, max 1 line |
| Body | 28px `--text-secondary`, `--lh-body`, max 2 lines, 24px below the title |
| Detail | 20px `--text-tertiary` error code, 16px below the body — for support, not for users |
| Buttons | 88px tall, padding 0 48px, 28px label, 32px gap, 48px below the body |
| Primary | "Try again" — `--accent-500` fill, `--text-on-accent` label, **focused on mount** |
| Secondary | "Back" — `--surface-3` fill, `--text-primary` label |

Inline (non-fatal) errors — one shelf failed while the rest of Home loaded — replace only that
shelf with a 372px-tall `--surface-1` panel carrying a 28px message and a focusable "Retry" pill.
Never blank a whole screen for a partial failure.

---

## 4. Component-state matrix

`—` = state does not apply to that component.

| Component | Default | Focused | Active / Selected | Disabled | Loading |
|---|---|---|---|---|---|
| **Content card** | `--surface-2`, `--elev-1`, subtitle `--text-secondary` | `scale(1.08)`, 4px white ring @4px, art glow, `--elev-3`, subtitle -> primary, marquee after 600ms | 4px `--art-accent` bar on the art + equaliser glyph chip | `opacity: 0.4`, skipped in D-pad order | Shape-matched skeleton, not focusable |
| **Shelf** | 5 tiles + 160px peek, right mask | (focus lives on a tile, not the shelf) | Strip translated, both masks visible | — | 6 skeleton tiles |
| **Nav item** | `--text-secondary` | `scale(1.12)`, ring, glow, `--elev-2` | `--surface-3` pill + `--text-primary` + 4px accent bar | `opacity: 0.4`, skipped | — |
| **Now-playing bar** | `--surface-3`, `--elev-3` | `scale(1.02)`, ring, glow | Progress fill advancing (`scaleX`) | Hidden entirely when the queue is empty | Progress track shows a 900ms shimmer band |
| **Transport button** | `--surface-3`, icon `--text-primary` | `scale(1.12)`, ring, glow, `--elev-2` | Pressed: `scale(1.12 * 0.96)` 90ms. Toggled: `--accent-tint-12` + `--accent-300` icon + 8px dot | `opacity: 0.4`, icon `--text-disabled`, skipped in D-pad order | Icon -> 40px rotating spinner, button `opacity: 0.7`, stays focusable |
| **Play / Pause** | `--accent-500` fill, white icon | `scale(1.12)`, ring, glow, `--elev-3` | Icon swaps play <-> pause (no colour change) | Only when no queue exists: `opacity: 0.4` | Spinner replaces the icon |
| **Seek bar** | 8px track `--surface-4`, `--art-accent` fill | Ring around the track, 24px knob appears | Scrubbing: knob at `scale(1.2)`, time label above | `opacity: 0.4` for live streams | Indeterminate shimmer across the track |
| **Pill button** | `--surface-3` / accent fill for primary | `scale(1.12)`, ring, glow, `--elev-2` | `--accent-600` fill for 90ms on OK | `opacity: 0.4`, skipped | Label -> spinner, width unchanged (reserve the width) |
| **List row** | `--surface-1`, hairline separator | `scale(1.02)`, ring, `--surface-2` fill, `--elev-2` | `--accent-tint-12` wash + equaliser glyph | `opacity: 0.4`, skipped | 96px skeleton row |
| **QR plate** | White plate, live code, countdown | (not focusable) | — | Expired: 30% opacity + "Code expired" overlay | Plate at `--surface-2` with shimmer while the code is fetched |

---

## 5. Screen wireframes

All wireframes are drawn at a proportional 16:9 (94 columns x 25 rows of interior, character cells
counted as 1:2). `[ ]` marks a focusable element; `[[ ]]` marks the element that currently holds
focus. The dotted rectangle is the 5% overscan safe area.

### (a) QR Login

```
+----------------------------------------------------------------------------------------------    +
|                            <- 96px overscan margin (nothing here) ->                             |
|   ..........................................................................................     |
|   :                                                                                        :     |
|   :                                                                                        :     |
|   :                    +--------------------------------------------+                      :     |
|   :                    |                                            |                      :     |
|   :                    |          Sign in to Apple Music            |   <- 64px display    :     |
|   :                    |                                            |                      :     |
|   :                    |   Scan this code with your phone camera,   |   <- 28px body       :     |
|   :                    |   or visit applemusic.link/tv              |                      :     |
|   :                    |                                            |                      :     |
|   :                    |          +======================+          |                      :     |
|   :                    |          | # ##  #   ####  # ## |          |   <- 400px QR on a   :     |
|   :                    |          |  #  ####  #  # ##  # |          |      464px WHITE     :     |
|   :                    |          | ###  #  ###   #  ### |          |      plate           :     |
|   :                    |          | #  ## ##   ## ###  # |          |                      :     |
|   :                    |          +======================+          |                      :     |
|   :                    |                                            |                      :     |
|   :                    |               K7Q - 4M2                    |   <- 44px mono       :     |
|   :                    |            Code expires in 4:52            |   <- 24px tertiary   :     |
|   :                    |                                            |                      :     |
|   :                    |          [[  Get a new code  ]]            |   <- only focusable  :     |
|   :                    |                                            |                      :     |
|   :                    +--------------------------------------------+                      :     |
|   :                                                                                        :     |
|   ..........................................................................................     |
|                                                                                                  |
+-----------------------------------------------------------------------------------------------   +
```

### (b) Home with shelves

```
+-----------------------------------------------------------------------------------------------   +
|   ..........................................................................................     |
|   : [ Home ] [ Listen Now ] [ Browse ] [ Library ] [ Search ]            21:04   ( av ) :        |
|   :---------------------------------------------------------------------------------------:      |
|   :  Recently Played                                                          12 albums   :      |
|   :  +----------+  +==========+  +----------+  +----------+  +----------+  +-----          :     |
|   :  |          |  ||        ||  |          |  |          |  |          |  |               :     |
|   :  |   art    |  || FOCUS  ||  |   art    |  |   art    |  |   art    |  | pee           :     |
|   :  |  288px   |  || 1.08x  ||  |          |  |          |  |          |  | 160           :     |
|   :  +----------+  +==========+  +----------+  +----------+  +----------+  +-----          :     |
|   :  Album Title    Album Title   Album Title   Album Title   Album Title   Albu           :     |
|   :  Artist         Artist        Artist        Artist        Artist        Arti           :     |
|   :                                                                                        :     |
|   :  Made For You                                                                          :     |
|   :  +----------+  +----------+  +----------+  +----------+  +----------+  +-----          :     |
|   :  |          |  |          |  |          |  |          |  |          |  |               :     |
|   :  |   art    |  |   art    |  |   art    |  |   art    |  |   art    |  | pee           :     |
|   :  |          |  |          |  |          |  |          |  |          |  |               :     |
|   :  +----------+  +----------+  +----------+  +----------+  +----------+  +-----          :     |
|   :  Playlist       Playlist      Playlist      Playlist      Playlist      Play           :     |
|   :  Apple Music    Apple Music   Apple Music   Apple Music   Apple Music   Appl           :     |
|   :                                                                                        :     |
|   :  +------------------------------------------------------------------------------+      :     |
|   :  |####----------------------------------------------------------- progress 4px  |      :     |
|   :  | [art]  Track Title                          [ |< ]  [ > ]  [ >| ]            |      :     |
|   :  |  96    Artist - Album                                    now-playing 128px   |      :     |
|   :  +------------------------------------------------------------------------------+      :     |
|   ..........................................................................................     |
+-----------------------------------------------------------------------------------------------   +
```

### (c) Now Playing

```
+-----------------------------------------------------------------------------------------------   +
|      background: --art-bloom radial gradient, artwork blurred at 8% opacity, full bleed          |
|   ..........................................................................................     |
|   :                                                                                        :     |
|   :        +--------------------------+                                                    :     |
|   :        |                          |     Track Title Goes Here                          :     |
|   :        |                          |     <- 64px display, 2 lines max                   :     |
|   :        |      ALBUM ART           |                                                    :     |
|   :        |       560 x 560          |     Artist Name                                    :     |
|   :        |       radius 16          |     <- 36px title, --text-secondary                :     |
|   :        |                          |                                                    :     |
|   :        |                          |     Album Name - 2024                              :     |
|   :        |                          |     <- 24px body, --text-tertiary                  :     |
|   :        +--------------------------+                                                    :     |
|   :                                                                                        :     |
|   :   1:24  #################-------------------------------------------------  3:47      :      |
|   :         ^ seek bar 8px, --art-accent fill, 24px knob when focused                       :    |
|   :                                                                                        :     |
|   :                     ( X )   ( |< )  (( |> ))   ( >| )   ( CO )                          :    |
|   :                    shuffle   prev    PLAY       next    repeat                          :    |
|   :                      88       88     112 px      88       88                            :    |
|   :                                     FOCUSED                                             :    |
|   :                                                                                        :     |
|   :   Up Next:  Next Track - Artist                                                         :    |
|   :   <- 24px --text-secondary, press DOWN to open the queue                                 :   |
|   :                                                                                        :     |
|   ..........................................................................................     |
+-----------------------------------------------------------------------------------------------   +
```

### (d) Library

```
+-----------------------------------------------------------------------------------------------   +
|   ..........................................................................................     |
|   : [ Home ] [ Listen Now ] [ Browse ] [[ Library ]] [ Search ]          21:07   ( av ) :        |
|   :---------------------------------------------------------------------------------------:      |
|   :  Your Library                             <- 44px title-lg                            :      |
|   :                                                                                        :     |
|   :  +------------------+   +------------------------------------------------------------+ :     |
|   :  | [ Playlists    ] |   |  #  Title                     Artist            Album  Time | :    |
|   :  | [ Artists      ] |   | --------------------------------------------------------- | :      |
|   :  | [ Albums       ] |   |  1  Track name here           Artist Name       Album  3:47| :     |
|   :  | [ Songs        ] |   | ========================================================== | :     |
|   :  | [ Downloaded   ] |   |  2  FOCUSED ROW 1.02x + ring  Artist Name       Album  4:02| :     |
|   :  |                  |   | ========================================================== | :     |
|   :  | 360px sidebar    |   |  3  Track name here           Artist Name       Album  2:55| :     |
|   :  | rows 96px tall   |   |  4  Track name here           Artist Name       Album  5:10| :     |
|   :  |                  |   |  5  Track name here           Artist Name       Album  3:21| :     |
|   :  | LEFT/RIGHT moves |   |  6  Track name here           Artist Name       Album  4:44| :     |
|   :  | between sidebar  |   |  7  Track name here           Artist Name       Album  3:09| :     |
|   :  | and list         |   |  8  Track name here           Artist Name       Album  3:58| :     |
|   :  +------------------+   +------------------------------------------------------------+ :     |
|   :                                                                                        :     |
|   :  +------------------------------------------------------------------------------+      :     |
|   :  |####--------------------------------------------------------------------------|      :     |
|   :  | [art]  Track Title                          [ |< ]  [ > ]  [ >| ]            |      :     |
|   :  |        Artist - Album                                                        |      :     |
|   :  +------------------------------------------------------------------------------+      :     |
|   ..........................................................................................     |
+-----------------------------------------------------------------------------------------------   +
```

### (e) Search

```
+-----------------------------------------------------------------------------------------------   +
|   ..........................................................................................     |
|   : [ Home ] [ Listen Now ] [ Browse ] [ Library ] [[ Search ]]          21:11   ( av ) :        |
|   :---------------------------------------------------------------------------------------:      |
|   :  +-------------------------------+   Results for "radio"                              :      |
|   :  | [ Q ]  radio_                 |                                                     :     |
|   :  | 96px input, 28px text         |   Top Result                                        :     |
|   :  +-------------------------------+   +----------+  +----------+  +----------+          :     |
|   :  +---+---+---+---+---+---+---+---+   |          |  |          |  |          |          :     |
|   :  | A | B | C | D | E | F | G | H |   |   art    |  |   art    |  |   art    |          :     |
|   :  +---+---+---+---+---+---+---+---+   |          |  |          |  |          |          :     |
|   :  | I | J | K | L | M | N | O | P |   +----------+  +----------+  +----------+          :     |
|   :  +---+---+---+---+---+---+---+---+   Album         Album         Album                 :     |
|   :  | Q | R | S | T | U | V | W | X |   Artist        Artist        Artist                 :    |
|   :  +---+---+---+---+---+---+---+---+                                                     :     |
|   :  | Y | Z | 0 | 1 | 2 | 3 | 4 | 5 |   Songs                                             :     |
|   :  +---+---+---+---+---+---+---+---+   +----------------------------------------------+  :     |
|   :  | 6 | 7 | 8 | 9 |SPC| <-|CLR|MIC|   |  Track name              Artist        3:47  |  :     |
|   :  +---+---+---+---+---+---+---+---+   +----------------------------------------------+  :     |
|   :   on-screen keyboard, 88px keys       |  Track name              Artist        4:02  |  :    |
|   :   32px gaps, focus = 1.12x + ring     +----------------------------------------------+  :    |
|   :                                                                                        :     |
|   :  RIGHT from the last key column jumps to the results; LEFT returns to the keyboard.     :    |
|   ..........................................................................................     |
+-----------------------------------------------------------------------------------------------   +
```

**Search navigation note:** the keyboard occupies the left 640px, results the right 1056px with a
32px gutter. Results update 300ms after the last keypress. If focus is in the results and the
result set changes, focus moves to the first result rather than being dropped.

---

## 6. Accessibility

### 6.1 Contrast (WCAG 2.2, measured against `--surface-0 #0B0B10`)

| Pair | Ratio | Requirement | Verdict |
|---|---|---|---|
| `--text-primary #F5F6F8` | 18.1:1 | 4.5:1 | Pass AAA |
| `--text-secondary #B4B8C2` | 9.6:1 | 4.5:1 | Pass AAA |
| `--text-tertiary #8B909C` | 5.5:1 | 4.5:1 | Pass AA |
| `--accent-300 #FF8496` (accent text) | 7.1:1 | 4.5:1 | Pass AAA |
| `--accent-500 #FA2D48` (fill / large text) | 4.9:1 | 3:1 non-text, 3:1 large text | Pass |
| `--danger #FF6B5E` | 6.0:1 | 4.5:1 | Pass AA |
| `--success #3ED07A` | 9.4:1 | 4.5:1 | Pass AAA |
| `--warning #FFC24B` | 11.6:1 | 4.5:1 | Pass AAA |
| `--focus-ring #FFFFFF` vs any surface | 21:1 / >= 12:1 | 3:1 | Pass |
| `--text-on-accent #FFFFFF` on `--accent-500` | 4.3:1 | 3:1 large text | Pass (labels are 28px+) |

Worst realistic background is `--surface-2 #1E1E27`; every value above drops by roughly 1.3x
there and still clears its requirement (`--text-tertiary` becomes 4.3:1 and is therefore
restricted to 28px+ or non-essential text).

`--text-disabled #5A5F6B` at 2.6:1 is intentionally below AA. Disabled controls are additionally
removed from the D-pad order and carry `aria-disabled="true"`, and their state is never the only
carrier of information.

### 6.2 Never colour alone

Every state that could be signalled by colour also has a shape or motion channel:
"now playing" adds an equaliser glyph, shuffle/repeat-on adds a dot below the button,
active nav adds a filled pill and a bar, errors add an icon. Focus itself is scale + ring +
glow + elevation, four channels, with the ring deliberately neutral white so a red or pink
album cover can never wash it out via `--art-accent`.

### 6.3 Reduced motion

`prefers-reduced-motion: reduce` (Android TV surfaces this as **Settings > Accessibility >
Remove animations**) does the following, defined in `tokens.css`:

- All transitions and animations collapse to 1ms — the focus change becomes an instant state
  swap. The ring, glow and elevation **remain**; they are the affordance, not decoration.
- The focus scale step is reduced to `1.04` / `1.06`, because an instantaneous 8% jump is more
  startling than an animated one.
- Ambient motion is switched off entirely: the background bloom, the skeleton shimmer (skeletons
  become flat `--surface-2` blocks), the title marquee (titles simply stay truncated), and the
  `--art-accent` cross-fade (the colour swaps instantly).
- Shelf scrolling becomes an instant jump rather than a 260ms translate.

### 6.4 Focus and screen readers

- Exactly one `[data-focused="true"]` element at any instant; focus is never lost, and the app
  must define a focus target before unmounting the current one.
- Every focusable element is a real focusable DOM node with an accessible name; TalkBack on
  Android TV reads it on focus change.
- The now-playing region is `aria-live="polite"` so a track change is announced once, on the
  track title only — not on every progress tick.
- Countdown timers (the QR code expiry) are `aria-live="off"` and are duplicated by a static
  instruction, so nothing depends on hearing a per-second update.
- No content depends on a timeout under 20s except the QR pair code, which always offers an
  explicit "Get a new code" path and never expires the user out of the flow.

### 6.5 Text scaling

The UI scales with the viewport, not with a user font preference — TV browsers do not expose one.
To compensate, the app exposes a **Large text** setting that multiplies the root size:

```css
:root[data-ui-scale="large"]  { font-size: clamp(9px,  0.9583333vw, 46px); } /* 1.15x */
:root[data-ui-scale="xlarge"] { font-size: clamp(10px, 1.0833333vw, 52px); } /* 1.30x */
```

At 1.30x, body is 31px and display is 83px. Layouts must therefore tolerate one fewer tile per
shelf (4 + peek instead of 5 + peek) — shelves are `flex` with `overflow: hidden`, so this
happens automatically; do not hardcode a tile count anywhere in JS.
