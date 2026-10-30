(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){


function select2EventProxy() {}
function formatSelect2(state) {
    return state ? (state.text || '') : '';
}
// this function fires when an account is selected on the payments tab
// but is only used to supply red qr code in the event the user is in offline mode




function showDonationTab(){
	if (offlinemode || emergencybackup) return;
    showTab('#tabdonate');
	
	remote.getOrderbook(
		"rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", 
		{"base": {"currency":"USD", "counterparty": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"}, 
		"counter": {"currency":"XRP"}},  { limit: 10 }
	).then(orders => {
		var exchangerate = 0;
		var count = 0;
		if (orders && orders.asks) {
			count = Math.min(10, orders.asks.length);
			for (var i = 0; i < count; i++) {
				if (orders.asks[i] && orders.asks[i].properties && orders.asks[i].properties.makerExchangeRate) {
					exchangerate += parseFloat("" + orders.asks[i].properties.makerExchangeRate);
				}
			}
		}
		if (count > 0 && exchangerate > 0) {
			exchangerate = count / exchangerate;
			
			setText("#btndonate20", "Donate $20 (" + (20.0/exchangerate).toFixed(4) + " XRP)");
			setText("#btndonate10", "Donate $10 (" + (10.0/exchangerate).toFixed(4) + " XRP)");
			setText("#btndonate5", "Donate $5 (" + (5.0/exchangerate).toFixed(4) + " XRP)");
			domData("#btndonate20", 'amount', (20.0/exchangerate).toFixed(4));
			domData("#btndonate10", 'amount', (10.0/exchangerate).toFixed(4));
			domData("#btndonate5", 'amount', (5.0/exchangerate).toFixed(4));
		}
	}).catch( function(e) {
			
	});
}
function toggleShowPassField(field, eyebutton) 
{
        if (typeof field === 'string') field = [ field ];
        var firstEl = resolveElement(field[0]);
        var colour = (firstEl && firstEl.getAttribute('type') != 'text') ? '#fcf8e3' : '#fff';
        var eye = resolveElement(eyebutton);
        if (eye) eye.style.backgroundColor = colour;
        
        for (var i = 0; i < field.length; ++i) {
            var el = resolveElement(field[i]);
            if (el) {
                el.setAttribute('type', (colour != '#fff' ? 'text' : 'password'));
                el.style.backgroundColor = colour;
            }
        }
}
function doToggleInvoiceId() {
    toggleEl('#invoiceiddiv');
}
function setToggleSwitch(tgl, checked, aftertglfunc, allowunknown) {
    var tglEl = resolveElement(tgl);
    if (!tglEl) return;
    var ctgl = tglEl.children[0];
    if (ctgl) {
        removeClass(ctgl, 'fa-toggle-on', 'fa-toggle-off', 'unknowntoggle');
        addClass(ctgl, (checked == 'unknown' || checked == undefined ? 'unknowntoggle' : (checked ? 'fa-toggle-on' : 'fa-toggle-off')));
    }
    if (allowunknown != undefined) domData(tglEl, 'allowunknown', allowunknown);
    domData(tglEl, 'checked', '' + (checked == 'unknown' || checked == undefined ? 'unknown' : (checked ? 'true' : 'false')));
    if (aftertglfunc != undefined) {
        domData(tglEl, 'after', aftertglfunc);
    }
}








//this is the draft standard for parsing XRP ledger URIs as per XLS-2d
//https://github.com/xrp-community/standards-drafts
   






//if the address is an x-address, converts to an r-address and uses the dtag in the x-address
//if the address is an r-address and dt is a valid integer returns the same structure populated with these
// return value = { raddr: "rdfasdfa...", tag: false|integer }


// display an address according to the current interface settings



timeatlastQR = 0;
function scanQR(parseContentFunc, after, ...intoFields) {
	if (debug) console.log("scanQR");
	timeatlastQR = Date.now();
	showTab("#tabqrscan", true);
	scanner = new Instascan.Scanner({ video: document.getElementById('qrpreview') });
	scanner.addListener('scan', 
		function (content) {
			parseContentFunc(content, after, ...intoFields);
			showTab(-1, true);
	});
	var err = ()=> {
		navigator.notification.alert("Could not find a camera on your device", 
			function(){
				showTab(-1, true);
			},
			"Error",
			"OK"
		);
	}
	Instascan.Camera.getCameras().then(
		function (cameras) {
			if (cameras.length > 0) {
				scanner.start(cameras[0]);
			} else {
				err();
			}
			}).catch(function (e) {
				err();
			}
		);
}





//todo: consider generalising this function and using it for the above and below

// called from tab







function display_currency_amount(x) {
    if (typeof(x) != "number") {
        console.log("display_currency_amount called on not a number " + x);
        return "(error)";
    }
    if (x > 1) {
        return x.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
    } else {
        return x.toLocaleString(undefined, {minimumSignificantDigits:4, maximumSignificantDigits:4});
    }
}



/** 
  refreshes the trustlines subtab or account details
  */


function doPopulateDonation(amount) {
	clearPaymentScreen();
	setVal('#toaddress', 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y');
	setVal('#payamount', '' + amount);
	showTab('#tabpayments', true); 
	var pa = byId('payamount');
	if (pa) pa.focus();
}




trustlinesdropdown = {};

// decode a payment URI passed to the application from the OS and display payment tab

pinpadvalidate = function(pin) { return false ; }
var pinpadsuccess = function() {}
var pinpadfailure = function() {}

/**
 * NB: The Pin system is really just a courtesy for keeping unwanted 
 * phone users/friends out of your wallet app. It doesn't actually provide
 * very much security. The security of the wallet is provided by the 
 * passphrase/recovery phrase, which are both used to protect the address's
 * secrets.
**/


enteredpin = "";
PIN_MAX = 6;


/* ts and te are functions to handle touchstart and touchend events on active elements
   te in particular ensures that drag-to-scroll gesture does not cause accidental taps */
inClickProxy = false;
function ts(e) {
    if (inClickProxy) return;
}
// executes the function x if the user's finger hasn't moved outside the tolerance range
function te(e, x) {
    if (e != undefined && e.srcElement != undefined && e.srcElement.tagName == "SELECT") {
        // we will let the click propagate through for a select dropdown
        // due to poor support for programmatic select box activation
        return true;
    } 
    
    // stop the event from firing further
    try {
        e.stopPropagation();
        e.preventDefault();
    } catch (E) {}
    if (inClickProxy) {
        x(e.srcElement);
        return false;
    }
    
    if (!e || !e.changedTouches || e.changedTouches.length === 0) {
        if (typeof x === "function") {
            x(e.srcElement || e.target);
        }
        return false;
    }

    if (e.srcElement == document.elementFromPoint(e.changedTouches[0].pageX, e.changedTouches[0].pageY)) {
        if (typeof x === "function")  {
            
            x(e.srcElement);
        } else {
            console.log("warning touchend can't execute func x = " + x);
        }
    }
    
    return false;
}
/* Run this to add a click proxy to all elements so that a browser can use the wallet */
function clickProxy() {}
currenttab = "";
previoustabs = [];
activeaccount = "";
accountbalances = {};
accountbalancestl = {};
accountflags = {};
userkey = ""; // user's sha1 of passphrase used to decrypt wallet secrets
screentabpaddingbottom = 0; // we use this when calcualting keyboard offset

generatedAccount = {};










confirmtl = {};
confirmtlhash = "";



confirmfl = {};
confirmflhash = "";



// adjust the price by 0.1% positively if x > 0, negatively otherwise

confirmcancelorder = {};
confirmcancelorderhash = "";

//(sodium.randombytes_random(), confirmcancelorder={account:\''+account+'\', seq: '+seq+', currency1: \''+currency1+'\', amount1: '+amount1+', currency2: \''+currency2+'\', amount2: '+amount2+', sell: '+(direction == 'sell')+'} )

confirmorder = {};
confirmorderhash = "";




confirmpay = {};
confirmpayhash = "";





currentServer = '';
serverStack = [ 'wss://xrplcluster.com', 'wss://s1.ripple.com', 'wss://s2.ripple.com', 'wss://xrpl.ws' ];
defaultServerStack = [ 'wss://xrplcluster.com', 'wss://s1.ripple.com', 'wss://s2.ripple.com', 'wss://xrpl.ws' ];
testnetServer = 'wss://s.altnet.rippletest.net:51233';


resetServerStack();






// imported from https://toastwallet.com/backupcheck/
function dbgdumpdata() {
	var f = function(x) {console.log(x);}
	
	db.get("pindata").then(function(x){ console.log("pindata: " + x.data);});
	db.get("ppdata").then(function(x){ console.log("ppdata: " + x.data);});
	db.get("rpdata").then(function(x){ console.log("rpdata: " + x.data);});
	db.get("accounts").then(function(x){ console.log("accounts: " + x.data);});
	db.get("savedgateways").then(function(x){ console.log("savedgateways: " + x.data);});
}
/* Generate a checksum and prepend it to data, returns as hex */

/* Remove a checksum from the front of data, check if the data matches 
** return the data if the checksum matches (as uint8array) or false
** if data does not match */


function handle_error(e) {
	console.log("Error: " + e);
	console.log("Stack trace: " + e.stack);
}





;
;
function doDataCorruptionRecovery(c, passphrase, recoveryphrase, passphraseverified, recoveryphraseverified) {
	if (debug) console.log("doDataCorruptionRecovery");
	blockInput();
	var freshinstall = __freshinstall;
	if (passphrase == undefined) passphraseverified = false;
	if (recoveryphrase == undefined) recoveryphraseverified = false;
	if (c.ppdata == 'ok' && passphrase != undefined && passphraseverified == undefined) {
		// validate the passphrase provided
		validatePassphrase(passphrase, false, 
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, true, recoveryphraseverified); },
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, false, recoveryphraseverified); },
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, false, recoveryphraseverified); }
		);
		return;
	} else passphraseverified = false;
	if (c.rpdata == 'ok' && recoveryphrase != undefined && recoveryphraseverified == undefined) {
		// validate the recoveryphrase provided
		validatePassphrase(recoveryphrase, true, 
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, passphraseverified, true); },
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, passphraseverified, false); },
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, passphraseverified, false); }
		);
		return;
	} else recoveryphraseverified = false;
	
	if (c.accounts == 'missing') {
		freshinstall();
		return;
	}
	if (c.accounts == 'corrupt') {
		var i = function(accounts) {
			try {
				accounts = JSON.parse(accounts.data);
				for (i in accounts) {
					var ppok = true;
					var rpok = true;
					if (accounts[i].ppsalt == undefined || (/[^a-fA-F0-9]/.test(accounts[i].ppsalt)) || fromhex_chksum(accounts[i].ppsalt) === false) {
						ppok = false;
					}
					if (accounts[i].rpsalt == undefined || (/[^a-fA-F0-9]/.test(accounts[i].rpsalt)) || fromhex_chksum(accounts[i].rpsalt) === false) {
						rpok = false;
					}
					if (accounts[i].ppsecret == undefined || (/[^a-fA-F0-9]/.test(accounts[i].ppsecret)) || fromhex_chksum(accounts[i].ppsecret) === false) {
						ppok = false;
					}
					if (accounts[i].rpsecret == undefined || (/[^a-fA-F0-9]/.test(accounts[i].rpsecret)) || fromhex_chksum(accounts[i].rpsecret) === false) {
						rpok = false;
					}
					if (rpok && ppok) continue;
					//future version todo: if only rpok or ppok then we can still recover the account potentially
					delete accounts[i];
				}
			} catch(e) { accounts = {} }
			
			navigator.notification.alert("We have attempted recovery on your accounts. You may still need to restore a backup from the settings menu.", 
			function() {
				c.accounts = 'ok';
				db.upsert("accounts", function(doc) { return { data: JSON.stringify(accounts)}; }).then(
					function(x){
						unblockInput(); 
						doDataCorruptionRecovery(c, passphrase, recoveryphrase); 
					}
				).catch(
					function(x){ 
						navigator.notification.alert("Recovery process could not write to your device's storage. Please free up some space or grant the correct permissions and try again.",
						function(){unblockInput();}, "Fatal Error", "OK"
					);
				});
			}, "Recovery", "OK");
		}
		db.get("accounts").then(i).catch(i);
		return;
	}
	if (c.ppdata != 'ok' && c.rpdata != 'ok') {
			/* Originally it was planned that in this scenario the account secrets might be used to recover
			** the passphrase / recoveryphrase data, however this is actually impossible due to the loss of the
			** salts. So in this case the only thing we can do is initiate a fresh install and hope they have a backup. 
			** For the sake of absolute clarity: even if we were to accept a new passphrase and recovery phrase
			** from the user which were identical to the old ones, the salts WOULD NOT BE identical to the old salts
			** and therefore the account data is completely useless. At least one salt from either passphrase or
			** recovery phrase is required to perform a recovery. 
			*/
			unblockInput();
			freshinstall();
			return;
	} else if (c.ppdata == 'ok' && passphraseverified && c.rpdata != 'ok') {
		// issue and set new recovery phrase to the user then proceed to nromal boot
		return setAndShowNewRecoveryPhrase(passphrase);
	} else if (c.rpdata == 'ok' && recoveryphraseverified && c.ppdata != 'ok') {
		// reset the passphrase here then proeceed to a normal boot
		showTab('#tabsettings');
		showTab('#tabchangepassphrase');
		setVal('#setpassword3', recoveryphrase);
		recoveryphrase = "";
		var sp4 = byId('setpassword4');
		if (sp4) sp4.focus();
		navigator.notification.alert("Your recovery phrase appears to be correct. You can recovery your wallet by entering and setting a new passphrase. Please do this immediately on the screen provided.",
			function() {
				unblockInput();
			},
			"Recovery",
			"OK"
		);
		return;
	} else {
		unblockInput();
		freshinstall();
		return;
	}
	if (c.pindata != 'ok') {
		// pin recovery is nice and easy just show the pin recovery tab
		navigator.notification.alert("Your PIN data is corrupt please set a new PIN using your passphrase or recovery phrase.", 
			function(){
				unblockInput(); 
				showTab("#tabrecovery");
			}, 
			"Change PIN", 
			"OK"
		);
		return;
	}
	
}
var app = {
	initialize: function() {
		if (document.readyState === 'complete' || document.readyState === 'interactive') {
			setTimeout(() => this.onDeviceReady(), 1);
		} else {
			document.addEventListener('DOMContentLoaded', () => this.onDeviceReady(), false);
		}
	},
	    // deviceready Event Handler
	    //
	    // The scope of 'this' is the event. In order to call the 'receivedEvent'
	    // function, we must explicitly call 'app.receivedEvent(...);'
onDeviceReady: function() {
			if (debug) console.log("onDeviceReady:1");
		       	db = new WalletDB('toastwallet');
			if (typeof initTouchClickBridge === 'function') initTouchClickBridge();
			setTimeout(initAppUI, 0);
			if (debug) console.log("onDeviceReady:3");
            // change all select boxes to the modern graphical format
            try {
                if (typeof enhanceSelect === 'function') {
                    document.querySelectorAll('select').forEach((el) => enhanceSelect(el));
                }
            } catch(e) {}
			if (false) {
				navigator.notification.alert("Toast Wallet does not work with iOS versions below 11.0. Toast Wallet will now start in offline mode.", 
					()=>{
						hideSpinner();
						doOfflineMode(true);
					},
					"iOS Update Required", 
					"OK"
				);
			} else {
                // grab interface settings
                loadSavedInterfaceSettings()
				// if we have previously saved new / additional gateways we'll try load them now and add them to the gateway list
				getSavedGateways(function(gateways) {
					if (gateways['gateways'] == undefined || ontestnet) gateways['gateways'] = [];
					console.log("Saved gateways " + gateways['gateways']);
					for (var i = 0; i < gateways['gateways'].length; i++) {
						// enforce unique
						var exists = false;
						for (var n = 0; n < serverStack.length; n++) {
							if (serverStack[n] == gateways['gateways'][i]) {
								exists = true;
								break;
							}
						}
						if (!exists) {
							console.log("Adding " + gateways['gateways'][i] + " to server stack");
							serverStack.unshift(gateways['gateways'][i]);
						}
					}
					setRemoteGateway(serverStack[0]);
					// resume booting
					if (emergencybackup) {
						hideSpinner();
						doGenerateBackup();			
					} else {
						/* There is a possibility the datastores were corrupted somehow, and we need
						** to know this before bootstrapping the app. This function call will tell us
						** how to proceed and whether we need to run a recovery.
						*/
						validateDataStores(
							normalboot,
							normalboot,
							recoveryboot
						);
					}
										
				});
			}
	       },
	       // Update DOM on a Received Event
receivedEvent: function(id) {
		       console.log('Received Event: ' + id);
	       }
};
app.initialize();


/* Assumes passphrase has already been validated!!!!*/


/* Passphrase validation is used only to test if a passphrase is correct or incorrect primarily as a guard
** for real encryption/decryption routines running elsewhere. It also provides the ability to reset PIN
** and in general guard against unwanted manipulation of data. To speed up the validation routine the first
** successful validation will cache as a lightweight hash which will thereafter be used for validation.
*/
validatePassphraseCache = {};


/** Updates the ppdata/rpdata key-value store to reflect a new passphrase.
 ** If issettingrecoveryphrase is set then it will write over rpdata.
 ** Oldpassphrase may be either their existing passphrase or the recovery phrase.
 */










// assumes already validated passphrase








/** rounds up an XRP value to the nearest drop to prevent ripplelib complaining about long/irrational xrp fractions */
function roundXRP(x) {
    return (Math.ceil(x * 1000000.0)/1000000.0);
}


////


/* This function actually executes the XRP send on the XRP Ledger. You must ensure the passphrase is valid
** before calling.
*/






},{}],3:[function(require,module,exports){
require('./modules/dom.js');
require('./state.js');
require('./modules/storage.js');
require('./modules/custom-select.js');
require('./modules/address.js');
require('./modules/clipboard.js');
require('./modules/navigation.js');
require('./modules/crypto.js');
require('./modules/db.js');
require('./modules/xrpl-client.js');
require('./modules/xrpl-tx.js');
require('./modules/orderbook.js');
require('./ui/login.js');
require('./ui/accounts.js');
require('./ui/payments.js');
require('./ui/trustlines.js');
require('./ui/orders.js');
require('./ui/flags.js');
require('./ui/backup.js');
require('./ui/settings.js');
require('./ui/transactions.js');
require('./app-init.js');
require('./app-logic.js');

},{"./app-init.js":1,"./app-logic.js":2,"./modules/address.js":4,"./modules/clipboard.js":5,"./modules/crypto.js":6,"./modules/custom-select.js":7,"./modules/db.js":8,"./modules/dom.js":9,"./modules/navigation.js":10,"./modules/orderbook.js":11,"./modules/storage.js":12,"./modules/xrpl-client.js":13,"./modules/xrpl-tx.js":14,"./state.js":15,"./ui/accounts.js":16,"./ui/backup.js":17,"./ui/flags.js":18,"./ui/login.js":19,"./ui/orders.js":20,"./ui/payments.js":21,"./ui/settings.js":22,"./ui/transactions.js":23,"./ui/trustlines.js":24}],4:[function(require,module,exports){
function xaddr(raddr, tag) {
	try {
		return xrpl.classicAddressToXAddress(raddr, tag, false);
	} catch (e) {
		return false;
	}
}
function raddr(xaddr) {
	try {
		var res = xrpl.xAddressToClassicAddress(xaddr);
		return {raddr: res.classicAddress, tag: res.tag};
	} catch (e) {
		return false;
	}
}
function isXAddress(x) {
    try {
        var r = raddr(x)
        return r !== false
    } catch (e) {}
    return false
}
//if the address is an x-address, converts to an r-address and uses the dtag in the x-address
//if the address is an r-address and dt is a valid integer returns the same structure populated with these
// return value = { raddr: "rdfasdfa...", tag: false|integer }
function forceraddrtag(x, dt) {
    if (!x || typeof(x) != 'string') return false
    
    var tag = false
    if (typeof(dt) == 'string') {
        try { 
            var pdt = parseInt(dt + '') 
            tag = ( pdt + '' == (dt + '').trim() ? pdt : false )
        } catch (e) {}
    } else if (typeof(dt) == 'number') {
        tag = dt
    }
    if (tag) tag = Math.round(tag)
    
    if (tag > 0xffffffff || tag < 0) tag = false
    if (xrpl.isValidClassicAddress(x)) return { raddr: x, tag: tag }
    if (x.substr(0,1) == 'X') {
        try {
            var r = raddr(x)
            return (xrpl.isValidClassicAddress(r.raddr) ? r : false)
        } catch (e) {}
    }
    // execution should never reach here
    return false
}
function forceraddr(x) {
    x = forceraddrtag(x)
    if (x && x.raddr) return x.raddr
    return false
}
// display an address according to the current interface settings
function dispaddr(x, dt) {
    if (x.substr(0,1) == 'r' && interface_settings.display_xaddresses) return xaddr(x, (dt == undefined ? false : dt))
    if (x.substr(0,1) == 'X' && !interface_settings.display_xaddresses) return raddr(x).raddr
    return x
}
function truncaddr(x) {
    if (x.length > 33) return x.substr(0, 30) + '...'
    return x
}
function validateAddress(x) {
    return forceraddr(x) !== false
}
function validateSecret(x) {
	try {
		xrpl.deriveAddress(
			xrpl.deriveKeypair(x).publicKey
		); 
	} catch(e) { return false; }
	return true;
}

// Expose functions globally
window.xaddr = xaddr;
window.raddr = raddr;
window.isXAddress = isXAddress;
window.forceraddrtag = forceraddrtag;
window.forceraddr = forceraddr;
window.dispaddr = dispaddr;
window.truncaddr = truncaddr;
window.validateAddress = validateAddress;
window.validateSecret = validateSecret;

},{}],5:[function(require,module,exports){
function fallbackCopyText(text) {
    if (typeof document === 'undefined') return false;
    let textArea;
    let succeeded = false;
    const activeElement = document.activeElement;
    try {
        textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, text.length);
        succeeded = document.execCommand('copy');
    } catch (err) {
        console.warn('fallbackCopyText error:', err);
    } finally {
        if (textArea && textArea.parentNode) {
            textArea.parentNode.removeChild(textArea);
        }
        if (activeElement && typeof activeElement.focus === 'function') {
            activeElement.focus();
        }
    }
    return succeeded;
}

function clipboardCopy(data) {
    const text = String(data ?? '');
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        const isSecure = typeof window !== 'undefined' ? (window.isSecureContext ?? true) : true;
        if (isSecure) {
            return navigator.clipboard.writeText(text).catch(function (err) {
                console.warn('navigator.clipboard.writeText failed, falling back to execCommand:', err);
                fallbackCopyText(text);
            });
        }
    }
    fallbackCopyText(text);
    return Promise.resolve();
}

function clipboardPaste(f) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        return navigator.clipboard.readText()
            .then(function (text) {
                if (typeof f === 'function') {
                    f(text);
                }
            })
            .catch(function (err) {
                console.warn('navigator.clipboard.readText failed or permission denied:', err);
            });
    }
    return Promise.resolve();
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.clipboardCopy = clipboardCopy;
    window.clipboardPaste = clipboardPaste;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { clipboardCopy, clipboardPaste, fallbackCopyText };
}

},{}],6:[function(require,module,exports){
function setPin(pin, successfunc, failfunc) {
    var salt = sodium.randombytes_buf(32);
    var hash = sodium.crypto_pwhash_scryptsalsa208sha256(32, pin, salt, 4, 33554432);
    var pindata = {
            salt: tohex_chksum(salt),
            hash: tohex_chksum(hash)
    };
    db.upsert("pindata",
            function(doc) {
            return { data: JSON.stringify(pindata)}; }).then(
            function(x){
                    successfunc();
            }).catch(function(x){
                    failfunc();
            });
}

function validatePin(pin, successfunc, failfunc, nopinsetfunc) {
    var f = function(pindata) { try {
            if (pindata.data == undefined || pindata.data == "") {
                    // this means the app has never run before.
                    return nopinsetfunc();
            } else {
                    pindata = JSON.parse(pindata.data);
                    var salt = fromhex_chksum(pindata.salt);
                    if (!salt) return failfunc();
                    var hash;
                    if (salt.length === 16) {
                        // Legacy 16-byte-salt SipHash PIN. Verify first, then transparently re-store as 32-byte-salt scrypt.
                        hash = tohex_chksum(sodium.crypto_shorthash(pin, salt));
                        if (hash == pindata.hash) {
                            // Guard against normalboot()'s validatePin("", ...) startup probe.
                            if (pin !== "") {
                                try {
                                    return setPin(pin,
                                        function() {
                                            if (typeof debug !== 'undefined' && debug) console.log("validatePin: upgraded legacy PIN to scrypt");
                                            successfunc();
                                        },
                                        function() {
                                            console.warn("validatePin: legacy PIN upgrade write failed; will retry next unlock");
                                            successfunc();
                                        });
                                } catch (upgradeErr) {
                                    console.warn("validatePin: legacy PIN upgrade threw; will retry next unlock");
                                    return successfunc();
                                }
                            }
                            return successfunc();
                        }
                        return failfunc();
                    } else {
                        var scryptHash = sodium.crypto_pwhash_scryptsalsa208sha256(32, pin, salt, 4, 33554432);
                        hash = tohex_chksum(scryptHash);
                    }
                    if (hash == pindata.hash)
                            return successfunc();
                    return failfunc();
            } } catch(e) { handle_error(e); } };
    db.get("pindata").then(f).catch(f);
}

/* Generate a checksum and prepend it to data, returns as hex */
function tohex_chksum(data) {
	if (typeof data == 'string') data = sodium.from_string(data);
	return sodium.crypto_generichash(4, data, '', 'hex') + sodium.to_hex(data);
}

/* Remove a checksum from the front of data, check if the data matches 
** return the data if the checksum matches (as uint8array) or false
** if data does not match */
function fromhex_chksum(hex, format) {
	var chksum = hex.slice(0,8);
	var payload = sodium.from_hex(hex.slice(8));
	if (sodium.crypto_generichash(4, payload, '', 'hex') != chksum) return false;
	if (format == 'string') return sodium.to_string(payload);
	return payload;
}

function randShuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor((sodium.randombytes_buf(1)[0]/256) * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

// Expose globally
window.setPin = setPin;
window.validatePin = validatePin;
window.tohex_chksum = tohex_chksum;
window.fromhex_chksum = fromhex_chksum;
window.randShuffleArray = randShuffleArray;

},{}],7:[function(require,module,exports){
'use strict';

const enhancedSelects = new Map();

function resolveSelect(target) {
    if (!target) return null;
    if (typeof target === 'string') {
        const sel = target.startsWith('#') || target.startsWith('.') ? target : '#' + target;
        return document.querySelector(sel);
    }
    if (typeof HTMLSelectElement !== 'undefined' && target instanceof HTMLSelectElement) {
        return target;
    }
    if (target.nodeType === 1 && target.tagName === 'SELECT') {
        return target;
    }
    return null;
}

function closeAllCustomSelects() {
    for (const data of enhancedSelects.values()) {
        if (data.container && data.container.classList.contains('cs-open')) {
            data.container.classList.remove('cs-open');
            data.trigger.setAttribute('aria-expanded', 'false');
            if (data.searchInput) {
                data.searchInput.value = '';
                filterOptions(data, '');
            }
        }
    }
}

function renderDefaultOption(opt, selectEl, customRenderer) {
    if (typeof customRenderer === 'function') {
        return customRenderer(opt);
    }
    if ((selectEl && selectEl.id === 'payfromaccount') || (opt.dataset && opt.dataset.account) || opt.getAttribute('data-account')) {
        const acc = opt.getAttribute('data-account') || (opt.dataset && opt.dataset.account) || opt.value;
        const xacc = (typeof window !== 'undefined' && typeof window.xaddr === 'function') ? window.xaddr(acc, false) : acc;
        const span = document.createElement('span');
        span.className = 'accselect2';
        if (typeof window !== 'undefined' && typeof window.hashicon === 'function') {
            const icon = window.hashicon(xacc, 20);
            if (icon) span.appendChild(icon);
        }
        const label = (opt.textContent === acc && typeof window !== 'undefined' && typeof window.dispaddr === 'function')
            ? window.dispaddr(acc)
            : opt.textContent;
        span.appendChild(document.createTextNode((span.childNodes.length > 0 ? ' ' : '') + label));
        return span;
    }
    const span = document.createElement('span');
    span.textContent = opt.textContent;
    return span;
}

function filterOptions(data, query) {
    const q = query.trim().toLowerCase();
    const items = data.optionsList.querySelectorAll('.custom-select-option');
    let hasMatch = false;
    items.forEach((item) => {
        if (item.classList.contains('cs-no-match')) return;
        const text = (item.textContent || '').toLowerCase();
        if (!q || text.includes(q)) {
            item.style.display = '';
            hasMatch = true;
        } else {
            item.style.display = 'none';
        }
    });

    let noMatchEl = data.optionsList.querySelector('.cs-no-match');
    if (!hasMatch) {
        if (!noMatchEl) {
            noMatchEl = document.createElement('li');
            noMatchEl.className = 'custom-select-option cs-no-match';
            noMatchEl.textContent = 'No matches found';
            data.optionsList.appendChild(noMatchEl);
        }
        noMatchEl.style.display = '';
    } else if (noMatchEl) {
        noMatchEl.style.display = 'none';
    }
}

function updateTriggerLabel(data) {
    const selectEl = data.select;
    const selectedOpt = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
    data.labelEl.replaceChildren();
    if (selectedOpt) {
        const rendered = renderDefaultOption(selectedOpt, selectEl, data.opts.renderOption);
        data.labelEl.appendChild(rendered);
    }
}

function buildOptionsList(data) {
    const selectEl = data.select;
    const list = data.optionsList;
    list.replaceChildren();

    Array.from(selectEl.options).forEach((opt, idx) => {
        const li = document.createElement('li');
        li.className = 'custom-select-option';
        li.setAttribute('role', 'option');
        li.setAttribute('data-index', idx);
        li.setAttribute('data-value', opt.value);

        if (idx === selectEl.selectedIndex) {
            li.classList.add('cs-selected');
        }

        const rendered = renderDefaultOption(opt, selectEl, data.opts.renderOption);
        li.appendChild(rendered);

        li.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectEl.value !== opt.value || selectEl.selectedIndex !== idx) {
                selectEl.value = opt.value;
                selectEl.selectedIndex = idx;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            updateTriggerLabel(data);
            closeAllCustomSelects();
        });

        list.appendChild(li);
    });
}

function attachSearchInput(data) {
    if (data.searchInput || !data.dropdown) return;
    const searchBox = document.createElement('div');
    searchBox.className = 'custom-select-search-box';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'custom-select-search-input';
    searchInput.placeholder = 'Search...';
    searchBox.appendChild(searchInput);
    if (data.optionsList && data.optionsList.parentNode === data.dropdown) {
        data.dropdown.insertBefore(searchBox, data.optionsList);
    } else {
        data.dropdown.appendChild(searchBox);
    }
    data.searchInput = searchInput;

    searchInput.addEventListener('input', (e) => {
        filterOptions(data, e.target.value);
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllCustomSelects();
            if (data.trigger) data.trigger.focus();
        }
    });
}

function enhanceSelect(target, opts = {}) {
    if (typeof document === 'undefined') return null;
    const selectEl = resolveSelect(target);
    if (!selectEl) return null;

    if (enhancedSelects.has(selectEl)) {
        refreshSelect(selectEl);
        return selectEl;
    }

    selectEl.classList.add('cs-native-hidden');
    selectEl.setAttribute('tabindex', '-1');

    const container = document.createElement('div');
    container.className = 'custom-select-container';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const labelEl = document.createElement('span');
    labelEl.className = 'custom-select-label';

    const arrowEl = document.createElement('span');
    arrowEl.className = 'custom-select-arrow';

    trigger.appendChild(labelEl);
    trigger.appendChild(arrowEl);

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';

    const optionsList = document.createElement('ul');
    optionsList.className = 'custom-select-options';
    optionsList.setAttribute('role', 'listbox');
    dropdown.appendChild(optionsList);

    container.appendChild(trigger);
    container.appendChild(dropdown);

    const isSearchable = opts.searchable || selectEl.options.length >= 10 || selectEl.id === 'valuationcurrency' || selectEl.id === 'ntloexpiry';

    const data = {
        select: selectEl,
        container,
        trigger,
        labelEl,
        dropdown,
        optionsList,
        searchInput: null,
        opts
    };

    if (isSearchable) {
        attachSearchInput(data);
    }

    enhancedSelects.set(selectEl, data);

    buildOptionsList(data);
    updateTriggerLabel(data);

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = container.classList.contains('cs-open');
        closeAllCustomSelects();
        if (!wasOpen) {
            container.classList.add('cs-open');
            trigger.setAttribute('aria-expanded', 'true');
            if (data.searchInput) {
                setTimeout(() => data.searchInput.focus(), 50);
            }
        }
    });

    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            if (!container.classList.contains('cs-open')) {
                trigger.click();
            }
        } else if (e.key === 'Escape') {
            closeAllCustomSelects();
        }
    });

    const onNativeChange = () => {
        updateTriggerLabel(data);
        const items = optionsList.querySelectorAll('.custom-select-option');
        items.forEach((item, idx) => {
            if (idx === selectEl.selectedIndex) {
                item.classList.add('cs-selected');
            } else {
                item.classList.remove('cs-selected');
            }
        });
    };
    selectEl.addEventListener('change', onNativeChange);
    data._onNativeChange = onNativeChange;

    if (selectEl.parentNode) {
        selectEl.parentNode.insertBefore(container, selectEl.nextSibling);
    }

    return selectEl;
}

function refreshSelect(target) {
    const selectEl = resolveSelect(target);
    if (!selectEl) return;
    const data = enhancedSelects.get(selectEl);
    if (!data) return;

    const shouldSearch = data.opts.searchable || selectEl.options.length >= 10 || selectEl.id === 'valuationcurrency' || selectEl.id === 'ntloexpiry';
    if (shouldSearch && !data.searchInput) {
        attachSearchInput(data);
    }

    buildOptionsList(data);
    updateTriggerLabel(data);
}

function destroySelect(target) {
    const selectEl = resolveSelect(target);
    if (!selectEl) return;
    const data = enhancedSelects.get(selectEl);
    if (!data) return;

    if (data._onNativeChange) {
        selectEl.removeEventListener('change', data._onNativeChange);
    }
    if (data.container && data.container.parentNode) {
        data.container.parentNode.removeChild(data.container);
    }
    selectEl.classList.remove('cs-native-hidden');
    selectEl.removeAttribute('tabindex');

    enhancedSelects.delete(selectEl);
}

function setSelectVisible(target, visible) {
    const selectEl = resolveSelect(target);
    if (!selectEl) return;
    const data = enhancedSelects.get(selectEl);
    if (data && data.container) {
        data.container.style.display = visible ? '' : 'none';
    }
    selectEl.style.display = visible ? '' : 'none';
}

function initGlobalListeners(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d || typeof d.addEventListener !== 'function') return;
    const handleOutside = (e) => {
        if (!e.target || !e.target.closest || !e.target.closest('.custom-select-container')) {
            closeAllCustomSelects();
        }
    };
    d.addEventListener('click', handleOutside);
    d.addEventListener('touchstart', handleOutside, { passive: true });
}

// Global outside click and touch handlers
if (typeof document !== 'undefined') {
    initGlobalListeners(document);
}

