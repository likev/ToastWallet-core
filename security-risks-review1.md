# Toast Wallet Core — Security Risks Review (`security-risks-review1.md`)

**Scope:** First-party codebase audit of Toast Wallet Core (`www/`, `utils-build/`, `www/views/`)  
**Focus Areas:**
1. Private data / secret leak in **Cookies & Browser Persistent Storage**
2. Private data / secret leak in **Memory & DOM**
3. Private data / secret leak & manipulation in **Clipboard**
4. **Wrong Signature / Wrong Transaction** construction, verification, and display risks
5. **Cross-Cutting Critical Risks** (DOM XSS enabling private-key exfiltration, KDF parameter misconfiguration, and PIN/authentication flaws)

---

## Executive Summary

Toast Wallet Core was originally engineered as a hybrid Cordova / Electron application and subsequently migrated into a standalone client-side HTML5 browser wallet backed by `IndexedDB` (`www/js/modules/storage.js`), `xrpl.js` v4.6.0 (`www/js/modules/xrpl-client.js`), and `@noble` cryptographic primitives (`utils-build/sodium-compat.js`).

This audit identified **26 distinct security findings** (**6 Critical**, **15 High**, **5 Medium**):

- **Cookies & Browser Storage:** While first-party code does not directly read or write `document.cookie`, the application ships **without a Content-Security-Policy (CSP)**, silently falls back to synchronous origin-wide `localStorage` and an unwiped in-memory `Map` upon any `IndexedDB` error, **never deletes the legacy `_pouch_toastwallet` database** (even when the user executes a `DELETE` wallet wipe), leaks URLs/query strings (`?paylink=`) via `window.open(..., '_blank')` without `noopener,noreferrer`, and stores all account addresses and nicknames in cleartext.
- **Memory & DOM:** Plaintext XRPL seeds (`s...` / `sEd...`) are stored in the global `window.generatedAccount.secret` object and **persist indefinitely** whenever account creation or import is cancelled, locked, or encounters an error. Auto-lock relies exclusively on Cordova `pause`/`resume` events that **never fire in web browsers**, leaving revealed secrets (`#accsecret`), secret QR data URIs (`#accsecretqr`), recovery phrases (`#showrecoveryphrase`), and full wallet backups (`domData('#walletbackup', 'content')`) resident in the live DOM. `Uint8Array` buffers holding decrypted seeds and `scrypt`-derived keys are reassigned to `""` rather than zeroized (`.fill(0)`), implicit globals leak salts and encrypted recovery keys onto `window`, and `window.validatePassphraseCache` introduces both a fast SipHash-2-4 brute-force oracle and a UI-freezing cache-hit bug.
- **Clipboard:** Raw XRPL secrets and full wallet backups are copied to the OS clipboard with no expiration/auto-clear and no user warning. Worse, confirmation views feature "one-tap Paste & Execute" buttons on passphrase fields that encourage users to keep their master passphrase in the system clipboard and immediately execute sensitive actions upon paste without preview.
- **Wrong Signature / Wrong Transaction:**
  - **`DestinationTag: 0` (and `SourceTag: 0`) is silently stripped** from all online and offline payments (including XLS-5d `X`-addresses encoding tag `0`) due to JavaScript truthiness checks (`if (destTag)`), risking irreversible loss of funds sent to custodial exchanges.
  - **Transaction fees are never displayed on any confirmation screen**, and offline signing (`validateOfflineCode`) accepts any 32-bit unsigned drop value—allowing a manipulated offline code to burn up to **4,294.967295 XRP** in a single transaction fee. Online `autofill()` ignores `maxLedgerVersionOffset: 30` and trusts custom gateways up to 2 XRP per transaction.
  - **Offline IOU payments silently force `tfPartialPayment` (`0x00020000`)** without `SendMax` or `DeliverMin` and without user disclosure, while transaction history (`transactions.js`) is broken under `xrpl.js` v4.6.0 Rippled API v2 (`tx_json` / `DeliverMax`) and fails to check `validated === true`, `tesSUCCESS`, or `meta.delivered_amount` (exposing users to fake/partial-payment spoofing).
  - **Wrong signing algorithm (`secp256k1` instead of `ed25519`)** is selected for Ed25519 accounts derived from non-`sEd` seeds; DEX `getOrders()` checks the wrong ledger flag (`0x00010000` `lsfPassive` instead of `0x00020000` `lsfSell`), hiding 100% of open BUY orders and mislabeling SELL orders; `roundXRP(price * amount)` overcharges due to IEEE-754 float multiplication + `Math.ceil`; `trustlines.js` swaps `currency` and `issuer` arguments; and `flags.js` fails to look up existing flags when `X`-address display is enabled.
- **Cross-Cutting XSS & Cryptography:** Unescaped ledger/gateway strings (`currency`, `issuer`, `tx_hash`, `marker`) are concatenated directly into `.innerHTML` and inline event attributes, enabling DOM XSS that can steal encrypted secrets and hook passphrase entry. Furthermore, passing Argon2's `OPSLIMIT_INTERACTIVE = 4` into `scrypt` (`pickScryptParams(4, 33554432)`) degrades key derivation to **`N = 1024, r = 8, p = 1` (only 1 MB RAM instead of 32 MB)** across all PIN, passphrase, and secretbox keys.

---

## Risk Summary Matrix

| ID | Finding Title | Category | Severity | Primary Locations |
| :--- | :--- | :--- | :--- | :--- |
| **COOKIE-01** | Missing CSP & Origin Isolation Exposes Same-Origin Cookies, `IndexedDB`, and Outbound Network Exfiltration | Cookie / Web Storage | **High** | `www/index.template.html:1-16` |
| **COOKIE-02** | Silent Fallback of Sensitive Wallet Records to Synchronous `localStorage` and Unwiped In-Memory `Map` | Cookie / Web Storage | **High** | `www/js/modules/storage.js:28-39, 327-329, 397-399, 403-428` |
| **COOKIE-03** | Unpurged Legacy `_pouch_toastwallet` Database & Incomplete Wipe on `DELETE` / `__freshinstall()` | Cookie / Web Storage | **High** | `www/js/modules/storage.js:60-295`, `www/js/ui/backup.js:160-170`, `www/js/ui/login.js:162-172` |
| **COOKIE-04** | URL Query Parameter (`?paylink=`) History Persistence & `Referer` / `window.opener` Leakage | Cookie / Web Context | **Medium** | `www/js/app-init.js:138-144, 315-329`, `www/views/tabaccountdetails.html:22` |
| **COOKIE-05** | Cleartext Account Addresses, Nicknames, and Custom Gateways Stored at Rest and in Backups | Persistent Storage | **Medium** | `www/js/ui/accounts.js:506-511`, `www/js/ui/backup.js:210-216` |
| **MEM-01** | Plaintext XRPL Secret Retained Indefinitely in Global `window.generatedAccount.secret` | Memory Leak | **Critical** | `www/js/ui/accounts.js:325, 354, 390`, `www/js/state.js:33, 62-71` |
| **MEM-02** | Broken Browser Auto-Lock Leaves Revealed Secret, Secret QR PNG, Recovery Phrase, and Backup Live in DOM | Memory / DOM Leak | **High** | `www/js/app-init.js:218-251`, `www/js/ui/accounts.js:265-270`, `www/js/ui/settings.js:151`, `www/js/ui/backup.js:11-12` |
| **MEM-03** | Passphrases Retained in DOM on Back Navigation, Sticky `type="text"` Toggle, & Missing Autocomplete Guards | Memory / DOM Leak | **High** | `www/js/modules/navigation.js:69-82`, `www/js/app-logic.js:46-61`, `www/views/*.html` |
| **MEM-04** | Non-Zeroization of `Uint8Array` Decrypted Secrets, Derived Keys, and Passphrase Buffers in Heap | Memory Leak | **High** | `www/js/ui/accounts.js:447-498, 607-629`, `www/js/ui/settings.js:395-593`, `utils-build/sodium-compat.js:141-168` |
| **MEM-05** | Implicit Global Variable Leaks of Cryptographic Salts, Encrypted Recovery Key (`olderk`), and Backup State | Memory Leak | **High** | `www/js/ui/settings.js:327-328, 370, 377-380, 503, 549`, `www/js/ui/payments.js:105, 892-897` |
| **MEM-06** | Session Passphrase Cache (`validatePassphraseCache`) Fast SipHash Oracle, Missing Invalidation, & UI Freeze Bug | Memory / Auth | **High** | `www/js/ui/settings.js:320, 336-339, 350-353`, `www/js/state.js:57` |
| **MEM-07** | Production `debug: true`, Global `window.dbgdumpdata()`, and Verbose Error Reporting | Memory / Console Leak | **Medium** | `www/js/state.js:2`, `www/js/app-logic.js:312-320`, `www/js/head-shim.js:36-47` |
| **CLIP-01** | Copying Raw XRPL Secrets and Wallet Backups to System Clipboard Without Auto-Clear or User Warning | Clipboard Leak | **High** | `www/views/tabaccountsecret.html:30`, `www/views/tabbackup2.html:6`, `www/js/modules/clipboard.js:32-45` |
| **CLIP-02** | Ubiquitous "One-Tap Paste Passphrase & Execute" Pattern Encourages Keeping Passphrase in System Clipboard | Clipboard Leak / UX | **High** | `www/views/tabpaymentconfirm.html:33`, `www/views/tabaccountsecret.html:16`, `www/js/modules/clipboard.js:47-55` |
| **CLIP-03** | `fallbackCopyText()` Appends Plaintext Secret `<textarea>` to `document.body` Without Zeroing Value | Clipboard / DOM Leak | **Medium** | `www/js/modules/clipboard.js:1-30` |
| **CLIP-04** | Missing `event.preventDefault()` on `#toaddress` Native `onpaste` Corrupts Destination Address and Tag | Clipboard / Tx Integrity | **Medium** | `www/views/tabpayments.html:22`, `www/js/ui/payments.js:45-62, 503-549` |
| **TX-01** | Silent Stripping of `DestinationTag: 0` (and `SourceTag: 0`) Across Classic & X-Addresses (Online & Offline) | Wrong Transaction | **Critical** | `www/js/modules/xrpl-tx.js:26-31, 100-101`, `www/js/modules/xrpl-client.js:360-365`, `www/js/ui/payments.js:221-226` |
| **TX-02** | Unchecked Transaction `Fee` (Up to 4,294.96 XRP Offline / 2 XRP Online), Hidden Fee UI, & Ignored `maxLedgerVersionOffset` | Wrong Transaction | **Critical** | `www/js/ui/payments.js:635, 873-921`, `www/js/modules/xrpl-client.js:372-386`, `www/js/modules/xrpl-tx.js:9, 79` |
| **TX-03** | Forced `tfPartialPayment` on Offline IOU Payments + Rippled API v2 Breakage & Fake/Partial-Payment Spoofing in History | Wrong Transaction | **Critical** | `www/js/modules/xrpl-tx.js:106`, `www/js/modules/xrpl-client.js:369-371`, `www/js/ui/transactions.js:8-48, 69-106` |
| **TX-04** | Wrong Signing Algorithm (`secp256k1`) Selected for Non-`sEd` Ed25519 Seeds & Missing RegularKey Error Branch | Wrong Signature | **High** | `www/js/modules/xrpl-client.js:547-555`, `www/js/ui/accounts.js:555, 565-572, 590` |
| **TX-05** | DEX `getOrders()` Checks `lsfPassive` (`0x00010000`) Instead of `lsfSell` (`0x00020000`), Hiding BUY Orders & Mislabeling SELL Orders | Wrong Transaction | **High** | `www/js/modules/xrpl-client.js:213-227`, `www/js/ui/trustlines.js:46-56`, `www/js/ui/orders.js:94-141` |
| **TX-06** | Floating-Point Amount Corruption, `roundXRP()` Overcharging, Greedy `doPay()` Query Regex, & Missing `return` on Invalid Address | Wrong Transaction | **High** | `www/js/ui/payments.js:45-62, 149-159, 190, 292, 301`, `www/js/modules/xrpl-tx.js:287, 348`, `www/js/app-logic.js:579-581` |
| **TX-07** | Swapped `currency`/`issuer` Arguments in `doConfirmTrustline()`, Runtime ReferenceErrors, & X-Address Account-Flags Desync | Wrong Transaction | **High** | `www/js/ui/trustlines.js:97, 120, 129, 191, 314`, `www/js/modules/xrpl-tx.js:156, 205`, `www/js/ui/flags.js:67, 91` |
| **TX-08** | Blind Broadcast of Scanned/Pasted Offline Signed Transaction Blobs Without Decoding or User Verification | Wrong Transaction | **High** | `www/js/ui/payments.js:720-756` |
| **APP-01** | Ledger- and Gateway-Triggered DOM XSS via Unescaped `.innerHTML` / Inline Event Handlers Enables Key Theft | XSS -> Secret Leak | **Critical** | `www/js/ui/accounts.js:64-80`, `www/js/ui/trustlines.js:20, 56`, `www/js/ui/orders.js:19, 75`, `www/js/ui/transactions.js:97-113` |
| **APP-02** | Severe `scrypt` Misconfiguration (`OPSLIMIT=4` -> `N=1024`, 1 MB RAM), 83-Bit Modulo-Biased Recovery Phrase, & Unkeyed Checksums | Cryptography / Auth | **Critical** | `utils-build/sodium-compat.js:115-147, 200`, `www/js/ui/settings.js:131-150`, `www/js/modules/crypto.js:3, 64-87`, `www/js/ui/login.js:82-86` |

