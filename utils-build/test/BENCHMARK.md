# Benchmark Results

**Host:** Linux, Node v24.13.1 (x64)
**Date:** 2026-10-29T14:20:33.838Z

| Operation | Legacy Baseline | Measured Legacy | sodium-compat | Acceptance Target | Status |
|---|---:|---:|---:|---:|:---:|
| scrypt (1 call, 32 B) | 12.100 ms | 10.903 ms | 15.035 ms | ≤ 25.00 ms | ✅ PASS |
| BLAKE2b-16 keyed | 0.077 ms | 0.064 ms | 0.062 ms | ≤ 0.20 ms | ✅ PASS |
| secretbox easy + open | 0.043 ms | 0.030 ms | 0.105 ms | ≤ 0.15 ms | ✅ PASS |
| SipHash-2-4 (6-char PIN) | 0.007 ms | 0.006 ms | 0.025 ms | ≤ 0.05 ms | ✅ PASS |
| Unlock (1 scrypt) | 12.100 ms | 13.771 ms | 10.424 ms | ≤ 25.00 ms | ✅ PASS |
| Reveal secret (2 scrypt + open) | 21.700 ms | 22.976 ms | 21.216 ms | ≤ 45.00 ms | ✅ PASS |
| Change passphrase (1 account) | 94.400 ms | 86.043 ms | 83.520 ms | ≤ 200.00 ms | ✅ PASS |
| Change passphrase (10 accounts) | 573.500 ms | 506.571 ms | 458.033 ms | ≤ 1200.00 ms | ✅ PASS |
