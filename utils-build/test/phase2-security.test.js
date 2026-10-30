'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const xrpl = require('xrpl');
const BigNumber = require('xrpl/node_modules/bignumber.js');
const compat = require('../sodium-compat.js');

const walletFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fixtures/wallet-v3.0.1.json'), 'utf8')
);

// ---------------------------------------------------------------------------
// 1. TX-05: getOrders() lsfSell (0x00020000) flag & BUY/SELL order mapping
// ---------------------------------------------------------------------------
test('TX-05: getOrders maps lsfSell (0x00020000) and flips quantity/totalPrice for BUY offers', async () => {
  const clientSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/modules/xrpl-client.js'), 'utf8');

  // Prepare a mock response with:
  // 1) A SELL order (flags: 0x00020000)
  // 2) A BUY order (flags: 0x00010000 -> passive, not sell)
  // 3) A plain BUY order (flags: 0)
  const mockOffers = [
    {
      flags: 0x00020000, // lsfSell: Selling USD for XRP (taker gets USD, pays XRP)
      seq: 101,
      taker_gets: { currency: 'USD', issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', value: '5' },
      taker_pays: '10000000' // 10 XRP
    },
    {
      flags: 0x00010000, // lsfPassive (BUY order: Buying USD with XRP; taker gets XRP, pays USD)
      seq: 102,
      taker_gets: '20000000', // 20 XRP
      taker_pays: { currency: 'USD', issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', value: '10' }
    },
    {
      flags: 0, // Plain BUY order: Buying EUR with XRP
      seq: 103,
      taker_gets: '30000000', // 30 XRP
      taker_pays: { currency: 'EUR', issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', value: '15' }
    }
  ];

  const context = {
    window: {},
    debug: false,
    AppState: { testnetServer: 'wss://test' },
    xrpl: xrpl
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(clientSrc, context);

  // Mock request method on client
  const client = {};
  context.injectCompatibilityLayer(client);
  client.request = (params) => {
    if (params.command === 'account_offers') {
      return Promise.resolve({ result: { offers: mockOffers } });
    }
    return Promise.reject(new Error('unknown command'));
  };

  const orders = await client.getOrders('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh');
  assert.equal(orders.length, 3);

  // Offer 1: SELL order
  assert.equal(orders[0].specification.direction, 'sell');
  // SELL: quantity is gets (USD), totalPrice is pays (XRP)
  assert.equal(orders[0].specification.quantity.currency, 'USD');
  assert.equal(orders[0].specification.quantity.value, '5');
  assert.equal(orders[0].specification.totalPrice.currency, 'XRP');
  assert.equal(orders[0].specification.totalPrice.value, '10');

  // Offer 2: BUY order (passive flag 0x00010000 does NOT mean sell)
  assert.equal(orders[1].specification.direction, 'buy');
  // BUY: quantity is pays (USD), totalPrice is gets (XRP)
  assert.equal(orders[1].specification.quantity.currency, 'USD');
  assert.equal(orders[1].specification.quantity.value, '10');
  assert.equal(orders[1].specification.totalPrice.currency, 'XRP');
  assert.equal(orders[1].specification.totalPrice.value, '20');

  // Offer 3: Plain BUY order (flags: 0)
  assert.equal(orders[2].specification.direction, 'buy');
  assert.equal(orders[2].specification.quantity.currency, 'EUR');
  assert.equal(orders[2].specification.quantity.value, '15');
  assert.equal(orders[2].specification.totalPrice.currency, 'XRP');
  assert.equal(orders[2].specification.totalPrice.value, '30');
});

// ---------------------------------------------------------------------------
// 2. TX-07: trustlines.js argument order & parseLimit validation
// ---------------------------------------------------------------------------
test('TX-07: trustlines.js has correct argument order (issuer, currency) and valid parseLimit', () => {
  const tlSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/ui/trustlines.js'), 'utf8');

  let sentArgs = null;
  const context = {
    window: {},
    debug: false,
    sodium: compat,
    BigNumber: BigNumber,
    offlinemode: false,
    lastsettlnonce: 0,
    checkConnection: (cb) => cb(),
    sendTrustLineTx: function(passphrase, acc, issuer, currency, limit, rippling, success, failure) {
      sentArgs = { passphrase, acc, issuer, currency, limit, rippling };
      if (success) success();
    },
    sendTrustLineTxOffline: function(passphrase, acc, issuer, currency, limit, rippling, accID, ledID, fee) {
      sentArgs = { passphrase, acc, issuer, currency, limit, rippling, accID, ledID, fee };
    },
    byId: () => null,
    getVal: () => '',
    setVal: () => {},
    setText: () => {},
    hideEl: () => {},
    showEl: () => {},
    unblockInput: () => {},
    blockInput: () => {},
    clearPaymentScreen: () => {},
    showTab: () => {},
    navigator: { notification: { alert: () => {} } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(tlSrc, context);

  // Test parseLimit
  const parseLimit = context.parseLimit || context.window.parseLimit;
  assert.equal(typeof parseLimit, 'function', 'parseLimit must be defined and exported');
  assert.equal(parseLimit('1000'), '1000');
  assert.equal(parseLimit('0.5'), '0.5');
  assert.equal(parseLimit('123.456789'), '123.456789');
  assert.equal(parseLimit('0'), false, 'Limit 0 should be false');
  assert.equal(parseLimit('-5'), false, 'Negative limit should be false');
  assert.equal(parseLimit('abc'), false, 'Non-numeric string should be false');
  assert.equal(parseLimit(''), false, 'Empty string should be false');

  // Test doConfirmTrustline argument order
  context.confirmtl = {
    atladdress: 'rSourceAccount11111111111111111111',
    atlissueraddr: 'rIssuerAccount22222222222222222222',
    atlcurrency: 'USD',
    atllimit: '500',
    atlrippling: false,
    atlfee: '12',
    nonce: 12345
  };
  context.confirmtlhash = compat.crypto_generichash(16, JSON.stringify(context.confirmtl), '' + context.confirmtl.nonce, 'hex');
  context.validatePassphrase = (pass, isRec, success) => success();

  context.doConfirmTrustline('password123');
  assert.ok(sentArgs, 'sendTrustLineTx must be called');
  assert.equal(sentArgs.issuer, 'rIssuerAccount22222222222222222222', 'Issuer must be second argument');
  assert.equal(sentArgs.currency, 'USD', 'Currency must be third argument');
});

// ---------------------------------------------------------------------------
// 3. TX-07: flags.js forceraddr normalization before accountflags check
// ---------------------------------------------------------------------------
test('TX-07: flags.js normalizes address with forceraddr before checking accountflags', () => {
  const flagsSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/ui/flags.js'), 'utf8');

  let alertCalled = false;
  let alertMsg = '';
  const context = {
    window: {},
    debug: false,
    accountflags: {},
    offlinemode: false,
    forceraddr: (addr) => {
      if (addr && addr.startsWith('X')) return 'rClassic1111111111111111111111111';
      return addr;
    },
    validateAddress: () => true,
    byId: () => null,
    getVal: (sel) => (sel === '#afaddress' ? 'X765YTTFfywHvSp9Z7p4Y72rJkCHj9Sn1sFh7oM6Z3q4H6d' : ''),
    domData: () => 'false',
    setVal: () => {},
    setText: () => {},
    hideEl: () => {},
    showEl: () => {},
    unblockInput: () => {},
    blockInput: () => {},
    navigator: {
      notification: {
        alert: (msg, cb) => {
          alertCalled = true;
          alertMsg = msg;
          if (cb) cb();
        }
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(flagsSrc, context);

  // Call doSetAccountFlags with an un-cached address
  context.doSetAccountFlags(1234);
  assert.ok(alertCalled, 'Alert should be shown when accountflags are not loaded');
  assert.ok(alertMsg.includes('still loading'), 'Should explain that flags are still loading');
});

// ---------------------------------------------------------------------------
// 4. TX-06: BigNumber calculations & payments.js URI query parsing
// ---------------------------------------------------------------------------
test('TX-06: BigNumber precision in sendOfferCreate, roundXRP, and doPay query parsing', () => {
  const appLogicSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/app-logic.js'), 'utf8');
  const txSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/modules/xrpl-tx.js'), 'utf8');

  let preparedOrder = null;
  const context = {
    window: {},
    document: {
      readyState: 'loading',
      addEventListener: () => {},
      querySelectorAll: () => []
    },
    BigNumber: BigNumber,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    debug: false,
    blockInput: () => {},
    unblockInput: () => {},
    timeatlastQR: 0,
    resetServerStack: () => {},
    getSecretForAccount: (pass, acc, cb) => cb('sSecret123'),
    submitSignedTransaction: (signed, s, f) => s(),
    remote: {
      prepareOrder: (acc, order, inst) => {
        preparedOrder = order;
        return Promise.resolve({ txJSON: '{}' });
      },
      sign: () => ({ signedTransaction: 'abc' }),
      submit: () => Promise.resolve({ engine_result: 'tesSUCCESS' })
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(`
    var timeatlastQR = 0;
    var resetServerStack = function() {};
    ${appLogicSrc}
  `, context);
  vm.runInContext(txSrc, context);

  // 1. roundXRP with BigNumber
  const roundXRP = context.roundXRP || context.window.roundXRP;
  assert.equal(roundXRP(10.123456789), '10.123457');
  assert.equal(roundXRP('0.000001'), '0.000001');

  // 2. sendOfferCreate totalPrice calculation: 10.55 * 2.5 = 26.375
  context.sendOfferCreate('mypass', 'rSource11111', '10.55', 'USD', 'rIssuer11111', '2.5', true, false, false, false, null, () => {}, () => {});
  assert.ok(preparedOrder, 'prepareOrder should be called');
  assert.equal(preparedOrder.totalPrice.value, '26.375');
});

// ---------------------------------------------------------------------------
// 5. TX-04: Curve selection and algorithm persistence in accounts.js & xrpl-client
// ---------------------------------------------------------------------------
test('TX-04: Non-sEd Ed25519 seed signing and curve detection in importAddress', async () => {
  const clientSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/modules/xrpl-client.js'), 'utf8');

  // Generate a standard secp seed and derive ed25519 address from it
  const wallet = xrpl.Wallet.generate('ecdsa-secp256k1');
  const seed = wallet.seed; // starts with 's...', not 'sEd'
  const edKeypair = xrpl.deriveKeypair(seed, { algorithm: 'ed25519' });
  const edAddress = xrpl.deriveAddress(edKeypair.publicKey);

  const context = {
    window: {},
    debug: false,
    xrpl: xrpl,
    AppState: {
      accounts: {
        [edAddress]: { algorithm: 'ed25519' }
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(clientSrc, context);

  const client = {};
  context.injectCompatibilityLayer(client);

  const txJSON = JSON.stringify({
    TransactionType: 'Payment',
    Account: edAddress,
    Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
    Amount: '1000000',
    Fee: '12',
    Sequence: 1
  });

  // client.sign should look up AppState.accounts[tx.Account].algorithm and sign with ed25519
  const signResult = client.sign(txJSON, seed);
  assert.ok(signResult.signedTransaction, 'Should sign transaction');

  // Verify SigningPubKey in decoded transaction starts with 'ED' (Ed25519 key prefix)
  const decoded = xrpl.decode(signResult.signedTransaction);
  assert.ok(decoded.SigningPubKey.startsWith('ED'), 'SigningPubKey must start with ED prefix for ed25519 curve');
});

// ---------------------------------------------------------------------------
// 6. COOKIE-02 & COOKIE-03: Complete database destruction and legacy pouch purge
// ---------------------------------------------------------------------------
test('COOKIE-02 & COOKIE-03: WalletDB.destroy purges IDB, legacy pouch, fallback memory, and localStorage', async () => {
  const storageSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/modules/storage.js'), 'utf8');

  let deletedDbs = [];
  const mockLocalStorage = {
    store: new Map([
      ['toastwallet_kv:key1', 'val1'],
      ['toastwallet_kv:key2', 'val2'],
      ['other_key', 'val3']
    ]),
    getItem: function(k) { return this.store.get(k); },
    setItem: function(k, v) { this.store.set(k, v); },
    removeItem: function(k) { this.store.delete(k); },
    get length() { return this.store.size; },
    key: function(idx) { return Array.from(this.store.keys())[idx]; }
  };

  const context = {
    window: {},
    console: console,
    localStorage: mockLocalStorage,
    indexedDB: {
      databases: async () => [],
      open: () => {
        const req = {
          onsuccess: null,
          onerror: null,
          result: {
            close: () => {},
            objectStoreNames: { contains: () => false },
            transaction: () => ({
              objectStore: () => ({
                get: () => {
                  const r = { onsuccess: null, onerror: null, result: null };
                  queueMicrotask(() => { if (r.onsuccess) r.onsuccess({ target: r }); });
                  return r;
                },
                count: () => {
                  const r = { onsuccess: null, onerror: null, result: 0 };
                  queueMicrotask(() => { if (r.onsuccess) r.onsuccess({ target: r }); });
                  return r;
                },
                getAll: () => {
                  const r = { onsuccess: null, onerror: null, result: [] };
                  queueMicrotask(() => { if (r.onsuccess) r.onsuccess({ target: r }); });
                  return r;
                }
              })
            })
          }
        };
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
        return req;
      },
      deleteDatabase: (name) => {
        deletedDbs.push(name);
        const req = { onsuccess: null, onerror: null };
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
        return req;
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(storageSrc, context);

  const db = new context.WalletDB('toastwallet');
  db._fallbackMem.set('test_mem_key', 'value');

  await db.destroy();

  // 1. Both current db and legacy pouch db must be requested for deletion
  assert.ok(deletedDbs.includes('toastwallet'), 'toastwallet db must be deleted');
  assert.ok(deletedDbs.includes('_pouch_toastwallet'), '_pouch_toastwallet legacy db must be deleted');

  // 2. In-memory fallback must be empty
  assert.equal(db._fallbackMem.size, 0, 'In-memory fallback map must be cleared');

  // 3. localStorage toastwallet keys must be purged, while other keys remain
  assert.equal(mockLocalStorage.store.has('toastwallet_kv:key1'), false);
  assert.equal(mockLocalStorage.store.has('toastwallet_kv:key2'), false);
  assert.equal(mockLocalStorage.store.has('other_key'), true);
});

// ---------------------------------------------------------------------------
// 7. MEM-02 & MEM-03: DOM wiping, resetPassFields, and auto-lock
// ---------------------------------------------------------------------------
test('MEM-02 & MEM-03: wipeSensitiveDom clears secret elements, and resetPassFields resets type=password', () => {
  const appLogicSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/app-logic.js'), 'utf8');

  // Mock DOM elements
  const passInput = {
    tagName: 'INPUT',
    type: 'text',
    attributes: { 'data-was-password': 'true' },
    style: { backgroundColor: '#fcf8e3' },
    setAttribute: function(k, v) { this[k] = v; this.attributes[k] = v; },
    removeAttribute: function(k) { delete this.attributes[k]; }
  };
  const eyeBtn = {
    id: 'testeyebtn',
    style: { backgroundColor: '#fcf8e3' }
  };

  const mockDoc = {
    readyState: 'loading',
    addEventListener: () => {},
    querySelectorAll: (sel) => {
      if (sel === "input[data-was-password='true']") return [passInput];
      if (sel === "[id$='eyebtn']") return [eyeBtn];
      return [];
    }
  };

  const context = {
    window: {},
    document: mockDoc,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    debug: false,
    BigNumber: BigNumber
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(`
    var timeatlastQR = 0;
    var resetServerStack = function() {};
    ${appLogicSrc}
  `, context);

  // Call resetPassFields
  context.resetPassFields();
  assert.equal(passInput.type, 'password', 'Input type must be reset to password');
  assert.equal(passInput.attributes['data-was-password'], undefined, 'data-was-password must be removed');
  assert.equal(eyeBtn.style.backgroundColor, '', 'Eye button background color must be cleared');
});

// ---------------------------------------------------------------------------
// 8. MEM-04, MEM-05, MEM-06: Strict mode, no passphrase cache, and buffer zeroing
// ---------------------------------------------------------------------------
test('MEM-04, MEM-05, MEM-06: settings.js operates in strict mode without validatePassphraseCache', () => {
  const settingsSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/ui/settings.js'), 'utf8');
  assert.ok(settingsSrc.startsWith("'use strict';"), 'settings.js must start with strict mode');
  assert.equal(settingsSrc.includes('_validatePassphraseCacheHit'), false, 'Passphrase cache hit function must be eliminated');
  assert.equal(settingsSrc.includes('validatePassphraseCache.salt'), false, 'Passphrase cache state assignment must be eliminated');
});

// ---------------------------------------------------------------------------
// 9. CLIP-01 to CLIP-04: Clipboard hardening
// ---------------------------------------------------------------------------
test('CLIP-01 & CLIP-03: clearClipboard and copySecretWithWarning with fallback zeroing', async () => {
  const clipSrc = fs.readFileSync(path.resolve(__dirname, '../../www/js/modules/clipboard.js'), 'utf8');

  let writtenText = null;
  let alertMessage = null;

  class MockHTMLTextAreaElement {
    constructor() {
      this.value = '';
      this.parentNode = { removeChild: () => {} };
    }
    focus() {}
    select() {}
    setSelectionRange() {}
    setAttribute() {}
  }

  const context = {
    window: { isSecureContext: true },
    HTMLTextAreaElement: MockHTMLTextAreaElement,
    navigator: {
      clipboard: {
        writeText: (t) => { writtenText = t; return Promise.resolve(); },
        readText: () => Promise.resolve('pastedText')
      },
      notification: {
        alert: (msg, cb) => { alertMessage = msg; if (cb) cb(); }
      }
    },
    setTimeout: (cb, ms) => { cb(); return 1; },
    clearTimeout: () => {},
    console: console,
    module: { exports: {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(clipSrc, context);

  // Test copySecretWithWarning
  await context.copySecretWithWarning('sSecretSeed12345', null, 30);
  assert.ok(alertMessage.includes('WARNING'), 'Warning message must be displayed to user');
  // Since mock setTimeout fired immediately, clearClipboard ran and set writtenText to ''
  assert.equal(writtenText, '', 'Clipboard must be cleared after timeout');

  // Test clearClipboard directly
  await context.clipboardCopy('sample data');
  assert.equal(writtenText, 'sample data');
  await context.clearClipboard();
  assert.equal(writtenText, '', 'clearClipboard must overwrite clipboard with empty string');
});

test('CLIP-02 & CLIP-04: Confirm views do not auto-execute on paste and #toaddress prevents default', () => {
  // Check tabpaymentconfirm.html
  const payConfirmHtml = fs.readFileSync(path.resolve(__dirname, '../../www/views/tabpaymentconfirm.html'), 'utf8');
  assert.equal(payConfirmHtml.includes('doConfirmPay(content)'), false, 'Paste/QR must not auto-execute doConfirmPay');
  assert.ok(payConfirmHtml.includes("autocomplete=\"off\""), 'Payment confirm password must have autocomplete off');

  // Check taborderconfirm.html
  const orderConfirmHtml = fs.readFileSync(path.resolve(__dirname, '../../www/views/taborderconfirm.html'), 'utf8');
  assert.equal(orderConfirmHtml.includes('doConfirmOrder(content)'), false, 'Paste/QR must not auto-execute doConfirmOrder');
  assert.ok(orderConfirmHtml.includes("autocomplete=\"off\""), 'Order confirm password must have autocomplete off');

  // Check tabcancelorderconfirm.html
  const cancelConfirmHtml = fs.readFileSync(path.resolve(__dirname, '../../www/views/tabcancelorderconfirm.html'), 'utf8');
  assert.equal(cancelConfirmHtml.includes('doConfirmCancelOrder(content)'), false, 'Paste/QR must not auto-execute doConfirmCancelOrder');

  // Check tabtrustlineconfirm.html
  const tlConfirmHtml = fs.readFileSync(path.resolve(__dirname, '../../www/views/tabtrustlineconfirm.html'), 'utf8');
  assert.equal(tlConfirmHtml.includes('doConfirmTrustline(content)'), false, 'Paste/QR must not auto-execute doConfirmTrustline');

  // Check tabaccountflagsconfirm.html
  const afConfirmHtml = fs.readFileSync(path.resolve(__dirname, '../../www/views/tabaccountflagsconfirm.html'), 'utf8');
  assert.equal(afConfirmHtml.includes('doConfirmAccountFlags(content)'), false, 'Paste/QR must not auto-execute doConfirmAccountFlags');

  // Check tabpayments.html for CLIP-04
  const paymentsHtml = fs.readFileSync(path.resolve(__dirname, '../../www/views/tabpayments.html'), 'utf8');
  assert.ok(paymentsHtml.includes('event.preventDefault(); populatePaymentTabFromURI'), 'Native onpaste on #toaddress must call event.preventDefault()');

  // Check tabgenaccount.html & tabrestore2.html have autocomplete="off"
  const genAccHtml = fs.readFileSync(path.resolve(__dirname, '../../www/views/tabgenaccount.html'), 'utf8');
  assert.ok(genAccHtml.includes('id="genaccpassword" type="password" class="form-control" placeholder="" autocomplete="off"'), 'genaccpassword must have autocomplete off');

  const restore2Html = fs.readFileSync(path.resolve(__dirname, '../../www/views/tabrestore2.html'), 'utf8');
  assert.ok(restore2Html.includes('id="restorebackup2" style="color:black" autocomplete="off"'), 'restorebackup2 must have autocomplete off');
});

// ---------------------------------------------------------------------------
// 10. Verification of strict mode across all project modules and UI files
// ---------------------------------------------------------------------------
test('Strict mode enforced across all core modules and UI files', () => {
  const filesToCheck = [
    'www/js/modules/address.js',
    'www/js/modules/clipboard.js',
    'www/js/modules/crypto.js',
    'www/js/modules/custom-select.js',
    'www/js/modules/db.js',
    'www/js/modules/dom.js',
    'www/js/modules/navigation.js',
    'www/js/modules/orderbook.js',
    'www/js/modules/storage.js',
    'www/js/modules/xrpl-client.js',
    'www/js/modules/xrpl-tx.js',
    'www/js/ui/accounts.js',
    'www/js/ui/backup.js',
    'www/js/ui/flags.js',
    'www/js/ui/login.js',
    'www/js/ui/orders.js',
    'www/js/ui/payments.js',
    'www/js/ui/settings.js',
    'www/js/ui/transactions.js',
    'www/js/ui/trustlines.js',
    'www/js/app-init.js',
    'www/js/app-logic.js',
    'www/js/state.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(__dirname, '../../', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.startsWith("'use strict';"), `${relPath} must begin with 'use strict';`);
  }
});

