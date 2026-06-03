function doUpdateInterfaceSettings() {
    var currency = $('#valuationcurrency option:selected').data('currency')
    var counterparty = $('#valuationcurrency option:selected').data('counterparty')
    var xaddr = $('#tglUseXAddress').data('checked')
    if (currency && counterparty) { 
        interface_settings.valuation_currency = currency
        interface_settings.valuation_counterparty = counterparty
    }
    // switches return strings of true false or undefined
    interface_settings.display_xaddresses = xaddr === 'true'
    saveInterfaceSettings()
    showTab('#tabaccounts')
}

function showInterfaceTab() {
    try {
    $('#valuationcurrency > option[data-currency="'+interface_settings.valuation_currency+'"][data-counterparty="'+interface_settings.valuation_counterparty+'"]')[0].selected = true
    } catch(e) {}
    setToggleSwitch('#tglUseXAddress', interface_settings.display_xaddresses)
    showTab('#tabinterface', true)
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
	
	$("#showrecoveryphrase").text(rp);
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