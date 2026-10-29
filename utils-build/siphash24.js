'use strict';
const MASK64 = 0xffffffffffffffffn;
const rotl = (x, b) => ((x << b) | (x >> (64n - b))) & MASK64;

function readU64LE(buf, off) {
  let v = 0n;
  for (let i = 0; i < 8; i++) v |= BigInt(buf[off + i]) << BigInt(i * 8);
  return v;
}

function siphash24(msg, key) {
  const isKeyU8 = key instanceof Uint8Array ||
    (ArrayBuffer.isView(key) && key.constructor &&
      (key.constructor.name === 'Uint8Array' || key.constructor.name === 'Buffer'));
  if (!isKeyU8 || key.length !== 16) throw new TypeError('invalid key length');
  const k0 = readU64LE(key, 0);
  const k1 = readU64LE(key, 8);
  let v0 = 0x736f6d6570736575n ^ k0;
  let v1 = 0x646f72616e646f6dn ^ k1;
  let v2 = 0x6c7967656e657261n ^ k0;
  let v3 = 0x7465646279746573n ^ k1;

  function sipRound() {
    v0 = (v0 + v1) & MASK64; v1 = rotl(v1, 13n) ^ v0; v0 = rotl(v0, 32n);
    v2 = (v2 + v3) & MASK64; v3 = rotl(v3, 16n) ^ v2;
    v0 = (v0 + v3) & MASK64; v3 = rotl(v3, 21n) ^ v0;
    v2 = (v2 + v1) & MASK64; v1 = rotl(v1, 17n) ^ v2; v2 = rotl(v2, 32n);
  }

  const len = msg.length;
  const end = len - (len % 8);
  for (let off = 0; off < end; off += 8) {
    const m = readU64LE(msg, off);
    v3 ^= m; sipRound(); sipRound(); v0 ^= m;
  }
  let b = BigInt(len & 0xff) << 56n;
  for (let i = 0; i < len % 8; i++) b |= BigInt(msg[end + i]) << BigInt(i * 8);
  v3 ^= b; sipRound(); sipRound(); v0 ^= b;
  v2 ^= 0xffn;
  sipRound(); sipRound(); sipRound(); sipRound();

  let res = v0 ^ v1 ^ v2 ^ v3;
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) { out[i] = Number(res & 0xffn); res >>= 8n; }
  return out;
}

module.exports = { siphash24 };