// Expose globally
if (typeof window !== 'undefined') {
    window.enhanceSelect = enhanceSelect;
    window.refreshSelect = refreshSelect;
    window.destroySelect = destroySelect;
    window.setSelectVisible = setSelectVisible;
    window.closeAllCustomSelects = closeAllCustomSelects;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        enhanceSelect,
        refreshSelect,
        destroySelect,
        setSelectVisible,
        closeAllCustomSelects,
        renderDefaultOption,
        initGlobalListeners
    };
}

},{}],8:[function(require,module,exports){
function getSavedGateways(callback) {
	var f	= function(savedgateways) { try {
		if (savedgateways.data == undefined) {
			savedgateways = {};
		} else {
			savedgateways = JSON.parse(savedgateways.data);
		}
		callback(savedgateways);
	} catch(e) { handle_error(e); } }
	db.get("savedgateways").then(f).catch(f);
}

function loadSavedInterfaceSettings() {
	var f	= function(saved) { try {
		if (saved.data != undefined) {
			saved = JSON.parse(saved.data);
            interface_settings = saved
		}
	} catch(e) { handle_error(e); } }
	db.get("interfacesettings").then(f).catch(f);
}

function saveInterfaceSettings() {
    db.upsert("interfacesettings",
        function(doc) {
            return { data: JSON.stringify(interface_settings) };
        })
}

function getAccounts(callback) {
	var f	= function(secrets) { try {
		if (secrets.data == undefined) {
			secrets = {};
		} else {
			secrets = JSON.parse(secrets.data);
		}
		callback(secrets);
	} catch(e) { handle_error(e); } }
	db.get("accounts").then(f).catch(f);
}

function getAccountInfo(address, successfunc, failurefunc) {
  address = forceraddr(address)
  if (!validateAddress(address)) return failurefunc();
  var request = {
    command: 'account_info',
    account: address,
    ledger_index: 'validated'
  };
  var timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 500));
  return Promise.race([
    remote.request(request).then(res => res.result),
    timeoutPromise
  ]).then( result=> {
	if (result == undefined) return;
	if ("account_data" in result) {
        // check for trustlines and add as 'trustlines' key if found
        var get_exchange_rates = (address, result) => {
            for (var i in result.account_data['trustlines']) {
                var tl = result.account_data['trustlines'][i];
                if (tl['exchangerate'] != undefined) continue;
                var issuer = tl['specification']['counterparty'];
                var currency = tl['specification']['currency'];
                return getExchangeRate(currency, issuer, (exchangerate, data)=> {
                    data.result.account_data['trustlines'][data.index]['exchangerate'] = exchangerate;
                    return get_exchange_rates(data.address, data.result);
                }, {address: address, result: result, currency: currency, issuer: issuer, index: i} );
            }
            // execution reaching here means all the trustline exchange rates are populated
            return successfunc(result.account_data);
        }
        var t = (address, result)=>{remote.getTrustlines(address).then( 
            (trustlines) => {
                // if trustlines are present on the account attach them to the account data
                result.account_data['trustlines'] = trustlines;
                // then recursively async fetch exchange rates for the trustlines
                return get_exchange_rates(address, result);
            }
        ).catch((E)=>{
                return successfunc(result.account_data);
        });}
        remote.getSettings(address).then(
            (settings)=>{
                result.account_data['flags'] = settings;
                t(address, result);
            }
        ).catch((E)=>{
            return t(address, result);
        });
        
	} else {
		failurefunc();
	}
		  
    }).catch((e)=>{ console.log(e); failurefunc(e)});
}

function validateDataStores(funcok, funcnodata, funcdatacorrupt) {
	var saltlen = 72;
	var hashlen = 40;
	var f = function(pindata) {
		var pindatacorrupt = false;
		var pindatapresent = (pindata.data != undefined && pindata.data != "");
		if (pindatapresent) {
			try {
				pindata = JSON.parse(pindata.data);
				pindatacorrupt = 
					pindata.salt == undefined || (/[^a-fA-F0-9]/.test(pindata.salt)) || fromhex_chksum(pindata.salt) === false ||
					pindata.hash == undefined || (/[^a-fA-F0-9]/.test(pindata.hash)) || fromhex_chksum(pindata.hash) === false ;
			} catch(e) { pindatacorrupt = true; handle_error(e); }
		}
		var g = function(ppdata) {
			var ppdatacorrupt = false;
			var ppdatapresent = (ppdata.data != undefined && ppdata.data != "");
			if (ppdatapresent) {
				try {
					ppdata = JSON.parse(ppdata.data);
					ppdatacorrupt = 
						ppdata.salt1 == undefined || (/[^a-fA-F0-9]/.test(ppdata.salt1)) || fromhex_chksum(ppdata.salt1) === false || ppdata.salt1.length != saltlen ||
						ppdata.salt2 == undefined || (/[^a-fA-F0-9]/.test(ppdata.salt2)) || fromhex_chksum(ppdata.salt2) === false || ppdata.salt2.length != saltlen ||
						ppdata.hash == undefined || (/[^a-fA-F0-9]/.test(ppdata.hash)) || fromhex_chksum(ppdata.hash) === false || ppdata.hash.length != hashlen;
				} catch(e) { ppdatacorrupt = true; handle_error(e); }
			}
			var h = function(rpdata) {
				var rpdatacorrupt = false;
				var rpdatapresent = (rpdata.data != undefined && rpdata.data != "");
				if (rpdatapresent) {
					try {
						rpdata = JSON.parse(rpdata.data);
						rpdatacorrupt = 
							rpdata.salt1 == undefined || (/[^a-fA-F0-9]/.test(rpdata.salt1)) || fromhex_chksum(rpdata.salt1) === false || rpdata.salt1.length != saltlen ||
							rpdata.salt2 == undefined || (/[^a-fA-F0-9]/.test(rpdata.salt2)) || fromhex_chksum(rpdata.salt2) === false || rpdata.salt2.length != saltlen ||
							rpdata.hash == undefined || (/[^a-fA-F0-9]/.test(rpdata.hash)) || fromhex_chksum(rpdata.hash) === false || rpdata.hash.length != hashlen ||
							rpdata.erk == undefined || (/[^a-fA-F0-9]/.test(rpdata.erk)) || fromhex_chksum(rpdata.erk) === false;
					} catch(e) { rpdatacorrupt = true; handle_error(e); }
				}
				var i = function(accounts) {
					var accountscorrupt = false;
					var accountspresent = (accounts.data != undefined && accounts.data != "");
                                        try {
						accounts = JSON.parse(accounts.data);
						for (i in accounts) {
							accountscorrupt = 
							accounts[i].ppsalt == undefined || (/[^a-fA-F0-9]/.test(accounts[i].ppsalt)) || fromhex_chksum(accounts[i].ppsalt) === false || accounts[i].ppsalt.length != saltlen ||
							accounts[i].rpsalt == undefined || (/[^a-fA-F0-9]/.test(accounts[i].rpsalt)) || fromhex_chksum(accounts[i].rpsalt) === false || accounts[i].rpsalt.length != saltlen ||
							accounts[i].ppsecret == undefined || (/[^a-fA-F0-9]/.test(accounts[i].ppsecret)) || fromhex_chksum(accounts[i].ppsecret) === false || 
							accounts[i].rpsecret == undefined || (/[^a-fA-F0-9]/.test(accounts[i].rpsecret)) || fromhex_chksum(accounts[i].rpsecret) === false;
							if (accountscorrupt) break;
						}
                                        } catch(e) { if (accounts.data != "") accountscorrupt = true; handle_error(e); }
					if (pindatapresent && ppdatapresent && rpdatapresent && !pindatacorrupt && !ppdatacorrupt && !rpdatacorrupt && (!accountscorrupt || !accountspresent)) {
						funcok();
					} else if (!pindatapresent && !ppdatapresent && !rpdatapresent && !accountspresent) {
						funcnodata();
					} else {
						funcdatacorrupt( { 
							pindata : ( !pindatapresent ? "missing" : ( pindatacorrupt ? "corrupt" : "ok" ) ),
							ppdata : ( !ppdatapresent ? "missing" : ( ppdatacorrupt ? "corrupt" : "ok" ) ),
							rpdata : ( !rpdatapresent ? "missing" : ( rpdatacorrupt ? "corrupt" : "ok" ) ),
							accounts : ( !accountspresent ? "ok" : ( accountscorrupt ? "corrupt" : "ok" ) ) });
					}
					
				}
				db.get("accounts").then(i).catch(i);
			}
			db.get("rpdata").then(h).catch(h);
		}
		db.get("ppdata").then(g).catch(g);
	}
	db.get("pindata").then(f).catch(f);
}

// Expose functions globally
window.getSavedGateways = getSavedGateways;
window.loadSavedInterfaceSettings = loadSavedInterfaceSettings;
window.saveInterfaceSettings = saveInterfaceSettings;
window.getAccounts = getAccounts;
window.getAccountInfo = getAccountInfo;
window.validateDataStores = validateDataStores;

},{}],9:[function(require,module,exports){
'use strict';

const elementDataMap = new WeakMap();

const defaultDisplayMap = {
    DIV: 'block',
    P: 'block',
    UL: 'block',
    OL: 'block',
    LI: 'list-item',
    TABLE: 'table',
    TR: 'table-row',
    TD: 'table-cell',
    TH: 'table-cell',
    TBODY: 'table-row-group',
    THEAD: 'table-header-group',
    BUTTON: 'inline-block',
    SPAN: 'inline',
    A: 'inline',
    I: 'inline',
    B: 'inline',
    STRONG: 'inline',
    EM: 'inline',
    INPUT: 'inline-block',
    SELECT: 'inline-block',
    TEXTAREA: 'inline-block',
    IMG: 'inline-block',
    LABEL: 'inline'
};

function defaultDisplayForTag(tagName) {
    return defaultDisplayMap[(tagName || '').toUpperCase()] || 'block';
}

function resolveElement(target) {
    if (!target) return null;
    if (typeof target === 'string') {
        if (typeof document === 'undefined') return null;
        if (target.startsWith('#') || target.startsWith('.') || target.includes('[') || target.includes(' ') || target.includes('>')) {
            return document.querySelector(target);
        }
        return document.getElementById(target) || document.querySelector(target);
    }
    if (target.nodeType === 1 || target === document || (typeof window !== 'undefined' && target === window)) {
        return target;
    }
    if (Array.isArray(target) || (typeof NodeList !== 'undefined' && target instanceof NodeList) || (typeof HTMLCollection !== 'undefined' && target instanceof HTMLCollection)) {
        return target.length > 0 ? target[0] : null;
    }
    return null;
}

function resolveElements(target) {
    if (!target) return [];
    if (typeof target === 'string') {
        if (typeof document === 'undefined') return [];
        return Array.from(document.querySelectorAll(target));
    }
    if (target.nodeType === 1) {
        return [target];
    }
    if (Array.isArray(target)) {
        return target.filter((el) => el && el.nodeType === 1);
    }
    if (typeof NodeList !== 'undefined' && target instanceof NodeList) {
        return Array.from(target);
    }
    if (typeof HTMLCollection !== 'undefined' && target instanceof HTMLCollection) {
        return Array.from(target);
    }
    return [];
}

function byId(id) {
    if (!id) return null;
    if (typeof id === 'string') {
        if (typeof document === 'undefined') return null;
        const cleanId = id.startsWith('#') ? id.slice(1) : id;
        return document.getElementById(cleanId);
    }
    if (id && id.nodeType === 1) return id;
    return null;
}

function qs(sel, root = (typeof document !== 'undefined' ? document : null)) {
    if (!sel || !root || typeof root.querySelector !== 'function') return null;
    return root.querySelector(sel);
}

function qsa(sel, root = (typeof document !== 'undefined' ? document : null)) {
    if (!sel || !root || typeof root.querySelectorAll !== 'function') return [];
    return Array.from(root.querySelectorAll(sel));
}

function showEl(target) {
    const els = resolveElements(target);
    for (const el of els) {
        el.style.display = '';
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            try {
                if (window.getComputedStyle(el).display === 'none') {
                    el.style.display = defaultDisplayForTag(el.tagName);
                }
            } catch (e) {
                el.style.display = defaultDisplayForTag(el.tagName);
            }
        } else if (el.style.display === 'none') {
            el.style.display = defaultDisplayForTag(el.tagName);
        }
        if (typeof window !== 'undefined' && typeof window.setSelectVisible === 'function' && el.tagName === 'SELECT') {
            window.setSelectVisible(el, true);
        }
    }
    return target;
}

function hideEl(target) {
    const els = resolveElements(target);
    for (const el of els) {
        el.style.display = 'none';
        if (typeof window !== 'undefined' && typeof window.setSelectVisible === 'function' && el.tagName === 'SELECT') {
            window.setSelectVisible(el, false);
        }
    }
    return target;
}

function toggleEl(target, force) {
    const els = resolveElements(target);
    for (const el of els) {
        const isHidden = !isVisible(el);
        const shouldShow = (typeof force === 'boolean') ? force : isHidden;
        if (shouldShow) {
            showEl(el);
        } else {
            hideEl(el);
        }
    }
    return target;
}

function isVisible(target) {
    const el = resolveElement(target);
    if (!el || el.nodeType !== 1) return false;
    if (el.style && el.style.display === 'none') return false;
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        try {
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        } catch (e) {}
    }
    if (el.offsetWidth !== undefined && el.offsetHeight !== undefined) {
        return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length > 0));
    }
    return true;
}

function getVal(target) {
    const el = resolveElement(target);
    if (!el) return '';
    return (el.value !== undefined) ? el.value : '';
}

function setVal(target, val) {
    const v = (val === null || val === undefined) ? '' : String(val);
    const els = resolveElements(target);
    for (const el of els) {
        el.value = v;
        if (el.tagName === 'SELECT' && typeof window !== 'undefined' && typeof window.refreshSelect === 'function') {
            window.refreshSelect(el);
        }
    }
    return target;
}

function getText(target) {
    const el = resolveElement(target);
    if (!el) return '';
    return el.textContent || '';
}

function setText(target, str) {
    const text = (str === null || str === undefined) ? '' : String(str);
    const els = resolveElements(target);
    for (const el of els) {
        el.textContent = text;
    }
    return target;
}

function getHtml(target) {
    const el = resolveElement(target);
    if (!el) return '';
    return el.innerHTML || '';
}

function setHtml(target, html) {
    const content = (html === null || html === undefined) ? '' : String(html);
    const els = resolveElements(target);
    for (const el of els) {
        el.innerHTML = content;
    }
    return target;
}

function emptyEl(target) {
    const els = resolveElements(target);
    for (const el of els) {
        if (typeof el.replaceChildren === 'function') {
            el.replaceChildren();
        } else {
            el.innerHTML = '';
        }
    }
    return target;
}

function appendHtml(target, html) {
    if (!html) return target;
    const els = resolveElements(target);
    for (const el of els) {
        if (typeof el.insertAdjacentHTML === 'function') {
            el.insertAdjacentHTML('beforeend', html);
        } else {
            el.innerHTML += html;
        }
    }
    return target;
}

function appendNode(target, node) {
    if (!node) return target;
    const el = resolveElement(target);
    if (el && typeof el.appendChild === 'function') {
        el.appendChild(node);
    }
    return target;
}

function addClass(target, ...cls) {
    const valid = cls.filter(Boolean);
    if (valid.length === 0) return target;
    const els = resolveElements(target);
    for (const el of els) {
        if (el.classList) {
            el.classList.add(...valid);
        }
    }
    return target;
}

function removeClass(target, ...cls) {
    const valid = cls.filter(Boolean);
    if (valid.length === 0) return target;
    const els = resolveElements(target);
    for (const el of els) {
        if (el.classList) {
            el.classList.remove(...valid);
        }
    }
    return target;
}

function hasClass(target, cls) {
    const el = resolveElement(target);
    if (!el || !el.classList) return false;
    return el.classList.contains(cls);
}

function getAttr(target, name) {
    const el = resolveElement(target);
    if (!el || typeof el.getAttribute !== 'function') return null;
    return el.getAttribute(name);
}

function setAttr(target, name, val) {
    const els = resolveElements(target);
    for (const el of els) {
        if (typeof el.setAttribute === 'function') {
            el.setAttribute(name, String(val));
        }
    }
    return target;
}

function removeAttr(target, name) {
    const els = resolveElements(target);
    for (const el of els) {
        if (typeof el.removeAttribute === 'function') {
            el.removeAttribute(name);
        }
    }
    return target;
}

function setDisabled(target, disabled) {
    const els = resolveElements(target);
    const bool = !!disabled;
    for (const el of els) {
        el.disabled = bool;
        if (bool) {
            el.setAttribute('disabled', 'disabled');
        } else {
            el.removeAttribute('disabled');
        }
    }
    return target;
}

function toKebabCase(str) {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function coerceDataAttr(val) {
    if (val === null || val === undefined) return undefined;
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null') return null;
    if (val === 'undefined') return undefined;
    if (!isNaN(val) && val.trim() !== '') {
        const num = Number(val);
        if (!isNaN(num)) return num;
    }
    if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
        try {
            return JSON.parse(val);
        } catch (e) {}
    }
    return val;
}

function domData(target, key, val) {
    const el = resolveElement(target);
    if (!el) return undefined;

    let store = elementDataMap.get(el);
    if (!store) {
        store = new Map();
        elementDataMap.set(el, store);
    }

    if (arguments.length >= 3) {
        store.set(key, val);
        return val;
    }

    if (store.has(key)) {
        return store.get(key);
    }

    if (typeof el.getAttribute === 'function') {
        const attrVal = el.getAttribute('data-' + toKebabCase(key));
        if (attrVal !== null) {
            const coerced = coerceDataAttr(attrVal);
            store.set(key, coerced);
            return coerced;
        }
    }
    return undefined;
}

function removeDomData(target, key) {
    const el = resolveElement(target);
    if (!el) return;
    const store = elementDataMap.get(el);
    if (store) {
        if (key) {
            store.delete(key);
        } else {
            elementDataMap.delete(el);
        }
    }
    if (key && typeof el.removeAttribute === 'function') {
        el.removeAttribute('data-' + toKebabCase(key));
    }
}

let lastTouchTime = 0;
let bridgeInitialized = false;

function _resetBridgeForTesting() {
    bridgeInitialized = false;
    lastTouchTime = 0;
}

function initTouchClickBridge() {
    if (bridgeInitialized || typeof document === 'undefined') return;
    bridgeInitialized = true;

    document.addEventListener('touchstart', () => {
        lastTouchTime = Date.now();
    }, { capture: true, passive: true });

    document.addEventListener('touchend', () => {
        lastTouchTime = Date.now();
    }, { capture: true, passive: true });

    document.addEventListener('click', (e) => {
        if (Date.now() - lastTouchTime < 500) return;
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;

        const target = e.target;
        if (!target || !target.closest) return;

        if (target.closest('input, textarea, select, .custom-select-trigger, .custom-select-option, .custom-select-search-input')) {
            return;
        }

        const touchEl = target.closest('[ontouchend], [ontouchstart]');
        if (!touchEl) return;

        const clientX = e.clientX !== undefined ? e.clientX : 0;
        const clientY = e.clientY !== undefined ? e.clientY : 0;
        const pageX = e.pageX !== undefined ? e.pageX : clientX;
        const pageY = e.pageY !== undefined ? e.pageY : clientY;

        if (typeof window !== 'undefined') window.inClickProxy = true;
        try {
            if (touchEl.hasAttribute('ontouchstart')) {
                try {
                    const startEvt = new CustomEvent('touchstart', { bubbles: true, cancelable: true });
                    startEvt.touches = [];
                    startEvt.targetTouches = [];
                    startEvt.changedTouches = [{ clientX, clientY, pageX, pageY }];
                    touchEl.dispatchEvent(startEvt);
                } catch (err) {}
            }

            if (touchEl.hasAttribute('ontouchend')) {
                try {
                    const endEvt = new CustomEvent('touchend', { bubbles: true, cancelable: true });
                    endEvt.touches = [];
                    endEvt.targetTouches = [];
                    endEvt.changedTouches = [{ clientX, clientY, pageX, pageY }];
                    touchEl.dispatchEvent(endEvt);
                } catch (err) {}
            }
        } finally {
            if (typeof window !== 'undefined') window.inClickProxy = false;
        }

        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
    }, { capture: true });
}

