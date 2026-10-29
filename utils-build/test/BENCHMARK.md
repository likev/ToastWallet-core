# Benchmark Results

**Host:** Linux, Node v24.13.1 (x64)
**Date:** 2026-10-29T14:26:49.616Z

| Operation | Legacy Baseline | Measured Legacy | sodium-compat | Acceptance Target | Status |
|---|---:|---:|---:|---:|:---:|
| scrypt (1 call, 32 B) | 12.100 ms | 10.063 ms | 10.518 ms | ≤ 25.00 ms | ✅ PASS |
| BLAKE2b-16 keyed | 0.077 ms | 0.072 ms | 0.062 ms | ≤ 0.20 ms | ✅ PASS |
| secretbox easy + open | 0.043 ms | 0.026 ms | 0.072 ms | ≤ 0.15 ms | ✅ PASS |
| SipHash-2-4 (6-char PIN) | 0.007 ms | 0.008 ms | 0.018 ms | ≤ 0.05 ms | ✅ PASS |
| Unlock (1 scrypt) | 12.100 ms | 11.765 ms | 9.196 ms | ≤ 25.00 ms | ✅ PASS |
| Reveal secret (2 scrypt + open) | 21.700 ms | 20.432 ms | 21.130 ms | ≤ 45.00 ms | ✅ PASS |
| Change passphrase (1 account) | 94.400 ms | 95.239 ms | 80.260 ms | ≤ 200.00 ms | ✅ PASS |
| Change passphrase (10 accounts) | 573.500 ms | 477.433 ms | 394.826 ms | ≤ 1200.00 ms | ✅ PASS |
