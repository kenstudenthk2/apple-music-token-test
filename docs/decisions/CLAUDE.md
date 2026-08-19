# docs/decisions/ — Decision records

One file per decision. **Read `README.md` for the index; read an individual
`VOTE-*.md` only when it is the decision you actually need.** Never load the
whole folder.

## Two kinds of record

| Prefix | Means | Who decides |
|---|---|---|
| `VOTE-<nnn>-<slug>.md` | A recorded 5-seat agent vote | The voting panel, majority wins |
| `ESCALATION-<nnn>-<slug>.md` | A question agents are forbidden to decide | The human user only |

## Before opening a vote

Check the non-votable classes in `README.md`. Auth, login, tokens, spend,
distribution, Apple-account risk, scope changes, and gate-failure fallbacks are
**escalations, not votes**. Filing one as a vote is a process error.

## Opening a vote

1. Copy the block from charter §4.2 into a new `VOTE-<nnn>-<slug>.md`.
2. Maximum 3 options. More than 3 viable options means the question is not
   ready — narrow it first.
3. Each option needs a stated cost and a stated risk.
4. The chair records a recommendation with one sentence of reasoning.
5. Add the row to the index table in `README.md` in the same task.

## Closing a vote

- 5 seats, 1 vote each, abstention allowed. Every vote needs a one-line reason;
  a vote without a reason is void.
- Record the tally, the winner, and every dissent at the bottom of the same file.
- Set the status line at the top to `decided — <option>`.
- On a tie: one re-vote round with the tied options only. Tie again → escalate
  to the human user and pause that work.

## Rule

A decision that is not written down here did not happen. If you find yourself
choosing between real alternatives and no record exists, stop and open one.
