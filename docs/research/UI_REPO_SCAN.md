# Repo scan — what can actually help this UI

**Audience: the project owner.** A verdict on each candidate, not a link dump.

## The filter everything is judged against

This project has constraints that disqualify most attractive-looking repos, so
they are stated once here rather than repeated per row:

| Constraint | Consequence |
|---|---|
| No build step, no framework | React/Tailwind repos cannot be dropped in. Their **CSS and technique** can still be studied |
| Animate only `transform` and `opacity` | Anything animating `filter`, `box-shadow` or layout is unusable as-is on a TV SoC |
| Android WebView on a TV | No hover, no pointer, D-pad only |
| Already have a working spatial-nav engine | A navigation library would be a *replacement*, not an addition |

So the useful question is not "is this repo good" but **"can this repo change what
we ship"**. Most cannot. The ones that can are marked ⭐.

---

## Vinyl and turntable

| Repo | What it is | Verdict |
|---|---|---|
| ⭐ [jefferey/scratchable-turntable](https://github.com/jefferey/scratchable-turntable) | Vanilla JS + SVG turntable, no libraries, no image files, MIT | **The most directly usable thing found.** No framework, no build step, no assets — grooves and platter drawn as SVG. Exactly our stack. Worth reading for how it constructs a record without a bitmap |
| [ShehabEMohsen/VinylMusicPlayer](https://github.com/ShehabEMohsen/VinylMusicPlayer) | Spotify-connected player, CSS spins the record and moves the tonearm on play | The **tonearm-on-play** behaviour is the single detail our disc is missing. The README does not show the CSS; the implementation has to be read in the repo |
| [shadcn vinyl player block](https://www.shadcn.io/blocks/music-vinyl-player) | CSS-rotated record, label art, tonearm swings into position on play | React + framer-motion + Tailwind, so not droppable. But it confirms the interaction grammar: **the arm moving is what sells "playing"**, more than the spin |
| [subhajitroycode/record-player](https://github.com/subhajitroycode/record-player) | React + Spotify SDK, "realistic record spinning and needle movement" | Reference for feel only |
| [ApolloEagle/vinyl-spin](https://github.com/ApolloEagle/vinyl-spin) | Small React/TS/Tailwind spin component | Nothing we do not already have |
| [bitu467/record-player](https://github.com/bitu467/record-player) | Plain HTML/CSS/JS turntable | Same category as the first, less complete |

**The finding that matters:** every convincing implementation has a **tonearm**.
Ours does not. A disc rotating on its own reads as a spinning square with a
circular mask; an arm resting on the record is what makes the eye accept it as
playing. That is one new element and one `rotate` transform — the cheapest
large improvement available.

---

## TV navigation

| Repo | Verdict |
|---|---|
| [NoriginMedia/Norigin-Spatial-Navigation](https://github.com/NoriginMedia/Norigin-Spatial-Navigation) | MIT, production-proven on Tizen, webOS, Hisense, Vizio. **But it requires React**, and we already have a working engine measured at 6/6 on the G4 audit. Adopting it means a rewrite to gain nothing we lack — and its docs do not even describe row containment, which we added tonight after your LEFT bug |
| [Vue 3 spatial navigation](https://github.com/topics/tv-ui) | Same reasoning, plus Vue |

**Verdict: keep ours.** This is the clearest "no" in the scan. Worth knowing it
exists if we ever regret the decision, not worth acting on.

---

## Now Playing and ambient treatment

| Repo | Worth stealing |
|---|---|
| ⭐ [rajsriv/muzik-Player](https://github.com/rajsriv/muzik-Player/) | "Dynamic album-art-driven accent colors… tinting icons, backgrounds and interactive elements in real time." We already derive an accent from Apple's `bgColor` but only apply it in a few places. This repo's lesson is **commitment** — tint everything, so the whole screen changes character per album |
| [cromaguy/Rhythm](https://github.com/cromaguy/Rhythm) | Material 3 Expressive, Kotlin. Not our stack; useful as a taste reference for how far expressive can go without becoming noisy |
| [namidaco/namida](https://github.com/namidaco/namida) | "Thumbnail animates with the current audio peak" — **we cannot do this.** Apple Music is DRM-protected, so raw PCM never reaches Web Audio. Recorded here so nobody proposes it again |
| [mardous/BoomingMusic](https://github.com/mardous/BoomingMusic) | Clean Material reference |

---

## What I would actually take

Ranked by change-per-effort, all within the performance contract:

1. **A tonearm.** One element, one rotation, moves in on play and lifts on pause.
   Every good implementation has one and ours does not.
2. **Spin-up and spin-down inertia.** A record does not reach speed instantly.
   Easing the rotation in over ~800ms and letting it coast down is pure
   `animation-timing-function` — no extra layers.
3. **Commit to the album colour.** We extract Apple's palette and then barely
   use it. Tint the transport, the progress fill, the ambient wash and the
   focus glow from the same source, so each album genuinely looks different.
4. **A specular highlight that sweeps as the disc turns.** One extra layer,
   `transform` only, and it is what makes vinyl read as a physical object
   rather than a flat circle.
5. **Read `scratchable-turntable` before drawing grooves.** It solves "a record
   without a bitmap" in exactly our stack, MIT licensed.

## What I would not take

- **A navigation library.** Ours passes the audit and now contains rows properly.
- **Audio-reactive anything.** DRM makes it impossible, not merely expensive.
- **Any React component.** Not droppable, and rebuilding one by hand costs more
  than writing the CSS directly against our own tokens.

---

## Sources

- https://github.com/jefferey/scratchable-turntable
- https://github.com/ShehabEMohsen/VinylMusicPlayer
- https://www.shadcn.io/blocks/music-vinyl-player
- https://github.com/subhajitroycode/record-player
- https://github.com/ApolloEagle/vinyl-spin
- https://github.com/bitu467/record-player
- https://github.com/NoriginMedia/Norigin-Spatial-Navigation
- https://github.com/rajsriv/muzik-Player/
- https://github.com/cromaguy/Rhythm
- https://github.com/namidaco/namida
- https://github.com/mardous/BoomingMusic
