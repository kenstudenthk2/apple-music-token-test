# MOTION_RESEARCH — AppleTune TV

Research brief for making the AppleTune TV Now Playing screen stop feeling generic.
Constraint carried through every recommendation: **Android TV WebView, D-pad only, ~3 m
viewing distance, weak GPU, animate only `transform` and `opacity`.**

Sources are cited inline. Where something could not be verified, it is marked
**[unverified]** rather than asserted.

---

## 1. Five principles from emilkowalski/skills

Repo: <https://github.com/emilkowalski/skills> (MIT, ~30.7k stars, 11 skills).
Files read verbatim: `skills/animate/SKILL.md`, `skills/review-animations/STANDARDS.md`,
`skills/emil-design-eng/SKILL.md`, `skills/apple-design/SKILL.md`.
Raw source: `https://raw.githubusercontent.com/emilkowalski/skills/main/skills/animate/SKILL.md`

### P1 — Frequency gates everything. Some things must NOT animate.

> "100+ times/day (keyboard shortcuts, command palette toggle) → **No animation. Ever. Stop here.**"
> "Tens of times/day (hover effects, list navigation) → Near-imperceptible only — fast and subtle, or nothing"
> "Occasional (modals, drawers, toasts) → Standard animation"
> "Rare / first-time (onboarding, success, celebration) → **The delight budget lives here**"
> — `animate/SKILL.md`, Build Sequence step 1

**On a TV at 3 m:** the D-pad *is* the keyboard shortcut. Focus movement on a shelf fires
hundreds of times per session — it belongs in the "near-imperceptible or nothing" tier,
100–160 ms maximum, and must never queue or lag behind held-down D-pad repeats. The delight
budget belongs on the **Now Playing entry transition** and on **track change** — events that
happen once every ~3 minutes. This is the biggest reframe for AppleTune: the owner wants
"special", and the correct place to spend it is Now Playing, *not* the browse grid.

### P2 — Never `ease-in`; built-in easings are too weak; UI stays under 300 ms.

> "**Never `ease-in` on UI.** It starts slow, delaying the exact moment the user is
> watching. `ease-out` at 200 ms *feels* faster than `ease-in` at 200 ms."
> "Built-in CSS easings are too weak. Use these:
> `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);`
> `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);`
> `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);`"
> "**UI animations stay under 300 ms.** A 180 ms dropdown feels more responsive than a 400 ms one."
> — `animate/SKILL.md` step 5 · `review-animations/STANDARDS.md`

His decision table: entering/exiting → `ease-out`; moving/morphing on screen → `ease-in-out`;
hover/colour → `ease`; **constant motion (marquee, progress) → `linear`**; default → `ease-out`.

**On a TV at 3 m:** a remote press carries transport latency the browser cannot remove. Every
millisecond of animation stacks *on top of* that. Focus response must sit at the fast end
(120–160 ms, strong `ease-out`) or the remote feels broken. Note the `linear` rule directly
governs the vinyl: **a spinning record must be `linear`, forever — any easing on the loop
reads as a failing motor.**

### P3 — Physicality: nothing appears from nothing, and origin matters.

> "**Never `scale(0)`.** Start from `scale(0.9–0.97)` + `opacity: 0`. Nothing in the real
> world appears from nothing."
> "**`transform-origin` at the trigger** for popovers, dropdowns, menus, tooltips …
> **Modals are exempt**."
> "**Percentages in `translate()`** are relative to the element's own size — `translateY(100%)`
> moves by its own height whatever the content."
> — `animate/SKILL.md` step 4

**On a TV at 3 m:** scale deltas calibrated on a phone do not transfer. Focus scale wants
~1.06–1.10 at 3 m, but *entry* scale should still be 0.94–0.97, never 0.8 — a large scale
jump on a 55-inch panel reads as a lurch. Origin-awareness maps straight onto D-pad: a panel
that opened because focus moved right should scale from its left edge so the eye keeps its
anchor.

### P4 — Interruptibility is the most important principle; animate from the *presentation* value.

> "Every animation must be interruptible and redirectable at any moment… **Never lock out
> input during a transition.** **Always animate from the *presentation* (current) value,
> never the target value.** On interrupt, read the element's live on-screen transform and
> start the new animation from there."
> "**Transitions, not keyframes, for anything triggered rapidly** — transitions retarget from
> the current value; keyframes restart from zero."
> — `apple-design/SKILL.md` §3 · `animate/SKILL.md` step 6

