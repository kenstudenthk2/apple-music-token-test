# AppleTune TV — Navigation Model & Information Architecture

**Owner:** ArchitectUX
**Scope:** D-pad-only navigation engine + screen map. Not visual design, not app UI.
**Input device contract:** UP / DOWN / LEFT / RIGHT / OK / BACK are guaranteed. PLAY-PAUSE and
transport keys are *optional* — every action they perform MUST also be reachable with the six
guaranteed keys. No touch, no pointer, no hardware keyboard.

---

## 1. Screen Map

### 1.1 Screen inventory

| ID | Screen | Purpose | Entered from |
|----|--------|---------|--------------|
| `S0` | Boot / Splash | Restore session, probe network, decide first real screen | app launch |
| `S1` | QR Login | Show pairing code + QR, poll `pairing-server.js` for authorization | S0 (no valid session), S8 (sign out), S9 (re-auth required) |
| `S2` | Pairing Success | 2s confirmation, "Signed in as …" | S1 |
| `S3` | **Home** | Root screen. Rows: Good Evening / Recently Played / Made For You / Your Library / Now Playing bar | S2, BACK from any depth-1 screen |
| `S4` | Library | Tabbed browse: Playlists / Albums / Artists / Songs | S3 |
| `S5` | Search | Catalog + library search, no hardware keyboard | S3 |
| `S6` | Detail | Album or Playlist track list + actions | S3, S4, S5, S7 |
| `S7` | Now Playing | Full-screen player, transport + queue | any play action, Now Playing bar |
| `S8` | Settings | Account, playback quality, ambient mode, sign out | S3 |
| `S9` | Error / Offline | Blocking or inline failure states (see section 7) | any screen |
| `SA` | Ambient / Screensaver | Idle art + clock, burn-in safe | S7 or S3 after idle timer |
| `SX` | Exit Confirm | Modal: "Leave AppleTune?" | BACK at S3 root |

### 1.2 Transitions

```
              +----------+
              | S0 Boot  |
              +----+-----+
       valid token | no / expired token
        +----------+-----------+
        v                      v
   +---------+            +---------+   authorized   +---------+
   | S3 Home |<-----------| S1 QR   |--------------->| S2 OK   |--+
   +--+--+---+   BACK     +---------+                +---------+  |
      |  |                      ^                                 |
      |  |                      +---------------------------------+
      |  |
      |  +-- OK on "Library"  --> S4 Library --OK--> S6 Detail --OK--> S7 Now Playing
      |  +-- OK on "Search"   --> S5 Search  --OK--> S6 Detail --OK--> S7 Now Playing
      |  +-- OK on any card   --> plays immediately --> S7 Now Playing
      |  +-- LONG-OK on card  --> S6 Detail
      |  +-- OK on NowPlaying bar --> S7 Now Playing
      |  +-- OK on gear       --> S8 Settings
      |  +-- BACK             --> SX Exit Confirm
      |
      +-- idle 5 min --> SA Ambient --any key--> back to originating screen

  S7 Now Playing --RIGHT past last transport control--> queue drawer (same screen, focus group)
  S7 --OK on album art--> S6 Detail of the current item
  S9 Error can overlay ANY screen; BACK dismisses to the screen underneath
     (except fatal auth errors, which route to S1).
```

**Depth rule:** the stack is never deeper than 3 (Home → Detail → Now Playing). Any deeper
navigation replaces the top of stack instead of pushing, so BACK is always at most 3 presses
from Home. Now Playing never pushes another Now Playing.

---

## 2. BACK Button Contract

BACK is the single most abused key on TV remotes. The contract is: **BACK never destroys
state and never leaves the app silently.**

