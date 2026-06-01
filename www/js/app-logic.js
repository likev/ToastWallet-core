

// adds ontouchend events to select2 boxes for more snappy use on mobile
function select2EventProxy() {
    $('.select2').off('touchend')
    $('.select2').on('touchend', (event)=>{
        
        try {
            event.stopPropagation();
            event.preventDefault();
            if (!event.changedTouches || event.changedTouches.length === 0) {
                return;
            }
            if (event.target == document.elementFromPoint(event.changedTouches[0].pageX, event.changedTouches[0].pageY)) {
                var e = event.target
                while (e && e.parentNode && !(e.previousElementSibling && e.previousElementSibling.tagName == 'SELECT'))
                    e = e.parentNode
                if (!e || !e.parentNode || !e.previousElementSibling)
                    return
                try {$(e.previousElementSibling).select2('open')} catch(e) {}
                $('.select2-results__option').off('touchend')
                $('.select2-results__option').on('touchend', (event)=>{
                    try {
                        event.stopPropagation();
                        event.preventDefault();
                    } catch (E) {}
                    
                    if (event.changedTouches && event.changedTouches.length > 0 && event.target == document.elementFromPoint(event.changedTouches[0].pageX, event.changedTouches[0].pageY))
                        $(event.target).trigger('mouseup')
                })
            }
        } catch (E) {}
    })
}
// formats the internals of select2 comboboxes
function formatSelect2(state) {
    console.log('formataccselect2 called')    
    
    if (!state.element || !state.element.parentNode || 
        !state.element.parentNode.id || 
        !state.element.dataset || !state.element.dataset.account ||
        state.element.parentNode.id != 'payfromaccount'  ) 
        return $('<span>' + state.text + '</span>')
 
    var acc = state.element.dataset.account //state._resultId.replace(/^.+-/, '')
    var xacc = xaddr(acc, false)
    var ret = $('<span class="accselect2"></span>')
    ret.append(hashicon(xacc, 20))
    ret.append(' ')
    ret.append(
        (state.text == acc ? dispaddr(acc) : state.text)
    )
    return ret
}
// this function fires when an account is selected on the payments tab
// but is only used to supply red qr code in the event the user is in offline mode