**On a TV at 3 m:** this is the number-one cause of TV UIs feeling cheap. Users *hold* the
D-pad down. If focus movement is a `@keyframes` animation, every repeat restarts from zero
and the row visibly stutters behind the user's thumb. Use CSS **transitions** on `transform`
for focus, never keyframes. Same for skip-track: two presses in a second must retarget, not
replay.

### P5 — Perceived performance is a design lever, and unseen details compound.

> "A **fast-spinning spinner** makes loading feel faster (same load time, different
> perception). A **180 ms select** animation feels more responsive than a **400 ms** one.
> **Instant tooltips** after the first one … make the whole toolbar feel faster."
> — `emil-design-eng/SKILL.md`, Perceived performance
>
> "Most details users never consciously notice. That is the point… All those unseen details
> combine to produce something that's just stunning, like a thousand barely audible voices
> all singing in tune." (Paul Graham, quoted)
> "**Beauty is leverage.** People select tools based on the overall experience, not just
> functionality. Good defaults and good animations are real differentiators."
> — `emil-design-eng/SKILL.md`, Core Philosophy

Plus the stagger rule: "Stagger group entrances; **30–80 ms** between items. Longer delays
feel slow. Stagger is decorative — **never block interaction while it plays.**"

**On a TV at 3 m:** the app currently loads artwork, then shows it. Instead — paint the
adaptive accent wash *immediately* from Apple's `bgColor` (already available), then cross-fade
the artwork in. The wait becomes part of the experience instead of a gap. And the staggered
entry must not block the D-pad; the transport row must be focusable on frame 1.

**Tokens to adopt directly:**

```css
--ease-out:     cubic-bezier(0.23, 1, 0.32, 1);   /* entrances, exits, focus */
--ease-in-out:  cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement */
--ease-drawer:  cubic-bezier(0.32, 0.72, 0, 1);   /* panels sliding in */
--dur-press:    140ms;   /* 100-160 */
--dur-focus:    160ms;
--dur-panel:    240ms;   /* 200-300, never above 300 for UI */
--stagger:      50ms;    /* 30-80 */
```

Also worth stealing from `apple-design/SKILL.md`: the multimodal feedback rules —
**causality, harmony (visual + sound fire on the same frame), utility.** AppleTune has real
audio; a needle-drop visual that lands on the exact frame audio starts is free realism.

---

## 2. Verdict on jnMetaCode/agency-agents-zh

<https://github.com/jnMetaCode/agency-agents-zh> — ~19.6k stars, MIT, primary language
Chinese (Simplified + Traditional).

**What it actually is:** a Chinese-community edition of an agent-persona library — 268
pre-written AI "expert persona" markdown files (215 translated + 53 China-market originals),
organised into ~20 department folders (engineering, design, marketing, finance, HR, legal,
gaming…), with install scripts that convert them into the formats used by ~18 coding tools
(Claude Code, Cursor, Copilot…). It pairs with an `agency-orchestrator` for DAG-style
multi-agent workflows. The China-specific agents cover Xiaohongshu, Douyin, WeChat, Bilibili,
Feishu, DingTalk.

**Verdict: not useful for this problem. Do not spend time on it.**

