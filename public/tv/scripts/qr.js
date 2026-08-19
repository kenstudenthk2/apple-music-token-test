/**
 * A real QR encoder — byte mode, error-correction level M, versions 1 to 10.
 *
 * The prototype drew a deterministic pattern that merely looked like a QR code
 * and could never scan; that was fine for judging layout and useless on a
 * television. This produces a scannable code.
 *
 * Deliberately small rather than complete: byte mode only, versions up to 10
 * (154 bytes at level M), which covers any pairing URL we will ever show. A
 * longer string throws rather than silently producing something unscannable.
 *
 * No dependencies, because a QR library is a lot of supply chain for one
 * screen.
 */

/* ------------------------------------------------------------------ *
 * Galois field arithmetic over GF(256), the basis of Reed-Solomon
 * ------------------------------------------------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // the QR generator polynomial
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Reed-Solomon error-correction codewords for one block. */
function eccCodewords(data, count) {
  // Build the generator polynomial for `count` codewords.
  let generator = [1];
  for (let i = 0; i < count; i += 1) {
    const next = new Array(generator.length + 1).fill(0);
    for (let j = 0; j < generator.length; j += 1) {
      next[j] ^= generator[j];
      next[j + 1] ^= mul(generator[j], EXP[i]);
    }
    generator = next;
  }

  const remainder = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i += 1) {
      remainder[i] ^= mul(generator[i + 1], factor);
    }
  }
  return remainder;
}


/* ------------------------------------------------------------------ *
 * Version tables — level M only
 * ------------------------------------------------------------------ */

/** [total codewords, ecc per block, block count group 1, block count group 2] */
const VERSIONS = [
  null,
  [26, 10, 1, 0],    // 1
  [44, 16, 1, 0],    // 2
  [70, 26, 1, 0],    // 3
  [100, 18, 2, 0],   // 4
  [134, 24, 2, 0],   // 5
  [172, 16, 4, 0],   // 6
  [196, 18, 4, 0],   // 7
  [242, 22, 2, 2],   // 8
  [292, 22, 3, 2],   // 9
  [346, 26, 4, 1],   // 10
];

const ALIGNMENT = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

/** Format information for level M, one entry per mask, pre-computed. */
const FORMAT_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
];

function capacity(version) {
  const [total, eccPerBlock, g1, g2] = VERSIONS[version];
  const blocks = g1 + g2;
  return total - eccPerBlock * blocks;
}

function pickVersion(byteLength) {
  for (let version = 1; version <= 10; version += 1) {
    // 4 bits mode + 8 or 16 bits length + payload
    const headerBits = 4 + (version < 10 ? 8 : 16);
    if (capacity(version) * 8 >= headerBits + byteLength * 8) return version;
  }
  throw new Error(`${byteLength} bytes is too long for this encoder (max ~154).`);
}


/* ------------------------------------------------------------------ *
 * Encoding
 * ------------------------------------------------------------------ */

function encodeData(text, version) {
  const bytes = new TextEncoder().encode(text);
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);                                   // byte mode
  push(bytes.length, version < 10 ? 8 : 16);         // character count
  for (const byte of bytes) push(byte, 8);

  const totalBits = capacity(version) * 8;
  push(0, Math.min(4, totalBits - bits.length));     // terminator
  while (bits.length % 8) bits.push(0);              // pad to a byte boundary

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  }
  // The specified alternating pad bytes.
  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < capacity(version)) {
    codewords.push(pads[padIndex++ % 2]);
  }
  return codewords;
}

/** Split into blocks, compute ECC, then interleave as the spec requires. */
function interleave(codewords, version) {
  const [, eccPerBlock, g1Count, g2Count] = VERSIONS[version];
  const blockCount = g1Count + g2Count;
  const shortLength = Math.floor(codewords.length / blockCount);

  const dataBlocks = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i += 1) {
    const length = i < g1Count ? shortLength : shortLength + 1;
    dataBlocks.push(codewords.slice(offset, offset + length));
    offset += length;
  }
  const eccBlocks = dataBlocks.map((block) => eccCodewords(block, eccPerBlock));

  const result = [];
  const longest = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < longest; i += 1) {
    for (const block of dataBlocks) if (i < block.length) result.push(block[i]);
  }
  for (let i = 0; i < eccPerBlock; i += 1) {
    for (const block of eccBlocks) result.push(block[i]);
  }
  return result;
}


