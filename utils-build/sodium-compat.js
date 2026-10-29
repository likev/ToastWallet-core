'use strict';
/*
 * sodium-compat.js — libsodium.js 1.0.13-compatible subset, exposed permanently as window.sodium.
 * NOT libsodium. Backed by @noble/hashes, @noble/ciphers, siphash24, and WebCrypto CSPRNG.
 * Every symbol here must remain byte- and error-compatible with libsodium 1.0.13;
 * see utils-build/test/fixtures/sodium-vectors.json. Do not add symbols without vectors.
 */
const { blake2b }          = require('@noble/hashes/blake2b');
const { scrypt }           = require('@noble/hashes/scrypt');
const { xsalsa20poly1305 } = require('@noble/ciphers/salsa');
const { siphash24 }        = require('./siphash24.js');

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

function toBytes(x, name) {
  if (typeof x === 'string') return enc.encode(x);
  if (x instanceof Uint8Array) return x;
  // Normalize cross-realm Uint8Array / Buffer (e.g. Node vm test contexts) for @noble instanceof checks
  if (ArrayBuffer.isView(x) && x.constructor &&
      (x.constructor.name === 'Uint8Array' || x.constructor.name === 'Buffer')) {
    return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  }
  throw new TypeError((name || 'input') + ' must be a Uint8Array or string');
}

function checkFormat(fmt) {
  if (fmt !== undefined && fmt !== 'uint8array' && fmt !== 'hex' && fmt !== 'text') {
    throw new Error(fmt + ' output format is not available');
  }
}

function format(bytes, fmt) {
  checkFormat(fmt);
  if (fmt === undefined || fmt === 'uint8array') return bytes;
  if (fmt === 'hex') return to_hex(bytes);
  return to_string(bytes);
}

// --- encoding (matches sodium.js:220-245) ---
function to_hex(bytes) {
  const b = toBytes(bytes, 'bytes');
  let out = '';
  for (let i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, '0'); // lowercase!
  return out;
}

function from_hex(str) {
  // Note '+' (not '*'): sodium.from_hex('') throws TypeError in libsodium.js 1.0.13
  if (typeof str !== 'string' || str.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(str)) {
    throw new TypeError("The provided string doesn't look like hex data");
  }
  const out = new Uint8Array(str.length / 2);
  for (let i = 0; i < str.length; i += 2) out[i >>> 1] = parseInt(str.slice(i, i + 2), 16);
  return out;
}

function from_string(str) {
  if (typeof str !== 'string') throw new TypeError('str must be a string');
  return enc.encode(str);
}

function to_string(bytes) {
  return dec.decode(toBytes(bytes, 'bytes')); // fatal: true throws TypeError on invalid UTF-8
}

// --- randomness ---
function randombytes_buf(length, fmt) {
  checkFormat(fmt);
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) {
    throw new TypeError('length must be a non-negative integer');
  }
  const out = new Uint8Array(length);
  for (let off = 0; off < length; off += 65536) {
    crypto.getRandomValues(out.subarray(off, Math.min(off + 65536, length)));
  }
  return format(out, fmt);
}

function randombytes_random() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

// --- BLAKE2b (crypto_generichash) ---
function crypto_generichash(hashLength, message, key, fmt) {
  checkFormat(fmt);
  if (typeof hashLength !== 'number' || !Number.isInteger(hashLength) || hashLength < 1 || hashLength > 64) {
    throw new Error('invalid hash_length');
  }
  const msgBytes = toBytes(message, 'message');
  const opts = { dkLen: hashLength };
  if (key !== undefined && key !== null) {
    const keyBytes = toBytes(key, 'key');
    if (keyBytes.length > 64) throw new Error('invalid key length');
    if (keyBytes.length > 0) opts.key = keyBytes; // '' / 0-byte key => unkeyed BLAKE2b
  }
  return format(blake2b(msgBytes, opts), fmt);
}

