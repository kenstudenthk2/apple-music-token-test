# Library V2 — "A Room With Your Records In It"

Audience: frontend + design. Companion stylesheet:
`public/tv/styles/library-v2.css`.

Owner verdict on V1: *"so boring, doesn't attract user use, nothing special at
all."* Now Playing V2 answered that for the player. This document answers it for
**the library and for the movement between screens**.

---

## 1. Design thesis

Your own library is the one screen in a music app where the content is *yours* —
so it should read as a collection of objects you own rather than a query result.
V1 renders a single square of art beside one undifferentiated column of names:
a playlist, an album and an artist all arrive as the same grey row, and the only
way to tell them apart is to read. V2 makes the library **a room with shelves in
it**: three horizontal rows of physical things, each kind with its own
unmistakable *silhouette* — a playlist is a **stack** of sleeves, an album is a
**sleeve with the record easing out of it**, an artist is a **circle**. You can
name what you are looking at from the sofa without reading a word. And nothing
teleports: the shelf you leave dims and stays where it was, the screen you open
arrives from the side it logically lives on, and the record slides a little
further out of its sleeve when you look at it. The feeling is *browsing*, not
*querying* — the small pleasure of running a finger along a shelf.

**One-line pitch:** we replaced a list of names with a shelf of objects, and
gave every movement a direction.

---

## 2. Wireframe — 1920 x 1080

```
+----------------------------------------------------------------------------------+
| ~~ static art wash, no drift (see section 9, rejection 5) ~~~~~~~~~~~~~~~~~~~~~~  |
| ~ +- - - - - - - - -  5% OVERSCAN SAFE AREA (96 x 54) - - - - - - - - - - - -+ ~  |
| ~ | AppleTune   Home   [Library]   Search   Settings         96px nav        | ~  |
| ~ |                                                                          | ~  |
| ~ | Your Library                                       44px  --+ 76px block   | ~  |
| ~ |                                                            +             | ~  |
| ~ | Playlists  6                                       36px shelf header      | ~  |
| ~ |  +------+#   +------+#   +------+#   +------+#   +------+#   +------+#   | ~  |
| ~ |  | art  |#   | art  |#   | art  |#   | art  |#   | art  |#   | art  |#   | ~  |
| ~ |  | 240sq|##  | 240sq|##  | 240sq|##  | 240sq|##  | 240sq|##  | 240sq|##  | ~  |
| ~ |  +------+##  +------+##  +------+##  +------+##  +------+##  +------+##  | ~  |
| ~ |   STACK = playlist  (two pre-painted plates behind, 8px + 16px offset)    | ~  |
| ~ |  Late Night     Road Trip     Sunday      Focus       Gym      Deep Cuts  | ~  |
| ~ |  24 songs       61 songs      18 songs    40 songs    32 songs  12 songs  | ~  |
| ~ |                                                        gap 48 <->         | ~  |
| ~ | Albums  14                                                                | ~  |
| ~ |  +------+\   +------+\   +------+\   +------+\   +------+\   +------+\    | ~  |
| ~ |  | art  | )  | art  | )  | art  | )  | art  | )  | art  | )  | art  | )   | ~  |
| ~ |  | 240sq| )  | 240sq| )  | 240sq| )  | 240sq| )  | 240sq| )  | 240sq| )   | ~  |
| ~ |  +------+/   +------+/   +------+/   +------+/   +------+/   +------+/    | ~  |
| ~ |   SLEEVE + DISC EDGE = album  (24px sliver at rest, 40px when focused)    | ~  |
| ~ |  -- this row is only PEEKING; it scrolls up when focus enters it --       | ~  |
| ~ |                                                                          | ~  |
| ~ |  (below the fold)  Artists  9      (o) (o) (o) (o)    CIRCLE = artist    | ~  |
| ~ |                                                                          | ~  |
| ~ | +----------------------------------------------------------------------+ | ~  |
| ~ | | [#]  Blue Monday                                       128px         | | ~  |
| ~ | |      New Order                                  .miniplayer          | | ~  |
| ~ | +----------------------------------------------------------------------+ | ~  |
| ~ +- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+ ~  |
+----------------------------------------------------------------------------------+
```

### Vertical budget @1080p