| Screen | BACK does | Notes |
|--------|-----------|-------|
| `S0` Boot | Nothing (swallowed) | Boot is non-interruptible; ignore to avoid a black-screen exit. |
| `S1` QR Login | Opens `SX` Exit Confirm | User is not signed in; the only way out is leaving. Never silently exit — they may have pressed BACK by reflex while the phone was mid-scan. |
| `S2` Pairing Success | Swallowed | 2s auto-advance screen; BACK would race the transition. |
| `S3` Home — focus inside a content row | Move focus to the **first item of that row** | "Escape the row" gesture. Cheap undo of a long RIGHT-hold. |
| `S3` Home — focus already on first item of a row | Move focus **up to the top nav / Good Evening row** | |
| `S3` Home — focus on top nav (root position) | Open `SX` Exit Confirm | **Never exits directly.** |
| `S4` Library | If a tab filter / sub-view is open, close it. Else go to `S3` Home, restoring Home's remembered focus. | |
| `S5` Search — keyboard focused, query non-empty | Delete last character | Matches every TV keyboard on the market; BACK *is* backspace. |
| `S5` Search — query empty, or focus in results | Return to `S3` Home | |
| `S6` Detail | Return to the screen that opened it (`S3`/`S4`/`S5`), restoring that screen's focus | Detail never becomes a root. |
| `S7` Now Playing — queue drawer open | Close drawer, focus returns to transport row | |
| `S7` Now Playing — drawer closed | Return to previous screen, **playback continues uninterrupted** | BACK is "hide the player", not "stop the music". The Now Playing bar on Home returns the user in one OK. |
| `S8` Settings — sub-panel open | Close sub-panel | |
| `S8` Settings — root of settings | Return to `S3` Home | |
| `S9` Error overlay (recoverable) | Dismiss overlay, return to screen underneath | |
| `S9` Error (fatal auth / no session) | Route to `S1` QR Login | Cannot dismiss into a broken app. |
| `SA` Ambient | Wake, return to originating screen. BACK is consumed by the wake. | First key press only wakes; it is never also an action. |
| `SX` Exit Confirm | Dismiss dialog, return to `S3` (or `S1`) with prior focus | BACK on the confirm dialog means "no, stay". |

**Exit Confirm (`SX`)**: two buttons, focus defaults to **"Stay"**. Choosing "Leave" calls the
platform exit. If music is playing, the dialog adds "Music will stop." and offers a third
option, "Leave and keep playing" (background playback), focus still on Stay.

**Double-BACK is not used.** A timed double-press is undiscoverable and fails for users with
motor impairments who repeat-press. An explicit dialog costs one extra press and is honest.

---

## 3. Focus Rules

### 3.1 Initial focus per screen

| Screen | Focus lands on |
|--------|----------------|
| `S1` QR Login | The QR card itself (a no-op focusable), so the screen always has a focus ring and the arrow keys have a defined origin. "Enter code manually" is deliberately not the default. |
| `S3` Home (first visit) | First card of the **Recently Played** row — the highest-probability target. Not the top nav; nav is one UP away. |
| `S3` Home (return visit) | Remembered element (see 3.3). |
| `S4` Library | Active tab in the tab strip, not the grid — the user came here to choose a category. |
| `S5` Search | First key of the on-screen keyboard (`A`) if the query is empty; first result if returning with an existing query. |
| `S6` Detail | The **Play** button, not track 1. One OK plays the whole thing. |
| `S7` Now Playing | Play/Pause button in the transport row. |
| `S8` Settings | First settings row. |
| `S9` Error | The primary recovery action ("Retry" / "Sign in again"). |
| `SX` Exit Confirm | "Stay". |

Rule: **focus always lands on the action the user most likely came for, and never on a
destructive control.**

### 3.2 Row edges — STOP, do not wrap

Focus **stops** at the edge of a row and at the top/bottom of a screen. Chosen over wrapping:

1. A 10-foot UI is a *spatial plane*. Wrapping teleports focus across the screen — the eye
   loses the ring and the user re-orients from scratch. Stopping preserves the mental model.
2. Users hold RIGHT to scroll long rows. With wrapping, a held key silently loops back to
   item 1 and the user believes the row is short or the app is broken.
3. Stopping gives the row edge a physical meaning, which the "escape the row" BACK gesture
   (section 2) depends on.

Edge feedback is required, not optional: a 120ms **nudge** (8px translate, ease-back) on the
focused element plus a subtle shadow on the wall being hit. A silent no-op reads as a dropped
input and provokes repeated pressing.

**Exception — vertical only:** pressing UP from the first content row moves to the top nav
bar; pressing UP again stops. Pressing DOWN from the last row moves to the Now Playing bar if
present; otherwise stops.

### 3.3 Focus memory

Three layers, all handled by `spatial-nav.js`:

- **Group memory** — every `[data-focus-group]` (a row, a tab strip, the transport bar)
  remembers its last focused child. Entering a group vertically restores that child, so
  moving DOWN out of a row and back UP returns you where you were, not to item 1.
- **Screen memory** — each screen records its focused element ID on exit. Returning from a
  pushed screen (Detail → Home) restores it exactly. Restored focus is scrolled into view
  *without* animation, so the screen appears already-positioned rather than jumping.
- **Session memory** — Home's focus survives Ambient mode and app resume within the same
  session. It resets on cold start (back to Recently Played item 1).

Horizontal movement inside a group always uses geometry, never memory — memory only applies
when *entering* a group from outside.

