/**
 * Pairing backend — RFC 8628 device-authorization shape.
 *
 * Flow:
 *   1. TV     -> POST /api/session               -> { user_code, device_code, ... }
 *   2. Phone  -> GET  /activate/:user_code       -> MusicKit JS authorize page
 *   3. Phone  -> POST /api/activate/:user_code   -> stores the Music User Token, 204
 *   4. TV     -> GET  /api/session/token         -> Bearer device_code, polls
 *
 * The security property this design exists for:
 *
 *   Two credentials, because the roles need opposite properties. `user_code` is
 *   short because a human reads it off a television across a room, and it is
 *   therefore low-entropy by necessity — so it is a lookup handle and nothing
 *   more. NO ROUTE RETURNS A MUSIC USER TOKEN IN RESPONSE TO A user_code.
 *   Retrieval requires `device_code`: 32 CSPRNG bytes, issued once to the TV,
 *   stored only as a SHA-256 hash, never logged.
 *
 *   An earlier version conflated the two, so anyone who guessed a live
 *   four-character code received a stranger's Apple Music access. See
 *   docs/decisions/ESCALATION-002-pairing-security-design.md.
 *
 * Nothing is persisted to disk. Tokens live in memory only.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { createDeveloperToken, loadEnvFile } = require("./test-token");

const PORT = Number(process.env.PORT || 8787);
// Five minutes. Long enough to find your phone, short enough that a live code
// is rarely there to be found.
const SESSION_TTL_MS = 5 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 2;
// Ambiguous characters (0/O, 1/I) are omitted so a code stays readable on a TV.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const DEVICE_CODE_BYTES = 32;

// Brute force is made of failures, so failures are what is counted. A TV
// polling at POLL_INTERVAL_SECONDS makes 30 honest requests a minute and must
// never be locked out of its own session.
const FAILURE_LIMIT = 5;
const FAILURE_WINDOW_MS = 60 * 1000;

/** user_code -> session. The device_code is present only as a hash. */
const sessions = new Map();
/** sha256(device_code) -> user_code. The only route to a token. */
const deviceCodeIndex = new Map();
/** client IP -> array of failure timestamps within the window. */
const failures = new Map();

function resolvePrivateKeyPath(privateKeyPath) {
  if (!privateKeyPath) {
    throw new Error("APPLE_PRIVATE_KEY_PATH is required.");
  }
  return path.isAbsolute(privateKeyPath)
    ? privateKeyPath
    : path.resolve(__dirname, privateKeyPath);
}

function buildDeveloperToken() {
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

/**
 * Hand out a developer token that is actually still valid.
 *
 * A developer token lives one hour. Minting it once when the process starts
 * meant the server happily served a dead credential for as long as it ran, and
 * every Apple call 401'd — which the app then reported to the viewer as *their*
 * Apple Music session expiring. Wrong credential, wrong person blamed.
 *
 * Re-minted ten minutes before expiry, so a token handed out at the boundary is
 * still good by the time the client uses it.
 */
function createDeveloperTokenProvider() {
  const LIFETIME_MS = 60 * 60 * 1000;
  const REFRESH_BEFORE_MS = 10 * 60 * 1000;

  let token = null;
  let mintedAt = 0;

  return function developerToken() {
    const age = Date.now() - mintedAt;
    if (!token || age > LIFETIME_MS - REFRESH_BEFORE_MS) {
      token = buildDeveloperToken();
      mintedAt = Date.now();
      console.log("[pairing] developer token minted");
    }
    return token;
  };
}

function generateCode() {
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return `TV-${suffix}`;
}

/** SHA-256, base64url. Used so no raw device_code is ever stored. */
function hash(value) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

/** Drop a session and its device-code index entry together. */
function destroySession(session) {
  sessions.delete(session.userCode);
  deviceCodeIndex.delete(session.deviceCodeHash);
}

function sweepExpiredSessions(now = Date.now()) {
  for (const session of [...sessions.values()]) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      destroySession(session);
    }
  }

  // Sweep the failure counter too. Without this it grows one entry per hostile
  // IP forever, which turns a brute-force attempt into a memory-exhaustion one.
  for (const [ip, timestamps] of failures) {
    const recent = timestamps.filter((at) => now - at < FAILURE_WINDOW_MS);
    if (recent.length === 0) {
      failures.delete(ip);
    } else {
      failures.set(ip, recent);
    }
  }
}

