# Toast Wallet Core — `index.html` Modularization Plan

This document outlines a systematic plan to break the monolithic [www/index.html](file:///root/downloads/core/www/index.html) (~8,068 lines of mixed HTML, inline CSS, and JavaScript) into clean, maintainable, testable modules.

---

## 0. Current State Analysis

| Metric | Value |
|---|---|
| Total lines | 8,068 |
| Top-level functions | 144 |
| Screen tabs (`class="screentab"`) | 42 |
| Global `var` declarations (script scope) | ~30 key globals (`remote`, `db`, `offlinemode`, `accounts`, `interface_settings`, etc.) |
| Inline `<script>` blocks | 3 (head shim at L12, config+layout at L23–54/L61–392, main logic at L1703–8066) |
| HTML markup (views) | Lines 56–1702 |
| Inline `ontouchstart`/`ontouchend` handlers | ~190 |

### Key Coupling Risks
- **Heavy shared mutable state.** Globals like `remote`, `db`, `offlinemode`, `accounts`, `walletsalt`, `xrpreserve`, `interface_settings`, and `serverStack` are read and written across dozens of functions. Any module split must explicitly surface these as a shared state object or singleton, not rely on implicit `window` scope.
- **Circular HTML↔JS dependency.** HTML attributes contain inline `ontouchstart="ts(event)" ontouchend="te(event, ()=>{doSomething()})"` handlers that directly reference functions defined later in the page. Extracting JS to external files works only if those files are loaded *before* the HTML is parsed, or handlers are rebound after load via jQuery delegation.
- **`injectCompatibilityLayer` is called inside `connectToRipple`** (L7126), meaning the XRPL service module cannot be fully isolated without also extracting the connection lifecycle.
- **Encryption/PIN functions** (`setPin`, `validatePin`, `setPassphrase`, `validatePassphrase`) interleave PouchDB reads, sodium crypto, and UI navigation calls — they cross-cut db, crypto, and navigation concerns simultaneously.

---

## 1. Target Architecture

```
www/
├── index.html                  # Skeleton: <head>, <body>, view containers, <script> tags
├── css/                        # Unchanged
└── js/
    ├── app.js                  # Entry point: boot sequence, global error handler, event delegation
    ├── state.js                # Shared mutable state object (replaces bare globals)
    ├── modules/
    │   ├── db.js               # PouchDB wrapper: get/upsert accounts, profiles, settings
    │   ├── crypto.js           # PIN hashing, passphrase derivation, wallet encryption/decryption (sodium)
    │   ├── xrpl-client.js      # Connection lifecycle, server cycling, compatibility layer
    │   ├── xrpl-tx.js          # Transaction builders: sendPayment, sendTrustLineTx, sendOfferCreate, etc.
    │   ├── address.js          # Address helpers: xaddr/raddr, forceraddr, validateAddress/Secret, dispaddr
    │   ├── navigation.js       # showTab, blockInput/unblockInput, showSpinner/hideSpinner
    │   ├── clipboard.js        # clipboardCopy, clipboardPaste, scanQR
    │   ├── orderbook.js        # renderOrderbookChart, getExchangeRate, getOrders
    │   └── ui/                 # Per-screen controllers
    │       ├── login.js        # PIN pad, doShowLogin, runPinPad
    │       ├── accounts.js     # Account list, import, delete, nickname, secret reveal
    │       ├── payments.js     # Payment form, confirm, offline code generation
    │       ├── trustlines.js   # Add/modify trustline, confirm
    │       ├── orders.js       # New order, confirm, cancel
    │       ├── flags.js        # Account flags, confirm flags
    │       ├── backup.js       # Export/import wallet, restore, backup reminder
    │       ├── settings.js     # Interface settings, passphrase change, recovery, rekey
    │       └── transactions.js # View transaction, transaction history list
    └── vendor/                 # Existing 3rd-party libs (unchanged, already separate files)
```

> [!IMPORTANT]
> The `controllers/` directory from the previous plan only had 3 files. With 42 screen tabs, 3 controller files would each be 500+ lines and still hard to navigate. The revised `ui/` directory maps closer to actual screen groups.

---

## 2. Phased Execution

### Phase 1: Extract Inline Scripts (Zero Behavioral Change)

**Goal:** Move all `<script>` content out of `index.html` into external `.js` files without changing a single line of logic.

| Step | Action | Output File |
|---|---|---|
| 1a | Extract head shim (L23–54): `blockInput`, `unblockInput`, `window.onerror` | `js/head-shim.js` |
| 1b | Extract config + layout block (L61–392): globals, `showTab`, touch helpers, Electron paylink handler | `js/app-init.js` |
| 1c | Extract main logic block (L1703–8066): all 144 functions | `js/app-logic.js` |
| 1d | Replace inline blocks in `index.html` with `<script src="...">` tags in the same order | — |

**Verification:** App should behave identically. Run in browser/Electron, confirm all tabs navigate, PIN works, connection attempt fires.

> [!WARNING]
> The head shim (`blockInput`/`unblockInput`) is referenced by the error handler which fires during parse. It **must** load synchronously in `<head>`, before `<body>` is parsed. Place it as: `<script src="js/head-shim.js"></script>` inside `<head>`.

---

### Phase 2: Introduce Shared State Object

Replace bare globals with a single namespaced object to make dependencies explicit:

```javascript
// js/state.js
window.AppState = {
    debug: true,
    ontestnet: false,
    offlinemode: false,
    xrpreserve: 20,
    toastepoc: 36225052,
    remote: null,           // xrpl.Client instance
    db: null,               // PouchDB instance
    walletsalt: null,
    accounts: {},
    interface_settings: {
        valuation_counterparty: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
        valuation_currency: 'USD',
        display_xaddresses: false
    },
    serverStack: [],
    defaultServerStack: [/* ... */],
    can_accept_paylink: false,
    paylink_pending: null
};
```

Then do a mechanical find-and-replace across `app-logic.js`:
- `offlinemode` → `AppState.offlinemode`
- `remote.` → `AppState.remote.`
- `db.` → `AppState.db.`
- etc.

> [!TIP]
> This step is purely mechanical and can be partially automated with a script. It makes every cross-module dependency grep-able and eliminates implicit globals.

---

### Phase 3: Extract Leaf Modules (No Cross-Dependencies)

Start with modules that have **zero inbound callers from other modules** — they only call standard APIs:

| Module | Functions | Depends On |
|---|---|---|
| `address.js` | `xaddr`, `raddr`, `isXAddress`, `forceraddrtag`, `forceraddr`, `dispaddr`, `truncaddr`, `validateAddress`, `validateSecret` | `xrpl` (global) |
| `clipboard.js` | `clipboardCopy`, `clipboardPaste` | Cordova/Electron APIs |
| `navigation.js` | `showTab`, `blockInput`, `unblockInput`, `showSpinner`, `hideSpinner`, `selectAccountDetailsSubTab` | jQuery, `AppState` |
| `crypto.js` | `setPin`, `validatePin`, `tohex_chksum`, `fromhex_chksum`, `isvalidhex`, `randShuffleArray` | `sodium`, `AppState.db` |

Each module attaches its exports to `window` (e.g. `window.Address = { xaddr, raddr, ... }`) so existing inline HTML handlers continue to work without changes.

---

### Phase 4: Extract Core Service Modules

| Module | Functions | Depends On |
|---|---|---|
| `db.js` | `getAccounts`, `getAccountInfo`, `getSavedGateways`, `loadSavedInterfaceSettings`, `saveInterfaceSettings`, `validateDataStores` | `AppState.db`, PouchDB |
| `xrpl-client.js` | `connectToRipple`, `injectCompatibilityLayer`, `resetServerStack`, `setRemoteGateway`, `serverCycle`, `doRetryConnection`, `doOfflineMode`, `checkConnection` | `AppState.remote`, `xrpl` |
| `xrpl-tx.js` | `sendPayment`, `sendPaymentOffline`, `sendTrustLineTx`, `sendTrustLineTxOffline`, `sendOfferCreate`, `sendOfferCreateOffline`, `sendOfferCancel`, `sendOfferCancelOffline`, `sendAccountFlagsTx`, `sendAccountFlagsTxOffline`, `submitSignedTransaction` | `xrpl-client.js`, `AppState`, `crypto.js` |

---

### Phase 5: Extract UI Controllers

Each controller file handles a group of related screens. They wire up jQuery event handlers and call into the service modules.

| Controller | Screens Covered | Key Functions |
|---|---|---|
| `ui/login.js` | `#tablogin`, `#tabpinset1`, `#tabpinset2`, `#tablicense` | `doShowLogin`, `runPinPad`, `normalboot`, `recoveryboot` |
| `ui/accounts.js` | `#tabaccounts`, `#tabaccountsecret`, `#tabaccountdelete`, `#tabnickchange`, `#tabaddaccount`, `#tabaddexistingaccount`, `#tabgenaccount` | `importAddress`, `generateAddress`, `doDeleteAccount`, `doRevealRippleSecret`, `changeNickname`, `refreshAccounts`, `doSelectAccount` |
| `ui/payments.js` | `#tabpayments`, `#tabpaymentconfirm`, `#tabgreenqr` | `showPaymentTab`, `doPay`, `confirmPayment`, `populatePaymentTabFromURI`, `checkPayToAddressForCommonErrors` |
| `ui/trustlines.js` | `#tabaddtrustline`, `#tabmodifytrustline`, `#tabtrustlineconfirm` | `doAddTrustline`, `doModifyTrustline`, `doConfirmTrustline`, `refreshTrustlines` |
| `ui/orders.js` | `#tabneworder`, `#taborderconfirm`, `#tabcancelorderconfirm` | `showNewOrder`, `doConfirmOrder`, `doConfirmCancelOrder`, `onToggleNewOrder` |
| `ui/flags.js` | `#tabaccountflags`, `#tabaccountflagsconfirm` | `showAccountFlags`, `doSetAccountFlags`, `doConfirmAccountFlags` |
| `ui/backup.js` | `#tabbackup2`, `#tabrestore`, `#tabrestore2`, `#tabbackupreminder` | `doGenerateBackup`, `exportWallet`, `importWallet`, `doRestoreBackup`, `doRestoreBackupFreshInstall`, `doCheckBackup` |
| `ui/settings.js` | `#tabsettings`, `#tabinterface`, `#tabsetpassphrase`, `#tabchangepassphrase`, `#tabrecovery`, `#tabshowrecovery`, `#tabrekeyaccount` | `showInterfaceTab`, `doResetPassphrase`, `doResetPin`, `setAndShowNewRecoveryPhrase`, `doRekeyAccount` |
| `ui/transactions.js` | `#tabviewtransaction`, `#tabaccountdetails` (transactions sub-tab) | `doViewTransaction`, `doGetTransactions` |

---

### Phase 6: Rebind Inline HTML Handlers → jQuery Delegation

The 42 screen tabs contain ~190 inline `ontouchstart`/`ontouchend` handlers like:
```html
<button ontouchstart="ts(event)" ontouchend="te(event, ()=>{doSomething()})">
```

Refactor these to use delegated jQuery event binding:
```javascript
// In ui/accounts.js
$(document).on('touchend', '#btnaddaccount', function(e) {
    te(e, () => showTab('#tabaddaccount'));
});
```

This decouples HTML from JS function names and allows HTML templates to be extracted cleanly in Phase 7.

> [!CAUTION]
> Do **not** do this in bulk — it is the highest-risk step. Rebind one screen at a time and test thoroughly. Touch event timing bugs (double-tap, ghost clicks) can appear when switching from inline to delegated handlers.

---

### Phase 7: Bundle with Browserify (Extend Existing Toolchain)

The project already uses Browserify in `utils-build/update`. Extend this rather than introducing a new bundler:

```bash
# utils-build/update (revised)
#!/bin/bash
npm run build
npx browserify rippleutils.js -o rippleutils-build.js
cp rippleutils-build.js ../www/js/

# Bundle app modules
npx browserify ../www/js/app.js -o ../www/js/app-bundle.js
```

In `app.js`:
```javascript
require('./state');
require('./modules/address');
require('./modules/clipboard');
require('./modules/navigation');
require('./modules/crypto');
require('./modules/db');
require('./modules/xrpl-client');
require('./modules/xrpl-tx');
require('./modules/orderbook');
require('./ui/login');
// ... etc
```

Final `index.html` script section:
```html
<script src="js/head-shim.js"></script>
<!-- vendor libs -->
<script src="js/jquery-3.7.1.min.js"></script>
<script src="js/pouchdb.min.js"></script>
<script src="js/pouchdb.upsert.min.js"></script>
<script src="cordova.js"></script>
<script src="js/kjua-0.1.1.min.js"></script>
<script src="js/sodium.js"></script>
<script src="js/instascan.min.js"></script>
<script src="js/rippleutils-build.js"></script>
<script src="js/hashicon.js"></script>
<script src="js/select2.js"></script>
<!-- app bundle -->
<script src="js/app-bundle.js"></script>
```

---

### Phase 8 (Optional): Extract HTML Templates

Split the 42 `screentab` divs into individual files under `www/views/`:
```
www/views/
├── login.html
├── accounts.html
├── account-details.html
├── payments.html
├── ...
```

Load at boot using a simple include mechanism:
```javascript
// In app.js boot sequence
const viewFiles = ['login', 'accounts', 'account-details', 'payments', ...];
Promise.all(viewFiles.map(v =>
    fetch(`views/${v}.html`).then(r => r.text())
)).then(htmls => {
    htmls.forEach(html => $('#view-container').append(html));
    // Now bind all event handlers
    initAllControllers();
});
```

> [!NOTE]
> For Cordova `file://` protocol, `fetch` may not work on all platforms. An alternative is to use a build-time HTML include tool (e.g. `html-include` or a simple Node script) to concatenate views into `index.html` at build time, keeping the runtime simple.

---

## 3. Execution Order & Priority

| Priority | Phase | Risk | Effort | Value |
|---|---|---|---|---|
| **P0** | Phase 1: Extract inline scripts | Very Low | 1 hour | Unblocks everything else |
| **P0** | Phase 2: Shared state object | Low | 2–3 hours | Makes dependencies visible |
| **P1** | Phase 3: Leaf modules | Low | 3–4 hours | First real structural win |
| **P1** | Phase 4: Service modules | Medium | 4–6 hours | Isolates core business logic |
| **P2** | Phase 5: UI controllers | Medium | 6–8 hours | Largest code movement |
| **P2** | Phase 7: Browserify bundle | Low | 1–2 hours | Clean single entry point |
| **P3** | Phase 6: Rebind HTML handlers | High | 8–12 hours | Highest risk, do incrementally |
| **P3** | Phase 8: Extract HTML templates | Medium | 4–6 hours | Nice-to-have, not critical |

---

## 4. Verification Strategy

- **After every phase:** Run `test_compat.js` and `test_helpers_validation.js` against the built bundle.
- **Manual smoke test checklist:**
  1. Fresh install → license → passphrase → PIN → recovery phrase → finish setup
  2. Add account (generate new + import existing)
  3. Navigate all primary tabs (Accounts / Send / Settings)
  4. View account details → sub-tabs (Address / DEX / Transactions)
  5. Attempt a payment (confirm screen renders correctly)
  6. Backup → Restore flow
  7. Offline mode toggle
  8. Change PIN, change passphrase

- **Regression guard:** After Phase 1, add a CI step that runs `npx browserify` and checks the exit code. This catches missing `require()` references immediately.
