'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const compat = require('../sodium-compat.js');

const vectors = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fixtures/sodium-vectors.json'), 'utf8')
);

function fromHex(h) {
  return new Uint8Array(Buffer.from(h, 'hex'));
}

function toHex(b) {
  return Buffer.from(b).toString('hex');
}

test('Constants match libsodium 1.0.13', () => {
  for (const [key, val] of Object.entries(vectors.constants)) {
    assert.equal(compat[key], val, `Constant mismatch for ${key}`);
  }
});

test('scrypt vectors match and throws match', () => {
  for (const v of vectors.scrypt) {
    if (v.throws) {
      assert.throws(() => {
        const salt = fromHex(v.saltHex);
        compat.crypto_pwhash_scryptsalsa208sha256(v.dkLen, v.password, salt, v.ops, v.mem, v.fmt);
      }, undefined, `Expected throw for scrypt: ${v.reason}`);
    } else if (v.nested) {
      const s1 = fromHex(v.salt1Hex);
      const s2 = fromHex(v.salt2Hex);
      const k1 = compat.crypto_pwhash_scryptsalsa208sha256(16, v.phrase, s1, 4, 33554432);
      assert.equal(toHex(k1), v.k1Hex, 'Nested scrypt k1 mismatch');
      const k2 = compat.crypto_pwhash_scryptsalsa208sha256(32, k1, s2, 4, 33554432);
      assert.equal(toHex(k2), v.k2Hex, 'Nested scrypt k2 mismatch');
    } else {
      const pw = v.pwType === 'hex' ? fromHex(v.password) : v.password;
      const salt = fromHex(v.saltHex);
      const out = compat.crypto_pwhash_scryptsalsa208sha256(v.dkLen, pw, salt, v.ops, v.mem);
      assert.equal(toHex(out), v.outHex, `scrypt mismatch for pw=${v.password}, dkLen=${v.dkLen}`);
    }
  }
});

test('generichash vectors match and throws match', () => {
  for (const v of vectors.generichash) {
    if (v.throws) {
      assert.throws(() => {
        const key = v.keyHex ? fromHex(v.keyHex) : v.key;
        compat.crypto_generichash(v.len, v.msg, key, v.fmt);
      }, undefined, `Expected throw for generichash: ${v.reason}`);
    } else {
      const msg = v.msgType === 'bytes' ? fromHex(v.msg) : v.msg;
      const key = v.keyType === 'bytes' ? fromHex(v.key) : v.key;
      const out = compat.crypto_generichash(v.len, msg, key, v.fmt);
      assert.equal(out, v.outHex, `generichash mismatch for len=${v.len}`);
    }
  }
});

test('secretbox vectors match and throws match', () => {
  for (const v of vectors.secretbox) {
    if (v.throws) {
      assert.throws(() => {
        const ct = fromHex(v.ctHex);
        const nonce = fromHex(v.nonceHex);
        const key = fromHex(v.keyHex);
        compat.crypto_secretbox_open_easy(ct, nonce, key);
      }, undefined, `Expected throw for secretbox: ${v.reason}`);
    } else {
      const msg = v.msgType === 'bytes' ? fromHex(v.msg) : v.msg;
      const nonce = fromHex(v.nonceHex);
      const key = fromHex(v.keyHex);
      const ct = compat.crypto_secretbox_easy(msg, nonce, key, v.fmt);
      const ctBytes = v.fmt === 'hex' ? fromHex(ct) : ct;
      assert.equal(toHex(ctBytes), v.ctHex, `secretbox ct mismatch for msgType=${v.msgType}, fmt=${v.fmt}`);

      const opened = compat.crypto_secretbox_open_easy(ctBytes, nonce, key, v.msgType === 'string' ? 'text' : undefined);
      if (v.msgType === 'string') {
        assert.equal(opened, v.openedText, 'secretbox opened text mismatch');
      } else {
        assert.equal(toHex(opened), v.openedHex, 'secretbox opened bytes mismatch');
      }
    }
  }
});

test('shorthash vectors match and throws match', () => {
  for (const v of vectors.shorthash) {
    if (v.throws) {
      assert.throws(() => {
        const key = fromHex(v.keyHex);
        compat.crypto_shorthash(v.msg, key, v.fmt);
      }, undefined, `Expected throw for shorthash: ${v.reason}`);
    } else {
      const key = fromHex(v.keyHex);
      const out = compat.crypto_shorthash(v.msg, key, v.fmt);
      const outHex = v.fmt === 'hex' ? out : toHex(out);
      assert.equal(outHex, v.outHex, `shorthash mismatch for msg=${v.msg}, fmt=${v.fmt}`);
    }
  }
});

test('encoding vectors match and throws match', () => {
  for (const v of vectors.encoding.to_hex) {
    const b = fromHex(v.inputHex);
    assert.equal(compat.to_hex(b), v.out);
  }
  for (const v of vectors.encoding.from_hex) {
    if (v.throws) {
      assert.throws(() => compat.from_hex(v.input), TypeError, `Expected TypeError for from_hex: ${v.reason}`);
    } else {
      assert.equal(toHex(compat.from_hex(v.input)), v.outHex);
    }
  }
  for (const v of vectors.encoding.from_string) {
    assert.equal(toHex(compat.from_string(v.input)), v.outHex);
  }
  for (const v of vectors.encoding.to_string) {
    if (v.throws) {
      assert.throws(() => compat.to_string(fromHex(v.inputHex)), TypeError, `Expected TypeError for to_string: ${v.reason}`);
    } else {
      assert.equal(compat.to_string(fromHex(v.inputHex)), v.out);
    }
  }
});

test('randombytes_buf and randombytes_random', () => {
  const b1 = compat.randombytes_buf(32);
  assert.equal(b1 instanceof Uint8Array, true);
  assert.equal(b1.length, 32);

  const bHex = compat.randombytes_buf(16, 'hex');
  assert.equal(typeof bHex, 'string');
  assert.equal(bHex.length, 32);
  assert.match(bHex, /^[0-9a-f]{32}$/);

  const rnd = compat.randombytes_random();
  assert.equal(typeof rnd, 'number');
  assert.equal(rnd >= 0 && rnd <= 0xffffffff, true);

  assert.throws(() => compat.randombytes_buf(-1), TypeError);
  assert.throws(() => compat.randombytes_buf('32'), TypeError);
  assert.throws(() => compat.randombytes_buf(32, 'unknown'), Error);
});
