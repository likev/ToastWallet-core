function showNewOrder(account, direction, currency, issuer, balance, bid, ask) {
    if (debug) console.log("showNewOrder - direction: " + direction + ", currency: " + currency + ", issuer: " + issuer + ", balance: " + balance + ", bid: " + bid + ", ask: " + ask); 
    $('#ntloaddress').val(dispaddr(account));
    $('#ntloaddress').data('content', account);
    $('#ntloaddress').data('direction', direction);
    if (direction == 'sell') {
        $('#lblntlosell').show();
        $('#lblntlobuy').hide();
    } else {
        $('#lblntlosell').hide();
        $('#lblntlobuy').show();
    }
    $('#ntloissuer').val(currency + ' - ' + dispaddr(issuer));
    $('#ntloissuer').data('currency', currency);
    $('#ntloissuer').data('issuer', issuer);
    $('#btnntloall').removeAttr('ontouchend');
    $('#btnntloall').attr('ontouchend', "te(event, ()=>{$('#ntloamount').val("+balance+"); renderOrderPreview();})");
    if (direction == 'buy') {
        // use minimum ask
        $('#ntloprice').val(ask);
    } else {
        // use minimum bid
        $('#ntloprice').val(bid);
    }
    $('#ntloamount').val('1');
    $('#customexpirydiv').hide();
    $('#ntloexpiry').show();
    $('#ntloexpiry > option').removeAttr('selected');
    $('#ntloexpiry-24h').attr('selected', 'selected');
    renderOrderPreview(direction == 'sell');
    showTab('#tabneworder', true);
    
}

function onToggleNewOrder() {
    if (debug) console.log("onToggleNewOrder()");
    blockInput();
    // enforce the mutually exclusive options in the order screen toggles
    //https://github.com/ripple/rippled/blob/817d2339b8632cb2f97d3edd6f7af33aa7631744/src/ripple/app/tx/impl/CreateOffer.cpp#L63
    
    var ioc = $('#tglntloioc').data('checked') == 'true';
    var fok = $('#tglntlofok').data('checked') == 'true';  
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
    if (typeof(sell) == 'undefined') sell = $('#lblntlosell').is(':visible');
    var currency = $('#ntloissuer').data('currency');
    var amount1 = $('#ntloamount').val();
    if ((amount1=parseFloat(amount1 + '')) + '' == 'NaN') amount1 = 0;
    var price = $('#ntloprice').val();
    if ((price=parseFloat(price + '')) + '' == 'NaN') price = 0;
    var amount2 = price * amount1;
    $('#ntlopriceupdate')[0].style.border = ( sell ? '1px solid rgb(217, 83, 79)' : '1px solid rgb(92, 184, 92)' );
    $('#ntlopriceupdate').html('<b>'+(sell ? 'SELL' : 'BUY')+'</b> <span class="currency">'+currency+'</span> '+display_currency_amount(amount1)+' for <span class="currency">XRP</span>'+display_currency_amount(amount2));
}

function adjustOrderPrice(x) {
    var previous = parseFloat(''+$('#ntloprice').val());
    if (previous + '' == 'NaN' || (previous == 0 && x > 0)) previous  = 0.000001;
	
    x = ( x >= 0 ? 1 : -1 );
    var next = previous + x * Math.pow(10, Math.floor(Math.log(previous)/Math.log(10))-3);
    var roundingpower = Math.pow(10, -Math.floor(Math.log(previous)/Math.log(10)) + 3);
    next *= roundingpower;
    next = Math.round(next);
    next /= roundingpower;
    if (next + '' == 'NaN' || next <= 0) next = previous;
	$('#ntloprice').val("" + next);
    renderOrderPreview();
}

function doPlaceCancelOrder(nonce, dataset) {
    // needed
    var account;
    var seq;
    var offlinecode;// = $('#---offlinecode').val().trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
    // extra
    var currency1;
    var amount1;
    var currency2;
    var amount2;
    var direction;
    
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
    } else {
    /*
   //todo: offline mode way to cancel orders -- when implemented pull in data here
    if (offlinemode) {
        ofl = validateOfflineCode(offlinecode, '#---offlinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
    // it should not be possible for this to happen but check anyway
	if (validateAddress(account)) {
		// valid
	} else {
		navigator.notification.alert("The account specified is not a valid XRP address.", 
			function(){
				$("#---address").focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);
	}
    if (!/^[0-9]+$/m.test(seq) || (seq = parseInt(expiry) ) < 0 ) {
        return navigator.notification.alert("Invalid sequence number. Must be a whole number greater than 0.", 
            function(){
                $('#---seq').focus();
                unblockInput();
            }, 
            "Invalid expiry", 
            "OK"
        );
    }
    */
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
		$('#confirmcancelorderaccount')[0].innerText = dispaddr(account);
        $('#confirmcancelorderpreview')[0].innerText = (sell ? 'SELL ' : 'BUY ') +  currency1 + ' ' + display_currency_amount(parseFloat(''+amount1)) + ' @ ' + currency2 + ' ' + display_currency_amount(parseFloat(''+amount2)/parseFloat(''+amount1));
        $('#confirmcancelordersequence')[0].innerText = '#' + seq;
		showTab("#tabcancelorderconfirm");
		
		unblockInput();
	};
    return nextscreen();
}

