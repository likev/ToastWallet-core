function refreshAccounts(after) {
    // mark and sweep to remove any dead accounts
    
    var nonce = sodium.randombytes_random();
    var acc = $(".accountitem");
	for (var i = 0; i < acc.length; i++) 
        $(acc[i]).data('markforupdate', nonce);
	
	$("#payfromaccount").empty();
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
                                    tlbalances = {};
                                    for (t in res['trustlines']) {
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
                                    var amount =  exchangerate * ( parseFloat("" + xrpBalance) + xrpvalueoftrustlinebalances );
                                    var stramount =  display_currency_amount(amount);
                                    fiatbalance = '<span class="mono" style="opacity:0.7"><div class="currency"><span>' + interface_settings.valuation_currency + ' ' + stramount + '</span></div></span>';
                                }
                                $("#ra" + account + ">.accountline>.amount").html('<span class="mono">' + fiatbalance + '</span>');
                                if (trustlines != "")  {
                                    $("#ra" + account + ">.trustlines").html(trustlines);
                                    $("#ra" + account + ">.trustlines").data('tlcount', tlcount);
                                }
                                $('#ra' + account + ' .accloadspinner').hide();
                                $("#ra" + account).removeData('markforupdate');
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
                                    $("#opt" + largestindex).prop('selected', true);
                                    $("#ra" + largestindex).addClass('active');
                                }
                            }
                            if (lastacc == account && after != undefined && typeof(after) == 'function') after();
                            
                        };
                        var e =
                        function(e) {
                            if (debug) console.log("account refresh error: " + e);
                            try {
                                $("#ra" + account + ">.accountline>.amount").html('<small style="opacity:0.7">not activated</small>');
                                $('#ra' + account + ' .accloadspinner').hide();
                                $("#ra" + account).removeData('markforupdate');
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
			var nickname = ( acc[i].nickname == undefined ? "" : acc[i].nickname.replace(/[^a-zA-Z0-9 ]/g, "").trim() );
            var toptouchend = 'te(event, ()=>{doSelectAccount(\''+i+'\', \''+nickname+'\', false);})';
            //var bottomtouchend = 'te(event, (x)=>{ var f=(x, m)=>{ return ((m <=0 || x == undefined) ? false : ( $(x).data(\'tlcount\') > 0 ? true : f($(x).parent(), m-1)) ) }; doSelectAccount(\''+i+'\', \''+nickname+'\', f(x, 5));})';
            var bottomtouchend = toptouchend; // changed the behaviour so it always goes to the account details tab, since the DEX is rarely used
            if ($('#ra' + i).length == 0) {
                $("#accountslist").prepend('<li data-account="'+i+'" ontouchstart="ts(event)" ontouchend="'+bottomtouchend+'" class="list-group-item accountitem '+(activeaccount == i?'active':'')+'" id="ra'+i+'"><span class="hashicon"></span><div class="accountline" ontouchstart="ts(event)" ontouchend="'+toptouchend+'"><a class="address"><span class="address">'+(nickname == "" ? dispaddr(i) : nickname)+'</span></a><div class="amount"><small style="opacity: 0.7">' + (offlinemode ? 'offline' : '') + '</small></div></div><div class="trustlines" ontouchstart="ts(event)" ontouchend="'+bottomtouchend+'"></div><i class="fas fa-circle-notch accloadspinner" style="'+(offlinemode? 'display:none' : '')+'"></i></li>');
            $('#ra' + i + ' .hashicon')[0].appendChild(hashicon(xaddr(i, false), 35))
            } else {
                // passively update without rewriting the dom
                if (activeaccount == i) {
                    $('#ra' + i).addClass('active');
                } else {
                    $('#ra' + i).removeClass('active');
                }
                // may have changed nickname since last update
                $('#ra' + i + ' span.address')[0].innerText = (nickname == "" ? dispaddr(i) : nickname);
                // update touchend event handlers
                $('#ra' + i + ' .hashicon').removeAttr('ontouchend');
                $('#ra' + i + ' .hashicon').attr('ontouchend', toptouchend);
                
                $('#ra' + i + ' .accountline').removeAttr('ontouchend');
                $('#ra' + i + ' .accountline').attr('ontouchend', toptouchend);
                $('#ra' + i + ' .trustlines').removeAttr('ontouchend');
                $('#ra' + i + ' .trustlines').attr('ontouchend', bottomtouchend);
                if (!offlinemode) $('#ra' + i + ' .accloadspinner').show();
                
            }
			$("#payfromaccount").append('<option data-account="'+i+'" id="opt'+i+'"'+( i == activeaccount ? ' selected=selected' : '' )+'>' + (nickname == "" ? i : nickname) + '</option>');
		}
        // check to see if there are any accounts on the stack which shouldn't be (i.e. one has been deleted)
        var list = $('.accountitem');
        for (var i = 0; i < list.length; i++) 
            if (!( $(list[i]).data('account') in acc)) list[i].remove();
		clickProxy();	
        if (offlinemode) return after();
        fetchRateAndUpdateBalance(after);
	});
}

