'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const loadLegacySodium = require('./load-legacy-sodium.js');
const compat = require('../sodium-compat.js');

const legacy = loadLegacySodium();

function prng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rand = prng(42);
function randBytes(n) {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(rand() * 256);
  return buf;
}

function randString(n) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_!@#$%^&*()';
  let str = '';
  for (let i = 0; i < n; i++) str += chars[Math.floor(rand() * chars.length)];
  return str;
}

test('Differential test: crypto_generichash (1,000 iterations)', (t) => {
  if (!legacy) {
    t.skip('Legacy libsodium not available');
    return;
  }
  for (let i = 0; i < 1000; i++) {
    const len = Math.floor(rand() * 64) + 1; // 1..64
    const keyLen = Math.floor(rand() * 65); // 0..64
    const key = keyLen === 0 ? '' : randBytes(keyLen);
    const msgLen = Math.floor(rand() * 100);
    const msg = rand(0) > 0.5 ? randString(msgLen) : randBytes(msgLen);
    const fmt = rand() > 0.5 ? 'hex' : undefined;

    const legacyOut = legacy.crypto_generichash(len, msg, key, fmt);
    const compatOut = compat.crypto_generichash(len, msg, key, fmt);

    if (fmt === 'hex') {
      assert.equal(compatOut, legacyOut, `generichash hex mismatch at iter ${i}`);
    } else {
      assert.deepEqual(compatOut, legacyOut, `generichash bytes mismatch at iter ${i}`);
    }
  }
});

test('Differential test: crypto_secretbox_easy & open_easy (1,000 iterations)', (t) => {
  if (!legacy) {
    t.skip('Legacy libsodium not available');
    return;
  }
  for (let i = 0; i < 1000; i++) {
    const msgLen = Math.floor(rand() * 128);
    const isString = rand() > 0.5;
    const msg = isString ? randString(msgLen) : randBytes(msgLen);
    const nonce = randBytes(24);
    const key = randBytes(32);
    const fmt = rand() > 0.5 ? 'hex' : undefined;

    const legacyCt = legacy.crypto_secretbox_easy(msg, nonce, key, fmt);
    const compatCt = compat.crypto_secretbox_easy(msg, nonce, key, fmt);

    if (fmt === 'hex') {
      assert.equal(compatCt, legacyCt, `secretbox_easy hex mismatch at iter ${i}`);
    } else {
      assert.deepEqual(compatCt, legacyCt, `secretbox_easy bytes mismatch at iter ${i}`);
    }

    const ctBytes = fmt === 'hex' ? compat.from_hex(compatCt) : compatCt;
    const openFmt = isString ? 'text' : undefined;
    const legacyPt = legacy.crypto_secretbox_open_easy(ctBytes, nonce, key, openFmt);
    const compatPt = compat.crypto_secretbox_open_easy(ctBytes, nonce, key, openFmt);

    if (isString) {
      assert.equal(compatPt, legacyPt, `secretbox_open_easy text mismatch at iter ${i}`);
    } else {
      assert.deepEqual(compatPt, legacyPt, `secretbox_open_easy bytes mismatch at iter ${i}`);
    }
  }
});

test('Differential test: crypto_shorthash (1,000 iterations)', (t) => {
  if (!legacy) {
    t.skip('Legacy libsodium not available');
    return;
  }
  for (let i = 0; i < 1000; i++) {
    const key = randBytes(16);
    const msgLen = Math.floor(rand() * 64);
    const msg = rand() > 0.5 ? randString(msgLen) : randBytes(msgLen);
    const fmt = rand() > 0.5 ? 'hex' : undefined;

    const legacyOut = legacy.crypto_shorthash(msg, key, fmt);
    const compatOut = compat.crypto_shorthash(msg, key, fmt);

    if (fmt === 'hex') {
      assert.equal(compatOut, legacyOut, `shorthash hex mismatch at iter ${i}`);
    } else {
      assert.deepEqual(compatOut, legacyOut, `shorthash bytes mismatch at iter ${i}`);
    }
  }
});

test('Differential test: to_hex and from_hex (1,000 iterations)', (t) => {
  if (!legacy) {
    t.skip('Legacy libsodium not available');
    return;
  }
  for (let i = 0; i < 1000; i++) {
    const len = Math.floor(rand() * 64) + 1; // 1..64 bytes
    const bytes = randBytes(len);

    const legacyHex = legacy.to_hex(bytes);
    const compatHex = compat.to_hex(bytes);
    assert.equal(compatHex, legacyHex, `to_hex mismatch at iter ${i}`);

    const legacyDecoded = legacy.from_hex(legacyHex);
    const compatDecoded = compat.from_hex(compatHex);
    assert.deepEqual(compatDecoded, legacyDecoded, `from_hex mismatch at iter ${i}`);
  }
});

test('Differential test: from_string and to_string (1,000 iterations)', (t) => {
  if (!legacy) {
    t.skip('Legacy libsodium not available');
    return;
  }
  for (let i = 0; i < 1000; i++) {
    const len = Math.floor(rand() * 50);
    const str = randString(len);

    const legacyBytes = legacy.from_string(str);
    const compatBytes = compat.from_string(str);
    assert.deepEqual(compatBytes, legacyBytes, `from_string mismatch at iter ${i}`);

    const legacyStr = legacy.to_string(legacyBytes);
    const compatStr = compat.to_string(compatBytes);
    assert.equal(compatStr, legacyStr, `to_string mismatch at iter ${i}`);
  }
});

test('Differential test: crypto_pwhash_scryptsalsa208sha256 (100 iterations)', (t) => {
  if (!legacy) {
    t.skip('Legacy libsodium not available');
    return;
  }
  for (let i = 0; i < 100; i++) {
    const dkLen = rand() > 0.5 ? 16 : 32;
    const salt = randBytes(32);
    const pwLen = Math.floor(rand() * 20);
    const isBytes = rand() > 0.5;
    const pw = isBytes ? randBytes(16) : randString(pwLen);

    const legacyOut = legacy.crypto_pwhash_scryptsalsa208sha256(dkLen, pw, salt, 4, 33554432);
    const compatOut = compat.crypto_pwhash_scryptsalsa208sha256(dkLen, pw, salt, 4, 33554432);
    assert.deepEqual(compatOut, legacyOut, `scrypt mismatch at iter ${i}`);
  }
});