function doPlaceOrder(nonce) {
	if (debug) console.log("doPlaceOrder");
	blockInput();
	var account = $('#ntloaddress').data('content');
	var asset = $('#ntloissuer').data('currency');
	var issuer = $('#ntloissuer').data('issuer');
	var amount = $('#ntloamount').val().trim();
	var price = $('#ntloprice').val().trim();    
    var sell = $('#lblntlosell').is(':visible');
    var fok = $('#tglntlofok').data('checked') == 'true';
    var ioc = $('#tglntloioc').data('checked') == 'true';
    var passive = $('#tglntlopas').data('checked') == 'true';
    var expiry;
    var expiryunits;
    var expirydisplay; // what to show the user
    var expiryfocus; // what to focus on expiry entry error
    if ($('#ntloexpiry').is(":visible")) {
        // using presets
        expiry = parseInt($($('#ntloexpiry').find(":selected")[0]).data('hours')) * 60.0 + parseInt($($('#ntloexpiry').find(":selected")[0]).data('minutes'));
        expiryunits = 'minute';
        expirydisplay = $('#ntloexpiry').find(":selected")[0].innerText;
        expiryfocus = '#ntloexpiry';
    } else {
        // using custom
        expiry = $('#ntloexpirycustom').val();
        expiryunits = $($('#ntloexpirycustomunit').find(':selected')[0]).data('unit');
        expirydisplay = parseInt(expiry) + ' ' + $('#ntloexpirycustomunit').find(":selected")[0].innerText;
        expiryfocus = '#ntloexpirycustom';
    }
    var offlinecode = $('#ntloofflinecode').val().trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
	if (amount != undefined && (amount+"").charAt(0) == '.') amount = "0" + amount;
    if (offlinemode) {
        ofl = validateOfflineCode(offlinecode, '#ntloofflinecode');
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
		)
    }
    var invalidAmount = ()=>{
		return navigator.notification.alert("Invalid amount. Must be greater than or equal to 0.", 
			function(){
				$("#ntloamount").focus();
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
				$("#ntloprice").focus();
				unblockInput();
			}, 
			"Invalid amount", 
			"OK"
		);
    };
    // ensure theres no garbage in the price field
    if (!/^[0-9\.]+$/m.test(price) ) return invalidPrice();  
    try {
        var x = new BN(amount);
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
				$("#ntloaddress").focus();
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
				$("#ntloissuer").focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);
	}
    if (!validateCurrency(asset)) {
		return navigator.notification.alert("Invalid currency code. Must be 3 characters A-Z, 0-9 or any of the following ? ! @ # $ % ^ & * < > ( ) { } [ ] |", 
			function(){
				$("#ntloissuer").focus();
				unblockInput();
			}, 
			"Invalid currency code", 
			"OK"
		);    
    }
    if (!/^[0-9]+$/m.test(expiry) || (expiry = parseInt(expiry) ) <= 0 ) {
        return navigator.notification.alert("Invalid expiry. Must be a whole number greater than 0.", 
            function(){
                $(expiryfocus).focus();
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
                $(expiryfocus).focus();
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
		$('#confirmorderaccount')[0].innerText = dispaddr(account)
		$('#confirmorderasset')[0].innerText = asset
		$('#confirmorderissuer')[0].innerText = dispaddr(issuer) 
        $('#confirmorderamount')[0].innerText = amount;
        $('#confirmorderprice')[0].innerText = price;
		$('#confirmorderdirection')[0].innerText = ( sell ? 'SELL' : 'BUY' );
        $('#confirmorderexpiry')[0].innerText = expirydisplay;
        $('#confirmorderextra')[0].innerText = (passive ? 'PASSIVE' : '');
        if (fok || ioc) $('#confirmorderextra')[0].innerText += '' + ( passive ? ' + ' : '' ) + ( fok ? 'FILL-OR-KILL' : 'IMMEDIATE-OR-CANCEL' );
        
        if (!passive && !fok && !ioc) {
            $('#confirmorderextra')[0].innerText = 'NONE';
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

// Expose functions globally
window.showNewOrder = showNewOrder;
window.onToggleNewOrder = onToggleNewOrder;
window.renderOrderPreview = renderOrderPreview;
window.adjustOrderPrice = adjustOrderPrice;
window.doPlaceCancelOrder = doPlaceCancelOrder;
window.doPlaceOrder = doPlaceOrder;
window.doConfirmCancelOrder = doConfirmCancelOrder;
window.doConfirmOrder = doConfirmOrder;