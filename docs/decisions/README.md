# Decision Records

Every non-trivial decision on this project is made by a recorded vote, per
`docs/PROJECT_CHARTER.md` §4. One file per vote, named `VOTE-<nnn>-<slug>.md`.

## Not everything is votable

Per charter §4.5, these classes are **never** decided by a vote. They are
escalated to the human user and the work pauses until the user answers:

| Class | Examples |
|---|---|
| Auth / login | pairing flow, token storage, token lifetime, device secret, anything touching `music.authorize()` |
| Apple account risk | key rotation, anything near a ToS boundary |
| Spend | paid hosting, domains, Play Store fees |
| Distribution | publishing anywhere public, sharing an APK |
| Scope changes | adding anything the charter listed as out of scope |
| Gate FAIL fallbacks | choosing a fallback after a gate fails |

An escalation is recorded in the same folder as `ESCALATION-<nnn>-<slug>.md`
so the reasoning survives even though the decision is not a vote.

## Index
| Record | Gate | Question | Result |
|---|---|---|---|
| [VOTE-001](VOTE-001-now-playing-concept.md) | G3 | Which Now Playing treatment ships in v1? | **A — rotating vinyl over an adaptive ambient wash** (4–1, QA dissent on GPU risk, carried forward as an fps check at G4) |
| [VOTE-002](VOTE-002-text-entry-method.md) | G4 | How does the user enter a search query without a keyboard? | **A — on-screen grid keyboard** (5–0) |
| [ESCALATION-001](ESCALATION-001-phone-as-remote-input.md) | G4 | May the pairing session also carry text input from the phone? | ⏸ **awaiting the human user** — auth surface, not votable |
| [ESCALATION-002](ESCALATION-002-pairing-security-design.md) | G2 | How should the pairing flow be secured? | ✅ **Option A — split user_code / device_code (RFC 8628 shape)**. Endpoint design approved and **implemented**; gate G2 passed |
