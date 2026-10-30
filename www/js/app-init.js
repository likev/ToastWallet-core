'use strict';

var currenttab = "";
var previoustabs = [];
var activeaccount = "";
var accountbalances = {};
var accountbalancestl = {};
var accountflags = {};
var userkey = "";
var screentabpaddingbottom = 0;
var generatedAccount = {};
var confirmtl = {};
var confirmtlhash = "";
var confirmfl = {};
var confirmflhash = "";
var confirmcancelorder = {};
var confirmcancelorderhash = "";
var confirmorder = {};
var confirmorderhash = "";
var confirmpay = {};
var confirmpayhash = "";
var inClickProxy = false;
var paylink_pending = false;
var can_accept_paylink = false;
var timepaused = 0;
var timeatlastQR = 0;
var nativekeyboardvisible = false;
var prekeyboardscrollpos = 0;

function toggle_xr(e, dt, ignoreprefix, qrtoupdate, after) {
    console.log(e);
    if (dt == undefined || typeof(dt) == 'string' && parseInt(dt)+'' != dt.replace(/\s/, '').replace(/\s/g,''))
        dt = false;

    var el = e.srcElement || e.target;
    var src = el;
    var t = el.getElementsByClassName('addrtype')[0];
    if (!t && el.parentElement) t = el.parentElement.getElementsByClassName('addrtype')[0];
    while (el && !el.classList.contains('input-group'))
        el = el.parentElement;
    if (!el || !(el = el.getElementsByTagName('input')[0]) || !t)
        return;
    var val = el.value;
    if (typeof(ignoreprefix) == 'string' && el.value.substr(0, ignoreprefix.length) == ignoreprefix)
        val = el.value.substr(ignoreprefix.length);
    else
        ignoreprefix = '';
    el.value = ignoreprefix + (val.substr(0,1) == 'X' ? 
        (setText(t, 'x'), raddr(val).raddr) : 
        (setText(t, 'r'), xaddr(val, dt)));

    if (qrtoupdate) {
        emptyEl(qrtoupdate);
        appendNode(qrtoupdate, kjua({text: el.value}));
    }
    if (after) after(src, el, val);
}

// update all xr btns to reflect current interface setting
// but if the input box contains the other type of address use that info instead
function reset_xrbtns() {
    var xrbtns = qsa('.xrbtn .addrtype');
    for (var i = 0; i < xrbtns.length; ++i) {
        var el = xrbtns[i];
        while (el && !el.classList.contains('input-group'))
            el = el.parentElement;
        if (!el || !(el = el.getElementsByTagName('input')[0]))
            return;
        var xr = interface_settings.display_xaddresses ? 'r' : 'x';
        var prefix = el.value.length > 0 ? el.value.substr(0,1) : '';
        if (prefix) xr = (prefix == 'X' ? 'r' : 'x');
        xrbtns[i].innerText = xr;
    }
}

function refreshWebView() {}

function renderMoreContentIndicator() {
    if (debug) console.log("renderMoreContentIndicator()");
    if (currenttab == "") return;
    const tabEl = resolveElement(currenttab);
    if (!tabEl) return;
    if (tabEl.scrollHeight - tabEl.scrollTop - tabEl.offsetHeight < 10) {
        hideEl("#morecontentindicator");
    } else {
        if (!nativekeyboardvisible) showEl("#morecontentindicator");
    }
    if (nativekeyboardvisible) hideEl("#morecontentindicator");
}

function quickSelectInput(e) {
    if (e == undefined) return;
    try {
        if (typeof closeAllCustomSelects === 'function') closeAllCustomSelects();
    } catch(err) {}
    if (e && typeof e.focus === 'function') {
        e.focus();
    }
}

function stopClick(e) {
    e.stopPropagation();
    e.preventDefault();
    return false;
}

// this is a function the deep link handlers on android and ios search for
function handleOpenURL(link, e) {                 
    console.log("incoming pay-link: " + link);
    paylink_pending = link;
    addClass('#tablogin>center>div', 'pinpad_pending');
    if (
        currenttab == "#tabpinset1" || 
        currenttab == "#tabpinset2"  || 
        currenttab == "#tabsetpassphrase" || 
        currenttab == "#tabrecovery" || 
        currenttab == "#tabconnectionselect" || 
        currenttab == "#tabbackupreminder" || 
        currenttab == "#tabcorruptionprompt" ||
        currenttab == "#tablicense" ||
        currenttab == "#tabshowrecovery" ||
        currenttab == "#tabqrscan" ||
        currenttab == "#tabsubmitofflinetx" ||
        currenttab == "#tabrestore2" ||
        currenttab == "#tabgreenqr" ) {
        console.log("will not interrupt pin or passphrase or backup prompt, storing pay link"); 
        return;
    }
    
    if (e == 'boot' || !can_accept_paylink || isVisible('#tablogin')) {
        // do nothing 
    } else {
        // wallet is open so go to payment page immediately
        doPayLink();
    }
}