### 3.4 Focus while content is loading

- Skeleton placeholders are **focusable** and carry `data-focusable data-loading`. This keeps
  the focus ring present and the arrow keys meaningful before data arrives.
- OK on a loading placeholder is swallowed (with the nudge animation), never queued. A queued
  OK that fires 2s later on now-different content is the classic TV mis-launch bug.
- When real data replaces a skeleton, focus transfers to the element at the same index in the
  same group. If the row returns fewer items than the focused index, focus moves to the last
  real item.
- If a row returns **empty**, it collapses out of the layout. If focus was inside it, focus
  moves to the nearest row below, else above. Never leave focus on a removed node — the
  engine's `MutationObserver` re-homes focus to the nearest focusable within one frame.
- Screens must never steal focus after the user has already moved it. Late-arriving data
  changes content, never focus position.

---

## 4. The 3-Click Rule

**Claim:** from Home, "start playing something I like" costs **3 or fewer actions** (D-pad
presses and OK combined), on every one of these paths.

Home layout, top to bottom:

```
[ top nav: Search   Library   Settings ]
Good Evening        [ Mix 1 ][ Mix 2 ][ Mix 3 ][ Mix 4 ]
Recently Played     [ card ][ card ][ card ][ card ] ...   <- initial focus, card 1
Made For You        [ card ][ card ][ card ][ card ] ...
Your Library        [ card ][ card ][ card ][ card ] ...
[ Now Playing bar ]
```

| Intent | Key sequence | Count | Result |
|--------|--------------|-------|--------|
| Resume the thing I was last listening to | `OK` | **1** | Recently Played card 1 plays immediately. |
| Play a different recent item | `RIGHT`, `OK` | **2** | Recently Played card 2 plays. |
| Play a personalised mix | `UP`, `OK` | **2** | Good Evening tile 1 (a Made-For-You mix) plays. |
| Play a specific Made For You mix | `DOWN`, `RIGHT`, `OK` | **3** | Made For You card 2 plays. |
| Play from my library | `DOWN`, `DOWN`, `OK` | **3** | Your Library card 1 plays. |

**Design constraints this imposes — binding on the UI implementation:**

1. Cards in **Recently Played**, **Good Evening** and **Made For You** are **play-on-OK**.
   They do not open a detail screen. Detail is reached by LONG-OK (press-and-hold, 500ms) or
   from the Now Playing screen's album art. This is the single decision that makes 3 clicks
   possible; an open-detail-then-press-Play model costs 4 minimum.
2. **Your Library** cards are also play-on-OK (play the collection from its first track).
3. Initial focus on Home is Recently Played card 1 — never the top nav, which would add a
   mandatory DOWN to every single path.
4. The Good Evening row must sit directly above Recently Played so it is one UP away.

Worst case for an *unfamiliar* item (browse, choose, play) is 5 actions via Library, which is
acceptable because that is a deliberate browse, not the "play something I like" case.

---

## 5. Text Entry Without a Keyboard

### Options compared

| | On-screen grid keyboard | Voice | Phone-as-remote |
|---|---|---|---|
| Works on every device | Yes | No — needs a mic remote and Assistant certification | Yes (a phone is already required for login) |
| Cost per query | ~30–45 D-pad presses for "kendrick lamar" | 1 press plus speech | ~10s of phone typing |
| Accuracy | High, slow | Poor on artist/track names, non-English titles, stylised spellings | High |
| Infrastructure needed | None | Assistant integration, Play certification, privacy disclosure | **Already built** — `pairing-server.js` + `public/activate.html` |
| Accessibility | Baseline for everyone | Excludes non-speech users and noisy rooms | Excludes users without the phone to hand |
| Discoverability | Obvious | Requires a prompt | Requires prompt plus QR |

### Recommendation: **phone-as-remote as primary, on-screen grid keyboard as the always-present fallback.**

Reasoning:

1. **The transport already exists and is already trusted.** The QR pairing channel
   (`pairing-server.js` ↔ `activate.html`) is a working, authenticated device-to-device
   socket. A search query is the same shape of message as the auth handshake — near-zero new
   infrastructure and no new trust boundary, since the phone is already the device that
   authorised the account.
2. **It is the only option that makes long, awkward queries cheap.** Apple Music search is
   dominated by proper nouns; a grid keyboard costs ~40 presses and voice mishears them.
3. **Voice is deferred, not rejected.** Add it later as a platform intent (Android TV
   "play X on AppleTune") rather than an in-app mic button — that is where users expect it and
   it needs no in-app UI. It is a certification project, not a navigation decision.
