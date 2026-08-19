# Now Playing V2 — "The Record Is Actually Playing"

Owner verdict on V1: *"so boring, doesn't attract user use, nothing special at all."*
This document is the replacement spec. Companion stylesheet:
`public/tv/styles/now-playing-v2.css`.

---

## 1. Design thesis

A television playing music is a stereo, not a browser tab — so this screen should
behave like a beautiful object in the room rather than a page about a song. The
record slides out of its sleeve, the platter spins up under torque, the tonearm
drops onto the lead-in groove and then creeps inward across the side for the
whole track, and a fixed specular bar in the "room" catches the grooves as they
pass beneath it. Nothing here is decoration: every moving thing is reporting real
playback state, so the screen is *legible from the sofa without reading a word* —
you can tell at a glance whether it is playing, how far in you are and how much
is left, purely from where the arm sits. The feeling we are after is the small,
specific pleasure of watching a record go round: mechanical, warm, slightly
hypnotic. That is the thing someone shows a friend.

**One-line pitch:** we replaced a spinning square with a turntable.

### Why V1 failed, mechanically

The V1 disc drew its grooves with `repeating-radial-gradient`. **Concentric
circles are rotationally symmetric** — rotating them produces literally zero
visual change. The only pixels that actually moved were the circular label. So
the "rotating vinyl" was, on a 544px disc, a 305px album thumbnail turning slowly
inside a static grey ring. It read as a spinning square because nothing about it
read as vinyl.

Every fix in V2 follows from that diagnosis: **the disc needs rotationally
*asymmetric* detail, or the rotation is invisible.**

---