---

## 1. Private Leak in Cookies & Persistent Browser Storage

### [COOKIE-01] Missing Content-Security-Policy (CSP) & Origin Isolation Exposes Same-Origin Cookies, `IndexedDB`, and Outbound Network Exfiltration
- **Severity:** High
- **Locations:** `www/index.template.html:1-16`, `manifest.webapp:1-31`
- **Mechanics / Root Cause:**
  First-party JavaScript does not directly read or write `document.cookie`. However, after removing Electron and Cordova sandboxes, Toast Wallet runs as an ordinary web page in a browser origin with **no `<meta http-equiv="Content-Security-Policy">` tag** in `www/index.template.html:1-16`:
  ```html
  <head>
      <title>Toast Wallet</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="css/font-awesome.min.css">
      ...
  </head>
  ```
- **Security Impact:**
  1. If the wallet is hosted on a shared domain or subdomain where analytics, session, or authentication cookies exist (without `HttpOnly`), any script execution inside the wallet page (such as **APP-01**) can read `document.cookie` and associate user identity/session cookies with the user's cleartext XRPL addresses (**COOKIE-05**).
  2. Any script running on the same web origin (scheme + host + port) has unrestricted read/write access to `IndexedDB` (`toastwallet_kv`, `_pouch_toastwallet`) and `localStorage`.
  3. Without `connect-src`, `img-src`, or `form-action` directives, injected script can silently exfiltrate cookies, encrypted wallet databases, and live passphrases/secrets to arbitrary external servers.
- **Recommended Remediation:**
  - Deploy the wallet exclusively on a dedicated, isolated origin with no ambient cookies, and serve strict HTTP response headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`).
  - Refactor inline `onclick`/`ontouchend` handlers into `addEventListener` bindings so `script-src 'self'` (without `'unsafe-inline'`) can be enforced, and restrict `connect-src` to explicitly configured `wss://` XRPL endpoints.

---

### [COOKIE-02] Silent Fallback of Sensitive Wallet Records to Synchronous `localStorage` and Unwiped In-Memory `Map`
- **Severity:** High
- **Locations:** `www/js/modules/storage.js:23, 28-39, 327-329, 379-381, 397-399, 403-428`
- **Mechanics / Root Cause:**
  `WalletDB` (`storage.js`) implements a silent fallback whenever `indexedDB` fails during `_init()` or throws a synchronous exception during `get()` or `_doUpsert()` (e.g., browser privacy mode restrictions, transient `InvalidStateError` on closed connections, or storage quota errors):
  ```javascript
  // www/js/modules/storage.js:397-399
  } catch (e) {
      this._setFallback(docId, toSave).then(resolve, reject);
  }

  // www/js/modules/storage.js:419-428
  _setFallback(docId, toSave) {
      if (typeof localStorage !== 'undefined') {
          try {
              const key = 'toastwallet_kv:' + this.name + ':' + docId;
              localStorage.setItem(key, JSON.stringify(toSave));
          } catch (e) {}
      }
      this._fallbackMem.set(docId, { ...toSave });
      return Promise.resolve({ updated: true, id: docId });
  }
  ```
- **Security Impact:**
  - Wallet documents (`accounts`, `ppdata`, `rpdata`, `pindata`, `savedgateways`) are silently duplicated into synchronous `window.localStorage` under `toastwallet_kv:toastwallet:<docId>` and cached permanently in `window.db._fallbackMem` (`Map`).
  - If a transient `IndexedDB` error triggers `_setFallback` once and `IndexedDB` works again on subsequent boots, stale copies of `accounts` and `pindata` remain orphaned in `localStorage` indefinitely—and are **never cleared** by `DELETE` or `__freshinstall()` when `IndexedDB` is active!
- **Recommended Remediation:**
  - Do not silently downgrade secret material storage to `localStorage`. Fail closed with a clear user error if `IndexedDB` is unavailable, or ensure any wipe/delete routine explicitly purges matching `toastwallet_kv:*` keys from `localStorage` and clears `this._fallbackMem.clear()`.

---

### [COOKIE-03] Unpurged Legacy `_pouch_toastwallet` Database & Incomplete Wipe on `DELETE` / `__freshinstall()`
- **Severity:** High
- **Locations:** `www/js/modules/storage.js:60-295`, `www/js/ui/backup.js:160-170`, `www/js/ui/login.js:162-172`
- **Mechanics / Root Cause:**
  1. `_migrateFromLegacyPouch()` (`storage.js:60-295`) reads all winning documents from the legacy PouchDB `IndexedDB` database `_pouch_toastwallet` and copies them into `toastwallet_kv`, writing `_meta:pouch_migrated`. However, it **never deletes `_pouch_toastwallet`**.
  2. When a user types `DELETE` on the Restore Wallet screen (`backup.js:160-170`) or triggers `__freshinstall()` (`login.js:162-172`), the app merely overwrites four keys in `toastwallet_kv` with `{ data: "" }`:
     ```javascript
     // www/js/ui/backup.js:163-166
     db.upsert("pindata", function(doc) { return { data: "" }; }).then( function() {
     db.upsert("ppdata", function(doc) { return { data: "" }; }).then( function() {
     db.upsert("rpdata", function(doc) { return { data: "" }; }).then( function() {
     db.upsert("accounts", function(doc) { return { data: "" }; }).then( function() {
     ```
- **Security Impact:**
  - `_pouch_toastwallet` remains untouched on disk even after the user believes they have wiped their wallet with `DELETE`, changed their passphrase, or deleted individual XRPL accounts.
  - Because PouchDB's `by-sequence` object store is append-only until compacted, `_pouch_toastwallet` retains **every historical revision** of `accounts` (encrypted under old, weaker, or compromised passphrases), previously deleted XRPL accounts, and legacy 16-byte SipHash PIN hashes (`pindata` prior to the `scrypt` upgrade in `login.js:235-256`).
  - Even within `toastwallet_kv`, `DELETE` leaves `savedgateways`, `interface_settings`, `termsaccepted`, `lastdonated`, and `lastbackupreminder` intact.
- **Recommended Remediation:**
  - After verifying successful atomic commit to `toastwallet_kv` in `_migrateFromLegacyPouch()`, delete the legacy database via `indexedDB.deleteDatabase(this.legacyName)`.
  - Implement a dedicated `db.destroy()` method for `DELETE` / `__freshinstall()` that closes `this._db`, calls `indexedDB.deleteDatabase('toastwallet_kv')` and `indexedDB.deleteDatabase('_pouch_toastwallet')`, clears `this._fallbackMem`, and removes all `toastwallet_kv:*` keys from `localStorage`.

---

