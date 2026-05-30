window.AppState = {
    debug: true,
    ontestnet: false,
    emergencybackup: false,
    offlinemode: false,
    toastepoc: 36225052,
    xrpreserve: 20,
    timepaused: 0,
    paylink_pending: null,
    can_accept_paylink: false,
    interface_settings: {
        valuation_counterparty: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
        valuation_currency: 'USD',
        display_xaddresses: false
    },
    nativekeyboardvisible: false,
    prekeyboardscrollpos: 0,
    scanner: null,
    timeatlastQR: 0,
    trustlinesdropdown: null,
    pinpadvalidate: null,
    enteredpin: "",
    PIN_MAX: null,
    inClickProxy: false,
    currenttab: "",
    previoustabs: [],
    activeaccount: "",
    accountbalances: {},
    accountbalancestl: {},
    accountflags: {},
    userkey: "",
    screentabpaddingbottom: 0,
    generatedAccount: null,
    lasttrustlinenonce: 0,
    confirmtl: null,
    confirmtlhash: null,
    lastsetflagsnonce: 0,
    confirmfl: null,
    confirmflhash: null,
    confirmcancelorder: null,
    confirmcancelorderhash: null,
    lastcancelordernonce: 0,
    confirmorder: null,
    confirmorderhash: null,
    lastordernonce: 0,
    confirmpay: null,
    confirmpayhash: null,
    lastpaidnonce: 0,
    currentServer: null,
    serverStack: [],
    defaultServerStack: [],
    testnetServer: 'wss://s.altnet.rippletest.net:51233',
    remote: null,
    db: null,
    walletsalt: null,
    corruptionstate: null,
    validatePassphraseCache: {},
    accounts: {}
};

// Bind getters and setters on window to redirect accesses to AppState
Object.keys(window.AppState).forEach(function(key) {
    Object.defineProperty(window, key, {
        get: function() {
            return window.AppState[key];
        },
        set: function(val) {
            window.AppState[key] = val;
        },
        configurable: true
    });
});
