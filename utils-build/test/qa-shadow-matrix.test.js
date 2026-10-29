'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const loadLegacySodium = require('./load-legacy-sodium.js');
const compat = require('../sodium-compat.js');
const createShadow = require('./sodium-shadow.js');

const walletFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fixtures/wallet-v3.0.1.json'), 'utf8')
);

test('Phase 2: Complete 13-scenario QA matrix under shadow mode', (t) => {
  const legacy = loadLegacySodium();
  if (!legacy) {
    t.skip('Legacy libsodium not available for shadow testing');
    return;
  }

  const shadow = createShadow(legacy, compat);

  function tohex_chksum(data) {
    if (typeof data === 'string') data = shadow.from_string(data);
    return shadow.crypto_generichash(4, data, '', 'hex') + shadow.to_hex(data);
  }

  function fromhex_chksum(hex, format) {
    const chksum = hex.slice(0, 8);
    const payload = shadow.from_hex(hex.slice(8));
    if (shadow.crypto_generichash(4, payload, '', 'hex') !== chksum) return false;
    if (format === 'string') return shadow.to_string(payload);
    return payload;
  }

  const pin = walletFixture.credentials.pin;
  const pp = walletFixture.credentials.passphrase;
  const rp = walletFixture.credentials.recoveryphrase;
  const { pouchdb, backup_code } = walletFixture;

  // Scenario 1: Unlock with PIN; wrong PIN rejected (scrypt PIN, fromhex_chksum)
  {
    const pindata = JSON.parse(pouchdb.pindata.data);
    const salt = fromhex_chksum(pindata.salt);
    const scryptHash = shadow.crypto_pwhash_scryptsalsa208sha256(32, pin, salt, 4, 33554432);
    assert.equal(tohex_chksum(scryptHash), pindata.hash);

    const wrongHash = shadow.crypto_pwhash_scryptsalsa208sha256(32, 'wrong-pin', salt, 4, 33554432);
    assert.notEqual(tohex_chksum(wrongHash), pindata.hash);
  }

  // Scenario 2: Unlock with legacy 16-byte-salt PIN (injected pindata_legacy) (crypto_shorthash)
  {
    const pindataLegacy = JSON.parse(pouchdb.pindata_legacy.data);
    const salt = fromhex_chksum(pindataLegacy.salt);
    assert.equal(salt.length, 16);
    const hash = tohex_chksum(shadow.crypto_shorthash(pin, salt));
    assert.equal(hash, pindataLegacy.hash);

    const wrongHash = tohex_chksum(shadow.crypto_shorthash('wrong-pin', salt));
    assert.notEqual(wrongHash, pindataLegacy.hash);
  }

  // Scenario 3: Reset PIN via recovery phrase (validatePassphrase (recovery), setPin)
  {
    const rpdata = JSON.parse(pouchdb.rpdata.data);
    const s1 = fromhex_chksum(rpdata.salt1);
    const s2 = fromhex_chksum(rpdata.salt2);
    const rk = shadow.crypto_pwhash_scryptsalsa208sha256(16, rp, s1, 4, 33554432);
    const rphash = tohex_chksum(shadow.crypto_pwhash_scryptsalsa208sha256(16, rk, s2, 4, 33554432));
    assert.equal(rphash, rpdata.hash);

    const newPin = '987654';
    const newSalt = shadow.randombytes_buf(32);
    const newHash = shadow.crypto_pwhash_scryptsalsa208sha256(32, newPin, newSalt, 4, 33554432);
    assert.equal(newSalt.length, 32);
    assert.equal(newHash.length, 32);
  }

  // Scenario 4: Reveal account secret with passphrase; wrong passphrase rejected
  {
    const ppdata = JSON.parse(pouchdb.ppdata.data);
    const accounts = JSON.parse(pouchdb.accounts.data);
    const s1 = fromhex_chksum(ppdata.salt1);
    const secKey = shadow.crypto_pwhash_scryptsalsa208sha256(16, pp, s1, 4, 33554432);

    for (const acc of walletFixture.credentials.accounts) {
      const rec = accounts[acc.address];
      const ppsalt = fromhex_chksum(rec.ppsalt);
      const ppsec32 = shadow.crypto_pwhash_scryptsalsa208sha256(32, secKey, ppsalt, 4, 33554432);
      const raw = fromhex_chksum(rec.ppsecret);
      const nonce = raw.slice(0, 24);
      const ct = raw.slice(24);
      const decrypted = shadow.to_string(shadow.crypto_secretbox_open_easy(ct, nonce, ppsec32));
      assert.equal(decrypted, acc.seed);

      // Wrong passphrase
      const wrongSecKey = shadow.crypto_pwhash_scryptsalsa208sha256(16, 'wrong-pp', s1, 4, 33554432);
      const wrongSec32 = shadow.crypto_pwhash_scryptsalsa208sha256(32, wrongSecKey, ppsalt, 4, 33554432);
      assert.throws(() => shadow.crypto_secretbox_open_easy(ct, nonce, wrongSec32));
    }
  }

  // Scenario 5: Repeated actions hitting _validatePassphraseCacheHit, plus wrong passphrase
  {
    const cacheSalt = shadow.randombytes_buf(shadow.crypto_shorthash_KEYBYTES);
    const cacheHash = shadow.crypto_shorthash(pp, cacheSalt, 'hex');

    // Cache hit
    const hit = cacheHash === shadow.crypto_shorthash(pp, cacheSalt, 'hex');
    assert.equal(hit, true);

    // Cache miss on wrong passphrase
    const miss = cacheHash === shadow.crypto_shorthash('wrong-passphrase', cacheSalt, 'hex');
    assert.equal(miss, false);
  }

  // Scenario 6: Prepare payment -> confirm screen; tamper confirmpay in DevTools -> rejected
  {
    const nonce = shadow.randombytes_random();
    const confirmpay = { account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', dest: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe', amt: '10', nonce };
    const hash = shadow.crypto_generichash(16, JSON.stringify(confirmpay), '' + nonce, 'hex');

    // Valid check
    assert.equal(shadow.crypto_generichash(16, JSON.stringify(confirmpay), '' + confirmpay.nonce, 'hex'), hash);

    // Tampered check (amount altered)
    const tampered = { ...confirmpay, amt: '1000' };
    assert.notEqual(shadow.crypto_generichash(16, JSON.stringify(tampered), '' + tampered.nonce, 'hex'), hash);
  }

  // Scenario 7: Place/cancel order, add/modify trustline, set account flags
  {
    const nonce = shadow.randombytes_random();
    const actions = [
      { type: 'order', seq: 123, amt: '50' },
      { type: 'trustline', currency: 'USD', limit: '1000' },
      { type: 'flags', flag: 'asfRequireDest' }
    ];
    for (const act of actions) {
      act.nonce = nonce;
      const h = shadow.crypto_generichash(16, JSON.stringify(act), '' + nonce, 'hex');
      assert.equal(shadow.crypto_generichash(16, JSON.stringify(act), '' + act.nonce, 'hex'), h);
    }
  }

  // Scenario 8: Generate offline payment code & validate it (valid + corrupted checksum)
  {
    const codeHex = 'deadbeef12345678';
    const checksum = shadow.crypto_generichash(1, codeHex, 'offlinecode', 'hex');
    assert.equal(checksum.toUpperCase(), shadow.crypto_generichash(1, codeHex, 'offlinecode', 'hex').toUpperCase());

    const badChecksum = (checksum === 'aa' ? 'bb' : 'aa');
    assert.notEqual(badChecksum.toUpperCase(), shadow.crypto_generichash(1, codeHex, 'offlinecode', 'hex').toUpperCase());
  }

  // Scenario 9: Generate new account + import existing secp256k1 & ed25519 seeds
  {
    const newSeed = 'snoPBrXtMeMyMHUVTgbuqAfg1SUtb';
    const nonce = shadow.randombytes_buf(24);
    const key = shadow.randombytes_buf(32);
    const ctHex = shadow.crypto_secretbox_easy(newSeed, nonce, key, 'hex');
    const ctBytes = shadow.from_hex(shadow.to_hex(nonce) + ctHex);
    const stored = tohex_chksum(ctBytes);

    const unpacked = fromhex_chksum(stored);
    const recoveredSeed = shadow.to_string(shadow.crypto_secretbox_open_easy(unpacked.slice(24), unpacked.slice(0, 24), key));
    assert.equal(recoveredSeed, newSeed);
  }

  // Scenario 10: Change passphrase; lock/unlock; reveal all account secrets
  {
    const newPp = 'my completely new secure passphrase';
    const ppdata = JSON.parse(pouchdb.ppdata.data);
    const s1 = fromhex_chksum(ppdata.salt1);
    const oldSecKey = shadow.crypto_pwhash_scryptsalsa208sha256(16, pp, s1, 4, 33554432);

    const newSalt1 = shadow.randombytes_buf(32);
    const newSecKey = shadow.crypto_pwhash_scryptsalsa208sha256(16, newPp, newSalt1, 4, 33554432);

    const accounts = JSON.parse(pouchdb.accounts.data);
    for (const acc of walletFixture.credentials.accounts) {
      const rec = accounts[acc.address];
      const oldPpsalt = fromhex_chksum(rec.ppsalt);
      const oldPpsec32 = shadow.crypto_pwhash_scryptsalsa208sha256(32, oldSecKey, oldPpsalt, 4, 33554432);
      const raw = fromhex_chksum(rec.ppsecret);
      const secret = shadow.crypto_secretbox_open_easy(raw.slice(24), raw.slice(0, 24), oldPpsec32);

      const newPpsalt = shadow.randombytes_buf(32);
      const newPpsec32 = shadow.crypto_pwhash_scryptsalsa208sha256(32, newSecKey, newPpsalt, 4, 33554432);
      const newNonce = shadow.randombytes_buf(24);
      const newCt = shadow.crypto_secretbox_easy(secret, newNonce, newPpsec32);

      // Decrypt with new passphrase
      const decrypted = shadow.to_string(shadow.crypto_secretbox_open_easy(newCt, newNonce, newPpsec32));
      assert.equal(decrypted, acc.seed);
    }
  }

  // Scenario 11: Set new recovery phrase; use recovery phrase to reset passphrase
  {
    // Syllable generator simulation
    const syllables = ['ba', 'be', 'bi', 'bo', 'bu', 'da', 'de', 'di', 'do', 'du'];
    let generatedWord = '';
    for (let i = 0; i < 4; i++) {
      generatedWord += syllables[shadow.randombytes_random() % syllables.length];
    }
    assert.equal(generatedWord.length, 8);

    const newRp = generatedWord + ' phrase test';
    const newRpsalt1 = shadow.randombytes_buf(32);
    const newRpSecret = shadow.crypto_pwhash_scryptsalsa208sha256(16, newRp, newRpsalt1, 4, 33554432);

    const ppdata = JSON.parse(pouchdb.ppdata.data);
    const ppsalt1 = fromhex_chksum(ppdata.salt1);
    const sec32 = shadow.crypto_pwhash_scryptsalsa208sha256(32, pp, ppsalt1, 4, 33554432);

    const erkNonce = shadow.randombytes_buf(24);
    const erkCt = shadow.crypto_secretbox_easy(newRpSecret, erkNonce, sec32);
    const erkDecrypted = shadow.crypto_secretbox_open_easy(erkCt, erkNonce, sec32);
    assert.deepEqual(erkDecrypted, newRpSecret);
  }

  // Scenario 12: Export backup; validate & import old and new backup codes
  {
    // Old backup code from fixture
    const hash = backup_code.slice(0, 8);
    const json = backup_code.slice(8);
    assert.equal(hash, shadow.crypto_generichash(4, json, '', 'hex'));

    // New backup export
    const newBackup = JSON.stringify({ walletversion: '1.0', test: true });
    const newCode = shadow.crypto_generichash(4, newBackup, '', 'hex') + newBackup;
    assert.equal(newCode.slice(0, 8), shadow.crypto_generichash(4, newBackup, '', 'hex'));
  }

  // Scenario 13: Corrupt a byte in PouchDB doc -> reload (validateDataStores)
  {
    const ppdata = JSON.parse(pouchdb.ppdata.data);
    const good = fromhex_chksum(ppdata.salt1);
    assert.notEqual(good, false);

    // Corrupt one hex character
    const badSalt = (ppdata.salt1[0] === 'a' ? 'b' : 'a') + ppdata.salt1.slice(1);
    const corrupted = fromhex_chksum(badSalt);
    assert.equal(corrupted, false);

    // Also exercise string input in tohex_chksum (calls from_string)
    const strChk = tohex_chksum('example-salt-string');
    assert.equal(fromhex_chksum(strChk, 'string'), 'example-salt-string');
  }

  // 5. Verification of shadow report
  const rep = shadow.__shadowState.report();
  console.log('Shadow Mode QA Report:', JSON.stringify(rep, null, 2));

  assert.equal(rep.mismatchCount, 0, 'Shadow mode found mismatches!');
  assert.equal(rep.unshimmedCount, 0, 'Shadow mode found unshimmed symbols!');

  const requiredSymbols = [
    'crypto_pwhash_scryptsalsa208sha256',
    'crypto_generichash',
    'randombytes_buf',
    'randombytes_random',
    'crypto_secretbox_easy',
    'crypto_secretbox_open_easy',
    'to_hex',
    'from_hex',
    'to_string',
    'from_string',
    'crypto_shorthash'
  ];

  for (const sym of requiredSymbols) {
    assert.ok(rep.calls[sym] > 0, `Symbol ${sym} was never called during QA!`);
  }
});
