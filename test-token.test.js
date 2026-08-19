const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  base64UrlDecode,
  createDeveloperToken,
  derToJose,
  joseToDer,
  loadEnvFile,
  runStorefrontSmokeTest,
} = require("./test-token");

function writeTempEnv(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apple-music-env-"));
  const envPath = path.join(dir, ".env");
  fs.writeFileSync(envPath, contents);
  return { dir, envPath };
}

function clearEnvKeys(keys) {
  for (const key of keys) {
    delete process.env[key];
  }
}

function derSequence(rBytes, sBytes) {
  const body = Buffer.concat([
    Buffer.from([0x02, rBytes.length]),
    rBytes,
    Buffer.from([0x02, sBytes.length]),
    sBytes,
  ]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

test("creates an ES256 JWT with the expected Apple Music claims", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  const now = 1_777_777_777;
  const token = createDeveloperToken({
    teamId: "6UURC25F7N",
    keyId: "VHTUS7D2GN",
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }),
    now,
  });

  const parts = token.split(".");
  assert.equal(parts.length, 3);

  const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8"));
  assert.deepEqual(header, {
    alg: "ES256",
    kid: "VHTUS7D2GN",
    typ: "JWT",
  });

  const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
  assert.deepEqual(payload, {
    iss: "6UURC25F7N",
    iat: now,
    exp: now + 3600,
  });

  const validSignature = crypto.verify(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    joseToDer(base64UrlDecode(parts[2]))
  );
  assert.equal(validSignature, true);
});

