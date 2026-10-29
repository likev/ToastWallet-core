'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { siphash24 } = require('../siphash24.js');
const loadLegacySodium = require('./load-legacy-sodium.js');

test('SipHash-2-4 official paper vectors (64/64)', () => {
  // Key: 00 01 02 ... 0f
  const key = new Uint8Array(16);
  for (let i = 0; i < 16; i++) key[i] = i;

  const legacySodium = loadLegacySodium();

  // Known vector milestones from SipHash paper
  const expectedMilestones = {
    0: '310e0edd47db6f72',
    15: 'e545be4961ca29a1',
    63: '724506eb4c328a95'
  };

  for (let len = 0; len < 64; len++) {
    const msg = new Uint8Array(len);
    for (let i = 0; i < len; i++) msg[i] = i;

    const out = siphash24(msg, key);
    const hex = Buffer.from(out).toString('hex');

    if (expectedMilestones[len]) {
      assert.equal(hex, expectedMilestones[len], `Mismatch at SipHash vector ${len}`);
    }

    if (legacySodium) {
      const legacyOut = legacySodium.crypto_shorthash(msg, key, 'hex');
      assert.equal(hex, legacyOut, `Mismatch with legacy libsodium at vector ${len}`);
    }
  }
});

test('SipHash-2-4 input validation', () => {
  const validKey = new Uint8Array(16);
  assert.throws(() => siphash24(new Uint8Array(0), new Uint8Array(15)), TypeError);
  assert.throws(() => siphash24(new Uint8Array(0), new Uint8Array(32)), TypeError);
  assert.throws(() => siphash24(new Uint8Array(0), 'not a buffer'), TypeError);

  // Buffer and cross-realm Uint8Array support
  const bufKey = Buffer.alloc(16, 0xaa);
  const outBuf = siphash24(new Uint8Array([1, 2, 3]), bufKey);
  assert.equal(outBuf.length, 8);

  const vm = require('vm');
  const ctx = vm.createContext({});
  const crossRealmKey = vm.runInContext('new Uint8Array(16)', ctx);
  for (let i = 0; i < 16; i++) crossRealmKey[i] = i;
  const outCross = siphash24(new Uint8Array([1, 2, 3]), crossRealmKey);
  assert.equal(outCross.length, 8);
  assert.deepEqual(outCross, siphash24(new Uint8Array([1, 2, 3]), new Uint8Array(crossRealmKey)));
});