function createSession(baseUrl) {
  sweepExpiredSessions();

  let userCode = generateCode();
  while (sessions.has(userCode)) {
    userCode = generateCode();
  }

  // Issued once, in the response below, and never again. Only its hash is kept.
  const deviceCode = crypto.randomBytes(DEVICE_CODE_BYTES).toString("base64url");
  const deviceCodeHash = hash(deviceCode);

  sessions.set(userCode, {
    userCode,
    deviceCodeHash,
    createdAt: Date.now(),
    status: "pending",
    musicUserToken: null,
  });
  deviceCodeIndex.set(deviceCodeHash, userCode);

  return {
    user_code: userCode,
    device_code: deviceCode,
    activate_url: `${baseUrl}/activate/${userCode}`,
    expires_in: Math.floor(SESSION_TTL_MS / 1000),
    interval: POLL_INTERVAL_SECONDS,
  };
}

/** Best-effort client identity for the failure counter. */
function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

/** True once this IP has exceeded the failure budget for the current window. */
function isRateLimited(req, now = Date.now()) {
  const recent = (failures.get(clientIp(req)) || [])
    .filter((at) => now - at < FAILURE_WINDOW_MS);
  return recent.length >= FAILURE_LIMIT;
}

/**
 * Record a failed lookup. Only failures count: a successful poll of a valid
 * session is the TV doing exactly what it was told to do.
 */
function recordFailure(req, now = Date.now()) {
  const ip = clientIp(req);
  const recent = (failures.get(ip) || []).filter((at) => now - at < FAILURE_WINDOW_MS);
  recent.push(now);
  failures.set(ip, recent);
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readJsonBody(req, limitBytes = 8 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Request body is not valid JSON."));
      }
    });
  });
}

