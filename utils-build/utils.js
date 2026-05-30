'use strict';
const { sha256 } = require('@noble/hashes/sha256');
const { ripemd160 } = require('@noble/hashes/ripemd160');
const { sha512 } = require('@noble/hashes/sha512');

function bytesToHex(a) {
  return Array.from(a).map(function(byteValue) {
    const hex = byteValue.toString(16).toUpperCase();
    return hex.length > 1 ? hex : '0' + hex;
  }).join('');
}

function hexToBytes(a) {
  if (a.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = [];
  for (let i = 0; i < a.length; i += 2) {
    bytes.push(parseInt(a.substr(i, 2), 16));
  }
  return bytes;
}

function computePublicKeyHash(publicKeyBytes) {
  const input = publicKeyBytes instanceof Uint8Array ? publicKeyBytes : new Uint8Array(publicKeyBytes);
  const hash256 = sha256(input);
  const hash160 = ripemd160(hash256);
  return Array.from(hash160);
}

function seedFromPhrase(phrase) {
  const input = typeof phrase === 'string' ? phrase : new Uint8Array(phrase);
  const hash512 = sha512(input);
  return Array.from(hash512.slice(0, 16));
}

module.exports = {
  bytesToHex,
  hexToBytes,
  computePublicKeyHash,
  seedFromPhrase
};
