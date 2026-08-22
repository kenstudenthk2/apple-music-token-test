const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SESSION_TTL_MS,
  createServer,
  deviceCodeIndex,
  failures,
  generateCode,
  resolveHost,
  sessions,
} = require("./pairing-server");

/*
 * Gate G2 — pairing security.
 *
 * These tests are written against the design approved in
 * docs/decisions/ESCALATION-002-pairing-security-design.md, BEFORE it is
 * implemented. They are expected to fail on the current server, and that
 * failure is the point: it is the evidence that the vulnerability is real
 * rather than merely asserted.
 *
 * The vulnerability: one string serves as both the short code a human reads off
 * a television and the credential that retrieves a Music User Token. Anyone who
 * guesses a live 4-character code gets a stranger's Apple Music access.
 */

const FAKE_DEVELOPER_TOKEN = "header.payload.signature";

/**
 * Start the real server on an ephemeral port. No .p8 needed.
 *
 * All three module-level maps are reset, not just `sessions`. Every test runs
 * from 127.0.0.1, so a leftover failure count from the rate-limit test would
 * throttle whichever test happened to run next — a false failure that looks
 * exactly like a real one.
 */
function resetState() {
  sessions.clear();
  deviceCodeIndex.clear();
  failures.clear();
}

async function withServer(run) {
  resetState();
  const server = createServer(FAKE_DEVELOPER_TOKEN);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    return await run(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetState();
  }
}

async function json(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Start a pairing session the way the TV does.
 *
 * The shape is asserted here rather than in each test. Without this, a missing
 * field arrives downstream as `undefined` and tests pass vacuously — a URL of
 * `/api/session/undefined` 404s, and `"...".includes(undefined)` is false. Both
 * look like a pass and prove nothing.
 */
async function startSession(base) {
  const response = await fetch(`${base}/api/session`, { method: "POST" });
  assert.equal(response.status, 201);

  const session = await json(response);
  assert.equal(typeof session.user_code, "string", "response has no user_code");
  assert.equal(typeof session.device_code, "string", "response has no device_code");
  assert.ok(session.user_code.length > 0);
  assert.ok(session.device_code.length > 0);
  return session;
}

/** Submit a Music User Token the way the phone does. */
function submitToken(base, userCode, musicUserToken) {
  return fetch(`${base}/api/activate/${userCode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ musicUserToken }),
  });
}

/** Collect the token the way the TV does. */
function collectToken(base, deviceCode) {
  return fetch(`${base}/api/session/token`, {
    headers: { Authorization: `Bearer ${deviceCode}` },
  });
}


/* ---------------------------------------------------------------- *
 * G2 criterion 1 — the user code alone must never yield a token
 * ---------------------------------------------------------------- */

test("G2.1 the user code alone never returns a Music User Token", async () => {
  await withServer(async (base) => {
    const session = await startSession(base);
    const secret = "music-user-token-that-must-not-leak";
    assert.equal((await submitToken(base, session.user_code, secret)).status, 204);

    // Every route an attacker could reach knowing only the printed code.
    const attempts = [
      `${base}/api/session/${session.user_code}`,
      `${base}/api/session/${session.user_code}/token`,
      `${base}/api/activate/${session.user_code}`,
    ];

    for (const url of attempts) {
      const response = await fetch(url);
      const body = await response.text();
      assert.ok(
        !body.includes(secret),
        `${url} leaked the Music User Token to a caller holding only the user code`
      );
      assert.ok(
        response.status === 401 || response.status === 404 || response.status === 405,
        `${url} should refuse a user-code-only read, got ${response.status}`
      );
    }
  });
});

test("G2.1 the retired vulnerable endpoint is gone, not merely quiet", async () => {
  await withServer(async (base) => {
    const session = await startSession(base);
    const response = await fetch(`${base}/api/session/${session.user_code}`);
    assert.notEqual(
      response.status,
      200,
      "GET /api/session/:code must not exist — it is the vulnerability itself"
    );
  });
});


/* ---------------------------------------------------------------- *
 * G2 criterion 2 — the device code is a real secret
 * ---------------------------------------------------------------- */

test("G2.2 the device code carries at least 32 bytes of entropy", async () => {
  await withServer(async (base) => {
    const session = await startSession(base);

    assert.equal(typeof session.device_code, "string");
    // 32 raw bytes is 43 characters of unpadded base64url.
    assert.ok(
      session.device_code.length >= 43,
      `device_code is only ${session.device_code.length} characters — under 32 bytes of entropy`
    );
    assert.match(session.device_code, /^[A-Za-z0-9_-]+$/);

    // It must not be derivable from the thing printed on the television.
    assert.ok(!session.device_code.includes(session.user_code));
  });
});

test("G2.2 device codes do not repeat across sessions", async () => {
  await withServer(async (base) => {
    const seen = new Set();
    for (let i = 0; i < 20; i += 1) {
      const session = await startSession(base);
      assert.ok(!seen.has(session.device_code), "device_code repeated across sessions");
      seen.add(session.device_code);
    }
  });
});

test("G2.2 the server does not retain the device code in plaintext", async () => {
  await withServer(async (base) => {
    const session = await startSession(base);

    // The stored session is what an attacker reads from a memory dump or a
    // stray console.log of the session map. It must hold a hash, not the secret.
    const stored = JSON.stringify([...sessions.entries()]);
    assert.ok(
      !stored.includes(session.device_code),
      "the raw device_code is retained in the session store; only its hash should be"
    );
  });
});

test("G2.2 a request with no device code is rejected", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/session/token`);
    assert.equal(response.status, 401);
  });
});


