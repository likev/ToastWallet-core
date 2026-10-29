# Benchmark Results

**Host:** Linux, Node v24.13.1 (x64)
**Date:** 2026-10-29T14:29:58.545Z

| Operation | Legacy Baseline | Measured Legacy | sodium-compat | Acceptance Target | Status |
|---|---:|---:|---:|---:|:---:|
| scrypt (1 call, 32 B) | 12.100 ms | 12.189 ms | 12.658 ms | ≤ 25.00 ms | ✅ PASS |
| BLAKE2b-16 keyed | 0.077 ms | 0.072 ms | 0.075 ms | ≤ 0.20 ms | ✅ PASS |
| secretbox easy + open | 0.043 ms | 0.017 ms | 0.112 ms | ≤ 0.15 ms | ✅ PASS |
| SipHash-2-4 (6-char PIN) | 0.007 ms | 0.004 ms | 0.034 ms | ≤ 0.05 ms | ✅ PASS |
| Unlock (1 scrypt) | 12.100 ms | 11.509 ms | 10.834 ms | ≤ 25.00 ms | ✅ PASS |
| Reveal secret (2 scrypt + open) | 21.700 ms | 21.923 ms | 21.547 ms | ≤ 45.00 ms | ✅ PASS |
| Change passphrase (1 account) | 94.400 ms | 88.425 ms | 88.746 ms | ≤ 200.00 ms | ✅ PASS |
| Change passphrase (10 accounts) | 573.500 ms | 511.336 ms | 442.421 ms | ≤ 1200.00 ms | ✅ PASS |
