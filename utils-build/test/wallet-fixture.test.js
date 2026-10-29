'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const compat = require('../sodium-compat.js');

const walletFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fixtures/wallet-v3.0.1.json'), 'utf8')
);

function createMockDb(initialDocs = {}) {
  const store = new Map();
  for (const [k, v] of Object.entries(initialDocs)) {
    store.set(k, JSON.parse(JSON.stringify(v)));
  }
  return {
    get: (key) => {
      if (store.has(key)) return Promise.resolve(store.get(key));
      return Promise.reject(new Error('not found'));
    },
    upsert: (key, diffFunc) => {
      const existing = store.get(key) || {};
      const updated = diffFunc(existing);
      store.set(key, updated);
      return Promise.resolve(updated);
    },
    _store: store
  };
}

function loadRealCryptoModule(db, customSodium = compat) {
  const cryptoSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/modules/crypto.js'), 'utf8');
  const context = {
    console,
    Math,
    TypeError,
    Error,
    JSON,
    window: {},
    sodium: customSodium,
    db,
    handle_error: (e) => { throw e; },
    debug: false
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(cryptoSrc, context);
  return context;
}

test('crypto.js: validatePin with 32-byte scrypt pindata', async () => {
  const db = createMockDb({ pindata: walletFixture.pouchdb.pindata });
  const ctx = loadRealCryptoModule(db);

  let success = false;
  let fail = false;
  await new Promise((resolve) => {
    ctx.validatePin(walletFixture.credentials.pin, () => { success = true; resolve(); }, () => { fail = true; resolve(); }, () => resolve());
  });
  assert.equal(success, true);
  assert.equal(fail, false);

  // Wrong PIN
  success = false;
  fail = false;
  await new Promise((resolve) => {
    ctx.validatePin('wrongpin', () => { success = true; resolve(); }, () => { fail = true; resolve(); }, () => resolve());
  });
  assert.equal(success, false);
  assert.equal(fail, true);
});

test('crypto.js: validatePin with 16-byte legacy SipHash pindata', async () => {
  const db = createMockDb({ pindata: walletFixture.pouchdb.pindata_legacy });
  const ctx = loadRealCryptoModule(db);

  let success = false;
  let fail = false;
  await new Promise((resolve) => {
    ctx.validatePin(walletFixture.credentials.pin, () => { success = true; resolve(); }, () => { fail = true; resolve(); }, () => resolve());
  });
  assert.equal(success, true);
  assert.equal(fail, false);

  // Wrong PIN
  success = false;
  fail = false;
  await new Promise((resolve) => {
    ctx.validatePin('wrongpin', () => { success = true; resolve(); }, () => { fail = true; resolve(); }, () => resolve());
  });
  assert.equal(success, false);
  assert.equal(fail, true);
});

test('crypto.js: validatePin with empty database calls nopinsetfunc', async () => {
  const db = createMockDb({});
  const ctx = loadRealCryptoModule(db);

  let noPin = false;
  await new Promise((resolve) => {
    ctx.validatePin('', () => resolve(), () => resolve(), () => { noPin = true; resolve(); });
  });
  assert.equal(noPin, true);
});

test('crypto.js: setPin creates valid scrypt pindata and can be validated', async () => {
  const db = createMockDb({});
  const ctx = loadRealCryptoModule(db);

  await new Promise((resolve, reject) => {
    ctx.setPin('654321', resolve, reject);
  });

  const stored = db._store.get('pindata');
  assert.ok(stored);
  const data = JSON.parse(stored.data);
  assert.equal(data.salt.length, 72); // 8 checksum + 64 hex (32 bytes)
  assert.equal(data.hash.length, 72);

  let success = false;
  await new Promise((resolve) => {
    ctx.validatePin('654321', () => { success = true; resolve(); }, () => resolve(), () => resolve());
  });
  assert.equal(success, true);
});

test('crypto.js: tohex_chksum and fromhex_chksum round-trip and corruption detection', () => {
  const ctx = loadRealCryptoModule(createMockDb({}));
  const original = 'secure message';
  const hex = ctx.tohex_chksum(original);
  assert.equal(ctx.fromhex_chksum(hex, 'string'), original);

  // Corrupted checksum
  const badChk = (hex[0] === 'a' ? 'b' : 'a') + hex.slice(1);
  assert.equal(ctx.fromhex_chksum(badChk), false);

  // Corrupted body
  const badBody = hex.slice(0, 8) + (hex[8] === '0' ? '1' : '0') + hex.slice(9);
  assert.equal(ctx.fromhex_chksum(badBody), false);
});

test('wallet fixture: validatePassphrase and erk flows', () => {
  const { credentials, pouchdb } = walletFixture;
  const ppdata = JSON.parse(pouchdb.ppdata.data);
  const rpdata = JSON.parse(pouchdb.rpdata.data);

  // Passphrase verification
  const salt1 = compat.from_hex(ppdata.salt1.slice(8));
  const salt2 = compat.from_hex(ppdata.salt2.slice(8));
  const k1 = compat.crypto_pwhash_scryptsalsa208sha256(16, credentials.passphrase, salt1, 4, 33554432);
  const pphash = compat.crypto_pwhash_scryptsalsa208sha256(16, k1, salt2, 4, 33554432);
  const computedPpHash = compat.crypto_generichash(4, pphash, '', 'hex') + compat.to_hex(pphash);
  assert.equal(computedPpHash, ppdata.hash);

  // Recovery phrase verification
  const rpsalt1 = compat.from_hex(rpdata.salt1.slice(8));
  const rpsalt2 = compat.from_hex(rpdata.salt2.slice(8));
  const rk1 = compat.crypto_pwhash_scryptsalsa208sha256(16, credentials.recoveryphrase, rpsalt1, 4, 33554432);
  const rphash = compat.crypto_pwhash_scryptsalsa208sha256(16, rk1, rpsalt2, 4, 33554432);
  const computedRpHash = compat.crypto_generichash(4, rphash, '', 'hex') + compat.to_hex(rphash);
  assert.equal(computedRpHash, rpdata.hash);

  // Decrypt erk via passphrase
  const secret32key = compat.crypto_pwhash_scryptsalsa208sha256(32, credentials.passphrase, salt1, 4, 33554432);
  const erkBytes = compat.from_hex(rpdata.erk.slice(8));
  const nonce = erkBytes.slice(0, 24);
  const ct = erkBytes.slice(24);
  const decryptedErk = compat.crypto_secretbox_open_easy(ct, nonce, secret32key);
  assert.deepEqual(decryptedErk, rk1);
});

test('wallet fixture: account seed decryption via passphrase and recovery phrase', () => {
  const { credentials, pouchdb } = walletFixture;
  const ppdata = JSON.parse(pouchdb.ppdata.data);
  const rpdata = JSON.parse(pouchdb.rpdata.data);
  const accounts = JSON.parse(pouchdb.accounts.data);

  const ppsalt1 = compat.from_hex(ppdata.salt1.slice(8));
  const rpsalt1 = compat.from_hex(rpdata.salt1.slice(8));

  const secretkey = compat.crypto_pwhash_scryptsalsa208sha256(16, credentials.passphrase, ppsalt1, 4, 33554432);
  const recoverykey = compat.crypto_pwhash_scryptsalsa208sha256(16, credentials.recoveryphrase, rpsalt1, 4, 33554432);

  for (const acc of credentials.accounts) {
    const accRecord = accounts[acc.address];
    assert.ok(accRecord, `Account ${acc.address} not in fixture`);

    // Path 1: Passphrase decryption
    const ppsalt = compat.from_hex(accRecord.ppsalt.slice(8));
    const ppsecret32 = compat.crypto_pwhash_scryptsalsa208sha256(32, secretkey, ppsalt, 4, 33554432);
    const ppsecretBytes = compat.from_hex(accRecord.ppsecret.slice(8));
    const ppNonce = ppsecretBytes.slice(0, 24);
    const ppCt = ppsecretBytes.slice(24);
    const decryptedViaPp = compat.to_string(compat.crypto_secretbox_open_easy(ppCt, ppNonce, ppsecret32));
    assert.equal(decryptedViaPp, acc.seed, `Passphrase decrypt failed for ${acc.address}`);

    // Path 2: Recovery phrase decryption
    const rpsalt = compat.from_hex(accRecord.rpsalt.slice(8));
    const rpsecret32 = compat.crypto_pwhash_scryptsalsa208sha256(32, recoverykey, rpsalt, 4, 33554432);
    const rpsecretBytes = compat.from_hex(accRecord.rpsecret.slice(8));
    const rpNonce = rpsecretBytes.slice(0, 24);
    const rpCt = rpsecretBytes.slice(24);
    const decryptedViaRp = compat.to_string(compat.crypto_secretbox_open_easy(rpCt, rpNonce, rpsecret32));
    assert.equal(decryptedViaRp, acc.seed, `Recovery decrypt failed for ${acc.address}`);
  }
});

test('wallet fixture: validateDataStores checks and backup verification', () => {
  const { pouchdb, backup_code } = walletFixture;

  // Verify backup code format: 8 hex chars BLAKE2b-4 + JSON payload
  const hash = backup_code.slice(0, 8);
  const jsonStr = backup_code.slice(8);
  const expectedHash = compat.crypto_generichash(4, jsonStr, '', 'hex');
  assert.equal(hash, expectedHash, 'Backup checksum mismatch');

  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.walletversion, '1.0');
  assert.ok(parsed.pindata);
  assert.ok(parsed.ppdata);
  assert.ok(parsed.rpdata);
  assert.ok(parsed.accounts);

  // Validate hex fields format as in backup.js isvalidhex()
  const isvalidhex = (h) => {
    if (typeof h === 'object') {
      for (const i in h) {
        if (typeof h[i] === 'object' && !isvalidhex(h[i])) return false;
        else if (!/^[a-f0-9]+$/m.test(h[i])) return false;
      }
      return true;
    }
    return h.length % 2 === 0 && /^[a-f0-9]+$/m.test(h);
  };

  assert.equal(isvalidhex(parsed.pindata), true);
  assert.equal(isvalidhex(parsed.ppdata), true);
  assert.equal(isvalidhex(parsed.rpdata), true);
  for (const i in parsed.accounts) {
    assert.equal(isvalidhex(parsed.accounts[i].ppsalt), true);
    assert.equal(isvalidhex(parsed.accounts[i].rpsalt), true);
    assert.equal(isvalidhex(parsed.accounts[i].ppsecret), true);
    assert.equal(isvalidhex(parsed.accounts[i].rpsecret), true);
  }
});
