'use strict';

function refreshTrustlines(account, after) {
    if (offlinemode) {
        setHtml('#adtrustlines', '<li><center><i>Offline trading not yet supported.<br>You can still send from a trustline balance and/or create a trustline.</i></center></li>');
        return;
    }
    
    setHtml('#adtrustlines', '<li><center><i>Loading...</i></center></li>');
    var f = (res) => {
        var tlContainer = byId('adtrustlines');
        if (!tlContainer) return;
        emptyEl(tlContainer);
        var validTls = [];
        if (res['trustlines'] != undefined && typeof(res['trustlines']) == 'object' && 
            res['trustlines'].length != undefined && res['trustlines'].length > 0) {
            for (var t in res['trustlines']) {
                var tl = res['trustlines'][t];
                var issuer, currency, balance;
                if (tl['specification'] == undefined || tl['state'] == undefined || (issuer = tl['specification']['counterparty']) == undefined || 
                (currency = tl['specification']['currency']) == undefined || (balance = tl['state']['balance']) == undefined || tl['specification']['limit'] === "0") continue;
                validTls.push(tl);

                var li = document.createElement('li');
                li.className = 'adtrustline';

                var header = document.createElement('div');
                header.className = 'adtlheader';

                var tlcurrency = document.createElement('div');
                tlcurrency.className = 'tlcurrency';
                var currDiv = document.createElement('div');
                currDiv.className = 'currency';
                currDiv.textContent = currency;
                tlcurrency.appendChild(currDiv);
                tlcurrency.appendChild(document.createTextNode(' ' + display_currency_amount(parseFloat("" + balance))));

                var tlissuer = document.createElement('div');
                tlissuer.className = 'tlissuer';
                tlissuer.textContent = dispaddr(issuer);

                var tlval = document.createElement('div');
                tlval.className = 'tlvaluation';
                tlval.style.display = 'none';
                var tlvalCurr = document.createElement('div');
                tlvalCurr.className = 'currency';
                tlval.appendChild(tlvalCurr);

                header.appendChild(tlcurrency);
                header.appendChild(tlissuer);
                header.appendChild(tlval);

                var adtlorders = document.createElement('div');
                adtlorders.className = 'adtlorders';
                var ulOrders = document.createElement('ul');
                ulOrders.className = 'adtlorderslist';
                ulOrders.id = 'olt-' + currency + '-' + issuer;
                adtlorders.appendChild(ulOrders);

                var adtlgraph = document.createElement('div');
                adtlgraph.className = 'adtlgraph';
                adtlgraph.id = 'grp-' + currency + '-' + issuer;

                var bidask = document.createElement('div');
                bidask.className = 'bidask';
                var spanBid = document.createElement('span');
                spanBid.className = 'bid';
                var spanAsk = document.createElement('span');
                spanAsk.className = 'ask';
                bidask.appendChild(spanBid);
                bidask.appendChild(spanAsk);

                var center = document.createElement('center');
                var subheader = document.createElement('div');
                subheader.className = 'adtlsubheader';

                var btnMod = document.createElement('button');
                btnMod.className = 'btn btn-warning adtlbutton';
                var iMod = document.createElement('i');
                iMod.className = 'fa fa-cog';
                iMod.setAttribute('aria-hidden', 'true');
                btnMod.appendChild(iMod);
                (function(acc, curr, iss, lim) {
                    btnMod.addEventListener('touchstart', ts);
                    btnMod.addEventListener('touchend', function(e) {
                        te(e, function() {
                            showModifyTrustline(acc, curr, iss, lim);
                        });
                    });
                })(account, currency, issuer, tl['specification']['limit']);

                var btnBuy = document.createElement('button');
                btnBuy.className = 'btn btn-primary adtlbutton';
                var smBuy = document.createElement('small');
                smBuy.textContent = 'BUY';
                btnBuy.appendChild(smBuy);
                (function(acc, curr, iss, bal) {
                    btnBuy.addEventListener('touchstart', ts);
                    btnBuy.addEventListener('touchend', function(e) {
                        te(e, function() {
                            var grpId = '#grp-' + curr + '-' + iss;
                            showNewOrder(acc, 'buy', curr, iss, bal, domData(grpId, 'bid'), domData(grpId, 'ask'));
                        });
                    });
                })(account, currency, issuer, balance);

                var btnSell = document.createElement('button');
                btnSell.className = 'btn btn-danger adtlbutton';
                var smSell = document.createElement('small');
                smSell.textContent = 'SELL';
                btnSell.appendChild(smSell);
                (function(acc, curr, iss, bal) {
                    btnSell.addEventListener('touchstart', ts);
                    btnSell.addEventListener('touchend', function(e) {
                        te(e, function() {
                            var grpId = '#grp-' + curr + '-' + iss;
                            showNewOrder(acc, 'sell', curr, iss, bal, domData(grpId, 'bid'), domData(grpId, 'ask'));
                        });
                    });
                })(account, currency, issuer, balance);

                var btnPay = document.createElement('button');
                btnPay.className = 'btn btn-success adtlbutton';
                var iPay = document.createElement('i');
                iPay.className = 'fa fa-paper-plane';
                btnPay.appendChild(iPay);
                (function(acc, curr, iss, bal) {
                    btnPay.addEventListener('touchstart', ts);
                    btnPay.addEventListener('touchend', function(e) {
                        te(e, function() {
                            showPaymentTab(acc, curr, iss, bal);
                        });
                    });
                })(account, currency, issuer, balance);

                subheader.appendChild(btnMod);
                subheader.appendChild(btnBuy);
                subheader.appendChild(btnSell);
                subheader.appendChild(btnPay);
                center.appendChild(subheader);

                li.appendChild(header);
                li.appendChild(adtlorders);
                li.appendChild(adtlgraph);
                li.appendChild(bidask);
                li.appendChild(center);

                tlContainer.appendChild(li);
            }
        }
        if (validTls.length === 0) {
            setHtml('#adtrustlines', '<li><center><i>No trustlines on this account.</i></center></li>');
            return;
        }
                          
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
                    if (ordersele) {
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

                            var oli = document.createElement('li');

                            var spanOffer = document.createElement('span');
                            spanOffer.className = 'offer';
                            spanOffer.textContent = '#' + seq;
                            oli.appendChild(spanOffer);
                            oli.appendChild(document.createTextNode(' '));

                            var spanEntry = document.createElement('span');
                            spanEntry.className = 'orderentry';

                            var spanDir = document.createElement('span');
                            spanDir.className = 'orderdirection';
                            spanDir.textContent = direction.toUpperCase();
                            spanEntry.appendChild(spanDir);
                            spanEntry.appendChild(document.createTextNode(' '));

                            var spanCurr1 = document.createElement('span');
                            spanCurr1.className = 'currency existingorder' + order.specification.direction;
                            spanCurr1.textContent = currency1 + ' ' + display_currency_amount(amount1);
                            spanEntry.appendChild(spanCurr1);
                            spanEntry.appendChild(document.createTextNode(' @ '));

                            var spanCurr2 = document.createElement('span');
                            spanCurr2.className = 'currency';
                            spanCurr2.textContent = currency2 + ' ' + display_currency_amount(rate);
                            spanEntry.appendChild(spanCurr2);

                            oli.appendChild(spanEntry);
                            oli.appendChild(document.createTextNode(' '));

                            var aKill = document.createElement('a');
                            aKill.className = 'orderkill';
                            aKill.href = '';
                            var iKill = document.createElement('i');
                            iKill.className = 'fa fa-times-circle';
                            iKill.style.color = 'red';
                            aKill.appendChild(iKill);

                            (function(acc, sq, c1, a1, c2, a2, dir) {
                                aKill.addEventListener('touchend', function(e) {
                                    te(e, function() {
                                        doPlaceCancelOrder(sodium.randombytes_random(), {
                                            account: acc,
                                            seq: sq,
                                            currency1: c1,
                                            amount1: a1,
                                            currency2: c2,
                                            amount2: a2,
                                            sell: (dir == 'sell')
                                        });
                                    });
                                });
                            })(account, seq, currency1, amount1, currency2, amount2, direction);

                            oli.appendChild(aKill);
                            ordersele.appendChild(oli);
                        }
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
        setText('#ctlfee', fee ? fee + ' XRP' : (offlinemode ? '0.000012 XRP' : 'Network Default (~0.000012 XRP)'));
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
        setText('#ctlfee', fee ? fee + ' XRP' : (offlinemode ? '0.000012 XRP' : 'Network Default (~0.000012 XRP)'));
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