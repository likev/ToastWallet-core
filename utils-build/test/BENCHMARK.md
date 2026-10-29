# Benchmark Results

**Host:** Linux, Node v24.13.1 (x64)
**Date:** 2026-10-29T14:47:54.038Z

| Operation | Legacy Baseline | Measured Legacy | sodium-compat | Acceptance Target | Status |
|---|---:|---:|---:|---:|:---:|
| scrypt (1 call, 32 B) | 12.100 ms | 11.500 ms | 9.575 ms | ≤ 25.00 ms | ✅ PASS |
| BLAKE2b-16 keyed | 0.077 ms | 0.067 ms | 0.069 ms | ≤ 0.20 ms | ✅ PASS |
| secretbox easy + open | 0.043 ms | 0.019 ms | 0.087 ms | ≤ 0.15 ms | ✅ PASS |
| SipHash-2-4 (6-char PIN) | 0.007 ms | 0.007 ms | 0.031 ms | ≤ 0.05 ms | ✅ PASS |
| Unlock (1 scrypt) | 12.100 ms | 10.743 ms | 8.226 ms | ≤ 25.00 ms | ✅ PASS |
| Reveal secret (2 scrypt + open) | 21.700 ms | 22.391 ms | 17.276 ms | ≤ 45.00 ms | ✅ PASS |
| Change passphrase (1 account) | 94.400 ms | 96.206 ms | 81.403 ms | ≤ 200.00 ms | ✅ PASS |
| Change passphrase (10 accounts) | 573.500 ms | 481.960 ms | 401.466 ms | ≤ 1200.00 ms | ✅ PASS |
