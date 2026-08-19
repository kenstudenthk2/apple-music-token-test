# ESCALATION-001: May the pairing session also carry text input from the phone?

- **GATE**: G4 — D-pad Navigation
- **CLASS**: Auth / login (charter §4.5) — **human decision, not a vote**
- **STATUS**: ✅ **ANSWERED — Option 1: not in v1.** Decided by the project owner
  on 2026-08-19 ("later"), after reviewing the G3 prototype and using the grid
  keyboard first-hand. Revisit after gate G5.
- **RAISED BY**: UX Architect, via the navigation model's text-entry analysis.

## What is being asked

`docs/design/NAVIGATION_MODEL.md` recommends letting the already-paired phone act
as a keyboard for the TV: the user types on their phone, the text appears in the
TV's search field. Music search is dominated by proper nouns, where a grid
keyboard costs roughly 40 presses and voice mishears the name outright, so the
usability gain is real and large.

Implementing it means the pairing session — which today exists only to move a
Music User Token from the phone to the TV, once — would also become a live
input channel from the phone to the TV.

## Why this is not ours to decide

Charter §4.5 makes anything that changes the pairing flow, what the pairing
session carries, or how long it lives a human decision. This proposal changes
all three:

| Today | With phone-as-remote |
|---|---|
| Session exists for one transfer, then is finished with | Session stays live for the whole viewing session |
| TTL 10 minutes | TTL would need to be hours, or refreshable |
| Carries one value, once, phone → TV | Carries arbitrary text, repeatedly, phone → TV |
| Knowing the 4-character code gets you a token **once** | Knowing the code gets you a channel into someone's TV for as long as they watch |

That last row is the real reason this is escalated rather than voted. It widens
the blast radius of the known security gap (charter G2: the pairing code alone
is currently sufficient) from "one token leak" to "ongoing control of the
session", and it does so before that gap has been closed.

## What the human user is being asked to decide

Pick one. None of these is urgent — v1 search works without any of them.

| | Option | What it means |
|---|---|---|
| 1 | **Not in v1.** Grid keyboard only. | Nothing to build, nothing to secure. Revisit after G5. |
| 2 | **Yes, but only after G2 security hardening passes.** | The device secret and rate limiting land first; the input channel is then bound to the device secret, not to the code. Sequenced, safe, slower. |
| 3 | **Yes, on a separate channel.** | Phone-as-remote gets its own short-lived, separately-issued token that cannot be used to fetch a Music User Token, so the two concerns never share a credential. Most work, cleanest separation. |

If option 2 or 3 is chosen, the implementation still stops for approval before
any code is written, per charter rule 5.

## Recommendation offered (not a decision)

**Option 1 for v1.** The grid keyboard already works and is verified in the
prototype. Adding a live phone→TV channel on top of a pairing flow whose known
security gaps are still open would be doing the risky thing first and the safe
thing second.

## Answer

**Option 1 — not in v1.** The project owner reviewed the grid keyboard in the G3
prototype and chose to defer phone-as-remote rather than pursue it now.

Consequences:

- Nothing to build, and nothing new to secure. The pairing session keeps its
  single narrow purpose: move one token, once, then destroy itself.
- The decision was taken *after* using the keyboard, not before — so it is a
  judgement about real friction, not a guess about it.
- This stays open as a v2 candidate. If beta testing at G6 shows search being
  abandoned, this is the first thing to reconsider.
