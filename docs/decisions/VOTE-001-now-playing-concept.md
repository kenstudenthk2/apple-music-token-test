# VOTE-001: Which Now Playing treatment ships in v1?

- **GATE**: G3 — TV UI Prototype
- **STATUS**: decided — **Option A (Rotating Vinyl over an Adaptive Ambient Wash)**

## Question

The Now Playing screen is the screen a living-room viewer stares at for the
longest continuous stretch, often from across the room and often while doing
something else. Which single treatment ships in v1?

Constraints that bound every option:
- Must render at 1920×1080 and stay legible from 3 m.
- TV GPUs are weak: `transform` and `opacity` only, no per-frame layout.
- Must be operable and readable with the remote untouched for long periods
  (burn-in and idle behaviour matter).
- Artwork comes from the Apple Music API; the app may not modify or crop it in
  ways Apple's Identity Guidelines forbid.

Three findings from `docs/research/TV_UX_RESEARCH.md` eliminated options before
the vote and are worth recording, because each one would otherwise have been
designed and then thrown away:

| Finding | Consequence |
|---|---|
| The Apple Music API `Artwork` object already returns `bgColor` and `textColor1`–`textColor4` | No client-side colour extraction. No canvas, no CORS, no main-thread cost. The adaptive palette is free. |
| Apple Music playback is DRM-protected, so raw PCM never reaches Web Audio | A real audio-reactive visualiser is **impossible**, not merely expensive. Concept C9 is out. |
| Time-synced lyrics are not exposed by the public API | Lyrics are an optional slot that may stay empty forever, never a hero feature. Concept C7 is out of v1. |

## Options

| | Option | Cost | Risk |
|---|---|---|---|
| A | **Rotating vinyl disc** (research C3) carrying the artwork as its label, over an **adaptive ambient wash** (C1) driven by the artwork's own colours | Low — one `rotate` keyframe plus one `background`; both composited | Vinyl is a skeuomorphic reference; risks reading as dated if executed heavily |
| B | **UltraBlur backdrop** (C2) — the artwork square, sharp and centred, over a heavily blurred blow-up of itself | Lowest — the treatment most TV music apps already ship | Generic. Indistinguishable from Spotify/Tidal/Plex at a glance |
| C | **Mesh-gradient drift** (C4) — no artwork on the hero at all, only slow-moving colour fields derived from the palette | Medium — needs a gradient engine and careful motion tuning | Hides the artwork, which is the single thing users identify a song by |

## Recommendation

**A.** It is the only option that is both cheap on a weak GPU and visually
distinct from every competitor, and the rotation doubles as an honest
now-playing indicator: the disc spins while audio plays and stops when it
pauses, which is legible from across a room with no text at all.

## Result

| Seat | Agent | Vote | Reason |
|---|---|---|---|
| 1 | SeniorProjectManager (chair) | A | Cheapest to build of the three that are not generic; ships inside G3 without new tooling. |
| 2 | Software Architect | A | One keyframe and one background layer. B is equally cheap but buys nothing we could not add later. |
| 3 | Frontend/TV Developer | A | Rotation is a single composited `transform`; `animation-play-state` gives pause for free with no JS. |
| 4 | UX Architect (sub for Backend — design question, per §4.1) | A | The spinning disc answers "is it playing?" without text, which is what a 3 m viewing distance demands. |
| 5 | QA / Test Results Analyzer | B | Dissent: B has the widest device track record. A rotating layer is the first thing to stutter on an Amlogic S905. |

**Tally**: A = 4, B = 1, C = 0
**Winner**: **A — Rotating vinyl over an adaptive ambient wash**
**Dissents**: QA (seat 5) for B, on GPU risk.

### Dissent carried forward

QA's objection is not dismissed. It becomes a measured check at gate G4 on the
real device:

- If the vinyl rotation drops the Now Playing screen below **30 fps sustained**
  on the target hardware, the rotation is disabled and the screen degrades to
  option B — the artwork simply stops spinning. No other change is needed,
  because the disc and the wash are separate layers.
- `prefers-reduced-motion` already disables the rotation and the wash drift.

## Consequences recorded

- The ambient wash is driven by a single CSS custom property, `--art-accent`,
  which the app rewrites per track. `tokens.css` derives the soft, glow and
  bloom variants from it. In the real app that value comes from the API's
  `bgColor`, not from pixel sampling.
- Idle ambient mode (research C6) is **deferred to v2** but must not be designed
  out: the vinyl + wash layers are exactly what an idle screensaver would use.
- Concept C9 (audio-reactive visualiser) is permanently rejected on the DRM
  finding above. Do not re-propose it.
