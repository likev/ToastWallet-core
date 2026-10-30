const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../www/js', p), 'utf8');

test('COOKIE-04: openExternalUrl uses noopener,noreferrer and scheme allowlist', () => {
  const s = read('app-init.js');
  assert.match(s, /noopener,noreferrer/);
  assert.match(s, /mailto:/);
});
test('COOKIE-04: paylink scrubbed from history', () => {
  assert.match(read('app-init.js'), /history\.replaceState/);
});
test('MEM-07: debug disabled by default', () => {
  assert.match(read('state.js'), /debug:\s*false/);
});
test('MEM-07: no ungated payload logging', () => {
  assert.doesNotMatch(read('modules/xrpl-tx.js'), /^\s*console\.log\((payment|order|cancel)\)/m);
});
test('MEM-07: onerror does not echo url', () => {
  assert.doesNotMatch(read('head-shim.js'), /message \+ " " \+ url/);
});
test('doPinPad Help resets enteredpin', () => {
  assert.doesNotMatch(read('ui/login.js'), /^\s*pin = ""/m);
});

test('PIN throttle wired to real validatePin outcome', () => {
  const s = read('ui/login.js');
  assert.match(s, /recordPinFailure\(\);/);
  assert.match(s, /resetPinThrottle\(\);/);
  assert.match(s, /PIN Locked/);
});
test('randUniform is unbiased (rejection sampling) and used for recovery phrase', () => {
  assert.match(read('modules/crypto.js'), /0x100000000 % n/);
  assert.doesNotMatch(read('ui/settings.js'), /randombytes_random\(\) %/);
  assert.match(read('ui/settings.js'), /randUniform\(arr\.length\)/);
});
test('randUniform / randShuffleArray behave', () => {
  const crypto = require('node:crypto');
  global.window = global.window || {};
  global.sodium = { randombytes_buf: (n) => new Uint8Array(crypto.randomBytes(n)) };
  const m = require('../../www/js/modules/crypto.js');
  const counts = new Array(7).fill(0);
  for (let i = 0; i < 7000; i++) counts[m.randUniform(7)]++;
  counts.forEach((c) => assert.ok(c > 800 && c < 1200, 'count ' + c));
  const a = [1,2,3,4,5]; m.randShuffleArray(a);
  assert.deepStrictEqual(a.slice().sort(), [1,2,3,4,5]);
});
test('COOKIE-05: backup view documents cleartext metadata', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '../../www/views/tabbackup2.html'), 'utf8'), /unencrypted/);
});
