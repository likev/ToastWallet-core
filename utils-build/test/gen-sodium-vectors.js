'use strict';
const fs = require('fs');
const path = require('path');
const loadLegacySodium = require('./load-legacy-sodium.js');

function prng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rand = prng(1337);
function randomBytes(n) {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.floor(rand() * 256);
  return buf;
}

function toHex(buf) {
  return Buffer.from(buf).toString('hex');
}

function fromHex(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

function tohexChksum(sodium, data) {
  if (typeof data === 'string') data = sodium.from_string(data);
  return sodium.crypto_generichash(4, data, '', 'hex') + sodium.to_hex(data);
}

function fromhexChksum(sodium, hex, format) {
  const chksum = hex.slice(0, 8);
  const payload = sodium.from_hex(hex.slice(8));
  if (sodium.crypto_generichash(4, payload, '', 'hex') !== chksum) return false;
  if (format === 'string') return sodium.to_string(payload);
  return payload;
}

function generateVectors(sodium) {
  const vectors = {
    constants: {
      crypto_box_NONCEBYTES: sodium.crypto_box_NONCEBYTES,
      crypto_secretbox_NONCEBYTES: sodium.crypto_secretbox_NONCEBYTES,
      crypto_secretbox_KEYBYTES: sodium.crypto_secretbox_KEYBYTES,
      crypto_secretbox_MACBYTES: sodium.crypto_secretbox_MACBYTES,
      crypto_box_SECRETKEYBYTES: sodium.crypto_box_SECRETKEYBYTES,
      crypto_pwhash_scryptsalsa208sha256_SALTBYTES: sodium.crypto_pwhash_scryptsalsa208sha256_SALTBYTES,
      crypto_shorthash_KEYBYTES: sodium.crypto_shorthash_KEYBYTES,
      crypto_shorthash_BYTES: sodium.crypto_shorthash_BYTES,
      crypto_pwhash_OPSLIMIT_INTERACTIVE: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      crypto_pwhash_MEMLIMIT_INTERACTIVE: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    },
    scrypt: [],
    generichash: [],
    secretbox: [],
    shorthash: [],
    encoding: {
      to_hex: [],
      from_hex: [],
      to_string: [],
      from_string: []
    },
    app_composites: []
  };

  // 1. scrypt vectors
  const scryptPasswords = [
    { type: 'string', value: '123456' },
    { type: 'string', value: 'correct horse battery' },
    { type: 'string', value: 'test-password-123' },
    { type: 'string', value: 'パスワード🔑' },
    { type: 'string', value: 'p@sswörd_éèç' },
    { type: 'string', value: '' },
    { type: 'string', value: 'A'.repeat(200) },
    { type: 'hex', value: toHex(randomBytes(16)) } // 16-byte buffer (nested KDF)
  ];
  const dkLens = [16, 32];
  for (const pw of scryptPasswords) {
    for (const dkLen of dkLens) {
      const salt = randomBytes(32);
      const pwInput = pw.type === 'hex' ? fromHex(pw.value) : pw.value;
      const out = sodium.crypto_pwhash_scryptsalsa208sha256(dkLen, pwInput, salt, 4, 33554432);
      vectors.scrypt.push({
        dkLen,
        password: pw.value,
        pwType: pw.type,
        saltHex: toHex(salt),
        ops: 4,
        mem: 33554432,
        outHex: toHex(out)
      });
    }
  }

  // Nested scrypt matching settings.js
  const phrase = 'correct horse battery';
  const salt1 = randomBytes(32);
  const salt2 = randomBytes(32);
  const k1 = sodium.crypto_pwhash_scryptsalsa208sha256(16, phrase, salt1, 4, 33554432);
  const k2 = sodium.crypto_pwhash_scryptsalsa208sha256(32, k1, salt2, 4, 33554432);
  vectors.scrypt.push({
    nested: true,
    phrase,
    salt1Hex: toHex(salt1),
    salt2Hex: toHex(salt2),
    k1Hex: toHex(k1),
    k2Hex: toHex(k2)
  });

  // scrypt throws cases
  vectors.scrypt.push(
    { throws: true, dkLen: 32, password: 'pin', saltHex: toHex(randomBytes(16)), ops: 4, mem: 33554432, reason: 'salt length 16' },
    { throws: true, dkLen: 32, password: 'pin', saltHex: toHex(randomBytes(31)), ops: 4, mem: 33554432, reason: 'salt length 31' },
    { throws: true, dkLen: 32, password: 'pin', saltHex: toHex(randomBytes(33)), ops: 4, mem: 33554432, reason: 'salt length 33' },
    { throws: true, dkLen: 15, password: 'pin', saltHex: toHex(randomBytes(32)), ops: 4, mem: 33554432, reason: 'dkLen < 16' },
    { throws: true, dkLen: 32, password: 'pin', saltHex: toHex(randomBytes(32)), ops: 4, mem: 33554432, fmt: 'invalid_fmt', reason: 'bad fmt' }
  );

  // 2. generichash vectors
  const hashLens = [1, 4, 16, 32, 64];
  const hashKeys = [
    { type: 'none', key: undefined },
    { type: 'null', key: null },
    { type: 'string', key: '' },
    { type: 'string', key: '0' },
    { type: 'string', key: '4294967295' },
    { type: 'string', key: 'offlinecode' },
    { type: 'bytes', key: toHex(randomBytes(16)) },
    { type: 'bytes', key: toHex(randomBytes(64)) }
  ];
  const hashMsgs = [
    { type: 'string', value: '' },
    { type: 'string', value: 'hello world' },
    { type: 'string', value: JSON.stringify({ account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe', amount: '100.5', nonce: 123456789 }) },
    { type: 'bytes', value: toHex(randomBytes(37)) }
  ];

  for (const len of hashLens) {
    for (const k of hashKeys) {
      for (const m of hashMsgs) {
        const msg = m.type === 'bytes' ? fromHex(m.value) : m.value;
        const key = k.type === 'bytes' ? fromHex(k.key) : k.key;
        const out = sodium.crypto_generichash(len, msg, key, 'hex');
        vectors.generichash.push({
          len,
          key: k.key,
          keyType: k.type,
          msg: m.value,
          msgType: m.type,
          fmt: 'hex',
          outHex: out
        });
      }
    }
  }

  // generichash throws cases
  vectors.generichash.push(
    { throws: true, len: 0, msg: 'a', key: '', reason: 'len = 0' },
    { throws: true, len: 65, msg: 'a', key: '', reason: 'len = 65' },
    { throws: true, len: 16, msg: 'a', keyHex: toHex(randomBytes(65)), keyType: 'bytes', reason: 'key = 65 B' },
    { throws: true, len: 16, msg: 'a', key: '', fmt: 'bogus', reason: 'bad fmt' }
  );

  // 3. secretbox vectors
  const boxMsgs = [
    { type: 'string', value: '' },
    { type: 'string', value: 'x' },
    { type: 'string', value: 'sp5fV4UGhZhfCvcDRuY3dyyh5PjHf' }, // secp256k1 seed
    { type: 'string', value: 'sEdSKuYwxeL4JM1LBJcGmpLw9fbF8JN' }, // ed25519 seed
    { type: 'bytes', value: toHex(randomBytes(16)) },              // recovery key
    { type: 'string', value: 'Z'.repeat(1024) }                    // 1 KB string
  ];

  for (const m of boxMsgs) {
    for (const fmt of [undefined, 'hex']) {
      const msg = m.type === 'bytes' ? fromHex(m.value) : m.value;
      const nonce = randomBytes(24);
      const key = randomBytes(32);
      const ct = sodium.crypto_secretbox_easy(msg, nonce, key, fmt);
      const ctBytes = fmt === 'hex' ? fromHex(ct) : ct;
      const opened = sodium.crypto_secretbox_open_easy(ctBytes, nonce, key, m.type === 'string' ? 'text' : undefined);
      vectors.secretbox.push({
        msg: m.value,
        msgType: m.type,
        nonceHex: toHex(nonce),
        keyHex: toHex(key),
        fmt,
        ctHex: toHex(ctBytes),
        openedHex: m.type === 'bytes' ? toHex(opened) : undefined,
        openedText: m.type === 'string' ? opened : undefined
      });
    }
  }

  // secretbox error cases
  const validNonce = randomBytes(24);
  const validKey = randomBytes(32);
  const validCt = sodium.crypto_secretbox_easy('secret payload', validNonce, validKey);
  const badTagCt = new Uint8Array(validCt); badTagCt[0] ^= 1;
  const badPayloadCt = new Uint8Array(validCt); badPayloadCt[validCt.length - 1] ^= 1;

  vectors.secretbox.push(
    { throws: true, ctHex: toHex(badTagCt), nonceHex: toHex(validNonce), keyHex: toHex(validKey), reason: 'flipped tag bit' },
    { throws: true, ctHex: toHex(badPayloadCt), nonceHex: toHex(validNonce), keyHex: toHex(validKey), reason: 'flipped ct bit' },
    { throws: true, ctHex: toHex(validCt), nonceHex: toHex(validNonce), keyHex: toHex(randomBytes(32)), reason: 'wrong key' },
    { throws: true, ctHex: toHex(validCt), nonceHex: toHex(randomBytes(24)), keyHex: toHex(validKey), reason: 'wrong nonce' },
    { throws: true, ctHex: '', nonceHex: toHex(validNonce), keyHex: toHex(validKey), reason: '0-byte ct' },
    { throws: true, ctHex: toHex(randomBytes(15)), nonceHex: toHex(validNonce), keyHex: toHex(validKey), reason: '15-byte ct' },
    { throws: true, ctHex: toHex(validCt), nonceHex: toHex(randomBytes(23)), keyHex: toHex(validKey), reason: '23-byte nonce' },
    { throws: true, ctHex: toHex(validCt), nonceHex: toHex(validNonce), keyHex: toHex(randomBytes(31)), reason: '31-byte key' }
  );

  // 4. shorthash (SipHash-2-4) vectors
  const shortMsgs = ['0000', '123456', '999999', '0123', 'correct horse battery', ''];
  for (const sm of shortMsgs) {
    const k = randomBytes(16);
    for (const fmt of [undefined, 'hex']) {
      const out = sodium.crypto_shorthash(sm, k, fmt);
      vectors.shorthash.push({
        msg: sm,
        keyHex: toHex(k),
        fmt,
        outHex: fmt === 'hex' ? out : toHex(out)
      });
    }
  }
  // shorthash throws
  vectors.shorthash.push(
    { throws: true, msg: '1234', keyHex: toHex(randomBytes(15)), reason: 'key length 15' },
    { throws: true, msg: '1234', keyHex: toHex(randomBytes(32)), reason: 'key length 32' },
    { throws: true, msg: '1234', keyHex: toHex(randomBytes(16)), fmt: 'unsupported', reason: 'bad fmt' }
  );

  // 5. Encoding
  const testHexes = ['00', 'deadbeef', '0123456789abcdef', ''];
  for (const h of testHexes) {
    if (h.length > 0) {
      const b = fromHex(h);
      vectors.encoding.to_hex.push({ inputHex: h, out: sodium.to_hex(b) });
      vectors.encoding.from_hex.push({ input: h, outHex: toHex(sodium.from_hex(h)) });
      vectors.encoding.from_hex.push({ input: h.toUpperCase(), outHex: toHex(sodium.from_hex(h.toUpperCase())) });
    }
  }
  vectors.encoding.to_hex.push({ inputHex: '', out: sodium.to_hex(new Uint8Array(0)) });
  vectors.encoding.from_hex.push(
    { throws: true, input: '', reason: 'empty string' },
    { throws: true, input: 'abc', reason: 'odd length' },
    { throws: true, input: 'aa bb', reason: 'whitespace' },
    { throws: true, input: 'zz', reason: 'non-hex' },
    { throws: true, input: 12345, reason: 'non-string' }
  );

  const utfStrings = ['Hello world!', 'パスワード🔑', 'éèçàñ', ''];
  for (const s of utfStrings) {
    const encoded = sodium.from_string(s);
    vectors.encoding.from_string.push({ input: s, outHex: toHex(encoded) });
    vectors.encoding.to_string.push({ inputHex: toHex(encoded), out: sodium.to_string(encoded) });
  }
  vectors.encoding.to_string.push(
    { throws: true, inputHex: 'ff', reason: 'invalid UTF-8 0xff' },
    { throws: true, inputHex: 'c328', reason: 'invalid UTF-8 sequence' }
  );

  // 6. App composites: tohex_chksum & fromhex_chksum
  const compositeInputs = ['test string', '123456', 'a', toHex(randomBytes(32))];
  for (const inp of compositeInputs) {
    const chk = tohexChksum(sodium, inp);
    const recovered = fromhexChksum(sodium, chk, 'string');
    vectors.app_composites.push({
      input: inp,
      chksumHex: chk,
      recoveredString: recovered
    });
    // Corrupt first byte
    const corruptedChk = (chk[0] === 'a' ? 'b' : 'a') + chk.slice(1);
    const corruptedPayload = chk.slice(0, 8) + (chk[8] === '0' ? '1' : '0') + chk.slice(9);
    vectors.app_composites.push({
      corrupted: true,
      chksumHex: corruptedChk,
      result: fromhexChksum(sodium, corruptedChk) === false
    });
    vectors.app_composites.push({
      corrupted: true,
      chksumHex: corruptedPayload,
      result: fromhexChksum(sodium, corruptedPayload) === false
    });
  }

  return vectors;
}

function generateWalletFixture(sodium) {
  const pin = '123456';
  const passphrase = 'correct horse battery';
  const recoveryphrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  // 1. pindata (scrypt 32-byte salt)
  const pinSalt32 = randomBytes(32);
  const pinHash32 = sodium.crypto_pwhash_scryptsalsa208sha256(32, pin, pinSalt32, 4, 33554432);
  const pindata = {
    salt: tohexChksum(sodium, pinSalt32),
    hash: tohexChksum(sodium, pinHash32)
  };

  // 2. pindata_legacy (SipHash 16-byte salt)
  const pinSalt16 = randomBytes(16);
  const pinHashLegacy = sodium.crypto_shorthash(pin, pinSalt16);
  const pindata_legacy = {
    salt: tohexChksum(sodium, pinSalt16),
    hash: tohexChksum(sodium, pinHashLegacy)
  };

  // 3. ppdata & rpdata
  const ppsalt1 = randomBytes(32);
  const ppsalt2 = randomBytes(32);
  const rpsalt1 = randomBytes(32);
  const rpsalt2 = randomBytes(32);

  const ppSecret16 = sodium.crypto_pwhash_scryptsalsa208sha256(16, passphrase, ppsalt1, 4, 33554432);
  const pphash = sodium.crypto_pwhash_scryptsalsa208sha256(16, ppSecret16, ppsalt2, 4, 33554432);
  const ppdata = {
    salt1: tohexChksum(sodium, ppsalt1),
    salt2: tohexChksum(sodium, ppsalt2),
    hash: tohexChksum(sodium, pphash)
  };

  const rpSecret16 = sodium.crypto_pwhash_scryptsalsa208sha256(16, recoveryphrase, rpsalt1, 4, 33554432);
  const rphash = sodium.crypto_pwhash_scryptsalsa208sha256(16, rpSecret16, rpsalt2, 4, 33554432);

  // erk: recovery key encrypted under secret32key (from passphrase)
  const secret32key = sodium.crypto_pwhash_scryptsalsa208sha256(32, passphrase, ppsalt1, 4, 33554432);
  const erkNonce = randomBytes(24);
  const erkCtHex = sodium.crypto_secretbox_easy(rpSecret16, erkNonce, secret32key, 'hex');
  const erkCombined = sodium.from_hex(sodium.to_hex(erkNonce) + erkCtHex);
  const erk = tohexChksum(sodium, erkCombined);

  const rpdata = {
    salt1: tohexChksum(sodium, rpsalt1),
    salt2: tohexChksum(sodium, rpsalt2),
    hash: tohexChksum(sodium, rphash),
    erk: erk
  };

  // 4. Accounts: 2 accounts (secp256k1 and ed25519)
  const testAccounts = [
    {
      address: 'rMPrYipfRHJryWfwYARAwhsVGvHwpUDjgA',
      type: 'secp256k1',
      seed: 'sp5fV4UGhZhfCvcDRuY3dyyh5PjHf',
      nickname: 'Test Secp256k1'
    },
    {
      address: 'rpjfAeE3DeeHPFnN2PgGFW5YxnZFAjrEyN',
      type: 'ed25519',
      seed: 'sEdSKuYwxeL4JM1LBJcGmpLw9fbF8JN',
      nickname: 'Test Ed25519'
    }
  ];

  const accountsDoc = {};
  for (const acc of testAccounts) {
    const accPpsalt = randomBytes(32);
    const accRpsalt = randomBytes(32);

    // passphrase encryption
    const accPpSecret32key = sodium.crypto_pwhash_scryptsalsa208sha256(32, ppSecret16, accPpsalt, 4, 33554432);
    const ppNonce = randomBytes(24);
    const ppCtHex = sodium.crypto_secretbox_easy(acc.seed, ppNonce, accPpSecret32key, 'hex');
    const ppCombined = sodium.from_hex(sodium.to_hex(ppNonce) + ppCtHex);
    const ppsecret = tohexChksum(sodium, ppCombined);

    // recoveryphrase encryption
    const accRpSecret32key = sodium.crypto_pwhash_scryptsalsa208sha256(32, rpSecret16, accRpsalt, 4, 33554432);
    const rpNonce = randomBytes(24);
    const rpCtHex = sodium.crypto_secretbox_easy(acc.seed, rpNonce, accRpSecret32key, 'hex');
    const rpCombined = sodium.from_hex(sodium.to_hex(rpNonce) + rpCtHex);
    const rpsecret = tohexChksum(sodium, rpCombined);

    accountsDoc[acc.address] = {
      ppsalt: tohexChksum(sodium, accPpsalt),
      ppsecret: ppsecret,
      rpsalt: tohexChksum(sodium, accRpsalt),
      rpsecret: rpsecret,
      nickname: acc.nickname
    };
  }

  // 5. Export backup code string
  const exp = {
    walletversion: '1.0',
    pindata: pindata,
    ppdata: ppdata,
    rpdata: rpdata,
    accounts: accountsDoc
  };
  const jsonStr = JSON.stringify(exp);
  const backupCode = sodium.crypto_generichash(4, jsonStr, '', 'hex') + jsonStr;

  return {
    credentials: {
      pin,
      passphrase,
      recoveryphrase,
      accounts: testAccounts
    },
    pouchdb: {
      pindata: { data: JSON.stringify(pindata) },
      pindata_legacy: { data: JSON.stringify(pindata_legacy) },
      ppdata: { data: JSON.stringify(ppdata) },
      rpdata: { data: JSON.stringify(rpdata) },
      accounts: { data: JSON.stringify(accountsDoc) }
    },
    backup_code: backupCode
  };
}

function main() {
  const sodium = loadLegacySodium();
  if (!sodium) {
    console.error('Could not load legacy libsodium 1.0.13');
    process.exit(1);
  }

  const fixturesDir = path.resolve(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const vectors = generateVectors(sodium);
  const vectorsPath = path.join(fixturesDir, 'sodium-vectors.json');
  fs.writeFileSync(vectorsPath, JSON.stringify(vectors, null, 2), 'utf8');
  console.log('Wrote', vectorsPath, `(${fs.statSync(vectorsPath).size} bytes)`);

  const wallet = generateWalletFixture(sodium);
  const walletPath = path.join(fixturesDir, 'wallet-v3.0.1.json');
  fs.writeFileSync(walletPath, JSON.stringify(wallet, null, 2), 'utf8');
  console.log('Wrote', walletPath, `(${fs.statSync(walletPath).size} bytes)`);
}

if (require.main === module) {
  main();
}

module.exports = { generateVectors, generateWalletFixture };