4. **The grid keyboard is mandatory regardless.** The phone may be dead, elsewhere, or the
   viewer may not be the account holder. The keyboard is the floor, not the ceiling.

**Search screen (`S5`) layout:** left third is an on-screen **alphabetical grid** (5 rows x 6 —
alphabetical beats QWERTY for D-pad because target position is predictable); right two-thirds
is live results updating per keystroke. A persistent "Type on your phone" card sits above the
keyboard showing a short room code; focusing it and pressing OK shows the QR. Results are
reachable with RIGHT from any keyboard key, so the user is never forced to traverse the whole
keyboard to reach a result.

Search must also be usable **without ever typing**: the empty state shows Recent Searches,
Trending, and Genre tiles, all play-on-OK.

---

## 6. Long-Session Behaviour

TV panels — especially OLED — burn in. A music app holds one near-static screen for hours;
this is the highest burn-in-risk category of TV app there is.

| Condition | Timing | Behaviour |
|-----------|--------|-----------|
| Playing, remote untouched | **5 min** | Fade to `SA` **Ambient**: album art, track title and clock only. UI chrome, focus ring, progress bar and buttons are all removed. |
| Playing, in Ambient | every **60s** | The whole ambient composition translates on a slow Lissajous path within a ±5% viewport box, and dims one step per hour to a floor of 50% luminance. |
| Playing, in Ambient | every **15 min** | Layout variant swaps (art left / art centred / art right) so no element ever holds one pixel region. |
| Paused, remote untouched | **2 min** | Ambient with a "Paused" glyph. |
| Paused, remote untouched | **20 min** | Release playback focus and hand off to the platform screensaver / allow system sleep. Do not hold a wake lock while paused. |
| Any key while in Ambient | — | **Wake only.** The keypress is consumed restoring the prior screen and its focus; it never also activates a control. PLAY-PAUSE is the one exception — it wakes *and* toggles playback, because that is unambiguous. |
| Playing, more than 4 hours continuous | — | Show a dismissible "Still listening?" prompt inside Ambient. No auto-stop; stopping someone's music unprompted is worse than the alternative. |

**Burn-in mitigation rules binding on the UI:**

- No permanently-positioned bright element. Logo, clock and Now Playing bar all participate in
  the pixel shift.
- No pure `#FFFFFF` over large areas; cap text luminance at roughly 92%.
- Full-bleed album art in Ambient is scaled to 96% and shifted, never pinned edge to edge.
- Ambient must be disableable in `S8` Settings (some users want the art as a display piece),
  with an explicit burn-in warning on that toggle.

---

## 7. Error States

Every error answers three questions on screen: **what happened**, **what the app is doing
about it**, **what the user's one next action is.** Never a bare code.

| State | Detection | What the user sees | Next action | Focus |
|-------|-----------|--------------------|-------------|-------|
| **Token expired / invalid** | 401/403 from Apple Music API | Full screen: "Your Apple Music session has ended." Playback stops after the buffered audio of the current track. | Primary button "Sign in again" → `S1`. Secondary "Not now" → Home in a degraded, browse-only state. | "Sign in again" |
| **Network lost mid-song** | fetch failure, or stall longer than 8s | Playback continues from buffer. Inline banner on `S7`: "Connection lost — reconnecting…" with auto-retry (backoff 2s/4s/8s/15s). Buffer exhausted → "Playback paused. Waiting for your network." | None required — it auto-recovers and resumes at the exact position. A manual "Retry now" is focusable in the banner. | Unchanged; Retry only if the user moves to it |
| **Network lost while browsing** | same | `S9` Offline screen, but Recently Played stays listed and greyed. | "Try again"; also auto-retries every 15s. | "Try again" |
| **Subscription lapsed** | 403 with subscription status | "Your Apple Music subscription is inactive." Explains that the TV cannot fix it. Shows a QR to the Apple Music account page. | "Scan to manage on your phone" / "Sign in with a different account". | QR card |
| **DRM / playback unavailable** | key-session or licence failure, or region-restricted item | Item level, not app level: the item carries a lock badge, and OK shows "This track can't be played on this device." Playback skips to the next playable queue item after 3s, with a visible countdown the user can cancel. | "Skip" (default) / "Stay here". | "Skip" |
| **Empty library** | 200 with 0 items | Not an error screen. Home shows Made For You plus Charts and an "Add music on your phone" card. | Browse. | First playable card |

