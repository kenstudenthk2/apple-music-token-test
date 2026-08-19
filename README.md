# Apple Music Developer Token Test

This is a small Node.js smoke test for an Apple Music Developer Token.

It creates an ES256 JWT developer token locally, calls:

```text
https://api.music.apple.com/v1/storefronts/us
```

and prints only the HTTP status.

It does not write the token to a file or print the full token.

## Files

```text
apple-music-token-test/
├─ .env.example
├─ .gitignore
├─ package.json
├─ README.md
├─ secure/
│  └─ README.md
├─ test-token.js
└─ test-token.test.js
```

## Setup

1. Copy `.env.example` to `.env`.

2. Put your Apple private key file here:

```text
secure/AuthKey_VHTUS7D2GN.p8
```

3. Confirm `.env` contains:

```env
APPLE_TEAM_ID=6UURC25F7N
APPLE_KEY_ID=VHTUS7D2GN
APPLE_PRIVATE_KEY_PATH=./secure/AuthKey_VHTUS7D2GN.p8
```

4. Run the smoke test:

```bash
npm start
```

Success should look like:

```text
HTTP Status: 200
```

## Run Automated Tests

```bash
npm test
```

The automated tests use a temporary generated test key. They do not need your real `.p8` file.

## Safety Notes

- Do not commit `.env`.
- Do not commit `.p8` files.
- Do not paste your `.p8` private key into chat.
- Do not paste a full generated developer token into chat.
- Keep `AuthKey_VHTUS7D2GN.p8` on your backend or local machine only. Do not put it in an Android TV APK.
