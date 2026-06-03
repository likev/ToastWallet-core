# Toast Wallet Core (Modernized)

This repository contains the core HTML5, JavaScript, and CSS codebase of the **Toast Wallet** XRP Ledger wallet app, modernized to use current library structures and clean security patterns.

---

## Key Changes & Modernization

### 1. XRP Ledger Client (`xrpl.js` v4.6.0)
The application has been completely migrated from the deprecated legacy `ripple-lib` library to modern `xrpl.js` (version `4.6.0`). A compatibility layer is injected via `www/js/modules/xrpl-client.js` to translate query and submission formats, keeping core components stable.

### 2. Electron Removal & Hardened Security
All Electron-specific files (`electron-start.js`, `electron_package.json`, etc.) and Electron IPC integrations have been fully removed. This eliminates the Electron XSS-to-RCE security risk surface, allowing the wallet to execute safely as a sandboxed HTML5/Cordova application.

### 3. Cleanup & Fixes (Review 02 Audit)
- **Direct RPC Queries:** Defunct `data.ripple.com` API integrations were replaced with direct, active JSON-RPC requests via the connected Ripple Node WebSocket (`account_tx`, `tx`).
- **Wiped Early Secrets:** Addressed race conditions in multi-flag settings transactions (`xrpl-tx.js`) where private secrets were cleared in memory before recursive asynchronous signing calls finished.
- **Passphrase Cache:** Corrected caching flow in `settings.js` to hash the valid passphrase before it gets cleared from memory.
- **Rename Legacies:** The legacy initialization routine `afterCordovaLoad` was renamed to `initAppUI` to represent its true function of setting up event listeners, viewport styling, and toggle inputs.
- **Decimal Math:** Enabled high-precision orderbook rate math using a globally exposed `BigNumber` library instead of standard float divisions.

---

## Project Structure

```
├── www/                         # Main Web Application folder
│   ├── css/                     # Styling
│   ├── js/                      # Source Code
│   │   ├── modules/             # Core wrapper modules (xrpl-client.js, xrpl-tx.js, db.js, address.js, etc.)
│   │   ├── ui/                  # UI handlers (accounts.js, payments.js, backup.js, settings.js, etc.)
│   │   ├── app.js               # Browserify compilation entry point
│   │   ├── app-init.js          # App lifecycle and global bindings (initAppUI)
│   │   └── app-bundle.js        # Output bundled application
│   ├── views/                   # HTML Template views compiled into index.html
│   └── index.html               # Compiled client template containing all inline views
│
└── utils-build/                 # Build environment
    ├── rippleutils.js           # Core ripple libraries and helper modules browserify entry
    ├── rippleutils-build.js     # Bundled third-party libraries (xrpl.js, BigNumber, etc.)
    ├── build_views.js           # Script compiles views/ into index.html
    └── update                   # Master bash script compiles templates and bundles modules
```

---

## Basic Usage & Compilation

The project uses [Browserify](https://browserify.org/) to bundle local JavaScript modules and assets. Dependencies and compiler scripts are located in `utils-build/`.

### Prerequisites
Ensure [Node.js](https://nodejs.org/) and `npm` are installed.

### 1. Install Dependencies
Change directory to the build folder and install the required npm packages:
```bash
cd utils-build
npm install
```

### 2. Compile Changes & Rebuild App Bundle
Any modification to the files inside `www/js/` (excluding `app-bundle.js`), templates inside `www/views/`, or libraries in `rippleutils.js` requires running the build compilation.

Run the update script inside `utils-build/`:
```bash
bash update
```

This runs the template compiler (`build_views.js`), generates a fresh `www/index.html`, and bundles the app code into `www/js/app-bundle.js`.

### 3. Running Locally
Since Toast Wallet is a static HTML5 app, you can test it locally by serving the `www/` directory using any HTTP server:
```bash
npx serve ../www
```
Or open `www/index.html` directly in a browser.