> **HUMAN DECISION REQUIRED — do not design past this line.**
> Every state above that says *"Sign in again"* needs a re-authentication mechanism, and this
> design deliberately stops at the button. Whether re-auth is (a) a silent refresh-token
> exchange, (b) a fresh QR pairing round trip, (c) a short-lived stored Apple Music User Token
> with a defined lifetime, or (d) something the Apple Music developer-token terms constrain,
> is a security and licensing decision, not a UX one. The navigation model guarantees only
> this: **the app always surfaces the expired state explicitly, never fails silently, never
> drops the user on a blank Home, and always routes re-auth through exactly one screen
> (`S1`)** so whichever mechanism is chosen has a single integration point.
> Flagged for: team lead / whoever owns `pairing-server.js` and the Apple Music token policy.

**Error presentation rules:** recoverable errors are inline banners (never steal the screen
during playback); unrecoverable errors are full screens. An error never removes focus from
where the user put it unless it is full-screen. Error text never contains an HTTP code in the
primary line; codes go in a small monospace line at the bottom, for support.

---

## 8. Remote Key Map

`Back` covers keyCode **27** (browser Esc), **461** (webOS), **10009** (Tizen) and Android TV
`KEYCODE_BACK`. All are mapped identically.

| Key | `S3` Home | `S4` Library | `S5` Search | `S6` Detail | `S7` Now Playing | `SA` Ambient |
|-----|-----------|--------------|-------------|-------------|------------------|--------------|
| **UP** | previous row / to top nav | previous row / to tab strip | previous keyboard row | previous item / to Play button | to progress + art zone | wake |
| **DOWN** | next row / to Now Playing bar | next row | next keyboard row | next item | to queue / lyrics tabs | wake |
| **LEFT** | previous card (stops at edge) | previous card / to tab strip | previous key; from results back to keyboard | previous action | previous transport control | wake |
| **RIGHT** | next card (stops at edge) | next card | next key; from last column into results | next action | next transport control; from the last one, open queue drawer | wake |
| **OK** | play focused card | open focused item | type key / choose result | activate focused action | activate focused control | wake |
| **LONG-OK** (500ms) | open detail for focused card | context menu | — | context menu (add to library, go to artist) | — | wake |
| **BACK** | to row start, then to nav, then `SX` | close filter, then Home | backspace, then Home | previous screen | close drawer, then previous screen (music keeps playing) | wake (consumed) |
| **PLAY-PAUSE** | toggle current playback | toggle | toggle | toggle | toggle | wake and toggle |
| **NEXT / PREV** (opt.) | queue skip | queue skip | queue skip | queue skip | queue skip | wake and skip |
| **FF / REW** (opt.) | seek ±15s | seek ±15s | seek ±15s | seek ±15s | seek ±15s, held = scrub | wake and seek |
| **STOP** (opt.) | stop, keep queue | same | same | same | same | wake and stop |
| Unmapped keys | swallowed, no-op, no error message | | | | | wake |

Media keys must work **globally**, not only on `S7` — a user browsing Library expects
PLAY-PAUSE to pause the music, not do nothing.

---

## 9. Engine Contract

Implemented by `public/tv/scripts/spatial-nav.js`.

```js
import nav from './scripts/spatial-nav.js';

nav.init(document.getElementById('app'));   // discover [data-focusable], bind keys
nav.focus(document.querySelector('#recent-1'));
nav.setEnabled(false);                      // freeze during transitions / modals
const off = nav.onBack(() => { /* return true if consumed */ });
document.addEventListener('spatialfocus', e => e.detail.element /* .previous, .direction */);
```

Markup contract:

```html
<div data-focus-group="row-recent" data-focus-scroll="horizontal" data-focus-offset="64">
  <div data-focusable id="recent-1">…</div>
  <div data-focusable id="recent-2">…</div>
</div>
```

| Attribute | Meaning |
|-----------|---------|
| `data-focusable` | Element participates in navigation. |
| `data-focus-group` | Container with a remembered last-focused child; entering vertically restores that memory. |
| `data-focus-scroll` | `horizontal` or `vertical` — how this group scrolls its focused child into view. |
| `data-focus-offset` | Pixels from the container's leading edge at which to hold the focused item (default 48) — keeps rows aligned instead of centring erratically. |
| `data-loading` | Skeleton: focusable, but OK is swallowed. |
| `data-focus-disabled` | Temporarily skipped by the resolver. |
| `.is-focused` | Applied by the engine; all focus styling hangs off this class. |

---

**Handoff:** UI implementation may begin against the section 9 markup contract. The three
binding constraints are: play-on-OK cards (section 4), stop-at-edge with nudge feedback
(section 3.2), and BACK never exiting without `SX` (section 2).