test("storefront smoke test prints HTTP status without logging the token", async () => {
  const calls = [];
  const logs = [];
  const fakeToken = "header.payload.signature";

  await runStorefrontSmokeTest({
    developerToken: fakeToken,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 200 };
    },
    log: (...args) => logs.push(args.join(" ")),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.music.apple.com/v1/storefronts/us");
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${fakeToken}`);
  assert.deepEqual(logs, ["HTTP Status: 200"]);
});

test("loadEnvFile parses comments, quotes, and padding", () => {
  const keys = [
    "TEST_ENV_DOUBLE",
    "TEST_ENV_SINGLE",
    "TEST_ENV_SPACED",
    "TEST_ENV_NO_SEPARATOR",
    "TEST_ENV_EXISTING",
    "TEST_ENV_EMPTY",
    "TEST_ENV_URL",
    "TEST_ENV_UNCLOSED",
  ];
  const { dir, envPath } = writeTempEnv(
    [
      "# comment line",
      "",
      "   ",
      'TEST_ENV_DOUBLE="double value"',
      "TEST_ENV_SINGLE='single value'",
      "  TEST_ENV_SPACED   =   spaced value   ",
      "TEST_ENV_NO_SEPARATOR",
      "TEST_ENV_EXISTING=from_file",
      "TEST_ENV_EMPTY=",
      "TEST_ENV_URL=https://example.com/?a=1&b=2",
      'TEST_ENV_UNCLOSED="not closed',
    ].join("\n")
  );

  clearEnvKeys(keys);
  process.env.TEST_ENV_EXISTING = "preset";

  try {
    loadEnvFile(envPath);

    assert.equal(process.env.TEST_ENV_DOUBLE, "double value");
    assert.equal(process.env.TEST_ENV_SINGLE, "single value");
    assert.equal(process.env.TEST_ENV_SPACED, "spaced value");
    assert.equal(process.env.TEST_ENV_NO_SEPARATOR, undefined);
    assert.equal(process.env.TEST_ENV_EXISTING, "preset");
    assert.equal(process.env.TEST_ENV_EMPTY, "");
    assert.equal(process.env.TEST_ENV_URL, "https://example.com/?a=1&b=2");
    assert.equal(process.env.TEST_ENV_UNCLOSED, '"not closed');
  } finally {
    clearEnvKeys(keys);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile parses CRLF line endings", () => {
  const keys = ["TEST_ENV_CRLF_A", "TEST_ENV_CRLF_B"];
  const { dir, envPath } = writeTempEnv(
    ["TEST_ENV_CRLF_A=first", "TEST_ENV_CRLF_B=second"].join("\r\n")
  );

  clearEnvKeys(keys);

  try {
    loadEnvFile(envPath);

    assert.equal(process.env.TEST_ENV_CRLF_A, "first");
    assert.equal(process.env.TEST_ENV_CRLF_B, "second");
  } finally {
    clearEnvKeys(keys);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile is a no-op when the file is missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apple-music-env-"));

  try {
    assert.doesNotThrow(() => loadEnvFile(path.join(dir, "does-not-exist.env")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("derToJose strips the DER positive-sign prefix from a high-bit component", () => {
  const der = derSequence(
    Buffer.concat([Buffer.from([0x00]), Buffer.alloc(32, 0xff)]),
    Buffer.alloc(32, 0x11)
  );

  const jose = derToJose(der);

  assert.equal(jose.length, 64);
  assert.deepEqual(
    jose,
    Buffer.concat([Buffer.alloc(32, 0xff), Buffer.alloc(32, 0x11)])
  );
  assert.deepEqual(joseToDer(jose), der);
});

test("derToJose left-pads components shorter than 32 bytes", () => {
  const der = derSequence(Buffer.from([0x01]), Buffer.from([0x7f, 0x02]));

  const jose = derToJose(der);

  assert.equal(jose.length, 64);
  assert.deepEqual(
    jose.subarray(0, 32),
    Buffer.concat([Buffer.alloc(31), Buffer.from([0x01])])
  );
  assert.deepEqual(
    jose.subarray(32, 64),
    Buffer.concat([Buffer.alloc(30), Buffer.from([0x7f, 0x02])])
  );
  assert.deepEqual(joseToDer(jose), der);
});

test("derToJose round-trips 200 real ECDSA signatures", () => {
  const { privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  for (let i = 0; i < 200; i += 1) {
    const der = crypto.sign("sha256", Buffer.from(`message-${i}`), privateKey);
    const jose = derToJose(der);

    assert.equal(jose.length, 64);
    assert.deepEqual(joseToDer(jose), der);
  }
});

test("DER and JOSE conversions reject malformed input", () => {
  assert.throws(
    () => joseToDer(Buffer.alloc(63)),
    /Invalid ES256 JOSE signature length/
  );
  assert.throws(
    () => derToJose(Buffer.from([0x31, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01])),
    /Invalid DER sequence/
  );
  assert.throws(
    () => derToJose(Buffer.from([0x30, 0x06, 0x03, 0x01, 0x01, 0x02, 0x01, 0x01])),
    /Invalid DER integer for r/
  );
  assert.throws(
    () => derToJose(Buffer.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x03, 0x01, 0x01])),
    /Invalid DER integer for s/
  );
});

test("storefront smoke test reports non-200 statuses without leaking the token", async () => {
  const secretToken = "header.payload.super-secret-signature";

  for (const status of [401, 403, 500]) {
    const logs = [];
    const returned = await runStorefrontSmokeTest({
      developerToken: secretToken,
      fetchImpl: async () => ({ status }),
      log: (...args) => logs.push(args.join(" ")),
    });

    assert.equal(returned, status);
    assert.deepEqual(logs, [`HTTP Status: ${status}`]);
    assert.equal(logs.join("\n").includes(secretToken), false);
  }
});

test("storefront smoke test propagates network failures", async () => {
  const logs = [];

  await assert.rejects(
    runStorefrontSmokeTest({
      developerToken: "header.payload.signature",
      fetchImpl: async () => {
        throw new Error("network down");
      },
      log: (...args) => logs.push(args.join(" ")),
    }),
    /network down/
  );

  assert.deepEqual(logs, []);
});

test("loadEnvFile keeps a lone quote character as the value", () => {
  const keys = ["TEST_ENV_LONE_DOUBLE", "TEST_ENV_LONE_SINGLE"];
  const { dir, envPath } = writeTempEnv(
    ['TEST_ENV_LONE_DOUBLE="', "TEST_ENV_LONE_SINGLE='"].join("\n")
  );

  clearEnvKeys(keys);

  try {
    loadEnvFile(envPath);

    assert.equal(process.env.TEST_ENV_LONE_DOUBLE, '"');
    assert.equal(process.env.TEST_ENV_LONE_SINGLE, "'");
  } finally {
    clearEnvKeys(keys);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