function openExternalUrl(url) {
    try {
        return window.open(url, '_blank');
    } catch (E) {
        console.log(E);
    }
}

// finds the first label above a control, returns the input element if label can't be found
function find_label(ele) {
    var original_ele = ele;
    if (!ele) return ele;
    try {
        var el = (ele.nodeType === 1) ? ele : (ele[0] || resolveElement(ele));
        if (!el) return original_ele;
        if (el.tagName === 'LABEL') return el;
        var cur = el;
        var totaliter = 0;
        while (cur) {
            var prev = cur.previousElementSibling;
            while (prev) {
                if (prev.tagName === 'LABEL') return prev;
                if (totaliter++ > 100) return original_ele;
                prev = prev.previousElementSibling;
            }
            cur = cur.parentElement;
            if (cur && cur.tagName === 'LABEL') return cur;
        }
        return original_ele;
    } catch (E) {
        return original_ele;
    }
}

function initAppUI() {
    if (debug) console.log("initAppUI");
    setText('.deviceversion', navigator.userAgent);
    try {
        if (window.screen && window.screen.orientation && typeof window.screen.orientation.lock === 'function') {
            window.screen.orientation.lock('portrait').catch(function(e) {
                console.log("Screen orientation lock rejected: " + e);
            });
        }
    } catch(e) {
        console.log("Screen orientation lock not supported: " + e);
    }

    qsa(".screentab").forEach(tab => {
        tab.addEventListener('scroll', renderMoreContentIndicator);
    });

    var moreIndicator = byId("morecontentindicator");
    if (moreIndicator) {
        moreIndicator.addEventListener("click", function() {
            if (debug) console.log("onClickMoreContent()");
            if (currenttab == "") return;
            const tabEl = resolveElement(currenttab);
            if (tabEl) {
                tabEl.scrollTo({ top: tabEl.scrollHeight, behavior: 'smooth' });
            }
            renderMoreContentIndicator();
            return false;
        });
        moreIndicator.addEventListener("touchstart", function() {
            if (debug) console.log("onTouchStartMoreContent()");
            if (currenttab == "") return;
            const tabEl = resolveElement(currenttab);
            if (tabEl) {
                tabEl.scrollTo({ top: tabEl.scrollHeight, behavior: 'smooth' });
            }
            renderMoreContentIndicator();
            return false;
        });
    }

    /* This is a visual patch for iOS devices where the phone uses a margin at the top
    ** for various status indicators. 
    */
    console.log("User agent: " + navigator.userAgent);
    if (debug) console.log("initAppUI:2");
    document.addEventListener("pause", function(){
        if (debug) console.log("onPause");
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        if (debug) console.log("onPause - record time");
        timepaused = Date.now();
    }, false);

    document.addEventListener("resume", function() {
        if (debug) console.log("onResume");
           
        if (
            currenttab != "#tabpinset1" && 
            currenttab != "#tabpinset2"  && 
            currenttab != "#tabsetpassphrase" && 
            currenttab != "#tabrecovery" && 
            currenttab != "#tabconnectionselect" && 
            currenttab != "#tabbackupreminder" && 
            currenttab != "#tabcorruptionprompt" &&
            currenttab != "#tablicense" && 
            currenttab != "#tabshowrecovery" &&
            currenttab != "#tabqrscan" &&
            currenttab != "#tabsubmitofflinetx" &&
            currenttab != "#tabrestore2" &&
            currenttab != "#tabgreenqr" &&
            Date.now() - timeatlastQR > 30 /* this fixes a bug with android */
        ) {
            if (Date.now() - timepaused > 30000) {
                unblockInput();
                doShowLogin();
            }
        }
    });

    // Delegate toggle switch interactions
    document.addEventListener('click', function(e) {
        var tgl = e.target.closest('.toggleswitch');
        if (!tgl) return;
        if (debug) console.log("onToggleSwitch()");
        var ele = tgl.children[0];
        if (!ele) return;

        var allowunknown = domData(tgl, 'allowunknown');
        if (hasClass(ele, "unknowntoggle")) {
            removeClass(ele, "unknowntoggle");
            addClass(ele, "fa-toggle-off");
            domData(tgl, "checked", "false");
        } else if (hasClass(ele, "fa-toggle-off")) {
            removeClass(ele, "fa-toggle-off");
            addClass(ele, "fa-toggle-on");
            domData(tgl, "checked", "true");
        } else {
            if (allowunknown == undefined || allowunknown == false) {
                removeClass(ele, "fa-toggle-on");
                addClass(ele, "fa-toggle-off");
                domData(tgl, "checked", "false");
            } else {
                removeClass(ele, "fa-toggle-on");
                addClass(ele, "unknowntoggle");
                domData(tgl, "checked", "unknown");
            }
        }
        var f = domData(tgl, 'after');
        if (f != undefined) {
            if (typeof(f) == "string") {
                var funcName = f.replace(/[\(\);\s]/g, "");
                if (funcName && typeof window[funcName] === "function") {
                    window[funcName]();
                }
            } else if (typeof(f) == "function") {
                f(tgl);
            }
        }
    });

    ['cut', 'copy', 'paste'].forEach(evt => {
        var nh = byId('navheader');
        if (nh) nh.addEventListener(evt, function(e) {
            if (debug) console.log("onHeaderCopyCutPaste()");
            e.preventDefault();
        });
        var nf = byId('navfooter');
        if (nf) nf.addEventListener(evt, function(e) {
            if (debug) console.log("onFooterCopyCutPaste()");
            e.preventDefault();
        });
    });

    if (ontestnet) showEl('#testnetwarning');

    var paylink_handler = function(e, s) {
        var link = s.replace(/^.*?:\/\//g, "");
        handleOpenURL(link, e);
    };

    // since we're booting, if the wallet was started with a pay link we need to process that now
    if (typeof(document.location) == 'object' && typeof(document.location.search) == 'string') {
        console.log("paylink passed on boot: " + document.location.search);
        var pieces = document.location.search.split("?paylink=");
        if (pieces.length > 1) {
            var decodedLink = '';
            try {
                decodedLink = decodeURIComponent(pieces[1].replace(/\s+/g, '').replace(/[0-9a-f]{2}/g, '%$&'));
            } catch (err) {
                for (var i = 0; i < pieces[1].length; i += 2) {
                    decodedLink += String.fromCharCode(parseInt(pieces[1].substr(i, 2), 16));
                }
            }
            paylink_handler("boot", decodedLink);
        }
    }
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.currenttab = currenttab;
    window.previoustabs = previoustabs;
    window.activeaccount = activeaccount;
    window.accountbalances = accountbalances;
    window.accountbalancestl = accountbalancestl;
    window.accountflags = accountflags;
    window.userkey = userkey;
    window.screentabpaddingbottom = screentabpaddingbottom;
    window.generatedAccount = generatedAccount;
    window.confirmtl = confirmtl;
    window.confirmtlhash = confirmtlhash;
    window.confirmfl = confirmfl;
    window.confirmflhash = confirmflhash;
    window.confirmcancelorder = confirmcancelorder;
    window.confirmcancelorderhash = confirmcancelorderhash;
    window.confirmorder = confirmorder;
    window.confirmorderhash = confirmorderhash;
    window.confirmpay = confirmpay;
    window.confirmpayhash = confirmpayhash;
    window.inClickProxy = inClickProxy;
    window.paylink_pending = paylink_pending;
    window.can_accept_paylink = can_accept_paylink;
    window.timepaused = timepaused;
    window.timeatlastQR = timeatlastQR;
    window.nativekeyboardvisible = nativekeyboardvisible;
    window.prekeyboardscrollpos = prekeyboardscrollpos;
    window.toggle_xr = toggle_xr;
    window.reset_xrbtns = reset_xrbtns;
    window.refreshWebView = refreshWebView;
    window.renderMoreContentIndicator = renderMoreContentIndicator;
    window.quickSelectInput = quickSelectInput;
    window.stopClick = stopClick;
    window.handleOpenURL = handleOpenURL;
    window.openExternalUrl = openExternalUrl;
    window.find_label = find_label;
    window.initAppUI = initAppUI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        toggle_xr,
        reset_xrbtns,
        refreshWebView,
        renderMoreContentIndicator,
        quickSelectInput,
        stopClick,
        handleOpenURL,
        openExternalUrl,
        find_label,
        initAppUI
    };
}
