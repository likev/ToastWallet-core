# Toast Wallet Core - Index.html Modularization Plan

This document outlines a systematic, step-by-step plan to modularize the monolithic [www/index.html](file:///root/downloads/core/www/index.html) file (which contains ~8,000 lines of mixed HTML, CSS, and inline JavaScript logic) into clean, maintainable, and testable modules.

---

## 1. High-Level Architecture Goal

The target state transforms the monolithic single-file application into a modern modular structure:

```
www/
├── index.html                  # Lightweight skeleton containing base layout & layout containers
├── css/                        # Stylesheets (unmodified)
└── js/
    ├── app-init.js             # Initial state definitions & runtime settings
    ├── modules/
    │   ├── db-service.js       # PouchDB local database storage service
    │   ├── xrpl-service.js     # XRPL client connectivity & API wrappers (compatibility layer)
    │   ├── navigation.js       # Screen routing, page transits, & input block state manager
    │   ├── utils.js            # General helper methods (formatting, QR derivation)
    │   └── controllers/        # View-specific controllers (linking UI triggers to actions)
    │       ├── accounts.js     # Accounts view handlers (nickname, secret view, delete)
    │       ├── transaction.js  # Payments, offline codes, rekeying
    │       └── settings.js     # Settings, flags, backups/restore
    └── app.js                  # Main bundle combining all modules (compiled via build step)
```

---

## 2. Refactoring Phases

### Phase 1: Separate HTML Views & JavaScript Scripts

Currently, `index.html` has two massive `<script>` blocks:
1. **Script Block 1 (Lines 61–392):** Handles layout helper logic, styling swaps, and initial configuration.
2. **Script Block 2 (Lines 1703–8066):** Contains the primary application logic, database bindings, transaction handling, and XRPL wrappers.

**Steps:**
1. Extract Script Block 1 into a new file: `www/js/app-init.js`.
2. Extract Script Block 2 into a new temporary file: `www/js/app-logic.js`.
3. In `www/index.html`, replace both inline blocks with references:
   ```html
   <script src="js/app-init.js"></script>
   <script src="js/app-logic.js"></script>
   ```
4. Verify application behavior to ensure no runtime errors are introduced by the initial separation.

---

### Phase 2: Split JavaScript Logic into Independent Modules

Break down the giant `app-logic.js` (~6,300 lines) into separate functional modules under `www/js/modules/`:

#### 1. `db-service.js` (Database Operations)
* **Responsibility:** Manages all data persistence using `PouchDB` and `pouchdb-upsert`.
* **Functions to extract:** `db.get("accounts")`, `db.upsert`, profile storage/decryption, password validation.

#### 2. `xrpl-service.js` (XRPL Interface)
* **Responsibility:** Manages connection lifecycle to `xrpl.Client` clusters and signs/submits transactions.
* **Functions to extract:** `checkConnection`, `connectremote`, `injectCompatibilityLayer`, transaction preparation wrappers (`preparePayment`, `prepareSettings`, etc.).

#### 3. `navigation.js` (Routing & Layout Control)
* **Responsibility:** Controls tab transits (`screentab` selection) and interface blocking states.
* **Functions to extract:** `showTab`, `blockInput`, `unblockInput`, `displayTabHeader/Footer`.

#### 4. `utils.js` (Helpers & Crypto Validation)
* **Responsibility:** Input parsing, address formats, checksum validation, and QR code rendering.
* **Functions to extract:** `validateAddress`, `validateSecret`, `forceraddr`, `forceraddrtag`, `xaddr`, `raddr`.

#### 5. `controllers/` (UI Event Handlers)
* **Responsibility:** Binds jQuery click/touch handlers to their actions and manages state updates.
* **Modules:**
  * **`accounts.js`**: `importAccount`, `normalImport`, `generateAddress`, nickname changing, account deletion.
  * **`transaction.js`**: `doSendPayment`, `confirmPayment`, `doViewTransaction`, offline code signature generation.
  * **`settings.js`**: `backup`, `restore`, flag updates (`doRekey`, `confirmRekey`).

---

### Phase 3: Setup Bundling & Development Workflow

Since mobile/Cordova platforms load files via local schemas (`file://`), using raw ES6 native modules (`import`/`export`) directly in index.html is discouraged due to CORS constraints on some older webviews.

**Steps:**
1. Initialize a minimal bundler toolchain in `utils-build/package.json` (such as `Vite`, `Webpack`, or adding ESBuild/Browserify compilation support).
2. Refactor modules to use standard `export` / `require` declarations.
3. Configure the build step to bundle and minify all files in `www/js/modules/` into a single `www/js/app.js` file.
4. Replace the separate script tags in `www/index.html` with a single entry point:
   ```html
   <script src="js/app.js"></script>
   ```

---

### Phase 4: Modularize HTML Screen Views (Optional Enhancement)

Currently, all page layouts (`#tabaccounts`, `#tabrestore`, etc.) sit as flat markup siblings within the main body of `index.html`.

**Steps:**
1. Split each major view into its own component file (e.g. `www/components/tabaccounts.html`).
2. Utilize the build bundler or write a simple run-time bootstrap routine to fetch and insert components into `index.html`:
   ```javascript
   $(function() {
       $("#tab-container").load("components/tabaccounts.html", function() {
           // bind events after view injection
       });
   });
   ```
3. This creates a clean `index.html` file that is less than 100 lines long, leaving all presentation structures segregated.

---

## 3. Risk Mitigation & Verification Strategy

* **Namespace Clashes:** Wrap modules in IIFEs or namespace them clearly (e.g. `window.App.Navigation`, `window.App.XRPL`) during migration before transitioning to a module bundler.
* **Offline Functionality:** Ensure no external assets are required, preserving the offline-signing capabilities of the app.
* **Testing:** Run the existing `/scratch/test_compat.js` and `/scratch/test_helpers_validation.js` test suites after every module extraction to catch regression bugs instantly.
