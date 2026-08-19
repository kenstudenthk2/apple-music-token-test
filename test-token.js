const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const STOREFRONT_URL = "https://api.music.apple.com/v1/storefronts/us";
const DEFAULT_ENV_PATH = path.join(__dirname, ".env");

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
}

function trimLeadingZero(bytes) {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start += 1;
  }
  return bytes.subarray(start);
}

function leftPad(bytes, size) {
  if (bytes.length > size) {
    throw new Error("Invalid ECDSA signature component length.");
  }
  if (bytes.length === size) {
    return bytes;
  }
  return Buffer.concat([Buffer.alloc(size - bytes.length), bytes]);
}

function readDerLength(buffer, offset) {
  const first = buffer[offset];
  if (first < 0x80) {
    return { length: first, offset: offset + 1 };
  }

  const byteCount = first & 0x7f;
  if (byteCount < 1 || byteCount > 2) {
    throw new Error("Unsupported DER length.");
  }

  let length = 0;
  for (let i = 0; i < byteCount; i += 1) {
    length = (length << 8) + buffer[offset + 1 + i];
  }
  return { length, offset: offset + 1 + byteCount };
}

function writeDerLength(length) {
  if (length < 0x80) {
    return Buffer.from([length]);
  }
  if (length <= 0xff) {
    return Buffer.from([0x81, length]);
  }
  return Buffer.from([0x82, length >> 8, length & 0xff]);
}

function derToJose(derSignature) {
  let offset = 0;
  if (derSignature[offset] !== 0x30) {
    throw new Error("Invalid DER sequence.");
  }
  offset += 1;

  const sequence = readDerLength(derSignature, offset);
  offset = sequence.offset;

  if (derSignature[offset] !== 0x02) {
    throw new Error("Invalid DER integer for r.");
  }
  offset += 1;
  const rLength = derSignature[offset];
  offset += 1;
  const r = derSignature.subarray(offset, offset + rLength);
  offset += rLength;

  if (derSignature[offset] !== 0x02) {
    throw new Error("Invalid DER integer for s.");
  }
  offset += 1;
  const sLength = derSignature[offset];
  offset += 1;
  const s = derSignature.subarray(offset, offset + sLength);

  return Buffer.concat([
    leftPad(trimLeadingZero(r), 32),
    leftPad(trimLeadingZero(s), 32),
  ]);
}

function toDerInteger(bytes) {
  const trimmed = trimLeadingZero(bytes);
  const needsPositivePrefix = (trimmed[0] & 0x80) === 0x80;
  const value = needsPositivePrefix
    ? Buffer.concat([Buffer.from([0]), trimmed])
    : trimmed;
  return Buffer.concat([Buffer.from([0x02]), writeDerLength(value.length), value]);
}

function joseToDer(joseSignature) {
  if (joseSignature.length !== 64) {
    throw new Error("Invalid ES256 JOSE signature length.");
  }

  const r = toDerInteger(joseSignature.subarray(0, 32));
  const s = toDerInteger(joseSignature.subarray(32, 64));
  const body = Buffer.concat([r, s]);
  return Buffer.concat([Buffer.from([0x30]), writeDerLength(body.length), body]);
}

function createDeveloperToken({
  teamId,
  keyId,
  privateKeyPem,
  now = Math.floor(Date.now() / 1000),
  ttlSeconds = 3600,
}) {
  if (!teamId || !keyId || !privateKeyPem) {
    throw new Error("APPLE_TEAM_ID, APPLE_KEY_ID, and private key are required.");
  }

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + ttlSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const derSignature = crypto.sign(
    "sha256",
    Buffer.from(signingInput),
    privateKeyPem
  );
  const joseSignature = derToJose(derSignature);

  return `${signingInput}.${base64UrlEncode(joseSignature)}`;
}

function loadEnvFile(envPath = DEFAULT_ENV_PATH) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function resolvePrivateKeyPath(privateKeyPath) {
  if (!privateKeyPath) {
    throw new Error("APPLE_PRIVATE_KEY_PATH is required.");
  }
  return path.isAbsolute(privateKeyPath)
    ? privateKeyPath
    : path.resolve(__dirname, privateKeyPath);
}

async function runStorefrontSmokeTest({
  developerToken,
  fetchImpl = fetch,
  log = console.log,
}) {
  const response = await fetchImpl(STOREFRONT_URL, {
    headers: {
      Authorization: `Bearer ${developerToken}`,
    },
  });

  log(`HTTP Status: ${response.status}`);
  return response.status;
}

async function main() {
  loadEnvFile();

  const privateKeyPath = resolvePrivateKeyPath(process.env.APPLE_PRIVATE_KEY_PATH);
  const privateKeyPem = fs.readFileSync(privateKeyPath, "utf8");
  const developerToken = createDeveloperToken({
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKeyPem,
  });

  await runStorefrontSmokeTest({ developerToken });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  base64UrlDecode,
  base64UrlEncode,
  createDeveloperToken,
  derToJose,
  joseToDer,
  loadEnvFile,
  runStorefrontSmokeTest,
};