### [COOKIE-04] URL Query Parameter (`?paylink=`) History Persistence & `Referer` / `window.opener` Leakage
- **Severity:** Medium
- **Locations:** `www/js/app-init.js:138-144, 315-329`, `www/views/tabaccountdetails.html:22`, `www/views/tabsettings.html:5`
- **Mechanics / Root Cause:**
  On startup, `app-init.js:315-329` reads `?paylink=` directly from `document.location.search` without scrubbing the URL via `history.replaceState`:
  ```javascript
  // www/js/app-init.js:322-324
  var regex = /[?&]paylink=([^&#]*)/i;
  var match = regex.exec(document.location.search);
  if (match && match[1]) window.paylink = decodeURIComponent(match[1].replace(/\+/g, ' '));
  ```
  Meanwhile, `openExternalUrl(url)` (`app-init.js:138-144`) opens third-party/external links (including `https://buy.toastwallet.com/` + the user's XRPL address at `tabaccountdetails.html:22`) using `window.open(url, '_blank')` without `'noopener,noreferrer'`:
  ```javascript
  function openExternalUrl(url) {
      ...
      window.open(url, '_blank');
  }
  ```
- **Security Impact:**
  - Any URI passed in `?paylink=` (payment destinations, invoice IDs, amounts, or accidentally passed secret URIs) is persisted in browser history, server access logs, and sent in HTTP `Referer` headers when external links are clicked.
  - Omitting `noopener,noreferrer` grants external tabs a `window.opener` reference back to the running wallet window and leaks the wallet's full URL via `Referer`.
- **Recommended Remediation:**
  - Immediately strip query parameters after reading them using `window.history.replaceState(null, '', window.location.pathname)` (or accept deep links via URL fragment `#paylink=...` which is never sent to HTTP servers).
  - Pass `'noopener,noreferrer'` as the third argument to `window.open(url, '_blank', 'noopener,noreferrer')` and add `<meta name="referrer" content="no-referrer">` to `www/index.template.html`.

---

### [COOKIE-05] Cleartext Account Addresses, Nicknames, and Custom Gateways Stored at Rest and in Backups
- **Severity:** Medium
- **Locations:** `www/js/ui/accounts.js:506-511`, `www/js/ui/backup.js:210-216`, `www/js/modules/xrpl-client.js:53-56`
- **Mechanics / Root Cause:**
  In `accounts.js:506-511`, only each account's `ppsecret` and `rpsecret` seeds are encrypted; the outer `accounts` JSON map keys (every XRPL `r`-address owned by the user) and `nickname` labels are stored in cleartext inside `IndexedDB` and exported wallet backup strings (`backup.js:210-216`):
  ```javascript
  accounts[address] = {
      ppsalt: tohex_chksum(ppsalt), ppsecret: ppsecret,
      rpsalt: tohex_chksum(rpsalt), rpsecret: rpsecret,
      nickname: nickname
  };
  ```
- **Security Impact:**
  Anyone who obtains read access to browser profile files, disk backups, or an exported Toast backup string can immediately enumerate all XRPL addresses, human-readable account nicknames, on-ledger balances, and custom gateway servers belonging to the user without knowing the PIN or passphrase.
- **Recommended Remediation:**
  - Document clearly to users that PIN protection does not encrypt public addresses/nicknames at rest or in backups, or encrypt account metadata under a PIN-derived `crypto_secretbox` key on local storage while offering passphrase-encrypted full backups.

---

## 2. Private Leak in Memory & DOM

### [MEM-01] Plaintext XRPL Secret Retained Indefinitely in Global `window.generatedAccount.secret`
- **Severity:** Critical
- **Locations:** `www/js/ui/accounts.js:325, 351-361, 390`, `www/js/state.js:33, 62-71`
- **Mechanics / Root Cause:**
  Both `doShowAndGenerateAccount()` (`accounts.js:390`) and `doImportExistingAccount()` (`accounts.js:325`) store the **plaintext XRPL secret (`s...` / `sEd...`)** in the global `window.generatedAccount` (`window.AppState.generatedAccount`) object:
  ```javascript
  // www/js/ui/accounts.js:323-325
  function doImportExistingAccount(passphrase, nickname, secret, vanityaddr) {
      if (debug) console.log("doImportExistingAccount");
      generatedAccount.secret = secret;
  ...
  // www/js/ui/accounts.js:387-390
  function doShowAndGenerateAccount() {
      ...
      generatedAccount = generateAddress(); // { address: 'r...', secret: 's...' }
  ```
  `generatedAccount` is **only** cleared inside the `importAddress` **success** callback at `accounts.js:354`:
  ```javascript
  // www/js/ui/accounts.js:351-361
  importAddress(generatedAccount.secret, generatedAccount.address, nickname, passphrase, 
      function() {
          // success
          generatedAccount = {};
          showTab('#tabaccounts'); 
          unblockInput();
      },
      function() {
          // import failure will produce its own message 
          unblockInput(); // <-- generatedAccount.secret is NOT cleared!
      }
  );
  ```
- **Security Impact:**
  If the user:
  1. Taps **Generate New Address** (`#tabgenaccount`) and presses **Back** (`showTab(-1)`) without importing,
  2. Enters an invalid vanity/regular-key address (`accounts.js:327`),
  3. Enters an incorrect master passphrase (`accounts.js:364`),
  4. Triggers any `importAddress` failure branch (`accounts.js:525, 538, 570, 575`), or
  5. Locks the wallet (`doShowLogin()`),
  the **plaintext XRPL secret remains permanently on `window.generatedAccount.secret`** in JavaScript heap memory for the entire lifetime of the browser tab. Any subsequent console inspection, memory snapshot, browser extension, or XSS (**APP-01**) can read `window.generatedAccount.secret` directly without needing the user's passphrase.
- **Recommended Remediation:**
  - Eliminate the global `generatedAccount` state. Pass secrets strictly as local function parameters, or clear `generatedAccount = {}` unconditionally on every failure callback, Back navigation out of `#tabgenaccount` / `#tabaddexistingaccount`, and wallet lock (`doShowLogin()`).

---

### [MEM-02] Broken Browser Auto-Lock Leaves Revealed Secret (`#accsecret`), Secret QR PNG, Recovery Phrase (`#showrecoveryphrase`), and Backup (`domData`) Live in DOM
- **Severity:** High
- **Locations:** `www/js/app-init.js:218-251`, `www/js/ui/accounts.js:265-270`, `www/js/ui/settings.js:151`, `www/js/ui/backup.js:11-12`, `www/js/modules/navigation.js:65-91`, `utils-build/qr-compat.js:90-93`
- **Mechanics / Root Cause:**
  1. **No Browser Auto-Lock:** `initAppUI` (`app-init.js:218, 227`) registers listeners only for Cordova's custom `pause` and `resume` events on `document`. Standard web browsers **never dispatch `pause` or `resume`** (they fire `visibilitychange` / `pagehide`), and there is **no idle inactivity timeout** anywhere in the app. Consequently, the wallet **never auto-locks** in a browser.
  2. **Revealed Secret & Secret QR Persist in DOM:** `doRevealRippleSecret()` (`accounts.js:265-269`) writes the plaintext secret into three places simultaneously:
     ```javascript
     setVal("#accsecret", secret);
     domData("#accsecret", 'content', secret);
     ...
     appendNode("#accsecretqr", kjua({text: secret}));
     ```
     `kjua` (`utils-build/qr-compat.js:92`) renders the secret onto a `<canvas>` and converts it to a `<img src="data:image/png;base64,...">` node without clearing the temporary canvas, and `domData("#accsecret", 'content', ...)` stores the secret in `elementDataMap` (`www/js/modules/dom.js:3`), which `showTab()` **never clears**.
  3. **Recovery Phrase Never Cleared on Tab Change:** `setAndShowNewRecoveryPhrase()` (`settings.js:151`) writes the plaintext 6-word recovery phrase into `<div id="showrecoveryphrase">` via `setText`. Because `showTab()` (`navigation.js:78-82`) only clears `<input>` and `<textarea>` elements, `#showrecoveryphrase.textContent` remains populated in the DOM if navigation occurs via any path other than `doFinishSetup()`. Moreover, `#tabshowrecovery` is explicitly exempted from auto-lock even if `resume` were to fire (`app-init.js:239`).
  4. **Full Backup Cached Forever in `domData`:** `doGenerateBackup()` (`backup.js:11-12`) stores the exported wallet JSON in both `#walletbackup.value` and `domData('#walletbackup', 'content', backup)`. While `showTab()` clears `#walletbackup.value`, `domData('#walletbackup', 'content')` remains resident in `elementDataMap` for the entire session.
- **Security Impact:**
  Leaving a browser tab unattended or backgrounded leaves unlocked accounts, revealed secrets, base64-encoded secret QR images, recovery phrases, and `domData` entries exposed to physical shoulder-surfing/walk-up access and in-memory DOM inspection.
- **Recommended Remediation:**
  - Implement `document.addEventListener('visibilitychange', ...)` and a configurable user-inactivity timer (`pointerdown`/`keydown` reset, e.g., 2–5 minutes) that invokes a central `lockWallet()` routine.
  - Ensure `lockWallet()` and `showTab()` explicitly wipe `#accsecret.value`, `domData('#accsecret', 'content', '')`, `#accsecretqr` (`emptyEl('#accsecretqr')`), `#showrecoveryphrase` (`setText('#showrecoveryphrase', '')`), and `domData('#walletbackup', 'content', '')`.

---

### [MEM-03] Passphrases Retained in DOM Inputs on Back Navigation, Sticky `type="text"` Eye Toggle, & Missing Mobile Autocomplete Guards
- **Severity:** High
- **Locations:** `www/js/modules/navigation.js:69-82`, `www/js/app-logic.js:46-61`, `www/views/tabaddexistingaccount.html:21`, `www/views/tabaccountsecret.html:15, 29`, `www/views/tabpaymentconfirm.html:32` (and all passphrase/secret views)
- **Mechanics / Root Cause:**
  1. **Back Navigation Suppresses Input Clearing:** In `showTab()` (`navigation.js:69-77`), navigating backward (`tab == -1`) from `#tabpaymentconfirm`, `#taborderconfirm`, `#tabtrustlineconfirm`, `#tabneworder`, or `#tabqrscan` forces `dontClearText = true`:
     ```javascript
     if (currentTab == '#tabpaymentconfirm' || currentTab == '#taborderconfirm' || currentTab == '#tabtrustlineconfirm')
         dontClearText = true;
     ```
     Because `dontClearText` applies to the **departing** confirmation tab as well as the previous form tab, any passphrase already typed into `#confirmpaypassword`, `#confirmorderpassword`, or `#confirmtlpassword` remains sitting in the hidden DOM `<input>` indefinitely.
  2. **Sticky `type="text"` Password Toggle:** `toggleShowPassField()` (`app-logic.js:46-61`) mutates `<input type="password">` into `<input type="text">` when the eye icon is clicked, and `showTab()` never resets revealed password fields back to `type="password"`.
  3. **Missing Autocomplete / Spellcheck Attributes:** Sensitive inputs across `www/views/*.html`—including `#txtsecret` (`tabaddexistingaccount.html:21`, which is `<input type="text">`!), `#accsecret` (`tabaccountsecret.html:29`), and all passphrase inputs once toggled to `type="text"`—lack `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"`.
- **Security Impact:**
  - Typed passphrases persist inside hidden DOM nodes after pressing Back.
  - Mobile OS virtual keyboards (iOS/Android) and browser form-history engines cache `<input type="text">` values (such as imported XRPL secrets in `#txtsecret` and revealed passphrases) into persistent OS predictive-text/spellcheck dictionaries on disk.
- **Recommended Remediation:**
  - Always clear `<input type="password">` and passphrase-tagged inputs on the departing tab in `showTab()`, regardless of `dontClearText`, and reset all password inputs back to `type="password"`.
  - Change `#txtsecret` to `type="password"` (with a non-sticky reveal toggle) and add `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"` to every secret, passphrase, recovery phrase, and PIN input.

---

### [MEM-04] Non-Zeroization of `Uint8Array` Decrypted Secrets, Derived Keys, and Passphrase Buffers in Heap
- **Severity:** High
- **Locations:** `www/js/ui/accounts.js:447-498, 607-629`, `www/js/ui/settings.js:394-403, 459-520, 565-593`, `utils-build/sodium-compat.js:141-168`
- **Mechanics / Root Cause:**
  Throughout `accounts.js` and `settings.js`, cryptographic `Uint8Array` buffers (32-byte `scrypt` keys, 16-byte intermediate keys, decrypted recovery keys, and decrypted XRPL seed bytes) are "cleared" by reassigning the local variable reference to an empty string `""`—or not cleared at all:
  ```javascript
  // www/js/ui/accounts.js:628-629
  var secret = sodium.crypto_secretbox_open_easy(ppsecret, nonce, ppsecret32key);
  successfunc(sodium.to_string(secret));
  // Neither `secret` (Uint8Array) nor `ppsecret32key` (Uint8Array) is zeroized!
  ```
  ```javascript
  // www/js/ui/accounts.js:474, 481, 491, 497
  secretkey = "";     // Reassigns JS reference; underlying Uint8Array bytes remain intact in heap!
  recoverykey = "";   // Underlying Uint8Array bytes remain intact in heap!
  ppsecret32key = ""; // Underlying Uint8Array bytes remain intact in heap!
  rpsecret32key = ""; // Underlying Uint8Array bytes remain intact in heap!
  // And `secret32key` (line 447) is never even reassigned.
  ```
  Additionally, `sodium-compat.js:142` allocates `const pwBytes = toBytes(password, 'password');` (a fresh `Uint8Array` copy of the UTF-8 passphrase) and never `.fill(0)`s it after `scrypt()` returns, nor does `sodium-compat.js` implement `sodium.memzero()`.
- **Security Impact:**
  While JavaScript `String` primitives are immutable in V8/SpiderMonkey/JavaScriptCore, `Uint8Array` instances are mutable byte buffers that remain unzeroized in browser process heap pages (and OS swap/hibernation/crash dumps) long after key derivation or signing completes until garbage collection and memory reuse eventually overwrite them.
- **Recommended Remediation:**
  - Expose `memzero(buf)` in `utils-build/sodium-compat.js` (`if (buf instanceof Uint8Array) buf.fill(0);`) and zeroize `pwBytes` inside `crypto_pwhash_scryptsalsa208sha256` (when freshly allocated from a string) as well as every `Uint8Array` key (`secret32key`, `secretkey`, `recoverykey`, `ppsecret32key`, `rpsecret32key`, `old32secret`, `oldsecret32key`, `newsecret32key`, and decrypted `secret` byte arrays) inside `try ... finally` blocks immediately after use.

---

### [MEM-05] Implicit Global Variable Leaks of Cryptographic Salts, Encrypted Recovery Key (`olderk`), and Backup State
- **Severity:** High
- **Locations:** `www/js/ui/settings.js:327-328, 370, 377-380, 503, 549`, `www/js/ui/payments.js:105, 892-897`
- **Mechanics / Root Cause:**
  Unlike `flags.js` and `trustlines.js`, neither `www/js/ui/settings.js` nor `www/js/ui/payments.js` enables `'use strict'`. Undeclared variable assignments create **permanent properties on `window`**:
  - `settings.js:327-328`: `salt1 = ...; salt2 = ...;` -> leaks `window.salt1`, `window.salt2` (`Uint8Array`)
  - `settings.js:370, 549`: `backupdata = ...; backupaccounts = ...;` -> leaks `window.backupdata`, `window.backupaccounts`
  - `settings.js:377-380`: `newsalt1 = ...; newsalt2 = ...; oldsalt1 = ...;` -> leaks `window.newsalt1`, `window.newsalt2`, `window.oldsalt1`
  - `settings.js:503-505`: `olderk = fromhex_chksum(rpdata.erk); ...` -> leaks `window.olderk`
  - `payments.js:105, 892-897`: leaks `window.ofl`, `window.accID`, `window.ledID`, `window.fee`
- **Security Impact:**
  Cryptographic salts, previous encrypted recovery key buffers, and full copies of account ciphertext structures (`window.backupaccounts`, `window.backupdata`) are pinned to the global `window` object and can never be garbage-collected during the session. In `payments.js`, shared global `accID`/`ledID`/`fee` variables also create cross-call state pollution risks.
- **Recommended Remediation:**
  - Add `'use strict';` to the top of `settings.js`, `payments.js`, `accounts.js`, `xrpl-tx.js`, and `app-logic.js`, declare all local variables with `let` / `const`, and audit all files for undeclared identifiers (see also **TX-07** and **APP-02**).

---

### [MEM-06] Session Passphrase Cache (`validatePassphraseCache`) Fast SipHash Oracle, Missing Invalidation, & UI Freeze Bug
- **Severity:** High
- **Locations:** `www/js/ui/settings.js:317-353`, `www/js/state.js:57`
- **Mechanics / Root Cause:**
  After one successful passphrase validation, `validatePassphrase()` caches a 64-bit SipHash-2-4 (`crypto_shorthash`) digest and its 16-byte key in `window.validatePassphraseCache` (`settings.js:336-339`):
  ```javascript
  // www/js/ui/settings.js:320
  if (!isrecoveryphrase && _validatePassphraseCacheHit(passphrase)) return true;
  ...
  // www/js/ui/settings.js:336-339
  if (!isrecoveryphrase) {
      validatePassphraseCache.salt = sodium.randombytes_buf(sodium.crypto_shorthash_KEYBYTES);
      validatePassphraseCache.hash = sodium.crypto_shorthash(passphrase, validatePassphraseCache.salt, 'hex');
  }
  ```
  This introduces three distinct flaws:
  1. **Fast Brute-Force Oracle in Memory:** SipHash-2-4 executes at billions of guesses per second on modern hardware—completely bypassing `scrypt` key stretching for any attacker who captures a heap snapshot or reads `window.validatePassphraseCache`.
  2. **Never Invalidated:** `validatePassphraseCache` is **never cleared** on wallet lock (`doShowLogin()`), passphrase change (`setPassphrase()`), wallet restore (`importWallet()`), or wallet reset (`DELETE` / `__freshinstall()`).
  3. **Broken Cache-Hit Return Freezes UI:** Line 320 returns `true` **without invoking `successfunc()`**! Because callers call `blockInput()` before `validatePassphrase(...)` and rely on `successfunc()` to proceed and call `unblockInput()`, the second passphrase-protected operation in a session with the correct passphrase **permanently freezes the UI**! (And if line 320 were naively changed to `return successfunc()` without cache invalidation on `setPassphrase()`, a revoked/old passphrase would still authorize `doDeleteAccount()` and `doResetPin()`, which do not perform secret decryption.)
- **Recommended Remediation:**
  - Remove `validatePassphraseCache` completely so every `validatePassphrase()` call validates deterministically against `ppdata` via a properly parameterized memory-hard KDF (and invokes `successfunc()`).

---

### [MEM-07] Production `debug: true`, Global `window.dbgdumpdata()`, and Verbose Error Reporting
- **Severity:** Medium
- **Locations:** `www/js/state.js:2`, `www/js/app-logic.js:312-320`, `www/js/head-shim.js:36-47`, `www/js/modules/xrpl-tx.js:39, 295, 356`
- **Mechanics / Root Cause:**
  `window.AppState.debug` is hardcoded to `true` in `www/js/state.js:2`. Sensitive runtime objects—including full payment objects (`xrpl-tx.js:39`), DEX order details (`xrpl-tx.js:295, 356`), paylinks (`app-init.js:304`), and offline transaction codes (`payments.js:694`)—are continuously logged into the browser's persistent `console.log` buffer. Furthermore, `window.dbgdumpdata` (`app-logic.js:312-320`) dumps all database records to the console, and `window.onerror` (`head-shim.js:36-47`) displays raw runtime error messages and stack locations in an alert instructing users to email them to `support@toastwallet.com`.
- **Security Impact:**
  Retains transaction metadata, addresses, and wallet structures in browser DevTools console memory buffers and risks accidental disclosure of internal state in user bug-report emails.
- **Recommended Remediation:**
  - Set `debug: false` in production builds, remove `window.dbgdumpdata` and unconditional `console.log(payment)` / `console.log(order)` statements, and sanitize error messages shown in `window.onerror`.

---

## 3. Private Leak & Manipulation in Clipboard

### [CLIP-01] Copying Raw XRPL Secrets and Wallet Backups to System Clipboard Without Auto-Clear or User Warning
- **Severity:** High
- **Locations:** `www/views/tabaccountsecret.html:30`, `www/views/tabbackup2.html:6`, `www/js/modules/clipboard.js:32-45`
- **Mechanics / Root Cause:**
  On `#tabaccountsecret`, clicking **Copy Secret** (`tabaccountsecret.html:30`) copies the raw plaintext XRPL secret (`s...`) directly into the OS clipboard:
  ```html
  <button id="btncopysecret" ... ontouchend="te(event, ()=>{clipboardCopy(domData('#accsecret', 'content')); navigator.notification.alert('Account secret copied to clipboard', ()=>{}, 'Copied', 'OK');})">Copy Secret</button>
  ```
  Similarly, `#tabbackup2` (`tabbackup2.html:6`) copies the entire wallet backup JSON to the clipboard. `clipboardCopy()` (`clipboard.js:32-45`) neither warns the user of clipboard exposure nor schedules a clipboard clear timeout.
- **Security Impact:**
  Once copied, the raw XRPL master seed remains in the system clipboard indefinitely, exposing it to:
  - OS clipboard history managers (Windows Clipboard History, macOS clipboard managers, Android Gboard clipboard history),
  - Cross-device cloud clipboard synchronization (Apple Universal Clipboard, Windows Cloud Clipboard),
  - Any background native app or browser page/extension with clipboard read permission.
- **Recommended Remediation:**
  - Display an explicit security warning modal before copying a raw XRPL secret, advising against clipboard sync/managers.
  - Schedule an automatic clipboard overwrite (e.g., `setTimeout` after 30 seconds writing `''` via `navigator.clipboard.writeText('')` when document focus permits, or provide a prominent "Clear Clipboard" button and clear on tab exit).

---

### [CLIP-02] Ubiquitous "One-Tap Paste Passphrase & Execute" Pattern Encourages Keeping Passphrase in System Clipboard
- **Severity:** High
- **Locations:** `www/views/tabpaymentconfirm.html:33`, `www/views/taborderconfirm.html:33`, `www/views/tabcancelorderconfirm.html:17`, `www/views/tabtrustlineconfirm.html:25`, `www/views/tabaccountflagsconfirm.html:45`, `www/views/tabaccountsecret.html:16`, `www/views/tabrecovery.html:6`, `www/views/tabaddexistingaccount.html:4, 22`, `www/views/tabaddgateway.html:6`, `www/js/modules/clipboard.js:47-55`
- **Mechanics / Root Cause:**
  Every passphrase, recovery phrase, and secret prompt in the UI provides a dedicated **Paste** (`fa-clipboard`) button next to the input. Worse, on transaction confirmation screens, Reveal Secret, Reset PIN, and Add Gateway, clicking Paste **immediately submits and executes the action** without letting the user verify what was pasted or clearing the clipboard afterward:
  ```html
  <!-- www/views/tabpaymentconfirm.html:33 -->
  <span class="input-group-addon" ontouchstart="ts(event)" ontouchend="te(event, ()=>{clipboardPaste((t)=>{setVal('#confirmpaypassword', t); doConfirmPay(t);})})"><i class="fa fa-clipboard" aria-hidden="true"></i></span>
  ```
  (Note also a bug in `www/views/tabaccountsecret.html:16-17`: the Paste handler passes `getVal('#accdetailssecretaddress')`—which is a `<div class="well">`, so `.value` is `""`—instead of `domData('#accdetailssecretaddress', 'content')`!)
- **Security Impact:**
  - Providing one-tap Paste buttons on every passphrase prompt actively trains users to store their master passphrase (and XRPL secrets) in the OS clipboard during wallet usage, defeating the security separation between local encrypted storage and other apps on the device.
  - Immediate execution on paste (`doConfirmPay(t)`, `doAddGateway(t)`, `doRevealRippleSecret(t, ...)`) prevents users from noticing clipboard hijacking (e.g., if clipboard contents were replaced with a malicious `wss://` gateway URL on `#tabaddgateway` or an unintended string).
- **Recommended Remediation:**
  - Remove Paste buttons from master passphrase confirmation prompts (or at minimum never auto-execute transactions/gateway connections inside the `clipboardPaste` callback—require an explicit click on the primary Confirm button).

---

### [CLIP-03] `fallbackCopyText()` Appends Plaintext Secret `<textarea>` to `document.body` Without Zeroing Value
- **Severity:** Medium
- **Locations:** `www/js/modules/clipboard.js:1-30`
- **Mechanics / Root Cause:**
  When `navigator.clipboard.writeText` is unavailable or rejects (e.g., after an asynchronous callback loses transient user activation in Safari/Firefox, or in non-HTTPS local contexts), `fallbackCopyText()` creates a `<textarea>` containing the plaintext secret, appends it to `document.body`, selects it, calls `document.execCommand('copy')`, and removes the node without clearing `textArea.value = ''`:
  ```javascript
  const textArea = document.createElement('textarea');
  textArea.value = text;
  ...
  document.body.appendChild(textArea);
  ...
  document.body.removeChild(textArea);
  ```
- **Security Impact:**
  Browser extensions, accessibility hooks, and third-party password-manager content scripts frequently observe `document.body` via `MutationObserver` for newly inserted `<input>` / `<textarea>` elements, exposing the secret string to extension scripts; additionally, the detached `HTMLTextAreaElement` retains `value` in memory until garbage-collected.
- **Recommended Remediation:**
  - Clear `textArea.value = '';` inside a `finally` block prior to `document.body.removeChild(textArea)`, and prefer invoking `navigator.clipboard.writeText` synchronously within user-gesture handlers (`click`) rather than deferred touch timers.

---

### [CLIP-04] Missing `event.preventDefault()` on `#toaddress` Native `onpaste` Corrupts Destination Address and Tag
- **Severity:** Medium
- **Locations:** `www/views/tabpayments.html:22`, `www/js/ui/payments.js:45-62, 503-549`
- **Mechanics / Root Cause:**
  In `www/views/tabpayments.html:22`, `#toaddress` defines an inline `onpaste` handler that invokes `populatePaymentTabFromURI(...)` **without calling `event.preventDefault()`**:
  ```html
  <input id="toaddress" type="text" ... onpaste="var d = event.clipboardData.getData('Text'); if (d && d.length) populatePaymentTabFromURI(d);">
  ```
  `populatePaymentTabFromURI(d)` synchronously sets `#toaddress.value` to the parsed XRPL address (`payments.js:510`). Immediately afterward, the browser performs its default native paste action and **inserts the raw clipboard URI string into `#toaddress` alongside the already-populated address** (e.g., `rDestAddr...ripple:rDestAddr?dt=123&amount=50`).
- **Security Impact:**
  - Corrupts `#toaddress` whenever a user uses native keyboard paste (`Ctrl+V` / `Cmd+V` / long-press Paste) with a payment URI.
  - Worse, when `doPay()` subsequently runs its greedy query-parameter regex (`payments.js:45-62`, detailed in **TX-06**), trailing URI parameters like `&amount=50` are misinterpreted as `DestinationTag = 50`, and missing `return` on invalid address validation (**TX-06**) allows malformed state to advance toward confirmation!
- **Recommended Remediation:**
  - Call `event.preventDefault()` inside `#toaddress`'s `paste` event handler whenever `d && d.length > 0` is handled by `populatePaymentTabFromURI(d)`.

---

## 4. Wrong Signature & Wrong Transaction Risks

### [TX-01] Silent Stripping of `DestinationTag: 0` (and `SourceTag: 0`) Across Classic & X-Addresses (Online & Offline)
- **Severity:** Critical
- **Locations:** `www/js/modules/xrpl-tx.js:26-31, 100-101`, `www/js/modules/xrpl-client.js:360-365`, `www/js/ui/payments.js:221-226`
- **Mechanics / Root Cause:**
  On the XRP Ledger, `0` is a completely valid 32-bit unsigned integer (`UInt32`) `DestinationTag` and `SourceTag`. Furthermore, the XLS-5d `X`-address format explicitly distinguishes **"no tag" (`tag === false`)** from **"tag 0" (`tag === 0`)** (`www/js/modules/address.js:30-35`).
  However, three separate layers use JavaScript **truthiness checks** where `0` (and `"0"` after `forceraddrtag` converts `"0"` to `parseInt("0") === 0` at `address.js:84`) evaluates as **falsy**:
  1. `www/js/modules/xrpl-tx.js:26-31` (`sendPayment`) and `100-101` (`sendPaymentOffline`):
     ```javascript
     if(sourceTag) {
         payment.source.tag = parseInt(sourceTag + "");
     }
     if(destTag) { // <-- FALSE when destTag === 0!
         payment.destination.tag = parseInt(destTag + "");
     }
     ```
  2. `www/js/modules/xrpl-client.js:360-365` (`preparePayment`):
     ```javascript
     if (payment.destination.tag) { // <-- FALSE when tag === 0!
         tx.DestinationTag = parseInt(payment.destination.tag);
     }
     if (payment.source && payment.source.tag) { // <-- FALSE when tag === 0!
         tx.SourceTag = parseInt(payment.source.tag);
     }
     ```
  3. `www/js/ui/payments.js:221-226` (`#tabpaymentconfirm` UI display):
     ```javascript
     if (isXAddress(payto)) {
         if (confirmDestTag && confirmDestTag.parentNode) confirmDestTag.parentNode.style.display = 'none';
     }
     ...
     setText('#confirmdesttag', paytoreal.tag || '(not provided)'); // <-- Shows '(not provided)' when tag === 0!
     ```
- **Security Impact:**
  - If a user sends funds to a classic `r`-address with Destination Tag `0`, `DestinationTag` is silently omitted from the signed transaction.
  - **Even worse for `X`-addresses:** If a user enters or scans an `X`-address encoding `tag = 0`, `#tabpaymentconfirm` **hides the Destination Tag field completely** (`payments.js:221-222`) while displaying the `X`-address (which visually implies tag `0` is included), and then signs and broadcasts a transaction **with no `DestinationTag` field at all**! If the destination exchange hot wallet does not enforce `lsfRequireDestTag`, the user's funds arrive untagged into the exchange's pooled account and may be lost or miscredited.
- **Recommended Remediation:**
  - Replace all truthiness checks on tags with explicit `tag !== undefined && tag !== null && tag !== false && tag !== '' && !Number.isNaN(Number(tag))` checks (`Number.isInteger(Number(destTag)) && Number(destTag) >= 0`).
  - Update `#confirmdesttag` display logic to `(paytoreal.tag !== false && paytoreal.tag !== null && paytoreal.tag !== undefined) ? String(paytoreal.tag) : '(not provided)'`, and always display the decoded tag even when paying to an `X`-address.

---

### [TX-02] Unchecked Transaction `Fee` (Up to 4,294.96 XRP Offline / 2 XRP Online), Hidden Fee UI, & Ignored `maxLedgerVersionOffset`
- **Severity:** Critical
- **Locations:** `www/js/ui/payments.js:635, 873-921`, `www/js/modules/xrpl-client.js:372-389, 424-441, 456-473, 503-520, 528-545`, `www/js/modules/xrpl-tx.js:9, 79, 164, 277, 410, 527`, `www/views/tabpaymentconfirm.html`, `taborderconfirm.html`, `tabtrustlineconfirm.html`, `tabcancelorderconfirm.html`, `tabaccountflagsconfirm.html`
- **Mechanics / Root Cause:**
  1. **Zero Fee / Sequence Visibility on Confirmation Screens:** None of the five transaction confirmation templates (`#tabpaymentconfirm`, `#taborderconfirm`, `#tabtrustlineconfirm`, `#tabcancelorderconfirm`, `#tabaccountflagsconfirm`) displays the transaction `Fee`, `Sequence`, or `LastLedgerSequence` to the user prior to signing.
  2. **Offline Signing Accepts Arbitrary 32-Bit Unsigned Drop Fees (Up to 4,294.967295 XRP):**
     While the online helper `doSubmitOfflineTransaction(1)` caps the fetched network fee at `1,000,000` drops (1 XRP) on the **online** machine (`payments.js:635`), the **air-gapped offline signing wallet** (`validateOfflineCode()` in `payments.js:873-921`) performs **zero upper-bound validation on `fee`**:
     ```javascript
     // www/js/ui/payments.js:914-920
     accID = parseInt('0x' + accID);
     ledID = parseInt('0x' + ledID);
     fee = (parseInt('0x' + fee)/1000000.0) + "";
     return { accID: accID, ledID: ledID, fee: fee };
     ```
     The offline code is protected only by a 1-byte unkeyed BLAKE2b checksum (`crypto_generichash(1, offlinecode, 'offlinecode', 'hex')`). If a compromised online machine, phishing guide, or typo supplies an offline code encoding `fee = FFFFFFFF`, the air-gapped wallet silently signs a transaction burning **`4,294.967295 XRP`** as the network fee without displaying any fee or warning!
  3. **Online `autofill()` Fee & `LastLedgerSequence` Manipulation + Ignored `maxLedgerVersionOffset`:**
     In online mode, `xrpl-tx.js` passes `var instructions = { maxLedgerVersionOffset: 30 };` (`lines 9, 164, 277, 410, 527`). However, every `prepare*` method in `www/js/modules/xrpl-client.js` checks **only** `instructions.maxLedgerVersion` and **completely ignores `instructions.maxLedgerVersionOffset`**, delegating directly to `client.autofill(tx)`:
     ```javascript
     // www/js/modules/xrpl-client.js:379-386
     if (instructions.maxLedgerVersion !== undefined) {
         tx.LastLedgerSequence = parseInt(instructions.maxLedgerVersion);
     }
     ...
     if (tx.Sequence === undefined || tx.Fee === undefined) {
         return client.autofill(tx).then(autofilled => {
             return { txJSON: JSON.stringify(autofilled) };
         });
     }
     ```
     Because users can connect to custom WebSocket gateways (`#tabaddgateway`), a malicious or compromised gateway can:
     - Inflate `open_ledger_fee` up to `xrpl.Client`'s default `maxFeeXRP = "2"` (**2 XRP per transaction**, or up to **14 XRP** across a multi-flag `sendAccountFlagsTx` batch) with zero user visibility; and
     - Return an arbitrarily large `validated` `ledger_index` so `autofill` sets `LastLedgerSequence` far in the future (or in offline mode, `ledID = 0xFFFFFFFF`), turning the signed blob into a long-lived "time-bomb" transaction that the gateway can withhold and broadcast hours or months later.
- **Recommended Remediation:**
  - Enforce a strict hard fee ceiling (e.g., `<= 0.01 XRP` / `10,000` drops by default, requiring explicit user override above that threshold) inside **both** `validateOfflineCode()` and every `client.prepare*` / `client.sign` method, and configure `new xrpl.Client(server, { maxFeeXRP: '0.01' })`.
  - Honor `instructions.maxLedgerVersionOffset` in all `client.prepare*` methods and cross-check `LastLedgerSequence - currentValidatedLedger <= 30`.
  - Display the exact `Fee` (in XRP) on every transaction confirmation view and include `fee` inside the `confirmpayhash` / `confirm*hash` integrity binding.

---

### [TX-03] Forced `tfPartialPayment` (`0x00020000`) on Offline IOU Payments Without `SendMax`/`DeliverMin` + Rippled API v2 Breakage & Fake/Partial-Payment Spoofing in History
- **Severity:** Critical
- **Locations:** `www/js/modules/xrpl-tx.js:103-107`, `www/js/modules/xrpl-client.js:347-371`, `www/js/ui/transactions.js:8-48, 69-106`
- **Mechanics / Root Cause:**
  1. **Silent `tfPartialPayment` on Offline IOU Transfers:**
     In `sendPaymentOffline()` (`xrpl-tx.js:103-107`), all non-XRP payments unconditionally set `payment['allowPartialPayment'] = true`:
     ```javascript
     if (asset != 'XRP' && issuer != '' && issuer != undefined) {
         payment.source.maxAmount['counterparty'] = issuer;
         payment.destination.amount['counterparty'] = issuer;
         payment['allowPartialPayment'] = true;
     }
     ```
     In `client.preparePayment()` (`xrpl-client.js:347-371`), `payment.source.maxAmount` is **ignored** (no `SendMax` and no `DeliverMin` are added), while `if (payment.allowPartialPayment) tx.Flags = 0x00020000;` sets `tfPartialPayment`! `#tabpaymentconfirm` never informs the user that partial payment is enabled, meaning an offline IOU transfer can succeed on-ledger (`tesSUCCESS`) while delivering a tiny fraction of the intended amount (e.g., due to issuer transfer fees `TransferRate` or insufficient balance).
  2. **Rippled API v2 Schema Breakage & Partial-Payment / Failed-Tx Spoofing in `transactions.js`:**
     `xrpl.Client` v4.6.0 defaults to `apiVersion: 2`. Under Rippled API v2:
     - `account_tx` returns each item's transaction object under **`txs[i].tx_json`** (not `txs[i].tx`) and uses **`DeliverMax`** (not `Amount`). Because `transactions.js:73-74` checks `var t = txs[i].tx; if (t && t.TransactionType === 'Payment' && typeof t.Amount === 'string')`, transaction history fails to render on modern Rippled v2 servers.
     - `tx` returns transaction fields nested under **`res.result.tx_json`** (not top-level `res.result`), causing `doViewTransaction()` (`transactions.js:30-39`) to render `undefined - tesSUCCESS`. Also, line 40 divides `meta.delivered_amount` by `1000000.0` unconditionally, producing `NaN` whenever `delivered_amount` is an IOU object!
     - **Critical Spoofing Flaw (`transactions.js:71-83`):** Even when a gateway returns `tx` / `Amount` (e.g., custom/legacy gateway or v1 response), `doGetTransactions()` **never verifies `txs[i].validated === true`**, **never verifies `txs[i].meta.TransactionResult === 'tesSUCCESS'`**, and **displays `t.Amount` instead of `txs[i].meta.delivered_amount`**!
       ```javascript
       // www/js/ui/transactions.js:73-80
       var t = txs[i].tx;
       if (t && t.TransactionType === 'Payment' && typeof t.Amount === 'string') {
           payments.push({
               source: t.Account,
               destination: t.Destination,
               amount: parseFloat(t.Amount) / 1000000.0, // <-- Reads t.Amount, NOT meta.delivered_amount, and ignores TransactionResult!
               tx_hash: t.hash || t.TxnSignature
           });
       ```
- **Security Impact:**
  - Offline IOU senders sign `tfPartialPayment` transactions without knowing partial delivery is permitted and without `DeliverMin` protection.
  - Against any server returning `tx`/`Amount` (or once updated for `tx_json`), an attacker can send a **failed** `tecUNFUNDED_PAYMENT` transaction for `1,000,000 XRP` or a **`tfPartialPayment` transaction** with `Amount = 1,000,000 XRP` that actually delivers `0.000001 XRP`, and Toast Wallet's transaction list displays it identically to a valid incoming `1,000,000 XRP` payment (classic XRPL Partial Payment exploit).
- **Recommended Remediation:**
  - Remove implicit `allowPartialPayment = true` in `sendPaymentOffline()` (or require explicit user opt-in with mandatory `DeliverMin` and `SendMax` displayed on `#tabpaymentconfirm`).
  - Update `transactions.js` for Rippled API v2 (`const t = txs[i].tx_json || txs[i].tx;`, and in `doViewTransaction`, `const txObj = res.result.tx_json || res.result;`).
  - Strictly filter `account_tx` entries by `txs[i].validated === true` and `txs[i].meta && txs[i].meta.TransactionResult === 'tesSUCCESS'`, and **exclusively** read `txs[i].meta.delivered_amount` (never `Amount` / `DeliverMax`), formatting both drop strings and `{ value, currency, issuer }` IOU objects safely.

---

### [TX-04] Wrong Signing Algorithm (`secp256k1`) Selected for Non-`sEd` Ed25519 Seeds & Missing RegularKey Error Branch
- **Severity:** High
- **Locations:** `www/js/modules/xrpl-client.js:547-555`, `www/js/ui/accounts.js:555, 563-577, 590`
- **Mechanics / Root Cause:**
  1. `client.sign()` (`xrpl-client.js:548-550`) determines the signing curve exclusively by checking whether the seed string starts with `'sEd'`:
     ```javascript
     client.sign = function(txJSON, secret) {
         var tx = JSON.parse(txJSON);
         var wallet = xrpl.Wallet.fromSeed(secret, { algorithm: secret.startsWith('sEd') ? 'ed25519' : 'ecdsa-secp256k1' });
         var signed = wallet.sign(tx);
     ```
     Similarly, `accounts.js:555` and `590` call `xrpl.deriveKeypair(secret)` without `{ algorithm }`, which also defaults non-`sEd` family seeds (`0x21` prefix, `s...`) to `ecdsa-secp256k1`. On the XRP Ledger, `rippled`'s `wallet_propose` with `key_type: "ed25519"` and a passphrase or raw seed produces a standard `s...` (non-`sEd`) seed whose account uses **Ed25519**. If imported with `#vanityaddr` (e.g., in offline mode at `accounts.js:559-561`), `client.sign()` derives the wrong (`secp256k1`) public key and produces an invalid signature (`tefBAD_AUTH` / `tefBAD_AUTH_MASTER`).
  2. In online mode, when `pubaddress != address` (`accounts.js:563-573`), `importAddress()` checks `if ('regularKey' in settings)` **with no `else` branch**:
     ```javascript
     if ('regularKey' in settings) {
         if (settings['regularKey'] == pubaddress) {
             return _import(...);
         } else {
             return navigator.notification.alert(..., failurefunc, "Failure", "OK");
         }
     }
     // Missing `else`! If the account has no regularKey set, neither _import nor failurefunc is called -> permanent blockInput() freeze!
     ```
- **Security Impact:**
  - Non-`sEd` Ed25519 accounts imported offline cannot sign valid transactions (`client.sign` signs with the wrong curve and wrong `SigningPubKey`), stranding offline funds.
  - Importing a mismatched address/seed pair online when the target account has no `RegularKey` permanently locks the UI behind `blockInput()`.
- **Recommended Remediation:**
  - During `importAddress()`, test both `'ecdsa-secp256k1'` and `'ed25519'` derivation against `address` (and `settings.regularKey`), persist the matched `algorithm` in `accounts[address]`, and pass that `algorithm` into `xrpl.Wallet.fromSeed(secret, { algorithm })` in `client.sign()`.
  - Add the missing `else` branch in `accounts.js:572` to alert the user and invoke `failurefunc()` (`unblockInput()`).

---

### [TX-05] DEX `getOrders()` Checks `lsfPassive` (`0x00010000`) Instead of `lsfSell` (`0x00020000`), Hiding BUY Orders & Mislabeling SELL Orders
- **Severity:** High
- **Locations:** `www/js/modules/xrpl-client.js:213-227`, `www/js/ui/trustlines.js:44-57`, `www/js/ui/orders.js:94-141`
- **Mechanics / Root Cause:**
  In XRPL transactions (`OfferCreate`), the transaction flag `tfSell` is `0x00080000` (`xrpl-client.js:486`), whereas in **ledger `Offer` objects** returned by `account_offers`, the ledger flags are:
  - `lsfPassive = 0x00010000`
  - `lsfSell = 0x00020000`

  However, `client.getOrders()` (`xrpl-client.js:213-227`) checks `0x00010000` (`lsfPassive`) to determine `isSell`, and **never swaps `quantity` and `totalPrice` for BUY offers**:
  ```javascript
  // www/js/modules/xrpl-client.js:213-226
  return (res.result.offers || []).map(offer => {
      var pays = parseAmount(offer.taker_pays);
      var gets = parseAmount(offer.taker_gets);
      var isSell = (offer.flags & 0x00010000) !== 0; // <-- BUG: 0x00010000 is lsfPassive, NOT lsfSell (0x00020000)!
      return {
          specification: {
              direction: isSell ? 'sell' : 'buy',
              quantity: gets,
              totalPrice: pays
          },
  ```
  Furthermore, in `orders.js:94-121`, `doPlaceCancelOrder()` initializes `accID = ''`, `ledID = ''`, `fee = ''` and never reads an offline code, so `doConfirmCancelOrder()` in `offlinemode` passes empty strings to `sendOfferCancelOffline()`, breaking offline order cancellation (`LastLedgerSequence: NaN`).
- **Security Impact:**
  1. **100% of Open BUY Orders Are Invisible and Uncancellable:** For a BUY IOU offer (`taker_gets = XRP`, `taker_pays = IOU`), `quantity` is set to `gets` (`currency: 'XRP'`). When `trustlines.js:47` filters orders by `if (currency1 == currency && issuer == order.specification.quantity.counterparty)`, `currency1` is `'XRP'`, so **every open BUY order is skipped and hidden from the user**, leaving open DEX exposure on-ledger that the user cannot see or cancel!
  2. **Open SELL Orders Are Mislabeled as `BUY` (or `SELL` if Passive):** Non-passive SELL orders (`offer.flags` has `0x00020000`, not `0x00010000`) are displayed in the UI and on `#tabcancelorderconfirm` (`orders.js:116`) with the inverted direction **`BUY`** instead of **`SELL`**, misleading users into cancelling or retaining the wrong orders.
- **Recommended Remediation:**
  - Check `var isSell = (offer.flags & 0x00020000) !== 0;` (`lsfSell`), and map `quantity: isSell ? gets : pays` and `totalPrice: isSell ? pays : gets` (matching the legacy RippleAPI `getOrders` specification expected by `trustlines.js` and `orders.js`).
  - Add an offline code input and `validateOfflineCode()` check to `#tabcancelorderconfirm` / `doPlaceCancelOrder()` if offline `OfferCancel` is supported.

---

### [TX-06] Floating-Point Amount Corruption, `roundXRP()` Overcharging, Greedy `doPay()` Query Regex, & Missing `return` on Invalid Address
- **Severity:** High
- **Locations:** `www/js/ui/payments.js:45-62, 149-159, 190, 203-207, 292, 301`, `www/js/modules/xrpl-tx.js:287, 348`, `www/js/app-logic.js:579-581`, `www/js/ui/orders.js:242-264`
- **Mechanics / Root Cause:**
  1. **Greedy `doPay()` Query Regex Stuffs Arbitrary Query Params Into `DestinationTag` (`payments.js:45-62`):**
     ```javascript
     if (/^(.*)[?&][^=]*=(.*)$/m.test(payto)) {
         var oldpayto = payto;
         var newdest = oldpayto.replace(/^(.*)[?&][^=]*=(.*)$/mg, "$2");
         ...
         dest = newdest;
         payto = oldpayto.replace(/^(.*)[?&][^=]*=(.*)$/mg, "$1");
     }
     ```
     Because `[^=]*` matches **any** parameter name (not just `dt` or `destinationTag`) and `(.*)` is greedy, entering or pasting `rAddr?amount=500` or `rAddr?dt=10&amount=500` extracts `500` into `dest` (`DestinationTag = 500`)! If `rAddr?dt=10&amount=500` is entered, `payto` becomes `rAddr?dt=10` (invalid address).
  2. **Missing `return;` After Invalid Destination Address Alert (`payments.js:149-159`):**
     When `!validateAddress(payto)` triggers an alert at `payments.js:150`, there is **no `return;` statement**. Execution falls straight through to `checkAccountIsFunded()` and `nextscreen()`, where `forceraddrtag(payto, dest)` (`address.js:90`) returns `false`, setting `confirmpay.payto = undefined` and `confirmpay.dest = undefined`!
  3. **IEEE-754 `parseFloat` & `roundXRP(price * amount)` Precision Corruption:**
     - `payments.js:292, 301` converts `confirmpay.amount` via `parseFloat(confirmpay.amount)` instead of preserving the exact decimal string, corrupting 16-significant-digit IOU amounts (e.g., `"9999999999999999"` -> `"10000000000000000"`). Also `payments.js:190` (`parseFloat(amount) + "" != (""+amount).trim()`) rejects valid trailing-zero decimals like `"10.50"` and scientific-range IOU values.
     - `xrpl-tx.js:287, 348` computes DEX order total XRP using `roundXRP(price * amount)` where `roundXRP` (`app-logic.js:579-581`) is:
       ```javascript
       function roundXRP(num) {
           return Math.ceil(num * 1000000) / 1000000;
       }
       ```
       Due to IEEE-754 binary floating-point inaccuracy, `1.1 * 3 === 3.3000000000000003`, which `Math.ceil(... * 1e6) / 1e6` rounds **UP** to **`3.300001` XRP** (and `#taborderconfirm` never displays the computed `totalPrice` XRP to the user!).
- **Security Impact:**
  Users can sign transactions with corrupted `DestinationTag`s, imprecise IOU amounts, or systematically overcharged DEX XRP `TakerGets`/`TakerPays` amounts that were never shown on `#taborderconfirm`.
- **Recommended Remediation:**
  - Restrict inline tag extraction in `doPay()` strictly to `dt` / `destination_tag` parameters (or delegate to a hardened URI parser) and add `return;` after rejecting invalid addresses (`!validateAddress(payto)`).
  - Use `window.BigNumber` (already bundled via `xrpl` / `rippleutils.js`) for all XRP drop conversions, IOU decimal validation, and `price * amount` order calculations (`new BigNumber(price).multipliedBy(amount).decimalPlaces(6, BigNumber.ROUND_HALF_UP).toFixed()`), and display the exact `Total (XRP)` on `#taborderconfirm`.

---

### [TX-07] Swapped `currency`/`issuer` Arguments in `doConfirmTrustline()`, Runtime `ReferenceError`s, & X-Address Account-Flags Desync
- **Severity:** High
- **Locations:** `www/js/ui/trustlines.js:97, 120, 129, 191, 314`, `www/js/modules/xrpl-tx.js:156, 205`, `www/js/ui/flags.js:67, 81, 91`, `www/js/modules/db.js:50`
- **Mechanics / Root Cause:**
  1. **Swapped `currency` and `issuer` Arguments + Strict-Mode Crashes in `trustlines.js`:**
     - `sendTrustLineTx` (`xrpl-tx.js:156`) and `sendTrustLineTxOffline` (`xrpl-tx.js:205`) have signature:
       `function sendTrustLineTx(passphrase, fromacc, issuer, currency, limit, rippling, ...)`
     - `doConfirmTrustline` (`trustlines.js:120, 129`) calls non-existent lowercase-`l` `sendTrustlineTx` / `sendTrustlineTxOffline` and passes **`confirmtl.atlcurrency` in the `issuer` parameter and `confirmtl.atlissueraddr` in the `currency` parameter**:
       ```javascript
       // www/js/ui/trustlines.js:129
       sendTrustlineTx(passphrase, confirmtl.atladdress, confirmtl.atlcurrency, confirmtl.atlissueraddr, confirmtl.atllimit, confirmtl.atlrippling, ...)
       ```
     - In addition, `trustlines.js` runs under `'use strict'` (`line 1`) and references `parseLimit` (`lines 191, 314`, never defined anywhere in the codebase) and undeclared `lastsettlnonce` (`lines 97, 102`, missing from `state.js`), throwing `ReferenceError`s that break trustline creation/modification. If those `ReferenceError`s and function-name casing are fixed without fixing the argument order, every `TrustSet` transaction will construct `LimitAmount: { currency: <issuer_r_address>, issuer: <currency_code> }`!
  2. **X-Address Account-Flags Desync Prevents Clearing Flags & Re-Submits Already-Enabled Flags (`flags.js:5, 67, 91`):**
     - `accountflags` is keyed by classic `r`-address (`accounts.js:34`, `db.js:59`).
     - `showAccountFlags(account)` sets `#afaddress.value` to `dispaddr(account)` (`flags.js:5`), which is an **`X`-address** whenever `interface_settings.display_xaddresses` is `true` (the default in `state.js:48`!).
     - `doSetAccountFlags()` (`flags.js:67, 91`) reads `var afaddress = getVal("#afaddress").trim();` (still an `X`-address!) and looks up `accountflags[afaddress]` **before** converting `afaddress` via `forceraddr(afaddress)` at line 95:
       ```javascript
       var afaddress = getVal("#afaddress").trim(); // <-- X-address!
       ...
       if (accountflags[afaddress] != undefined) old_flags_orig = accountflags[afaddress]; // <-- Always undefined for X-addresses!
       ```
       Because `old_flags_orig` is `{}` (which also happens if `db.js:50`'s aggressive 500 ms `account_info` timeout expires), **every `old_flags[k]` evaluates to `false`**.
- **Security Impact:**
  - When `display_xaddresses` is enabled (the default!), **users cannot disable/clear any enabled XRPL account flag** (such as `defaultRipple`, `depositAuth`, or `requireDestinationTag`): toggling an enabled flag to `false` matches `old_flags[k] === false`, so it is marked `'unchanged'` and silently dropped! Conversely, every **already-enabled** flag (`'true'`) differs from `old_flags[k] === false` and gets re-submitted as a redundant fee-burning `AccountSet` transaction—including potentially irreversible flags like `noFreeze` if toggled or pre-populated!
- **Recommended Remediation:**
  - Fix the argument order in `trustlines.js:120, 129` to `(passphrase, confirmtl.atladdress, confirmtl.atlissueraddr, confirmtl.atlcurrency, ...)`, fix the function names to `sendTrustLineTx` / `sendTrustLineTxOffline`, declare `lastsettlnonce` in `state.js`, and implement strict decimal validation for `parseLimit`.
  - In `flags.js:67`, normalize `var afaddress = forceraddr(getVal("#afaddress").trim());` (or read `domData("#afaddress", "content")`) **before** looking up `accountflags[afaddress]`, and block flag changes online if `accountflags[afaddress]` has not yet loaded from `account_info`.

---

### [TX-08] Blind Broadcast of Scanned/Pasted Offline Signed Transaction Blobs Without Decoding or User Verification
- **Severity:** High
- **Locations:** `www/js/ui/payments.js:720-756`, `www/views/tabsubmitofflinetx.html:27-35`
- **Mechanics / Root Cause:**
  In `doSubmitOfflineTransaction(2, content)` (`payments.js:720-756`), as soon as the online device scans or pastes a `ripple:signed-transaction:<hex>` string, it immediately calls `submitSignedTransaction(signedTx, ...)` without decoding the blob (`xrpl.decode(signedTx)`) or showing the user any summary of the signed transaction:
  ```javascript
  signedTx = signedTx.slice('ripple:signed-transaction:'.length);
  checkConnection(function(){
      submitSignedTransaction(signedTx, ...);
  });
  ```
- **Security Impact:**
  The online device acts as a blind broadcast relay. Users have no opportunity on the online screen to verify the actual encoded `TransactionType`, `Account`, `Destination`, `DestinationTag`, `Amount`, `Fee`, `Flags`, or `LastLedgerSequence` inside the binary blob before irreversible ledger broadcast (which would otherwise catch issues like **TX-01**, **TX-02**, or **TX-03** prior to submission).
- **Recommended Remediation:**
  - Decode `signedTx` using `xrpl.decode(signedTx)` on the online device and present a read-only decoded transaction inspection modal (`TransactionType`, `Account`, `Destination`, `DestinationTag`, `Amount`, `Flags`, `Fee`, `Sequence`, `LastLedgerSequence`) requiring explicit user confirmation before calling `submitSignedTransaction()`.

---

## 5. Cross-Cutting Application & Cryptographic Risks

### [APP-01] Ledger- and Gateway-Triggered DOM XSS via Unescaped `.innerHTML` / Inline Event Handlers Enables Key Theft
- **Severity:** Critical
- **Locations:** `www/js/ui/accounts.js:64-80`, `www/js/ui/trustlines.js:20, 56`, `www/js/ui/orders.js:19, 75`, `www/js/ui/transactions.js:97-113`
- **Mechanics / Root Cause:**
  Multiple UI modules concatenate raw strings returned from the connected XRPL WebSocket server (or on-ledger objects) directly into HTML strings passed to `setHtml()` / `appendHtml()` (`.innerHTML`) and inside inline single- and double-quoted JavaScript `ontouchend="..."` attributes without HTML or JS escaping:
  - **Currency codes & balances on `#tabaccounts` (`accounts.js:68-78`) and `#tabaccountdetails` (`trustlines.js:20, 56`, `orders.js:19, 75`):**
    ```javascript
    // www/js/ui/accounts.js:68
    html += '<br /><span class="altcurrency"><span class="currency">' + currency + ':</span> ...';
    // www/js/ui/trustlines.js:20
    trustlines += '<li class="adtrustline">...<div class="currency">' + currency + '</div> ... ontouchend="te(event,()=>{showModifyTrustline(\''+account+'\', \''+currency+'\', \''+issuer+'\', '+tl['specification']['limit']+')})">...';
    ```
    Notably, **even valid on-ledger XRPL standard 3-character currency codes legally permit `<` and `>` characters** per the XRPL currency specification (`!@#$%^&*<>(){}[]|?` are valid ASCII currency characters on-ledger!), and non-standard 160-bit hex currency codes or responses from a custom/malicious WebSocket gateway (`#tabaddgateway`) are rendered completely unvalidated and unescaped.
  - **Transaction hashes & pagination markers (`transactions.js:97, 112`):**
    `x.payments[i].tx_hash`, `addr`, and `x.marker` are interpolated directly into HTML and inline `ontouchend` arrow functions.
- **Security Impact:**
  Combined with the absence of CSP (**COOKIE-01**), a malicious custom gateway—or crafted ledger currency/trustline metadata—achieves arbitrary JavaScript execution inside the wallet origin. Once running in-origin, attacker script can immediately read `IndexedDB` (`accounts`, `ppdata`, `rpdata`, `pindata`), read any secrets leaked in memory (`window.generatedAccount.secret`, DOM inputs), and attach a keystroke/hook listener to `validatePassphrase` / `getSecretForAccount` to exfiltrate the user's master passphrase and **all decrypted XRPL private keys**.
- **Recommended Remediation:**
  - Replace string-concatenated HTML (`setHtml` / `appendHtml`) and inline `ontouchend="..."` attributes with safe DOM construction (`document.createElement`, `el.textContent = ...`, and `el.addEventListener(...)`).
  - Strictly validate and HTML-encode all untrusted network/ledger fields (`currency`, `issuer`, `tx_hash`, `balance`, `limit`, `seq`) at the `xrpl-client.js` boundary.

---

### [APP-02] Severe `scrypt` Misconfiguration (`OPSLIMIT=4` -> `N=1024`, 1 MB RAM), 83-Bit Modulo-Biased Recovery Phrase, Unkeyed Checksums, & PIN Flaws
- **Severity:** Critical
- **Locations:** `utils-build/sodium-compat.js:115-147, 200-201`, `www/js/ui/accounts.js:448-480, 608-620`, `www/js/ui/settings.js:131-150, 329-332, 394-402`, `www/js/ui/login.js:82-86, 204-208, 224-228`, `www/js/modules/crypto.js:3, 64-87`, `www/js/ui/backup.js:160, 210-234`
- **Mechanics / Root Cause:**
  1. **`scrypt` Cost Degraded 16x–32x by Passing Argon2 `OPSLIMIT_INTERACTIVE = 4` (`sodium-compat.js:115-147, 200`):**
     In libsodium, `crypto_pwhash_OPSLIMIT_INTERACTIVE` is **`4`** (designed for Argon2i/Argon2id passes), whereas `crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_INTERACTIVE` is **`524288`**. Every single call to `crypto_pwhash_scryptsalsa208sha256` across `login.js`, `settings.js`, and `accounts.js` passes **`4`** as `opsLimit` alongside `33554432` (32 MB) as `memLimit`:
     ```javascript
     // www/js/ui/accounts.js:448-452
     sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
         passphrase,
         fromhex_chksum(ppdata.salt1),
         4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
         33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
     ```
     Inside `pickScryptParams(4, 33554432)` (`sodium-compat.js:119-127`), `ops = 4` is clamped to the minimum floor **`32768`**. Because `32768 < 33554432 / 32` (`1048576`), `pickScryptParams` takes the CPU-limited branch: `maxN = 32768 / 32 = 1024`, yielding **`N = 1024, r = 8, p = 1`**!
     Instead of using the intended 32 MB (`N = 32768`) or libsodium interactive scrypt (`N = 16384`, 16 MB), **every KDF call in Toast Wallet uses only `N = 1024` (1 MB of RAM)**!
  2. **Low-Entropy (~82.88-Bit), Modulo-Biased 6-Word Recovery Phrase (`settings.js:131-150`):**
     `setAndShowNewRecoveryPhrase()` generates 6 synthetic 4-phoneme words (`consonant + vowel + consonant + vowel` from 24 consonants and 5 vowels = $24 \times 5 \times 24 \times 5 = 14,400$ words), giving $\log_2(14400^6) \approx \mathbf{82.88\text{ bits}}$ of theoretical entropy (vs. 128–256 bits for standard BIP-39 / XRPL seeds), reduced further by modulo bias (`sodium.randombytes_random() % arr.length` where $2^{32} \bmod 24 = 16 \neq 0$ and $2^{32} \bmod 5 = 1 \neq 0$; `randShuffleArray` in `crypto.js:82` also uses biased float/modulo arithmetic for the PIN keypad).
  3. **Unauthenticated 32-Bit Checksums (`crypto.js:3, 64-73`, `backup.js:210-234`):**
     `tohex_chksum` uses a 4-byte unkeyed BLAKE2b hash (`key = ''`), and wallet backups (`exportWallet` / `importWallet`) use an unkeyed `crypto_generichash(32, ...)` checksum, allowing an attacker with offline storage or backup file access to swap `pindata`, `accounts`, or `ppdata` blobs and recompute valid checksums without detection.
  4. **Unlimited Offline/UI PIN Brute-Forcing, Unauthenticated `DELETE`, & Login Help Strict-Mode Crash (`login.js:82-86`, `backup.js:160`):**
     - A 6-digit numeric PIN ($10^6$ combinations) hashed with `N = 1024` `scrypt` has **no attempt counter, exponential backoff, or wipe threshold** in the UI (`login.js:217-263`) and can be cracked in seconds offline if `pindata` is read (though note the PIN does not decrypt `ppsecret`, unlocking the PIN grants full UI access to balances, addresses, custom gateways, and unauthenticated wallet wipe).
     - Typing `DELETE` on `#tabrestore` (reachable from `#tablogin` via **Restore Wallet** without knowing the PIN or passphrase!) immediately wipes the active wallet (`backup.js:160-170`).
     - Tapping the `?` Help button on `#tablogin` (`tablogin.html:19`) executes `doPinLoginHelp()` (`login.js:82-86`), which runs under `'use strict'` and assigns undeclared `pin = '';` at line 84—throwing `ReferenceError: pin is not defined`!
- **Recommended Remediation:**
  - Introduce a versioned KDF schema (`version: 2`) in `ppdata`, `rpdata`, `pindata`, and `accounts` that passes true interactive/sensitive `scrypt` parameters (`opsLimit = 524288` or `1048576`, `memLimit = 33554432` -> `N = 16384` or `32768, r = 8, p = 1`), migrating existing Version 1 vaults transparently upon next passphrase/PIN entry.
  - Upgrade newly generated recovery phrases to 12-word or 24-word standard BIP-39 mnemonics (128–256 bits of unbiased CSPRNG entropy) using rejection sampling for any bounded random index selection.
  - Fix `var pin = '';` (or reset the actual PIN input state) in `login.js:84`, enforce exponential backoff / lockout after failed PIN attempts, and require an explicit confirmation modal warning before allowing `DELETE` on `#tabrestore`.

---

## Prioritized Remediation Roadmap

### Phase 1 — Immediate Blockers (Critical Transaction Integrity & Key-Exposure Fixes)
1. **Fix `DestinationTag: 0` / `SourceTag: 0` stripping (`TX-01`)** in `xrpl-tx.js`, `xrpl-client.js`, and `payments.js`.
2. **Eliminate DOM XSS (`APP-01`) and enforce a strict `Content-Security-Policy` (`COOKIE-01`)** across `accounts.js`, `trustlines.js`, `orders.js`, `transactions.js`, and `index.template.html`.
3. **Wipe `window.generatedAccount.secret` (`MEM-01`)** by removing global secret storage and clearing secrets on all error, Back, and lock paths.
4. **Enforce hard `Fee` & `LastLedgerSequence` caps and display `Fee` on all confirmation screens (`TX-02`)**, including offline `validateOfflineCode()` and decoded offline broadcast preview (`TX-08`).
5. **Remove silent `tfPartialPayment` on offline IOU payments and fix `transactions.js` (`TX-03`)** to support Rippled API v2 (`tx_json`), require `validated === true` and `tesSUCCESS`, and display `meta.delivered_amount` exclusively.
6. **Upgrade `scrypt` `opsLimit` (`APP-02`)** via a versioned KDF header so key derivation actually uses 16–32 MB RAM (`N >= 16384`) rather than 1 MB (`N = 1024`).

### Phase 2 — High-Priority Wallet Logic & Memory/Storage Hardening
7. **Fix `getOrders()` `lsfSell` (`0x00020000`) flag & BUY order mapping (`TX-05`)**, `trustlines.js` swapped `currency`/`issuer` arguments & `ReferenceError`s (`TX-07`), `flags.js` `forceraddr` lookup before `accountflags` comparison (`TX-07`), `BigNumber` amount/order math (`TX-06`), and Ed25519 non-`sEd` algorithm tracking (`TX-04`).
8. **Purge legacy `_pouch_toastwallet` after migration and implement complete database destruction (`COOKIE-03`, `COOKIE-02`)** on `DELETE` / `__freshinstall()`.
9. **Implement browser auto-lock (`visibilitychange` + idle timer) and DOM/heap secret cleanup (`MEM-02`, `MEM-03`, `MEM-04`, `MEM-05`, `MEM-06`)**, including `Uint8Array.prototype.fill(0)`, `'use strict'` across all files, removing `validatePassphraseCache`, and adding `autocomplete="off"` attributes.
10. **Harden clipboard workflows (`CLIP-01`, `CLIP-02`, `CLIP-03`, `CLIP-04`)** by warning and auto-clearing on secret copy, removing auto-execute-on-paste from confirmation screens, zeroing fallback `<textarea>` values, and adding `event.preventDefault()` on `#toaddress` paste.

### Phase 3 — Defense-in-Depth & Privacy Hardening
11. **Add `'noopener,noreferrer'` to `openExternalUrl()`, strip `?paylink=` via `history.replaceState` (`COOKIE-04`), disable production `debug: true` (`MEM-07`), and encrypt local account metadata (`COOKIE-05`).**