// --- scrypt (full port of libsodium escrypt pickparams) ---
function pickScryptParams(opslimit, memlimit) {
  if (typeof opslimit !== 'number' || typeof memlimit !== 'number' || opslimit < 0 || memlimit < 0) {
    throw new TypeError('invalid opslimit or memlimit');
  }
  const ops = opslimit < 32768 ? 32768 : opslimit;
  const r = 8;
  let N_log2 = 1;
  let p;
  if (ops < memlimit / 32) {
    p = 1;
    const maxN = ops / (r * 4);
    while (N_log2 < 63 && Math.pow(2, N_log2) <= maxN / 2) N_log2++;
  } else {
    const maxN = memlimit / (r * 128);
    while (N_log2 < 63 && Math.pow(2, N_log2) <= maxN / 2) N_log2++;
    let maxrp = (ops / 4) / Math.pow(2, N_log2);
    if (maxrp > 0x3fffffff) maxrp = 0x3fffffff;
    p = Math.floor(maxrp / r);
  }
  return { N: Math.pow(2, N_log2), r, p };
}

function crypto_pwhash_scryptsalsa208sha256(keyLength, password, salt, opsLimit, memLimit, fmt) {
  checkFormat(fmt);
  if (typeof keyLength !== 'number' || !Number.isInteger(keyLength) || keyLength < 16) {
    throw new Error('invalid keyLength');
  }
  const pwBytes = toBytes(password, 'password');
  const saltBytes = toBytes(salt, 'salt');
  if (saltBytes.length !== 32) throw new TypeError('invalid salt length');
  const { N, r, p } = pickScryptParams(opsLimit, memLimit);
  return format(scrypt(pwBytes, saltBytes, { N, r, p, dkLen: keyLength }), fmt);
}

// --- XSalsa20-Poly1305 secretbox ---
function crypto_secretbox_easy(message, nonce, key, fmt) {
  checkFormat(fmt);
  const m = toBytes(message, 'message');
  const n = toBytes(nonce, 'nonce');
  const k = toBytes(key, 'key');
  if (n.length !== 24) throw new TypeError('invalid nonce length');
  if (k.length !== 32) throw new TypeError('invalid key length');
  return format(xsalsa20poly1305(k, n).encrypt(m), fmt);
}

function crypto_secretbox_open_easy(ciphertext, nonce, key, fmt) {
  checkFormat(fmt);
  const c = toBytes(ciphertext, 'ciphertext');
  const n = toBytes(nonce, 'nonce');
  const k = toBytes(key, 'key');
  if (n.length !== 24) throw new TypeError('invalid nonce length');
  if (k.length !== 32) throw new TypeError('invalid key length');
  if (c.length < 16) throw new Error('ciphertext too short');
  return format(xsalsa20poly1305(k, n).decrypt(c), fmt); // throws Error('invalid tag') on bad MAC
}

// --- SipHash-2-4 (legacy PIN verification + session passphrase cache) ---
function crypto_shorthash(message, key, fmt) {
  checkFormat(fmt);
  const m = toBytes(message, 'message');
  const k = toBytes(key, 'key');
  if (k.length !== 16) throw new TypeError('invalid key length');
  return format(siphash24(m, k), fmt);
}

module.exports = {
  to_hex,
  from_hex,
  to_string,
  from_string,
  randombytes_buf,
  randombytes_random,
  crypto_generichash,
  crypto_pwhash_scryptsalsa208sha256,
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  crypto_shorthash,
  crypto_box_NONCEBYTES: 24,
  crypto_secretbox_NONCEBYTES: 24,
  crypto_secretbox_KEYBYTES: 32,
  crypto_secretbox_MACBYTES: 16,
  crypto_box_SECRETKEYBYTES: 32,
  crypto_pwhash_scryptsalsa208sha256_SALTBYTES: 32,
  crypto_shorthash_KEYBYTES: 16,
  crypto_shorthash_BYTES: 8,
  crypto_pwhash_OPSLIMIT_INTERACTIVE: 4,
  crypto_pwhash_MEMLIMIT_INTERACTIVE: 33554432,
};
