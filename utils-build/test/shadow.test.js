'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createShadow = require('../sodium-shadow.js');
const compat = require('../sodium-compat.js');

test('Shadow mode detects return value mismatch', () => {
  const legacy = {
    crypto_shorthash: (msg, key) => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    sodium_version_string: () => '1.0.13'
  };
  const faultyCompat = {
    ...compat,
    crypto_shorthash: (msg, key) => new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9])
  };

  const shadow = createShadow(legacy, faultyCompat);
  const secretKey = new Uint8Array(16);
  const res = shadow.crypto_shorthash('super-secret-pin', secretKey);

  // Authority check: legacy result returned
  assert.deepEqual(res, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

  const state = shadow.__shadowState;
  assert.equal(state.mismatches.length, 1);
  assert.equal(state.mismatches[0].fn, 'crypto_shorthash');
  assert.equal(state.mismatches[0].legacyOutcome, 'return:Uint8Array(8)');
  assert.equal(state.mismatches[0].compatOutcome, 'return:Uint8Array(8)');

  // Zero secret leakage check
  const stateStr = JSON.stringify(state);
  assert.equal(stateStr.includes('super-secret-pin'), false);
});

test('Shadow mode detects throw/return split', () => {
  const legacy = {
    crypto_generichash: () => { throw new Error('legacy error'); },
    sodium_version_string: () => '1.0.13'
  };
  const faultyCompat = {
    ...compat,
    crypto_generichash: () => 'abc'
  };

  const shadow = createShadow(legacy, faultyCompat);
  assert.throws(() => shadow.crypto_generichash(16, 'msg', ''), { message: 'legacy error' });

  const state = shadow.__shadowState;
  assert.equal(state.mismatches.length, 1);
  assert.equal(state.mismatches[0].legacyOutcome, 'throw:Error');
  assert.equal(state.mismatches[0].compatOutcome, 'return:string(3)');
});

test('Shadow mode logs UNSHIMMED symbols once', () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const legacy = {
      unsupported_extra_api: () => 'legacy_val',
      sodium_version_string: () => '1.0.13'
    };
    const shadow = createShadow(legacy, compat);

    const val1 = shadow.unsupported_extra_api();
    const val2 = shadow.unsupported_extra_api();
    assert.equal(val1, 'legacy_val');
    assert.equal(val2, 'legacy_val');

    assert.equal(shadow.__shadowState.unshimmed.length, 1);
    assert.equal(shadow.__shadowState.unshimmed[0], 'unsupported_extra_api');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = origWarn;
  }
});

test('Shadow mode zero secret leakage on complete flow', () => {
  const legacy = { ...compat, sodium_version_string: () => '1.0.13' };
  const shadow = createShadow(legacy, compat);

  const secretPin = '987654';
  const secretKey = compat.randombytes_buf(16);
  shadow.crypto_shorthash(secretPin, secretKey);

  const report = shadow.__shadowState.report();
  const serialized = JSON.stringify(report);

  assert.equal(serialized.includes(secretPin), false);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.calls.crypto_shorthash, 1);
});
