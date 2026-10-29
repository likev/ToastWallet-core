• Findings

  - High: Trustlines are never rendered after the xrpl.js migration. getTrustlines() returns balance and limit at the top level, but callers require tl.state.balance and
    tl.specification.limit, so every trustline is skipped. See www/js/modules/xrpl-client.js:191, www/js/ui/accounts.js:44, www/js/ui/trustlines.js:13.

  - High: Imported Ed25519 seeds are validated under the correct address, but signing forces secp256k1, producing signatures from the wrong key. See www/js/modules/address.js:69, www/js/ui/
    accounts.js:541, www/js/modules/xrpl-client.js:541. Fix by selecting the algorithm from the seed/keypair instead of hardcoding secp256k1.

  - Medium: Offline offer creation crashes immediately because accSeqId is misspelled; debug is enabled, so the log statement throws before the transaction is built. See www/js/modules/xrpl-
    tx.js:328.

  - Medium: Several gateway retry paths call undefined preparepayment, so reconnect/retry errors turn into runtime crashes. See www/js/modules/xrpl-tx.js:189, www/js/modules/xrpl-tx.js:549,
    www/js/ui/payments.js:559.

  - Medium: isXAddress() always returns true because raddr() catches errors and returns false; payment confirmation then hides destination-tag details for classic addresses. See www/js/
    modules/address.js:8, www/js/modules/address.js:16, www/js/ui/payments.js:197.

  - Medium: Decimal DEX/trustline values are rejected or truncated. The replacement BN only accepts integers, but order amount/price and trustline limits need decimal support. See utils-
    build/rippleutils.js:1, www/js/ui/orders.js:227, www/js/ui/orders.js:247, www/js/ui/trustlines.js:179.

  - Security: The app still has an Electron/XSS-to-code-execution shape: old Electron window defaults, dynamic eval/new Function, and some .html() rendering of user-controlled backup/error
    content. See electron-start.js:55, www/js/modules/navigation.js:282, www/js/app-logic.js:307, www/js/ui/backup.js:87.

  I reviewed the first-party source under www/js, utils-build, and electron-start.js; I treated minified/generated bundles and vendored libraries as build artifacts. Verification run: all
  first-party JS passed node --check, and npm --prefix utils-build run build completed. No test suite is present in the repo.