'use strict';

function shapeOf(val) {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'string') return `string(${val.length})`;
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'boolean';
  if (val instanceof Uint8Array || (ArrayBuffer.isView(val) && val.BYTES_PER_ELEMENT === 1)) {
    return `Uint8Array(${val.byteLength})`;
  }
  if (Array.isArray(val)) return `Array(${val.length})`;
  return typeof val;
}

function isBytes(val) {
  return val instanceof Uint8Array ||
    (ArrayBuffer.isView(val) && val.constructor &&
      (val.constructor.name === 'Uint8Array' || val.constructor.name === 'Buffer'));
}

function outcomeOf(res) {
  if (res.threw) {
    const errName = res.error && res.error.constructor ? res.error.constructor.name : 'Error';
    return `throw:${errName}`;
  }
  if (isBytes(res.val)) return `return:Uint8Array(${res.val.byteLength})`;
  if (typeof res.val === 'string') return `return:string(${res.val.length})`;
  return `return:${typeof res.val}`;
}

function cloneArg(arg) {
  if (isBytes(arg)) {
    return new Uint8Array(arg.buffer, arg.byteOffset, arg.byteLength);
  }
  return arg;
}

function createShadow(legacy, compat) {
  const calls = {};
  const mismatches = [];
  const unshimmed = [];
  let callCounter = 0;

  const constants = [
    'crypto_box_NONCEBYTES',
    'crypto_secretbox_NONCEBYTES',
    'crypto_secretbox_KEYBYTES',
    'crypto_secretbox_MACBYTES',
    'crypto_box_SECRETKEYBYTES',
    'crypto_pwhash_scryptsalsa208sha256_SALTBYTES',
    'crypto_shorthash_KEYBYTES',
    'crypto_shorthash_BYTES',
    'crypto_pwhash_OPSLIMIT_INTERACTIVE',
    'crypto_pwhash_MEMLIMIT_INTERACTIVE'
  ];

  for (const c of constants) {
    if (c in legacy && c in compat) {
      if (legacy[c] !== compat[c]) {
        mismatches.push({
          fn: c,
          callIndex: 0,
          argShapes: [],
          legacyOutcome: `constant:${legacy[c]}`,
          compatOutcome: `constant:${compat[c]}`
        });
      }
    }
  }

  const deterministicFns = new Set([
    'crypto_generichash',
    'crypto_pwhash_scryptsalsa208sha256',
    'crypto_secretbox_easy',
    'crypto_secretbox_open_easy',
    'crypto_shorthash',
    'to_hex',
    'from_hex',
    'to_string',
    'from_string'
  ]);

  const randomFns = new Set([
    'randombytes_buf',
    'randombytes_random'
  ]);

  function report() {
    return {
      totalCalls: callCounter,
      calls,
      mismatchCount: mismatches.length,
      mismatches,
      unshimmedCount: unshimmed.length,
      unshimmed
    };
  }

  const shadowState = { calls, mismatches, unshimmed, report };
  if (typeof window !== 'undefined') {
    window.__sodiumShadow = shadowState;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.__sodiumShadow = shadowState;
  }

  const proxy = new Proxy(compat, {
    get(target, prop, receiver) {
      if (prop === '__shadowState') return shadowState;

      if (!(prop in target) && (prop in legacy)) {
        if (!unshimmed.includes(prop)) {
          unshimmed.push(prop);
          console.warn('[sodium-shadow] UNSHIMMED', prop);
        }
        const val = legacy[prop];
        return typeof val === 'function' ? val.bind(legacy) : val;
      }

      if (deterministicFns.has(prop)) {
        return function(...args) {
          const idx = ++callCounter;
          calls[prop] = (calls[prop] || 0) + 1;
          const argShapes = args.map(shapeOf);

          const legacyArgs = args.map(cloneArg);
          const compatArgs = args.map(cloneArg);

          let legacyRes = { threw: false, val: undefined };
          try {
            legacyRes.val = legacy[prop].apply(legacy, legacyArgs);
          } catch (e) {
            legacyRes = { threw: true, error: e };
          }

          let compatRes = { threw: false, val: undefined };
          try {
            compatRes.val = compat[prop].apply(compat, compatArgs);
          } catch (e) {
            compatRes = { threw: true, error: e };
          }

          let matches = false;
          if (legacyRes.threw && compatRes.threw) {
            matches = true;
          } else if (!legacyRes.threw && !compatRes.threw) {
            if (isBytes(legacyRes.val) && isBytes(compatRes.val)) {
              if (legacyRes.val.byteLength === compatRes.val.byteLength) {
                matches = true;
                for (let i = 0; i < legacyRes.val.byteLength; i++) {
                  if (legacyRes.val[i] !== compatRes.val[i]) {
                    matches = false;
                    break;
                  }
                }
              }
            } else {
              matches = Object.is(legacyRes.val, compatRes.val);
            }
          }

          if (!matches) {
            mismatches.push({
              fn: prop,
              callIndex: idx,
              argShapes,
              legacyOutcome: outcomeOf(legacyRes),
              compatOutcome: outcomeOf(compatRes)
            });
          }

          if (legacyRes.threw) throw legacyRes.error;
          return legacyRes.val;
        };
      }

      if (randomFns.has(prop)) {
        return function(...args) {
          const idx = ++callCounter;
          calls[prop] = (calls[prop] || 0) + 1;
          const res = compat[prop].apply(compat, args);
          // Validate output shape per §5.3
          let validShape = false;
          if (prop === 'randombytes_random') {
            validShape = typeof res === 'number' && Number.isInteger(res) && res >= 0 && res <= 0xffffffff;
          } else if (prop === 'randombytes_buf') {
            const len = args[0];
            const fmt = args[1];
            if (fmt === 'hex') {
              validShape = typeof res === 'string' && res.length === len * 2;
            } else if (fmt === 'text') {
              validShape = typeof res === 'string';
            } else {
              validShape = isBytes(res) && res.byteLength === len;
            }
          }
          if (!validShape) {
            mismatches.push({
              fn: prop,
              callIndex: idx,
              argShapes: args.map(shapeOf),
              legacyOutcome: 'expected:validShape',
              compatOutcome: outcomeOf({ threw: false, val: res })
            });
          }
          return res;
        };
      }

      if (prop in legacy) {
        return legacy[prop];
      }
      return target[prop];
    }
  });

  return proxy;
}

module.exports = createShadow;
