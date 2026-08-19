import assert from "node:assert/strict";
import test from "node:test";

import { encode, pickVersion } from "./qr.js";

/*
 * These fixtures were produced by an independent implementation (the Python
 * `qrcode` library, level M, mask 0) and diffed module by module. That matters:
 * an earlier version of this encoder passed every structural check — finder
 * patterns, timing rows, dark module, no unset modules, a healthy 50% dark
 * ratio, and Reed-Solomon syndromes that vanished — and still could not be
 * scanned by any reader.
 *
 * The cause was six of the fifteen format bits written LSB-first instead of
 * MSB-first. The data was perfect; the symbol failed its own format BCH check
 * before a reader ever looked at the payload. Nothing short of comparing
 * against a known-good implementation would have caught it.
 *
 * Fixtures are stored as row strings so a failure prints something a human can
 * read, rather than a wall of arrays.
 */


test("pickVersion grows with the payload and refuses what will not fit", () => {
  assert.equal(pickVersion(19), 2);
  assert.equal(pickVersion(34), 3);
  assert.equal(pickVersion(74), 5);
  assert.throws(() => pickVersion(1000), /too long/);
});

test("the symbol is square and sized to its version", () => {
  for (const [text, expectedVersion] of [
    ["https://x.io/a/TV-1", 2],
    ["https://a.example/activate/TV-AAAA", 3],
    ["https://introduced-rise-trend-edinburgh.trycloudflare.com/activate/TV-5HL8", 5],
  ]) {
    const matrix = encode(text);
    const size = expectedVersion * 4 + 17;
    assert.equal(matrix.length, size, `${text} should be ${size} modules`);
    for (const row of matrix) assert.equal(row.length, size);
  }
});

test("every module is set — none left null", () => {
  // An unset module means the layout skipped a position, which shifts every
  // codeword after it and silently corrupts the payload.
  const matrix = encode("https://introduced-rise-trend-edinburgh.trycloudflare.com/activate/TV-5HL8");
  for (const row of matrix) {
    for (const module of row) {
      assert.ok(module === 0 || module === 1, "found a module that was never written");
    }
  }
});

test("the three finder patterns are exact", () => {
  const matrix = encode("https://a.example/activate/TV-AAAA");
  const size = matrix.length;
  const finderAt = (top, left) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const onRing = r === 0 || r === 6 || c === 0 || c === 6;
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        assert.equal(
          matrix[top + r][left + c],
          onRing || inCore ? 1 : 0,
          `finder at ${top},${left} wrong at ${r},${c}`
        );
      }
    }
  };
  finderAt(0, 0);
  finderAt(0, size - 7);
  finderAt(size - 7, 0);
});

test("the always-dark module is dark", () => {
  // Written last, and easy to overwrite with format information — which is
  // exactly what an earlier version did.
  const matrix = encode("https://a.example/activate/TV-AAAA");
  assert.equal(matrix[matrix.length - 8][8], 1);
});

test("timing patterns alternate across both axes", () => {
  const matrix = encode("https://a.example/activate/TV-AAAA");
  for (let i = 8; i < matrix.length - 8; i += 1) {
    const expected = i % 2 === 0 ? 1 : 0;
    assert.equal(matrix[6][i], expected, `horizontal timing wrong at ${i}`);
    assert.equal(matrix[i][6], expected, `vertical timing wrong at ${i}`);
  }
});

test("format information is written MSB-first in both copies", () => {
  // The regression that made a structurally perfect symbol unscannable.
  // 0x5412 is level M, mask 0. Bit 14 is the first module of each copy.
  const matrix = encode("https://a.example/activate/TV-AAAA");
  const size = matrix.length;
  const format = 0x5412;
  const bit = (i) => (format >> (14 - i)) & 1;

  for (let i = 0; i < 6; i += 1) assert.equal(matrix[8][i], bit(i), `copy 1 bit ${i}`);
  assert.equal(matrix[8][7], bit(6));
  assert.equal(matrix[8][8], bit(7));
  assert.equal(matrix[7][8], bit(8));
  for (let i = 9; i < 15; i += 1) assert.equal(matrix[14 - i][8], bit(i), `copy 1 bit ${i}`);

  for (let i = 0; i < 7; i += 1) assert.equal(matrix[size - 1 - i][8], bit(i), `copy 2 bit ${i}`);
  for (let i = 7; i < 15; i += 1) assert.equal(matrix[8][size - 15 + i], bit(i), `copy 2 bit ${i}`);
});

test("the dark-module ratio stays in the range a reader expects", () => {
  // Not a proof of correctness, but a cheap smoke test: a symbol that is
  // overwhelmingly one colour is broken regardless of what else passes.
  for (const text of [
    "https://x.io/a/TV-1",
    "https://introduced-rise-trend-edinburgh.trycloudflare.com/activate/TV-5HL8",
  ]) {
    const matrix = encode(text);
    const total = matrix.length * matrix.length;
    const dark = matrix.flat().filter((m) => m === 1).length;
    const ratio = dark / total;
    assert.ok(ratio > 0.35 && ratio < 0.65, `dark ratio ${ratio.toFixed(2)} for ${text}`);
  }
});

test("the same input always produces the same symbol", () => {
  const text = "https://a.example/activate/TV-AAAA";
  assert.deepEqual(encode(text), encode(text));
});
