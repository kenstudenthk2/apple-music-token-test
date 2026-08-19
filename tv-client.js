/**
 * POC-A "Android TV" stand-in.
 *
 * Creates a pairing session, prints the activation URL, waits for the phone to
 * authorize, then proves the Music User Token works from a *different* device
 * by reading the user's library playlists.
 *
 * Success criterion: HTTP 200 from /v1/me/library/playlists.
 */

const fs = require("node:fs");
const path = require("node:path");

const { createDeveloperToken, loadEnvFile } = require("./test-token");

const BASE_URL = process.env.PAIRING_BASE_URL || "http://localhost:8787";
const LIBRARY_URL = "https://api.music.apple.com/v1/me/library/playlists?limit=5";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function resolvePrivateKeyPath(privateKeyPath) {
  if (!privateKeyPath) {
    throw new Error("APPLE_PRIVATE_KEY_PATH is required.");
  }
  return path.isAbsolute(privateKeyPath)
    ? privateKeyPath
    : path.resolve(__dirname, privateKeyPath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestSession(fetchImpl = fetch) {
  const response = await fetchImpl(`${BASE_URL}/api/session`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Could not create a pairing session: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Poll for the token using the device_code.
 *
 * The user_code is never sent here — it is only ever shown on screen. The
 * device_code is the sole credential that can retrieve a Music User Token, and
 * it never leaves this process except as an Authorization header over TLS.
 */
async function waitForAuthorization({
  deviceCode,
  fetchImpl = fetch,
  log = console.log,
  timeoutMs = POLL_TIMEOUT_MS,
  intervalMs = POLL_INTERVAL_MS,
  now = Date.now,
}) {
  const deadline = now() + timeoutMs;

  while (now() < deadline) {
    const response = await fetchImpl(`${BASE_URL}/api/session/token`, {
      headers: { Authorization: `Bearer ${deviceCode}` },
    });

    if (response.status === 429) {
      throw new Error("Rate limited. Too many failed attempts from this address.");
    }
    if (response.status === 404) {
      throw new Error("The pairing session expired. Start a new one.");
    }
    if (!response.ok) {
      throw new Error(`Session poll failed: HTTP ${response.status}`);
    }

    const session = await response.json();
    if (session.status === "authorized") {
      log("Authorized.");
      // Collected. The server has destroyed the session, so this device_code
      // is now worthless — do not retry with it.
      return session.musicUserToken;
    }

    await sleep(intervalMs);
  }

  throw new Error("Timed out waiting for phone authorization.");
}

async function readLibraryPlaylists({
  developerToken,
  musicUserToken,
  fetchImpl = fetch,
  log = console.log,
}) {
  const response = await fetchImpl(LIBRARY_URL, {
    headers: {
      Authorization: `Bearer ${developerToken}`,
      "Music-User-Token": musicUserToken,
    },
  });

  log(`Library HTTP Status: ${response.status}`);
  if (response.status !== 200) {
    return response.status;
  }

  const body = await response.json();
  const names = (body.data || []).map((item) => item.attributes?.name || "(untitled)");
  log(`Playlists returned: ${names.length}`);
  for (const name of names) {
    log(`  - ${name}`);
  }
  return response.status;
}

async function main() {
  loadEnvFile();

  const privateKeyPem = fs.readFileSync(
    resolvePrivateKeyPath(process.env.APPLE_PRIVATE_KEY_PATH),
    "utf8"
  );
  const developerToken = createDeveloperToken({
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKeyPem,
  });

  const session = await requestSession();
  console.log("");
  // Only the user_code is ever printed. The device_code is a credential and is
  // never displayed, logged, or written down.
  console.log(`  Pairing code: ${session.user_code}`);
  console.log(`  Open on your phone/browser: ${session.activate_url}`);
  console.log(`  Expires in ${session.expires_in}s`);
  console.log("");
  console.log("Waiting for authorization…");

  const musicUserToken = await waitForAuthorization({
    deviceCode: session.device_code,
    intervalMs: (session.interval || 2) * 1000,
  });
  await readLibraryPlaylists({ developerToken, musicUserToken });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { readLibraryPlaylists, requestSession, waitForAuthorization };