function doSelectAccount(accselected, nickname, trustlinesSubTab) {
	if (debug) console.log("doSelectAccount");
	var acc = $(".accountitem");
	for (var i = 0; i < acc.length; i++) {	
		acc.removeClass("active");
	}
	$("#ra" + accselected).addClass("active");
	activeaccount = accselected;
	$("#fromaccountslist>*:not(.bottom-list-button)").remove();
    $("#fromaccountslist").prepend('<li class="list-group-item accountitem active"><span class="hashicon"></span><div class="accountline"><a href="#" class="address"><span class="address">'+accselected+'</span></a><span class="amount">'+( accountbalances[accselected] == undefined ? '' :  accountbalances[accselected] + " XRP")+'</span></div><div class="trustlines"></div></li>');
	showTab("#tabaccountdetails");	
    if (trustlinesSubTab == undefined || !trustlinesSubTab) {
        selectAccountDetailsSubTab($('#btnaccdetailsselectaddress'), 'address');
    } else {
        selectAccountDetailsSubTab($('#btnaccdetailsselecttrustlines'), 'trustlines');
    }
    $("#accdetailsamount").html( accountbalances[accselected] == undefined ? '' :  '<b><div class="currency">XRP</div> ' + accountbalances[accselected] + '</b>' );
	$("#accdetailsaddress").data('content', accselected );
	$("#accdetailsqr").empty();
	$("#accdetailsqr").append(kjua({text: dispaddr(accselected)}));
	
	$("#accdetailsnickname")[0].innerText = (nickname == undefined || nickname == "" ? "XRP address" : nickname);
	
	$("#accdetailsaddress").val( dispaddr( accselected ));
}

function doDeleteAccount(passphrase, address, toggle) {
	if (debug) console.log("doDeleteAccount");
    address = forceraddr(address)
	blockInput();
        if (!toggle) {
                navigator.notification.alert("You must confirm you wish to DELETE " + address, function(){}, "STOP", "OK");
		unblockInput();
                return;
        }
	validatePassphrase( passphrase, false,
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
    address = forceraddr(address)
        validatePassphrase(passphrase, false,
                function() {
			getSecretForAccount(passphrase, address, function(secret) {
				$("#lblacpassword").hide();
				$("#lblaccsecret").show();
				$("#btnrevealsecret").hide();
				$("#divrsecaccpassword").hide();
        	                $("#accsecret").val(secret);
        	                $("#accsecret").data('content', secret);
				$("#accsecret").show();
				$("#btncopysecret").show();
                	        $("#accsecretqr").append(kjua({text: secret}));				
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
					$("#genaccpassword").focus();
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
    address = forceraddr(address)
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
					$('#vanityaddr').focus();
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
					$("#genaccpassword").focus();
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
	$("#generatedaddress").text(dispaddr(generatedAccount.address).slice(0,20) + "XXXXXXXXXXXX");
	showTab("#tabgenaccount");	
	unblockInput();
}

function changeNickname(address, nickname, successfunc, failurefunc) {
    address = forceraddr(address)
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
		})
	} catch(e) { handle_error(e); } }
	db.get("accounts").then(f).catch(f);
}

function importAddress(secret, address, nickname, passphrase, successfunc, failurefunc) {
    address = forceraddr(address)
	// set backup reminder to nothing so they get a prompt immediately after importing
	db.upsert("lastbackupreminder",
		function(doc) {
			return { data: JSON.stringify({})	}; 
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
			erk = fromhex_chksum(rpdata.erk);
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
			//now generate the keys that will be used to lock the ppsecret and rpsecret boxes
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
			} catch(e) { handle_error(e); } }
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
    }
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
			address: 	xrpl.deriveAddress(	xrpl.deriveKeypair(secret).publicKey )
		};
	}
}

function getSecretForAccount(passphrase, address, successfunc, failurefunc) {
    address = forceraddr(address)
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
			//now generate the keys that will be used to lock the ppsecret and rpsecret boxes
			var ppsecret32key = 
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					secretkey,
					fromhex_chksum(accounts[address].ppsalt),
					4 /*sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE*/,
					33554432 /*sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE*/);
			
			secretkey = "";
		
			// decrypt ppsecret 
			ppsecret = fromhex_chksum(accounts[address].ppsecret);
			var nonce = ppsecret.slice(0, sodium.crypto_box_NONCEBYTES);
			ppsecret = ppsecret.slice(sodium.crypto_box_NONCEBYTES);
			var secret = sodium.crypto_secretbox_open_easy(ppsecret, nonce, ppsecret32key);
			successfunc(sodium.to_string(secret));
		} catch(e) {handle_error(e); failurefunc();}});
	} catch(e) {handle_error(e); failurefunc();}});
}

function removeSecret(address, successfunc, failurefunc) {
	address = forceraddr(address)
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
	} catch(e) { handle_error(e); } }
	db.get("accounts").then(f).catch(f);
}

// Expose functions globally
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