# G4 Runbook — D-pad navigation on the real device

**Audience: the human project owner.**

Gate G4 has two halves, and passing only one of them is not passing the gate.

| Half | What it proves | How |
|---|---|---|
| **Automated audit** | The app handles D-pad keys correctly: everything is reachable, focus never gets trapped, BACK behaves | `?audit=1` runs it and prints a verdict |
| **Manual checklist** | Your *remote* emits the keycodes the app expects, and the focus ring is legible from the sofa | Ten presses, by hand, below |

The audit dispatches synthetic key events. That tests the app, **not the
device's key mapping**. A remote whose BACK button sends an unusual keycode
would sail through the audit and still be unusable. The manual half is not
ceremony.

---

## Setup

From your own terminal, not through an agent:

```powershell
.\scripts\pocb-session.ps1
```

It brings up the pairing server, an HTTPS tunnel, and a matching APK. Then tell
me the tunnel hostname and I will build an APK pointing at:

```
https://<tunnel>/tv/?audit=1
```

Install it, remove any older build first, and open it.

---

## Part 1 — the automated audit

It runs by itself and takes under a minute. Read the bar at the top.

| Check | Criterion |
|---|---|
| `reachable/home` | G4.1 — every element on Home reachable by D-pad alone |
| `reachable/now` | G4.1 — same for Now Playing |
| `no-focus-trap` | G4.4 — 200 events, focus never null or off-screen |
| `back/child-returns-home` | G4.3 — BACK from a child screen returns to Home |
| `back/home-idle-exits` | G4.3 — BACK on an idle Home exits outright (VOTE-003) |
| `now-playing-fps` | VOTE-001's carried-forward condition |

### About the frame rate

This is the one that decides whether the rotating vinyl survives. VOTE-001
passed it 4–1, and QA's dissent — that the rotation would stutter on weak TV
hardware — was answered by agreeing to measure on the device.

- **≥ 30 fps** → the vinyl stands, QA's dissent is answered.
- **< 30 fps** → the fallback triggers: disable the rotation, keep the static
  artwork. One CSS line, because the disc and the ambient wash are separate
  layers.
- **INCONCLUSIVE** → `requestAnimationFrame` was throttled, which happens when
  the page is not the visible foreground. It is **not** a slow-GPU result and
  must not be read as one. Bring the app to the foreground and run it again.

That last case is deliberate. A throttled measurement reports something like
1 fps, and taking that at face value would disable the vinyl on hardware that
renders it perfectly.

---

## Part 2 — the manual checklist

Ten presses with the real remote. This is the half the audit cannot do.

Build an APK pointing at `https://<tunnel>/tv/` — **without** `?audit=1` — so
the app behaves normally.

| # | Press | Expected | Pass? |
|---|---|---|---|
| 1 | **RIGHT** on Home | Focus moves one tile right | ☐ |
| 2 | **DOWN** | Focus moves to the next shelf, same column | ☐ |
| 3 | **OK** on a tile | Now Playing opens and the disc spins | ☐ |
| 4 | **BACK** | Returns to Home, same tile focused | ☐ |
| 5 | **UP** to the nav, **RIGHT**, **OK** | Search opens, focus on the letter A | ☐ |
| 6 | Type three letters, then **BACK** ×3 | Each BACK deletes one letter, stays on Search | ☐ |
| 7 | **BACK** once more | Leaves Search for Home | ☐ |
| 8 | Start playback, then **BACK** on Home | Exit confirmation appears, **"Keep playing" focused** | ☐ |
| 9 | **BACK** again | Dialog closes, music still playing | ☐ |
| 10 | Stop playback, **BACK** on Home | App exits to the launcher, no prompt | ☐ |

### Also judge these by eye, from where you actually sit

- **Focus ring legible from the sofa?** If you have to lean in to see which tile
  is selected, that is a G4.2 failure regardless of what the audit says.
- **Any lag** between a press and the focus moving? Note roughly how much.
- **Media keys** — if your remote has PLAY/PAUSE, does it work from Home as well
  as from Now Playing?

---

## What to send back

1. The audit verdict bar, and the fps line specifically.
2. The ten checkboxes.
3. Anything under "judge by eye".

Steps 8–10 exist because [VOTE-003](decisions/VOTE-003-back-at-root.md) split
BACK-on-Home into two behaviours. QA dissented that two behaviours means two
paths to test — correctly — so both paths are listed rather than left to
interpretation.

## If something fails

Send the failure rather than working around it. In particular, if a **remote
key does nothing**, that is the most valuable failure this runbook can produce:
it means the device emits a keycode `spatial-nav.js` does not recognise, and the
fix is one entry in its `KEYS` table. The audit can never find that.
