# VOTE-003: What does BACK do on Home?

- **GATE**: G4 — D-pad Navigation
- **STATUS**: decided — **Option C**

## Why this vote exists

The charter and the implementation contradict each other, and G4 cannot be
judged until one of them gives way.

| Source | Says |
|---|---|
| `PROJECT_CHARTER.md` §2, G4 criterion 3 | "BACK on Library Home **exits the app**" |
| `app.js` `handleBack()` | returns `true` on Home — the press is consumed, the app never exits |
| `NAVIGATION_MODEL.md` | root BACK "must NOT dump the user out of the app without confirmation" |
| `STORYBOARD.md` | records the missing exit-confirm dialog as an open gap |

As written, criterion 3 is unpassable against the current build. Either the
criterion is wrong or the code is. This is a UX question with no auth surface,
so it is a panel decision.

## What makes it non-obvious

Android's platform convention is that BACK eventually returns the user to the
launcher, and TV users expect that — being unable to leave an app with the
button that means "leave" is genuinely bad.

But on this app BACK-to-exit is not free: **exiting stops the music**. The
one screen where a stray press costs the user something real is precisely the
screen where the charter asks for an unguarded exit.

## Options

| | Option | Cost | Risk |
|---|---|---|---|
| A | **Immediate exit**, as the charter reads today | None — delete four lines | A stray BACK kills playback with no warning. On a remote that is often operated without looking, that will happen |
| B | **Always confirm** — "Exit AppleTune?" dialog | Low — one modal, two focusable buttons | Adds a press to every legitimate exit, including the common case where nothing is playing and there is nothing to protect |
| C | **Exit immediately when nothing is playing; confirm only while playing** | Low — the same modal, shown conditionally | One more branch to keep correct; the behaviour differs by state, which must be explained in the navigation model |

## Recommendation

**C.** It follows the platform convention wherever following it is free, and
spends a confirmation only on the single case where BACK destroys something the
user wanted. A dialog that appears when nothing is at stake is the kind of
friction people learn to dismiss without reading, which makes it useless on the
occasion it matters.

## Result

| Seat | Agent | Vote | Reason |
|---|---|---|---|
| 1 | SeniorProjectManager (chair) | C | Satisfies the platform convention the charter was reaching for, without the defect the charter's wording would ship. |
| 2 | Software Architect | C | The state is already tracked (`app.playing`); the branch costs one condition and no new concepts. |
| 3 | Frontend/TV Developer | C | The modal is needed for B anyway. C is B plus a condition, not extra work. |
| 4 | UX Architect | C | A confirmation shown when nothing is at stake trains the user to dismiss it unread, which is worse than not having one. |
| 5 | QA / Test Results Analyzer | B | Dissent: two exit behaviours means two paths to test and a G4 criterion that reads differently depending on playback state. Uniform is testable. |

**Tally**: C = 4, B = 1, A = 0
**Winner**: **C — exit immediately when idle, confirm while playing**
**Dissents**: QA (seat 5) for B, on testability.

### Dissent carried forward

QA's point is fair and is answered by making the G4 criterion state-explicit
rather than ambiguous. The charter's criterion 3 is amended to:

> BACK from any screen returns to the logical parent. On Home, BACK exits the
> app when nothing is playing, and raises an exit confirmation when playback is
> in progress. Both paths are exercised.

Both paths are then testable, and neither is left to interpretation.

## Consequences

- `app.js` `handleBack()` gains the Home branch, and the prototype gains an
  exit-confirmation modal — currently recorded as a known gap in
  `STORYBOARD.md`, which should be updated when it lands.
- `NAVIGATION_MODEL.md` §BACK contract must state both behaviours.
- The charter's G4 criterion 3 is amended as above. This is a criterion
  clarification, not a scope change: it resolves a contradiction rather than
  adding work.
