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