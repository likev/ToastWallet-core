# Cryptographic Test Suite & Verification

This directory contains test fixtures, golden vectors, differential tests, benchmarks, and shadow verification tooling for `sodium-compat.js`.

---

## 1. Running Tests

Run the full automated test suite using Node's built-in test runner:

```bash
cd utils-build
npm test
```

This runs:
- `test/siphash.test.js`: All 64 official SipHash-2-4 paper test vectors.
- `test/sodium-compat.test.js`: Comprehensive vector verification and input bounds/error checking against `fixtures/sodium-vectors.json`.
- `test/wallet-fixture.test.js`: Real-wallet fixture evaluation (`wallet-v3.0.1.json`), including `crypto.js` in a `vm` context, PIN validation, automatic legacy PIN upgrade to scrypt, and secret reveal across passphrase and recovery phrase paths.
- `test/differential.test.js`: 1,000 randomized iterations per primitive comparing legacy libsodium 1.0.13 with `sodium-compat.js`.
- `test/shadow.test.js`: Verification of the QA shadow proxy, mismatch reporting, throw/return detection, and strict zero secret leakage.
- `test/qa-shadow-matrix.test.js`: Automated execution of the 13-scenario QA matrix under shadow mode with legacy comparison.
- `test/downgrade.test.js`: Bidirectional compatibility test proving wallets created under `sodium-compat.js` open and operate under legacy `sodium.js`.

---

## 2. Running Benchmarks

Measure performance of `sodium-compat.js` against measured host baselines:

```bash
cd utils-build
npm run bench
```

Results are recorded in [BENCHMARK.md](file:///root/downloads/core/utils-build/test/BENCHMARK.md).

---

## 3. Regenerating Test Vectors & Fixtures

The golden vectors in `fixtures/sodium-vectors.json` and the legacy wallet in `fixtures/wallet-v3.0.1.json` are frozen contracts. If you ever need to regenerate them:

```bash
cd utils-build
node test/gen-sodium-vectors.js
```

`load-legacy-sodium.js` automatically loads `www/js/sodium.js` if present on disk, or falls back to reading `git show xrpl.js-4.6.0:www/js/sodium.js`.

---

## 4. Re-enabling Shadow Mode for QA

Shadow mode (`test/sodium-shadow.js`) allows running legacy libsodium side by side with `sodium-compat.js` to log any functional mismatches without leaking secret material.

To re-enable shadow mode in a development build:
1. Re-add `<script src="js/sodium.js"></script>` before `rippleutils-build.js` in `www/index.template.html`.
2. In `utils-build/rippleutils.js`:
   ```javascript
   const compat = require('./sodium-compat.js');
   const legacy = window.sodium;
   if (legacy && typeof legacy.sodium_version_string === 'function') {
     window.sodium = require('./test/sodium-shadow.js')(legacy, compat);
   } else {
     window.sodium = compat;
   }
   ```
3. Rebuild with `cd utils-build && bash update`.
4. Inspect `window.__sodiumShadow.report()` in browser DevTools.
