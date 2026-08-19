/**
 * Measure how long a Music User Token stays valid.
 *
 * This is the last untested assumption under gate G5, which requires the TV to
 * stay logged in across an app restart. If a Music User Token dies after a few
 * hours and cannot be refreshed, the user re-scans a QR code every time they
 * turn the television on, and the product is not worth shipping. Nothing in the
 * project has tested it.
 *
 * THE CONFOUNDER THIS SCRIPT EXISTS TO REMOVE
 *
 *   The developer token expires after one hour. So a bare 401 on a library call
 *   cannot tell you which credential died. Every probe therefore mints a FRESH
 *   developer token and makes two calls:
 *
 *     catalog  /v1/catalog/us/songs/...   developer token only
 *     library  /v1/me/library/playlists   developer token + Music User Token
 *
 *   catalog OK + library OK    -> both credentials still good
 *   catalog OK + library 401   -> the MUSIC USER TOKEN expired. The answer.
 *   catalog 401                -> our own developer token is broken; ignore the
 *                                 library result entirely, it proves nothing.
 *
 * The token itself is never printed, never logged, and never committed. It is
 * written to secure/, which .gitignore already excludes.
 *
 * Usage:
 *   node scripts/token-lifetime.js            pair, then probe until it expires
 *   node scripts/token-lifetime.js --resume   reuse the saved token
 *   node scripts/token-lifetime.js --once     take a single probe and exit
 *
 * The pairing server must already be running (npm run pair). Authorize in a
 * browser on THIS machine: http://localhost:8787 is a secure context as far as
 * MusicKit is concerned, so no tunnel is needed for this test.
 */

const fs = require("node:fs");
const path = require("node:path");

const { createDeveloperToken, loadEnvFile } = require("../test-token");

const ROOT = path.resolve(__dirname, "..");
const STATE_FILE = path.join(ROOT, "secure", "token-probe.json");
const LOG_FILE = path.join(ROOT, "secure", "token-probe.csv");

const BASE_URL = process.env.PAIRING_BASE_URL || "http://localhost:8787";
const CATALOG_URL = "https://api.music.apple.com/v1/catalog/us/charts?types=songs&limit=1";
const LIBRARY_URL = "https://api.music.apple.com/v1/me/library/playlists?limit=1";

// Probe every 15 minutes. Frequent enough to place expiry within a quarter of
// an hour, rare enough that a multi-day run is a rounding error against any
// rate limit.
const PROBE_INTERVAL_MS = 15 * 60 * 1000;

function resolvePrivateKeyPath(privateKeyPath) {
  if (!privateKeyPath) {
    throw new Error("APPLE_PRIVATE_KEY_PATH is required.");
  }
  return path.isAbsolute(privateKeyPath)
    ? privateKeyPath
    : path.resolve(ROOT, privateKeyPath);
}

/** Mint a fresh developer token for every probe, so it is never the variable. */
function freshDeveloperToken() {
  const privateKeyPem = fs.readFileSync(
    resolvePrivateKeyPath(process.env.APPLE_PRIVATE_KEY_PATH),
    "utf8"
  );
  return createDeveloperToken({
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKeyPem,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pair once, using the existing split-code endpoints. */
async function pair(log = console.log) {
  const created = await fetch(`${BASE_URL}/api/session`, { method: "POST" }).then((r) => {
    if (!r.ok) throw new Error(`Could not start a session: HTTP ${r.status}. Is the pairing server running?`);
    return r.json();
  });

  log("");
  log(`  Open this on this machine, then authorize with Apple:`);
  log(`  ${created.activate_url}`);
  log("");
  log(`  Pairing code: ${created.user_code}`);
  log("  Waiting…");

  const deadline = Date.now() + created.expires_in * 1000;
  while (Date.now() < deadline) {
    const response = await fetch(`${BASE_URL}/api/session/token`, {
      headers: { Authorization: `Bearer ${created.device_code}` },
    });
    if (response.status === 404) throw new Error("The pairing session expired before authorization.");
    if (!response.ok) throw new Error(`Poll failed: HTTP ${response.status}`);

    const session = await response.json();
    if (session.status === "authorized") {
      log("  Authorized.");
      return session.musicUserToken;
    }
    await sleep((created.interval || 2) * 1000);
  }
  throw new Error("Timed out waiting for authorization.");
}

/**
 * One probe. Returns statuses only — never the response bodies, which contain
 * the user's library contents.
 */
async function probe(musicUserToken) {
  const developerToken = freshDeveloperToken();

  const catalog = await fetch(CATALOG_URL, {
    headers: { Authorization: `Bearer ${developerToken}` },
  }).then((r) => r.status, () => 0);

  const library = await fetch(LIBRARY_URL, {
    headers: {
      Authorization: `Bearer ${developerToken}`,
      "Music-User-Token": musicUserToken,
    },
  }).then((r) => r.status, () => 0);

  return { catalog, library };
}

/** Turn two status codes into the one conclusion that matters. */
function interpret({ catalog, library }) {
  if (catalog === 0 || library === 0) return "network-error";
  if (catalog !== 200) return "developer-token-broken";
  if (library === 200) return "both-valid";
  if (library === 401 || library === 403) return "MUSIC-USER-TOKEN-EXPIRED";
  return `library-http-${library}`;
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function appendLog(row) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, "timestamp,elapsed_hours,catalog,library,verdict\n");
  }
  fs.appendFileSync(LOG_FILE, `${row}\n`);
}

function hours(ms) {
  return (ms / 3_600_000).toFixed(2);
}

async function main() {
  loadEnvFile();

  const resume = process.argv.includes("--resume");
  const once = process.argv.includes("--once");

  let state = resume || once ? loadState() : null;

  if (!state) {
    if (resume || once) {
      throw new Error(`No saved token at ${path.relative(ROOT, STATE_FILE)}. Run without --resume first.`);
    }
    const musicUserToken = await pair();
    state = { musicUserToken, obtainedAt: Date.now() };
    saveState(state);
    console.log(`  Token saved to ${path.relative(ROOT, STATE_FILE)} (gitignored, never printed).`);
  }

  console.log("");
  console.log(`Probing every ${PROBE_INTERVAL_MS / 60000} minutes. Leave this running.`);
  console.log(`Log: ${path.relative(ROOT, LOG_FILE)}`);
  console.log("");

  for (;;) {
    const elapsed = Date.now() - state.obtainedAt;
    const result = await probe(state.musicUserToken);
    const verdict = interpret(result);
    const stamp = new Date().toISOString();

    appendLog(`${stamp},${hours(elapsed)},${result.catalog},${result.library},${verdict}`);
    console.log(
      `${stamp}  +${hours(elapsed)}h  catalog=${result.catalog}  library=${result.library}  ${verdict}`
    );

    if (verdict === "MUSIC-USER-TOKEN-EXPIRED") {
      console.log("");
      console.log("=".repeat(70));
      console.log(`ANSWER: the Music User Token expired between ${hours(elapsed - PROBE_INTERVAL_MS)}h and ${hours(elapsed)}h.`);
      console.log("The developer token was freshly minted and the catalog call succeeded,");
      console.log("so this is the user token and nothing else.");
      console.log("=".repeat(70));
      return;
    }

    if (verdict === "developer-token-broken") {
      console.log("  Our own developer token failed — ignoring the library result, it proves nothing.");
    }

    if (once) return;
    await sleep(PROBE_INTERVAL_MS);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { interpret, probe };