/* ---------------------------------------------------------------- *
 * G2 criterion 3 — brute force is rate limited
 * ---------------------------------------------------------------- */

test("G2.3 more than five failed attempts in a minute are rejected with 429", async () => {
  await withServer(async (base) => {
    const statuses = [];
    for (let i = 0; i < 10; i += 1) {
      const response = await collectToken(base, `wrong-device-code-${i}`);
      statuses.push(response.status);
    }

    assert.ok(
      statuses.includes(429),
      `ten wrong device codes produced no 429 — brute force is unthrottled. Got: ${statuses.join(", ")}`
    );
    assert.ok(
      statuses.slice(0, 5).every((status) => status !== 429),
      "the limiter fired before five attempts, which would throttle honest callers"
    );
  });
});

test("G2.3 legitimate polling is not throttled", async () => {
  // The deliberate deviation recorded in ESCALATION-002: the limiter counts
  // FAILURES, not requests. A TV polling at interval=2 makes 30 requests a
  // minute by design, and must never be locked out of its own session.
  await withServer(async (base) => {
    const session = await startSession(base);

    for (let i = 0; i < 15; i += 1) {
      const response = await collectToken(base, session.device_code);
      assert.equal(
        response.status,
        200,
        `honest poll ${i + 1} was rejected with ${response.status}`
      );
      assert.equal((await json(response)).status, "pending");
    }
  });
});


/* ---------------------------------------------------------------- *
 * G2 criterion 4 — sessions are short-lived and single-use
 * ---------------------------------------------------------------- */

test("G2.4 sessions expire after no more than five minutes", () => {
  assert.ok(
    SESSION_TTL_MS <= 5 * 60 * 1000,
    `session TTL is ${SESSION_TTL_MS} ms; the gate requires 300000 ms or less`
  );
});

test("G2.4 the token can be collected exactly once", async () => {
  await withServer(async (base) => {
    const session = await startSession(base);
    const secret = "music-user-token-single-use";
    assert.equal((await submitToken(base, session.user_code, secret)).status, 204);

    const first = await collectToken(base, session.device_code);
    assert.equal(first.status, 200);
    const body = await json(first);
    assert.equal(body.status, "authorized");
    assert.equal(body.musicUserToken, secret);

    // The session is destroyed on collection, so a replayed device_code — from
    // a proxy log, a crash dump, anywhere — is worth nothing.
    const second = await collectToken(base, session.device_code);
    assert.equal(second.status, 404, "the device_code was replayable after collection");
    const secondBody = await second.text();
    assert.ok(!secondBody.includes(secret));
  });
});


/* ---------------------------------------------------------------- *
 * The phone's endpoint must not become a second leak
 * ---------------------------------------------------------------- */

test("the phone endpoint returns no body, so it cannot leak a token", async () => {
  await withServer(async (base) => {
    const session = await startSession(base);
    const response = await submitToken(base, session.user_code, "music-user-token-abc");

    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
  });
});

test("submitting to an unknown user code is refused", async () => {
  await withServer(async (base) => {
    const response = await submitToken(base, "TV-ZZZZ", "music-user-token-abc");
    assert.equal(response.status, 404);
  });
});

test("the user code stays short and unambiguous for a 10-foot UI", async () => {
  await withServer(async (base) => {
    const session = await startSession(base);
    assert.match(session.user_code, /^TV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    assert.equal(session.expires_in, 300);
    assert.ok(session.interval >= 1);
  });
});

test("generateCode omits characters that are ambiguous on a television", () => {
  for (let i = 0; i < 200; i += 1) {
    assert.doesNotMatch(generateCode(), /[01OI]/);
  }
});


/* ---------------------------------------------------------------- *
 * Listen host — Docker Compose needs 0.0.0.0, local dev needs 127.0.0.1
 * ---------------------------------------------------------------- */

test("resolveHost defaults to loopback when HOST is unset", () => {
  const original = process.env.HOST;
  delete process.env.HOST;
  try {
    assert.equal(resolveHost(), "127.0.0.1");
  } finally {
    if (original === undefined) delete process.env.HOST;
    else process.env.HOST = original;
  }
});

test("resolveHost honours HOST when set, for the Docker Compose network", () => {
  const original = process.env.HOST;
  process.env.HOST = "0.0.0.0";
  try {
    assert.equal(resolveHost(), "0.0.0.0");
  } finally {
    if (original === undefined) delete process.env.HOST;
    else process.env.HOST = original;
  }
});