// Expose globals for inline templates and global usage
if (typeof window !== 'undefined') {
    window.byId = byId;
    window.qs = qs;
    window.qsa = qsa;
    window.showEl = showEl;
    window.hideEl = hideEl;
    window.toggleEl = toggleEl;
    window.isVisible = isVisible;
    window.getVal = getVal;
    window.setVal = setVal;
    window.getText = getText;
    window.setText = setText;
    window.getHtml = getHtml;
    window.setHtml = setHtml;
    window.emptyEl = emptyEl;
    window.appendHtml = appendHtml;
    window.appendNode = appendNode;
    window.addClass = addClass;
    window.removeClass = removeClass;
    window.hasClass = hasClass;
    window.getAttr = getAttr;
    window.setAttr = setAttr;
    window.removeAttr = removeAttr;
    window.setDisabled = setDisabled;
    window.domData = domData;
    window.removeDomData = removeDomData;
    window.initTouchClickBridge = initTouchClickBridge;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        byId,
        qs,
        qsa,
        showEl,
        hideEl,
        toggleEl,
        isVisible,
        getVal,
        setVal,
        getText,
        setText,
        getHtml,
        setHtml,
        emptyEl,
        appendHtml,
        appendNode,
        addClass,
        removeClass,
        hasClass,
        getAttr,
        setAttr,
        removeAttr,
        setDisabled,
        domData,
        removeDomData,
        initTouchClickBridge,
        _resetBridgeForTesting,
        resolveElement,
        resolveElements
    };
}

},{}],10:[function(require,module,exports){
'use strict';

function selectAccountDetailsSubTab(tabele, subtabname) {
    removeClass('.accdetailsinnertabselected', 'accdetailsinnertabselected');
    addClass(tabele, 'accdetailsinnertabselected');
    if (subtabname == 'address') {
        hideEl('#accdetailstransactiondetails'); 
        hideEl('#accdetailstrustlinedetails'); 
        showEl('#accdetailsaddressdetails');
    } else if (subtabname == 'trustlines') {
        hideEl('#accdetailstransactiondetails'); 
        showEl('#accdetailstrustlinedetails'); 
        hideEl('#accdetailsaddressdetails');
        refreshTrustlines(activeaccount);
    } else if (subtabname == 'transactions') {
        showEl('#accdetailstransactiondetails'); 
        hideEl('#accdetailstrustlinedetails'); 
        hideEl('#accdetailsaddressdetails');
        checkConnection(() => {
            doGetTransactions(domData('#accdetailsaddress', 'content'), '');
            renderMoreContentIndicator();
        });
    }
    renderMoreContentIndicator();
}

function showSpinner(msg) {
    if (debug) console.log("showSpinner");
    addClass("body", "loading");
}

function hideSpinner() {
    if (debug) console.log("hideSpinner");
    removeClass("body", "loading");
}

function showTab(tab, dontClearText) {
    // while a link is pending we will handle it as soon as we can
    if (tab == '#tablogin') {
        // once booting and/or wallet setup has finished we want to start processing paylinks
        can_accept_paylink = true;
        // show the prompt
        if (paylink_pending)
            addClass('#tablogin>center>div', 'pinpad_pending');
    } else if (paylink_pending) { 
        handleOpenURL(paylink_pending);
    }
    
    if (tab == currenttab) return;
    try {
        if (typeof closeAllCustomSelects === 'function') closeAllCustomSelects();
    } catch(e) {}
    if (dontClearText == undefined) dontClearText = false;
    blockInput(true);
    if (debug) console.log("showTab(" + tab + ")");
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    removeClass(".pinpad", "shake");
    enteredpin = "";
    renderEnteredPin();
    
    removeClass("#morecontentindicator", "moreindicatorabovenav");
    removeClass("#morecontentindicator", "moreindicatordark");
    setVal("#accsecret", '');
    domData("#accsecret", 'content', '');
    emptyEl("#accsecretqr");
    hideEl("#accsecret");
    if ( tab == -1 && (
        currenttab == '#tabqrscan' || currenttab == '#taborderconfirm' || 
        currenttab == '#tabneworder' || currenttab == '#tabpaymentconfirm' ||
        currenttab == '#tabtrustlineconfirm'
    )) {
        // if the user has gone for a QR scan we dont want to wipe their form.
        // we also make a special exception allowing a market order to go backward from confirmation
        dontClearText = true;
    }
    if (!dontClearText) {
        setVal("input[type='password']", "");
        setVal("input[type='text']", "");
        setVal("textarea", "");
        emptyEl('#paytabredqr');
        emptyEl('#atltabredqr');
        emptyEl('#mtltabredqr');
        emptyEl('#paytabgreenqr');
        const togglesOn = qsa('.fa-toggle-on');
        for (const tgl of togglesOn) {
            addClass(tgl, 'fa-toggle-off');
            removeClass(tgl, 'fa-toggle-on');
        }
    }
    reset_xrbtns();
    showEl("#navheader");
    
    if (tab == -1) {
        // unwind mode
        if (previoustabs.length == 0) {
            unblockInput();
            return; // cannot unwind so do nothing
        }
        tab = currenttab = previoustabs.pop();
        if (tab == '#tabaccountflags' && validateAddress(getText('#cafaddress'))) {
            showAccountFlags(getText('#cafaddress'), true);
        }
    } else {
        //windup mode
        previoustabs.push(currenttab);
        currenttab = tab;
    }
    if (domData(tab, 'primarytab')) previoustabs = [];
    if (tab != "#tabqrscan" && scanner != undefined) {
        scanner.stop();
    }
    if (tab == "#tabpayments" && !dontClearText) {
        clearPaymentScreen();
    } else if (tab == "#tabaccounts") {
        if (!dontClearText) {
            refreshAccounts(onPaymentSelectFromAccount);	
        }
    } else if (tab == "#tabaccountsecret") {
        showEl("#divrsecaccpassword");
        showEl("#lblacpassword");
        hideEl("#lblaccsecret");
        showEl("#btnrevealsecret");
        showEl("#rsecaccpassword");
        hideEl("#btncopysecret");
        hideEl("#accsecret");
    } else if (tab == '#tabaddtrustline' && offlinemode) {
        var account = domData("#atladdress", 'content');
        emptyEl("#atltabredqr");
        appendNode("#atltabredqr", kjua({text: account, fill:"#ff0000"}));    
        showEl('#atlofflinecodediv');
    } else if (tab == '#tabmodifytrustline' && offlinemode) {
        var account = domData("#mtladdress", 'content');
        emptyEl("#mtltabredqr");
        appendNode("#mtltabredqr", kjua({text: account, fill:"#ff0000"}));    
        showEl('#mtlofflinecodediv');
    } else if (tab == '#tabaccountflags' && offlinemode) {
        var account = domData("#afaddress", 'content');
        emptyEl("#aftabredqr");
        appendNode("#aftabredqr", kjua({text: account, fill:"#ff0000"}));    
        showEl('#afofflinecodediv');
        showEl('#afoflwarningdiv');
    }
    if (tab == '#tabpayments') {
        var to = getVal('#toaddress');
        var toEl = byId('toaddress');
        if (to == 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y') {
            if (toEl) {
                toEl.style.backgroundColor = 'rgba(92, 184, 104, 0.63)';
                toEl.style.color = 'white';
                toEl.setAttribute('readonly', 'readonly');
            }
            setDisabled('.btnqrpay', true);
            removeAttr('.btnqrpay', 'ontouchend');
        } else {
            if (toEl) {
                toEl.style.backgroundColor = '';
                toEl.style.color = '';
                toEl.removeAttribute('readonly');
            }
            setDisabled('.btnqrpay', false);
            setAttr('#btnqrpay1', 'ontouchend', "te(event, ()=>{scanQR((x)=>{populatePaymentTabFromURI(x, '#toaddress')} )})");
            setAttr('#btnqrpay2', 'ontouchend', "te(event, ()=>{clipboardPaste((content)=>{populatePaymentTabFromURI(content, '#toaddress')})})");
        }
    }
    if (tab == '#tabaccounts') {
        var donorreminder = function() {
            getLastDonation(function(donation) {
                if (setupcompletedthissession) return; // no point asking people who just set up the wallet to donate
                if ('lastdonation' in donation && Math.floor(new Date().getTime()/1000) - parseInt(donation['lastdonation']) < 15552000 /* 180 days */) {
                    return;
                }
                if (!('lastreminder' in donation) || Math.floor(new Date().getTime()/1000) - parseInt(donation['lastreminder']) > 604800 /* 1 week */ ) {
                    donation['lastreminder'] = "" + Math.floor(new Date().getTime()/1000);
                    db.upsert("lastdonated", function(doc) {
                        return { data: JSON.stringify(donation) }; 
                    }).then(function() {
                        showDonationTab();
                    });
                }
            });
        };
        getAccounts(function(acc) {
            var acccount = 0;
            for (var i in acc) acccount++;
            if (debug) console.log("number of accounts: " + acccount);
            if (acccount > 0) {
                getLastBackupReminder(function(backupreminder) {
                    if (!('lastreminder' in backupreminder)) {
                        showBackupReminderTab();
                    } else {
                        donorreminder();
                    }
                });
            } else {
                donorreminder();
            }
        });
    }
    hideEl(".screentab");
    try {
        if (typeof enhanceSelect === 'function') {
            document.querySelectorAll(tab + ' select').forEach((el) => enhanceSelect(el));
        }
    } catch(e) {}
    // clean up stray dropdown
    if (offlinemode) {
        try {
            if (typeof destroySelect === 'function') destroySelect('#payasset');
        } catch (e) {}
    }
    showEl(tab);
    if (tab != '#tabaccounts') {
        const tabEl = resolveElement(tab);
        if (tabEl) tabEl.scrollTop = 0;
    }
    const headerLeft = qs('.headerleft');
    if (domData(tab, 'hasback') && previoustabs.length > 0 && 
            !( currenttab == '#tabpayments' && previoustabs.length == 1 && (previoustabs[0] == '#tabaccounts' || previoustabs[0] == '#tabsettings' ) )
    ) {
        console.log("previous tabs: "); console.log(previoustabs);
        if (headerLeft) {
            headerLeft.innerHTML = '<i class="fa fa-chevron-left" aria-hidden="true"></i>';
            headerLeft.onclick = function() { showTab(-1); };
            showEl(headerLeft);
        }
    } else if (headerLeft) {
        emptyEl(headerLeft);
        headerLeft.onclick = null;
    }
    const headerMiddle = qs('.headermiddle');
    if (headerMiddle) {
        const title = domData(tab, 'title');
        if (title) {
            headerMiddle.innerHTML = '<div>' + title + '</div>';
        } else {
            emptyEl(headerMiddle);
        }
    }
    const headerRight = qs('.headerright');
    const headerRightIcon = qs('.headerright>i');
    if (domData(tab, 'recovery')) { // set recovery icon for logged out tabs
        showEl(headerRight);
        hideEl("#navfooter");
        if (headerRightIcon) {
            removeClass(headerRightIcon, "fa-lock");
            addClass(headerRightIcon, "fa-medkit");
        }
        if (headerRight) {
            headerRight.onclick = function(){ showTab("#tabrecovery"); };
        }
    } else if (domData(tab, 'noright')) {
        hideEl(headerRight);
        hideEl("#navfooter");
    } else { // set logout icon for logged in tabs
        showEl(headerRight);
        showEl("#navfooter");
        if (headerRightIcon) {
            removeClass(headerRightIcon, "fa-medkit");
            addClass(headerRightIcon, "fa-lock");
        }
        if (headerRight) {
            headerRight.onclick = function(){ doShowLogin(); };
        }
        addClass("#morecontentindicator", "moreindicatorabovenav");
    }	
    removeClass("body", "darkbackground", "darkbackground2");
    const darkVal = domData(tab, 'dark');
    if (darkVal) { // dark background
        if (darkVal == '2' || darkVal === 2) {
            addClass("body", "darkbackground2");
        } else {
            addClass("body", "darkbackground");
        }
    } else {
        addClass("#morecontentindicator", "moreindicatordark");
    }
    renderMoreContentIndicator();
    // make sure the values of various input boxes are set correctly before displaying
    var inputs = qsa(currenttab + " input");
    for (var i = 0; i < inputs.length; i++) {
        var ele = inputs[i];
        if (!ele) continue;
        var content = domData(ele, 'content');
        var isaddress = domData(ele, 'dispaddr');
        if (content != undefined) ele.value = isaddress ? dispaddr(content) : content;
    }
    
    clickProxy();
    setTimeout(unblockInput, 200);
}

function rebindAllHandlers() {}
function clickProxy() {}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.selectAccountDetailsSubTab = selectAccountDetailsSubTab;
    window.showSpinner = showSpinner;
    window.hideSpinner = hideSpinner;
    window.showTab = showTab;
    window.rebindAllHandlers = rebindAllHandlers;
    window.clickProxy = clickProxy;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        selectAccountDetailsSubTab,
        showSpinner,
        hideSpinner,
        showTab,
        rebindAllHandlers,
        clickProxy
    };
}

},{}],11:[function(require,module,exports){
function renderOrderbookChart(orders, eleid, exchangerate, tlbalance) {
    var o = orders;
    var bids_raw = o.bids;
    var asks_raw = o.asks;
    var bids_unordered = {};
    var asks_unordered = {};
    for (var x in bids_raw) bids_unordered[1.0/parseFloat(""+o.bids[x].properties.makerExchangeRate)] = parseFloat(""+o.bids[x].specification.totalPrice.value);
    for (var x in asks_raw) asks_unordered[parseFloat(""+o.asks[x].properties.makerExchangeRate)] = parseFloat(""+o.asks[x].specification.totalPrice.value);
    var bids = {};
    var asks = {};
    Object.keys(bids_unordered).sort().forEach((key)=>{bids[key] = bids_unordered[key]});
    Object.keys(asks_unordered).sort().forEach((key)=>{asks[key] = asks_unordered[key]});
    // precalculate the sum of horizontal widths and total height of bids and asks
    var bidacc = 0;
    var askacc = 0;
    var range = 0;
    var smallestamount = Number.MAX_SAFE_INTEGER;
    // first the bids (next price - previous price)
    var last = -1;
    for (var x in bids) {
        if (last > -1) {
            range += x - last;
            bidacc += bids[x];
        }
        last = x;
        if (bids[x] < smallestamount) smallestamount = bids[x];
    }
    // calculate center width (first ask - last bid)
    var lastbid = last;
    var firstask = -1;
    for (var x in asks) { firstask = x; break }
    range += firstask - lastbid;
    // finally the asks (next price - previous price)
    last = -1;
    for (var x in asks) {
        if (last > -1) {
            range += x - last;
        }
        askacc += asks[x];
        last = x;
        if (asks[x] < smallestamount) smallestamount = asks[x];
    }
    askacc -= asks[last];
    // turn the range into a percent
    range = 100.00 / range;
    // calculate the vertical range
    var vertrange = 100.00 / (Math.max(askacc, bidacc) - smallestamount);
    // percentage accumulator helps us debug the drawing calculations
    var pcacc = 0;
    var chart = resolveElement(eleid);
    emptyEl(chart);
    // draw bids
    last = -1;
    for (var x in bids) {
        if (last > -1) {
            var width_raw = x - last;
            var height_raw = bidacc - smallestamount;
            var amount = bids[x];
            var pc = width_raw * range;
            pcacc += pc;
            var width = display_currency_amount(pc);
            var height = display_currency_amount( height_raw * vertrange );
            appendHtml(chart, '<span class="chartelegreen" style="width: '+width+'%; height: '+height+'%;"></span>');
            bidacc -= amount;
        }
        last = x;
    }
    // draw gap between bids and asks
    var width_raw = firstask - lastbid;
    var pc = width_raw * range;
    pcacc += pc;
    var hwidth = display_currency_amount(pc);
    appendHtml(chart, '<span class="charteleblank" style="min-width: 1px; min-width: 1px; width: '+hwidth+'%; background: rgba(0,0,0,0); height: 100%;"></span>');
    // draw the asks
    askacc = 0;
    last = -1;
    for (var x in asks) {
        if (last > -1) {
            var width_raw = x - last;
            var amount = asks[last];
            askacc += amount;
            var height_raw = askacc - smallestamount;
            var pc = width_raw * range;
            pcacc += pc;
            var width = display_currency_amount(pc);
            var height = display_currency_amount( height_raw * vertrange );
            
            appendHtml(chart, '<span class="chartelered" style="width: '+width+'%; height: '+height+'%;"></span>');
        }
        last = x;
    }
    lastbid = parseFloat(lastbid + "");
    firstask = parseFloat(firstask + ""); 
    var parent = chart ? chart.parentNode : null;
    if (parent) {
        setHtml(qs(".bidask>.bid", parent), '<span class="currency">XRP</span> ' + ( lastbid == -1 ? 'N/A' : display_currency_amount(lastbid) ));
        setHtml(qs(".bidask>.ask", parent), '<span class="currency">XRP</span> ' + ( firstask == -1 ? 'N/A' : display_currency_amount(firstask) ));
    }
 
    // set these for order creation in the event of an empty book 
    if (lastbid == -1 && firstask == -1) {
        lastbid = 0.000001;
        firstask = 0.000001;
    } else if (lastbid != -1 && firstask == -1) {
        firstask = lastbid;
    } else if (firstask != -1 && lastbid == -1) {
        lastbid = firstask;
    }
    domData(chart, 'bid', display_currency_amount(lastbid));
    domData(chart, 'ask', display_currency_amount(firstask));
    // calculate exchange rate from the data we already have
    var valuationrate = 0;
    var bidcount = 0;
    for (var x in bids) bidcount++;
    for (var x in bids) if (--bidcount < 10) valuationrate += parseFloat(""+x);
    valuationrate /= 10.0;
    
    if (parent) {
        var tlValCurr = qs(".tlvaluation>.currency", parent);
        if (tlValCurr) tlValCurr.innerText = 'USD ' + display_currency_amount(exchangerate * tlbalance * valuationrate);
        showEl(qs(".tlvaluation", parent));
    }
}

function getOrders(account, then, then2) {
    remote.getOrders(account).then( (o) => { then(o, then2); } ).catch( (e)=> { console.log(e); then([], then2); } );
}

function getExchangeRate(currency, counterparty, then, then2) {
    if (currency == "") currency = 'USD'
    if (counterparty == "") counterparty = 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B'
	remote.getOrderbook(
		counterparty, 
		{"base": {"currency":currency, "counterparty": counterparty}, 
		"counter": {"currency":"XRP"}},  { limit: 20 }
	).then(orders => {
        var exchangerate = 0
        var divider = 0
        if (orders.bids.length > 0) {
            exchangerate += parseFloat("" + orders.bids[0].properties.makerExchangeRate)
            divider++
        }
        
        if (orders.asks.length > 0) {
            exchangerate += 1.0/parseFloat("" + orders.asks[0].properties.makerExchangeRate)
            divider++
        }
        if (divider == 0) return then(0, then2)
        return then(exchangerate/divider, then2)
    }).catch( (e)=>{
        console.log(e)
        return then(0, then2);
    });
}

// Expose functions globally
window.renderOrderbookChart = renderOrderbookChart;
window.getOrders = getOrders;
window.getExchangeRate = getExchangeRate;
},{}],12:[function(require,module,exports){
'use strict';

function create404Error(id) {
    const err = new Error('missing');
    err.status = 404;
    err.name = 'not_found';
    err.message = 'missing';
    err.error = true;
    if (id !== undefined) {
        err.id = id;
    }
    return err;
}

class WalletDB {
    constructor(name) {
        this.name = name || 'toastwallet';
        this.dbName = this.name + '_kv';
        this.legacyName = '_pouch_' + this.name;
        this._locks = new Map();
        this._db = null;
        this._useFallback = false;
        this._fallbackMem = new Map();
        this._ready = this._init();
    }

    async _init() {
        if (typeof indexedDB === 'undefined') {
            this._useFallback = true;
            return;
        }

        try {
            this._db = await this._openKVDatabase();
            await this._migrateFromLegacyPouch();
        } catch (err) {
            console.warn('WalletDB: IndexedDB initialization failed, falling back to storage:', err);
            this._useFallback = true;
        }
    }

    _openKVDatabase() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('kv')) {
                    db.createObjectStore('kv', { keyPath: '_id' });
                }
            };
            req.onsuccess = (event) => {
                resolve(event.target.result);
            };
            req.onerror = (event) => {
                reject(event.target.error || new Error('Failed to open IndexedDB'));
            };
        });
    }

    async _migrateFromLegacyPouch() {
        if (!this._db) return;

        // Fast path: check if already migrated or initialized
        const alreadyMigrated = await new Promise((resolve) => {
            try {
                const tx = this._db.transaction(['kv'], 'readonly');
                const store = tx.objectStore('kv');
                const req = store.get('_meta:pouch_migrated');
                req.onsuccess = () => {
                    if (req.result) {
                        resolve(true);
                    } else {
                        // Check if store already contains user data
                        const countReq = store.count ? store.count() : null;
                        if (countReq) {
                            countReq.onsuccess = () => resolve(countReq.result > 0);
                            countReq.onerror = () => resolve(false);
                        } else {
                            resolve(false);
                        }
                    }
                };
                req.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });

        if (alreadyMigrated) {
            return;
        }

        // Probe whether legacy PouchDB database exists
        let legacyDbExists = false;
        if (typeof indexedDB.databases === 'function') {
            try {
                const dbs = await indexedDB.databases();
                legacyDbExists = dbs.some((d) => d.name === this.legacyName);
            } catch (e) {
                legacyDbExists = false;
            }
        } else {
            // For browsers without indexedDB.databases():
            // Open cautiously: if onupgradeneeded fires with oldVersion === 0, abort to avoid creating empty DB
            legacyDbExists = await new Promise((resolve) => {
                let aborted = false;
                try {
                    const req = indexedDB.open(this.legacyName);
                    req.onupgradeneeded = (event) => {
                        if (event.oldVersion === 0) {
                            aborted = true;
                            if (event.target.transaction) {
                                try {
                                    event.target.transaction.abort();
                                } catch (_) {}
                            }
                            resolve(false);
                        }
                    };
                    req.onsuccess = (event) => {
                        const db = event.target.result;
                        db.close();
                        if (aborted) {
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    };
                    req.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }

        if (!legacyDbExists) {
            return;
        }

        // Open legacy database in read-only mode and read active winning documents
        const docsToMigrate = await new Promise((resolve) => {
            let legacyDb;
            try {
                const req = indexedDB.open(this.legacyName);
                req.onsuccess = (event) => {
                    legacyDb = event.target.result;
                    const storeNames = legacyDb.objectStoreNames;
                    if (!storeNames.contains('document-store') || !storeNames.contains('by-sequence')) {
                        legacyDb.close();
                        return resolve([]);
                    }

                    const tx = legacyDb.transaction(['document-store', 'by-sequence'], 'readonly');
                    const docStore = tx.objectStore('document-store');
                    const seqStore = tx.objectStore('by-sequence');
                    const bySeqIndex = seqStore.indexNames && seqStore.indexNames.contains('_doc_id_rev') ? seqStore.index('_doc_id_rev') : null;

                    const allDocsReq = docStore.getAll ? docStore.getAll() : null;

                    const fetchDocPromises = (entries) => {
                        return entries.map((entry) => {
                            return new Promise((resDoc) => {
                                const targetKey = entry.id + '::' + entry.winningRev;
                                const onGotDoc = (doc) => {
                                    if (doc) {
                                        const cleanDoc = { ...doc };
                                        delete cleanDoc._doc_id_rev;
                                        delete cleanDoc._rev;
                                        cleanDoc._id = entry.id;
                                        resDoc(cleanDoc);
                                    } else {
                                        resDoc(null);
                                    }
                                };

                                if (bySeqIndex) {
                                    try {
                                        const r = bySeqIndex.get(targetKey);
                                        r.onsuccess = () => {
                                            if (r.result) return onGotDoc(r.result);
                                            try {
                                                const rSeq = seqStore.get(entry.seq);
                                                rSeq.onsuccess = () => onGotDoc(rSeq.result || null);
                                                rSeq.onerror = () => onGotDoc(null);
                                            } catch (_) { onGotDoc(null); }
                                        };
                                        r.onerror = () => {
                                            try {
                                                const rSeq = seqStore.get(entry.seq);
                                                rSeq.onsuccess = () => onGotDoc(rSeq.result || null);
                                                rSeq.onerror = () => onGotDoc(null);
                                            } catch (_) { onGotDoc(null); }
                                        };
                                    } catch (_) {
                                        try {
                                            const rSeq = seqStore.get(entry.seq);
                                            rSeq.onsuccess = () => onGotDoc(rSeq.result || null);
                                            rSeq.onerror = () => onGotDoc(null);
                                        } catch (_) { onGotDoc(null); }
                                    }
                                } else {
                                    try {
                                        const rSeq = seqStore.get(entry.seq);
                                        rSeq.onsuccess = () => onGotDoc(rSeq.result || null);
                                        rSeq.onerror = () => onGotDoc(null);
                                    } catch (_) { onGotDoc(null); }
                                }
                            });
                        });
                    };

                    if (allDocsReq) {
                        allDocsReq.onsuccess = () => {
                            const entries = (allDocsReq.result || []).filter((e) => e && e.deletedOrLocal !== '1');
                            if (entries.length === 0) {
                                legacyDb.close();
                                return resolve([]);
                            }
                            const promises = fetchDocPromises(entries);
                            Promise.all(promises).then((items) => {
                                legacyDb.close();
                                resolve(items.filter(Boolean));
                            }).catch(() => {
                                legacyDb.close();
                                resolve([]);
                            });
                        };
                        allDocsReq.onerror = () => {
                            legacyDb.close();
                            resolve([]);
                        };
                    } else {
                        // Fallback cursor if getAll is unavailable
                        const entries = [];
                        const cursorReq = docStore.openCursor();
                        cursorReq.onsuccess = (e) => {
                            const cursor = e.target.result;
                            if (cursor) {
                                if (cursor.value && cursor.value.deletedOrLocal !== '1') {
                                    entries.push(cursor.value);
                                }
                                cursor.continue();
                            } else {
                                if (entries.length === 0) {
                                    legacyDb.close();
                                    return resolve([]);
                                }
                                const promises = fetchDocPromises(entries);
                                Promise.all(promises).then((items) => {
                                    legacyDb.close();
                                    resolve(items.filter(Boolean));
                                }).catch(() => {
                                    legacyDb.close();
                                    resolve([]);
                                });
                            }
                        };
                        cursorReq.onerror = () => {
                            legacyDb.close();
                            resolve([]);
                        };
                    }
                };
                req.onerror = () => resolve([]);
            } catch (err) {
                if (legacyDb) {
                    try { legacyDb.close(); } catch (_) {}
                }
                resolve([]);
            }
        });

        // Write migrated documents atomically into "kv"
        if (this._db) {
            await new Promise((resolve, reject) => {
                try {
                    const tx = this._db.transaction(['kv'], 'readwrite');
                    const store = tx.objectStore('kv');
                    for (const doc of docsToMigrate) {
                        store.put(doc);
                    }
                    store.put({
                        _id: '_meta:pouch_migrated',
                        migratedAt: Date.now(),
                        count: docsToMigrate.length
                    });
                    tx.oncomplete = () => resolve();
                    tx.onerror = (e) => reject(e.target.error);
                    tx.onabort = (e) => reject(e.target.error || new Error('Transaction aborted'));
                } catch (e) {
                    reject(e);
                }
            });
        }
    }

    async get(docId) {
        if (typeof docId !== 'string') {
            return Promise.reject(new TypeError('docId must be a string'));
        }
        if (docId === '_meta:pouch_migrated') {
            return Promise.reject(create404Error(docId));
        }

        await this._ready;

        if (this._useFallback || !this._db) {
            return this._getFallback(docId);
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = this._db.transaction(['kv'], 'readonly');
                const store = tx.objectStore('kv');
                const req = store.get(docId);
                req.onsuccess = () => {
                    if (req.result) {
                        const doc = { ...req.result, _id: docId };
                        resolve(doc);
                    } else {
                        reject(create404Error(docId));
                    }
                };
                req.onerror = (e) => {
                    reject(e.target.error || create404Error(docId));
                };
            } catch (e) {
                this._getFallback(docId).then(resolve, reject);
            }
        });
    }

    upsert(docId, diffFn) {
        if (typeof docId !== 'string') {
            return Promise.reject(new TypeError('docId must be a string'));
        }
        if (typeof diffFn !== 'function') {
            return Promise.reject(new TypeError('diffFn must be a function'));
        }

        const prevLock = this._locks.get(docId) || Promise.resolve();
        const currentLock = (async () => {
            try {
                await prevLock;
            } catch (_) {}
            await this._ready;
            return this._doUpsert(docId, diffFn);
        })();

        currentLock.finally(() => {
            if (this._locks.get(docId) === currentLock) {
                this._locks.delete(docId);
            }
        });

        this._locks.set(docId, currentLock);
        return currentLock;
    }

    async _doUpsert(docId, diffFn) {
        let currentDoc = {};
        try {
            currentDoc = await this.get(docId);
        } catch (err) {
            if (err && err.status === 404) {
                currentDoc = {};
            } else {
                throw err;
            }
        }

        const next = await diffFn(currentDoc);
        if (!next) {
            return { updated: false, id: docId };
        }

        const toSave = { ...next, _id: docId };

        if (this._useFallback || !this._db) {
            return this._setFallback(docId, toSave);
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = this._db.transaction(['kv'], 'readwrite');
                const store = tx.objectStore('kv');
                store.put(toSave);
                tx.oncomplete = () => {
                    resolve({ updated: true, id: docId });
                };
                tx.onerror = (e) => {
                    reject(e.target.error || new Error('Upsert write failed'));
                };
                tx.onabort = (e) => {
                    reject(e.target.error || new Error('Upsert transaction aborted'));
                };
            } catch (e) {
                this._setFallback(docId, toSave).then(resolve, reject);
            }
        });
    }

    _getFallback(docId) {
        if (typeof localStorage !== 'undefined') {
            try {
                const key = 'toastwallet_kv:' + this.name + ':' + docId;
                const raw = localStorage.getItem(key);
                if (raw !== null) {
                    return Promise.resolve({ ...JSON.parse(raw), _id: docId });
                }
            } catch (e) {}
        }
        if (this._fallbackMem.has(docId)) {
            return Promise.resolve({ ...this._fallbackMem.get(docId), _id: docId });
        }
        return Promise.reject(create404Error(docId));
    }

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

    close() {
        if (this._db) {
            try {
                this._db.close();
            } catch (_) {}
            this._db = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.WalletDB = WalletDB;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WalletDB, create404Error };
}

},{}],13:[function(require,module,exports){
function setRemoteGateway(server) {
	currentServer = server;
	remote = new xrpl.Client(server, { connectionTimeout: 10000 });
	injectCompatibilityLayer(remote);
}

function resetServerStack() {
	serverStack = [];
    if (ontestnet) {
        serverStack.unshift(testnetServer);
	    setRemoteGateway(serverStack[0]);
        return;
    }
	for (var i = 0; i < defaultServerStack.length; i++) {
		serverStack.unshift(defaultServerStack[i]);
	}
	randShuffleArray(serverStack);
	setRemoteGateway(serverStack[0]);
}

function connectToRipple(funcsuccess, suppressbootsequence) {
	if (debug) console.log("connectToRipple " + currentServer);
	
	remote.connect().then(function() {
			if (debug) console.log("connect success");
			
			setText('.currentgateway', currentServer);
			// check if the user has connected via a custom gateway and add it to our gateway list for next time if they have
			var isDefaultGateway = false;
			for (var i = 0; i < defaultServerStack.length; i++) {
				if (defaultServerStack[i] == currentServer) {
					isDefaultGateway = true;
					break;
				}
			}
			if (!isDefaultGateway) {
				// we are connected to a non default gateway, store it for next time
				getSavedGateways(function(savedgateways) {
					// check if its already stored
					if (savedgateways['gateways'] == undefined) {
						savedgateways['gateways'] = [];
					}
					var exists = false;
					for (var i = 0; i < savedgateways['gateways'].length; i++) {
						if (savedgateways['gateways'][i] == currentServer) {
							exists = true;
							break;
						}
					}
					//  if its not then store it for next time
					if (!exists) {
						savedgateways['gateways'].unshift(currentServer);
						db.upsert("savedgateways",
							function(doc) {
							return { data: JSON.stringify(savedgateways)	}; 
						});					
					}
				});
			}
			remote.getServerInfo().then(info => {
				if (info != undefined && info['validatedLedger'] != undefined && info['validatedLedger']['reserveBaseXRP'] != undefined) 
					xrpreserve = parseInt('' +   info['validatedLedger']['reserveBaseXRP']);
					setText("#minxrp2", "" + xrpreserve);
					setText("#minxrp3", "" + xrpreserve);
			}).catch(e => {
				console.log("xrp reserve request error: " + e);
			});
			if (suppressbootsequence == undefined || !suppressbootsequence) hideSpinner();	
			funcsuccess();
		}).catch(function(e) {
			if (debug) console.log("connect error: " + e);
			
			for (var i = 0; i < serverStack.length; i++) {
				if (serverStack[i] == currentServer && i != serverStack.length-1) {
					// move it along a server
					setRemoteGateway(serverStack[i+1]);
					connectToRipple(funcsuccess);
					return;
				}	
			}
			// out of servers, show the error prompt
			hideSpinner();	
			showTab('#tabconnectionselect');
			return;
		});
}

function doRetryConnection(gateway) {
	if (gateway == undefined) gateway = "";
	gateway = gateway.trim();
	if (gateway == "") {
		// do nothing
	} else if (gateway.indexOf('://') == -1) {
		gateway = 'wss://' + gateway;
	}
	// check if already in the stack
	var exists = false;
	for (var i = 0; i < serverStack.length; i++) {
		if (serverStack[i] == gateway) {
			exists = true;
			break;
		}
	}
	if (gateway != "" && !exists) {
		serverStack.unshift(gateway);
	}
	
	setRemoteGateway(serverStack[0]);
	hideEl('#tabconnectionselect');
	hideEl('#navheader');
	removeClass('body', 'darkbackground');
	currenttab = "";
	showSpinner();
	normalboot();	
}

function doOfflineMode(withboot) {
	offlinemode = true;
	remote = new xrpl.Client("wss://s1.ripple.com");
	injectCompatibilityLayer(remote);
	showEl('#offlinemodewarning');
	if (withboot) normalboot();	
}

function checkConnection(connectedfunc) {
	if (debug) console.log("checkConnection()");
	var isOffline = false;
	if (typeof navigator.onLine !== 'undefined') {
		isOffline = !navigator.onLine;
	}
	if (isOffline) {
		navigator.notification.alert('Internet Connection Lost.', 
			function() {
				hideSpinner();
				unblockInput();
				doShowLogin();
				normalboot();
			},
			'Connection Lost',
			'OK'
		);
	} else {
		if (debug) console.log("checkConnection() -> call connectedfunc()");
		connectedfunc();
	}
}

function serverCycle(doafter, tries, failurefunc) {
    if (tries >= serverStack.length - 1) {
        if (debug) console.log("send failed 3: servercycles expired");
        unblockInput();
        return failurefunc("[No gateways responded. Is your Internet connected?]");
    }
    var serverIndex = 0;
    for (var i = 0; i < serverStack.length; i++) {
        if (serverStack[i] == currentServer) {
            serverIndex = i + 1;
            break;
        }
    }
    serverIndex %= serverStack.length;
    setRemoteGateway(serverStack[serverIndex]);
    connectToRipple(doafter, true); 
}

function injectCompatibilityLayer(client) {
    var parseFlags = (flagsInt) => {
        flagsInt = flagsInt || 0;
        return {
            requireDestinationTag: (flagsInt & 0x00020000) !== 0,
            requireAuthorization: (flagsInt & 0x00040000) !== 0,
            disallowIncomingXRP: (flagsInt & 0x00080000) !== 0,
            disableMasterKey: (flagsInt & 0x00100000) !== 0,
            noFreeze: (flagsInt & 0x00200000) !== 0,
            globalFreeze: (flagsInt & 0x00400000) !== 0,
            defaultRipple: (flagsInt & 0x00800000) !== 0,
            depositAuth: (flagsInt & 0x01000000) !== 0
        };
    };
    client.getSettings = function(address) {
        return client.request({ command: "account_info", account: address }).then(res => {
            var data = res.result.account_data;
            var settings = parseFlags(data.Flags);
            if (data.RegularKey) {
                settings.regularKey = data.RegularKey;
            }
            return settings;
        });
    };
    client.getTrustlines = function(address) {
        return client.request({ command: "account_lines", account: address }).then(res => {
            return (res.result.lines || []).map(line => ({
                specification: {
                    currency: line.currency,
                    counterparty: line.account,
                    limit: line.limit
                },
                state: {
                    balance: line.balance
                }
            }));
        });
    };
    client.getOrders = function(account) {
        var parseAmount = (amt) => {
            if (typeof amt === 'string') {
                return { currency: 'XRP', counterparty: '', value: (parseFloat(amt) / 1000000.0).toString() };
            } else {
                return { currency: amt.currency, counterparty: amt.issuer, value: amt.value };
            }
        };
        return client.request({ command: "account_offers", account: account }).then(res => {
            return (res.result.offers || []).map(offer => {
                var pays = parseAmount(offer.taker_pays);
                var gets = parseAmount(offer.taker_gets);
                var isSell = (offer.flags & 0x00010000) !== 0;
                return {
                    specification: {
                        direction: isSell ? 'sell' : 'buy',
                        quantity: gets,
                        totalPrice: pays
                    },
                    properties: {
                        sequence: offer.seq
                    }
                };
            });
        });
    };
    client.getOrderbook = function(issuer, book, options) {
        var base = book.base;
        var counter = book.counter;
        var limit = (options && options.limit) || 20;
        var formatCurrency = (c) => {
            if (c.currency === 'XRP') {
                return { currency: 'XRP' };
            } else {
                return { currency: c.currency, issuer: c.counterparty || issuer };
            }
        };
        var base_formatted = formatCurrency(base);
        var counter_formatted = formatCurrency(counter);
        var asksPromise = client.request({
            command: "book_offers",
            taker_gets: base_formatted,
            taker_pays: counter_formatted,
            limit: limit
        });
        var bidsPromise = client.request({
            command: "book_offers",
            taker_gets: counter_formatted,
            taker_pays: base_formatted,
            limit: limit
        });
        return Promise.all([asksPromise, bidsPromise]).then(([asksRes, bidsRes]) => {
            var mapOffer = (offer, isAsk) => {
                var BigNumber = window.BigNumber;
                var getsAmount = typeof offer.TakerGets === 'string'
                    ? new BigNumber(offer.TakerGets).dividedBy(1000000)
                    : new BigNumber(offer.TakerGets.value);
                var paysAmount = typeof offer.TakerPays === 'string'
                    ? new BigNumber(offer.TakerPays).dividedBy(1000000)
                    : new BigNumber(offer.TakerPays.value);
                
                var price;
                var quantity;
                var totalPrice;
                if (isAsk) {
                    quantity = getsAmount;
                    totalPrice = paysAmount;
                    price = totalPrice.dividedBy(quantity);
                } else {
                    quantity = paysAmount;
                    totalPrice = getsAmount;
                    price = totalPrice.dividedBy(quantity);
                }
                return {
                    specification: {
                        direction: isAsk ? 'buy' : 'sell',
                        quantity: { value: quantity.toString() },
                        totalPrice: { value: totalPrice.toString() }
                    },
                    properties: {
                        makerExchangeRate: price.toString()
                    }
                };
            };
            var asks = (asksRes.result.offers || []).map(o => mapOffer(o, true));
            var bids = (bidsRes.result.offers || []).map(o => mapOffer(o, false));
            return { asks: asks, bids: bids };
        });
    };
    client.generateAddress = function() {
        var w = xrpl.Wallet.generate("ecdsa-secp256k1");
        return {
            address: w.classicAddress,
            secret: w.seed
        };
    };
    
    client.getLedger = function(opts) {
        return client.request({ command: "ledger", ledger_index: "validated" }).then(res => {
            return {
                ledgerVersion: res.result.ledger_index
            };
        });
    };
    
    client.getAccountInfo = function(account) {
        return client.request({ command: "account_info", account: account }).then(res => {
            return {
                sequence: res.result.account_data.Sequence
            };
        });
    };
    client.getFee = function() {
        return client.request({ command: "fee" }).then(res => {
            var drops = (res.result && res.result.drops && res.result.drops.minimum_fee) || "12";
            var xrp = (parseFloat(drops) / 1000000.0).toString();
            return xrp;
        });
    };
    client.getServerInfo = function() {
        return client.request({ command: "server_info" }).then(res => {
            var base_xrp = 20;
            if (res.result && res.result.info && res.result.info.validated_ledger) {
                base_xrp = res.result.info.validated_ledger.reserve_base_xrp;
            }
            return {
                validatedLedger: {
                    reserveBaseXRP: base_xrp
                }
            };
        });
    };
    var formatOfferAmount = (amt) => {
        if (amt.currency === 'XRP') {
            return xrpl.xrpToDrops(amt.value);
        } else {
            return {
                currency: amt.currency,
                issuer: amt.counterparty || amt.issuer,
                value: amt.value
            };
        }
    };
    client.preparePayment = function(fromacc, payment, instructions) {
        var tx = {
            TransactionType: "Payment",
            Account: fromacc,
            Destination: payment.destination.address,
            Amount: payment.destination.amount.currency === 'XRP' 
                    ? xrpl.xrpToDrops(payment.destination.amount.value) 
                    : {
                        currency: payment.destination.amount.currency,
                        issuer: payment.destination.amount.counterparty || payment.destination.amount.issuer,
                        value: payment.destination.amount.value
                      }
        };
        if (payment.destination.tag) {
            tx.DestinationTag = parseInt(payment.destination.tag);
        }
        if (payment.source && payment.source.tag) {
            tx.SourceTag = parseInt(payment.source.tag);
        }
        if (payment.invoiceID) {
            tx.InvoiceID = payment.invoiceID;
        }
        if (payment.allowPartialPayment) {
            tx.Flags = 0x00020000;
        }
        if (instructions) {
            if (instructions.fee) {
                tx.Fee = xrpl.xrpToDrops(instructions.fee);
            }
            if (instructions.sequence !== undefined) {
                tx.Sequence = parseInt(instructions.sequence);
            }
            if (instructions.maxLedgerVersion !== undefined) {
                tx.LastLedgerSequence = parseInt(instructions.maxLedgerVersion);
            }
        }
        if (tx.Sequence === undefined || tx.Fee === undefined) {
            return client.autofill(tx).then(autofilled => {
                return { txJSON: JSON.stringify(autofilled) };
            });
        } else {
            return Promise.resolve({ txJSON: JSON.stringify(tx) });
        }
    };
    var asfFlags = {
        requireDestinationTag: 1,
        requireAuthorization: 2,
        disallowIncomingXRP: 3,
        disableMasterKey: 4,
        noFreeze: 6,
        globalFreeze: 7,
        defaultRipple: 8,
        depositAuth: 9
    };
    client.prepareSettings = function(fromacc, settings, instructions) {
        var tx = {
            Account: fromacc
        };
        if (settings.regularKey !== undefined) {
            tx.TransactionType = "SetRegularKey";
            if (settings.regularKey) {
                tx.RegularKey = settings.regularKey;
            }
        } else {
            tx.TransactionType = "AccountSet";
            for (var key in asfFlags) {
                if (settings[key] !== undefined) {
                    var flagValue = asfFlags[key];
                    if (settings[key]) {
                        tx.SetFlag = flagValue;
                    } else {
                        tx.ClearFlag = flagValue;
                    }
                    break;
                }
            }
        }
        if (instructions) {
            if (instructions.fee) {
                tx.Fee = xrpl.xrpToDrops(instructions.fee);
            }
            if (instructions.sequence !== undefined) {
                tx.Sequence = parseInt(instructions.sequence);
            }
            if (instructions.maxLedgerVersion !== undefined) {
                tx.LastLedgerSequence = parseInt(instructions.maxLedgerVersion);
            }
        }
        if (tx.Sequence === undefined || tx.Fee === undefined) {
            return client.autofill(tx).then(autofilled => {
                return { txJSON: JSON.stringify(autofilled) };
            });
        } else {
            return Promise.resolve({ txJSON: JSON.stringify(tx) });
        }
    };
    client.prepareTrustline = function(fromacc, trustline, instructions) {
        var tx = {
            TransactionType: "TrustSet",
            Account: fromacc,
            LimitAmount: {
                currency: trustline.currency,
                issuer: trustline.counterparty,
                value: trustline.limit
            }
        };
        if (trustline.ripplingDisabled !== undefined) {
            tx.Flags = trustline.ripplingDisabled ? 0x00020000 : 0x00040000;
        }
        if (instructions) {
            if (instructions.fee) {
                tx.Fee = xrpl.xrpToDrops(instructions.fee);
            }
            if (instructions.sequence !== undefined) {
                tx.Sequence = parseInt(instructions.sequence);
            }
            if (instructions.maxLedgerVersion !== undefined) {
                tx.LastLedgerSequence = parseInt(instructions.maxLedgerVersion);
            }
        }
        if (tx.Sequence === undefined || tx.Fee === undefined) {
            return client.autofill(tx).then(autofilled => {
                return { txJSON: JSON.stringify(autofilled) };
            });
        } else {
            return Promise.resolve({ txJSON: JSON.stringify(tx) });
        }
    };
    client.prepareOrder = function(fromacc, order, instructions) {
        var gets = order.direction === 'sell' ? order.quantity : order.totalPrice;
        var pays = order.direction === 'sell' ? order.totalPrice : order.quantity;
        var tx = {
            TransactionType: "OfferCreate",
            Account: fromacc,
            TakerGets: formatOfferAmount(gets),
            TakerPays: formatOfferAmount(pays)
        };
        var flags = 0;
        if (order.direction === 'sell') {
            flags |= 0x00080000;
        }
        if (order.passive) {
            flags |= 0x00010000;
        }
        if (order.immediateOrCancel) {
            flags |= 0x00020000;
        }
        if (order.fillOrKill) {
            flags |= 0x00040000;
        }
        if (flags !== 0) {
            tx.Flags = flags;
        }
        if (order.expirationTime) {
            tx.Expiration = xrpl.isoTimeToRippleTime(order.expirationTime);
        }
        if (instructions) {
            if (instructions.fee) {
                tx.Fee = xrpl.xrpToDrops(instructions.fee);
            }
            if (instructions.sequence !== undefined) {
                tx.Sequence = parseInt(instructions.sequence);
            }
            if (instructions.maxLedgerVersion !== undefined) {
                tx.LastLedgerSequence = parseInt(instructions.maxLedgerVersion);
            }
        }
        if (tx.Sequence === undefined || tx.Fee === undefined) {
            return client.autofill(tx).then(autofilled => {
                return { txJSON: JSON.stringify(autofilled) };
            });
        } else {
            return Promise.resolve({ txJSON: JSON.stringify(tx) });
        }
    };
    client.prepareOrderCancellation = function(fromacc, cancel, instructions) {
        var tx = {
            TransactionType: "OfferCancel",
            Account: fromacc,
            OfferSequence: parseInt(cancel.orderSequence)
        };
        if (instructions) {
            if (instructions.fee) {
                tx.Fee = xrpl.xrpToDrops(instructions.fee);
            }
            if (instructions.sequence !== undefined) {
                tx.Sequence = parseInt(instructions.sequence);
            }
            if (instructions.maxLedgerVersion !== undefined) {
                tx.LastLedgerSequence = parseInt(instructions.maxLedgerVersion);
            }
        }
        if (tx.Sequence === undefined || tx.Fee === undefined) {
            return client.autofill(tx).then(autofilled => {
                return { txJSON: JSON.stringify(autofilled) };
            });
        } else {
            return Promise.resolve({ txJSON: JSON.stringify(tx) });
        }
    };
    client.sign = function(txJSON, secret) {
        var tx = JSON.parse(txJSON);
        var wallet = xrpl.Wallet.fromSeed(secret, { algorithm: secret.startsWith('sEd') ? 'ed25519' : 'ecdsa-secp256k1' });
        var signed = wallet.sign(tx);
        return {
            signedTransaction: signed.tx_blob,
            id: signed.hash
        };
    };
    client.submit = function(signedTxHex) {
        return client.request({ command: "submit", tx_blob: signedTxHex }).then(res => {
            return {
                resultCode: res.result.engine_result,
                resultMessage: res.result.engine_result_message
            };
        });
    };
}

// Expose functions globally
window.setRemoteGateway = setRemoteGateway;
window.resetServerStack = resetServerStack;
window.connectToRipple = connectToRipple;
window.doRetryConnection = doRetryConnection;
window.doOfflineMode = doOfflineMode;
window.checkConnection = checkConnection;
window.serverCycle = serverCycle;
window.injectCompatibilityLayer = injectCompatibilityLayer;

},{}],14:[function(require,module,exports){
function sendPayment(passphrase, fromacc, xrpAmount, destination, sourceTag, destTag, invoiceID, asset, issuer, successfunc, failurefunc) {
	
	if (debug) console.log("sendPayment - " + xrpAmount);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
			var instructions = {maxLedgerVersionOffset: 30};
			var payment = {
			  source: {
			    address: fromacc,
			    maxAmount: {
			      value: xrpAmount + "",
			      currency: asset,
			    }
			  },
			  destination: {
			    address: destination,
			    amount: {
			      value: xrpAmount + "",
			      currency: asset,
			    },
			  }
			};
			if(sourceTag) {
				payment.source.tag = parseInt(sourceTag + "");
			}
			if(destTag) {
				payment.destination.tag = parseInt(destTag + "");
			}
			if (invoiceID !== undefined && invoiceID != "") {
				payment.invoiceID = invoiceID;
			}
            if (asset != 'XRP' && issuer != '' && issuer != undefined) {
                payment.source.maxAmount['counterparty'] = issuer;
                payment.destination.amount['counterparty'] = issuer;
            }
            console.log(payment);
			var preparepayment = function(fromacc, payment, instructions, ptries) {
				return remote.preparePayment(fromacc, payment, instructions).then(prepared => {
				    console.log('Payment transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                    secret = "";
				    console.log('Payment transaction signed...');
				    
				    submitSignedTransaction(signedTransaction, successfunc, failurefunc, ptries);
				    
				}, (fail) => 	 {
					console.log('Prepare payment failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								preparepayment(fromacc, payment, instructions, ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
				});
			}
			return preparepayment(fromacc, payment, instructions, 0);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});
}

function sendPaymentOffline(passphrase, fromacc, xrpAmount, destination, sourceTag, destTag, invoiceID, asset, issuer, accSeqID, ledSeqID, fee) {
	
	if (debug) console.log("sendPaymentOffline - " + xrpAmount);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
			var payment = {
			  source: {
			    address: fromacc,
			    maxAmount: {
			      value: xrpAmount + "",
			      currency: asset,
			    },
		      	    tag: parseInt(sourceTag + "")
			  },
			  destination: {
			    address: destination,
			    amount: {
			      value: xrpAmount + "",
			      currency: asset,
			    }
			  }
			};
            if (destTag) 
                payment.destination['tag'] = parseInt(destTag + "")
            
            if (asset != 'XRP' && issuer != '' && issuer != undefined) {
                payment.source.maxAmount['counterparty'] = issuer;
                payment.destination.amount['counterparty'] = issuer;
                payment['allowPartialPayment'] = true;
            }
			if (invoiceID !== undefined && invoiceID != "") {
				payment.invoiceID = invoiceID;
			}
            remote.preparePayment(fromacc, payment, instructions).then(prepared => {
 				    console.log('Payment transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
				    
                    secret = "";
				    
                    console.log('Payment transaction signed...');
                    emptyEl('#divgreenqrdisplay');
                    appendNode('#divgreenqrdisplay', kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function sendTrustLineTx(passphrase, fromacc, issuer, currency, limit, rippling, successfunc, failurefunc) {
	
	if (debug) console.log("sendTrustLineTx - " + issuer + " currency " + currency + " limit " + limit + " rippling " + rippling + " foraddr " + fromacc);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
			var instructions = {maxLedgerVersionOffset: 30};
			var trustline = {
                "currency" : currency,
                "counterparty" : issuer,
                "limit" : limit
			};
            if (rippling != undefined) {
                trustline["ripplingDisabled"] = !rippling;
            }
			var preparetrustline = function(fromacc, trustline, instructions, ptries) {
				return remote.prepareTrustline(fromacc, trustline, instructions).then(prepared => {
				    console.log('Trustline transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                    
                    secret = "";
				    
                    console.log('Trustline transaction signed...');
				    
				    submitSignedTransaction(signedTransaction, successfunc, failurefunc, ptries);
				    
				}, (fail) => 	 {
					console.log('Prepare trustline failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								preparetrustline(fromacc, trustline, instructions, ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
				});
			}
			return preparetrustline(fromacc, trustline, instructions, 0);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});    
}

function sendTrustLineTxOffline(passphrase, fromacc, issuer, currency, limit, rippling, accSeqID, ledSeqID, fee) {
	if (debug) console.log("sendTrustLineTx - " + issuer + " currency " + currency + " limit " + limit + " rippling " + rippling + " foraddr " + fromacc + " accSeqID " +  accSeqID + " ledSeqID " + ledSeqID + " fee " + fee);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
			var trustline = {
                "currency" : currency,
                "counterparty" : issuer,
                "limit" : limit,
			};
            if (rippling != undefined) {
                trustline["ripplingDisabled"] = !rippling;
            }
            remote.prepareTrustline(fromacc, trustline, instructions).then(prepared => {
                console.log('Trustline transaction prepared...');
                const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                console.log('Trustline transaction signed...');
                secret = "";
                    emptyEl('#divgreenqrdisplay');
                    appendNode('#divgreenqrdisplay', kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
         
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function sendOfferCreate(passphrase, fromacc, amount, asset, issuer, price, sell, fok, ioc, passive, expiry, successfunc, failurefunc) {
	
	if (debug) console.log("sendOfferCreate - " + fromacc + " asset: " + asset + " issuer: " + issuer + " price: " + price + " sell: " + sell + " fok: " + fok + " ioc: " + ioc + " passive: " + passive);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
			var instructions = {maxLedgerVersionOffset: 30};
			var order = {
			  direction: (sell ? 'sell' : 'buy'),
              quantity: {
                    currency: asset,
                    counterparty: issuer,
                    value: "" + amount
              },
              totalPrice: {
                    currency: 'XRP',
                    value:  roundXRP( price * amount )  + ''
              }
			};
            if (typeof(expiry) === 'string') order['expirationTime'] = expiry;
            if (passive) order['passive'] = true;
            if (fok) order['fillOrKill'] = true;
            if (ioc && !fok) order['immediateOrCancel'] = true;
            
            console.log(order);
			var prepareorder = function(fromacc, order, instructions, ptries) {
				return remote.prepareOrder(fromacc, order, instructions).then(prepared => {
				    console.log('OfferCreate transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                    secret = "";
				    console.log('OfferCreate transaction signed...');
				    
				    submitSignedTransaction(signedTransaction, successfunc, failurefunc, ptries);
				    
				}, (fail) => 	 {
					console.log('Prepare order failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								prepareorder(fromacc, order, instructions, ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
				});
			}
			return prepareorder(fromacc, order, instructions, 0);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});
}

function sendOfferCreateOffline(passphrase, fromacc, amount, asset, issuer, price, sell, fok, ioc, passive, expiry, accSeqID, ledSeqID, fee) {
	
	if (debug) console.log("sendOfferCreateOffline - " + fromacc + " asset: " + asset + " issuer: " + issuer + " price: " + price + " sell: " + sell + " fok: " + fok + " ioc: " + ioc + " passive: " + passive + ", accSeqID: " + accSeqID + ", ledSeqID: " + ledSeqID + ", fee: " + fee);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
			var order = {
			  direction: (sell ? 'sell' : 'buy'),
              quantity: {
                    currency: asset,
                    counterparty: issuer,
                    value: "" + amount 
              },
              totalPrice: {
                    currency: 'XRP',
                    value:  roundXRP( price * amount ) + '' 
              }
			};
            if (typeof(expiry) === 'string') order['expirationTime'] = expiry;
            if (passive) order['passive'] = true;
            if (fok) order['fillOrKill'] = true;
            if (ioc && !fok) order['immediateOrCancel'] = true;
            
            console.log(order)
            remote.prepareOrder(fromacc, order, instructions).then(prepared => {
 				    console.log('Order transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
				    
                    secret = "";
				    
                    console.log('Order transaction signed...');
                    emptyEl('#divgreenqrdisplay');
                    appendNode('#divgreenqrdisplay', kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function sendOfferCancel(passphrase, fromacc, seq, successfunc, failurefunc) {
	
	if (debug) console.log("sendOfferCancel - " + fromacc + " seq: " + seq);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
			var instructions = {maxLedgerVersionOffset: 30};
			var cancel = {
                orderSequence: seq
            };
            console.log(cancel);
			var preparecancelorder = function(fromacc, cancel, instructions, ptries) {
				return remote.prepareOrderCancellation(fromacc, cancel, instructions).then(prepared => {
				    console.log('OfferCancel transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                    secret = "";
				    console.log('OfferCancel transaction signed...');
				    
				    submitSignedTransaction(signedTransaction, successfunc, failurefunc, ptries);
				    
				}, (fail) => 	 {
					console.log('Prepare cancelorder failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								preparecancelorder(fromacc, cancel, instructions, ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
				});
			}
			return preparecancelorder(fromacc, cancel, instructions, 0);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});
}

function sendOfferCancelOffline(passphrase, fromacc, seq, accSeqID, ledSeqID, fee) {
	
	if (debug) console.log("sendOfferCancelOffline - " + seq + ", accSeqID: " + accSeqID + ", ledSeqID: " + ledSeqID + ", fee: " + fee);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
			var cancel = {
                orderSequence: seq
            };
          
            console.log(cancel);
            remote.prepareOrderCancellation(fromacc, cancel, instructions).then(prepared => {
 				    console.log('OfferCancel transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
				    
                    secret = "";
				    
                    console.log('OfferCancel transaction signed...');
                    emptyEl('#divgreenqrdisplay');
                    appendNode('#divgreenqrdisplay', kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function sendAccountFlagsTx(passphrase, fromacc, defaultRipple, depositAuth, disableMasterKey, disallowIncomingXRP, globalFreeze, noFreeze, requireAuthorization, requireDestinationTag, successfunc, failurefunc) {
	
	if (debug) console.log('sendAccountFlagsTx - ' + 'defaultRipple: ' + defaultRipple + ', ' + 'depositAuth: ' + depositAuth + ', ' + 'disableMasterKey: ' + disableMasterKey + ', ' + 'disallowIncomingXRP: ' + disallowIncomingXRP + ', ' + 'globalFreeze: ' + globalFreeze + ', ' + 'noFreeze: ' + noFreeze + ', ' + 'requireAuthorization: ' + requireAuthorization + ', ' + requireDestinationTag);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            var flags = {
                "defaultRipple": defaultRipple, "depositAuth": depositAuth, "disableMasterKey": disableMasterKey, "disallowIncomingXRP": disallowIncomingXRP, "globalFreeze": globalFreeze, "noFreeze": noFreeze, "requireAuthorization": requireAuthorization, "requireDestinationTag": requireDestinationTag
            }
            var submit_flag_change = (flags) => {
                for (var f in flags) {
                    // drop any flags we're not changing
                    if (flags[f] == 'unchanged') {
                        delete(flags[f]);
                        continue;
                    }
                    // grab the first flag off the top and submit it
                    var instructions = {maxLedgerVersionOffset: 30};
                    var settings = {};
                    
                    settings[f] = ( flags[f] == "true" );
                    
                    delete(flags[f]);
                    var preparesettings = function(fromacc, settings, instructions, ptries) {
                        return remote.prepareSettings(fromacc, settings, instructions).then(prepared => {
                            console.log('Trustline transaction prepared...');
                            const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                            
                           
                            
                            console.log('Settings transaction signed...');
                            
                            submitSignedTransaction(signedTransaction, ()=>{ submit_flag_change(flags); }, failurefunc, ptries);
                            
                        }, (fail) => 	 {
                            console.log('Prepare settings failed: ' + fail);
                            if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
                                return serverCycle(
                                    function() {
                                         preparesettings(fromacc, settings, instructions, ptries + 1);
                                    }, ptries + 1, failurefunc);
                            }
                            unblockInput();
                            secret = "";
                            failurefunc("" + fail);
                        });
                    }
                    return preparesettings(fromacc, settings, instructions, 0);
                }
                // if code execution reaches here then all submissions were successful!
                secret = "";
                successfunc();
            };
            
            submit_flag_change(flags);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});    
}

function  sendAccountFlagsTxOffline(passphrase, fromacc, defaultRipple, depositAuth, disableMasterKey, disallowIncomingXRP, globalFreeze, noFreeze, requireAuthorization, requireDestinationTag, accSeqID, ledSeqID, fee) {
	if (debug) console.log('sendAccountFlagsTx - ' + 'defaultRipple: ' + defaultRipple + ', ' + 'depositAuth: ' + depositAuth + ', ' + 'disableMasterKey: ' + disableMasterKey + ', ' + 'disallowIncomingXRP: ' + disallowIncomingXRP + ', ' + 'globalFreeze: ' + globalFreeze + ', ' + 'noFreeze: ' + noFreeze + ', ' + 'requireAuthorization: ' + requireAuthorization + ', ' + requireDestinationTag + " accSeqID " +  accSeqID + " ledSeqID " + ledSeqID + " fee " + fee);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
            var settings = {};
            // only allow one flag to be set, whichever comes first
            if (defaultRipple != 'unchanged') settings['defaultRipple'] = ( defaultRipple == 'true' );
            else if (depositAuth != 'unchanged') settings['depositAuth'] = ( depositAuth == 'true' );
            else if (disableMasterKey != 'unchanged') settings['disableMasterKey'] = ( disableMasterKey == 'true' );
            else if (disallowIncomingXRP != 'unchanged') settings['disallowIncomingXRP'] = ( disallowIncomingXRP == 'true' );
            else if (globalFreeze != 'unchanged') settings['globalFreeze'] = ( globalFreeze == 'true' );
            else if (noFreeze != 'unchanged') settings['noFreeze'] = ( noFreeze == 'true' );
            else if (requireAuthorization != 'unchanged') settings['requireAuthorization'] = ( requireAuthorization == 'true' );
            else if (requireDestinationTag != 'unchanged') settings['requireDestinationTag'] = ( requireDestinationTag == 'true' );
            remote.prepareSettings(fromacc, settings, instructions).then(prepared => {
                console.log('Settings transaction prepared...');
                const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                console.log('Settings transaction signed...');
                secret = "";
                    emptyEl('#divgreenqrdisplay');
                    appendNode('#divgreenqrdisplay', kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
         
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function submitSignedTransaction(signedTransaction, successfunc, failurefunc, tries) {
    remote.submit(signedTransaction).then(
        data => {
            if (debug) console.log("Submission result: " + data.resultCode );
            if (data.resultCode == 'tesSUCCESS' || data.resultCode == 'terQUEUED') {
                if (debug) console.log("send successful [" + data.resultCode + "]");
                unblockInput();
                return successfunc(data.resultCode == 'terQUEUED');
            } else if ((data.resultCode + "").toLowerCase().indexOf('max_ledger') != -1) {
                // failed to be submitted
                // cycle servers and try again
                
                return serverCycle(
                    function() {
                        submitSignedTransaction(signedTransaction, successfunc, failurefunc, tries + 1);
                    }, tries + 1, failurefunc);
            } else {
                if (debug) console.log("send failed 2: " + data.resultCode);
                unblockInput();
                return failurefunc(data.resultCode + "");						
            }
        }, 
        (e) => {
            if (debug) console.log("send failed: " + e);
            if ((e + "").toLowerCase().indexOf("notconnected") != -1) {
                return serverCycle(
                    function() {
                        submitSignedTransaction(signedTransaction, successfunc, failurefunc, tries + 1);
                    }, 
                    tries + 1, failurefunc
                );
            }
                            
            unblockInput();
            failurefunc(e + "");
        }
    );
}
// Expose functions globally
window.sendPayment = sendPayment;
window.sendPaymentOffline = sendPaymentOffline;
window.sendTrustLineTx = sendTrustLineTx;
window.sendTrustLineTxOffline = sendTrustLineTxOffline;
window.sendOfferCreate = sendOfferCreate;
window.sendOfferCreateOffline = sendOfferCreateOffline;
window.sendOfferCancel = sendOfferCancel;
window.sendOfferCancelOffline = sendOfferCancelOffline;
window.sendAccountFlagsTx = sendAccountFlagsTx;
window.sendAccountFlagsTxOffline = sendAccountFlagsTxOffline;
window.submitSignedTransaction = submitSignedTransaction;

},{}],15:[function(require,module,exports){
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

},{}],16:[function(require,module,exports){
'use strict';

function refreshAccounts(after) {
    // mark and sweep to remove any dead accounts
    var nonce = sodium.randombytes_random();
    var acc = qsa(".accountitem");
	for (var i = 0; i < acc.length; i++) 
        domData(acc[i], 'markforupdate', nonce);
	
	emptyEl("#payfromaccount");
    var fetchRateAndUpdateBalance = function(after) {
        var updateaccs = function(exchangerate, after){
            getAccounts(function(acc) {
                accountbalances = {};
                accountbalancestl = {};
                accountflags = {};
                var lastacc;
                for (var i in acc) lastacc = i;
                for (var i in acc) {
                    ((account) => {
                        var f = 
                        function(res) {
                            var xrpBalance = parseInt(res.Balance) / 1000000.0;
                            if (debug) console.log("received account info for: " + account);
                            try {
                                var trustlines = "";
                                var tlcount = 0;
                                var xrpvalueoftrustlinebalances = 0;
                                    
                                trustlinesdropdown[account] = {};
                                accountbalancestl[account] = {};
                                // store the account's set flags for use later
                                if (res['flags'] != undefined) {
                                    accountflags[account] = res['flags'];
                                }
                                if (res['trustlines'] != undefined && typeof(res['trustlines']) == 'object' && 
                                    res['trustlines'].length != undefined && res['trustlines'].length > 0) {
                                   
                                    // these are cumulative balances for display purposes that discard issuer; true balances are kept in accountbalancestl
                                    var tlbalances = {};
                                    for (var t in res['trustlines']) {
                                        var tl = res['trustlines'][t];
                                        var issuer, currency, balance, tlexchangerate;
                                        if (tl['specification'] == undefined || tl['state'] == undefined || (issuer = tl['specification']['counterparty']) == undefined || 
                                            (currency = tl['specification']['currency']) == undefined || (balance = tl['state']['balance']) == undefined ||  tl['specification']['limit'] === "0") continue;
                                        tlexchangerate = tl['exchangerate'];
                                        if (tlexchangerate != undefined && tlexchangerate > 0) 
                                            xrpvalueoftrustlinebalances += parseFloat("" + balance) / parseFloat("" + tlexchangerate);
                                        // in the specification there is an optional 40 character setting for currency, we can't display that here and displaying a turncated 
                                        // version may lead to people being manipulated into thinking they have another currency. 
                                        if (currency.length > 3) currency = 'UNKNOWN'; 
                               
                                        // update display balance record 
                                        if (currency in tlbalances) {
                                            tlbalances[currency] += parseFloat("" + balance);
                                        } else {
                                            tlbalances[currency] = parseFloat("" + balance);
                                        }
                                        // update the official balance record
                                        if (!(currency in accountbalancestl[account])) accountbalancestl[account][currency] = {};
                                        accountbalancestl[account][currency][issuer] = parseFloat("" + balance);
                                        // populate the dropdown for this account
                                        if (trustlinesdropdown[account] == undefined) trustlinesdropdown[account] = {};
                                        trustlinesdropdown[account]["" + currency + issuer] = '<option id="optpa-' + currency  + '-' + issuer + '" data-asset="' + currency + '" data-issuer="' + issuer + '">' + currency.replace(/[^A-Za-z0-9?!@#$%\^&*<>(){}[\]|]/mg, "") + ' - ' + dispaddr((""+issuer).replace(/[^A-Za-z0-9]/mg, "")) + '</option>';
                                    }
                                    for (var currency in tlbalances) {
                                        trustlines += '<div class="trustline"><div class="amount"><span class="mono"><div class="currency">' + currency + '</div> ' + display_currency_amount(tlbalances[currency]) + '</span></div></div>';
                                        tlcount++;
                                    }
                                }
                                trustlines = '<div class="trustline"><div class="amount"><span class="mono" style=""><div class="currency">XRP</div> ' + display_currency_amount(xrpBalance) + '</span></div></div>' + trustlines;
                                var fiatbalance = "";
                                if (exchangerate > 0) {
                                    var amount = exchangerate * (parseFloat("" + xrpBalance) + xrpvalueoftrustlinebalances);
                                    var stramount = display_currency_amount(amount);
                                    fiatbalance = '<span class="mono" style="opacity:0.7"><div class="currency"><span>' + interface_settings.valuation_currency + ' ' + stramount + '</span></div></span>';
                                }
                                setHtml("#ra" + account + ">.accountline>.amount", '<span class="mono">' + fiatbalance + '</span>');
                                if (trustlines != "")  {
                                    setHtml("#ra" + account + ">.trustlines", trustlines);
                                    domData("#ra" + account + ">.trustlines", 'tlcount', tlcount);
                                }
                                hideEl('#ra' + account + ' .accloadspinner');
                                removeDomData("#ra" + account, 'markforupdate');
                            } catch(e) {handle_error(e);}
                            accountbalances[account] = parseFloat(xrpBalance);
                            var balcount = Object.keys(accountbalances).length;
                            if (balcount > 0 && activeaccount == "") {
                                var largest = -1; var largestindex = "";
                                for (var x in accountbalances) {
                                    if (accountbalances[x] > largest) {
                                        largest = accountbalances[x];
                                        largestindex = x;
                                    }
                                }
                                if (largestindex !== "") {
                                    activeaccount = largestindex;
                                    var opt = byId("opt" + largestindex);
                                    if (opt) opt.selected = true;
                                    addClass("#ra" + largestindex, 'active');
                                    if (typeof refreshSelect === 'function') refreshSelect('#payfromaccount');
                                }
                            }
                            if (lastacc == account && after != undefined && typeof(after) == 'function') after();
                            
                        };
                        var e =
                        function(e) {
                            if (debug) console.log("account refresh error: " + e);
                            try {
                                setHtml("#ra" + account + ">.accountline>.amount", '<small style="opacity:0.7">not activated</small>');
                                hideEl('#ra' + account + ' .accloadspinner');
                                removeDomData("#ra" + account, 'markforupdate');
                            } catch(e) {handle_error(e);}					
                        };
                        getAccountInfo(account, f, e).catch(e);
                    })(i);
                }
             
            });
        };
        getExchangeRate(interface_settings.valuation_currency, interface_settings.valuation_counterparty, updateaccs, after);
    };
	getAccounts(function(acc) {
		accountbalances = {};
		for (var i in acc) {
			var nickname = (acc[i].nickname == undefined ? "" : acc[i].nickname.replace(/[^a-zA-Z0-9 ]/g, "").trim());
            var toptouchend = 'te(event, ()=>{doSelectAccount(\''+i+'\', \''+nickname+'\', false);})';
            var bottomtouchend = toptouchend; // changed the behaviour so it always goes to the account details tab, since the DEX is rarely used
            if (!byId('ra' + i)) {
                var liHtml = '<li data-account="'+i+'" ontouchstart="ts(event)" ontouchend="'+bottomtouchend+'" class="list-group-item accountitem '+(activeaccount == i?'active':'')+'" id="ra'+i+'"><span class="hashicon"></span><div class="accountline" ontouchstart="ts(event)" ontouchend="'+toptouchend+'"><a class="address"><span class="address">'+(nickname == "" ? dispaddr(i) : nickname)+'</span></a><div class="amount"><small style="opacity: 0.7">' + (offlinemode ? 'offline' : '') + '</small></div></div><div class="trustlines" ontouchstart="ts(event)" ontouchend="'+bottomtouchend+'"></div><i class="fas fa-circle-notch accloadspinner" style="'+(offlinemode? 'display:none' : '')+'"></i></li>';
                var accountsList = byId('accountslist');
                if (accountsList) {
                    accountsList.insertAdjacentHTML('afterbegin', liHtml);
                }
                var iconSpan = qs('#ra' + i + ' .hashicon');
                if (iconSpan) iconSpan.appendChild(hashicon(xaddr(i, false), 35));
            } else {
                // passively update without rewriting the dom
                if (activeaccount == i) {
                    addClass('#ra' + i, 'active');
                } else {
                    removeClass('#ra' + i, 'active');
                }
                // may have changed nickname since last update
                var addrSpan = qs('#ra' + i + ' span.address');
                if (addrSpan) addrSpan.innerText = (nickname == "" ? dispaddr(i) : nickname);
                // update touchend event handlers
                setAttr('#ra' + i + ' .hashicon', 'ontouchend', toptouchend);
                setAttr('#ra' + i + ' .accountline', 'ontouchend', toptouchend);
                setAttr('#ra' + i + ' .trustlines', 'ontouchend', bottomtouchend);
                if (!offlinemode) showEl('#ra' + i + ' .accloadspinner');
            }
			appendHtml("#payfromaccount", '<option value="'+i+'" data-account="'+i+'" id="opt'+i+'"'+( i == activeaccount ? ' selected=selected' : '' )+'>' + (nickname == "" ? i : nickname) + '</option>');
		}
        // check to see if there are any accounts on the stack which shouldn't be (i.e. one has been deleted)
        var list = qsa('.accountitem');
        for (var i = 0; i < list.length; i++) {
            var accItem = list[i];
            var itemAcc = domData(accItem, 'account');
            if (itemAcc && !(itemAcc in acc)) accItem.remove();
        }
        if (typeof refreshSelect === 'function') refreshSelect('#payfromaccount');
		clickProxy();	
        if (offlinemode) return after();
        fetchRateAndUpdateBalance(after);
	});
}

function doSelectAccount(accselected, nickname, trustlinesSubTab) {
	if (debug) console.log("doSelectAccount");
	var acc = qsa(".accountitem");
	for (var i = 0; i < acc.length; i++) {	
		removeClass(acc[i], "active");
	}
	addClass("#ra" + accselected, "active");
	activeaccount = accselected;
    var fromList = byId('fromaccountslist');
    if (fromList) {
        var itemsToRemove = fromList.querySelectorAll('*:not(.bottom-list-button)');
        itemsToRemove.forEach(el => el.remove());
        fromList.insertAdjacentHTML('afterbegin', '<li class="list-group-item accountitem active"><span class="hashicon"></span><div class="accountline"><a href="#" class="address"><span class="address">'+accselected+'</span></a><span class="amount">'+( accountbalances[accselected] == undefined ? '' :  accountbalances[accselected] + " XRP")+'</span></div><div class="trustlines"></div></li>');
    }
	showTab("#tabaccountdetails");	
    if (trustlinesSubTab == undefined || !trustlinesSubTab) {
        selectAccountDetailsSubTab(byId('btnaccdetailsselectaddress'), 'address');
    } else {
        selectAccountDetailsSubTab(byId('btnaccdetailsselecttrustlines'), 'trustlines');
    }
    setHtml("#accdetailsamount", accountbalances[accselected] == undefined ? '' :  '<b><div class="currency">XRP</div> ' + accountbalances[accselected] + '</b>');
	domData("#accdetailsaddress", 'content', accselected);
	emptyEl("#accdetailsqr");
	appendNode("#accdetailsqr", kjua({text: dispaddr(accselected)}));
	
	setText("#accdetailsnickname", (nickname == undefined || nickname == "" ? "XRP address" : nickname));
	
	setVal("#accdetailsaddress", dispaddr(accselected));
}

function doDeleteAccount(passphrase, address, toggle) {
	if (debug) console.log("doDeleteAccount");
    address = forceraddr(address);
	blockInput();
    if (!toggle) {
        navigator.notification.alert("You must confirm you wish to DELETE " + address, function(){}, "STOP", "OK");
		unblockInput();
        return;
    }
	validatePassphrase(passphrase, false,
		function() {
			removeSecret(address, 
				function() { 
					navigator.notification.alert("Account deleted successfully", 
						function(){
							showTab("#tabaccounts");
							unblockInput();
						}, 
						"Success", 
						"OK"
					);
				}, 
				function() {
					navigator.notification.alert("Account deletion failed. Your wallet may be corrupted. We recommend making a backup.", 
						function(){
							unblockInput();
						}, 
						"Failure", 
						"OK"
					);
				}
			);
		},
		function() {
			navigator.notification.alert("Your passphrase is incorrect. Recovery phrase cannot be used here.", 
				function(){
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		},
		function() {
			navigator.notification.alert("Account deletion failed. Your wallet may be corrupted. We recommend making a backup.", 
				function(){
					unblockInput();
				}, 
				"Failure", 
				"OK"
			);
		}
	);
}

function doRevealRippleSecret(passphrase, address) {
	if (debug) console.log("doRevealRippleSecret");
	blockInput();
    address = forceraddr(address);
    validatePassphrase(passphrase, false,
        function() {
			getSecretForAccount(passphrase, address, function(secret) {
				hideEl("#lblacpassword");
				showEl("#lblaccsecret");
				hideEl("#btnrevealsecret");
				hideEl("#divrsecaccpassword");
                setVal("#accsecret", secret);
                domData("#accsecret", 'content', secret);
				showEl("#accsecret");
				showEl("#btncopysecret");
                appendNode("#accsecretqr", kjua({text: secret}));				
				unblockInput();
			}, function() {
                navigator.notification.alert("Your wallet data may have been corrupted. Please backup via the settings menu then restart the app to run data recovery.", 
					function(){
						unblockInput();
					}, 
					"Error", 
					"OK"
				);
			});
        },
        function() {
            navigator.notification.alert("Your passphrase was entered incorrectly. Note you cannot use a recovery phrase here.", 
				function(){
					var gap = byId("genaccpassword");
					if (gap) gap.focus();
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
        },
        function() {
            navigator.notification.alert("Your wallet data may have been corrupted. Please backup via the settings menu then restart the app to run data recovery.", 
				function(){
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
        }
    );
}

function doChangeNickname(address, nickname) {
	if (debug) console.log("doChangeNickname " + nickname + " for " + address);
	blockInput();
    address = forceraddr(address);
	if (nickname == undefined) nickname = "";
	nickname = nickname.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    changeNickname(address, nickname,  
        function() {
            // success
            showTab('#tabaccounts'); 
            unblockInput();
        },
        function() {
            // nick change failure will produce its own message 
            unblockInput();
        }
    );
}

function doImportExistingAccount(passphrase, nickname, secret, vanityaddr) {
	if (debug) console.log("doImportExistingAccount");
	generatedAccount.secret = secret;
	if (vanityaddr != "" && vanityaddr != undefined) {
		if (!validateAddress(vanityaddr)) {
			navigator.notification.alert("The XRP address you've specified is invalid. If you have an ordinary address do not put anything in this field, it will be generated from your secret. If you have a vanity or setRegularKey address then you should use this field.", 
				function(){
					var va = byId('vanityaddr');
					if (va) va.focus();
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
			return;
		} 
		generatedAccount.address = vanityaddr;
	} 
	doImportGeneratedAccount(passphrase, nickname);
}

function doImportGeneratedAccount(passphrase, nickname) {
	if (debug) console.log("doImportGeneratedAccount");
	blockInput();
	if (nickname == undefined) nickname = "";
	nickname = nickname.replace(/[^a-zA-Z0-9 ]/g, "").trim();
	validatePassphrase(passphrase, false, 
		function() {
			importAddress(generatedAccount.secret, generatedAccount.address, nickname, passphrase, 
				function() {
					// success
					generatedAccount = {};
					showTab('#tabaccounts'); 
					unblockInput();
				},
				function() {
					// import failure will produce its own message 
					unblockInput();
				}
			);
		},
		function() {
			navigator.notification.alert("Your passphrase was entered incorrectly. Note you cannot use a recovery phrase here.", 
				function(){
					var gap = byId("genaccpassword");
					if (gap) gap.focus();
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		},
		function() {
			navigator.notification.alert("Your wallet data may have been corrupted. Please backup via the settings menu then restart the app to run data recovery.", 
				function(){
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		}
	);
}

function doShowAndGenerateAccount() {
	if (debug) console.log("doShowAndGenerateAccount");
	blockInput();
	generatedAccount = generateAddress();
	setText("#generatedaddress", dispaddr(generatedAccount.address).slice(0,20) + "XXXXXXXXXXXX");
	showTab("#tabgenaccount");	
	unblockInput();
}

function changeNickname(address, nickname, successfunc, failurefunc) {
    address = forceraddr(address);
	if (!address) {
		navigator.notification.alert("No address was specified when trying to set a new nickname. This could indicate a corrupt wallet. We recommend making a backup from the settings menu.", 
			failurefunc,
			"Error", 
			"OK"
		);
		return;
	}
	// if they specify no nickname then the address will show normally
	if (nickname == undefined) nickname = "";
	var f = function(accounts) { try {
		if (accounts.data == undefined || accounts.data == "") {
			accounts = {};
		} else {
			accounts = JSON.parse(accounts.data);
		}
		if (!(address in accounts)) { 
			navigator.notification.alert("The specified address was not found in your wallet. This could indicate a corrupt wallet. We recommend making a backup from the settings menu.", 
				failurefunc,
				"Error", 
				"OK"
			);
			return;			
		}
		accounts[address].nickname = nickname;
		db.upsert("accounts", function(doc) { return { data: JSON.stringify(accounts)}; }).then(function(x){
			navigator.notification.alert("Nickname successfully updated.", function(){}, "Success", "OK");
			successfunc();
		}).catch(function(x){
			navigator.notification.alert("Failed to change nickname.", function(){}, "Error", "OK");
			failurefunc();
		});
	} catch(e) { handle_error(e); } };
	db.get("accounts").then(f).catch(f);
}

function importAddress(secret, address, nickname, passphrase, successfunc, failurefunc) {
    address = forceraddr(address);
	// set backup reminder to nothing so they get a prompt immediately after importing
	db.upsert("lastbackupreminder",
		function(doc) {
			return { data: JSON.stringify({}) }; 
	});
	var _import = function(secret, address, nickname, passphrase, successfunc, failurefunc) {
	// to proceed to storage we need to generate salts and secrets
	var ppsalt = sodium.randombytes_buf(sodium.crypto_pwhash_scryptsalsa208sha256_SALTBYTES);
	var rpsalt = sodium.randombytes_buf(sodium.crypto_pwhash_scryptsalsa208sha256_SALTBYTES);
	getRpPpData(
		function(ppdata, rpdata) {
            var secret32key =
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					passphrase,
					fromhex_chksum(ppdata.salt1),
					4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
					33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
			// decrypt erk
			var erk = fromhex_chksum(rpdata.erk);
			var nonce = erk.slice(0, sodium.crypto_box_NONCEBYTES);
			erk = erk.slice(sodium.crypto_box_NONCEBYTES);
			var recoverykey = sodium.crypto_secretbox_open_easy(erk, nonce, secret32key);	
			// generate regular secret key
            var secretkey =
				sodium.crypto_pwhash_scryptsalsa208sha256(16,
					passphrase,
					fromhex_chksum(ppdata.salt1),
					4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
					33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);			
			passphrase = "";
			// now generate the keys that will be used to lock the ppsecret and rpsecret boxes
			var ppsecret32key = 
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					secretkey,
					ppsalt,
					4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
					33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
			
			secretkey = "";
			var rpsecret32key = 
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					recoverykey,
					rpsalt,
					4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
					33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
			recoverykey = "";
			// finally lock the true ripple secret into two boxes: rpsecret and ppsecret
			var ppnonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
			var rpnonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
			var ppsecret = tohex_chksum(sodium.from_hex(sodium.to_hex(ppnonce) + sodium.crypto_secretbox_easy(
				secret,
				ppnonce,
				ppsecret32key,
			'hex')));
			
			ppsecret32key = "";
			var rpsecret = tohex_chksum(sodium.from_hex(sodium.to_hex(rpnonce) + sodium.crypto_secretbox_easy(
				secret,
				rpnonce,
				rpsecret32key,
			'hex')));
			rpsecret32key = "";
			secret = "";
			if (nickname == undefined) nickname = "";
			var f = function(accounts) { try {
				if (accounts.data == undefined || accounts.data == "") {
					accounts = {};
				} else {
					accounts = JSON.parse(accounts.data);
				}
				accounts[address] = {
					ppsalt: tohex_chksum(ppsalt), ppsecret: ppsecret,
					rpsalt: tohex_chksum(rpsalt), rpsecret: rpsecret,
					nickname: nickname
				};
				db.upsert("accounts", function(doc) { return { data: JSON.stringify(accounts)}; }).then(function(x){
					navigator.notification.alert("XRP address added successfully.", function(){}, "Success", "OK");
					successfunc();
				}).catch(function(x){
					navigator.notification.alert("Failed to add address.", function(){}, "Error", "OK");
					failurefunc();
				});
			} catch(e) { handle_error(e); } };
			db.get("accounts").then(f).catch(f);
		}
	);
	};
	if (address == undefined) address = "";
	if (!validateSecret(secret)) {
		navigator.notification.alert("Invalid secret.", failurefunc, "Error", "OK");
		return;
	}
    var normalImport = function(secret, address, nickname, passphrase, successfunc, failurefunc) {
        // this is an ordinary account
        if (offlinemode) return _import(secret, address, nickname, passphrase, successfunc, failurefunc);
        // if we are connected then run a check to see if the master key is disabled
        return remote.getSettings(address).then(
        settings => {
            console.log("normalImport loaded the following settings for the account");
            console.log(settings);
            if ('disableMasterKey' in settings && settings['disableMasterKey']) {
                // they are trying to add an account using a secret that has been disabled
                navigator.notification.alert("The secret you are attempting to add has been disabled on the corresponding XRP address, and therefore cannot be used. If this is an account you own then you need to add it using the current regular key.", failurefunc, "Failure", "OK");
            } else {
                // this is fine, the account already exists but the master key is still valid
                return _import(secret, address, nickname, passphrase, successfunc, failurefunc);
            }
        }).catch( 
        e => {
            // if we can't get this data it's probably because the account doesn't exist or we aren't connected / can't get a req out
            // either way just add the account
            return _import(secret, address, nickname, passphrase, successfunc, failurefunc);
        });
    };
	if (address == "") {
		address = generateAddress(secret).address;
        return normalImport(secret, address, nickname, passphrase, successfunc, failurefunc);
	} else {
		// make sure the address is valid, either corresponding to the secret or corresponding to setregular key
		var pubaddress = xrpl.deriveAddress(xrpl.deriveKeypair(secret).publicKey);
		if (pubaddress == address) {
            return normalImport(secret, address, nickname, passphrase, successfunc, failurefunc);
		} else {
            if (offlinemode) {
                return navigator.notification.alert("You are adding an account with a regular key in offline mode. Toast Wallet has no way to ensure this regular key corresponds to your XRP address. The account will be added however transactions may fail if the regular key is incorrect.", ()=>{return _import(secret, address, nickname, passphrase, successfunc, failurefunc);}, "Warning", "OK");
            }
			// this could be a set regular key account, check the regular key
			return remote.getSettings(address).then(
			settings => {
				if ('regularKey' in settings) {
                    if (settings['regularKey'] == pubaddress) {
    					// this is fine, continue
	    				return _import(secret, address, nickname, passphrase, successfunc, failurefunc);
                    } else {    
                        return navigator.notification.alert("The address you specified has a regular key set, however that regular key does not correspond to the secret you have provided.", failurefunc, "Failure", "OK");
                    }
                }
			} ).catch( 
			e => {
				navigator.notification.alert("The address you specified has not been activated. Please activate it first before attempting to add it.", failurefunc, "Failure", "OK");
			});
		}
	}
}

function generateAddress(secret) {
	if (secret == undefined) {
		return remote.generateAddress();
	} else {
		if (!validateSecret(secret))
		 	return;
	
		return {
			secret: secret,
			address: xrpl.deriveAddress(xrpl.deriveKeypair(secret).publicKey)
		};
	}
}

function getSecretForAccount(passphrase, address, successfunc, failurefunc) {
    address = forceraddr(address);
	getRpPpData(function(ppdata, rpdata) { try {
		getAccounts(function(accounts) { try {
			if (accounts[address] == undefined || accounts[address].ppsecret == undefined || accounts[address].ppsalt == undefined) {
				// the address doesn't exist but it should
				navigator.notification.alert("Could not find the specified address. Your wallet data may have been corrupted. " +
					"Please backup via the settings menu then restart the app to run data recovery.", function(){}, "Error", "OK");
				return;
			}
			
			// generate regular secret key
			var secretkey =
				sodium.crypto_pwhash_scryptsalsa208sha256(16,
					passphrase,
					fromhex_chksum(ppdata.salt1),
					4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
					33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);			
			passphrase = "";
			// now generate the keys that will be used to lock the ppsecret and rpsecret boxes
			var ppsecret32key = 
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					secretkey,
					fromhex_chksum(accounts[address].ppsalt),
					4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
					33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
			
			secretkey = "";
		
			// decrypt ppsecret 
			var ppsecret = fromhex_chksum(accounts[address].ppsecret);
			var nonce = ppsecret.slice(0, sodium.crypto_box_NONCEBYTES);
			ppsecret = ppsecret.slice(sodium.crypto_box_NONCEBYTES);
			var secret = sodium.crypto_secretbox_open_easy(ppsecret, nonce, ppsecret32key);
			successfunc(sodium.to_string(secret));
		} catch(e) {handle_error(e); failurefunc();}});
	} catch(e) {handle_error(e); failurefunc();}});
}

function removeSecret(address, successfunc, failurefunc) {
	address = forceraddr(address);
    var f = function(accounts) { try {
		if (accounts.data == undefined || accounts.data == "") 
			return failurefunc();
		accounts = JSON.parse(accounts.data);
		
		if (accounts[address] == undefined)
			return failurefunc();
		delete accounts[address];
		db.upsert("accounts", function(doc) { return { data: JSON.stringify(accounts)}; }).then(function(x){
			successfunc();
		}).catch(function(x){
			failurefunc();
		});
	} catch(e) { handle_error(e); } };
	db.get("accounts").then(f).catch(f);
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.refreshAccounts = refreshAccounts;
    window.doSelectAccount = doSelectAccount;
    window.doDeleteAccount = doDeleteAccount;
    window.doRevealRippleSecret = doRevealRippleSecret;
    window.doChangeNickname = doChangeNickname;
    window.doImportExistingAccount = doImportExistingAccount;
    window.doImportGeneratedAccount = doImportGeneratedAccount;
    window.doShowAndGenerateAccount = doShowAndGenerateAccount;
    window.changeNickname = changeNickname;
    window.importAddress = importAddress;
    window.generateAddress = generateAddress;
    window.getSecretForAccount = getSecretForAccount;
    window.removeSecret = removeSecret;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        refreshAccounts,
        doSelectAccount,
        doDeleteAccount,
        doRevealRippleSecret,
        doChangeNickname,
        doImportExistingAccount,
        doImportGeneratedAccount,
        doShowAndGenerateAccount,
        changeNickname,
        importAddress,
        generateAddress,
        getSecretForAccount,
        removeSecret
    };
}
},{}],17:[function(require,module,exports){
function showBackupReminderTab(){
	showTab('#tabbackupreminder');
}

function doGenerateBackup() {
	if (debug) console.log("doGenerateBackup");
	blockInput();	
	exportWallet(
		function(data){
			showTab('#tabbackup2');
			setVal('#walletbackup', data); 
			domData('#walletbackup', 'content', data);
			// update backup reminder
			getLastBackupReminder(function(backupreminder) {
				backupreminder['lastreminder'] = "" + Math.floor(new Date().getTime()/1000);
				db.upsert("lastbackupreminder",
					function(doc) {
					return { data: JSON.stringify(backupreminder)	}; 
				});
			});
			unblockInput();
		}
	);
}

function getLastBackupReminder(callback) {
	var f	= function(backupreminder) { try {
		if (backupreminder.data == undefined) {
			backupreminder = {};
		} else {
			backupreminder = JSON.parse(backupreminder.data);
		}
		callback(backupreminder);
	} catch(e) { handle_error(e); } }
	db.get("lastbackupreminder").then(f).catch(f);
}

function getLastDonation(callback) {
	var f	= function(donation) { try {
		if (donation.data == undefined) {
			donation = {};
		} else {
			donation = JSON.parse(donation.data);
		}
		callback(donation);
	} catch(e) { handle_error(e); } }
	db.get("lastdonated").then(f).catch(f);
}

function doRestoreBackupFreshInstall() {
	if (debug) console.log('doRestoreBackupFreshInstall');
    var backupcode = getVal('#restorebackup2').trim();
	blockInput(true);
    if (backupcode == "") {
    	return navigator.notification.alert("You must enter a backup code. This is a long code you were given when you added your first XRPL address to the wallet.", 
			function() {
                unblockInput();
			}, 
			"Failure", 
			"OK"
		);
    }
    if (validateSecret(backupcode)) {
        // this is a secret
		return navigator.notification.alert("You have entered an XRPL secret. You can import this into Toast Wallet but first you must create a Wallet to hold it. Follow the prompts to set your pin and passphrase then at the end tap (+) and `Add Existing Address` and enter your secret into that screen.", 
			function() {
                showTab(-1);
                doResetPin('', function(){showTab('#tabsetpassphrase');}, function(){}, true);
                unblockInput();
			}, 
			"Success", 
			"OK"
		);
    }
    if (/^(?:(?:[aeioubcdfghjklmnprstvwxyz]|(?:qu|tt|ch|sh))+ ){5}(?:[aeioubcdfghjklmnprstvwxyz]|(?:qu|tt|ch|sh))+$/im.test(backupcode)) {
        return navigator.notification.alert("This is a recovery phrase, not a backup code. Your backup code is a long code you were prompted to write down when you set up your wallet and added your first address.",
            ()=>{
                unblockInput();
            },
            "Failure",
            "OK"
        );
    }
    // run the backup checker
    var check = doCheckBackup(backupcode);
    if (check.error) {
        setHtml('#divrestorerror', "Errors were found in your backup code:<br/>" + check.error + "<br/>");
        var dre = byId('divrestorerror');
        if (dre) {
            dre.style.color = '#ffeb3b';
            dre.style.textAlign = 'center';
        }
        return navigator.notification.alert("Your backup contained errors! This could happen if you miscopied it or it has been damaged or truncated. Check you copied the whole text.", ()=>{unblockInput();}, "Failure", "OK");
    }
    var backupcode2 = check.cleanedbackupcode; // this is the rebuilt backup code returned by the checker, we'll use it only if the raw backup doesn't work
	importWallet(
		backupcode,
		function() {
			db.upsert("lastbackupreminder",
				function(doc) {
					return { data: JSON.stringify({"lastreminder": "" + Math.floor(new Date().getTime()/1000) })	}; 
			});
		
			navigator.notification.alert("Backup restored successfully!", 
				function() {
					unblockInput();
					doShowLogin();
				}, 
				"Success", 
				"OK"
			);
		},
		function() {
            // try again with the cleanedbackup from the checker
            importWallet(
                backupcode2,
                function() {
                    db.upsert("lastbackupreminder",
                        function(doc) {
                            return { data: JSON.stringify({"lastreminder": "" + Math.floor(new Date().getTime()/1000) })	}; 
                    });
                
                    navigator.notification.alert("Your backup was damaged. It has been repaired and restored.", 
                        function() {
                            unblockInput();
                            doShowLogin();
                        }, 
                        "Warning", 
                        "OK"
                    );
                },
                function() {
                    navigator.notification.alert("Invalid backup. Check that you copied the whole text.",
                        function() {
                            unblockInput();
                        },
                        "Error",
                        "OK"
                    );
                }
            );
            
		}
	);
}

function doRestoreBackup() {
	if (debug) console.log('doRestoreBackup');
	blockInput();
	if (domData('#tabrestore .toggleswitch', 'checked') != 'true') {
		navigator.notification.alert("You must acknowledge that you understand this will DESTROY your current wallet.", 
			function(){
				unblockInput();
			}, 
			"STOP",
			"OK"
		);
		return;
	}
    if (getVal('#restorebackup').trim().toLowerCase() == 'delete') {
        return db.upsert("accounts", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("ppdata", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("rpdata", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("pindata", function(doc) { return { data: "" }; }).then(function() {
                                unblockInput();
                                showEl('#btnbootstrapsequence');
                                showEl('#btnbootstraprestorebackup');
                                normalboot();
        })})})});
    }
    importWallet(
        getVal('#restorebackup'),
        function() {
            db.upsert("lastbackupreminder",
                function(doc) {
                    return { data: JSON.stringify({"lastreminder": "" + Math.floor(new Date().getTime()/1000) })	}; 
            });
        
            navigator.notification.alert("Backup restored successfully!", 
                function() {
                    unblockInput();
                    doShowLogin();
                }, 
                "Success", 
                "OK"
            );
        },
        function() {
            navigator.notification.alert("Invalid backup. Check that you copied the whole text.",
                function() {
                    unblockInput();
                },
                "Error",
                "OK"
            );
        }
    );
}

function exportWallet(exportfunc) {
	//todo: allow partial backup?
	var f = function() {
		navigator.notification.alert("Either your wallet is empty or it has become corrupted. Please generate your addresses first!", function(){ unblockInput(); showTab("#tabaccounts"); }, "Error", "OK");
	}
	db.get("pindata").then(function(pindata) {
		db.get("ppdata").then(function(ppdata) {
			db.get("rpdata").then(function(rpdata) {
				db.get("accounts").then(function(accounts) {
		
					var exp = {walletversion: "1.0"};
					if (pindata.data != undefined) { exp['pindata'] = JSON.parse(pindata.data); }
					if (ppdata.data != undefined) { exp['ppdata'] = JSON.parse(ppdata.data); }
					if (rpdata.data != undefined) { exp['rpdata'] = JSON.parse(rpdata.data); }
					if (accounts.data != undefined) { exp['accounts'] = JSON.parse(accounts.data); }
					var json =  JSON.stringify(exp);
					exportfunc(sodium.crypto_generichash(4, json, '', 'hex') + json);
				}).catch(f);
			}).catch(f);
		}).catch(f);
	}).catch(f);
}

function importWallet(wallet, successfunc, failurefunc) {
	if (debug) console.log("importWallet");
	if (wallet.length < 8) return failurefunc();
	wallet = ("" + wallet).trim();
	var hash = wallet.slice(0, 8);
	wallet = wallet.slice(8);
	if (hash != sodium.crypto_generichash(4, wallet, '', 'hex')) return failurefunc();
	try {
		wallet = JSON.parse(wallet);
	} catch(e) { handle_error(e); return failurefunc(); }
	if (wallet.pindata == undefined || wallet.ppdata == undefined || wallet.rpdata == undefined || wallet.accounts == undefined) return failurefunc();
	var f1;
	var f2; 
	var f3;
        db.get("pindata").then(f1 = function(pindata) {
                db.get("ppdata").then( f2 = function(ppdata) {
                        db.get("rpdata").then( f3 = function(rpdata) {
				db.upsert("pindata",
				function(doc) {
					return { data: JSON.stringify(wallet.pindata)}; 
				}).then(function(x){
					db.upsert("ppdata",
					function(doc) {
						return { data: JSON.stringify(wallet.ppdata)}; 
					}).then(function(x){
						db.upsert("rpdata",
						function(doc) {
							return { data: JSON.stringify(wallet.rpdata)}; 
						}).then(function(x){
							db.upsert("accounts",
							function(doc) {
								return { data: JSON.stringify(wallet.accounts)}; 
							}).then(function(x){
								successfunc();
							}).catch(function(x){
								db.upsert("pindata", function(doc) { return { data: pindata }; }).then(function() {
									db.upsert("ppdata", function(doc) { return { data: ppdata }; }).then(function() {
										db.upsert("rpdata", function(doc) { return { data: rpdata }; }).then(function() {
											failurefunc();
										}).catch(failurefunc);
									}).catch(failurefunc);
								}).catch(failurefunc);
								});
						}).catch(function(x){
							// wind back pindata and ppdata
							db.upsert("pindata", function(doc) { return { data: pindata }; }).then(function() {
								db.upsert("ppdata", function(doc) { return { data: ppdata }; }).then(function() {
									failurefunc();
								}).catch(failurefunc);
							}).catch(failurefunc);
						});
					}).catch(function(x){
						// wind back pindata
						db.upsert("pindata", function(doc) { return { data: pindata }; }).then(function() {
							failurefunc();
						}).catch(failurefunc);
					});
				}).catch(function(x){
					failurefunc();
				});
			}).catch(function(e) {
				f3("");
			});
                }).catch(function(e) {
			f2("");
		});
        }).catch(function(e) {
		f1("");
	});
}

function doCheckBackup(raw) {
    function escapeHtml(text) {
        if (text === undefined || text === null) return '';
        return (text + '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    var allowedkeys = ["walletversion", "pindata", "ppdata", "rpdata", "accounts"];
    function isvalidhex(h) {
        if (typeof h === 'object') {
            for (var i in h) {
                if (typeof h[i] === 'object' && !isvalidhex(h[i])) return false;
                else if (!/^[a-f0-9]+$/m.test(h[i]) || !fromhex_chksum(h[i])) return false;
            }
            return true;
        } else {
            return h.length % 2 == 0 && /^[a-f0-9]+$/m.test(h) && fromhex_chksum(h);
        }
    }
    var output = "";
    raw = raw.replace(/ |\r|\n/mg, "");
    raw = raw.replace(/;/mg, ":");
    raw = raw.replace(/[\u2018\u2019\u201C\u201D`\u2032\u2033']/mg, '"');
    
    setVal('#backupcode', raw);
    var json = raw; 
    // pull off the front checksum we dont need it
    while (json != '' && json.charAt(0) != '{') json = json.slice(1);
    try {
        var backup = JSON.parse(json);
        
        
        for (var i in backup) {
            if (allowedkeys.indexOf(i) == -1) {
                output += "JSON key: " + escapeHtml(i) + " is not valid, should be one of " + '"walletversion", "pindata", "ppdata", "rpdata", "accounts"' + "<br />";
            }
        }
        if (backup['pindata'] == undefined) output += "pindata is missing<br/>";
        else {
            if (backup['pindata']['hash'] == undefined) output += "pindata.hash is missing<br/>";
            if (backup['pindata']['salt'] == undefined) output += "pindata.salt is missing<br/>";
            if (!isvalidhex(backup['pindata']['hash'])) output += "pindata.hash is invalid<br/>";
            if (!isvalidhex(backup['pindata']['salt'])) output += "pindata.salt is invalid<br/>";
        }
        if (backup['ppdata'] == undefined) output += "ppdata is missing<br/>";
        else {
            if (backup['ppdata']['hash'] == undefined) output += "ppdata.hash is missing<br/>";
            if (!isvalidhex(backup['ppdata']['hash'])) output += "ppdata.hash is invalid<br/>";
            if (backup['ppdata']['salt1'] == undefined) output += "ppdata.salt1 is missing<br/>";
            if (!isvalidhex(backup['ppdata']['salt1'])) output += "ppdata.salt1 is invalid<br/>";
            if (backup['ppdata']['salt2'] == undefined) output += "ppdata.salt2 is missing<br/>";
            if (!isvalidhex(backup['ppdata']['salt2'])) output += "ppdata.salt2 is invalid<br/>";
        }
        if (backup['rpdata'] == undefined) output += "rpdata is missing<br/>";
        else {
            if (backup['rpdata']['hash'] == undefined) output += "rpdata.hash is missing<br/>";
            if (!isvalidhex(backup['rpdata']['hash'])) output += "rpdata.hash is invalid<br/>";
            if (backup['rpdata']['salt1'] == undefined) output += "rpdata.salt1 is missing<br/>";
            if (!isvalidhex(backup['rpdata']['salt1'])) output += "rpdata.salt1 is invalid<br/>";
            if (backup['rpdata']['salt2'] == undefined) output += "rpdata.salt2 is missing<br/>";
            if (!isvalidhex(backup['rpdata']['salt2'])) output += "rpdata.salt2 is invalid<br/>";
            if (backup['rpdata']['erk'] == undefined) output += "rpdata.erk is missing<br/>";
            if (!isvalidhex(backup['rpdata']['erk'])) output += "rpdata.erk is invalid<br/>";
        }
        var accounts = backup['accounts'];
        for (var i in accounts) {
            try {
                xrpl.decodeAccountID(i);
                var escapedI = escapeHtml(i);
                if (accounts[i]['ppsalt'] == undefined) output += "Account " + escapedI + " ppsalt missing<br/>";
                if (!isvalidhex(accounts[i]['ppsalt'])) output += "Account " + escapedI + " ppsalt invalid<br/>";
                if (accounts[i]['rpsalt'] == undefined) output += "Account " + escapedI + " rpsalt missing<br/>";
                if (!isvalidhex(accounts[i]['rpsalt'])) output += "Account " + escapedI + " rpsalt invalid<br/>";
                if (accounts[i]['ppsecret'] == undefined) output += "Account " + escapedI + " ppsecret missing<br/>";
                if (!isvalidhex(accounts[i]['ppsecret'])) output += "Account " + escapedI + " ppsecret invalid<br/>";
                if (accounts[i]['rpsecret'] == undefined) output += "Account " + escapedI + " rpsecret missing<br/>";
                if (!isvalidhex(accounts[i]['rpsecret'])) output += "Account " + escapedI + " rpsecret invalid<br/>";
            } catch (e) {
                output += "Account " + escapeHtml(i) + " invalid, check that it was transcribed correctly<br/>";
            }
        }
        var json = JSON.stringify(backup);
        return {cleanedbackupcode: sodium.crypto_generichash(4, json, '', 'hex') + json, error: (output == "" ? false : output) };
    } catch(e) {
        output +=  "<br/><b>" + escapeHtml(e) + "</b>";	
        var json = JSON.stringify(backup);
        return {cleanedbackupcode: ( json != undefined ? sodium.crypto_generichash(4, json, '', 'hex') + json : false ), error: (output == "" ? false : output) };
    }
    
}

// Expose functions globally
window.showBackupReminderTab = showBackupReminderTab;
window.doGenerateBackup = doGenerateBackup;
window.getLastBackupReminder = getLastBackupReminder;
window.getLastDonation = getLastDonation;
window.doRestoreBackupFreshInstall = doRestoreBackupFreshInstall;
window.doRestoreBackup = doRestoreBackup;
window.exportWallet = exportWallet;
window.importWallet = importWallet;
window.doCheckBackup = doCheckBackup;
},{}],18:[function(require,module,exports){
'use strict';

function showAccountFlags(account, dontshow) {
    blockInput();
    setVal('#afaddress', dispaddr(account));
    domData('#afaddress', 'content', account);
    var toggles = [ "#tglDefaultRipple", "#tglDepositAuth", "#tglDisableMasterKey", "#tglDisallowIncomingXRP", "#tglGlobalFreeze", "#tglNoFreeze", "#tglRequireAuthorization", "#tglRequireDestinationTag"];
    // special instructions for disable master key
    setToggleSwitch('#tglDisableMasterKey', (offlinemode ? 'unknown' : false), (tgl) => {
        blockInput();
        var checked = (offlinemode ? 'unknown' : domData(tgl, 'checked') != 'true');
        // flip the switch back -- they can't change this setting on this screen
        setToggleSwitch('#tglDisableMasterKey', checked);
        return navigator.notification.alert("Master key cannot be enabled or disabled here, it is shown for information only. Please use Rekey in the Account Details screen instead.", 
            function(){
                unblockInput();
            }, 
            "WARNING", 
            "OK"
        );                
    });
   
    if (offlinemode) {
        // in offline set the toggles to an unknown state
        for (var i in toggles) if (toggles[i] != '#tglDisableMasterKey') setToggleSwitch(toggles[i], 'unknown', 
                (tgl) => {
                    blockInput();
                    // on toggle action count toggles currently set then prevent them setting a new one because offline mode limits to one toggle setting
                    var c = 0;
                    for (var n in toggles) {
                        if (domData(toggles[n], 'checked') != 'unknown') c++;
                        if (c > 1) {
                            setToggleSwitch(tgl, 'unknown');
                            return navigator.notification.alert("Unfortunately in offline mode it is only possible to set one account flag at a time.", 
                                function(){
                                    unblockInput();
                                }, 
                                "WARNING", 
                                "OK"
                            );
                        }
                    }
                    unblockInput();
                }, true);
        if (!dontshow) showTab('#tabaccountflags', true);
    } else {
        var flags = {};
        // then check any entries we have values for
        if (accountflags[account] != undefined) flags = accountflags[account];
        if (!dontshow) showTab('#tabaccountflags', true);
        setToggleSwitch("#tglDefaultRipple", flags['defaultRipple'] === true);
        setToggleSwitch("#tglDepositAuth", flags['depositAuth'] === true);
        setToggleSwitch("#tglDisableMasterKey", flags['disableMasterKey'] === true);
        setToggleSwitch("#tglDisallowIncomingXRP", flags['disallowIncomingXRP'] === true);
        setToggleSwitch("#tglGlobalFreeze", flags['globalFreeze'] === true);
        setToggleSwitch("#tglNoFreeze", flags['noFreeze'] === true);
        setToggleSwitch("#tglRequireAuthorization", flags['requireAuthorization'] === true);
        setToggleSwitch("#tglRequireDestinationTag", flags['requireDestinationTag'] === true);
    }
 
    unblockInput();
}

function doSetAccountFlags(nonce) {
	if (debug) console.log("doSetAccountFlags");
	blockInput();
	var afaddress = getVal("#afaddress").trim();
    var defaultRipple = domData('#tglDefaultRipple', 'checked');
    var depositAuth = domData('#tglDepositAuth', 'checked');
    var disableMasterKey = domData('#tglDisableMasterKey', 'checked');
    var disallowIncomingXRP = domData('#tglDisallowIncomingXRP', 'checked');
    var globalFreeze = domData('#tglGlobalFreeze', 'checked');
    var noFreeze = domData('#tglNoFreeze', 'checked');
    var requireAuthorization = domData('#tglRequireAuthorization', 'checked');
    var requireDestinationTag = domData('#tglRequireDestinationTag', 'checked');
    var offlinecode = getVal('#afofflinecode').trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
    if (offlinemode) {
        var ofl = validateOfflineCode(offlinecode, '#atlofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
    var flag_keys = ['defaultRipple', 'depositAuth', 'disableMasterKey', 'disallowIncomingXRP', 'globalFreeze', 'noFreeze', 'requireAuthorization', 'requireDestinationTag'];  
    // check which flags have changed
    var old_flags_orig = {};
    var old_flags = {};
    if (accountflags[afaddress] != undefined) old_flags_orig = accountflags[afaddress];
    for (var i in flag_keys) old_flags[flag_keys[i]] = (offlinemode ? 'unknown' : (flag_keys[i] in old_flags_orig && old_flags_orig[flag_keys[i]]));
    var nextscreen = function(){ 
        var confirmfl_obj = {
            afaddress: forceraddr(afaddress),
            defaultRipple: (defaultRipple == '' + old_flags['defaultRipple'] ? 'unchanged' : defaultRipple),
            depositAuth: (depositAuth == '' + old_flags['depositAuth'] ? 'unchanged' : depositAuth),
            disableMasterKey: (disableMasterKey == '' + old_flags['disableMasterKey'] ? 'unchanged' : disableMasterKey),
            disallowIncomingXRP: (disallowIncomingXRP == '' + old_flags['disallowIncomingXRP'] ? 'unchanged' : disallowIncomingXRP),
            globalFreeze: (globalFreeze == '' + old_flags['globalFreeze'] ? 'unchanged' : globalFreeze),
            noFreeze: (noFreeze == '' + old_flags['noFreeze'] ? 'unchanged' : noFreeze),
            requireAuthorization: (requireAuthorization == '' + old_flags['requireAuthorization'] ? 'unchanged' : requireAuthorization),
            requireDestinationTag: (requireDestinationTag == '' + old_flags['requireDestinationTag'] ? 'unchanged' : requireDestinationTag),
            nonce: nonce,
            accseqid: accID, // used for offline tx
            ledseqid: ledID,
            fee: fee
        };
        var changedflagcount = (confirmfl_obj.defaultRipple != 'unchanged' ? 1 : 0) + (confirmfl_obj.depositAuth != 'unchanged' ? 1 : 0) + (confirmfl_obj.disableMasterKey != 'unchanged' ? 1 : 0) + (confirmfl_obj.disallowIncomingXRP != 'unchanged' ? 1 : 0) + (confirmfl_obj.globalFreeze != 'unchanged' ? 1 : 0) + (confirmfl_obj.noFreeze != 'unchanged' ? 1 : 0) + (confirmfl_obj.requireAuthorization != 'unchanged' ? 1 : 0) + (confirmfl_obj.requireDestinationTag != 'unchanged' ? 1 : 0);
        if (changedflagcount == 0) return navigator.notification.alert("You have not made any changes to submit.", ()=>{unblockInput();}, "ERROR", "OK");
            
        confirmfl = confirmfl_obj;
        confirmfl['changedflagcount'] = changedflagcount;
        confirmflhash = sodium.crypto_generichash(16, JSON.stringify(confirmfl), ''+nonce, 'hex');
        setText('#cafaddress', afaddress);
        setText('#cafdefaultripple', '' + confirmfl.defaultRipple);
        setText('#cafdepositauth', '' + confirmfl.depositAuth);
        setText('#cafdisablemasterkey', '' + confirmfl.disableMasterKey);
        setText('#cafdisallowincomingxrp', '' + confirmfl.disallowIncomingXRP);
        setText('#cafglobalfreeze', '' + confirmfl.globalFreeze);        
        setText('#cafnofreeze', '' + confirmfl.noFreeze);
        setText('#cafrequireauthorization', '' + confirmfl.requireAuthorization);        
        setText('#cafrequiredestinationtag', '' + confirmfl.requireDestinationTag);       
        
        setText('#cafnotransactions', changedflagcount + ' transactions');
        showTab("#tabaccountflagsconfirm");
        
        unblockInput();
    };
    checkAccountIsFunded(afaddress, 0.1, 'XRP', '', function(){
			navigator.notification.confirm("You must have " + xrpreserve + " XRP + 5 XRP for each trustline in the account you are sending from. This reserve is a XRP Ledger requirement. In some circumstances this message may appear in error if you believe that to be the case you can opt to attempt the transaction however this will attract a XRP Ledger fee." , 
				function(b){
					if (debug) console.log("button selected: " + b);
					if (b == 1) {
						nextscreen();
					} else {
						var atla = byId('atladdress');
						if (atla) atla.focus();
						unblockInput();
					}
				}, 
				"XRP Reserve not met", 
				[ "Try anyway", "Cancel" ]
                );},
                function() {
					var atla = byId('atladdress');
					if (atla) atla.focus();
					unblockInput();                    
                }, nextscreen);
}

function doConfirmAccountFlags(passphrase) {
	if (debug) console.log("doConfirmAccountFlags");
	if (confirmfl.nonce == lastsetflagsnonce) {
		// this is an accidental double tap
		return;
	} 
	blockInput();
	lastsetflagsnonce = confirmfl.nonce;
	validatePassphrase(passphrase, false,
		function() {
			if (confirmfl == undefined || confirmfl.nonce == undefined || sodium.crypto_generichash(16, JSON.stringify(confirmfl), ''+confirmfl.nonce, 'hex') != confirmflhash ) {
				navigator.notification.alert("An error occured when trying to submit your settings change request. No settings change occured.", 
					function(){
						showTab(-1);
						unblockInput();
					}, 
					"Error", 
					"OK"
				);
				return;
			}
            if (offlinemode) {
                // we're just going to create the tx as a QR code and display it
				navigator.notification.alert("A QR code of this signed account-flags transaction has been generated. Scan it using your online device to complete the transaction.", 
					function(){
                        return sendAccountFlagsTxOffline(passphrase, confirmfl.afaddress, confirmfl.defaultRipple, confirmfl.depositAuth, confirmfl.disableMasterKey, confirmfl.disallowIncomingXRP, confirmfl.globalFreeze, confirmfl.noFreeze, confirmfl.requireAuthorization, confirmfl.requireDestinationTag, confirmfl.accseqid, confirmfl.ledseqid, confirmfl.fee);
                    }, 
					"Offline Transaction", 
					"OK"
				);            
                return;
            }
			checkConnection(
				function(){
					sendAccountFlagsTx(passphrase, confirmfl.afaddress, confirmfl.defaultRipple, confirmfl.depositAuth, confirmfl.disableMasterKey, confirmfl.disallowIncomingXRP, confirmfl.globalFreeze, confirmfl.noFreeze, confirmfl.requireAuthorization, confirmfl.requireDestinationTag, 
						function(wasqueued){
								navigator.notification.alert("Your account flags transaction(s) were submitted successfully.", 
									function(){
										clearPaymentScreen();
										showTab("#tabaccounts");
										unblockInput();
									}, "Success", "OK"); 
						}, 
						function(err) {
							navigator.notification.alert("An error occured when trying to set your account flags. If you were attempting to set multiple flags some of them may have been set." + err, 
							function(){
								lastsetflagsnonce = "";
								unblockInput();
							}, 
							"Error", "OK");
						}
					);
				}
			);
		},
		function() { 
			navigator.notification.alert("Your passphrase is incorrect. You cannot use a recoveryphrase here.", 
				function(){
					lastsetflagsnonce = "";
					unblockInput();
				},				
				"Error", "OK"
			);
		},
		function() { 
			navigator.notification.alert("Could not set account flags due to possible wallet corruption. We recommend backing up your wallet and reinstalling.", 
				function(){
					lastsetflagsnonce = "";
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		}
	);
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.showAccountFlags = showAccountFlags;
    window.doSetAccountFlags = doSetAccountFlags;
    window.doConfirmAccountFlags = doConfirmAccountFlags;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showAccountFlags,
        doSetAccountFlags,
        doConfirmAccountFlags
    };
}
},{}],19:[function(require,module,exports){
'use strict';

function doShowLogin() {
	if (debug) console.log("doShowLogin");
    if (paylink_pending != null) addClass('#tablogin>center>div', 'pinpad_pending');
    runPinPad("#tablogin", function(pin) {
		validatePin(pin, function() {
			hideEl("#btnbootstrapsequence");
            if (paylink_pending == null) {
                showTab("#tabaccounts");
            } else {
                removeClass('#tablogin>center>div', 'pinpad_pending');
                doPayLink(); 
            }
		}, function() {
			hideEl("#btnbootstrapsequence");
            setTimeout(function() {
                doShakeAndClearPinPad(function() {});
            }, 0);
		}, function() {
			hideEl("#btnbootstrapsequence");
			showTab("#tablicense");
		});
		return true;
	}, function(pin) { // we don't use the success and failure functions in this use case
	}, function(pin) { // because the validation function is async, so we piggyback it above
	});
}

function runPinPad(tab, validationfunc, successfunc, failurefunc) {
	if (debug) console.log("runPinPad");
	pinpadvalidate = validationfunc;
	pinpadsuccess = successfunc;
	pinpadfailure = failurefunc;
	if (tab != "" && tab != undefined) showTab(tab);
}

function normalboot () {
	/* To kick off the application, we attempt to validate an always incorrect pin
	** of zero length, this will then in turn fire either the login procedure or
	** license and setup procedure. 
	*/
	if (emergencybackup) {
		hideSpinner();
		doGenerateBackup();
	} else if (offlinemode) {
		hideSpinner();
		validatePin("",
			doShowLogin,
			doShowLogin,
			function() {showTab("#tablicense");}
		);
	} else {
		validatePin("",
			function() { connectToRipple(doShowLogin); },
			function() { connectToRipple(doShowLogin); },
			function() { connectToRipple(function() {showTab("#tablicense");}); }
		);
	}
}

function recoveryboot(corruption) {
	var msg = "Your wallet data appears to be corrupted. Here's what we know: " + 
		"PIN: " + corruption.pindata + ", Passphrase: " + corruption.ppdata + 
		", Recovery Data: " + corruption.rpdata + ", Accounts: " + corruption.accounts;
	corruptionstate = corruption;
	navigator.notification.alert(msg, function(){
		hideSpinner(); 
		showTab("#tabcorruptionprompt");
		}, 
		"Data Error", 
		"OK"
	);
}

function doPinPad(x) {
	if (debug) console.log("doPinPad");
	var val = x.trim();
	if ((val == "" || val == undefined) && enteredpin != "") {
		enteredpin = enteredpin.slice(0,-1);
	}
	if (val == "Help") {
		showTab("#tabrecovery");
		pin = "";
		return;
	}
	if (enteredpin.length < PIN_MAX) enteredpin += val;
	
	setTimeout(renderEnteredPin, 0);
	if (enteredpin.length == PIN_MAX) {
		if (pinpadvalidate(enteredpin)) {
			renderEnteredPin();
			pinpadsuccess(enteredpin);
			enteredpin = "";
			renderEnteredPin();
		} else {
			setTimeout(function() {
				doShakeAndClearPinPad(function() { pinpadfailure(enteredpin); });
			}, 0);
		}
	}
}

function doShakeAndClearPinPad(afterfunc) {
	removeClass(".pinpad", "shake");
	blockInput(true);
	setTimeout(function(){
		addClass(".pinpad", "shake");
		setTimeout(
			function() {
				enteredpin = "";
				renderEnteredPin();
				removeClass(".pinpad", "shake");
				unblockInput();
				afterfunc();
			}, 500);
	}, 0);
}

function renderEnteredPin() {
	for (var i = 1; i <= PIN_MAX; i++) {
		const pinIcons = qsa(".pinnumber>i:nth-of-type("+i+")");
		if (i <= enteredpin.length) {
			removeClass(pinIcons, "far");
			addClass(pinIcons, "fa");
		} else {
			addClass(pinIcons, "far");
			removeClass(pinIcons, "fa");
		}
	}
	refreshWebView();
}

function doFinishSetup() {
	if (debug) console.log("doFinishSetup");
	blockInput();
	if (domData("#tglsw1", 'checked') != "true" || domData("#tglsw2", 'checked') != "true") {
		navigator.notification.alert("You must confirm that you've written your recovery phrase down and that you understand it's not a backup.", 
			function(){
				unblockInput();
			}, 
			"STOP", 
			"OK"
		);
		return;
	}
	// destroy the data from memory
	emptyEl("#showrecoveryphrase");
	// we're all done
	showTab("#tabaccounts");
	unblockInput();
}

function restart() {
		validateDataStores(
			normalboot,
			normalboot,
			recoveryboot
		);
}

function __freshinstall() {
                navigator.notification.alert("Due to corruption the app will re-install. Afterwards restore a backup from the settings menu if you have one.",
                function() {
                        db.upsert("accounts", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("ppdata", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("rpdata", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("pindata", function(doc) { return { data: "" }; }).then(function() {
                                normalboot();
                        })})})});
                }, "Fresh Install", "OK");
        }

// Expose functions globally
if (typeof window !== 'undefined') {
    window.doShowLogin = doShowLogin;
    window.runPinPad = runPinPad;
    window.normalboot = normalboot;
    window.recoveryboot = recoveryboot;
    window.doPinPad = doPinPad;
    window.doShakeAndClearPinPad = doShakeAndClearPinPad;
    window.renderEnteredPin = renderEnteredPin;
    window.doFinishSetup = doFinishSetup;
    window.restart = restart;
    window.__freshinstall = __freshinstall;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        doShowLogin,
        runPinPad,
        normalboot,
        recoveryboot,
        doPinPad,
        doShakeAndClearPinPad,
        renderEnteredPin,
        doFinishSetup,
        restart,
        __freshinstall
    };
}
},{}],20:[function(require,module,exports){
'use strict';

function showNewOrder(account, direction, currency, issuer, balance, bid, ask) {
    if (debug) console.log("showNewOrder - direction: " + direction + ", currency: " + currency + ", issuer: " + issuer + ", balance: " + balance + ", bid: " + bid + ", ask: " + ask); 
    setVal('#ntloaddress', dispaddr(account));
    domData('#ntloaddress', 'content', account);
    domData('#ntloaddress', 'direction', direction);
    if (direction == 'sell') {
        showEl('#lblntlosell');
        hideEl('#lblntlobuy');
    } else {
        hideEl('#lblntlosell');
        showEl('#lblntlobuy');
    }
    setVal('#ntloissuer', currency + ' - ' + dispaddr(issuer));
    domData('#ntloissuer', 'currency', currency);
    domData('#ntloissuer', 'issuer', issuer);
    removeAttr('#btnntloall', 'ontouchend');
    setAttr('#btnntloall', 'ontouchend', "te(event, ()=>{setVal('#ntloamount', " + balance + "); renderOrderPreview();})");
    if (direction == 'buy') {
        // use minimum ask
        setVal('#ntloprice', ask);
    } else {
        // use minimum bid
        setVal('#ntloprice', bid);
    }
    setVal('#ntloamount', '1');
    hideEl('#customexpirydiv');
    showEl('#ntloexpiry');
    if (typeof setSelectVisible === 'function') setSelectVisible('#ntloexpiry', true);
    var expEl = byId('ntloexpiry');
    if (expEl) {
        for (var i = 0; i < expEl.options.length; i++) expEl.options[i].selected = false;
        var opt24h = byId('ntloexpiry-24h');
        if (opt24h) opt24h.selected = true;
    }
    if (typeof refreshSelect === 'function') refreshSelect('#ntloexpiry');
    renderOrderPreview(direction == 'sell');
    showTab('#tabneworder', true);
}

function onToggleNewOrder() {
    if (debug) console.log("onToggleNewOrder()");
    blockInput();
    // enforce the mutually exclusive options in the order screen toggles
    //https://github.com/ripple/rippled/blob/817d2339b8632cb2f97d3edd6f7af33aa7631744/src/ripple/app/tx/impl/CreateOffer.cpp#L63
    
    var ioc = domData('#tglntloioc', 'checked') == 'true';
    var fok = domData('#tglntlofok', 'checked') == 'true';  
    if (ioc && fok) {
        return navigator.notification.alert("An order can have Fill-or-Kill or Immediate-or-Cancel but not both.", 
				function(){
                    setToggleSwitch('#tglntloioc', false);
                    setToggleSwitch('#tglntlofok', false);                    
					unblockInput();
				}, 
				"Error", 
				"OK"
		);
    }
    unblockInput();  
}

function renderOrderPreview(sell) {
    if (typeof(sell) == 'undefined') sell = isVisible('#lblntlosell');
    var currency = domData('#ntloissuer', 'currency');
    var amount1 = getVal('#ntloamount');
    if ((amount1=parseFloat(amount1 + '')) + '' == 'NaN') amount1 = 0;
    var price = getVal('#ntloprice');
    if ((price=parseFloat(price + '')) + '' == 'NaN') price = 0;
    var amount2 = price * amount1;
    var priceUpdate = byId('ntlopriceupdate');
    if (priceUpdate) {
        priceUpdate.style.border = (sell ? '1px solid rgb(217, 83, 79)' : '1px solid rgb(92, 184, 92)');
        priceUpdate.innerHTML = '<b>'+(sell ? 'SELL' : 'BUY')+'</b> <span class="currency">'+currency+'</span> '+display_currency_amount(amount1)+' for <span class="currency">XRP</span>'+display_currency_amount(amount2);
    }
}

function adjustOrderPrice(x) {
    var previous = parseFloat(''+getVal('#ntloprice'));
    if (previous + '' == 'NaN' || (previous == 0 && x > 0)) previous  = 0.000001;
	
    x = ( x >= 0 ? 1 : -1 );
    var next = previous + x * Math.pow(10, Math.floor(Math.log(previous)/Math.log(10))-3);
    var roundingpower = Math.pow(10, -Math.floor(Math.log(previous)/Math.log(10)) + 3);
    next *= roundingpower;
    next = Math.round(next);
    next /= roundingpower;
    if (next + '' == 'NaN' || next <= 0) next = previous;
	setVal('#ntloprice', "" + next);
    renderOrderPreview();
}

function doPlaceCancelOrder(nonce, dataset) {
    // needed
    var account;
    var seq;
    var offlinecode;
    var accID = '';
    var ledID = '';
    var fee = '';
    // extra
    var currency1;
    var amount1;
    var currency2;
    var amount2;
    var direction;
    var sell;
    var issuer;
    
	if (debug) console.log("doPlaceCancelOrder");
	blockInput();
    if (typeof(dataset) !== 'undefined') {
       account = dataset.account;
       seq = dataset.seq;
       issuer = dataset.issuer;
       currency1 = dataset.currency1;
       amount1 = dataset.amount1;
       currency2 = dataset.currency2;
       amount2 = dataset.amount2;
       sell = dataset.sell;
    }
	var nextscreen = function() {
        confirmcancelorder = { 
            account: forceraddr(account),
            seq: seq,
            nonce: nonce,
            accseqid: accID, // used for offline tx
            ledseqid: ledID,
            fee: fee
        };
		confirmcancelorderhash = sodium.crypto_generichash(16, JSON.stringify(confirmcancelorder), ''+nonce, 'hex');
		setText('#confirmcancelorderaccount', dispaddr(account));
        setText('#confirmcancelorderpreview', (sell ? 'SELL ' : 'BUY ') + currency1 + ' ' + display_currency_amount(parseFloat(''+amount1)) + ' @ ' + currency2 + ' ' + display_currency_amount(parseFloat(''+amount2)/parseFloat(''+amount1)));
        setText('#confirmcancelordersequence', '#' + seq);
		showTab("#tabcancelorderconfirm");
		
		unblockInput();
	};
    return nextscreen();
}

function doPlaceOrder(nonce) {
	if (debug) console.log("doPlaceOrder");
	blockInput();
	var account = domData('#ntloaddress', 'content');
	var asset = domData('#ntloissuer', 'currency');
	var issuer = domData('#ntloissuer', 'issuer');
	var amount = getVal('#ntloamount').trim();
	var price = getVal('#ntloprice').trim();    
    var sell = isVisible('#lblntlosell');
    var fok = domData('#tglntlofok', 'checked') == 'true';
    var ioc = domData('#tglntloioc', 'checked') == 'true';
    var passive = domData('#tglntlopas', 'checked') == 'true';
    var expiry;
    var expiryunits;
    var expirydisplay; // what to show the user
    var expiryfocus; // what to focus on expiry entry error
    if (isVisible('#ntloexpiry')) {
        // using presets
        var expSelect = byId('ntloexpiry');
        var selOpt = (expSelect && expSelect.selectedOptions) ? expSelect.selectedOptions[0] : null;
        var hrs = selOpt ? domData(selOpt, 'hours') : 0;
        var mins = selOpt ? domData(selOpt, 'minutes') : 0;
        expiry = parseInt(hrs || 0) * 60.0 + parseInt(mins || 0);
        expiryunits = 'minute';
        expirydisplay = selOpt ? selOpt.innerText : '';
        expiryfocus = '#ntloexpiry';
    } else {
        // using custom
        expiry = getVal('#ntloexpirycustom');
        var unitSelect = byId('ntloexpirycustomunit');
        var selUnitOpt = (unitSelect && unitSelect.selectedOptions) ? unitSelect.selectedOptions[0] : null;
        expiryunits = selUnitOpt ? domData(selUnitOpt, 'unit') : '';
        expirydisplay = parseInt(expiry) + ' ' + (selUnitOpt ? selUnitOpt.innerText : '');
        expiryfocus = '#ntloexpirycustom';
    }
    var offlinecode = getVal('#ntloofflinecode').trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
	if (amount != undefined && (amount+"").charAt(0) == '.') amount = "0" + amount;
    if (offlinemode) {
        var ofl = validateOfflineCode(offlinecode, '#ntloofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
    // this shouldnt happen due to interface constraints
    if (ioc && fok) {
		return navigator.notification.alert("You cannot select both Immediate-or-Cancel and Fill-or-Kill.", 
			function(){
				unblockInput();
			}, 
			"Invalid selection", 
			"OK"
		);
    }
    var invalidAmount = ()=>{
		return navigator.notification.alert("Invalid amount. Must be greater than or equal to 0.", 
			function(){
                var na = byId("ntloamount");
                if (na) na.focus();
				unblockInput();
			}, 
			"Invalid amount", 
			"OK"
		);
    };
    // ensure theres no garbage in the amount field
    if (!/^[0-9\.]+$/m.test(amount) ) return invalidAmount();  
    try {
        var x = new BN(amount);
        if (x.isNeg() || x.isZero()) return invalidAmount();
    } catch (E) {
        return invalidAmount();
    }
    var invalidPrice = ()=>{
		return navigator.notification.alert("Invalid price. Must be greater than or equal to 0.", 
			function(){
                var np = byId("ntloprice");
                if (np) np.focus();
				unblockInput();
			}, 
			"Invalid amount", 
			"OK"
		);
    };
    // ensure theres no garbage in the price field
    if (!/^[0-9\.]+$/m.test(price) ) return invalidPrice();  
    try {
        var x = new BN(price);
        if (x.isNeg() || x.isZero()) return invalidPrice();
    } catch (E) {
        return invalidPrice();
    }
    // it should not be possible for this to happen but check anyway
	if (validateAddress(account)) {
		// valid
	} else {
		navigator.notification.alert("The account specified is not a valid XRP address.", 
			function(){
                var na = byId("ntloaddress");
                if (na) na.focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);
	}
	if (validateAddress(issuer)) {
		// valid
	} else {
		navigator.notification.alert("The issuer specified is not a valid XRP address.", 
			function(){
                var ni = byId("ntloissuer");
                if (ni) ni.focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);
	}
    if (!validateCurrency(asset)) {
		return navigator.notification.alert("Invalid currency code. Must be 3 characters A-Z, 0-9 or any of the following ? ! @ # $ % ^ & * < > ( ) { } [ ] |", 
			function(){
                var ni = byId("ntloissuer");
                if (ni) ni.focus();
				unblockInput();
			}, 
			"Invalid currency code", 
			"OK"
		);    
    }
    if (!/^[0-9]+$/m.test(expiry) || (expiry = parseInt(expiry) ) <= 0 ) {
        return navigator.notification.alert("Invalid expiry. Must be a whole number greater than 0.", 
            function(){
                var ef = resolveElement(expiryfocus);
                if (ef) ef.focus();
                unblockInput();
            }, 
            "Invalid expiry", 
            "OK"
        );
    }
    var expirylookup = { 'minute': 1, 'hour': 60, 'day': 1440, 'week': 10080, 'month': 43800, 'year': 525600 };
    // this shouldnt happen check anyway
    if (!(expiryunits in expirylookup)) {
        return navigator.notification.alert("Invalid expiry. Invalid expiry unit.", 
            function(){
                var ef = resolveElement(expiryfocus);
                if (ef) ef.focus();
                unblockInput();
            }, 
            "Invalid expiry", 
            "OK"
        );        
    }
    expiry = expiry * expirylookup[expiryunits] * 60000.0; // now expiry is in miliseconds
    expiryunits = "";
	var nextscreen = function() {
		confirmorder = { 
			account: forceraddr(account),
			asset: asset,
			issuer: issuer,
			amount: amount,
			price: price,            
            sell: sell,
            fok: fok,
            ioc: ioc,
            passive: passive,
            expiry: expiry,
			nonce: nonce,
            accseqid: accID, // used for offline tx
            ledseqid: ledID,
            fee: fee
		};
		confirmorderhash = sodium.crypto_generichash(16, JSON.stringify(confirmorder), ''+nonce, 'hex');
		setText('#confirmorderaccount', dispaddr(account));
		setText('#confirmorderasset', asset);
		setText('#confirmorderissuer', dispaddr(issuer));
        setText('#confirmorderamount', amount);
        setText('#confirmorderprice', price);
		setText('#confirmorderdirection', (sell ? 'SELL' : 'BUY'));
        setText('#confirmorderexpiry', expirydisplay);
        setText('#confirmorderextra', (passive ? 'PASSIVE' : ''));
        if (fok || ioc) setText('#confirmorderextra', getText('#confirmorderextra') + (passive ? ' + ' : '') + (fok ? 'FILL-OR-KILL' : 'IMMEDIATE-OR-CANCEL'));
        
        if (!passive && !fok && !ioc) {
            setText('#confirmorderextra', 'NONE');
        }
		showTab("#taborderconfirm");
		
		unblockInput();
	};
    return nextscreen();
}

function doConfirmCancelOrder(passphrase) {
	if (debug) console.log("doConfirmCancelOrder");
	if (confirmcancelorder.nonce == lastcancelordernonce) {
		// this is an accidental double tap
		return;
	} 
	blockInput();
	lastcancelordernonce = confirmcancelorder.nonce;
	validatePassphrase(passphrase, false,
		function() {
			if (confirmcancelorder == undefined || confirmcancelorder.nonce == undefined || sodium.crypto_generichash(16, JSON.stringify(confirmcancelorder), ''+confirmcancelorder.nonce, 'hex') != confirmcancelorderhash ) {
				navigator.notification.alert("An error occured when trying to submit your order cancellation. No change was made.", 
					function(){
						showTab(-1);
						unblockInput();
					}, 
					"Error", 
					"OK"
				);
				return;
			}
            if (offlinemode) {
                // we're just going to create the payment as a QR code and display it
				navigator.notification.alert("A QR code of this signed transaction has been generated. Scan it using your online device to complete the transaction.", 
					function(){
                        return sendOfferCancelOffline(passphrase, confirmcancelorder.account, confirmcancelorder.seq, confirmcancelorder.accseqid, confirmcancelorder.ledseqid, confirmcancelorder.fee);					
                    }, 
					"Offline Transaction", 
					"OK"
				);            
                return;
            }
			checkConnection(
				function(){
					sendOfferCancel(passphrase, confirmcancelorder.account, confirmcancelorder.seq,
						function(wasqueued){
                            navigator.notification.alert("Your cancel order request was successfully " + ( wasqueued ? "queued, and will be " : "" ) + "submitted to the XRP Ledger" + ( wasqueued ? " shortly." : "." ), 
                                function(){
                                    clearPaymentScreen();
                                    showTab("#tabaccounts");
                                    unblockInput();
                                }, "Success", "OK"); 
						
						}, 
						function(err) {
							navigator.notification.alert("An error occured when trying to submit your transaction. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your transaction details are incorrect or the receiving address has not been activated. " + err, 
							function(){
								lastcancelordernonce = "";
								showTab(-1);
								unblockInput();
							}, 
							"Error", "OK");
						}
					);
				}
			);
		},
		function() { 
			navigator.notification.alert("Your passphrase is incorrect. You cannot use a recoveryphrase here.", 
				function(){
					lastcancelordernonce = "";
					unblockInput();
				},				
				"Error", "OK"
			);
		},
		function() { 
			navigator.notification.alert("Could not submit transaction due to possible wallet corruption. We recommend backing up your wallet and reinstalling.", 
				function(){
					lastcancelordernonce = "";
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		}
	);
}

function doConfirmOrder(passphrase) {
	if (debug) console.log("doConfirmOrder");
	if (confirmorder.nonce == lastordernonce) {
		// this is an accidental double tap
		return;
	} 
	blockInput();
	lastordernonce = confirmorder.nonce;
	validatePassphrase(passphrase, false,
		function() {
			if (confirmorder == undefined || confirmorder.nonce == undefined || sodium.crypto_generichash(16, JSON.stringify(confirmorder), ''+confirmorder.nonce, 'hex') != confirmorderhash ) {
				navigator.notification.alert("An error occured when trying to make your payment. No payment was made.", 
					function(){
						showTab(-1);
						unblockInput();
					}, 
					"Error", 
					"OK"
				);
				return;
			}
            var expiry = new Date(new Date().getTime() + confirmorder.expiry).toISOString();
            if (offlinemode) {
                // we're just going to create the payment as a QR code and display it
				navigator.notification.alert("A QR code of this signed transaction has been generated. Scan it using your online device to complete the transaction.", 
					function(){
                        return sendOfferCreateOffline(passphrase, confirmorder.account, confirmorder.amount, confirmorder.asset, confirmorder.issuer, confirmorder.price, confirmorder.sell, confirmorder.fok, confirmorder.ioc, confirmorder.passive, expiry, confirmorder.accseqid, confirmorder.ledseqid, confirmorder.fee);					
                    }, 
					"Offline Transaction", 
					"OK"
				);            
                return;
            }
			checkConnection(
				function(){
					sendOfferCreate(passphrase, confirmorder.account, confirmorder.amount, confirmorder.asset, confirmorder.issuer, confirmorder.price, confirmorder.sell, confirmorder.fok, confirmorder.ioc, confirmorder.passive, expiry,
						function(wasqueued){
                            navigator.notification.alert("Your order was successfully " + ( wasqueued ? "queued, and will be " : "" ) + "submitted to the XRP Ledger" + ( wasqueued ? " shortly." : "." ), 
                                function(){
                                    clearPaymentScreen();
                                    showTab("#tabaccounts");
                                    unblockInput();
                                }, "Success", "OK"); 
						
						}, 
						function(err) {
							navigator.notification.alert("An error occured when trying to submit your transaction. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your transaction details are incorrect or the receiving address has not been activated. " + err, 
							function(){
								lastordernonce = "";
								showTab(-1);
								unblockInput();
							}, 
							"Error", "OK");
						}
					);
				}
			);
		},
		function() { 
			navigator.notification.alert("Your passphrase is incorrect. You cannot use a recoveryphrase here.", 
				function(){
					lastordernonce = "";
					unblockInput();
				},				
				"Error", "OK"
			);
		},
		function() { 
			navigator.notification.alert("Could not create order due to possible wallet corruption. We recommend backing up your wallet and reinstalling.", 
				function(){
					lastordernonce = "";
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		}
	);
}

function onNtloExpiryUnitChange() {
    var sel = byId('ntloexpirycustomunit');
    var opt = sel && sel.selectedOptions ? sel.selectedOptions[0] : qs('#ntloexpirycustomunit option:checked');
    if (opt && opt.id == 'ntloexpirycustomunit-nocustom') {
        hideEl('#customexpirydiv');
        showEl('#ntloexpiry');
        if (typeof setSelectVisible === 'function') setSelectVisible('#ntloexpiry', true);
        var opts = qsa('#ntloexpiry > option');
        for (var o of opts) { o.removeAttribute('selected'); o.selected = false; }
        var opt24 = byId('ntloexpiry-24h');
        if (opt24) { opt24.setAttribute('selected', 'selected'); opt24.selected = true; }
        if (typeof refreshSelect === 'function') refreshSelect('#ntloexpiry');
    } else {
        showEl('#customexpirydiv');
        hideEl('#ntloexpiry');
        if (typeof setSelectVisible === 'function') setSelectVisible('#ntloexpiry', false);
    }
}

function onNtloExpiryChange() {
    var sel = byId('ntloexpiry');
    var opt = sel && sel.selectedOptions ? sel.selectedOptions[0] : qs('#ntloexpiry option:checked');
    if (opt && opt.id == 'ntloexpiry-opt-custom') {
        showEl('#customexpirydiv');
        hideEl('#ntloexpiry');
        if (typeof setSelectVisible === 'function') setSelectVisible('#ntloexpiry', false);
        var opts = qsa('#ntloexpirycustomunit > option');
        for (var o of opts) { o.removeAttribute('selected'); o.selected = false; }
        var optHour = byId('ntloexpirycustomunit-hour');
        if (optHour) { optHour.setAttribute('selected', 'selected'); optHour.selected = true; }
        if (typeof refreshSelect === 'function') refreshSelect('#ntloexpirycustomunit');
    } else {
        hideEl('#customexpirydiv');
        showEl('#ntloexpiry');
        if (typeof setSelectVisible === 'function') setSelectVisible('#ntloexpiry', true);
    }
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.showNewOrder = showNewOrder;
    window.onToggleNewOrder = onToggleNewOrder;
    window.renderOrderPreview = renderOrderPreview;
    window.adjustOrderPrice = adjustOrderPrice;
    window.doPlaceCancelOrder = doPlaceCancelOrder;
    window.doPlaceOrder = doPlaceOrder;
    window.doConfirmCancelOrder = doConfirmCancelOrder;
    window.doConfirmOrder = doConfirmOrder;
    window.onNtloExpiryUnitChange = onNtloExpiryUnitChange;
    window.onNtloExpiryChange = onNtloExpiryChange;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showNewOrder,
        onToggleNewOrder,
        renderOrderPreview,
        adjustOrderPrice,
        doPlaceCancelOrder,
        doPlaceOrder,
        doConfirmCancelOrder,
        doConfirmOrder,
        onNtloExpiryUnitChange,
        onNtloExpiryChange
    };
}
},{}],21:[function(require,module,exports){
function showPaymentTab(account, currency, issuer, balance) {
    if (debug) console.log("showPaymentTab - account: " + account + ", currency: " + currency + ", issuer: " + issuer + ", balance: " + balance); 
    clearPaymentScreen();
    var payFromOpt = qs('#payfromaccount [data-account="'+account+'"]');
    if (payFromOpt) {
        payFromOpt.selected = true;
        setAttr(payFromOpt, 'selected', 'selected');
    }
    onPaymentSelectFromAccount();
    var curOpt = byId('optpa-'+currency+'-'+issuer);
    if (curOpt) {
        curOpt.selected = true;
        setAttr(curOpt, 'selected', 'selected');
    }
    setVal('#payamount', balance);
    showTab('#tabpayments', true);
    var toEl = byId('toaddress');
    if (toEl && toEl.focus) toEl.focus();
}

function doPay(nonce) {
	if (debug) console.log("doPay");
	blockInput();
	var payFromSel = byId('payfromaccount');
	var payFromOpt = payFromSel && (payFromSel.selectedOptions ? payFromSel.selectedOptions[0] : qs('#payfromaccount option:checked'));
	var payfrom = payFromOpt ? domData(payFromOpt, 'account') : undefined;
	var payto = getVal("#toaddress").trim();
	var dest = getVal("#desttag").trim();
	var invid = (getVal("#invoiceid").trim() + "").toUpperCase();
	var amount = getVal("#payamount").trim();
    var owncurrencytgl = domData('#tglIssueOwnCurrency', 'checked') == 'true';
    var payAssetSel = byId('payasset');
    var payAssetOpt = payAssetSel && (payAssetSel.selectedOptions ? payAssetSel.selectedOptions[0] : qs('#payasset option:checked'));
    var asset = ( isVisible('#payasset') ? ("" + (payAssetOpt ? domData(payAssetOpt, 'asset') : '')).trim().toUpperCase() : getVal('#payassetofl').trim().toUpperCase() );
    var issuer = ( isVisible('#payasset') ? (payAssetOpt ? domData(payAssetOpt, 'issuer') : '') : getVal('#payissuerofl').trim() );
    if (owncurrencytgl) {
        issuer = payfrom;
    }
    if (asset == '') asset = 'XRP';
    var offlinecode = getVal('#payofflinecode').trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
	if (amount != undefined && (amount+"").charAt(0) == '.') amount = "0" + amount;
	if (/^(.*)[?&][^=]*=(.*)$/m.test(payto)) {
		var oldpayto = payto;
		var newdest = oldpayto.replace(/^(.*)[?&][^=]*=(.*)$/mg, "$2");
		if (dest != "" && dest.trim() != newdest.trim()) {
			navigator.notification.alert("Destination tag specified twice. You specified a destination tag at the end of your send-to address then again in the destination box. Please remove one.", 
				function(){
					var dt = byId("desttag");
					if (dt && dt.focus) dt.focus();
					unblockInput();
				}, 
				"Destination tag duplicate", 
				"OK"
			);
			return;					
		}
		dest = newdest;
		payto = oldpayto.replace(/^(.*)[?&][^=]*=(.*)$/mg, "$1");
	}
	function parseDestinationTag(value) {
		var cleaned = String(value || '').trim().replace(/^0+(.+)$/g, "$1");
		if(cleaned === '') {
			return null;
		} else {
			return cleaned;
		}
	}
	function validateDestinationTag(value) {
		if(value === null || value === undefined) {
			return {
				valid: true,
				error: null
			}
		}
        var MAX_INT = 4294967295;
		if(!/^[0-9]+$/.test(''+value) || value < 0 || value > MAX_INT) {
			return {
					valid: false,
					error: 'Invalid destination tag be either blank or between 0 and ' + MAX_INT
			}
		}
		return {
			valid: true,
			error: false
		}
	}
	dest = parseDestinationTag(dest);
	var destTagResult = validateDestinationTag(dest);
	if (!destTagResult.valid) {
		navigator.notification.alert(destTagResult.error,
			function(){
				var dt = byId("desttag");
				if (dt && dt.focus) dt.focus();
				unblockInput();
			},
			"Destination tag invalid",
			"OK"
		);
		return;
	}
    if (offlinemode) {
        ofl = validateOfflineCode(offlinecode, '#payofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
	if (invid != "") {
        if (!/^[A-F0-9]{64}$/m.test(invid)) {
			navigator.notification.alert("Invoice ID must either be blank or be hex-encoded 256bit value. We recommend not to use an invoice id unless your counter party has instructed you to use one.", 
				function(){
					var inv = byId("invoiceid");
					if (inv && inv.focus) inv.focus();
					unblockInput();
				}, 
				"Invoice ID invalid", 
				"OK"
			);
			return;				
		}
	}
	if (payfrom == undefined || payfrom == "") {
		navigator.notification.alert("You must select an account to pay from", 
			function(){
				var pfa = byId("payfromaccount");
				if (pfa && pfa.focus) pfa.focus();
				unblockInput();
			}, 
			"Select a from account", 
			"OK"
		);
		return;
	}
	if (payto == "") {
		navigator.notification.alert("You must select an address to pay to", 
			function(){
				var to = byId("toaddress");
				if (to && to.focus) to.focus();
				unblockInput();
			}, 
			"Select a to address", 
			"OK"
		);
		return;
	}
	if (!validateAddress(payto)) {
		navigator.notification.alert("The destination address you have entered does not appear to be a valid XRP address. You can still attempt to send but the XRP Ledger will charge a fee on failure.", 
			function(){
				var to = byId("toaddress");
				if (to && to.focus) to.focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);
	}
	if (payto == payfrom) {
		navigator.notification.alert("A XRP address cannot pay XRP from itself to itself.", 
			function(){
				var to = byId("toaddress");
				if (to && to.focus) to.focus();
				unblockInput();
			}, 
			"Cannot pay to this address", 
			"OK"
		);
		return;	
	}
    if (asset == 'XRP' && ( issuer != '' || owncurrencytgl)) {
		navigator.notification.alert("You cannot specify an issuer for XRP.", 
			function(){
                if (isVisible('#oflcurrencydiv')) {
                    var oflEl = byId("payassetofl");
                    if (oflEl && oflEl.focus) oflEl.focus();
                } else {
    				var paEl = byId("payasset");
    				if (paEl && paEl.focus) paEl.focus();
                }
				unblockInput();
			}, 
			"Select a payment amount", 
			"OK"
		);
		return;
    }
    if ( asset == 'XRP' ) issuer = '';
	if (amount == "" || parseFloat(amount)+ "" != (""+amount).trim()) {
		navigator.notification.alert("You must select a valid amount to send", 
			function(){
				var pa = byId("payamount");
				if (pa && pa.focus) pa.focus();
				unblockInput();
			}, 
			"Select a payment amount", 
			"OK"
		);
		return;
	}
	var nextscreen = function() {
        var paytoreal = forceraddrtag(payto, dest)
		confirmpay = { 
			payfrom: forceraddr(payfrom),
			payto: paytoreal.raddr,
			dest: paytoreal.tag,
			invid: invid,
			amount: amount,
			nonce: nonce,
            accseqid: accID, // used for offline tx
            ledseqid: ledID,
            fee: fee,
            asset: asset,
            issuer: issuer
		};
		confirmpayhash = sodium.crypto_generichash(16, JSON.stringify(confirmpay), ''+nonce, 'hex');
		setText('#confirmpayfromaccount', dispaddr(payfrom));
		setText('#confirmpaytoaddress', payto);
		var confirmDestTag = byId('confirmdesttag');
	    if (isXAddress(payto)) {
            if (confirmDestTag && confirmDestTag.parentNode) confirmDestTag.parentNode.style.display = 'none';
        } else {
            if (confirmDestTag && confirmDestTag.parentNode) confirmDestTag.parentNode.style.display = 'inherit';
    	}
        setText('#confirmdesttag', paytoreal.tag || '(not provided)');
		setText('#confirminvoiceid', ( invid == "" ? "(not provided)" : invid ));
		setText('#confirmpayamount', amount);
        setText('#confirmasset', asset);
        setText('#confirmissuer', dispaddr(issuer));
        if (asset == 'XRP') {
            hideEl('#confirmissuerpaygroup');
        } else {
            showEl('#confirmissuerpaygroup');
            if (owncurrencytgl) {
                setText('#confirmissuer', 'This Account');
            } else {
                setText('#confirmissuer', dispaddr(issuer));
            }
        }
		showTab("#tabpaymentconfirm", true);
		
		unblockInput();
	};
    checkAccountIsFunded(payfrom, amount, asset, issuer, function(){
			navigator.notification.confirm("You must leave " + xrpreserve + " XRP reserve in the account you are sending from. This is a XRP Ledger requirement. In some circumstances this message may appear in error if you believe that to be the case you can opt to attempt the transaction however this will attract a XRP Ledger fee." , 
				function(b){
					if (debug) console.log("button selected: " + b);
					if (b == 1) {
						nextscreen();
					} else {
						var pa = byId('payamount');
						if (pa && pa.focus) pa.focus();
						unblockInput();
					}
				}, 
				"XRP Reserve not met", 
				[ "Try anyway", "Cancel" ]
                );}, 
                function() { 
                    var pa = byId('payamount');
                    if (pa && pa.focus) pa.focus();
                    unblockInput();
                }, nextscreen);
}

function doConfirmPay(passphrase) {
	if (debug) console.log("doConfirmPay");
	if (confirmpay.nonce == lastpaidnonce) {
		// this is an accidental double tap
		return;
	} 
	blockInput();
	lastpaidnonce = confirmpay.nonce;
	validatePassphrase(passphrase, false,
		function() {
			if (confirmpay == undefined || confirmpay.nonce == undefined || sodium.crypto_generichash(16, JSON.stringify(confirmpay), ''+confirmpay.nonce, 'hex') != confirmpayhash ) {
				navigator.notification.alert("An error occured when trying to make your payment. No payment was made.", 
					function(){
						showTab(-1);
						unblockInput();
					}, 
					"Error", 
					"OK"
				);
				return;
			}
            if (offlinemode) {
                // we're just going to create the payment as a QR code and display it
				navigator.notification.alert("A QR code of this signed transaction has been generated. Scan it using your online device to complete the transaction.", 
					function(){
                        return sendPaymentOffline(passphrase, confirmpay.payfrom, parseFloat(confirmpay.amount), confirmpay.payto, 0, confirmpay.dest, confirmpay.invid, confirmpay.asset, confirmpay.issuer, confirmpay.accseqid, confirmpay.ledseqid, confirmpay.fee);					
                    }, 
					"Offline Transaction", 
					"OK"
				);            
                return;
            }
			checkConnection(
				function(){
					sendPayment(passphrase, confirmpay.payfrom, parseFloat(confirmpay.amount), confirmpay.payto, 0, confirmpay.dest, confirmpay.invid, confirmpay.asset, confirmpay.issuer, 
						function(wasqueued){
							if (confirmpay.payto == 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y') {
								getLastDonation(function(donation) {
									donation['lastdonation'] = "" + Math.floor(new Date().getTime()/1000);
									donation['lastreminder'] = "" + Math.floor(new Date().getTime()/1000);
									db.upsert("lastdonated",
										function(doc) {
										return { data: JSON.stringify(donation)	}; 
									}).then( function() {
										navigator.notification.alert("Thank you for your donation! Your contribution helps us keep Toast Wallet running!", 
											function(){
												clearPaymentScreen();
												showTab("#tabaccounts");
												unblockInput();
											}, 
											"Success", 
											"OK"
										); 
									});
								});
							} else {
								navigator.notification.alert("Your payment was successfully " + ( wasqueued ? "queued, and will be sent shortly." : "sent." ), 
									function(){
										clearPaymentScreen();
										showTab("#tabaccounts");
										unblockInput();
									}, "Success", "OK"); 
								}
						}, 
						function(err) {
							navigator.notification.alert("An error occured when trying to make your payment. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your payment details are incorrect or the sending or receiving reserve is not met. " + err, 
							function(){
								lastpaidnonce = "";
								showTab(-1);
								unblockInput();
							}, 
							"Error", "OK");
						}
					);
				}
			);
		},
		function() { 
			navigator.notification.alert("Your passphrase is incorrect. You cannot use a recoveryphrase here.", 
				function(){
					lastpaidnonce = "";
					unblockInput();
				},				
				"Error", "OK"
			);
		},
		function() { 
			navigator.notification.alert("Could not make payment due to possible wallet corruption. We recommend backing up your wallet and reinstalling.", 
				function(){
					lastpaidnonce = "";
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		}
	);
}

function clearPaymentScreen() {
	try {
        var dt = byId("desttag");
        if (dt) dt.readOnly = false;
        removeAttr("#desttag", "readonly");
        hideEl("#currencyerror");
        emptyEl("#currencyerror");
        var payFromSel = byId("payfromaccount");
        var curSelOpt = payFromSel && (payFromSel.selectedOptions ? payFromSel.selectedOptions[0] : qs("#payfromaccount option:checked"));
        if (curSelOpt && domData(curSelOpt, "account") != activeaccount) {
            curSelOpt.removeAttribute("selected");
            curSelOpt.selected = false;
            var targetOpt = byId("opt" + activeaccount);
            if (targetOpt) {
                targetOpt.setAttribute("selected", "selected");
                targetOpt.selected = true;
            }
        }
        onPaymentSelectFromAccount();
		setVal("#toaddress", "");
		setVal("#desttag", "");
		setVal("#invoiceid", "");
		setVal("#payamount", "");
        removeAttr("#payamount", "placeholder");
        var tglContainer = byId("tglIssueOwnCurrency");
        var tgl = tglContainer && tglContainer.firstElementChild;
        if (tgl) {
            removeClass(tgl, "fa-toggle-on");
            removeClass(tgl, "fa-toggle-off");
            addClass(tgl, "fa-toggle-off");
        }
        domData("#tglIssueOwnCurrency", "checked", "false");
        onToggleIssueOwnCurrency(true);
        setVal("#payassetofl", "");
        setVal("#payissuerofl", "");
        hideEl("#invoiceiddiv");
//        setHtml("#btnpayshowmore", "More");
        if (offlinemode) {
            showEl("#oflcurrencydiv");
            hideEl("#payasset");
        } else {
            hideEl("#oflcurrencydiv");
            showEl("#payasset");
        }
	} catch(e) {handle_error(e);}
}

function onPaymentSelectFromAccount() {
    //clean up stray dropdown
    if (offlinemode) 
        try {
            if (typeof destroySelect === "function") destroySelect("#payasset");
        } catch (e) {}
    var payFromSel = byId("payfromaccount");
    var selOpt = payFromSel && (payFromSel.selectedOptions ? payFromSel.selectedOptions[0] : qs("#payfromaccount option:checked"));
    if (!selOpt) {
        if (activeaccount == undefined) return;
        var opt = byId("opt" + activeaccount);
        if (opt) {
            opt.setAttribute("selected", "selected");
            opt.selected = true;
            selOpt = opt;
        }
    } 
    var account = selOpt ? domData(selOpt, "account") : undefined;
    if (account == undefined) return;
    
    if (offlinemode) {
        showEl("#payofflinecodediv");
        emptyEl("#paytabredqr");
        if (typeof kjua === "function") {
            appendNode("#paytabredqr", kjua({text: account, fill:"#ff0000"}));
        }
        hideEl("#payasset");
        try {
            if (typeof destroySelect === "function") destroySelect("#payasset");
        } catch (e) {}
        showEl("#oflcurrencydiv");
        
    } else {
        showEl("#payasset");
        hideEl("#payofflinecodediv");
        emptyEl("#paytabredqr");
        var xrpoption = '<option data-issuer="" data-asset="XRP" id="optpa-xrp">XRP</option>';
        if (trustlinesdropdown[account] != undefined) {
            var tloptions = "";
            for (var x in trustlinesdropdown[account]) 
                tloptions += trustlinesdropdown[account][x];
            setHtml("#payasset", xrpoption + tloptions);
        } else {
            setHtml("#payasset", xrpoption);
        }
        try {
            if (typeof enhanceSelect === "function") {
                enhanceSelect("#payasset");
                refreshSelect("#payasset");
            }
        } catch(e) {}
    }
}

function checkPayToAddressForCommonErrors() {
    var payto = (getVal("#toaddress") + "").trim();
    if (payto.substr(0,1) == "r" && forceraddr(payto)) {
        if (payto == "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv") {
            setHtml("#lblpaytodesttag", "Destination Tag (<i color=\"red\">Required!</i>)");
        } else if (payto == "rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh") {
            setHtml("#lblpaytodesttag", "Destination Tag (<i color=\"red\">Required!</i>)");
        } else if (offlinemode) {
            setHtml("#lblpaytodesttag", "Destination Tag");
        } else {
            remote.getSettings(payto).then(settings => {
                if (settings && settings.requireDestinationTag) {
                    setHtml("#lblpaytodesttag", "Destination Tag (<i color=\"red\">Required!</i>)");
                } else {
                    setHtml("#lblpaytodesttag", "Destination Tag");
                }
            }).catch(e=>{
                setHtml("#lblpaytodesttag", "Destination Tag");
            })
        }
    }
   
    hideEl("#currencyerror"); 
   
    // disable or enable desttag depending on if its an xaddress
    var dt = byId("desttag");
    if (payto.substr(0,1) == "X") { 
        if (dt) dt.readOnly = true;
        setAttr("#desttag", "readonly", "readonly"); 
        setVal("#desttag", "");
    } else {
        if (dt) dt.readOnly = false;
        removeAttr("#desttag", "readonly"); 
    }
}

function populatePaymentTabFromURI(uri, targetfield) {
	// apply the draft standard
	var parsed = xls2d(uri)
    var xto = false
    try { xto = raddr(parsed.to) } catch (e) {}
    if (!parsed || !parsed.to || (
        !xrpl.isValidClassicAddress(parsed.to) &&
        !xto)) {
        // could not parse, that's fine we'll just populate it anyway
        if (targetfield) setVal(targetfield, uri);
        checkPayToAddressForCommonErrors();
        return;
    }
    if (parsed.to) setVal("#toaddress", parsed.to);
    if (!xto && parsed.dt) setVal("#desttag", parsed.dt);
    if (parsed.amount) setVal("#payamount", parsed.amount);
    checkPayToAddressForCommonErrors();
    /*try {
        var payFromOpt = qs("#payfromaccount [data-account=\""+account+"\"]");
        if (payFromOpt) {
            payFromOpt.selected = true;
            payFromOpt.setAttribute("selected", "selected");
        }
    } catch (e) {}
    onPaymentSelectFromAccount();
    */
    hideEl("#currencyerror");
    if (parsed.currency.currency && parsed.currency.issuer) {
        if (offlinemode) {
            setVal("#payassetofl", parsed.currency.currency);
            setVal("#payissuerofl", parsed.currency.issuer);
        } else {
            var curOpt = byId("optpa-"+parsed.currency.currency+"-"+ parsed.currency.issuer);
            if (curOpt) {
                curOpt.selected = true;
                curOpt.setAttribute("selected", "selected");
            } else {
                setText("#currencyerror", "Pay URI specified " + (""+parsed.currency.currency).replace(/[^a-z]/gi, "")  + " issued by " + (""+parsed.currency.issuer).replace(/[^a-z0-9]/gi, "") + " but you don't have a trustline for that on this account"); //todo: add a button here to make adding a trustline easy
                showEl("#currencyerror");
            }
        }
    } 
    if (parsed.invoiceid) {
        showEl("#invoiceiddiv");
        setVal("#invoiceid", parsed.invoiceid);
    }
}

function doPayLink() {
    console.log("doPayLink " + paylink_pending)
    
    var paylink = paylink_pending
    paylink_pending = null
    if (!paylink) return
    
    showTab("#tabpayments")
    populatePaymentTabFromURI(paylink)
    removeClass("#tablogin > center > div", "pinpad_pending");
    if (activeaccount == "") 
        refreshAccounts()
}

function doSubmitOfflineTransaction(stage, content) {
    if (stage == undefined) stage = 0;
    if (offlinemode) {
        return navigator.notification.alert("You must use an Internet connected device to submit an offline transaction. To generate an offline transaction use the payments tab (center bottom).", 
            function() {
                showTab(-1);
                unblockInput();
            },
            "Not Connected", "OK"
        );
    }
    if (stage == 0) {
        
        showEl("#submitofflinetxstep1");
        hideEl("#submitofflinetxstep2");
        hideEl("#submitofflinetxstep3");
        showTab('#tabsubmitofflinetx');
    } else if (stage == 1) {
        blockInput();
        var account = content;
        // query the ledger sequence ID and account sequence ID
        if (account == undefined) account = getVal("#txtredqr");
        console.log("RED QR: " + account);
        account = forceraddr(account)
        if (!account || !validateAddress(account)) {
			return navigator.notification.alert("The QR code you scanned was not a valid XRP address", 
				function() {
                    doSubmitOfflineTransaction(0);
                    unblockInput();
                },
				"Failure", "OK"
			);
        }
        var failurefunc = function(fail) {
	        return navigator.notification.alert("An error occured when trying to query the XRP Ledger. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your device has no connectivity. " + fail,
				function() {
                    doSubmitOfflineTransaction(0);
                    unblockInput();
                },
				"Failure", "OK"
			);
        }
        var failurefuncAccNotFound = function(fail) {
	        return navigator.notification.alert("The account you are trying to submit a transaction on behalf of does not exist (has not been activated) on the network. " + fail,
				function() {
                    doSubmitOfflineTransaction(0);
                    unblockInput();
                },
				"Failure", "OK"
			);
        }
        var onApiFailure = function(fail, failurefunc, ptries) {
					console.log('API query failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								queryNetwork(ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
		};
        var queryNetwork = function(ptries) {
            checkConnection(() => {
                remote.getFee().then(fee => {
                    if (fee == undefined) {
                        fee = 12;
                    } else {
                        fee *= 1000000;
                    }
                    if (fee > 1000000) fee = 1000000; // we'd rather the tx fail than go through for more than 1 xrp
                    remote.getAccountInfo(account).then(info => {
                       var accseqid = info.sequence;
                        remote.getLedger({}).then(info2 => {
                            var ledseqid = info2.ledgerVersion - toastepoc; // toast wallet epoc
                            // encode these into a portable format
                            console.log("Ledger Seq ID: " + ledseqid);
                            console.log("Account Seq ID: " + accseqid);                        
                            console.log("Fee: " + fee);                        
                            var bytes = [];
                            // 4 byte int for the accseqid
                            bytes[0] = (accseqid & 0xff000000) >> 24;
                            bytes[1] = (accseqid & 0xff0000) >> 16;
                            bytes[2] = (accseqid & 0xff00) >> 8;
                            bytes[3] = (accseqid & 0xff) >> 0;                        
                            // 4 byte int for the ledseqid
                            bytes[4] = (ledseqid & 0xff000000) >> 24;
                            bytes[5] = (ledseqid & 0xff0000) >> 16;
                            bytes[6] = (ledseqid & 0xff00) >> 8;
                            bytes[7] = (ledseqid & 0xff) >> 0;                        
                   
                            // 4 byte int for the fee
                            bytes[8]  = (fee & 0xff000000) >> 24;
                            bytes[9]  = (fee & 0xff0000) >> 16;
                            bytes[10] = (fee & 0xff00) >> 8;
                            bytes[11] = (fee & 0xff) >> 0;                        
                            // 1 byte checksum
                            var hex = utils.bytesToHex(bytes);
                            var checksum = sodium.crypto_generichash(1, hex, 'offlinecode', 'hex');
                           
                            var fullhex = hex;
                            var removedZerosLedId = 0;
                            var removedZerosAccId = 0;
                            var removedZerosFee = 0;
                            // remove leading 0's from the ledgerid
                            while(hex.charAt(8) == '0') {
                                hex = hex.slice(0,8) + hex.slice(9);
                                removedZerosLedId++;
                            }
                            // remove leading 0's from the fee
                            while(hex.charAt(hex.length - 8 + removedZerosFee) == '0') {
                                hex =  hex.slice(0, hex.length - 8 + removedZerosFee) + hex.slice( hex.length - 7 + removedZerosFee);
                                removedZerosFee++;
                            }
                        
                            // remove leading 0's from acc seq id
                            while(hex.charAt(0) == '0') {
                                hex = hex.slice(1);
                                removedZerosAccId++;
                            }
                            // encode the zero removal
                            var compressionByte = 0;
                            compressionByte += removedZerosLedId; 
                            compressionByte += removedZerosAccId * 8;
                    
                            // add checksum to the beginning
                            hex = checksum + utils.bytesToHex([compressionByte]) +hex;
                            // due to the checksum we should be able to reconstruct this
                            hex = hex.toUpperCase();
                            console.log("Full offline code: " + checksum + utils.bytesToHex([compressionByte]) + fullhex);
                            // add spaces for ease of copying
                            var displayhex = "";
                            for (var i = 0; i < hex.length; i+= 4) 
                                displayhex += hex.slice(i, i + 4) + " ";
                            displayhex = displayhex.trim();
                            setText("#lblofflinetxconfirm", displayhex);
                            unblockInput();
                            showEl("#submitofflinetxstep1");
                            showEl("#submitofflinetxstep2");
                            showEl("#submitofflinetxstep3");
                            showTab('#tabsubmitofflinetx');
                            
                        }).catch(e => {
                            return onApiFailure(e, failurefunc, ptries); 
                        });
                    }).catch(e => {
                        return onApiFailure(e, failurefuncAccNotFound, ptries); 
                    });
                }).catch(e => {
                    return onApiFailure(e, failurefunc, ptries); 
                });
            });
        };
        queryNetwork(0);
    } else if (stage == 2) {
        // ready to submit the transaction!
        blockInput();
        var signedTx = content;
        if (signedTx == undefined) signedTx = getVal("#txtgreenqr");
        if (signedTx.slice(0, 'ripple:signed-transaction:'.length) != 'ripple:signed-transaction:') {
            return  navigator.notification.alert("The QR code you scanned is not a valid transaction QR. Ensure you are scanning the GREEN QR code you received after finalizing your transaction on the offline device.", 
                        function(){
                            unblockInput();
                        }, "Invalid QR Code", "OK"
            ); 
        }
        
        // remove prefix from the tx
        signedTx =  signedTx.slice('ripple:signed-transaction:'.length);
        checkConnection(function(){
        submitSignedTransaction(
            signedTx,       
            function(wasqueued){
                    navigator.notification.alert("Your transaction was successfully " + ( wasqueued ? "queued." : "submitted." ), 
                        function(){
                            showTab(-1);
                            unblockInput();
                        }, "Success", "OK"); 
                    }
            , 
            function(err) {
                navigator.notification.alert("An error occured when trying to make your payment. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your payment details are incorrect or the receiving address has not been activated. " + err, 
                function(){
                    showTab(-1);
                    unblockInput();
                }, 
                "Error", "OK");
            },
            0
        );
        });        
    }
}

function xls2d(uri) {
    if (!uri || typeof(uri) != 'string') return false
    const cleaned_uri = uri.replace(/^(.*:.*)?\?/mg, "").replace(/\?/img, "&").replace(/^.*?:\/\//, '').replace(/^ripple:/img, "")
    
    function clean() {
        return cleaned_uri
    }   
    
    function to() {
        //NB: this regex is case sensitive to assist in correctly matching XRP ledger addresses
        var match =  /(?:(?:^|&)(?:to|TO|tO|To)=|^)([rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz]{25,55})/mg.exec(cleaned_uri)
        return (match == null ? false : match[1])
    }   
    
    function dt() {
        var match = /(?:^|&)dt=([0-9]+)|:([0-9]+)$/img.exec(cleaned_uri)
        if (match != null) return (match[1] ? match[1] : match[2])
        return false 
    }   
    
    function amount() {
        var match = /(?:^|&)am(?:oun)?t=([0-9\.]+)/img.exec(cleaned_uri)
        return (match == null ? false : match[1])
    }   
    
    function currency() {
        var match = /(?:^|&)cur(?:rency)?=(?:([rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz]{25,55}):)?([A-Z]{3}|[A-Fa-f]{40})/img.exec(cleaned_uri)
        return (match == null ? false : { issuer: ( match[1] ? match[1] : false ), currency: match[2] } )
    }   
    
    function invoiceid() {
        var match = /(?:^|&)inv(?:oice)?(?:id)?=([a-f]{64})/img.exec(cleaned_uri)
        return (match == null ? false : match[1])
    }   
    
    return {
        uri: uri,
        clean: clean(),
        to: to(),
        dt: dt(),
        amount: amount(),
        currency: currency(),
        invoiceid: invoiceid()
    }   
}

function decodeSecretAddressURI(uri, after, secretfield, addrfield, defaultfield) {
	uri = uri.replace(/^([a-z\/:.]+\/)?(.+)$/mg, "$2");
    var emplace = (val) => {
        var first = val.charAt(0);
        if (first == "s" && secretfield != undefined) {
            setVal(secretfield, val);
        } else if ((first == "X" || first == "r" || first == "n") && addrfield != undefined) {
            setVal(addrfield, val);
        } else {
            setVal(defaultfield, val);
        }
    };
	if (/^[^?&=]+$/m.test(uri) && defaultfield != undefined) {
		// if this is a simple regex with no uri stuff then we'll just import it directly into the
		// field next to the QR button
		//setVal(defaultfield, uri);
        emplace(uri);
	} else {
		var addressRegex = /(?:[?&]?([a-z]+)=|^)([^&?\r\n]*)/mg;
		var match = addressRegex.exec(uri);
		var matchcount = 0;
		while (match != null) {
			matchcount++;
			var key = ( match[1] == undefined ? "" : (match[1]+"").toLowerCase() );
			var val = ( match[2] == undefined ? "" : match[2] );
			emplace(val)
            match = addressRegex.exec(uri);
		}
	}
	return ( after ? after() : true )
}

function checkAccountIsFunded(payfrom, amount, asset, issuer, failurefunc, silentfailurefunc, successfunc) {
    if (offlinemode) return successfunc(); // skip this warning if we already know we can't check the balance
    payfrom = forceraddr(payfrom)
    issuer = forceraddr(issuer)
    if ( payfrom == issuer ) return successfunc();
    //todo: check if receiver has trustline setup to receive your currency
    
    if (asset == 'XRP' && payfrom in accountbalances) {
		var balance = accountbalances[payfrom] - amount;
		if (balance < xrpreserve) {
			return failurefunc();
		} else {
			return successfunc();
		}
    }
    if ( asset != 'XRP' &&  accountbalancestl[payfrom] != undefined && accountbalancestl[payfrom][asset] != undefined && accountbalancestl[payfrom][asset][issuer] != undefined ) {
        var balance = accountbalancestl[payfrom][asset][issuer] - amount;
        if (balance >= 0) {
            return successfunc();
        } else {
            return failurefunc();
        }
    }
    return navigator.notification.confirm("Toast Wallet was unable to check your account balance at this time. Please confirm that you have left " + xrpreserve + " XRP reserve in your account after the " + amount + " XRP transaction before continuing.",
			function(b){
				if (b == 1) {
					return successfunc();
				} else {
				    return silentfailurefunc();
				}
			}, 
			"XRP balance not confirmed", 
			[ "Yes continue", "Cancel" ]
	);			
}

function validateOfflineCode(offlinecode, offlinecodefield) {
        var codevalid = /^[A-F0-9]+$/m.test(offlinecode);        
        if (codevalid) {
            // grab the checksum from the front
            var checksum = offlinecode.slice(0,2);
            var compression = utils.hexToBytes(offlinecode.slice(2,4));
            offlinecode = offlinecode.slice(4);
            var removedZerosLedId = compression & 7;
            var removedZerosAccId = compression >> 3;
            var removedZerosFee = 24 - (offlinecode.length + removedZerosLedId + removedZerosAccId);
            console.log("removedZerosLedId: " + removedZerosLedId);
            console.log("removedZerosAccId: " + removedZerosAccId);
            console.log("removedZerosFee: " + removedZerosFee);            
            // from the checksum we need to figure out where to re-add our zeros
            // we know there are 24 digits to make up and we know the checksum
            // there will be up to six 0's added in three places
            var isValid = function(offlinecode, checksum) {
                return checksum.toUpperCase() == sodium.crypto_generichash(1, offlinecode, 'offlinecode', 'hex').toUpperCase();
            }
            accID = '0'.repeat(removedZerosAccId) + offlinecode.slice(0, 8 - removedZerosAccId);
            offlinecode = offlinecode.slice(8 - removedZerosAccId);
            ledID = '0'.repeat(removedZerosLedId) + offlinecode.slice(0, 8 - removedZerosLedId);
            offlinecode = offlinecode.slice(8 - removedZerosLedId);
            while(offlinecode.length < 8) offlinecode = '0' + offlinecode;
            fee = offlinecode;
            offlinecode = accID + ledID + fee;
            codevalid = isValid(offlinecode, checksum);
            console.log("offline code: " + offlinecode);
        }
        if (!codevalid) {
            navigator.notification.alert("Your offline code appears to be incorrect. Check you scanned the red QR code on the online version of Toast Wallet first.", 
                function(){
                    var ocf = resolveElement(offlinecodefield);
                    if (ocf && ocf.focus) ocf.focus();
                    unblockInput();
                }, 
                "Offline code invalid", 
                "OK"
            );
            return false;
        } 
        accID = parseInt('0x' + accID);
        ledID = parseInt('0x' + ledID);
        fee = (parseInt('0x' + fee)/1000000.0) + "";
        console.log("Reconstructed LedID: " + accID);
        console.log("Reconstructed AccID: " + ledID);                        
        console.log("Reconstructed Fee: " + fee);   
        return { accID: accID, ledID: ledID, fee: fee };
       
}

// Expose functions globally
window.showPaymentTab = showPaymentTab;
window.doPay = doPay;
window.doConfirmPay = doConfirmPay;
window.clearPaymentScreen = clearPaymentScreen;
window.onPaymentSelectFromAccount = onPaymentSelectFromAccount;
window.checkPayToAddressForCommonErrors = checkPayToAddressForCommonErrors;
window.populatePaymentTabFromURI = populatePaymentTabFromURI;
window.doPayLink = doPayLink;
window.doSubmitOfflineTransaction = doSubmitOfflineTransaction;
window.xls2d = xls2d;
window.decodeSecretAddressURI = decodeSecretAddressURI;
window.checkAccountIsFunded = checkAccountIsFunded;
window.validateOfflineCode = validateOfflineCode;
},{}],22:[function(require,module,exports){
function doUpdateInterfaceSettings() {
    var valCurEl = byId('valuationcurrency');
    var selectedOpt = (valCurEl && valCurEl.selectedOptions) ? valCurEl.selectedOptions[0] : null;
    var currency = selectedOpt ? domData(selectedOpt, 'currency') : undefined;
    var counterparty = selectedOpt ? domData(selectedOpt, 'counterparty') : undefined;
    var xaddr = domData('#tglUseXAddress', 'checked');
    if (currency && counterparty) { 
        interface_settings.valuation_currency = currency;
        interface_settings.valuation_counterparty = counterparty;
    }
    // switches return strings of true false or undefined
    interface_settings.display_xaddresses = xaddr === 'true' || xaddr === true;
    saveInterfaceSettings();
    showTab('#tabaccounts');
}

function showInterfaceTab() {
    try {
        var opt = qs('#valuationcurrency > option[data-currency="'+interface_settings.valuation_currency+'"][data-counterparty="'+interface_settings.valuation_counterparty+'"]');
        if (opt) opt.selected = true;
        if (typeof refreshSelect === 'function') refreshSelect('#valuationcurrency');
    } catch(e) {}
    setToggleSwitch('#tglUseXAddress', interface_settings.display_xaddresses);
    showTab('#tabinterface', true);
}

function doResetPassphrase(pp1, pp2, oldpp, successfunc, firstrun) {
	if (debug) console.log("doResetPassphrase");
	blockInput();
	if (pp1 != pp2) {
		navigator.notification.alert("The passphrases do not match.", 
			function(){
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
		return;
	}
	var complexity = passphraseComplexityCheck(pp1);
	if (complexity != "") {
		navigator.notification.alert("The passphrase must " + complexity, 
			function(){
				unblockInput();
			},  
			"Error", 
			"OK"
		);
		return;
	}
	
	var setsuccess = function() {
			//success
			navigator.notification.alert("Your new passphrase has been set", 
				function(){
					unblockInput();
					successfunc();
				}, "Success", "OK");
		};
	setPassphrase(pp1, oldpp, false, setsuccess, function() {
			//failure -- this could be a recovery phrase so let's clean it up and format it correctly and try it again
			if (oldpp.indexOf('\t') != -1) oldpp = oldpp.replace(/\t/, ' ');
			while(oldpp.indexOf('  ') != -1) oldpp = oldpp.replace(/  /, ' ');
			oldpp = oldpp.trim().toLowerCase();
			setPassphrase(pp1, oldpp, false, setsuccess, function() {
					// failure for the second time
					navigator.notification.alert("Old passphrase is incorrect. If you are trying to use recovery phrase you may need to restore backup to PC version first for some devices.", 
						function(){
							unblockInput();
						},
						"Failure", 
						"OK"
					);
			}, firstrun);
	},firstrun);
			
}

function doResetPin(passphrase, successfunc, failfunc, firstrun) {
	if (debug) console.log("doResetPin");
	blockInput();
	var s = function() {
		unblockInput();
		var f;
		runPinPad( (currenttab == "#tabpinset1" ? "" : "#tabpinset1"), function(pin) {
			// there is no way to fail validation on this screen.
			return true;
		}, f = function(pin1) {
			runPinPad( (currenttab == "#tabpinset2" ? "" : "#tabpinset2"), function(pin2) {
				return currenttab == '#tabpinset1' || pin1 == pin2;
			}, function(pin2) {
				if (currenttab == '#tabpinset1') return f(pin2);
				if (currenttab == '#tablogin') return;
				setPin(pin2, successfunc, function() {
					navigator.notification.alert('The PIN failed to set. Please check this app has permission to store data.', failfunc, 'Could not set PIN', 'OK');
				});
			}, function(pin2) {
				if (currenttab == '#tablogin') return;
				navigator.notification.alert('The PINs do not match.', failfunc, 'Please try again', 'OK');
			});
		
		}, function(){});
	}
	if (firstrun != undefined && firstrun) {
		s();
	} else {
		validatePassphaseOrRecovery(passphrase,
			s,
			function() {
				// might be recovery phrase, so try format it correctly if it is
				if (passphrase.indexOf('\t') != -1) passphrase = passphrase.replace(/\t/, ' ');
				while(passphrase.indexOf('  ') != -1) passphrase = passphrase.replace(/  /, ' ');
				passphrase = passphrase.trim().toLowerCase();	
				validatePassphaseOrRecovery(passphrase,
					s,
					function() {
						// wasn't recovery code either
						unblockInput();
						navigator.notification.alert('The passphrase or recovery phrase is incorrect.', function(){}, 'Error', 'OK');
					},
					s
				);
			},
			s
		);
	}
}

function setAndShowNewRecoveryPhrase(passphrase) {
	blockInput();
	var randomWord = function() {
		var vowels = ['a', 'e', 'i', 'o', 'u'];
		var consts =  ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'qu', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z', 'tt', 'ch', 'sh'];
		var len = 4;
		var word = '';
		var is_vowel = false;
		var arr;
		for (var i = 0; i < len; i++) {
		  if (is_vowel) arr = vowels
		  else arr = consts
		  is_vowel = !is_vowel;
		  word +=  arr[sodium.randombytes_random() % arr.length];
		}
		return word;
	};
	var rp = "";
	for (var i = 0; i < 6; i++) {
		rp += randomWord() + (i == 5 ? '' : ' ');
	}
	
	setText("#showrecoveryphrase", rp);
	setPassphrase(rp, passphrase, true, 
		function(){ 
			showTab("#tabshowrecovery"); 
			unblockInput();
		}, 
		function() {
			navigator.notification.alert('Unable to setup your recovery phrase, possibly due to a device error or out of storage. Toast Wallet cannot proceed and will now restart.', 
			function(){ 
				restart(); 
				unblockInput(); 
			}, 'Fatal Error', "OK");
	});
}

function doRekeyAccount(passphrase) {
	return; // TODO: finish and test code
	/* To rekey an account we first need to work out which scenario we are in, it can be one of these three:
	** 1. We currently have the master secret and no regular key has ever been set
	** 2. We currently have a regular secret and the master key has been disabled.
	** 3. We currently have a regular secret and the master key has not been disabled.
	** In scenario 3 we need to verify with them if they want their master key disabled, in scenario 1
	** we will assume they want it disabled. */
	blockInput();
	var suc = function() {
		navigator.notification.alert("Your account has been rekeyed.", 
			function() {
				showBackupReminderTab();
				unblockInput();
			},
			"Success", "OK"
		);		
	}
	var fail = function(err) {
		navigator.notification.alert("Rekeying your account failed. " + err, 
			function() {
				unblockInput();
			},
			"Failure", "OK"
		);		
	}
	var scenario = 1;
	validatePassphrase( passphrase, false,
		function() {
			remote.getSettings(address).then(
			settings => {
				if ('regularKey' in settings && isValidAddress(settings['regularKey'])) {
					// regular key already set, check if the master key is disabled
					scenario = ( 'disableMasterKey' in settings && settings['disableMasterKey'] ? 2 : 3 );
				}
				if (scenario == 3) {
					// prompt if they want the master key disabled	
					navigator.notification.confirm("Toast Wallet has detected your master key is still enabled, would you like to disable it after rekeying your account? If you don't know what this is choose Do NOT Disable.",
						function(b){
							if (b == 1) {
								rekeyAccount(passphrase, true, suc, fail);
							} else {
								rekeyAccount(passphrase, false, suc, fail);
							}
						}, 
						"XRP balance not confirmed", 
						[ "Disable Master Key", "Do NOT Disable" ]
					);					
				} else {
					rekeyAccount(passphrase, (scenario == 1), suc, fail);
				}
			} ).catch( 
			e => {
			navigator.notification.alert("The address you specified has not been activated. Please activate it first before attempting to rekey it.", 
				()=>{
					unblockInput();
				}, "Failure", "OK");
			});
		},
		function() {
			navigator.notification.alert("Your passphrase is incorrect. Recovery phrase cannot be used here.", 
				function(){
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		},
		function() {
			navigator.notification.alert("Validating your passphrase failed. Your wallet may be corrupted. We recommend making a backup.", 
				function(){
					unblockInput();
				}, 
				"Failure", 
				"OK"
			);
		}	
	);
}

function rekeyAccount(passphrase, address, disableMasterKey, successfunc, failurefunc) {
	
	return; // TODO finish and test code
    address = forceraddr(address)
	if (debug) console.log("rekeyAccount - " + address);
	getSecretForAccount(passphrase, address, 
		function(secret) {
			passphrase = "";
			// TODO: finish code 
		
		},
		function() {
			failurefunc("Could not retrieve secret for this account. Your wallet may be corrupt, please make a backup.");
		});
}

function doResetGatewayPrompt() {
	getSavedGateways(function(gateways) {
		if (gateways['gateways'] == undefined || gateways['gateways'].length == 0) {
			navigator.notification.alert('You have no custom gateways set.', ()=>{}, "No Gateways Set", "OK");
		} else {
			navigator.notification.confirm("This will clear the custom gateways that Toast Wallet connects to. The default gateways will be restored next time the app starts. Would you like to clear custom gateways? This will not harm you wallet.",
			function(b) {
				if (b == 1) {
					db.upsert("savedgateways",
						function(doc) {
						return { data: JSON.stringify({gateways: []})	}; 
					});					
					navigator.notification.alert('Custom gateways have been cleared.', ()=>{
						resetServerStack();	
						doRetryConnection(serverStack[0]);
					}, "Success", "OK");
				}
			}, "Clear custom gateways?",
			[ "Yes", "Cancel" ]
			);
		}
	});
	
}

function doAddGateway(gateway) {
			if (gateway == 'wss://' || gateway.indexOf('wss://') != 0) {
				return navigator.notification.alert("Invalid gateway", 
					function() {},
					"Failure", "OK"
				);
			}
			// they have a gateway they want to add, we'll go ahead and test that gateway immediately
			// if the gateway is connectable then it will be automatically added to their saved gateway list
			doRetryConnection(gateway);
}

function passphraseComplexityCheck(pp){
    if (validateSecret(pp)) return "not be a XRPL secret.";
    
	var minlen = 8; // changed this from 6 
	var hascapital = /[A-Z]/im.test(pp);
	var haslowecase = /[a-z]/im.test(pp);
	var hasnumber = /[0-9]/im.test(pp);
	var hasspecialchar = /[^a-zA-Z0-9 ]/im.test(pp);
	var islongenough = pp.length >= minlen;
	var msg = "";
	if (!hascapital) msg += (msg == "" ? "have at least one: " : ", ") + "capital";
	if (!haslowecase) msg += (msg == "" ? "have at least one: " : ", ") + "lowercase";
	if (!hasnumber) msg += (msg == "" ? "have at least one: " : ", ") + "number";
	if (!hasspecialchar) msg += (msg == "" ? "have at least one: " : ", ") + "non-alphanumeric";
	if (!islongenough) msg += (msg == "" ? "" : ", and ") + "be at least "+minlen+" long";
	return msg;
}

function validatePassphrase(passphrase, isrecoveryphrase, successfunc, failurefunc, nopassphrasefunc) {
	if (debug) console.log("validatePassphrase");
	if (passphrase == "") return failurefunc();
	if (!isrecoveryphrase && _validatePassphraseCacheHit(passphrase)) return true;
        var f = function(ppdata) { try {
                if (ppdata.data == undefined || ppdata.data == "") {
			if (debug) console.log("validatePassphrase - no passphrase set");
                        return nopassphrasefunc();
                } else {
                        ppdata = JSON.parse(ppdata.data);
			salt1 = fromhex_chksum(ppdata.salt1);
			salt2 = fromhex_chksum(ppdata.salt2);
			var pphash = sodium.crypto_pwhash_scryptsalsa208sha256(16, 
				sodium.crypto_pwhash_scryptsalsa208sha256(16, passphrase, 
				salt1, 4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/, 33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/),
			salt2, 4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/, 33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
			pphash = tohex_chksum(pphash);
                        if (pphash == ppdata.hash) {
				if (debug) console.log("validatePassphrase - correct");
				if (!isrecoveryphrase) {
					validatePassphraseCache.salt = sodium.randombytes_buf(sodium.crypto_shorthash_KEYBYTES);
					validatePassphraseCache.hash = sodium.crypto_shorthash(passphrase, validatePassphraseCache.salt, 'hex');
				}
				passphrase=""; 
                                return successfunc();
			}
			passphrase=""; 
			if (debug) console.log("validatePassphrase - incorrect");
                        return failurefunc();
                } } catch(e) { handle_error(e); } };
        db.get(( isrecoveryphrase? "rpdata" : "ppdata")).then(f).catch(f);	
}

function _validatePassphraseCacheHit(passphrase) {
	
    return validatePassphraseCache.salt != undefined && validatePassphraseCache.hash == sodium.crypto_shorthash(passphrase, validatePassphraseCache.salt, 'hex');	
}

function setPassphrase(newphrase, oldphrase, issettingrecoveryphrase, successfunc, failurefunc, firstrun) {
	if (debug) console.log("setPassphrase");
	var passPhraseUpdate = function(mode) {
		/* mode 0 - setting a new passphrase/recoveryphrase with valid current passphrase
		 * mode 1 - setting a new passphrase/recoveryphrase with valid current recoveryphrase
		 * mode 2 - setting a new passphrase/recoveryphrase for the first time.
		 */
		if (mode == 1 && issettingrecoveryphrase) {
			//cannot set a recovery phrase from a recovery phrase, must use an old passphrase for erk
			failurefunc();
			return;
		}
		var storagekey = (issettingrecoveryphrase ? "rpdata" : "ppdata");
		var doupdate = function(ppdata, rpdata) { try {
			var data = ( storagekey == 'rpdata' ? rpdata : ppdata );
			backupdata = {};
	                if (data.data == undefined || data.data == "") {
				data = {};
        	        } else {
				backupdata = JSON.parse(data.data);
				data = JSON.parse(data.data);
			}
			newsalt1 = sodium.randombytes_buf(sodium.crypto_pwhash_scryptsalsa208sha256_SALTBYTES);
                        newsalt2 = sodium.randombytes_buf(sodium.crypto_pwhash_scryptsalsa208sha256_SALTBYTES);
			
			oldsalt1 = ( mode == 2 ? '' : ( mode == 0 ? fromhex_chksum(ppdata.salt1) : fromhex_chksum(rpdata.salt1) ) );
			/* updating the key is a two step process:
			** A: the account secrets need to be decoded using the old key and recoded to the new key
			** B: the pp/rpdata entry needs to be updated
			*/
			//B
			/* The argument to this function is a copy of the original secrets (accounts) data structure
			** before it was rekeyed to the new secret. This is used to roll back that structure should
			** the ppdata update fail.
			*/
			var updateData = function(backupsecrets) {
				data.salt1 = tohex_chksum(newsalt1);
				data.salt2 = tohex_chksum(newsalt2);
				var secret;
				data.hash = tohex_chksum(sodium.crypto_pwhash_scryptsalsa208sha256(16,
			                                secret = sodium.crypto_pwhash_scryptsalsa208sha256(16, 
								newphrase, 
								newsalt1,
								4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/, 
								33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/),
				                        newsalt2, 
							4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/, 
							33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/));
	                        
				var commit = function(data, storagekey, success, failure) {
					db.upsert(storagekey, function(doc) { return { data: JSON.stringify(data)}; }).then(function(x){
						// success
						success();
					}).catch(function(x){
						// failure
						// this is a panic failure because the account secrets have already been updated
						// therefore we must roll them back if possible.
						if (backupsecrets != undefined) {
							db.upsert("accounts", function(doc) { return { data: JSON.stringify(backupsecrets)}; }).then(function(x){
								failure();
							}).catch(function(x){
								failure();
							});
						} else {
							failure();
						}
					});			
				}
				/* There are three end of sequence possibilities here which change the way the erk is set:
				** 1. Setting a new pp using an old pp 	[ seterk1 ]
				** 2. Setting a new pp using a rp 	[ seterk2 ]
				** 3. Setting a new rp using a pp	[ seterk3 ]
				*/
				/* This erk set function is only called when setting the recovery phrase using pp [ mode=0, issettingrecoveryphrase ]*/
				var seterk3 = function(ppdata /* this is the ppdata, data is rpdata */) {
					var nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
					ppdata = JSON.parse(ppdata.data);
					var ppsalt1 = fromhex_chksum(ppdata.salt1);
					// no need to decrypt the old erk because were setting a new recovery phrase so we already have the erk
					data.erk =
					tohex_chksum(sodium.from_hex(sodium.to_hex(nonce) + sodium.crypto_secretbox_easy(
						secret, /* the recovery key */
						nonce,
						/* 32byte secret key */
						sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
							oldphrase,
							ppsalt1,
							4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
							33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/),
						/* end secret key */
					'hex')));
					commit(data, "rpdata", successfunc, failurefunc);
				}
				/* This erk set function is only called when setting the pp using rp  [ mode=1, !issettingrecoveryphrase ] */
				var seterk2 = function(rpdata) {
					if (rpdata.data == undefined) {
						commit(data, "ppdata", successfunc, failurefunc);
						return;
					} 
					var nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
					rpdata = JSON.parse(rpdata.data);
					var rpsalt1 = fromhex_chksum(rpdata.salt1);
					// we have the recovery phrase (oldphrase) so we just need to generate the recovery key from it
					// and encrypt it using the 32byte secretkey
					var recoverykey = sodium.crypto_pwhash_scryptsalsa208sha256(16,
                                                        oldphrase,
                                                        rpsalt1,
                                                        4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
                                                        33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
					rpdata.erk = 
					tohex_chksum(sodium.from_hex(sodium.to_hex(nonce) + sodium.crypto_secretbox_easy(
						recoverykey, /* the recovery key */
						nonce,
						/* 32 byte secret key */
                                                sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
                                                        newphrase,
                                                        newsalt1,
                                                        4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
                                                        33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/),					
						/* end secret key */
					'hex')));
					commit(data, "ppdata", function() {
						commit(rpdata, "rpdata", successfunc, 
							function() {
								// if rpdata fails to set then we need to rollback ppdata
								commit(backupdata, "ppdata", failurefunc, failurefunc);
							}
						);
					}, failurefunc);
				}
				/* This erk set function is only called when setting the pp using old pp  [ mode=0, !issettingrecoveryphrase ] */
				var seterk1 = function(rpdata) {
					if (rpdata.data == undefined) {
						commit(data, "ppdata", successfunc, failurefunc);
						return;
					} 
					var nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
					rpdata = JSON.parse(rpdata.data);
					var rpsalt1 = fromhex_chksum(rpdata.salt1);
					/* this is the most complicated of the seterk functions, we must first decrypt the existing erk */
                                        // generate old 32byte secret key
                                        var old32secret =
                                                sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
                                                        oldphrase,
                                                        oldsalt1,
                                                        4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
                                                        33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
                                        // decrypt the old erk
                                        olderk = fromhex_chksum(rpdata.erk);
                                        var oldnonce = olderk.slice(0, sodium.crypto_box_NONCEBYTES);
                                        olderk = olderk.slice(sodium.crypto_box_NONCEBYTES);
                                        var recoverykey = sodium.crypto_secretbox_open_easy(olderk, oldnonce, old32secret);
					// now re-encrypt it with the new 32byte secret key
					rpdata.erk = 
					tohex_chksum(sodium.from_hex(sodium.to_hex(nonce) + sodium.crypto_secretbox_easy(
						recoverykey, /* the recovery key */
						nonce,
                                                /* 32 byte secret key */
                                                sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
                                                        newphrase,
                                                        newsalt1,
                                                        4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
                                                        33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/),
                                                /* end secret key */
					
					'hex')));
					commit(data, "ppdata", function() {
						commit(rpdata, "rpdata", successfunc, 
							function() {
								// if rpdata fails to set then we need to rollback ppdata
								commit(backupdata, "ppdata", failurefunc, failurefunc);
							}
						);
					}, failurefunc);
				}
				if (issettingrecoveryphrase) {
					db.get("ppdata").then(seterk3).catch(seterk3);
				} else if (mode == 1) {
					db.get("rpdata").then(seterk2).catch(seterk2);
				} else {
					db.get("rpdata").then(seterk1).catch(seterk1);
				} 
			}
			//A
			var updateAccounts = function(accounts) { try {
			
				if (accounts.data == undefined || accounts.data == "") {
					// no account secrets exist so we're done with part A
					return updateData();
				}
				
				// now we need to decode all the existing secrets
				// and re-encode them with the new secret
				
				backupaccounts = JSON.parse(accounts.data);
				accounts = JSON.parse(accounts.data);
				for (var public_addr in accounts) {
					var oldppsalt;
					var oldppciphertext;
					if (mode == 0) { // get secret using passphrase
						oldppsalt = fromhex_chksum(accounts[public_addr].ppsalt);
						oldppciphertext = fromhex_chksum(accounts[public_addr].ppsecret);
					} else if (mode == 1) { // get secret using recovery phrase
						oldppsalt = fromhex_chksum(accounts[public_addr].rpsalt);
						oldppciphertext = fromhex_chksum(accounts[public_addr].rpsecret);
					}
					var oldnonce = oldppciphertext.slice(0, sodium.crypto_box_NONCEBYTES);
					var oldppciphertext = oldppciphertext.slice(sodium.crypto_box_NONCEBYTES);					
					var newnonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
					var newppsalt = sodium.randombytes_buf(sodium.crypto_pwhash_scryptsalsa208sha256_SALTBYTES);
					var oldsecret32key = sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_box_SECRETKEYBYTES,  
								sodium.crypto_pwhash_scryptsalsa208sha256(16,
                                                                	oldphrase,
	                                                                oldsalt1,
        	                                                        4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
                	                                                33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/),
                        	                                oldppsalt,
                                	                        4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
                                        	                33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
					var newsecret32key = sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_box_SECRETKEYBYTES,  
								sodium.crypto_pwhash_scryptsalsa208sha256(16,
                                                                	newphrase,
	                                                                newsalt1,
        	                                                        4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
                	                                                33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/),
                        	                                newppsalt,
                                	                        4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
                                        	                33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
					
					var secret = sodium.crypto_secretbox_open_easy(oldppciphertext, oldnonce, oldsecret32key);
					oldsecret32key = "";
					var newppciphertext = tohex_chksum(sodium.from_hex(sodium.to_hex(newnonce) + sodium.crypto_secretbox_easy(
						secret,
						newnonce,
						newsecret32key,
						'hex'))
					);
					secret = "";
					newsecret32key = "";
					if (issettingrecoveryphrase) {
						accounts[public_addr].rpsalt = tohex_chksum(newppsalt);
						accounts[public_addr].rpsecret = newppciphertext;
					} else {
						accounts[public_addr].ppsalt = tohex_chksum(newppsalt);
						accounts[public_addr].ppsecret = newppciphertext;
					}
				}
				/* at this point the data structure for the accounts now contains fully updated
				** ciphertext and salts, so we can do a db.upsert then move to part B */
				db.upsert("accounts", function(doc) { return { data: JSON.stringify(accounts)}; }).then(function(x){
					updateData(backupaccounts);
				}).catch(function(x){
					failurefunc();
				}); 
					
			} catch(e) { handle_error(e); } }
			db.get("accounts").then(updateAccounts).catch(updateAccounts);
			
		} catch(e) { handle_error(e); } }
		getRpPpData(doupdate);
		
	}
	// this code checks if the supplied oldpassphrase is either their current passphrase or the 
	// recovery phrase, and returns to the above function accordingly, or if the current phrase is unset.
	if (firstrun != undefined && firstrun) {
		passPhraseUpdate(2);
	} else {
		validatePassphrase(oldphrase, false, 
			function() {passPhraseUpdate(0);}, 
			function() {
				// a recovery phrase cannot be used to set a recovery phrase.
				if (issettingrecoveryphrase) return failurefunc();
				validatePassphrase(oldphrase, true, 
					function(){passPhraseUpdate(1);}, 
					failurefunc, 
					function(){passPhraseUpdate(2);}
				);}, 
			function(){passPhraseUpdate(2);}
		);
	}
}

function getRpPpData(successfunc) {
	var f = function(ppdata) {
		if (ppdata.data == undefined || ppdata.data == "") ppdata = {};
		try {
			ppdata = JSON.parse(ppdata.data);
		} catch(e) {handle_error(e); ppdata={};}
		var g = function(rpdata) {
			if (rpdata.data == undefined || rpdata.data == "") rpdata = {};
			try {
				rpdata = JSON.parse(rpdata.data);
			} catch(e) {handle_error(e); rpdata={};}
			try {
			successfunc(ppdata, rpdata);
			} catch(e) {handle_error(e);}
		}
		db.get("rpdata").then(g).catch(g);
	}
	db.get("ppdata").then(f).catch(f);
}

function validatePassphaseOrRecovery(passphrase, successfunc, failurefunc, nopassphrasefunc) {
	if (debug) console.log("validatePassphrase");
	if (passphrase == "") return failurefunc();
        validatePassphrase(passphrase, false,
		successfunc,
                function() {
                        validatePassphrase(passphrase, true,
				successfunc,
                                failurefunc,
				nopassphrasefunc
                        );},
		nopassphrasefunc
        );
}

// Expose functions globally
window.doUpdateInterfaceSettings = doUpdateInterfaceSettings;
window.showInterfaceTab = showInterfaceTab;
window.doResetPassphrase = doResetPassphrase;
window.doResetPin = doResetPin;
window.setAndShowNewRecoveryPhrase = setAndShowNewRecoveryPhrase;
window.doRekeyAccount = doRekeyAccount;
window.rekeyAccount = rekeyAccount;
window.doResetGatewayPrompt = doResetGatewayPrompt;
window.doAddGateway = doAddGateway;
window.passphraseComplexityCheck = passphraseComplexityCheck;
window.validatePassphrase = validatePassphrase;
window._validatePassphraseCacheHit = _validatePassphraseCacheHit;
window.setPassphrase = setPassphrase;
window.getRpPpData = getRpPpData;
window.validatePassphaseOrRecovery = validatePassphaseOrRecovery;
},{}],23:[function(require,module,exports){
'use strict';

function doViewTransaction(hash) {
    if (debug) console.log('doViewTransaction -- ' + hash);
    blockInput();	
    setVal('#vtxhash', hash);
    
    remote.request({
        command: "tx",
        transaction: hash
    }).then(res => {
        var tx = res.result;
        var x = {
            result: 'success',
            transaction: {
                tx: tx,
                meta: tx.meta
            }
        };
        unblockInput();
        // todo: better server error handling here
        if (typeof(x.transaction) == "undefined" || typeof(x.transaction.tx) == "undefined" || typeof(x.transaction.meta) == "undefined") {
            setVal('#vtxstatus', 'Unknown / Not Found');
            hideEl('#vtxdetails');
            showTab('#tabviewtransaction', true);
            return;
        }
        // execution to here means the tx details were returned
        showEl('#vtxdetails');
        setVal('#vtxstatus', x.transaction.tx.TransactionType + (typeof(x.transaction.meta.TransactionResult) != 'undefined' ? ' - ' + x.transaction.meta.TransactionResult : ' - Unknown Status')); 
        setVal('#vtxfrom', dispaddr(x.transaction.tx.Account));
        setVal('#vtxdtag', typeof(x.transaction.tx.DestinationTag) == 'undefined' ? 'not specified' : x.transaction.tx.DestinationTag);
        if (interface_settings.display_xaddresses) {
            setVal('#vtxto', xaddr(x.transaction.tx.Destination, x.transaction.tx.DestinationTag == undefined ? false : x.transaction.tx.DestinationTag));
            hideEl('#vtxdtgroup');
        } else {
            showEl('#vtxdtgroup');
            setVal('#vtxto', x.transaction.tx.Destination);
        }
        setVal('#vtxdeliveredamount', typeof(x.transaction.meta.delivered_amount) != 'undefined' ? x.transaction.meta.delivered_amount/1000000.0 : 'not specified');
        setText('#vtxrawtx', JSON.stringify(x, null, 4) + '');
        showTab('#tabviewtransaction', true);
    }).catch(err => {
        unblockInput();
        setVal('#vtxstatus', 'Unknown / Not Found');
        hideEl('#vtxdetails');
        showTab('#tabviewtransaction', true);
    });
}

function doGetTransactions(address, marker) {
	if (debug) console.log("doGetTransactions");
	//blockInput();
    address = forceraddr(address);
    
    var reqParam = {
        command: "account_tx",
        account: address,
        limit: 20
    };
    if (marker) {
        try {
            reqParam.marker = JSON.parse(marker);
        } catch (e) {
            reqParam.marker = marker;
        }
    }
    
    remote.request(reqParam).then(res => {
        var payments = [];
        var txs = res.result.transactions || [];
        for (var i = 0; i < txs.length; i++) {
            var t = txs[i].tx;
            if (t && t.TransactionType === 'Payment' && typeof t.Amount === 'string') {
                payments.push({
                    source: t.Account,
                    destination: t.Destination,
                    amount: parseFloat(t.Amount) / 1000000.0,
                    tx_hash: t.hash || t.TxnSignature
                });
                if (payments.length >= 10) break;
            }
        }
        
        var nextMarker = res.result.marker ? JSON.stringify(res.result.marker) : undefined;
        var x = {
            payments: payments,
            marker: nextMarker
        };
        
		var root = byId('accdetailstransactiondetails');
		emptyEl(root);
		var tx = "";
		var count = 0;
		if (x.payments != undefined) {
			for (var i in x.payments) {
				tx += '<li class="txrow '+(x.payments[i].source == address ? 'txsent' : 'txreceived')+'" data-txhash="'+x.payments[i].tx_hash+'" ontouchstart="ts(event)" ontouchend="te(event, ()=>{doViewTransaction(\''+x.payments[i].tx_hash+'\')})">';
				var outgoing = (x.payments[i].source == address);
				tx += '<span><i class="fa ' + ( outgoing ? 'fa-paper-plane' : 'fa-inbox' ) + '" aria-hidden="true"></i>';
				var addr = ( outgoing ? x.payments[i].destination : x.payments[i].source );
                tx += dispaddr(addr) + '</span>';
				tx += '<span >' + x.payments[i].amount + '</span>';
				tx += '</li>';
				count++;
			}
		}
		if (count == 0) {
			tx = '<li style="color:black;"><center><i>No transactions found</i></center></li>';
		}
		appendHtml(root, '<ul class="transactionlist">'+tx+'</ul>');
		if (x.marker != undefined && count > 0) {
			appendHtml(root, '<button type="button" class="btn btn-primary" ontouchstart="ts(event)" ontouchend="te(event, ()=>{doGetTransactions(\'' + address + '\', ' + JSON.stringify(x.marker).replace(/"/g, '&quot;') + ')})">More</button>');
		} else if (count > 0) {
			appendHtml(root, '<button type="button" class="btn btn-primary" ontouchstart="ts(event)" ontouchend="te(event, ()=>{doGetTransactions(\'' + address + '\', \'\')})">Back to Start</button>');			
		}
		clickProxy();	
		unblockInput();
    }).catch(err => {
        if (debug) console.log("Get transactions error: " + err);
        unblockInput();
		var root = byId('accdetailstransactiondetails');
		emptyEl(root);
		appendHtml(root, '<ul class="transactionlist"><li style="color:black;"><center><i>Error loading transactions</i></center></li></ul>');
    });
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.doViewTransaction = doViewTransaction;
    window.doGetTransactions = doGetTransactions;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        doViewTransaction,
        doGetTransactions
    };
}
},{}],24:[function(require,module,exports){
'use strict';

function refreshTrustlines(account, after) {
    if (offlinemode) {
        setHtml('#adtrustlines', '<li><center><i>Offline trading not yet supported.<br>You can still send from a trustline balance and/or create a trustline.</i></center></li>');
        return;
    }
    
    setHtml('#adtrustlines', '<li><center><i>Loading...</i></center></li>');
    var f = (res) => {
        var trustlines = "";
        var tlcount = 0;
        if (res['trustlines'] != undefined && typeof(res['trustlines']) == 'object' && 
            res['trustlines'].length != undefined && res['trustlines'].length > 0) {
            for (var t in res['trustlines']) {
                var tl = res['trustlines'][t];
                var issuer, currency, balance;
                if (tl['specification'] == undefined || tl['state'] == undefined || (issuer = tl['specification']['counterparty']) == undefined || 
                (currency = tl['specification']['currency']) == undefined || (balance = tl['state']['balance']) == undefined || tl['specification']['limit'] === "0") continue;
                trustlines += '<li class="adtrustline"><div class="adtlheader"><div class="tlcurrency"><div class="currency">' + currency + '</div> ' + display_currency_amount(parseFloat(""+balance)) + '</div><div class="tlissuer">' + dispaddr(issuer) + '</div><div class="tlvaluation" style="display:none"><div class="currency"></div></div></div><div class="adtlorders"><ul class="adtlorderslist" id="olt-'+currency+'-'+issuer+'"></ul></div><div class="adtlgraph" id="grp-'+currency+'-'+issuer+'"></div><div class="bidask"><span class="bid"></span><span class="ask"></span></div><center><div class="adtlsubheader"><button class="btn btn-warning adtlbutton" ontouchstart="ts(event)" ontouchend="te(event,()=>{showModifyTrustline(\''+account+'\', \''+currency+'\', \''+issuer+'\', '+tl['specification']['limit']+')})"><i class="fa fa-cog" aria-hidden="true"></i></button><button class="btn btn-primary adtlbutton"  ontouchstart="ts(event)" ontouchend="te(event,()=>{showNewOrder(\''+account+'\', \'buy\', \''+currency+'\', \''+issuer+'\', '+balance+', domData(\'#grp-'+currency+'-'+issuer+'\', \'bid\'), domData(\'#grp-'+currency+'-'+issuer+'\', \'ask\'))})"><small>BUY</small></button><button class="btn btn-danger adtlbutton" ontouchstart="ts(event)" ontouchend="te(event,()=>{showNewOrder(\''+account+'\', \'sell\', \''+currency+'\', \''+issuer+'\', '+balance+', domData(\'#grp-'+currency+'-'+issuer+'\', \'bid\'), domData(\'#grp-'+currency+'-'+issuer+'\', \'ask\'))})"><small>SELL</small></button><button class="btn btn-success adtlbutton" ontouchstart="ts(event)" ontouchend="te(event,()=>{showPaymentTab(\''+account+'\', \''+currency+'\', \''+issuer+'\', '+balance+')})"><i class="fa fa-paper-plane"></i></button></div></center></li>';
            }
        } else {
            trustlines = '<li><center><i>No trustlines on this account.</i></center></li>';
            setHtml('#adtrustlines', trustlines);
            return;
        }
        setHtml('#adtrustlines', trustlines);
                          
        // get current exchange rate
       getExchangeRate("", "", (exchangerate, data) => { 
           // get account orders
            getOrders(account, (orders) => {            
               // render graphs 
                for (var t in data.tls) {
                   var tl = data.tls[t];
                   var issuer, currency, balance;
                   if (tl['specification'] == undefined || tl['state'] == undefined || (issuer = tl['specification']['counterparty']) == undefined || 
                   (currency = tl['specification']['currency']) == undefined || (balance = tl['state']['balance']) == undefined || tl['specification']['limit'] === "0") continue;
                    // render orders
                    console.log("orders - " + account + ": ");
                    console.log(orders);
                    var ordersele = byId('olt-' + currency + '-' + issuer);
                    emptyEl(ordersele);
                    for (var o in orders) {
                        var order = orders[o];
                        var currency1 = order.specification.quantity.currency.toUpperCase();
                        if (currency1 == currency && issuer == order.specification.quantity.counterparty) {
                            // this is an order that relates to the current graph so pass
                        } else continue;
                        var amount1 = parseFloat(''+order.specification.quantity.value);
                        var currency2 = order.specification.totalPrice.currency.toUpperCase();
                        var amount2 = parseFloat(''+order.specification.totalPrice.value);
                        var seq = order.properties.sequence;
                        var direction = order.specification.direction;
                        var rate = amount2/amount1;
                        appendHtml(ordersele, '<li><span class="offer">#'+seq+'</span> <span class="orderentry"><span class="orderdirection">'+direction.toUpperCase()+'</span> <span class="currency existingorder'+order.specification.direction+'">'+currency1+' ' + display_currency_amount(amount1) + '</span> @ <span class="currency">'+currency2+' '+display_currency_amount(rate)+'</span></span> <a class="orderkill" href="" ontouchend="te(event, (e)=>{doPlaceCancelOrder(sodium.randombytes_random(), confirmcancelorder={account:\''+account+'\', seq: '+seq+', currency1: \''+currency1+'\', amount1: '+amount1+', currency2: \''+currency2+'\', amount2: '+amount2+', sell: '+(direction == 'sell')+'} );})"><i class="fa fa-times-circle" style="color:red;"></i></a></li>');
                    }
                    
		            clickProxy();	
                   ((currency, issuer, exchangerate, balance) => {
                    remote.getOrderbook(
                        issuer, 
                        {"base": {"currency": currency, "counterparty": issuer}, 
                        "counter": {"currency":"XRP"}}, { limit: 25 }
                    ).then(orders => {
                       renderOrderbookChart(orders, '#grp-'+currency+'-'+issuer, exchangerate, balance);
                    });           
                   })(currency, issuer, exchangerate, parseFloat(""+balance));
                }
            });
        }, {tls: res['trustlines']});
        
    };
    var e = () => {
        setHtml('#adtrustlines', '<li><center><i>There was an error loading the account. It may not be activated. If you know it is then check your connection or restart Toast Wallet.</i></center></li>');
        return;
    };
    getAccountInfo(account, f, e);
}

function showModifyTrustline(account, currency, issuer, limit) {
    blockInput();
    setVal('#mtladdress', dispaddr(account));
    domData('#mtladdress', 'content', account);
    setVal('#mtlissueraddr', dispaddr(issuer));
    domData('#mtlissueraddr', 'content', issuer);    
    setVal('#mtlcurrency', currency);
    domData('#mtlcurrency', 'content', currency);        
    setVal('#mtllimit', limit);
    domData('#mtllimit', 'content', limit);        
    showTab('#tabmodifytrustline', true);
    unblockInput();
}

function doConfirmTrustline(passphrase) {
	if (debug) console.log("doConfirmTrustline");
	if (confirmtl.nonce == lastsettlnonce) {
		// this is an accidental double tap
		return;
	} 
	blockInput();
	lastsettlnonce = confirmtl.nonce;
	validatePassphrase(passphrase, false,
		function() {
			if (confirmtl == undefined || confirmtl.nonce == undefined || sodium.crypto_generichash(16, JSON.stringify(confirmtl), ''+confirmtl.nonce, 'hex') != confirmtlhash ) {
				navigator.notification.alert("An error occured when trying to submit your trustline request. No trustline was created.", 
					function(){
						showTab(-1);
						unblockInput();
					}, 
					"Error", 
					"OK"
				);
				return;
			}
            if (offlinemode) {
                // we're just going to create the tx as a QR code and display it
				navigator.notification.alert("A QR code of this signed trustline transaction has been generated. Scan it using your online device to complete the transaction.", 
					function(){
                        return sendTrustlineTxOffline(passphrase, confirmtl.atladdress, confirmtl.atlcurrency, confirmtl.atlissueraddr, confirmtl.atllimit, confirmtl.atlrippling, confirmtl.accseqid, confirmtl.ledseqid, confirmtl.fee);
                    }, 
					"Offline Transaction", 
					"OK"
				);            
                return;
            }
			checkConnection(
				function(){
					sendTrustlineTx(passphrase, confirmtl.atladdress, confirmtl.atlcurrency, confirmtl.atlissueraddr, confirmtl.atllimit, confirmtl.atlrippling, 
						function(wasqueued){
								navigator.notification.alert("Your trustline transaction was submitted successfully.", 
									function(){
										clearPaymentScreen();
										showTab("#tabaccounts");
										unblockInput();
									}, "Success", "OK"); 
						}, 
						function(err) {
							navigator.notification.alert("An error occured when trying to set your trustline." + err, 
							function(){
								lastsettlnonce = "";
								unblockInput();
							}, 
							"Error", "OK");
						}
					);
				}
			);
		},
		function() { 
			navigator.notification.alert("Your passphrase is incorrect. You cannot use a recoveryphrase here.", 
				function(){
					lastsettlnonce = "";
					unblockInput();
				},				
				"Error", "OK"
			);
		},
		function() { 
			navigator.notification.alert("Could not set trustline due to possible wallet corruption. We recommend backing up your wallet and reinstalling.", 
				function(){
					lastsettlnonce = "";
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		}
	);
}

function doModifyTrustline(nonce) {
	if (debug) console.log("doModifyTrustline");
	blockInput();
	var mtladdress = getVal("#mtladdress").trim();
	var mtlissueraddr = getVal("#mtlissueraddr").trim();
	var mtlcurrency = ("" + getVal("#mtlcurrency")).trim().toUpperCase();
	var mtllimit = getVal("#mtllimit").trim();
    var offlinecode = getVal('#mtlofflinecode').trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
    if (offlinemode) {
        var ofl = validateOfflineCode(offlinecode, '#mtlofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
    if (mtllimit != undefined && (mtllimit+"").charAt(0) == '.') mtllimit = "0" + mtllimit;
    var pl = parseLimit(mtllimit);
    if (pl === false || mtllimit == domData("#mtllimit", "content") || isNaN(Number(mtllimit))) {
        return navigator.notification.alert("Limit must be an integer or decimal greater than zero, and different from the current limit.", 
			function(){
                var mli = byId("mtllimit");
                if (mli) mli.focus();
				unblockInput();
			}, 
			"Invalid Limit", 
			"OK"
		);
    }
    mtllimit = pl;
	if (mtladdress == "" || !validateAddress(mtladdress)) {
		navigator.notification.alert("You must enter a valid sending XRP address.", 
			function(){
                var ma = byId("mtladdress");
                if (ma) ma.focus();
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
		return;
	}
	if (mtlissueraddr == "" || !validateAddress(mtlissueraddr)) {
		navigator.notification.alert("You must enter a valid issuer XRP address.", 
			function(){
                var mia = byId("mtlissueraddr");
                if (mia) mia.focus();
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
		return;
	}
	if (!validateCurrency(mtlcurrency)) {
		return navigator.notification.alert("Invalid currency code. Must be 3 characters A-Z, 0-9 or any of the following ? ! @ # $ % ^ & * < > ( ) { } [ ] |", 
			function(){
                var mc = byId("mtlcurrency");
                if (mc) mc.focus();
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
	}
	if (mtllimit == "") {
		navigator.notification.alert("You must enter a limit.", 
			function(){
                var ml = byId("mtllimit");
                if (ml) ml.focus();
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
		return;
	}
    var nextscreen = function(){
        confirmtl = {
            atladdress: forceraddr(mtladdress),
            atlissueraddr: forceraddr(mtlissueraddr),
            atlcurrency: mtlcurrency,
            atllimit: mtllimit,
            atlrippling: undefined, // this can't be set when modifying trustline
            nonce: nonce,
            accseqid: accID, // used for offline tx
            ledseqid: ledID,
            fee: fee
        };
        confirmtlhash = sodium.crypto_generichash(16, JSON.stringify(confirmtl), ''+nonce, 'hex');
        setText('#ctladdress', mtladdress);
        setText('#ctlissueraddr', mtlissueraddr);
        setText('#ctlcurrency', mtlcurrency);
        setText('#ctllimit', mtllimit);
        setText('#ctlrippling', 'UNCHANGED');
        showTab("#tabtrustlineconfirm");
        unblockInput();
    };
    checkAccountIsFunded(mtladdress, 0.1, 'XRP', '', function(){
			navigator.notification.confirm("You must have " + xrpreserve + " XRP + 5 XRP for each trustline in the account you are sending from. This reserve is a XRP Ledger requirement. In some circumstances this message may appear in error if you believe that to be the case you can opt to attempt the transaction however this will attract a XRP Ledger fee." , 
				function(b){
					if (debug) console.log("button selected: " + b);
					if (b == 1) {
						nextscreen();
					} else {
                        var ma = byId('mtladdress');
                        if (ma) ma.focus();
						unblockInput();
					}
				}, 
				"XRP Reserve not met", 
				[ "Try anyway", "Cancel" ]
                );},
                function() {
                    var ma = byId('mtladdress');
                    if (ma) ma.focus();
					unblockInput();                    
                }, nextscreen);
}

function doAddTrustline(nonce) {
	if (debug) console.log("doAddTrustline");
	blockInput();
	var atladdress = getVal("#atladdress").trim();
	var atlissueraddr = getVal("#atlissueraddr").trim();
	var atlcurrency = ("" + getVal("#atlcurrency")).trim().toUpperCase();
	var atllimit = getVal("#atllimit").trim();
	var atlrippling = getVal("#atlrippling").trim().toUpperCase() == "ENABLED";
    var offlinecode = getVal('#atlofflinecode').trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
    if (offlinemode) {
        var ofl = validateOfflineCode(offlinecode, '#atlofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
    if (atllimit != undefined && (atllimit+"").charAt(0) == '.') atllimit = "0" + atllimit;
    var pl = parseLimit(atllimit);
    if (pl === false || isNaN(Number(atllimit))) {
        return navigator.notification.alert("Limit must be an integer or decimal greater than zero.", 
			function(){
                var ali = byId("atllimit");
                if (ali) ali.focus();
				unblockInput();
			}, 
			"Invalid Limit", 
			"OK"
		);
    }
    atllimit = pl;
	if (atladdress == "" || !validateAddress(atladdress)) {
		navigator.notification.alert("You must enter a valid sending XRP address.", 
			function(){
                var aa = byId("atladdress");
                if (aa) aa.focus();
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
		return;
	}
	if (atlissueraddr == "" || !validateAddress(atlissueraddr)) {
		navigator.notification.alert("You must enter a valid issuer XRP address.", 
			function(){
                var aia = byId("atlissueraddr");
                if (aia) aia.focus();
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
		return;
	}
	if (!validateCurrency(atlcurrency)) {
		return navigator.notification.alert("Invalid currency code. Must be 3 characters A-Z, 0-9 or any of the following ? ! @ # $ % ^ & * < > ( ) { } [ ] |", 
			function(){
                var ac = byId("atlcurrency");
                if (ac) ac.focus();
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
	}
	if (atllimit == "") {
		navigator.notification.alert("You must enter a limit.", 
			function(){
                var al = byId("atllimit");
                if (al) al.focus();
				unblockInput();
			}, 
			"Error", 
			"OK"
		);
		return;
	}
    var nextscreen = function(){
        confirmtl = {
            atladdress: forceraddr(atladdress),
            atlissueraddr: forceraddr(atlissueraddr),
            atlcurrency: atlcurrency,
            atllimit: atllimit,
            atlrippling: atlrippling,
            nonce: nonce,
            accseqid: accID, // used for offline tx
            ledseqid: ledID,
            fee: fee
        };
        confirmtlhash = sodium.crypto_generichash(16, JSON.stringify(confirmtl), ''+nonce, 'hex');
        setText('#ctladdress', atladdress);
        setText('#ctlissueraddr', atlissueraddr);
        setText('#ctlcurrency', atlcurrency);
        setText('#ctllimit', atllimit);
        setText('#ctlrippling', (atlrippling ? 'ENABLED' : 'DISABLED'));
        showTab("#tabtrustlineconfirm");
        unblockInput();
    };
    checkAccountIsFunded(atladdress, 0.1, 'XRP', '', function(){
			navigator.notification.confirm("You must have " + xrpreserve + " XRP + 5 XRP for each trustline in the account you are sending from. This reserve is a XRP Ledger requirement. In some circumstances this message may appear in error if you believe that to be the case you can opt to attempt the transaction however this will attract a XRP Ledger fee." , 
				function(b){
					if (debug) console.log("button selected: " + b);
					if (b == 1) {
						nextscreen();
					} else {
                        var aa = byId('atladdress');
                        if (aa) aa.focus();
						unblockInput();
					}
				}, 
				"XRP Reserve not met", 
				[ "Try anyway", "Cancel" ]
                );},
                function() {
                    var aa = byId('atladdress');
                    if (aa) aa.focus();
					unblockInput();                    
                }, nextscreen);
}

function validateCurrency(cur) {
    return /^[A-Z0-9?!@#$%^&*<>(){}[\]|]{3}$/.test(""+cur);
}

function onToggleIssueOwnCurrency(forceoff) {
    if (debug) console.log("onToggleIssueOwnCurrency()");
    
    if (forceoff || domData('#tglIssueOwnCurrency', 'checked') != "true") {
        setVal('#payissuerofl', '');
        removeAttr('#payissuerofl', 'readonly');
        setAttr('#payassetofl', 'placeholder', 'Leave blank for XRP');
        hideEl('#oflcurrencydiv');
        showEl('#issueraddressbtnpaste');
        if (typeof setSelectVisible === 'function') setSelectVisible('#payasset', true);
    } else {
        if (typeof setSelectVisible === 'function') setSelectVisible('#payasset', false);
        showEl('#oflcurrencydiv');
        setVal('#payissuerofl', 'This account');
        setAttr('#payissuerofl', 'readonly', 'readonly');
        removeAttr('#payassetofl', 'placeholder');
        hideEl('#issueraddressbtnpaste');
        var pao = byId('payassetofl');
        if (pao) pao.focus();
    }
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.refreshTrustlines = refreshTrustlines;
    window.showModifyTrustline = showModifyTrustline;
    window.doConfirmTrustline = doConfirmTrustline;
    window.doModifyTrustline = doModifyTrustline;
    window.doAddTrustline = doAddTrustline;
    window.validateCurrency = validateCurrency;
    window.onToggleIssueOwnCurrency = onToggleIssueOwnCurrency;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        refreshTrustlines,
        showModifyTrustline,
        doConfirmTrustline,
        doModifyTrustline,
        doAddTrustline,
        validateCurrency,
        onToggleIssueOwnCurrency
    };
}
},{}]},{},[3]);