1. It is **agent tooling, not design knowledge.** It ships role prompts ("you are a UI
   designer, here is your workflow template"). No easing curves, no motion values, no
   10-foot-UI guidance, no vinyl anything.
2. It is **a sibling of the persona system this team already runs.** The agents in this very
   session are that same genre. Installing 268 more personas adds selection overhead, not craft.
3. Where it overlaps emilkowalski/skills at all it is strictly weaker: Emil's repo encodes
   *specific, defensible values*; persona libraries encode *process templates*.

The only scenario where it earns a look is future Chinese-market growth/content work
(Xiaohongshu, Bilibili). Out of scope for "the player feels boring."

---

## 3. Vinyl realism checklist

The core diagnosis first, because it explains why the current disc feels flat:

> **A perfectly circular, perfectly concentric disc rotating about its own centre produces
> almost no visible motion.** Grooves are concentric rings — rotating them changes nothing.
> The only thing the eye can see spinning is the label. That is precisely the "spinning
> square" problem. Realism comes from *breaking rotational symmetry*: an off-centre
> highlight, an asymmetric label, a fixed light source the disc turns underneath, and a
> tonearm that is unmistakably not part of the disc.

Cost rated under the transform+opacity-only contract.

| # | Detail | Why it convinces | Cost |
|---|---|---|---|
| 1 | **Correct RPM.** 33⅓ rpm = **1800 ms/revolution**; 45 rpm = **1333 ms**. Use 1800 ms, `linear`, `infinite`. | Anyone who has owned a record reads wrong speed instantly. Most web vinyls spin at 2–5 s/rev and look like a desk fan. | **Low** — one `animation-duration`. |
| 2 | **Spin-up and spin-down, not on/off.** Real platters reach speed in ~1–2 s and coast down over ~2–4 s. Run the rotation as a WAAPI animation and ramp `updatePlaybackRate()` 0→1 on play, 1→0 on pause. | The strongest single "this is a real machine" cue. Instant start/stop is the tell of a fake. | **Low** — still compositor-driven `transform`. |
| 3 | **A fixed specular highlight the disc turns *underneath*.** A separate, **non-rotating** sibling layer holding an off-centre elongated gloss, painted once, `opacity` only. | This is the physics: a lamp in the room does not orbit the record. Rotating the highlight *with* the disc is the most common mistake and destroys the illusion. | **Low** — static layer, zero per-frame cost. |
| 4 | **Grooves as a pre-baked texture, never animated.** `repeating-radial-gradient` rendered once into the disc layer (ideally rasterised to a bitmap for weak GPUs). | Grooves supply the material read; they need not move, and animating them would cost paint. | **Low** static / **High** if repainted per frame — do not. |
| 5 | **Label and vinyl are different materials.** Label = matte paper, artwork, **~35–40 % of disc diameter**, hard circular edge. Vinyl = gloss black. Album art belongs on the *label*, not stretched across the disc. | A disc that is 100 % album art is a spinning square with rounded corners. The size ratio is what makes it read as a record. | **Low** — pure layout. |
| 6 | **Spindle hole + centre boss.** A true-black hole (~7 mm on a 300 mm record ≈ 2.4 % of diameter) with a highlight ring. | Tiny, but the eye uses it to lock onto the centre of rotation. | **Low** |
| 7 | **Lead-in groove and run-out land.** A visibly smoother, wider band at the outer edge (~5 mm) and an inner smooth land before the label. | Real records are not grooved edge to edge. Uniform grooving looks like a CD render. | **Low** |
| 8 | **Tonearm arcing inward with progress.** Pivoted arm, `transform-origin` at the pivot, `rotate()` from roughly **−2° (lead-in) to +20° (run-out)** driven by playback progress, not a timer. Lift/lower on play/pause as a separate small transform. | The arm is the only element whose *position means something*. It converts the disc from decoration into a progress indicator. Exact sweep angle for a specific deck geometry is **[unverified]** — tune visually. | **Med** — needs progress plumbing, but it is one `rotate()`. |
| 9 | **Needle-drop on play.** Arm swings out, descends, audio starts on the *same frame* the needle lands (Emil's "harmony" rule). Optional 120 ms crackle. | Causality. This is the moment that will make the owner say "it feels real." | **Med** — sequencing + audio sync. |
| 10 | **Eccentric wobble, very slight.** Real pressings are never perfectly centred and visibly "wow". A ~0.3–0.6 px translate oscillation at exactly the rotation period, or ~0.15° `rotateX` on a `preserve-3d` disc. | Sub-perceptual asymmetry is what stops the disc reading as a CSS shape. Keep it *below* conscious notice. | **Low** — one extra transform on a wrapper. |
| 11 | **Dust, scuff and pressing-ring texture — baked, static, low opacity.** One faint noise/arc overlay at 4–8 % opacity, rotating *with* the disc. | Perfect surfaces read as CGI. Cheapest "expensive" detail available. | **Low** — one static bitmap layer. |
| 12 | **Perspective tilt, not flat-on.** `rotateX(12–18°)` on the disc container with `transform-style: preserve-3d`. | Turns a circle into an ellipse and gives the tonearm a plane to live on. Sells depth at 3 m instantly. | **Low** — one static transform on the parent. |
| 13 | **Album art sunk into the label, not stuck on it.** Clip artwork to the label circle (`border-radius: 50%` + `overflow: hidden`) with a 1–2 px inner rim. | Prevents the "sticker pasted on a black circle" look. | **Low** |
| 14 | **Track change = record change.** Old disc lifts (`translateY` + `scale` down + fade); new disc drops in with `--ease-out`. ~320–400 ms total. | Once per song = squarely inside the delight budget from P1. | **Med** |
| 15 | **33 vs 45 feel.** 45 rpm reads as visibly *urgent*. Never default to it — it makes a living-room UI feel hurried. | Speed is emotional. 33⅓ is calm, which is what a TV wants. | **Low** |

Items **1, 2, 3, 5 and 12 alone** move the disc most of the way from "spinning square" to
"record".

---

## 4. Reference teardown

| App / repo | What it does | What to steal |
|---|---|---|
| **Apple Music, tvOS** — Apple's album motion guidelines: <https://help.apple.com/itc/albummotionguide/en.lproj/static.html> | Animated album artwork on Now Playing. Apple's rules for artists: **8–35 s, seamless continuous loop, no cuts, no hold or drop frames, first frame must match the static cover**, and "motion covers that are too frantic or use constant flashing could distract or even cause harm to viewers." | The **loop-length and restraint doctrine**: any ambient motion AppleTune adds should be a seamless 8–35 s loop with no beat and no flashing. Also **first frame = static state**, so a stalled animation still looks correct — an excellent rule for a weak WebView. Users report animated art plays in the tvOS split layout but *not* in the centred full-art layout (<https://discussions.apple.com/thread/255113940>) — even Apple keeps the hero state calm. |
| **Spotify Canvas** — <https://imusician.pro/en/resources/guides/spotify-canvas> | 3–8 s vertical looping video replacing static cover in Now Playing. Spotify's published figures: **+145 % shares, +5 % continued streaming, +20 % playlist saves.** | Evidence that motion on the Now Playing screen changes *behaviour*, not just taste — useful ammunition for the owner. Steal the **short seamless loop** format; AppleTune has no Canvas asset, so synthesise an equivalent from artwork + accent colour. |
| **Plexamp** — <https://www.plex.tv/plexamp/> | "UltraBlur" backgrounds that **extract key colours from artist and album artwork**, a dozen visualizers, four themes. | AppleTune already has adaptive accent from Apple's `bgColor`; Plexamp shows the ceiling for that idea. A **multi-stop mesh built from 3–4 extracted colours, drifting slowly** is the signature look. Cheap version in §5 #1. |
| **Codrops — Interactive Record Player** — <https://tympanus.net/codrops/2016/06/15/interactive-record-player/> · repo <https://github.com/codrops/RecordPlayer> | SVG record, **draggable tonearm to seek**, Web Audio API, physics-based arm motion via Dynamics.js, scratchy vinyl noise plus acoustic impulse-response reverb. | The **arm-as-scrubber** idea; on D-pad it becomes Left/Right on the disc = seek, arm follows. Also the **vinyl crackle layer** — near-zero cost, large perceived authenticity. |
| **Pyxofy CSS Turntable pt.1 / pt.2** — <https://www.pyxofy.com/css-animation-turntable-part-1/> · <https://www.pyxofy.com/css-animation-turntable-part-2/> | Pure-CSS turntable. Tonearm rotates through discrete waypoints (**0° → 13° start of record → 20° mid → 30° end**) using `transform-origin: center` + `rotate()`; pseudo-elements and `linear-gradient()` build the VU meter and headshell light. | Concrete **arm-angle waypoints** to calibrate against. Its VU meter moves a mask over pre-painted gradient bars — that trick generalises: **paint once, reveal with transform.** Its headshell light animates `background-color`, which AppleTune must *not* copy — use `opacity` instead. |
| **Babuptx/audiophile-turntable** — <https://github.com/Babuptx/audiophile-turntable> | Technics SL-1300G styling, **33/45/78 switching with "accurate platter physics"**, strobe tower, pitch slider, drag the needle onto the grooves to seek, dual VU meters, 65-band analyser. | The **strobe-dot ring** (dots around a Technics platter that appear stationary at correct speed) — a beautiful, *meaningful* detail. Also the pitch/speed switch as a physical control. The real lesson: it looks real because it copies one specific real deck rather than "a record player in general". |
| **ShehabEMohsen/VinylMusicPlayer** <https://github.com/ShehabEMohsen/VinylMusicPlayer> · **subhajitroycode/record-player** <https://github.com/subhajitroycode/record-player> · **AMEND09/SpotifyVinyl** <https://github.com/AMEND09/SpotifyVinyl> | Spotify-connected vinyl UIs; CSS spin plus tonearm that moves on play. SpotifyVinyl uses tonearm placement as the play control. | Closest prior art to AppleTune's exact concept — worth reading for component structure. Expect all three to spin too slowly and to rotate the highlight with the disc: **the bar they set is beatable.** |
| **shadcn vinyl player block** — <https://www.shadcn.io/blocks/music-vinyl-player> | React block: CSS-animated record with label art, tonearm moves into position on play, 33/45/78 selector. | A clean modern layer decomposition to mirror: disc / label / arm / controls as separate elements. |
| **Winamp / foobar2000 skins** | Decades of dense skinnable now-playing chrome: spectrum analyser, scrolling marquee title, VU meters. | The **marquee for long titles** is still the right answer at 3 m (§5 #4). The rest is a warning: density that worked at arm's length collapses at 3 m. |
| **Car head units** | Enormous type, very few elements, high contrast, motion only where it conveys state. | **Glanceability discipline.** A TV Now Playing screen is closer to a dashboard than to a phone app — the viewer is 3 m away and often doing something else. |
| **Sonos / Roon / Jellyfin now-playing** | Large art plus ambient colour field; Roon is known for typographic hierarchy and rich credits. | **Credits and context as content** — year, label, composer, "Recorded 1971". Adding *information* is a legitimate way to make a screen feel richer without adding motion. Roon's exact layout specifics **[unverified]** — not inspected first-hand. |

**What separates "alive" from "static poster", distilled:** (a) something moves continuously
but *slowly* and without a beat; (b) something moves *because of the music's progress*, so
motion carries meaning; (c) the colour of the whole screen derives from the artwork, so every
track looks different; (d) transitions between tracks are physical events, not swaps.

---

## 5. Ten cheap-but-premium motion techniques (transform + opacity only)

1. **Drifting gradient mesh.** 3–4 large, heavily-feathered radial-gradient blobs painted from
   the artwork's extracted colours into absolutely-positioned divs. Animate each with a
   different-period `translate3d()` + `scale()` loop of **20–40 s, `linear`, `infinite`**, with
   deliberately non-harmonic periods so the pattern never visibly repeats.
   *Looks like:* an expensive live shader. *Costs:* four composited layers, zero paint.
2. **Parallax depth on focus.** On focus move, translate the background layer 1 px, mid layer
   4 px, foreground 10 px — all `transform`, all `--dur-focus`.
3. **Scale-based depth instead of shadow.** The perf contract bans animating `box-shadow`, so
   express elevation as `scale(1.06)` plus an already-painted static shadow whose `opacity`
   rises to 1. Identical read, compositor-only.
4. **Marquee for long titles — only when actually overflowing, and `linear`.** `translateX`
   from 0 to `-100%` of the overflow, 3 s hold at each end. Essential at 3 m, where a
   truncated title is unreadable.
5. **Staggered entry, 50 ms apart, non-blocking.** Title → artist → transport → queue, each
   `translateY(8–12px)` + `opacity 0→1`, 240 ms `--ease-out`. Per Emil: 30–80 ms, and never
   block input while it plays.
6. **CSS-only shimmer: a pre-painted sheen swept by transform.** One skewed translucent white
   bar as a sibling layer, `translateX(-120% → 220%)` over ~1.4 s, fired on a long interval
   (every 8–12 s) or on focus. No `filter`, no gradient recalculation.
7. **Cross-fade artwork with a counter-scale beat.** Outgoing: `opacity 1→0` + `scale(1→0.98)`.
   Incoming: `opacity 0→1` + `scale(1.02→1)`. 280 ms `--ease-out`. The counter-scale is what
   stops a crossfade reading as a lazy dissolve.
8. **Progress-driven tonearm.** Bind one `rotate()` to `currentTime / duration`, updated on
   `timeupdate` (~4 Hz) with a CSS transition smoothing between updates. One property,
   enormous meaning.
9. **Breathing hero.** The disc container gains `scale(1 → 1.012 → 1)` over **8 s
   `ease-in-out` infinite**. Below the conscious threshold at 3 m, but the screen stops feeling
   frozen — and it mildly mitigates burn-in.
10. **Ambient drift of the whole composition.** Translate the entire Now Playing group by
    ±6–10 px on a very slow, non-obviously-repeating loop (60–90 s). Standard broadcast and
    screensaver practice; it is a large part of why good TV UIs feel "live" rather than "paused".

**Bonus — looks expensive, costs nothing:** keeping the **specular layer static while the disc
rotates beneath it**. It is the highest value-per-byte trick in this document.

---

## 6. What NOT to do

**Will look cheap**
- Rotating the specular highlight or reflection with the disc. Instantly reads as a sticker.
- A disc slower than ~1800 ms/rev, or with any easing on the loop. `linear` only.
- Bounce or overshoot on focus movement. Emil: keep bounce 0.1–0.3 and reserve it for
  drag-to-dismiss and playful interactions — a D-pad shelf is neither.
- `@keyframes` on focus. Held D-pad repeats restart from zero and the row stutters.
- Everything entering at once, or a stagger longer than 80 ms per item.
- `transition: all`, `ease-in` on entrances, `scale(0)` entrances — automatic failures in his
  review standard.
- Beat-synced pulsing on every element. Apple's own artwork rules warn against "frantic"
  motion and "constant flashing"; at 3 m it is genuinely unpleasant.
- Album art stretched to fill the entire disc. That *is* the spinning square.

**Will break the performance contract**
- Any animated `filter`, `backdrop-filter`, `box-shadow`, `background-color`, `width`/`height`,
  `top`/`left`. Note this rules out Apple's own "materialize — animate blur radius and scale
  together" advice (`apple-design/SKILL.md` §12); on this hardware substitute a pre-blurred
  static bitmap whose `opacity` and `scale` animate.
- Driving child transforms from a CSS variable on the parent — Emil: "it recalculates styles
  for every child." Set `transform` on the element directly.
- Canvas/WebGL visualisers. **[unverified on this specific TCL hardware]**, but a full-screen
  per-frame canvas is the most likely thing to break the measured 60 fps.
- Blanket `will-change` across many layers — each promoted layer costs GPU memory, the scarce
  resource on a TV SoC.

**Burn-in and long-session risk** — TVs hold this screen for hours; OLED panels retain static
elements and some sets dim regions they detect as static
(<https://www.xda-developers.com/oled-tv-settings-i-always-enable-to-prevent-burn-in/>).
- Never leave a bright, static, high-contrast element pinned to one pixel region for a whole
  album. Give the transport row and any logo the slow ambient drift from §5 #10.
- Avoid pure `#FFFFFF` fills and full-brightness accent blocks over large areas; the `#0B0B10`
  base already helps.
- After ~5 minutes with no D-pad input, fade the chrome out and let the disc plus colour field
  own the screen. This is simultaneously an anti-burn-in measure and the "special" ambient mode.

**Will break at 3 metres**
- Motion with an amplitude under ~2 px — invisible at 3 m, so it burns frames for nothing.
  (Exception: the deliberately sub-threshold cues, §5 #9 and #10, which are *meant* to go
  unnoticed.)
- Groove textures thinner than ~2 px — they alias into moiré on a 1080p surface scaled to a 4K
  panel. Make grooves coarser than looks right on a monitor.
- Text under ~24 px at 1080p, and thin weights over a coloured wash.
- Any information requiring two lines of reading. Android's TV foundations: low information
  density, minimise reading, elements large and well spaced
  (<https://developer.android.com/design/ui/tv/guides/foundations/design-for-tv>).
- Hover-derived effects. There is no pointer; every affordance must be focus-driven.

---

## Sources

- <https://github.com/emilkowalski/skills> — raw files under
  `raw.githubusercontent.com/emilkowalski/skills/main/skills/{animate,review-animations,emil-design-eng,apple-design}/`
- <https://github.com/jnMetaCode/agency-agents-zh>
- <https://help.apple.com/itc/albummotionguide/en.lproj/static.html>
- <https://developer.android.com/design/ui/tv/guides/foundations/design-for-tv>
- <https://tympanus.net/codrops/2016/06/15/interactive-record-player/> · <https://github.com/codrops/RecordPlayer>
- <https://www.pyxofy.com/css-animation-turntable-part-1/> · <https://www.pyxofy.com/css-animation-turntable-part-2/>
- <https://github.com/Babuptx/audiophile-turntable>
- <https://github.com/ShehabEMohsen/VinylMusicPlayer> · <https://github.com/subhajitroycode/record-player> · <https://github.com/AMEND09/SpotifyVinyl>
- <https://www.shadcn.io/blocks/music-vinyl-player>
- <https://codepen.io/schooolman/pen/PZyajv> · <https://codepen.io/RedCactus/pen/zZopaY> · <https://codepen.io/jehanf/pen/mwOPNj>
- <https://www.plex.tv/plexamp/>
- <https://imusician.pro/en/resources/guides/spotify-canvas>
- <https://www.xda-developers.com/oled-tv-settings-i-always-enable-to-prevent-burn-in/>
- <https://discussions.apple.com/thread/255113940>
