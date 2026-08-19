/**
 * POC-A pairing backend (localhost only).
 *
 * Flow:
 *   1. TV      -> POST /api/session              -> { code, activateUrl }
 *   2. Phone   -> GET  /activate/:code           -> MusicKit JS authorize page
 *   3. Phone   -> POST /api/session/:code/token  -> stores the Music User Token
 *   4. TV      -> GET  /api/session/:code        -> polls until status=authorized
 *
 * Nothing is persisted to disk. Tokens live in memory only.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { createDeveloperToken, loadEnvFile } = require("./test-token");

const PORT = Number(process.env.PORT || 8787);
const SESSION_TTL_MS = 10 * 60 * 1000;
// Ambiguous characters (0/O, 1/I) are omitted so a code stays readable on a TV.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const sessions = new Map();

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

function generateCode() {
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return `TV-${suffix}`;
}

function sweepExpiredSessions(now = Date.now()) {
  for (const [code, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(code);
    }
  }
}

function createSession(baseUrl) {
  sweepExpiredSessions();

  let code = generateCode();
  while (sessions.has(code)) {
    code = generateCode();
  }

  sessions.set(code, {
    code,
    createdAt: Date.now(),
    status: "pending",
    musicUserToken: null,
  });

  return { code, activateUrl: `${baseUrl}/activate/${code}` };
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

async function handleRequest(req, res, developerToken) {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/developer-token") {
    // A developer token is designed to be exposed to web clients; it grants
    // catalog access only, never access to a user's library.
    sendJson(res, 200, { developerToken });
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

  const sessionMatch = pathname.match(/^\/api\/session\/([A-Za-z0-9-]+)$/);
  if (req.method === "GET" && sessionMatch) {
    sweepExpiredSessions();
    const session = sessions.get(sessionMatch[1].toUpperCase());
    if (!session) {
      sendJson(res, 404, { error: "Unknown or expired session." });
      return;
    }
    sendJson(res, 200, {
      code: session.code,
      status: session.status,
      musicUserToken: session.musicUserToken,
    });
    return;
  }

  const tokenMatch = pathname.match(/^\/api\/session\/([A-Za-z0-9-]+)\/token$/);
  if (req.method === "POST" && tokenMatch) {
    sweepExpiredSessions();
    const session = sessions.get(tokenMatch[1].toUpperCase());
    if (!session) {
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
    console.log(`[pairing] ${session.code} authorized`);
    sendJson(res, 200, { code: session.code, status: session.status });
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
  return http.createServer((req, res) => {
    handleRequest(req, res, developerToken).catch((error) => {
      console.error(`[pairing] ${error.message}`);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error." });
      }
    });
  });
}

function main() {
  loadEnvFile();
  const server = createServer(buildDeveloperToken());

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Pairing server listening on http://localhost:${PORT}`);
    console.log("Start the TV side with: node tv-client.js");
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  SESSION_TTL_MS,
  createServer,
  createSession,
  generateCode,
  sessions,
  sweepExpiredSessions,
};