| Band | px | Running total from top |
|---|---|---|
| Overscan | 54 | 54 |
| `.nav` | 96 | 150 |
| `.library__head` (44px title + 32 margin) | 76 | 226 |
| `.shelves` viewport | **648** | 874 |
| gutter | 24 | 898 |
| `.miniplayer` | 128 | 1026 |
| Overscan | 54 | 1080 |

One **shelf unit** = header 56 + 16 + art 240 + label 72 = **384 px**;
shelf gap `--space-5` = 48. So 648 px shows shelf 1 complete (384) and
**216 px of shelf 2** — its header plus 144 px of artwork. That peek is the
whole point: it says *there is more down there* without a scrollbar, which a TV
does not have.

### Horizontal budget

`--lib-tile: 15rem` (240 px), gap `--space-5` (48 px).
6 x 240 + 5 x 48 = **1680** inside a 1728 px safe width, so a 7th tile peeks in
the 96 px right bleed. The 48 px gap (larger than the shelves' default 32 px)
is not cosmetic — it is the clearance the album disc needs when it slides out
under focus. See section 5.

### Type sizes (all >= 24 px @1080p)

| Element | Token | @1080p |
|---|---|---|
| `.library__title` | `--fs-title-lg` | 44 px |
| `.shelf__header` | `--fs-title` | 36 px |
| `.shelf__count` | `--fs-body` | 24 px |
| `.tile__title` | `--fs-body-lg` | 28 px |
| `.tile__subtitle` | `--fs-body` | 24 px |

---

## 3. Telling a playlist, an album and an artist apart at three metres

The rule is **silhouette first, colour second, text never**. At 3 m a 240 px
tile subtends about the same angle as a 90 px thumbnail at arm's length: shape
survives, 24 px type is legible but takes a beat, and colour differences on
arbitrary album art are unusable. So the differentiator has to be the outline.

| Kind | Silhouette | How it is built | Cost |
|---|---|---|---|
| **Playlist** | **A stack.** Two plates peeping out behind the sleeve at 8 px and 16 px down-right, stepping darker (`--surface-3`, `--surface-2`). Reads as "several things in a wrapper". | Three-value **static** `box-shadow` on `.tile__art` — no extra element, no extra layer. Never animated. | 0 elements, 0 layers |
| **Album** | **A sleeve with the record showing.** A vinyl disc, same diameter as the sleeve, sits behind the artwork and protrudes **24 px** past its right edge. A dark disc with two groove rings and one rim light. | `.tile__disc`, **NEW** element, one static background stack. Slides to 40 px when focused (transform only). | 1 element, 1 layer while focused |
| **Artist** | **A circle.** `border-radius: 50%` on the art, and no stack, no disc. | Pure radius, static. | 0 |

Three outlines — *lumpy square*, *square with a bite of circle on the right*,
*circle* — are distinguishable at a glance and stay distinguishable in
peripheral vision, which is where two of the three rows live at any moment.

**Artwork policy.** Only `data-kind="artist"` is circle-cropped, and only
artist *portraits* — Apple Music circle-crops artist images in its own clients.
Album and playlist artwork is shown **square, uncropped and undistorted**, at
full tile size, exactly as in Now Playing V2 section 4.5. Nothing is
composited: a playlist tile shows **one** artwork, and the "stack" behind it is
plain painted surface, never a second cover. A four-up artwork mosaic was
rejected — section 9.

**The disc is literally the same object as the player's.** `.tile__disc` is
painted from `--vinyl-edge` / `--vinyl-body` / `--vinyl-lift`, the material
tokens `now-playing-v2.css` already declares, with the same 38%/32% key-light
origin. Focus an album, see a sliver of record; press OK, see the whole record
on the turntable. One continuous product, at the cost of three `var()`
fallbacks.

Secondary confirmations, for the user who does look:
`.shelf__count` after each header ("Albums 14"), and a subtitle that differs by
kind — song count for a playlist, artist name for an album, the word "Artist"
for an artist.

---

## 4. The motion system

Every row animates **`transform` and/or `opacity` only.** No `width`,
`height`, `top`, `left`, `box-shadow`, `filter`, `background-color` or
`border-radius` is interpolated anywhere in this spec.

Principle references are to `docs/research/MOTION_RESEARCH.md` section 1:
**P1** frequency gates, **P2** never `ease-in` / under 300 ms,
**P3** physicality and origin, **P4** interruptibility, **P5** perceived
performance and stagger.

| # | Interaction | What moves | Transform / property | Duration | Easing | Principles |
|---|---|---|---|---|---|---|
| 1 | **Focus move within a row** | the newly focused tile | `translate3d(0,-0.75rem,0) scale(1.06)` | **160 ms** | `--ease-out` | P1 (hundreds/session, so the near-imperceptible tier), P4 (CSS **transition**, never keyframes) |
| 1b | | its focus ring `::after` | `opacity 0 -> 1`, **30 ms delay** | 180 ms | `--ease-out` | P3 settle — the tile arrives, the ring lands on it |
| 1c | | the outgoing tile | reverse of 1, no delay | 160 ms | `--ease-out` | P4 retargets mid-flight on a held D-pad |
| 1d | | `.shelf__row` when focus nears an end | `translate3d(X,0,0)`, X = -(index-1) x 288 px | **240 ms** | `--ease-in-out` | P2 (on-screen movement takes `ease-in-out`) |
| 2 | **Row change (Up / Down)** | `.shelves__track` | `translate3d(0,Y,0)`, Y = -(sum of shelf heights above) | **240 ms** | `--ease-in-out` | P2, P4 |
| 2b | | the shelf being left | `opacity 1 -> 0.5` | 200 ms | `--ease-out` | P5 — the eye is told where it *is not* |
| 2c | | the shelf being entered | `opacity 0.5 -> 1` | 200 ms | `--ease-out` | P5 |
| 3 | **Screen enter (forward)** | the arriving screen | `translate3d(3rem,0,0) -> 0` + `opacity 0 -> 1` | **280 ms** | `--ease-out` | P2 (under 300 ms, `ease-out` for entrances), P3 (never from nothing — no `scale(0)`) |
| 3b | | the screen being left | `scale(0.97)` + `opacity -> 0` | 240 ms | `--ease-out` | P3 — it recedes *behind*, it does not slide away; it is still there when you come back |
| 4 | **Screen exit (BACK)** | both screens | exactly 3 and 3b **mirrored**: arrival from `translate3d(-3rem,0,0)`, departure to `scale(0.97)` | 280 / 240 ms | `--ease-out` | P3 origin — going back must not look like going forward |
| 5 | **Opening a detail (OK on a tile)** | the tile | press dip `scale(1.06 x 0.96)` | **90 ms** | `--ease-out` | P3 causality |
| 5b | | the detail screen | per row 3, plus `.detail__art` `scale(1.03) -> 1` | 280 ms | `--ease-out` | P5 counter-scale stops a fade reading as a dissolve (research section 5, #7) |
| 6 | **Starting playback (OK on a track / play)** | `.miniplayer` | `translate3d(0,100%,0) -> 0` + `opacity` | **260 ms** | `--ease-out-soft` | P3 — 100% is *its own height*, so it is correct at any size |
| 6b | | `.miniplayer__art` | `scale(1.06) -> 1` | 300 ms | `--ease-out` | P5 |
| 6c | | the album disc, if the source tile is an album | slides to 40 px and stays | 160 ms | `--ease-out` | P3 causality — the record left the sleeve because you played it |
| 7 | **Shelf / list entry stagger** | each of the first 6 items | `translate3d(0,0.875rem,0) -> 0` + `opacity 0 -> 1` | **200 ms** | `--ease-out` | P5 (stagger 30–80 ms, never blocking) |

**No bounce, no overshoot, anywhere.** `tokens.css` section 12 bans spring
curves outright, and `MOTION_RESEARCH.md` section 6 lists bounce on focus
movement under "will look cheap" — a held D-pad repeat turns any overshoot into
a wobble.

**Everything in rows 1–2 is a CSS `transition`, not a `@keyframes` animation.**
This is P4 and it is the single most important line in this table: users *hold*
the D-pad. A transition retargets from the live presentation value; a keyframe
restarts from zero and the row visibly stutters behind the thumb. Only row 7
(a one-shot entry that can never be triggered rapidly) uses keyframes.

### On 160 ms for focus

`MOTION_RESEARCH.md` section 1 P2 argues 120–160 ms or the remote feels broken.
`tokens.css` section 12 argues that below ~140 ms the scale change reads as a
flicker on a 60 Hz panel with 2–3 frames of TV processing lag. The overlap is
**140–160 ms**, and 160 ms is the only value both documents endorse. It is
declared as `--dur-lib-focus`, not by editing `--dur-focus`, so nothing else in
the app changes.

---

## 5. Focus feel — exact numbers

**The focused item.**
`transform: translate3d(0, -0.75rem, 0) scale(1.06)` over 160 ms `--ease-out`,
`transform-origin: center bottom`. Bottom origin matters: the tile grows
*upward out of the shelf* rather than swelling in place, which is how an object
lifted off a shelf behaves. A 240 px tile at 1.06 grows 14.4 px, 7.2 px per
side, well inside the 48 px gap. Combined with the 12 px rise the focused tile
needs about 19 px of vertical clearance, which the shelf's 16 px art headroom
plus the 48 px shelf gap absorbs — nothing is ever clipped.

Scale is 1.06 rather than the token's 1.08 because the library tile is 240 px
where the home shelf tile is 288 px: 1.08 on 288 and 1.06 on 240 move the edge
by 11.5 px and 7.2 px respectively — the *pixel* delta is what the eye reads at
3 m, not the ratio, and 1.08 on a smaller tile over-reads as a pop.

**The ring.** `opacity 0 -> 1` over 180 ms with **30 ms delay**. That 30 ms is
the entire "settle" mechanism: the tile is already visibly moving when the ring
begins to appear, so the ring reads as landing on a moving object instead of
switching on. It is far too short to hurt the affordance — the ring is at 50%
opacity by 120 ms — and it costs nothing.

**Anticipation.** There is deliberately **none as a counter-move.** A tile that
dips before it rises would need `@keyframes`, and a keyframe on focus restarts
from zero on every held-D-pad repeat (P4). Anticipation is expressed instead by
the *easing asymmetry*: `--ease-out` = `cubic-bezier(0.20, 0, 0, 1)` puts most
of the travel in the first 40% of the duration, so the tile leaves hard and
arrives soft. That is the same perceptual read, and it is interruptible.

**The album disc.** `.tile__disc` rests at `translate3d(1.5rem,0,0)` (24 px
sliver) and moves to `translate3d(2.5rem,0,0)` (40 px) over 160 ms, sharing the
tile's transition. The 16 px delta clears the 2 px visibility floor at 3 m with
room to spare. Worst-case protrusion is 40 px + 7 px of scale growth = **47 px**
against a 48 px gap: it never touches its neighbour. This is why the library
row gap is `--space-5` and not the shelves' default `--space-4`.

**Neighbours.** They do **not** react individually. A per-neighbour scale would
need `:has(+ [data-focused])` (unverified support on the shipped Android TV
WebView) or a JS `data-adjacent` write on every D-pad press, and it would add
two animated layers to the most frequent interaction in the app — exactly what
P1 says not to do. Differentiation is achieved at **row** granularity instead:
the shelf containing focus sits at `opacity: 1`, every other shelf at
`opacity: 0.5`. One layer per shelf, only two of which ever change at once, and
the read at 3 m is stronger than a 2% neighbour scale would have been.

**The row as a whole.** `.shelf__row` translates horizontally only when the
focused index would otherwise leave the viewport: the row keeps the focused
tile between column 2 and column 5 and moves in whole tile-pitch steps of
288 px (240 tile + 48 gap), 240 ms `--ease-in-out`. `will-change: transform` is
set on `.shelf__row` **only while `data-moving="h"`** and removed on
`transitionend`, per the `tokens.css` VRAM rule.

---

## 6. Staggering

`.shelf__row > .tile[data-enter="1"]` and
`.list__rail > .list__track[data-enter="1"]` run a one-shot `lib-item-in`:

```
from  translate3d(0, 0.875rem, 0)  opacity 0
to    translate3d(0, 0, 0)         opacity 1
200ms  var(--ease-out)  both
animation-delay: calc(min(var(--i, 0), 5) * 60ms)
```

- **60 ms per item**, inside Emil's 30–80 ms band and at the slow end
  deliberately — see the layer arithmetic below.
- **Delay capped at index 5, so 300 ms.** Total worst-case entry = 300 + 200 =
  **500 ms**. A 200-item list therefore takes exactly as long to reveal as a
  6-item one.
- **Only the first two shelves** carry `data-enter`. Shelf 3 and below are off
  the fold; animating them buys nothing and costs layers.
- **JS writes `--i` once, at render.** It is read only by `animation-delay`,
  never by a transform — `MOTION_RESEARCH.md` section 6 warns that driving
  child transforms from a parent custom property recalculates styles for every
  child.
- **It never blocks input.** Item 0 has delay 0 and is fully painted at 200 ms;
  focus is placed on it on frame 1 and the ring shows immediately, independent
  of the entry animation. If the user presses Right at 80 ms the entry
  animations simply finish underneath the focus transition.

**Why 60 ms and not 45 ms.** Concurrency = duration / delay. At 200/60 = 3.3,
at most **4 items** are mid-animation at once. At 45 ms it would be 5, and with
the two screen layers also live during entry that is 7 — over budget. The
stagger interval is set by the layer budget, not by taste.

---

## 7. Long lists — 200+ items

Everything above is bounded by the *viewport*, not by the collection.

1. **Entry cost is constant.** Capped stagger (section 6) plus `data-enter` on
   the first 10 list rows only. Item 11 and item 200 both simply appear.
2. **Offscreen rows cost nothing.**
   `content-visibility: auto; contain-intrinsic-size: auto var(--list-row-h);`
   on `.list__track` lets the engine skip layout, paint and style for rows
   outside the viewport. This is not an animated property and does not touch the
   perf contract.
3. **Nothing is per-item and continuous.** No shimmer, no per-tile ambient, no
   marquee at rest. The only per-item motion in the entire library is the
   focused item, of which there is exactly one.
4. **The list moves as one layer.** `.list__rail` (**NEW** wrapper) translates
   with `translate3d(0, Y, 0)`; the rows inside do not move. `scrollTop` is
   never used — contract 3 in `public/tv/CLAUDE.md`.
5. **Rows never scale.** A full-width row scaled 6% pushes its own ends past the
   clip edge and slices off the track number and duration. Focus on a list row
   is a `--surface-2` fill (a static background swap, not a transition), a
   4 px accent bar faded in with `opacity`, and a **4 px `translate3d` nudge to
   the right** — the nudge is the only transform, and it is what makes list
   focus feel like it has weight where scale cannot be used.
6. **`will-change` is never set on a `.list__track`.** 200 promoted layers would
   exhaust TV VRAM long before anything moved. It is set on `.list__rail` alone,
   and only while moving.

---

## 8. Layer budget proof

Ceiling: **at most 6 concurrently animated compositor layers.**

**Worst moment A — vertical row change while an album tile takes focus.**

| # | Layer | Property | Live for |
|---|---|---|---|
| 1 | `.shelves__track` | `transform` | 240 ms |
| 2 | outgoing `.shelf` | `opacity` | 200 ms |
| 3 | incoming `.shelf` | `opacity` | 200 ms |
| 4 | newly focused `.tile` | `transform` | 160 ms |
| 5 | that tile's `::after` ring | `opacity` | 180 ms (+30 delay) |
| 6 | that tile's `.tile__disc` | `transform` | 160 ms |

**= 6, for at most 240 ms.** The *previously* focused tile would be a seventh.
It is not, because on a vertical move it lives in the outgoing shelf, which is
already being composited as a group by layer 2 — and the stylesheet cancels the
outgoing tile's own transform transition while `.shelves[data-moving="v"]`, so
its ring and transform snap inside that group rather than animating
independently. **6 is the hard ceiling and it is met, not exceeded.**

**Worst moment B — screen entry with stagger.**

| # | Layer | Live for |
|---|---|---|
| 1 | outgoing `.screen` (`transform` + `opacity`) | 240 ms |
| 2 | incoming `.screen` (`transform` + `opacity`) | 280 ms |
| 3–6 | at most 4 staggered items (section 6 arithmetic) | 200 ms each |

**= 6.** This is why the stagger interval is 60 ms.

**Horizontal move within a row.** `.shelf__row` transform + focused tile
transform + its ring + its disc + outgoing tile transform = **5**. No shelf
opacity changes, because focus never leaves the row
(`data-focus-contain="x"`).

**Steady state — nothing moving. 0 layers.** The library has no ambient motion
at all; see section 9, rejection 5. The screen is genuinely idle between
keypresses, which is the whole reason the budget survives a D-pad held down.

---

## 9. Deliberately rejected

**1. A four-up artwork mosaic on playlist tiles.**
Rejected. It composites four artworks into a single graphic, which is exactly
what Apple's Identity Guidelines exist to prevent, and it costs four image
decodes per tile — 24 decodes for one visible row, before the user has pressed
anything. The stack silhouette communicates "a collection of things" with three
static box-shadow values and zero decodes.

**2. A hero panel that cross-fades the focused item's artwork behind the shelf.**
Rejected. Beautiful in a mock, ruinous in practice: it fires on *every* D-pad
press — the highest-frequency event in the app, which P1 puts in the
"near-imperceptible or nothing" tier — and each fire is a full-bleed image
decode plus two full-screen layers. Holding Right for two seconds would queue a
dozen decodes on a TV SoC. The tile itself is already the artwork, at 240 px,
which is legible at 3 m.

**3. A cover-flow / perspective carousel.**
Rejected. `rotateY` per tile is technically transform-only and therefore legal,
but it promotes every visible tile to its own layer (6+ before anything else
moves), forces re-rasterisation at a varying effective scale on a weak GPU, and
foreshortens album artwork — an Identity Guidelines problem, the same one that
killed the perspective tilt in Now Playing V2 section 7.4. Flat and correct
beats tilted and wrong.

**4. Spring / bounce on focus, and per-neighbour reaction.**
Rejected twice over. Bounce needs `@keyframes` or a spring curve; both restart
from zero on a held D-pad repeat and turn the row into a wobble (P4, and
`tokens.css` section 12 bans spring curves outright). Per-neighbour scale needs
either `:has(+ ...)` with unverified WebView support or a JS write on every
keypress, and adds two layers to the most frequent interaction in the product.

**5. An ambient drifting bloom on the Library, like Now Playing's.**
Rejected, and this is a *design* decision as much as a budget one. Budget: the
bloom would be a permanently live seventh layer at both worst moments in
section 8. Design: Now Playing is a screen you *watch*, so it earns ambience;
Library is a screen you *operate*, and per P1 the delight budget belongs where
the frequency is low. The library gets a **static** art wash instead — same
warmth, zero frames. It also means the library sits at 0 animated layers
between keypresses, which is what lets a held D-pad stay at 60 fps.

**6. An A–Z fast-scroll rail down the side.**
Rejected for this pass. It introduces a second focusable column beside the
rows, which either breaks `data-focus-contain="x"` (Right from the last tile
would have to escape the row) or requires a modal focus mode with its own BACK
semantics. A real answer for very large libraries, but it belongs in
`NAVIGATION_MODEL.md` with its own gate, not smuggled in with a restyle.

**7. Per-tile shimmer / sheen sweep on focus.**
Rejected on frequency, not on cost. One extra `translateX` layer is affordable;
firing a decorative sweep hundreds of times per session is precisely the
"delight in the wrong tier" mistake P1 warns about. The sheen idea is kept in
reserve for the miniplayer artwork on playback start (section 4, row 6), which
happens once every few minutes.

---

## 10. Markup the developer must add

`NEW` marks a new element. Every existing class name is preserved so
`library-v2.css` can be swapped in beside `app.css`.

```html
<div class="app" data-nav="forward">            <!-- NEW attr: forward | back -->
  <section class="screen" data-screen="library">
    <div class="screen__body">
      <nav class="nav" data-focus-group="nav-library"> ... </nav>

      <div class="library__head">               <!-- NEW -->
        <h1 class="library__title">Your Library</h1>
      </div>

      <div class="shelves" data-moving="none">  <!-- NEW attr: none | v | h -->
        <div class="shelves__track">
          <section class="shelf" data-kind="playlist" data-active="true">
            <header class="shelf__header">
              Playlists <span class="shelf__count">6</span>   <!-- NEW span -->
            </header>
            <div class="shelf__viewport">
              <div class="shelf__row" data-focus-contain="x">
                <div class="tile focusable" data-focusable
                     data-kind="playlist" data-enter="1" style="--i:0">
                  <div class="tile__art"><img alt=""></div>
                  <div class="tile__label">
                    <div class="tile__title">Late Night</div>
                    <div class="tile__subtitle">24 songs</div>
                  </div>
                </div>
                ...
              </div>
            </div>
          </section>

          <section class="shelf" data-kind="album">
            ...
              <div class="tile focusable" data-focusable
                   data-kind="album" style="--i:0">
                <span class="tile__disc"></span>   <!-- NEW: album only -->
                <div class="tile__art"><img alt=""></div>
                <div class="tile__label"> ... </div>
              </div>
            ...
          </section>

          <section class="shelf" data-kind="artist"> ... </section>
        </div>
      </div>

      <div class="miniplayer" data-visible="true"> ... </div>
    </div>
  </section>
</div>
```

Detail screen, long lists:

```html
<div class="list" data-focus-group="library-list">
  <div class="list__rail">                       <!-- NEW: the moving layer -->
    <div class="list__track focusable" data-focusable
         data-enter="1" style="--i:0"> ... </div>
    ...
  </div>
</div>
```

### Custom properties JS writes

| Property | On | Value | Written |
|---|---|---|---|
| `--i` | each `.tile` / `.list__track` | integer index | **once**, at render |
| `--shelf-y` | `.shelves__track` | e.g. `-24rem` | on row change |
| `--row-x` | each `.shelf__row` | e.g. `-36rem` | on horizontal move |
| `--list-y` | `.list__rail` | e.g. `-18rem` | on list move |
| `--art-accent` | `.screen[data-screen="library"]` | colour from `Artwork.bgColor` | on selection change, at most 1/s |

`--shelf-y`, `--row-x` and `--list-y` are each read by **one** element's own
`transform`. None is read by a child — the per-child style-recalc trap in
`MOTION_RESEARCH.md` section 6 is avoided.

### Attributes JS writes

| Attribute | On | Values | Purpose |
|---|---|---|---|
| `data-nav` | `.app` | `forward` \| `back` | which direction screens travel; set **before** flipping `data-active` |
| `data-entering` | the arriving `.screen` | `true` | set for one frame **before** `data-active` flips, removed on `transitionend`. Both screens are momentarily `:not([data-active])`, so this is the only way CSS can tell *arriving* from *receding* |
| `data-moving` | `.list` | `true` \| absent | gates `will-change` on `.list__rail` |
| `data-moving` | `.shelves` | `none` \| `v` \| `h` | gates `will-change`, and cancels the outgoing tile's transform during a vertical move (section 8) |
| `data-active` | `.shelf` | `true` \| absent | which shelf holds focus |
| `data-enter` | first 6 tiles / first 10 rows | `1` | opts an item into the stagger |
| `data-kind` | `.tile`, `.shelf` | `playlist` \| `album` \| `artist` | silhouette |

`data-moving` must be reset to `none` on `transitionend`, which is also what
drops `will-change`.

---

## 11. `prefers-reduced-motion: reduce`

`tokens.css` section 16 already collapses every duration to 1 ms. Three things
it does **not** do, which `library-v2.css` adds explicitly:

1. **Zeroes `animation-delay`.** The global rule shortens durations but leaves
   delays intact, so a 300 ms staggered cascade would survive as a 300 ms
   *wait* with no motion — worse than either alternative. All entry delays go
   to 0 and the stagger disappears.
2. **Disables the decorative transforms outright**, rather than making them
   instant: the focused tile's 12 px rise and the album disc's slide-out are
   removed. What remains is the ring, the fill and a reduced `scale(1.04)` —
   the affordance, per the tokens' stated intent.
3. **Screens stop travelling sideways.** `data-nav` direction is ignored;
   screens simply become visible. Directionality is a nicety; a 3 rem instant
   jump is not.

The `.shelves__track`, `.shelf__row` and `.list__rail` transforms are **kept as
instant jumps**, not removed: their position is *information* — which part of a
long collection you are looking at — and reduced-motion is a comfort preference,
not a request to stop navigating.