async function handleRequest(req, res, developerTokenFor) {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const { pathname } = url;

  /**
   * Which commit is this machine actually serving?
   *
   * Static files are read from disk per request, so a `git pull` takes effect
   * without a restart — but there is no way to tell from the television whether
   * it did. That ambiguity has now cost several rounds of "is this fixed?"
   * against a screenshot of the old build. Read per request, for the same
   * reason the files are.
   */
  if (req.method === "GET" && pathname === "/api/version") {
    let commit = "unknown";
    try {
      const head = fs.readFileSync(path.join(__dirname, ".git", "HEAD"), "utf8").trim();
      const ref = head.startsWith("ref: ") ? head.slice(5) : null;
      commit = ref
        ? fs.readFileSync(path.join(__dirname, ".git", ref), "utf8").trim().slice(0, 7)
        : head.slice(0, 7);
    } catch (error) {
      // A checkout without .git is fine; say so rather than failing the request.
      commit = "no-git";
    }
    sendJson(res, 200, { commit });
    return;
  }

  if (req.method === "GET" && pathname === "/api/developer-token") {
    // A developer token is designed to be exposed to web clients; it grants
    // catalog access only, never access to a user's library.
    sendJson(res, 200, { developerToken: developerTokenFor() });
    return;
  }

  if (req.method === "POST" && pathname === "/api/session") {
    // Behind a tunnel or any TLS terminator this process only ever sees plain
    // HTTP, so url.origin would hand the phone an http:// activate link.
    // MusicKit refuses to run outside a secure context, so that link is not
    // merely untidy — it breaks authorization outright. Trust the proxy's
    // x-forwarded-proto when present.
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim();
    const origin = forwardedProto
      ? `${forwardedProto}://${url.host}`
      : url.origin;
    sendJson(res, 201, createSession(origin));
    return;
  }

  // The TV collects its token. This is the ONLY route that returns a Music
  // User Token, and it is reachable only with the device_code.
  if (req.method === "GET" && pathname === "/api/session/token") {
    const header = String(req.headers.authorization || "");
    const deviceCode = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!deviceCode) {
      sendJson(res, 401, { error: "A device_code bearer token is required." });
      return;
    }

    if (isRateLimited(req)) {
      sendJson(res, 429, { error: "Too many failed attempts. Try again shortly." });
      return;
    }

    sweepExpiredSessions();
    // Hash-table lookup, so there is no character-by-character comparison whose
    // duration could reveal how much of a guess was correct.
    const session = sessions.get(deviceCodeIndex.get(hash(deviceCode)));
    if (!session) {
      recordFailure(req);
      sendJson(res, 404, { error: "Unknown or expired session." });
      return;
    }

    if (session.status !== "authorized") {
      sendJson(res, 200, { status: "pending", interval: POLL_INTERVAL_SECONDS });
      return;
    }

    // Single use. Once handed over, the session is destroyed, so a device_code
    // recovered later from a proxy log or a crash dump is worth nothing.
    const musicUserToken = session.musicUserToken;
    destroySession(session);
    console.log(`[pairing] ${session.userCode} collected`);
    sendJson(res, 200, { status: "authorized", musicUserToken });
    return;
  }

  // The phone hands over the token it obtained from Apple. It presents the
  // user_code, because that is all it has ever had — and it gets nothing back,
  // so it cannot leak a token it never receives.
  const activateApiMatch = pathname.match(/^\/api\/activate\/([A-Za-z0-9-]+)$/);
  if (req.method === "POST" && activateApiMatch) {
    if (isRateLimited(req)) {
      sendJson(res, 429, { error: "Too many failed attempts. Try again shortly." });
      return;
    }

    sweepExpiredSessions();
    const session = sessions.get(activateApiMatch[1].toUpperCase());
    if (!session) {
      recordFailure(req);
      sendJson(res, 404, { error: "Unknown or expired session." });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }

    if (typeof body.musicUserToken !== "string" || !body.musicUserToken) {
      sendJson(res, 400, { error: "musicUserToken is required." });
      return;
    }

    session.musicUserToken = body.musicUserToken;
    session.status = "authorized";
    // Only the user_code is ever logged. Never the device_code, never the token.
    console.log(`[pairing] ${session.userCode} authorized`);
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
    return;
  }

  const activateMatch = pathname.match(/^\/activate\/([A-Za-z0-9-]+)$/);
  if (req.method === "GET" && activateMatch) {
    const page = fs.readFileSync(path.join(__dirname, "public", "activate.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": page.length,
      "Cache-Control": "no-store",
    });
    res.end(page);
    return;
  }

  // The POC-B playback harness. Served from this server rather than the
  // prototype server because it needs the real developer token and the real
  // pairing endpoints, which only exist here.
  if (req.method === "GET" && (pathname === "/pocb" || pathname === "/pocb/")) {
    const page = fs.readFileSync(path.join(__dirname, "public", "pocb", "index.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": page.length,
      "Cache-Control": "no-store",
    });
    res.end(page);
    return;
  }

  // The TV prototype, so the G4 audit can run on the real device through the
  // same tunnel. Path traversal is rejected by resolving and then checking the
  // result is still inside public/tv.
  if (req.method === "GET" && pathname.startsWith("/tv")) {
    const TV_ROOT = path.join(__dirname, "public", "tv");
    const relative = pathname === "/tv" || pathname === "/tv/"
      ? "index.html"
      : decodeURIComponent(pathname.slice("/tv/".length));
    const target = path.resolve(TV_ROOT, relative);

    if (target !== TV_ROOT && !target.startsWith(TV_ROOT + path.sep)) {
      sendJson(res, 403, { error: "Forbidden." });
      return;
    }
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      sendJson(res, 404, { error: "Not found." });
      return;
    }

    const types = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    };
    const body = fs.readFileSync(target);
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-store",
    });
    res.end(body);
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

/**
 * Build the HTTP server around a developer token.
 *
 * Split out of main() so tests can drive the real request handler over a real
 * socket with a fake token, rather than needing the Apple .p8 private key on
 * the machine running them.
 */
function createServer(developerToken) {
  // Accepts a plain string so tests can pass a fake, or a function so the real
  // server can re-mint. Anything that must not go stale should be a function.
  const provider = typeof developerToken === "function"
    ? developerToken
    : () => developerToken;

  return http.createServer((req, res) => {
    handleRequest(req, res, provider).catch((error) => {
      console.error(`[pairing] ${error.message}`);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error." });
      }
    });
  });
}

function main() {
  loadEnvFile();
  const server = createServer(createDeveloperTokenProvider());

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Pairing server listening on http://localhost:${PORT}`);
    console.log("Start the TV side with: node tv-client.js");
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createDeveloperTokenProvider,
  deviceCodeIndex,
  failures,
  SESSION_TTL_MS,
  createServer,
  createSession,
  generateCode,
  sessions,
  sweepExpiredSessions,
};
