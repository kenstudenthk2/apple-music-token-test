# Music User Token lifetime — interim result

**Status: 🟡 inconclusive. Survives at least 1.5 hours; the run was cut short.**

The last untested assumption under gate G5, which requires the TV to stay
logged in across an app restart. Measured by `scripts/token-lifetime.js`.

## Run 1 — 2026-08-19, cut short at 1.5 h

```
+0.00h  catalog=200  library=200  both-valid
+0.25h  catalog=200  library=200  both-valid
+0.50h  catalog=200  library=200  both-valid
+0.75h  catalog=200  library=200  both-valid
+1.00h  catalog=200  library=200  both-valid
+1.25h  catalog=200  library=200  both-valid
+1.50h  catalog=200  library=200  both-valid
```

Ended because the process was killed while clearing stale processes, not
because anything expired.

## What this establishes

**The Music User Token survives at least 1.5 hours of idle time.** That rules
out the worst case — a token measured in minutes, which would have made the
whole QR architecture unusable in a living room.

It does not establish the number G5 needs.

## The incidental finding, which is worth more than the headline

Look at `catalog=200` at **+1.00h and beyond**.

A developer token lives exactly one hour. If the probe were reusing one, the
catalog column would have turned 401 at that row and stayed there. It did not,
because `token-lifetime.js` re-mints a fresh developer token on every probe.

Two things follow:

1. **The harness is measuring the right credential.** The two-call design is
   doing its job: catalog isolates our token, library isolates the listener's.
2. **It independently confirms the bug found in the app that same evening.**
   `pairing-server.js` minted its developer token once at start-up, so after an
   hour it served a dead credential and the app reported the listener's session
   as expired. This log shows exactly what the app should have looked like.

## What is still unknown

| Question | Status |
|---|---|
| Does the token survive overnight? | untested |
| Does it survive days or weeks? | untested |
| Does anything refresh it, or is re-pairing the only path? | untested |
| Does it survive the app process restarting? | untested — the probe holds it in a file, the app holds it in memory |

That last row is the one G5 actually asks about, and no amount of idle probing
answers it. A separate check is needed: pair, restart the app, and see whether
the stored token still works.

## What it means for ESCALATION-003

[ESCALATION-003](decisions/ESCALATION-003-token-persistence.md) asks whether to
persist the token across restarts, and the recommendation was "yes, but measure
the lifetime first" — because a token that dies in hours would make storage the
wrong problem to solve.

**1.5 hours is not yet enough to answer that.** It rules out the outcome that
would have killed the idea, but the decision still wants at least an overnight
run. If the token is still valid after eight hours, persistence is clearly worth
building. If it dies around, say, six, the interesting problem becomes refresh.

## Next run

Restart it and leave it overnight:

```powershell
npm run token-lifetime
```

It appends to `secure/token-probe.csv`, so a second run adds to the record
rather than replacing it. Worth noting the exact start time, since the useful
answer is a duration.
