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
	var rawAfAddress = getVal("#afaddress").trim();
	var afaddress = forceraddr(rawAfAddress) || domData('#afaddress', 'content') || rawAfAddress;
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
        var ofl = validateOfflineCode(offlinecode, '#afofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    } else if (accountflags[afaddress] === undefined) {
        return navigator.notification.alert("Account information is still loading. Please wait a moment and try again.", () => { unblockInput(); }, "Loading", "OK");
    }
    var flag_keys = ['defaultRipple', 'depositAuth', 'disableMasterKey', 'disallowIncomingXRP', 'globalFreeze', 'noFreeze', 'requireAuthorization', 'requireDestinationTag'];  
    // check which flags have changed
    var old_flags_orig = {};
    var old_flags = {};
    if (accountflags[afaddress] != undefined) old_flags_orig = accountflags[afaddress];
    for (var i in flag_keys) old_flags[flag_keys[i]] = (offlinemode ? 'unknown' : (flag_keys[i] in old_flags_orig && old_flags_orig[flag_keys[i]]));
    var nextscreen = function(){ 
        var confirmfl_obj = {
            afaddress: afaddress,
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
        setText('#caffee', fee ? fee + ' XRP' : (offlinemode ? '0.000012 XRP' : 'Network Default (~0.000012 XRP)'));
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