# VOTE-002: How does the user enter a search query without a keyboard?

- **GATE**: G4 — D-pad Navigation
- **STATUS**: decided — **Option A (on-screen grid keyboard)** ships in v1.
  The phone-as-remote enhancement the navigation model recommends was **split
  out and escalated**; see [ESCALATION-001](ESCALATION-001-phone-as-remote-input.md).

## Question

Search is the only place in the app that needs free text. A D-pad remote has six
usable keys. Typing "Beyoncé" on an on-screen grid keyboard is roughly 30 key
presses. Which method ships in v1?

## Process note — why this vote was narrowed

`docs/design/NAVIGATION_MODEL.md` recommends **phone-as-remote as primary, with
the grid keyboard as the always-present fallback**, and the reasoning is sound:
music search is dominated by proper nouns, which are exactly what a grid
keyboard is slowest at and what voice mishears most often.

But phone-as-remote works by reusing the pairing session to accept input from
the paired phone. That is a change to what the pairing session is for and what
it is allowed to carry — an **auth-surface change**, which charter §4.5 makes
non-votable. The panel therefore voted only on what ships in v1 as the floor,
and referred the enhancement to the human user.

This is the intended behaviour of the process, not a blocker: v1 gets a complete,
working search either way.

## Options

| | Option | Cost | Risk |
|---|---|---|---|
| A | **On-screen grid keyboard**, fully D-pad driven | Low — pure HTML/CSS/JS, no new dependency, no platform API | Slow for long queries; users may abandon search |
| B | **Voice search** via the Google TV remote's assistant | High — needs native Android plumbing not reachable from a WebView | Not available on every device; hardest to test; mishears proper nouns |
| C | **No free-text search in v1** — browse only (library, recents, recommendations) | Lowest — removes a screen | Users expect search; reads as an incomplete app |

## Recommendation

**A.** It is the only option that works on every device with no platform
dependency, and it is the floor under every other method: the phone may be dead,
in another room, or belong to someone who is not the account holder.

## Result

| Seat | Agent | Vote | Reason |
|---|---|---|---|
| 1 | SeniorProjectManager (chair) | A | Only option with no external dependency; ships inside G4 as planned. |
| 2 | Software Architect | A | B needs a native bridge we do not have and cannot test in a WebView. |
| 3 | Frontend/TV Developer | A | Built and verified in the prototype: 6×6 grid, SPACE and DELETE, results reachable with RIGHT from any key. |
| 4 | UX Architect | A | A is the mandatory floor whatever else we add. Voting for it does not preclude the phone path. |
| 5 | QA / Test Results Analyzer | A | The only option testable today without a physical device. C would leave a hole QA cannot sign off as "search works". |

**Tally**: A = 5, B = 0, C = 0
**Winner**: **A — on-screen grid keyboard**
**Dissents**: none.

## Consequences recorded

- The keyboard is a 6-wide grid of `A–Z` and `0–9`, plus double-width `SPACE`
  and `DELETE`. Layout lives in one place (`KEY_ROWS` in `public/tv/scripts/app.js`),
  not duplicated in markup.
- RIGHT from any key jumps to the results list, so the user is never forced to
  traverse the whole keyboard to reach a result.
- BACK inside search with a non-empty query deletes the last character, matching
  every TV keyboard on the market, before it means "leave the screen".
- Voice (option B) is not rejected forever — it is out of v1 because it is
  untestable without the device. Revisit after gate G5.
