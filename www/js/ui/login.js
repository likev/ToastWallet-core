'use strict';

function doShowLogin() {
	if (debug) console.log("doShowLogin");
    if (typeof wipeGeneratedAccount === 'function') wipeGeneratedAccount();
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
                        var onComplete = function() {
                            if (typeof wipeSensitiveDom === 'function') wipeSensitiveDom();
                            if (typeof clearClipboard === 'function') clearClipboard();
                            if (typeof window !== 'undefined' && window.AppState) {
                                window.AppState.accounts = {};
                                window.AppState.accountbalances = {};
                                window.AppState.accountbalancestl = {};
                                window.AppState.accountflags = {};
                                window.AppState.walletsalt = null;
                                window.AppState.userkey = "";
                            }
                            normalboot();
                        };
                        if (db && typeof db.destroy === 'function') {
                            db.destroy().then(onComplete);
                        } else {
                            db.upsert("accounts", function(doc) { return { data: "" }; }).then(function() {
                            db.upsert("ppdata", function(doc) { return { data: "" }; }).then(function() {
                            db.upsert("rpdata", function(doc) { return { data: "" }; }).then(function() {
                            db.upsert("pindata", function(doc) { return { data: "" }; }).then(onComplete);
                            })})});
                        }
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