/* ------------------------------------------------------------------ *
 * Matrix construction
 * ------------------------------------------------------------------ */

function buildMatrix(version, bytes, mask) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFinder = (row, col) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const onRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                       (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        modules[rr][cc] = onRing || inCore ? 1 : 0;
        reserved[rr][cc] = true;
      }
    }
  };
  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i += 1) {
    modules[6][i] = modules[i][6] = i % 2 === 0 ? 1 : 0;
    reserved[6][i] = reserved[i][6] = true;
  }

  // Alignment patterns, skipping those that would collide with a finder.
  const centres = ALIGNMENT[version];
  for (const row of centres) {
    for (const col of centres) {
      if ((row === 6 && col === 6) ||
          (row === 6 && col === size - 7) ||
          (row === size - 7 && col === 6)) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          modules[row + r][col + c] =
            Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0;
          reserved[row + r][col + c] = true;
        }
      }
    }
  }

  // Reserve the format areas and set the one always-dark module.
  // The two trailing strips are 8 modules each, not 9. Reserving one extra
  // skipped two data positions during layout, which shifts every codeword
  // after them and turns the symbol into noise that still looks like a QR.
  for (let i = 0; i < 9; i += 1) {
    reserved[8][i] = reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  modules[size - 8][8] = 1;
  reserved[size - 8][8] = true;

  // Lay the codewords in the vertical boustrophedon the spec describes.
  const bits = [];
  for (const byte of bytes) for (let i = 7; i >= 0; i -= 1) bits.push((byte >> i) & 1);

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1; // skip the vertical timing column
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        let bit = bitIndex < bits.length ? bits[bitIndex++] : 0;
        // Mask 0: the only one implemented, chosen at call time.
        if (maskAt(mask, row, col)) bit ^= 1;
        modules[row][col] = bit;
      }
    }
    upward = !upward;
  }

  // Format information, written twice.
  const format = FORMAT_M[mask];
  for (let i = 0; i < 15; i += 1) {
    const bit = (format >> i) & 1;
    if (i < 6) modules[8][i] = bit;
    else if (i < 8) modules[8][i + 1] = bit;
    else if (i === 8) modules[7][8] = bit;
    else modules[14 - i][8] = bit;

    // Seven modules up the left edge, then eight along the top-right. Using
    // eight here overwrote the always-dark module at (size-8, 8), which sits
    // immediately above them.
    if (i < 7) modules[size - 1 - i][8] = bit;
    else modules[8][size - 15 + i] = bit;
  }

  return modules;
}

function maskAt(mask, row, col) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}


/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Encode text into a square matrix of 0/1. */
function encode(text) {
  const byteLength = new TextEncoder().encode(text).length;
  const version = pickVersion(byteLength);
  const codewords = interleave(encodeData(text, version), version);
  // Mask 0 is used unconditionally. Full mask selection scores eight candidates
  // to minimise visual noise; every reader handles any valid mask, and a TV
  // shows the code at 400px where the difference does not matter.
  return buildMatrix(version, codewords, 0);
}

/**
 * Draw into a canvas. The quiet zone is not decoration — readers need four
 * modules of white around the symbol or they will not lock on.
 */
function draw(canvas, text, { quietZone = 4 } = {}) {
  const matrix = encode(text);
  const size = matrix.length + quietZone * 2;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix.length; col += 1) {
      if (matrix[row][col]) ctx.fillRect(col + quietZone, row + quietZone, 1, 1);
    }
  }
  return size;
}

export { draw, encode, pickVersion };
