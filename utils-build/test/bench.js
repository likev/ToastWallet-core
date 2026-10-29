'use strict';
const fs = require('fs');
const path = require('path');
const loadLegacySodium = require('./load-legacy-sodium.js');
const compat = require('../sodium-compat.js');

function medianMs(iters, fn) {
  fn(); // warmup
  const samples = [];
  for (let i = 0; i < iters; i++) {
    const t0 = process.hrtime.bigint();
    fn(i);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function runBenchmarks(s) {
  const salt1 = s.randombytes_buf(32);
  const salt2 = s.randombytes_buf(32);
  const key32 = s.randombytes_buf(32);
  const nonce24 = s.randombytes_buf(24);
  const key16 = s.randombytes_buf(16);
  const seed = 'sEd7rBGm5kxzauRTAV2hbsNz7N45X91';

  // Pre-generate ciphertexts with matching keys for reveal and change flows
  const k1_init = s.crypto_pwhash_scryptsalsa208sha256(16, 'correct horse battery', salt1, 4, 33554432);
  const k2_init = s.crypto_pwhash_scryptsalsa208sha256(32, k1_init, salt2, 4, 33554432);
  const ct_reveal = s.crypto_secretbox_easy(seed, nonce24, k2_init);

  const oldKey_init = s.crypto_pwhash_scryptsalsa208sha256(32, s.crypto_pwhash_scryptsalsa208sha256(16, 'old phrase', salt1, 4, 33554432), salt2, 4, 33554432);
  const ct_change = s.crypto_secretbox_easy(seed, nonce24, oldKey_init);

  const confirmJson = JSON.stringify({
    account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
    amount: '100.5',
    nonce: 123456789
  });

  const results = {};

  results.scrypt = medianMs(25, () =>
    s.crypto_pwhash_scryptsalsa208sha256(32, '123456', salt1, 4, 33554432)
  );

  results.blake2b16 = medianMs(201, () =>
    s.crypto_generichash(16, confirmJson, '123456789', 'hex')
  );

  results.secretbox = medianMs(201, () => {
    const c = s.crypto_secretbox_easy(seed, nonce24, key32);
    s.crypto_secretbox_open_easy(c, nonce24, key32);
  });

  results.siphash = medianMs(201, () =>
    s.crypto_shorthash('123456', key16, 'hex')
  );

  results.unlock = medianMs(25, () =>
    s.crypto_pwhash_scryptsalsa208sha256(32, '123456', salt1, 4, 33554432)
  );

  results.reveal = medianMs(21, () => {
    const k1 = s.crypto_pwhash_scryptsalsa208sha256(16, 'correct horse battery', salt1, 4, 33554432);
    const k2 = s.crypto_pwhash_scryptsalsa208sha256(32, k1, salt2, 4, 33554432);
    s.crypto_secretbox_open_easy(ct_reveal, nonce24, k2);
  });

  for (const nAcc of [1, 10]) {
    const key = `change_${nAcc}`;
    results[key] = medianMs(7, () => {
      for (let a = 0; a < nAcc; a++) {
        const ok = s.crypto_pwhash_scryptsalsa208sha256(32, s.crypto_pwhash_scryptsalsa208sha256(16, 'old phrase', salt1, 4, 33554432), salt2, 4, 33554432);
        const nk = s.crypto_pwhash_scryptsalsa208sha256(32, s.crypto_pwhash_scryptsalsa208sha256(16, 'new phrase', salt1, 4, 33554432), salt2, 4, 33554432);
        const pt = s.crypto_secretbox_open_easy(ct_change, nonce24, ok);
        s.crypto_secretbox_easy(pt, nonce24, nk);
      }
      s.crypto_pwhash_scryptsalsa208sha256(16, s.crypto_pwhash_scryptsalsa208sha256(16, 'new phrase', salt1, 4, 33554432), salt2, 4, 33554432);
      const rk = s.crypto_pwhash_scryptsalsa208sha256(16, 'old phrase', salt1, 4, 33554432);
      const ek = s.crypto_pwhash_scryptsalsa208sha256(32, 'new phrase', salt1, 4, 33554432);
      s.crypto_secretbox_easy(rk, nonce24, ek);
    });
  }

  return results;
}

function main() {
  console.log('Running sodium-compat benchmarks...');
  const compatRes = runBenchmarks(compat);

  let legacyRes = null;
  const legacy = loadLegacySodium();
  if (legacy) {
    console.log('Running legacy libsodium 1.0.13 benchmarks...');
    legacyRes = runBenchmarks(legacy);
  }

  const targets = {
    scrypt: { name: 'scrypt (1 call, 32 B)', baseline: 12.1, target: 25.0, unit: 'ms' },
    blake2b16: { name: 'BLAKE2b-16 keyed', baseline: 0.077, target: 0.20, unit: 'ms' },
    secretbox: { name: 'secretbox easy + open', baseline: 0.043, target: 0.15, unit: 'ms' },
    siphash: { name: 'SipHash-2-4 (6-char PIN)', baseline: 0.007, target: 0.05, unit: 'ms' },
    unlock: { name: 'Unlock (1 scrypt)', baseline: 12.1, target: 25.0, unit: 'ms' },
    reveal: { name: 'Reveal secret (2 scrypt + open)', baseline: 21.7, target: 45.0, unit: 'ms' },
    change_1: { name: 'Change passphrase (1 account)', baseline: 94.4, target: 200.0, unit: 'ms' },
    change_10: { name: 'Change passphrase (10 accounts)', baseline: 573.5, target: 1200.0, unit: 'ms' }
  };

  let md = '# Benchmark Results\n\n';
  md += `**Host:** Linux, Node ${process.version} (${process.arch})\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;
  md += '| Operation | Legacy Baseline | Measured Legacy | sodium-compat | Acceptance Target | Status |\n';
  md += '|---|---:|---:|---:|---:|:---:|\n';

  let allPassed = true;
  for (const [k, meta] of Object.entries(targets)) {
    const measuredCompat = compatRes[k];
    const measuredLegacy = legacyRes ? legacyRes[k] : null;
    const passed = measuredCompat <= meta.target;
    if (!passed) allPassed = false;

    const legacyStr = measuredLegacy !== null ? `${measuredLegacy.toFixed(3)} ms` : 'n/a';
    const compatStr = `${measuredCompat.toFixed(3)} ms`;
    const targetStr = `≤ ${meta.target.toFixed(2)} ms`;
    const statusStr = passed ? '✅ PASS' : '❌ FAIL';

    md += `| ${meta.name} | ${meta.baseline.toFixed(3)} ms | ${legacyStr} | ${compatStr} | ${targetStr} | ${statusStr} |\n`;
  }

  console.log('\n' + md);

  const outPath = path.resolve(__dirname, 'BENCHMARK.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`Saved benchmark report to ${outPath}`);

  if (!allPassed) {
    console.error('One or more benchmarks exceeded the acceptance target!');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runBenchmarks, medianMs };
