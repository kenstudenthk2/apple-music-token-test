# Prototype Review — your turn

**Audience: the human project owner. This is the G3 sign-off.**

This is the *design* review, not the G6 beta test. The G6 beta test needs a real
APK on a real TV and is described in `docs/PROJECT_CHARTER.md` §7. This one needs
only a browser and about ten minutes.

## What you are reviewing

The prototype is published as an Artifact — open the link from the chat. It runs
entirely in the browser with no network, no Apple account, and no server.

Optional, if you prefer to run it locally:

```bash
npm run prototype     # http://localhost:8788/tv/
```

**Best viewed:** full screen, browser zoom at 100%, and if you can, cast it to an
actual TV. The whole design assumes a 3-metre viewing distance — judging it at
50 cm on a laptop will make everything look absurdly large, which is correct.

## Controls

The prototype is driven exactly like a TV remote. Click the page once first so
it receives key presses.

| Remote | Keyboard |
|---|---|
| ▲ ▼ ◀ ▶ | Arrow keys |
| OK | Enter |
| BACK | Escape |

## Do these eight things

Do them in order, without reading ahead, and note anything that surprises you.

| # | Task | What we are actually testing |
|---|---|---|
| 1 | On the QR screen, press **OK** to simulate your phone completing the scan | Whether the pairing screen explains itself with no instructions |
| 2 | From Home, move **▶ ▶ ▶** along the top row | Whether the focus ring is unmistakable, and whether the row moves the way you expect |
| 3 | Press **▼** twice to reach a lower shelf | Whether vertical movement feels predictable |
| 4 | Press **OK** on any album | Time to first "music playing" — count your key presses from Home |
| 5 | On Now Playing, press **OK**, then **◀** and **▶** | Whether pause / previous / next are discoverable without labels |
| 6 | Press **BACK** | Whether you land where you expected |
| 7 | Go to **Search** and type a word using the on-screen keyboard | How painful text entry is. Be honest — this is the weakest screen by nature |
| 8 | Mash the remote for 30 seconds | Focus traps: can you ever lose the focus ring, or get stuck |

## Fill this in

Copy this block into your reply. Free text is fine; skip anything that does not apply.

```
DEVICE / SCREEN: (e.g. 27" monitor at 60cm, or cast to a 55" TV)

Per task:
  1 QR screen        Completed: Y / struggled / N   Severity: Blocker / Annoying / Cosmetic
     Expected:
     Actually:
  2 Row movement     ...
  3 Shelf movement   ...
  4 Start playing    Key presses from Home: ___
  5 Transport        ...
  6 BACK             ...
  7 Search typing    ...
  8 Remote mashing   Did you ever lose the focus ring?  Y / N

THE THREE THINGS TO FIX, ranked by you:
  1.
  2.
  3.

Would you keep this design direction?  Yes / No / Not yet — and one sentence why:
```

## The four questions we specifically need answered

These change what gets built next, so please answer them even if you skip the rest.

1. **Now Playing — the spinning vinyl.** [VOTE-001](../decisions/VOTE-001-now-playing-concept.md)
   chose it 4–1. The dissenting vote was that it may stutter on weak TV hardware
   and that a plain blurred backdrop is the safer, more conventional choice.
   Keep the vinyl, or drop to the conventional treatment?

2. **Home shelves.** Right now they are Recently Played / Made For You / Your
   Library / New Releases, in that order. Is that the order *you* want on your
   own TV? First row is worth more than the other three combined.

3. **Search.** [VOTE-002](../decisions/VOTE-002-text-entry-method.md) shipped the
   grid keyboard. After doing task 7, do you want us to pursue typing from your
   phone instead? That one is your call, not the panel's, and it is written up in
   [ESCALATION-001](../decisions/ESCALATION-001-phone-as-remote-input.md) — it is
   an auth decision.

4. **Anything missing.** What did you look for and not find?

## What is deliberately fake

So you do not report these as bugs:

- Album art is a CSS gradient. Real artwork comes from the Apple Music API.
- The QR code is a placeholder pattern. **It will not scan.** Real encoding is
  the pairing server's job.
- Playback is a one-second timer. No audio is produced.
- Pairing is simulated by pressing OK. No Apple sign-in happens.
- Search matches only the twelve demo releases.
- Playlists open straight into playback instead of showing a track list.

## The one thing this prototype cannot tell us

Whether a real Apple Music track will play end-to-end inside an Android TV
WebView. That is gate **G1 / POC-B** and it needs a physical device. Everything
in this prototype is wasted effort if that test fails — so it stays the highest
risk on the register until it is run.
