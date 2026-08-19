# First-time setup on a second machine

**Audience: the project owner, setting up a machine that has never run this repo.**

Everything in git works after a clone. Two things are **not** in git, on purpose,
and nothing runs without them:

| Missing after a clone | Why it is missing |
|---|---|
| `secure/AuthKey_VHTUS7D2GN.p8` | Your Apple private key. `.gitignore` excludes it, and it must stay excluded. |
| `.env` | Points at that key and carries your team and key ids. |

---

## 1. Install what is needed

PowerShell, one line each:

```powershell
winget install --id OpenJS.NodeJS.LTS
winget install --id Git.Git
winget install --id Cloudflare.cloudflared
```

Close and reopen PowerShell afterwards so the new commands are on your PATH,
then check:

```powershell
node -v          # v18 or later
git --version
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" --version
```

**You do not need the GitHub CLI on this machine.** Building the APK needs it,
but I can build from the office machine — see step 5.

---

## 2. Clone

```powershell
cd $HOME
git clone https://github.com/kenstudenthk2/apple-music-token-test.git
cd apple-music-token-test
```

Nothing to install after that — the project has no dependencies. `npm test`
should pass 39/39 right now, because the tests use a generated throwaway key
and never touch your real one.

---

## 3. Move the private key across

This is the one step that needs care.

**Copy `secure/AuthKey_VHTUS7D2GN.p8` from the office machine to the same path
here, using a USB stick, or your password manager's secure file storage.**

Do not email it, do not put it in chat, do not paste its contents anywhere —
including to me. It is the key that signs every developer token, and anyone
holding it can mint tokens against your Apple Developer account until you
revoke it.

If moving it is inconvenient, the alternative is to generate a **second** MusicKit
key in the Apple Developer portal for this machine and revoke it when you are
done. Apple allows more than one. That is slower but means the key never
travels.

Then check it landed:

```powershell
Test-Path secure\AuthKey_VHTUS7D2GN.p8    # must print True
```

---

## 4. Create `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

It needs exactly these three lines — the same values as the office machine:

```env
APPLE_TEAM_ID=6UURC25F7N
APPLE_KEY_ID=VHTUS7D2GN
APPLE_PRIVATE_KEY_PATH=./secure/AuthKey_VHTUS7D2GN.p8
```

Verify the whole chain works:

```powershell
npm start
```

`HTTP Status: 200` means the key, the ids and the token signing are all correct.
Anything else means stop here and tell me the status code — going further would
just produce confusing failures downstream.

---

## 5. Bring the session up

```powershell
.\scripts\pocb-session.ps1 -SkipApk
```

`-SkipApk` because that part needs the GitHub CLI. The script will print:

```
Launcher : https://<something>.trycloudflare.com/tv/launcher.html
```

**Send me that URL and I will build the APK from the office machine** and hand
it back. Leave the window open the whole time — closing it kills the tunnel, and
the APK has that hostname compiled into it.

If you would rather be self-sufficient, install and authenticate the GitHub CLI
and drop `-SkipApk`:

```powershell
winget install --id GitHub.cli
gh auth login
.\scripts\pocb-session.ps1
```

---

## 6. Token lifetime, in a second window

Independent of everything above and worth starting early, because it needs
hours of wall time:

```powershell
npm run token-lifetime
```

It prints a `http://localhost:8787/activate/TV-XXXX` link. Open it in a browser
**on this machine** — `localhost` counts as a secure context, so no phone and no
tunnel are needed. Authorize, then leave it running.

Its answer decides [ESCALATION-003](decisions/ESCALATION-003-token-persistence.md).

---

## If something fails

| Symptom | Cause |
|---|---|
| `APPLE_PRIVATE_KEY_PATH is required` | No `.env`, or it has different key names |
| `ENOENT ... AuthKey_...p8` | `.env` is right but the key file is not there |
| `npm start` prints 401 | The key, the key id, or the team id disagree with Apple |
| `EADDRINUSE :8787` | Something is already on that port — likely an earlier run |
| Tunnel prints no hostname | cloudflared could not reach Cloudflare; check the network |

Send me the exact error rather than working around it.
