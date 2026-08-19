# G4 Result — D-pad navigation

**Gate status: ✅ PASSED** (2026-08-20), on a physical Android TV, both halves.

| Half | Result |
|---|---|
| Automated audit (`?audit=1`) | ✅ 6 of 6 checks, **60 fps** on Now Playing |
| Manual checklist, real remote | ✅ after four fixes below |

---

## Criterion by criterion

| # | Criterion | Evidence |
|---|---|---|
| 1 | Every element reachable by D-pad alone | `reachable/home` 27 of 27, `reachable/now` 3 of 3 |
| 2 | Focus visually unambiguous | Confirmed by eye on the device |
| 3 | BACK contract, both paths ([VOTE-003](decisions/VOTE-003-back-at-root.md)) | Fixed and confirmed — see below |
| 4 | No focus trap in 200 events | `no-focus-trap` passed |
| — | Frame rate ([VOTE-001](decisions/VOTE-001-now-playing-concept.md)) | **60 fps** |

### VOTE-001's dissent is answered

QA voted against the rotating vinyl on the grounds that it would stutter on weak
TV hardware, and the agreed remedy was to measure on the device and fall back to
a static backdrop below 30 fps. It ran at **60 fps**. The vinyl stands, and the
fallback is not needed on this hardware.

That remains one device. The fallback path stays in place — the disc and the
ambient wash are separate layers, so disabling the rotation is one CSS line if a
weaker device ever needs it.

---

## What the automated audit could not find

Four defects reached the device despite a green audit. Each is worth recording,
because each names a limit of the testing rather than a one-off mistake.

### BACK did nothing

Android routes a hardware BACK press to `Activity.onBackPressed()` and never
produces a DOM keydown. Every back handler the web app registered was invisible
to the remote, and `MainActivity` went straight to WebView history — from Now
Playing, BACK left the app's own screen stack and reloaded the previous page.

**The audit passed this happily**, because a synthetic `Escape` event does reach
the page. This is precisely why `G4_RUNBOOK.md` says the manual half is not
optional, and it was the first thing the device found.

Fixed with `window.__onAndroidBack`: the host gives the page first refusal and
falls back to history, then to leaving the app.

### Then BACK trapped the viewer

The first fix over-corrected. Both back handlers returned `true` on their root
screen, the host believed them, and the app became impossible to leave. Worse
than the original bug. Home now declines the press so the host can act.

The prototype had the same shape of error elsewhere: `exitApp()` drew an
"Exited" screen while the app kept running. `AndroidHost.exit()` — one
argument-free method — lets the page actually finish the Activity.

### LEFT escaped the row

Two causes. The row step was hard-coded at 19.5rem from `--tile-size` plus what
a comment claimed `--tile-gap` was; the token is `var(--space-4)`, so every step
drifted ~12px and accumulated along the row. And purely geometric scoring could
prefer a nav item up and to the left, so LEFT left the shelf and a second LEFT
came back — the two-step confusion reported from the sofa.

Both apps now measure the real step with `offsetLeft` (immune to the focused
tile's 1.08 scale), and shelves declare `data-focus-contain="x"` so horizontal
movement cannot leave the row.

**The prototype never reproduced this**, at any press rate or row depth. The fix
is a measurement error that was definitely wrong plus a behavioural guarantee
that makes the symptom impossible regardless of cause.

### Artwork did not load

`loading="lazy"` does not follow a transformed ancestor reliably, and shelves
move by transform, so tiles to the right and below never triggered. Artwork now
loads eagerly; a failed load removes the element rather than leaving a broken
glyph.

---

## The lesson worth keeping

The audit was green while BACK did nothing, LEFT jumped to the wrong element,
and half the artwork was missing. It tests **how the app handles a key**, not
what the device sends, not how the platform routes hardware buttons, and not
what the viewer sees.

Synthetic events cannot find platform routing bugs. Keep the manual half.

---

## Also fixed during this session

Not G4 criteria, but found on the way:

- **A real QR encoder.** The live app showed "scan to connect" with nothing to
  scan. The first encoder passed every structural check and was still
  unscannable — six of fifteen format bits were mirrored. Caught by diffing
  against an independent implementation; see `qr.test.js`.
- **The developer token expired after an hour** and the server never re-minted
  it, so the app told the viewer *their* Apple Music session had expired. It now
  refreshes, and `api.js` probes a catalog endpoint before blaming anyone.
- **Stale processes.** A leftover `cloudflared` keeps answering after its server
  is gone, so a healthy-looking URL returns 530 and reads as a broken server.
  `pocb-session.ps1` now refuses to start alongside one, and proves the tunnel
  reaches the origin before printing a URL.