## 2. Wireframe — 1920 x 1080

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ░░ .now__bloom — art-accent wash, bleeds past the frame, drifts 24s ░░░░░░░░░░  │
│ ░ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─  5% OVERSCAN SAFE AREA (96 x 54) ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ ░░  │
│ ░ │                                                       ╭── tonearm    │ ░░  │
│ ░ │                                            ╭───────╮ ═╯  pivot       │ ░░  │
│ ░ │  ┌──────────────┬ ─ ─ ─ ─ ─ ─ ┐         ╭──┤ label ├──╮              │ ░░  │
│ ░ │  │              │ record edge │       ╭─┤  ╰───────╯  ├─╮            │ ░░  │
│ ░ │  │   .now__     │  emerging   │       │ │             │ │            │ ░░  │
│ ░ │  │   sleeve     │  from the   │     NOW PLAYING · APPLE MUSIC        │ ░░  │
│ ░ │  │              │   sleeve    │       │ ╰─────────────╯ │            │ ░░  │
│ ░ │  │ full square  │             │       │   .now__disc    │            │ ░░  │
│ ░ │  │ ARTWORK      │  ((( • )))  │      Blue Monday                     │ ░░  │
│ ░ │  │ uncropped    │  grooves +  │       ╰─────────────────╯            │ ░░  │
│ ░ │  │ 416 x 416    │  static     │      New Order                       │ ░░  │
│ ░ │  │              │  sheen bar  │      Power, Corruption & Lies        │ ░░  │
│ ░ │  └──────────────┴ ─ ─ ─ ─ ─ ─ ┘         544 dia.                     │ ░░  │
│ ░ │  ◀─ 416 ─▶◀ overlap 45% ▶                                            │ ░░  │
│ ░ │  ◀──────────── .now__stage  715 ────────────▶◀ gap 96 ▶◀ meta 917 ─▶ │ ░░  │
│ ░ │                                                                      │ ░░  │
│ ░ │  1:24 ▐███████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▌ -4:12     │ ░░  │
│ ░ │                                                                      │ ░░  │
│ ░ │                  ⏮ 88      ⏯ 112 (accent)      ⏭ 88                  │ ░░  │
│ ░ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ ░░  │
└────────────────────────────────────────────────────────────────────────────────┘
```

Grid (`.now__body`, inset `--safe-y + 1rem` / `--safe-x + 1rem` — the extra
`1rem` is the reserve the idle burn-in drift moves within, so nothing functional
ever leaves the 5% safe area):

| | col 1 (`auto`) | col 2 (`1fr`) |
|---|---|---|
| **row 1** `1fr` | `.now__stage` — sleeve + disc + tonearm | `.now__meta` |
| **row 2** `auto` | `.now__transport` — spans both columns ||

Column gap `--space-7` (96px). Row gap `--space-5` (48px).

### Type sizes (all ≥ 24px @1080p — the readability floor is honoured)

| Element | Token | @1080p |
|---|---|---|
| `.now__eyebrow` | `--fs-body`, caps, `--ls-caps` | 24px |
| `.now__title` | `--fs-display` | 64px |
| `.now__artist` | `--fs-title` | 36px |
| `.now__album` | `--fs-body-lg` | 28px |
| `.now__scrub` timecodes | `--fs-body`, tabular | 24px |
| `.now__label-line` | `--fs-caption` (**decorative duplicate only**) | 20px |

---

## 3. Layer diagram and budget

Budget: **≤ 6 concurrently animated compositor layers.** Every entry below
animates `transform` and/or `opacity` **only**. No `width`, `height`, `top`,
`left`, `box-shadow`, `filter`, `background-color` or `border-radius` is ever
interpolated anywhere in this spec.

| # | Layer | Property animated | Duration / rate | Easing | Live when | Cost |
|---|---|---|---|---|---|---|
| 1 | `.now__bloom` | `transform` (scale+translate3d) + `opacity` | 24s cycle, alternate | `--ease-in-out` | screen active, **not** idle | 1 layer; full-bleed but painted once, GPU-only after |
| 2 | `.now__vinyl` | `transform: rotate` | **1.8s / rev**, infinite | `linear` | `data-state` = `playing` \| `stopping` | 1 layer, 544²; whole disc rasterizes **once** |
| 3 | `.now__platter` | `transform: rotate` | 1000ms spin-up / 1800ms brake | see §4.4 | only during those two transitions | 1 layer, wraps #2 |
| 4 | `.now__tonearm` | `transform: rotate` | 1400ms cue-in / 900ms cue-out / 400ms per tracking tick | `--ease-out-soft` | cue transitions + 1 tick/s | 1 layer, 359×26px — negligible |
| 5 | `.now__fill` | `transform: scaleX` | 150ms per 1s tick | `--ease-linear` | while playing | 1 layer, 1536×8px |
| 6 | `.focusable[data-focused]` + `::after` | `transform: scale`, `opacity` | 200ms | `--ease-out` | 200ms after each D-pad move | 2 tiny layers; only one element is ever focused |
| 7 | `.now__body` | `transform: translate3d` | 240s, alternate | `linear` | **idle only** | 1 layer; layers 1, 4, 6 are all off in idle |
| 8 | `.now__dim` | `opacity` | 400ms once, then static | `--ease-out-soft` | entering / leaving idle | transient |

### Proof of budget

- **Steady state, playing, untouched:** layers 1, 2, 5 → **3 concurrent.**
  Layer 5 only interpolates for 150ms out of every 1000ms, so the true
  continuous count is **2**.
- **Worst transient — user presses PLAY and immediately moves focus:**
  1 (bloom) + 2 (vinyl) + 3 (spin-up) + 4 (cue-in) + 5 (fill) + 6 (focus)
  = **6 concurrent, for ≤ 1.4s.** Exactly at budget, never over. Layer 3 retires
  at 1000ms and layer 6 at 200ms, so the 6-layer window is ~200ms wide.
- **Idle (5 min+):** layer 1 is `animation-play-state: paused` and faded,
  4 parks, 6 fades out, 5 keeps ticking, 7 starts → **3 concurrent** (2, 5, 7).
- **Paused:** layer 2 paused, 3 and 4 settled, 1 running → **1 concurrent.**

### Rasterization notes

`.now__vinyl` carries the disc body, the grooves, the lands and the swirl as one
element's **background stack**, so the SoC rasterizes 544² once and thereafter
only re-composites a rotated quad. The static sheen (`.now__sheen`) is a sibling
that **does not rotate**, so it never invalidates.

`will-change: transform` is declared **only** on `.now__vinyl`, `.now__platter`
and `.now__bloom`, and is dropped to `auto` on `.now[data-state="paused"]`,
`[data-state="stopped"]` and in idle — per the `tokens.css` rule that permanent
`will-change` exhausts TV VRAM.

---

## 4. The vinyl spec

Root dimension: `--disc: min(34rem, 52vh)` → **544px @1080p**. The `vh` clamp
keeps the disc inside the safe area on 21:9 panels and in the letterboxed
viewport a desktop review window produces. Every sub-dimension is a percentage
of `--disc`, so the whole assembly scales with the panel at 720p / 1080p / 4K.

### 4.1 Disc dimensions (proportions taken from a real 12" LP)

| Part | Real LP | Fraction of disc | @1080p |
|---|---|---|---|
| Overall diameter | 302 mm | 100% | 544 px |
| Outer rim bevel (flat edge land) | 3 mm | band at 99–100% | 5.4 px |
| Lead-in groove start | 292 mm | 96.5% | 525 px |
| Recorded band (grooves) | 292 → 120 mm | 96.5% → 39.5% | 525 → 215 px |
| Run-out / dead wax | 120 → 106 mm | 39.5% → 35% | 215 → 190 px |
| **Label** | 100 mm | **36%** (`inset: 32%`) | **196 px** |
| Label lip (proud edge) | 0.4 mm | `0.125rem` ring | 2 px |
| Spindle hole | 7.2 mm | 2.4% of disc = 6.6% of label | 13 px |

The label is **36%**, not V1's 56%. This is the single largest reason V1 did not
read as vinyl: at 56% the black ring was a frame around a thumbnail. At 36% the
grooved field dominates and the object is unmistakably a record.

### 4.2 Groove treatment — the fix for "the rotation is invisible"

Three stacked backgrounds on `.now__vinyl`, all painted once:

1. **Groove micro-texture.** `repeating-radial-gradient`, a 1px light line every
   **4px** (`--groove-pitch`) at 6% white, drawn between 35% and 96.5% radius —
   about 120 rings @1080p. *Rotationally symmetric, so it contributes no motion*;
   its job is surface, not spin. The pitch is deliberately above 3px: below that
   the nearest-neighbour upscale a 720p panel applies produces moiré.
2. **Track-gap lands.** A second `repeating-radial-gradient` at **28px** pitch,
   2px wide, 10% white. These are the visibly lighter bands a real pressing shows
   between songs; they give the eye a coarse radial scale so the fine grooves
   read as fine.
3. **Anisotropic swirl — this is the moving detail.** A `conic-gradient` with two
   opposed lobes (a bowtie), 0 → 14% white, masked to the grooved annulus by a
   `radial-gradient` mask. Vinyl's real anisotropic reflection *is* a two-lobed
   bowtie. Because these lobes **rotate with the disc** while the room light
   (§4.3) stays fixed, a bright band sweeps past the highlight **twice per
   revolution** — at 1.8s/rev, a sweep every **0.9s**. This plus the label is
   what makes the rotation visible at 3 metres.

### 4.3 Specular highlight — fixed to the room, not to the record

`.now__sheen` is a **non-rotating sibling stacked above** `.now__vinyl`:

- A **28°-tilted `linear-gradient` bar**, white 0 → 9% → 0, band width 22% of
  the disc, crossing upper-left to lower-right.
- A soft top-left `radial-gradient` key light, white 7% → transparent at 55%,
  positioned at 30% / 25% to match the disc body's own highlight origin so the
  lighting stays self-consistent.
- A 1px `inset` rim light at the outer edge (`--rim-light`).

Because it is static it costs **zero animated layers**, and because the swirl
turns beneath it the grooves genuinely appear to catch and release the light.
This is also the correct physics: the lamp does not orbit the room.

### 4.4 Spin-up and spin-down inertia

CSS cannot vary the rate of a running animation, so the disc uses **two nested
rotations that superpose**:

- `.now__vinyl` (inner) — constant `spin`, `1.8s linear infinite`. That is
  **33⅓ RPM, the real speed of an LP**. Set `--rpm-period: 1.333s` for a 45.
- `.now__platter` (outer wrapper) — a *lagging offset* that decays to zero.

**Spin-up** — `platter-spinup`: `rotate(0deg) → rotate(-110deg)`, **1000ms**,
`cubic-bezier(0.33, 0.60, 0.20, 1.00)`, `forwards`.

> Derivation. Steady rate ω = 360 / 1.8 = **200 °/s**. The bezier's initial slope
> is y1/x1 = 0.60 / 0.33 = **1.82** progress·s⁻¹, so the offset's initial rate is
> −110 × 1.82 = **−200 °/s**, exactly cancelling ω. **Net angular velocity at
> t = 0 is zero**, then rises smoothly to 200 °/s as the offset's rate decays.
> The platter starts from a dead stop under torque, like a belt drive catching.
> Net rotation during spin-up = 200 × 1.0 − 110 = **90°**, a clean quarter turn.

**Spin-down (brake)** — `platter-brake`: `rotate(0deg) → rotate(-180deg)`,
**1800ms**, `cubic-bezier(0.35, 0.00, 0.70, 0.40)`, `forwards`.

> Derivation. Terminal slope is (1 − y2)/(1 − x2) = 0.60 / 0.30 = **2.0**, so the
> offset's final rate is −180 × 2.0 / 1.8 = **−200 °/s**, cancelling ω exactly:
> the disc comes to rest with **zero residual velocity** — no snap on the last
> frame. Initial slope is 0.00 / 0.35 = **0**, so braking begins with no velocity
> discontinuity either. Net coast = 200 × 1.8 − 180 = **180°**, half a turn,
> which is what linear deceleration from 200 °/s over 1.8s should cover.

**State machine the markup must drive** (`data-state` on `.now`):

| `data-state` | inner spin | platter | tonearm | set by |
|---|---|---|---|---|
| `stopped` | paused at 0° | 0° | parked −32° | initial render |
| `starting` | running | `platter-spinup` | cue-in begins at **+200ms** | on PLAY |
| `playing` | running | 0° | tracking | +1000ms after `starting` |
| `stopping` | **still running** | `platter-brake` | cue-out begins at +0ms | on PAUSE |
| `paused` | paused → freezes at its current angle | held −180° | parked | +1800ms after `stopping` |

Two `setTimeout`s, at 1000ms and 1800ms. That is the entire JS contract for the
disc. Because `animation-play-state: paused` freezes the inner spin exactly where
it is and the platter's `forwards` fill holds −180°, the composite angle at the
`stopping → paused` handover is continuous — no visible jump.

### 4.5 The label sitting proud of the disc

Static only. The "proud" read comes entirely from pre-rendered lighting; nothing
here is ever transitioned.

- `box-shadow: 0 0 0 0.125rem <label-lip>, 0 0.25rem 0.75rem rgba(0,0,0,0.55)` —
  a 2px lighter lip ring plus a soft drop, so the label reads as paper stuck onto
  the vinyl rather than a hole cut into it.
- `--rim-light` inset along its top edge.
- A hairline dark ring where paper meets vinyl.

**Artwork policy (Apple Identity Guidelines).** The label is **not** the album
art by default. The full, square, **uncropped and undistorted** artwork appears
at 416px on `.now__sleeve`; the label is a plain paper disc filled with Apple's
own `Artwork.bgColor` and set in `textColor1` / `textColor2`. No crop occurs
anywhere on the screen. A `.now__label[data-label="art"]` variant that
circle-crops the artwork is provided but is **opt-in**, because a circular crop
is still a crop.

### 4.6 The tonearm

`.now__tonearm` is a new element, a child of `.now__stage`, pivoting from a fixed
point up and to the right of the disc.

| Property | Value @1080p |
|---|---|
| Pivot position | `top: 4%; right: -2%` of `.now__stage` |
| `transform-origin` | `92% 12%` — the pivot bearing |
| Arm length | `0.66 × --disc` = **359 px** |
| Arm tube | 10 px, `--radius-pill` |
| Headshell | 44 × 26 px, angled 22° at the far end |
| Counterweight | 34 px disc at the pivot end |
| **Parked** (lifted, off the record) | `rotate(-32deg)` |
| **Lead-in groove** (track start) | `rotate(6deg)` |
| **Run-out** (track end) | `rotate(24deg)` |
| Total tracking travel | **18°** across the whole track |
| Cue-in (park → lead-in) | **1400ms**, `--ease-out-soft`, starting **200ms** after spin-up so the platter is at speed first |
| Cue-out (→ park) | **900ms**, `--ease-out` |
| Tracking tick | `--dur-slow` (400ms) transition, driven once per second |

Tracking is driven by one custom property, written from the same progress value
that drives `.now__fill`:

```js
now.style.setProperty('--now-arm-track', String(elapsed / duration)); // 0 → 1
```

and consumed as `transform: rotate(calc(6deg + var(--now-arm-track) * 18deg))`.
Transform-only, one property write per second.

**The arm's position is a second, glanceable readout of progress.** From three
metres you can see how far into the track you are without reading the scrub bar
at all — which is exactly the kind of thing a 10-foot UI should be doing.

---

## 5. Idle behaviour and burn-in

`.now[data-idle="true"]` is set after **300 s (5 minutes)** with no D-pad event.
Any key clears it instantly.

Burn-in is a hardware defect, not a taste issue, so this is defence in depth —
four independent measures:

1. **Global pixel-shift.** `.now__body` runs `idle-drift`:
   `translate3d(-0.75rem, -0.5rem, 0) → translate3d(0.75rem, 0.5rem, 0)`,
   **240 s linear alternate** (480 s full cycle). That is ±12 px horizontal and
   ±8 px vertical @1080p — enough to smear the wear of any static edge across
   ~24 px, and slow enough (~0.1 px/s) to be perceptually invisible. `.now__body`
   carries the extra `1rem` inset precisely so this drift can never push content
   outside the 5% safe area.
2. **The bright static furniture leaves.** `.now__transport`, the focus ring and
   `.now__meta` fade to `opacity: 0` over `--dur-slow`. These are the
   highest-luminance, hardest-edged, most rigidly positioned things on the
   screen and therefore the only real burn-in risk. Nothing is lost — they are
   one keypress away.
3. **Luminance cut.** `.now__dim`, a flat `--surface-0` sheet above the content,
   fades `0 → 0.42`. Peak panel luminance drops ~42%, which is the single most
   effective OLED mitigation and also stops the TV's own auto-brightness limiter
   from pumping.
4. **The one remaining lit object rotates.** In idle the disc keeps spinning. A
   rotating element self-distributes its own wear; only the exact centre of the
   label and the spindle are stationary, and measure 1 walks even those.

The bloom's 24 s `drift` is **paused**, not merely hidden, so the compositor has
nothing left to do for it.

**Chrome auto-hide happens earlier, too.** `.now__transport` fades out after
**8 s** of no input while playing (`data-chrome="hidden"`) and returns on any
key. This is the ordinary video-player convention, and it means the brightest
fixed block on the screen is absent for the overwhelming majority of playback.

---

## 6. `prefers-reduced-motion: reduce`

`tokens.css` §16 already collapses every duration to 1 ms globally. This spec
states explicit intent on top of that, because a 1 ms `spin` would otherwise
leave the disc frozen at 0° with a tonearm hovering over nothing.

**Disabled entirely:**

- Vinyl rotation, spin-up and brake. The disc renders **static, at rest**, with
  its grooves, lands and sheen fully drawn. It still looks like a record; it just
  is not turning.
- Bloom drift. `.now__bloom` holds a static `scale(1.06)` at full opacity.
- Tonearm cue and tracking *animation*. The arm still **jumps** to the correct
  angle for the current state and progress, because that position is information,
  not decoration — instant, with no interpolation.
- Idle drift as a continuous animation.

**Kept, because they are affordance or hardware protection rather than ambience:**

- The focus ring, glow and scale step — instant, at the reduced
  `--focus-scale-sm: 1.06` the tokens already define.
- `.now__fill` progress — updates as a step.
- **Burn-in protection.** Continuous drift is replaced by a discrete jump: JS
  writes `--now-idle-shift` (`0`…`3`) every **90 s** while idle, and the CSS maps
  each step to a static `translate3d` at one of the four corners of the same
  ±12 / ±8 px box. Identical wear coverage, zero perceived motion.
  Reduced-motion is a comfort preference; it must not be allowed to damage
  someone's panel.

---

## 7. Deliberately rejected

**1. Full-bleed blurred album artwork behind everything.**
Rejected. It requires `filter: blur()`, which `tokens.css` bans outright, and
pre-blurring server-side would add a second artwork decode per track on a device
already working hard on the first 1000 px JPEG. It also destroys the contrast
the text ramp was measured against — `--text-tertiary` at 5.5:1 is computed
against `--surface-0`, and a bright blurred cover behind it fails AA. `--art-bloom`
already delivers the colour warmth for a fraction of the cost, using Apple's own
`bgColor`.

**2. An audio-reactive waveform or spectrum visualiser.**
Rejected on honesty and on cost. MusicKit serves DRM-protected streams and the TV
WebView exposes no `AnalyserNode` for them, so any visualiser would be a
**pre-canned loop pretending to respond to the music**. Users notice inside about
thirty seconds, and once they do the whole app feels fake — the opposite of what
this redesign is for. It would also cost a 60 fps JS→style write loop, the exact
pattern the performance contract exists to prevent.

**3. A dust, scuff and scratch particle overlay on the vinyl.**
Rejected. To read as dust at three metres a particle must be ≥3 px, and at that
size it reads as **a dirty television**, not a loved record — users will report it
as a display fault. Doing it properly needs either many small layers or a
`<canvas>` repainting every frame. The anisotropic swirl (§4.2) delivers the same
"used object" warmth as one extra background-image on a layer that was already
being rasterized.

**4. Perspective tilt — laying the disc back in 3D on a turntable plinth.**
Rejected. `rotate3d` is technically transform-only and therefore legal, but
perspective-projecting a `repeating-radial-gradient` forces the SoC to
re-rasterize at a varying effective scale, and the 4 px groove pitch aliases into
visible moiré along the far edge of the disc. It also foreshortens the artwork,
which is an Apple Identity Guidelines problem. Flat, face-on and correct beats
tilted and wrong.

**5. Synchronised scrolling lyrics.**
Rejected for this pass. Out of scope, but more importantly a karaoke line
re-lays out text every few seconds, and text layout is the most expensive thing
you can do repeatedly on a TV SoC. Lyrics deserve their own screen with their own
budget; they must not be stacked on top of this one.

**6. Making the label the album artwork by default — V1's behaviour.**
Rejected as the default. A circular crop is a crop, and the sleeve now shows the
artwork square, full-bleed and uncropped at 416 px — larger than V1's 305 px
label ever was. The authentic paper label built from Apple's `bgColor` is both
safer and, because it lets the disc read as 64% grooved vinyl, considerably more
convincing. Available as `data-label="art"` if the owner insists.

---

## 8. Markup the developer must add

New elements are marked `NEW`. Everything else keeps its existing class name so
the stylesheet can be swapped in.

```html
<section class="now" data-state="stopped" data-idle="false" data-chrome="shown">
  <div class="now__bloom"></div>
  <div class="now__scrim"></div>

  <div class="now__body">
    <div class="now__stage">                    <!-- NEW: sleeve+disc+arm frame -->
      <div class="now__sleeve">                 <!-- NEW: uncropped square art -->
        <img class="now__sleeve-art" alt="">
      </div>

      <div class="now__disc">
        <div class="now__platter">              <!-- NEW: inertia wrapper -->
          <div class="now__vinyl">
            <div class="now__swirl"></div>      <!-- NEW: anisotropic lobes -->
            <div class="now__label">            <!-- CHILD of vinyl, see below -->
              <span class="now__label-line">Apple Music</span>
            </div>
          </div>
        </div>
        <div class="now__sheen"></div>          <!-- NEW: static room light -->
      </div>

      <div class="now__tonearm">                <!-- NEW -->
        <span class="now__tonearm-weight"></span>
        <span class="now__tonearm-head"></span>
      </div>
    </div>

    <div class="now__meta">      <!-- unchanged -->  </div>
    <div class="now__transport"> <!-- unchanged -->  </div>
  </div>

  <div class="now__dim"></div>                  <!-- NEW: idle luminance cut -->
</section>
```

**Correction, verified in the browser:** the label must be a **child of
`.now__vinyl`**, not a sibling. The continuous `spin` animation is on
`.now__vinyl`; a sibling label sits perfectly still while the record turns
underneath it, which no real record does. `.now__platter` still wraps both and
carries the spin-up and spin-down rotation on top of the constant spin.

### Custom properties JS writes on `.now`

| Property | Range | Written |
|---|---|---|
| `--now-progress` | `0`–`1` | once per second — drives `.now__fill` `scaleX` |
| `--now-arm-track` | `0`–`1` | once per second — drives the tonearm angle |
| `--now-idle-shift` | `0`–`3` | every 90 s, **reduced-motion only** |
| `--art-accent` | colour | on track change, from `Artwork.bgColor` |
| `--label-bg` / `--label-ink` | colour | `bgColor` / `textColor1` |
| `--rpm-period` | time | `1.8s` for an album, `1.333s` for a single |

### Attributes JS writes on `.now`

`data-state` (§4.4), `data-idle` (`true` / `false`), `data-chrome`
(`shown` / `hidden`).
