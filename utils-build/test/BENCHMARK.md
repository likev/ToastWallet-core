# Benchmark Results

**Host:** Linux, Node v24.13.1 (x64)
**Date:** 2026-10-29T14:50:39.585Z

| Operation | Legacy Baseline | Measured Legacy | sodium-compat | Acceptance Target | Status |
|---|---:|---:|---:|---:|:---:|
| scrypt (1 call, 32 B) | 12.100 ms | 9.878 ms | 11.404 ms | ≤ 25.00 ms | ✅ PASS |
| BLAKE2b-16 keyed | 0.077 ms | 0.061 ms | 0.070 ms | ≤ 0.20 ms | ✅ PASS |
| secretbox easy + open | 0.043 ms | 0.030 ms | 0.092 ms | ≤ 0.15 ms | ✅ PASS |
| SipHash-2-4 (6-char PIN) | 0.007 ms | 0.007 ms | 0.023 ms | ≤ 0.05 ms | ✅ PASS |
| Unlock (1 scrypt) | 12.100 ms | 11.738 ms | 10.842 ms | ≤ 25.00 ms | ✅ PASS |
| Reveal secret (2 scrypt + open) | 21.700 ms | 23.608 ms | 20.125 ms | ≤ 45.00 ms | ✅ PASS |
| Change passphrase (1 account) | 94.400 ms | 88.276 ms | 82.478 ms | ≤ 200.00 ms | ✅ PASS |
| Change passphrase (10 accounts) | 573.500 ms | 619.319 ms | 458.455 ms | ≤ 1200.00 ms | ✅ PASS |
