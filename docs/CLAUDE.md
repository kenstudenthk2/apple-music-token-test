# docs/ — Governance, research, design

Every document here is long by design. **Do not read a whole file to find one
fact.** List its headings first (`grep -n '^#\+ ' <file>`), then read only the
section you need.

## Menu

| File | Audience | Read it when |
|---|---|---|
| `PROJECT_CHARTER.md` | Everyone, once | You need a gate PASS/FAIL criterion, a rule, the RACI, or the beta protocol |
| `decisions/` | Anyone proposing a change | A decision already exists, or you need to open a vote — see `decisions/CLAUDE.md` |
| `research/apple/` | Design + frontend | You are matching Apple Music's own look or behaviour — web tokens and the tvOS teardown |
| `research/UI_REPO_SCAN.md` | Design + frontend | You are looking for prior art or a library, and want to know what is actually usable here |
| `research/TV_UX_RESEARCH.md` | Design + frontend | You need prior art, TV UX numbers, or Now-Playing concepts |
| `design/DESIGN_SYSTEM.md` | Frontend | You need a component spec, a token rationale, or a wireframe |
| `design/NAVIGATION_MODEL.md` | Frontend | You need the screen map, the BACK contract, or focus rules |
| `design/STORYBOARD.md` | The human user | You want the screen-by-screen walkthrough in plain language |
| `beta/PROTOTYPE_REVIEW.md` | The human user | They are reviewing the G3 prototype and need the task list and feedback form |
| `HOME_SETUP.md` | The human user | Setting up a machine that has never run this repo |
| `TOKEN_LIFETIME.md` | Everyone | You need to know how long a Music User Token lives — the input to ESCALATION-003 |
| `G4_RESULT.md` | Everyone | Records the D-pad gate result and what the automated audit could not find |
| `G4_RUNBOOK.md` | The human user | They are running the D-pad audit and manual checklist on the device |
| `POCB_RUNBOOK.md` | The human user | They are about to run the G1 playback test on a device |
| `POCB_RESULT.md` | Everyone | Records whether full-track playback works on a real device (gate G1) |

## Charter section index

Rather than loading `PROJECT_CHARTER.md`, jump to what you need:

| Need | Section |
|---|---|
| What v1 is and is not | §1 |
| Gate PASS/FAIL criteria | §2 |
| Rules every agent follows | §3 |
| How a vote works | §4 |
| Who owns what | §5 |
| Task board | §6 |
| Beta test protocol | §7 |
| Risk register | §8 |

## Auth surface — stop and ask

These concerns are **never** decided by an agent or by a vote. Escalate to the
human user and pause the work:

- the pairing flow, the pairing code, or the device secret
- how a Music User Token is obtained, stored, transmitted, refreshed, or expired
- anything calling `music.authorize()`
- adding any account system, OAuth, or sign-in of our own
- anything that could put the Apple Developer account at risk

Record the escalation as `decisions/ESCALATION-<nnn>-<slug>.md` so the reasoning
survives even though the decision is not ours to make.

## Writing rules for this folder

- State the intended audience in the first two lines of every new document.
- Tables and checklists over prose.
- Numbers, not adjectives. "24px minimum at 1080p", not "large enough".
- Cite a URL for any external claim, or say explicitly that it is unverified.
- Add the file to the menu above in the same task that creates it.