function showDonationTab(){
	if (offlinemode || emergencybackup) return;
	if (('' + device.platform).toLowerCase() == 'android') {
        return showTab('#tabgoogle')
    }
    showTab('#tabdonate');
	
	remote.getOrderbook(
		"rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", 
		{"base": {"currency":"USD", "counterparty": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"}, 
		"counter": {"currency":"XRP"}},  { limit: 10 }
	).then(orders => {
		var exchangerate = 0;
		for (var i = 0; i < 10; i++) 
			exchangerate += parseFloat("" + orders.asks[i].properties.makerExchangeRate);
		exchangerate = 10.0/exchangerate;
			
		$("#btndonate20").text("Donate $20 (" + (20.0/exchangerate).toFixed(4) + " XRP)");
		$("#btndonate10").text("Donate $10 (" + (10.0/exchangerate).toFixed(4) + " XRP)");
		$("#btndonate5").text("Donate $5 (" + (5.0/exchangerate).toFixed(4) + " XRP)");
		$("#btndonate20").data('amount', (20.0/exchangerate).toFixed(4));
		$("#btndonate10").data('amount', (10.0/exchangerate).toFixed(4));
		$("#btndonate5").data('amount', (5.0/exchangerate).toFixed(4));
		
	}).catch( function(e) {
			
	});
}
function toggleShowPassField(field, eyebutton) 
{
        if (typeof field === 'string') field = [ field ]
        var colour = ($(field[0]).attr('type')  != 'text' ? '#fcf8e3' : '#fff')
        $(eyebutton).css('background-color', colour)
        
        for (var i = 0; i < field.length; ++i) {
            $(field[i]).attr('type', (colour != '#fff' ? 'text' : 'password') )
            $(field[i]).css('background-color',  colour)
        }
}
function doToggleInvoiceId() {
    $('#invoiceiddiv').css( 'display', ( $('#invoiceiddiv').css('display') == 'none' ? 'block' : 'none' ) );
}
function setToggleSwitch(tgl, checked, aftertglfunc, allowunknown) {
    var ctgl = $($(tgl).children()[0]);
    ctgl.removeClass('fa-toggle-on');
    ctgl.removeClass('fa-toggle-off');
    ctgl.removeClass('unknowntoggle');
    if (allowunknown != undefined)  $(tgl).data('allowunknown', allowunknown);
    ctgl.addClass((checked == 'unknown' || checked == undefined ? 'unknowntoggle' : ( checked? 'fa-toggle-on' : 'fa-toggle-off')));
    $(tgl).data('checked', '' + ( checked == 'unknown' || checked == undefined ? 'unknown' : ( checked ? 'true' : 'false' ) ));
    if (aftertglfunc != undefined) {
            $(tgl).data('after', aftertglfunc);
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
	timeatlastQR = $.now();
	if (device.platform == 'browser') {
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
	} else {
		cordova.plugins.barcodeScanner.scan(
			function (result) {
				if(!result.cancelled)
				{
					parseContentFunc(result.text, after, ...intoFields);
				}
			},
			function (e) {
				navigator.notification.alert("Could not find a camera on your device", 
					function(){
						handle_error(e);
					},
					"Error",
					"OK"
				);
			}
		);
	}
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
	$('#toaddress').val('rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y');
	$('#payamount').val('' + amount);
	showTab('#tabpayments', true); 
	$('#payamount').focus();
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
function clickProxy() {
    rebindAllHandlers();
	if ((device.platform + "").toLowerCase() == 'browser') {
        $('*:not(input):not(.select2):not([class^="select2-"]):not(.headerleft):not(.headerright):not(.toggleswitch):not(.morecontentindicator)').unbind('click');
		$('*:not(input):not(.select2):not([class^="select2-"]):not(.headerleft):not(.headerright):not(.toggleswitch):not(.morecontentindicator)').on('click', function(e) {
            inClickProxy = true;
            var ele = this;
            var _ts;
            var _te;
            var maxUp = 5;
            var srcEle;
            do {
                if (ele == undefined || $(ele) == undefined || $(ele)[0] == undefined) break;
                var events = $._data($(ele)[0], 'events');
                for (var x in events) {
                    if (x == 'touchstart') _ts = events['touchstart'];
                    if (x == 'touchend') _te = events['touchend'];
                }
                if (_ts == undefined && _te == undefined) {
                    _ts = $(ele).attr('ontouchstart');
                    _te = $(ele).attr('ontouchend');
                }
                if (_ts != undefined || _te != undefined) srcEle = (ele[0] == undefined ? ele : ele[0]);
            } while (_ts == undefined && _te == undefined && (typeof($(ele).parent) === 'function') && (ele = $(ele).parent()) != undefined  && maxUp-- > 0 );
            var executeHandler = (handler)=>{
                if (typeof(handler) == 'string') {
                    event = {srcElement: srcEle};
    				handler = '(function(){' + handler + ';})();';
	    			eval(handler);
                } else if (typeof(handler) == 'object') {
                    if (handler[0] != undefined && handler[0].handler != undefined && typeof(handler[0].handler) == 'function') {
                        event = {srcElement: srcEle};
                        (handler[0].handler)(event);
                    }
                }
            }
			if (_ts != undefined) {
                executeHandler(_ts);
			}
			if (_te != undefined) {
                executeHandler(_te);
			};
			e.stopPropagation();
			e.preventDefault();
            inClickProxy = false;
		});
		$("#morecontentindicator").off(); $("#morecontentindicator").on('click', function() {
			if (currenttab == "") return;
			$(currenttab).animate({ scrollTop: $(currenttab)[0].scrollHeight }, "fast");
			renderMoreContentIndicator();
			return false;
		});
	}
}
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
		validatePassphrase(passphrase, true, 
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, passphraseverified, true); },
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, passphraseverified, false); },
			function() { unblockInput(); doDataCorruptionRecovery(c, passphrase, recoveryphrase, passphraseverified, false); }
		);
		return;
	} else passphraseverified = false;
	
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
		$('#setpassword3').val(recoveryphrase);
		recoveryphrase = "";
		$('#setpassword4').focus();
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
	// Application Constructor
initialize: function() {
		    this.bindEvents();
	    },
	    // Bind Event Listeners
	    //
	    // Bind any events that are required on startup. Common events are:
	    // 'load', 'deviceready', 'offline', and 'online'.
bindEvents: function() {
		    document.addEventListener('deviceready', this.onDeviceReady, false);
		    if (typeof window.cordova === 'undefined') {
		        if (document.readyState === 'complete' || document.readyState === 'interactive') {
		            setTimeout(() => this.onDeviceReady(), 1);
		        } else {
		            document.addEventListener('DOMContentLoaded', () => this.onDeviceReady(), false);
		        }
		    }
	    },
	    // deviceready Event Handler
	    //
	    // The scope of 'this' is the event. In order to call the 'receivedEvent'
	    // function, we must explicitly call 'app.receivedEvent(...);'
onDeviceReady: function() {
			if (debug) console.log("onDeviceReady:1");
		       	db = new PouchDB('toastwallet');
			if (debug) console.log("onDeviceReady:2");
			rebindAllHandlers();
			setTimeout(afterCordovaLoad, 0);
			if (debug) console.log("onDeviceReady:3");
            // change all select boxes to the modern graphical format
            try {
                $('select').select2({templateResult:formatSelect2, templateSelection:formatSelect2})
            } catch(e) {}
            select2EventProxy()
			if (device.platform == 'iOS' && parseFloat("0" + device.version ) < 11) {
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





