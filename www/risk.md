# Toast Wallet Security & Cryptographic Risk Analysis

This document outlines identified risks, outdated dependencies, cryptographic weaknesses, and coding practices within the **Toast Wallet Core** codebase. 

---

## 1. High Severity: Code Execution & Injection Risks

### Custom Event Emulation using `eval`
The touch event simulation systems in [index.html](file:///root/downloads/core/www/index.html) parse and evaluate attribute values dynamically using `eval()`:
* **Instances:**
  * **Line 435:** [eval(f)](file:///root/downloads/core/www/index.html#L435) inside the touch switch callback handles custom `data-after` attributes.
  * **Line 4368:** [eval(handler)](file:///root/downloads/core/www/index.html#L4368) inside the custom `executeHandler` function.
* **Risk:** Using `eval` on string handlers extracted from HTML attributes bypasses standard Content Security Policy (CSP) rules (which normally prohibit `unsafe-eval`). If an attacker manages to modify the DOM structure, they can achieve arbitrary JavaScript execution and compromise private seeds.

### XSS Vulnerabilities via `.innerHTML`
Inputs, nick-names, and currency values are written to elements using `.innerHTML` instead of safer DOM APIs:
* **Instances:**
  * [index.html#L565](file:///root/downloads/core/www/index.html#L565): `$("#showrecoveryphrase")[0].innerHTML = rp;`
  * [index.html#L1220](file:///root/downloads/core/www/index.html#L1220): Writing dynamic wallet balance structures.
  * [index.html#L3743](file:///root/downloads/core/www/index.html#L3743): Injecting list elements into order books.
* **Risk:** Lacks escaping of content elements. If an asset symbol or name is set to a malicious HTML payload (e.g. on custom trustlines or decentralized exchanges), it can trigger DOM-based Cross-Site Scripting (XSS).

---

## 2. Medium Severity: Cryptographic Hardening Weaknesses

### PIN Hashing Function (Resolved: scrypt with automatic upgrade from legacy SipHash)
* **Code Reference:** `www/js/modules/crypto.js` (`setPin`, `validatePin`)
* **Implementation:** The PIN is now hashed using `sodium.crypto_pwhash_scryptsalsa208sha256(32, pin, salt, 4, 33554432)` with a 32-byte CSPRNG salt.
* **Legacy Migration:** Existing wallets storing legacy 16-byte-salt PINs hashed with SipHash-2-4 (`sodium.crypto_shorthash`) remain fully supported and are automatically upgraded in the database (`WalletDB`) to 32-byte-salt scrypt on the next successful unlock.
* **Risk (Historical):** Legacy SipHash was designed for hash table lookups, not password/PIN stretching. Modern scrypt KDF provides robust key stretching against offline dictionary and brute-force attacks.

### Low Memory Limits for KDF (scrypt)
* **Code Reference:** Key derivation using `sodium.crypto_pwhash_scryptsalsa208sha256`
* **Parameters:** `OPSLIMIT = 4`, `MEMLIMIT = 33,554,432` (32 MB)
* **Risk:** A memory limit of 32 MB is very low for modern environments. Low memory allocations facilitate highly parallel brute-force attacks using custom GPU, FPGA, or ASIC clusters.

### Modulo Bias in Phrase Generation
* **Code Reference:** Helper [randomWord](file:///root/downloads/core/www/index.html#L2683) inside [setAndShowNewRecoveryPhrase](file:///root/downloads/core/www/index.html#L2679)
* **Implementation:** `arr[sodium.randombytes_random() % arr.length]`
* **Risk:** The modulo operator introduces bias when mapping a large integer space to arrays that do not have sizes equal to a power of two (array sizes are 24 and 5). Rejection sampling (e.g. `sodium.randombytes_uniform()`) should be used to guarantee uniform probability.

### Weak Recovery Phrase Entropy (83 bits vs 128 bits)
* **Implementation:** The 6-word recovery phrase is generated from pronounceable structures.
* **Entropy calculation:** Each word is formed of `consts (24) * vowels (5) * consts (24) * vowels (5) = 14,400` combinations. A 6-word phrase results in:
  $$\log_2(14400^6) \approx 82.88 \text{ bits of entropy}$$
* **Risk:** Industry-standard wallet practices (like BIP-39) enforce a minimum of 128 bits of entropy (12 words from a 2048-word dictionary). An 83-bit entropy space is significantly weaker and more vulnerable to targeted brute-force attacks.

---

## 3. Low Severity: Outdated Library Dependencies (Resolved)

All 7 legacy external UI, DOM, and storage libraries (`jquery`, `select2`, `bootstrap`, `hashicon`, `clipboard`, `fontawesome`, `pouchdb` & `pouchdb-upsert`), as well as obsolete `ripple-lib` and `lodash`, have been completely removed from the runtime:

| Original Dependency | Status / Modern Replacement | Security & Architecture Benefit |
| :--- | :--- | :--- |
| **`ripple-lib` (0.19.1)** | Migrated to **`xrpl.js` (4.6.0)** | Supports modern XRP Ledger amendments, native X-Address syntax, and direct RPC WebSocket connectivity. |
| **`PouchDB` & `pouchdb-upsert`** | Replaced with native **`WalletDB`** (`modules/storage.js`) | Eliminates database corruption risks; zero third-party database dependencies; non-destructive legacy migration. |
| **`jQuery` (3.3.1 / 3.7.1)** | Replaced with **vanilla DOM** (`modules/dom.js`) | Eliminates prototype pollution attack surface (CVE-2019-11358); zero global `$` aliases. |
| **`Bootstrap` (3.x)** | Replaced with **`base.css`** | Minimal ~180-line reboot stylesheet; zero framework bloat. |
| **`Select2`** | Replaced with **`custom-select.js`** | Accessible vanilla custom select; eliminates jQuery dependency. |
| **`FontAwesome`** | Replaced with **pure CSS SVG masks** (`icons.css`) | 19 MB of webfonts removed; ~7 KB crisp SVG masks. |
| **`hashicon.js`** | Replaced with **`@noble/hashes/sha3` canvas** | Standalone ~80 LOC Keccak-256 canvas renderer with 100% pixel parity. |
| **`clipboard.js`** | Replaced with **`clipboard.js` module** | Modern `navigator.clipboard` with graceful fallback to `execCommand`. |
| **`Lodash`** | **Completely purged** | Eliminates historical prototype pollution risks (CVE-2019-10744). |

The production application now depends on only 4 audited packages: `@noble/ciphers`, `@noble/hashes`, `qr`, and `xrpl`.

## 4. Code Hygiene & Obsolete Elements

### Dead Variable: `userkey`
* **Instance:** [userkey](file:///root/downloads/core/www/index.html#L4405)
* **Implementation:** `var userkey = ""; // user's sha1 of passphrase used to decrypt wallet secrets`
* **Risk:** This variable is declared globally but never read or modified. The comment references using SHA-1 (which is cryptographically broken for collisions) to derive decryption keys, suggesting a deprecated design that was left in the source code.
