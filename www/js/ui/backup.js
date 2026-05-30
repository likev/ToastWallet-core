function showBackupReminderTab(){
	showTab('#tabbackupreminder');
}

function doGenerateBackup() {
	if (debug) console.log("doGenerateBackup");
	blockInput();	
	exportWallet(
		function(data){
			showTab('#tabbackup2');
			$('#walletbackup').val( data ); 
			$('#walletbackup').data('content', data);
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
    var backupcode = $('#restorebackup2').val().trim();
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
        $('#divrestorerror').html("Errors were found in your backup code:<br/>" + check.error + "<br/>");
        $('#divrestorerror').css('color', '#ffeb3b');
        $('#divrestorerror').css('text-align', 'center');
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
	if ($('#tabrestore .toggleswitch').data('checked') != 'true') {
		navigator.notification.alert("You must acknowledge that you understand this will DESTROY your current wallet.", 
			function(){
				unblockInput();
			}, 
			"STOP",
			"OK"
		);
		return;
	}
    if ($('#restorebackup').val().trim().toLowerCase() == 'delete') {
        return db.upsert("accounts", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("ppdata", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("rpdata", function(doc) { return { data: "" }; }).then(function() {
                        db.upsert("pindata", function(doc) { return { data: "" }; }).then(function() {
                                unblockInput();
                                $('#btnbootstrapsequence').show();
                                $('#btnbootstraprestorebackup').show();
                                normalboot();
        })})})});
    }
    importWallet(
        $('#restorebackup').val(),
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
    raw = raw.replace(/||||`||'/mg, '"');
    
    $('#backupcode').val(raw);
    var json = raw; 
    // pull off the front checksum we dont need it
    while (json != '' && json.charAt(0) != '{') json = json.slice(1);
    try {
        var backup = JSON.parse(json);
        
        
        for (var i in backup) {
            if (allowedkeys.indexOf(i) == -1) {
                output += "JSON key: " + i + " is not valid, should be one of " + '"walletversion", "pindata", "ppdata", "rpdata", "accounts"' + "<br />";
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
                if (accounts[i]['ppsalt'] == undefined) output += "Account " + i + " ppsalt missing<br/>";
                if (!isvalidhex(accounts[i]['ppsalt'])) output += "Account " + i + " ppsalt invalid<br/>";
                if (accounts[i]['rpsalt'] == undefined) output += "Account " + i + " rpsalt missing<br/>";
                if (!isvalidhex(accounts[i]['rpsalt'])) output += "Account " + i + " rpsalt invalid<br/>";
                if (accounts[i]['ppsecret'] == undefined) output += "Account " + i + " ppsecret missing<br/>";
                if (!isvalidhex(accounts[i]['ppsecret'])) output += "Account " + i + " ppsecret invalid<br/>";
                if (accounts[i]['rpsecret'] == undefined) output += "Account " + i + " rpsecret missing<br/>";
                if (!isvalidhex(accounts[i]['rpsecret'])) output += "Account " + i + " rpsecret invalid<br/>";
            } catch (e) {
                output += "Account " + i + " invalid, check that it was transcribed correctly<br/>";
            }
        }
        var json = JSON.stringify(backup);
        return {cleanedbackupcode: sodium.crypto_generichash(4, json, '', 'hex') + json, error: (output == "" ? false : output) };
    } catch(e) {
        output +=  "<br/><b>" + e + "</b>";	
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