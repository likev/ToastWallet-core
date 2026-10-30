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
                                        trustlinesdropdown[account]["" + currency + issuer] = '<option id="optpa-' + escapeHtml(currency)  + '-' + escapeHtml(issuer) + '" data-asset="' + escapeHtml(currency) + '" data-issuer="' + escapeHtml(issuer) + '">' + escapeHtml(currency.replace(/[^A-Za-z0-9?!@#$%\^&*<>(){}[\]|]/mg, "")) + ' - ' + escapeHtml(dispaddr((""+issuer).replace(/[^A-Za-z0-9]/mg, ""))) + '</option>';
                                    }
                                    for (var currency in tlbalances) {
                                        trustlines += '<div class="trustline"><div class="amount"><span class="mono"><div class="currency">' + escapeHtml(currency) + '</div> ' + display_currency_amount(tlbalances[currency]) + '</span></div></div>';
                                        tlcount++;
                                    }
                                }
                                trustlines = '<div class="trustline"><div class="amount"><span class="mono" style=""><div class="currency">XRP</div> ' + display_currency_amount(xrpBalance) + '</span></div></div>' + trustlines;
                                var fiatbalance = "";
                                if (exchangerate > 0) {
                                    var amount = exchangerate * (parseFloat("" + xrpBalance) + xrpvalueoftrustlinebalances);
                                    var stramount = display_currency_amount(amount);
                                    fiatbalance = '<span class="mono" style="opacity:0.7"><div class="currency"><span>' + escapeHtml(interface_settings.valuation_currency) + ' ' + stramount + '</span></div></span>';
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
            if (!byId('ra' + i)) {
                var li = document.createElement('li');
                li.setAttribute('data-account', i);
                li.className = 'list-group-item accountitem ' + (activeaccount == i ? 'active' : '');
                li.id = 'ra' + i;

                var hSpan = document.createElement('span');
                hSpan.className = 'hashicon';

                var aLine = document.createElement('div');
                aLine.className = 'accountline';

                var aLink = document.createElement('a');
                aLink.className = 'address';
                var addrSpan = document.createElement('span');
                addrSpan.className = 'address';
                addrSpan.textContent = (nickname == "" ? dispaddr(i) : nickname);
                aLink.appendChild(addrSpan);
                aLine.appendChild(aLink);

                var amtDiv = document.createElement('div');
                amtDiv.className = 'amount';
                var smallEl = document.createElement('small');
                smallEl.style.opacity = '0.7';
                smallEl.textContent = (offlinemode ? 'offline' : '');
                amtDiv.appendChild(smallEl);
                aLine.appendChild(amtDiv);

                var tlDiv = document.createElement('div');
                tlDiv.className = 'trustlines';

                var spin = document.createElement('i');
                spin.className = 'fas fa-circle-notch accloadspinner';
                if (offlinemode) spin.style.display = 'none';

                (function(accId, nick) {
                    var selectHandler = function(e) {
                        te(e, function() {
                            doSelectAccount(accId, nick, false);
                        });
                    };
                    li.addEventListener('touchstart', ts);
                    li.addEventListener('touchend', selectHandler);
                    aLine.addEventListener('touchstart', ts);
                    aLine.addEventListener('touchend', selectHandler);
                    tlDiv.addEventListener('touchstart', ts);
                    tlDiv.addEventListener('touchend', selectHandler);
                })(i, nickname);

                li.appendChild(hSpan);
                li.appendChild(aLine);
                li.appendChild(tlDiv);
                li.appendChild(spin);

                var accountsList = byId('accountslist');
                if (accountsList) {
                    accountsList.insertBefore(li, accountsList.firstChild);
                }
                hSpan.appendChild(hashicon(xaddr(i, false), 35));
            } else {
                // passively update without rewriting the dom
                if (activeaccount == i) {
                    addClass('#ra' + i, 'active');
                } else {
                    removeClass('#ra' + i, 'active');
                }
                // may have changed nickname since last update
                var addrSpan = qs('#ra' + i + ' span.address');
                if (addrSpan) addrSpan.textContent = (nickname == "" ? dispaddr(i) : nickname);
                if (!offlinemode) showEl('#ra' + i + ' .accloadspinner');
            }
            var payFromSel = byId('payfromaccount');
            if (payFromSel) {
                var opt = document.createElement('option');
                opt.value = i;
                opt.setAttribute('data-account', i);
                opt.id = 'opt' + i;
                if (i == activeaccount) opt.selected = true;
                opt.textContent = (nickname == "" ? i : nickname);
                payFromSel.appendChild(opt);
            }
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
        var liSel = document.createElement('li');
        liSel.className = 'list-group-item accountitem active';
        var hSpanSel = document.createElement('span');
        hSpanSel.className = 'hashicon';
        var aLineSel = document.createElement('div');
        aLineSel.className = 'accountline';
        var aLinkSel = document.createElement('a');
        aLinkSel.href = '#';
        aLinkSel.className = 'address';
        var addrSpanSel = document.createElement('span');
        addrSpanSel.className = 'address';
        addrSpanSel.textContent = accselected;
        aLinkSel.appendChild(addrSpanSel);
        aLineSel.appendChild(aLinkSel);
        var amtSpanSel = document.createElement('span');
        amtSpanSel.className = 'amount';
        amtSpanSel.textContent = (accountbalances[accselected] === undefined ? '' : (accountbalances[accselected] + " XRP"));
        aLineSel.appendChild(amtSpanSel);
        var tlDivSel = document.createElement('div');
        tlDivSel.className = 'trustlines';
        liSel.appendChild(hSpanSel);
        liSel.appendChild(aLineSel);
        liSel.appendChild(tlDivSel);
        fromList.insertBefore(liSel, fromList.firstChild);
    }
	showTab("#tabaccountdetails");	
    if (trustlinesSubTab == undefined || !trustlinesSubTab) {
        selectAccountDetailsSubTab(byId('btnaccdetailsselectaddress'), 'address');
    } else {
        selectAccountDetailsSubTab(byId('btnaccdetailsselecttrustlines'), 'trustlines');
    }
    var amtEl = byId('accdetailsamount');
    if (amtEl) {
        emptyEl(amtEl);
        if (accountbalances[accselected] !== undefined) {
            var bEl = document.createElement('b');
            var currDiv = document.createElement('div');
            currDiv.className = 'currency';
            currDiv.textContent = 'XRP';
            bEl.appendChild(currDiv);
            bEl.appendChild(document.createTextNode(' ' + accountbalances[accselected]));
            amtEl.appendChild(bEl);
        }
    }
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

function wipeGeneratedAccount() {
    if (typeof generatedAccount === 'object' && generatedAccount !== null) {
        if (typeof generatedAccount.secret === 'string') {
            generatedAccount.secret = '';
        }
    }
    generatedAccount = {};
    if (typeof window !== 'undefined') {
        if (window.generatedAccount && typeof window.generatedAccount.secret === 'string') {
            window.generatedAccount.secret = '';
        }
        window.generatedAccount = {};
        if (window.AppState) {
            window.AppState.generatedAccount = null;
        }
    }
    if (typeof setVal === 'function') {
        try {
            setVal('#txtsecret', '');
            setVal('#genaccpassword', '');
            setVal('#vanityaddr', '');
        } catch (e) {}
    }
}

function doImportExistingAccount(passphrase, nickname, secret, vanityaddr) {
	if (debug) console.log("doImportExistingAccount");
	if (typeof generatedAccount !== 'object' || generatedAccount === null) {
		generatedAccount = {};
	}
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
            wipeGeneratedAccount();
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
					wipeGeneratedAccount();
					showTab('#tabaccounts'); 
					unblockInput();
				},
				function() {
					// import failure will produce its own message 
					wipeGeneratedAccount();
					unblockInput();
				}
			);
		},
		function() {
			wipeGeneratedAccount();
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
			wipeGeneratedAccount();
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
            var ppParams = (typeof getScryptParamsForVersion === 'function')
                ? getScryptParamsForVersion(ppdata.version)
                : { opsLimit: (ppdata.version === 2 ? 524288 : 4), memLimit: (ppdata.version === 2 ? 16777216 : 33554432) };

            var secret32key =
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					passphrase,
					fromhex_chksum(ppdata.salt1),
					ppParams.opsLimit,
					ppParams.memLimit);
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
					ppParams.opsLimit,
					ppParams.memLimit);			
			passphrase = "";
			// now generate the keys that will be used to lock the ppsecret and rpsecret boxes
			var ppsecret32key = 
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					secretkey,
					ppsalt,
					524288,
					16777216);
			
			secretkey = "";
			var rpsecret32key = 
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					recoverykey,
					rpsalt,
					524288,
					16777216);
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
					nickname: nickname,
					version: 2
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
                } else {
                    return navigator.notification.alert("The address you specified does not have a regular key set, and does not match the secret provided.", failurefunc, "Failure", "OK");
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
			
            var ppParams = (typeof getScryptParamsForVersion === 'function')
                ? getScryptParamsForVersion(ppdata.version)
                : { opsLimit: (ppdata.version === 2 ? 524288 : 4), memLimit: (ppdata.version === 2 ? 16777216 : 33554432) };
            var accParams = (typeof getScryptParamsForVersion === 'function')
                ? getScryptParamsForVersion(accounts[address].version)
                : { opsLimit: (accounts[address].version === 2 ? 524288 : 4), memLimit: (accounts[address].version === 2 ? 16777216 : 33554432) };

			// generate regular secret key
			var secretkey =
				sodium.crypto_pwhash_scryptsalsa208sha256(16,
					passphrase,
					fromhex_chksum(ppdata.salt1),
					ppParams.opsLimit,
					ppParams.memLimit);			
			passphrase = "";
			// now generate the keys that will be used to lock the ppsecret and rpsecret boxes
			var ppsecret32key = 
				sodium.crypto_pwhash_scryptsalsa208sha256(sodium.crypto_secretbox_KEYBYTES,
					secretkey,
					fromhex_chksum(accounts[address].ppsalt),
					accParams.opsLimit,
					accParams.memLimit);
			
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
    window.wipeGeneratedAccount = wipeGeneratedAccount;
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
        removeSecret,
        wipeGeneratedAccount
    };
}