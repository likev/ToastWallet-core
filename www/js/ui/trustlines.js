function refreshTrustlines(account, after) {
    if (offlinemode) { $('#adtrustlines').html('<li><center><i>Offline trading not yet supported.<br>You can still send from a trustline balance and/or create a trustline.</i></center></li>'); return; }
    
    $('#adtrustlines').html('<li><center><i>Loading...</i></center></li>');
    var f = (res)=>{
        var trustlines = "";
        var tlcount = 0;
        if (res['trustlines'] != undefined && typeof(res['trustlines']) == 'object' && 
            res['trustlines'].length != undefined && res['trustlines'].length > 0) {
            for (t in res['trustlines']) {
                var tl = res['trustlines'][t];
                var issuer, currency, balance;
                if (tl['specification'] == undefined || tl['state'] == undefined || (issuer = tl['specification']['counterparty']) == undefined || 
                (currency = tl['specification']['currency']) == undefined || (balance = tl['state']['balance']) == undefined ||  tl['specification']['limit'] === "0") continue;
                trustlines += '<li class="adtrustline"><div class="adtlheader"><div class="tlcurrency"><div class="currency">' + currency + '</div> ' + display_currency_amount(parseFloat(""+balance)) + '</div><div class="tlissuer">' + dispaddr(issuer) + '</div><div class="tlvaluation" style="display:none"><div class="currency"></div></div></div><div class="adtlorders"><ul class="adtlorderslist" id="olt-'+currency+'-'+issuer+'"></ul></div><div class="adtlgraph" id="grp-'+currency+'-'+issuer+'"></div><div class="bidask"><span class="bid"></span><span class="ask"></span></div><center><div class="adtlsubheader"><button class="btn btn-warning adtlbutton" ontouchstart="ts(event)" ontouchend="te(event,()=>{showModifyTrustline(\''+account+'\', \''+currency+'\', \''+issuer+'\', '+tl['specification']['limit']+')})"><i class="fa fa-cog" aria-hidden="true"></i></button><button class="btn btn-primary adtlbutton"  ontouchstart="ts(event)" ontouchend="te(event,()=>{showNewOrder(\''+account+'\', \'buy\', \''+currency+'\', \''+issuer+'\', '+balance+', $(\'#grp-'+currency+'-'+issuer+'\').data(\'bid\'), $(\'#grp-'+currency+'-'+issuer+'\').data(\'ask\'))})"><small>BUY</small></button><button class="btn btn-danger adtlbutton" ontouchstart="ts(event)" ontouchend="te(event,()=>{showNewOrder(\''+account+'\', \'sell\', \''+currency+'\', \''+issuer+'\', '+balance+', $(\'#grp-'+currency+'-'+issuer+'\').data(\'bid\'), $(\'#grp-'+currency+'-'+issuer+'\').data(\'ask\'))})"><small>SELL</small></button><button class="btn btn-success adtlbutton" ontouchstart="ts(event)" ontouchend="te(event,()=>{showPaymentTab(\''+account+'\', \''+currency+'\', \''+issuer+'\', '+balance+')})"><i class="fa fa-paper-plane"></i></button></div></center></li>';
            }
        } else {
            trustlines = '<li><center><i>No trustlines on this account.</i></center></li>';
            $('#adtrustlines').html(trustlines);
            return;
        }
        $('#adtrustlines').html(trustlines);
                          
        // get current exchange rate
       getExchangeRate( "", "", (exchangerate, data) => { 
           // get account orders
            getOrders(account, (orders)=>{            
               // render graphs 
                for (t in data.tls) {
                   var tl =  data.tls[t];
                   var issuer, currency, balance;
                   if (tl['specification'] == undefined || tl['state'] == undefined || (issuer = tl['specification']['counterparty']) == undefined || 
                   (currency = tl['specification']['currency']) == undefined || (balance = tl['state']['balance']) == undefined ||  tl['specification']['limit'] === "0") continue;
                    // render orders
                    console.log("orders - " + account + ": ");
                    console.log(orders);
                    var ordersele = $('#olt-' + currency + '-' + issuer);
                    ordersele.empty();
                    for (o in orders) {
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
                        ordersele.append('<li><span class="offer">#'+seq+'</span> <span class="orderentry"><span class="orderdirection">'+direction.toUpperCase()+'</span> <span class="currency existingorder'+order.specification.direction+'">'+currency1+' ' + display_currency_amount(amount1) + '</span> @ <span class="currency">'+currency2+' '+display_currency_amount(rate)+'</span></span> <a class="orderkill" href="" ontouchend="te(event, (e)=>{doPlaceCancelOrder(sodium.randombytes_random(), confirmcancelorder={account:\''+account+'\', seq: '+seq+', currency1: \''+currency1+'\', amount1: '+amount1+', currency2: \''+currency2+'\', amount2: '+amount2+', sell: '+(direction == 'sell')+'} );})"><i class="fa fa-times-circle" style="color:red;"></i></a></li>');
                    }
                    
		            if ((device.platform + "").toLowerCase() == 'browser') clickProxy();	
                   ((currency, issuer, exchangerate, balance) => {
                    remote.getOrderbook(
                        issuer, 
                        {"base": {"currency": currency, "counterparty": issuer}, 
                        "counter": {"currency":"XRP"}},  { limit: 25 }
                    ).then(orders => {
                       renderOrderbookChart(orders, '#grp-'+currency+'-'+issuer, exchangerate, balance);
                    });           
                   })(currency, issuer, exchangerate, parseFloat(""+balance));
                }
            });
        }, {tls:  res['trustlines']});
        
    };
    var e = ()=>{
        $('#adtrustlines').html('<li><center><i>There was an error loading the account. It may not be activated. If you know it is then check your connection or restart Toast Wallet.</i></center></li>');
        return;
    }
    getAccountInfo(account, f, e);
}

function showModifyTrustline(account, currency, issuer, limit) {
    if (debug) console.log("showModifyTrustline - account: " + account + ", currency: " + currency + ", issuer: " + issuer + ", limit: " + limit); 
    $('#mtladdress').val(dispaddr(account));
    $('#mtladdress').data('content', account);
    $('#mtlissueraddr').val(dispaddr(issuer));
    $('#mtlissueraddr').data('content', issuer);    
    $('#mtlcurrency').val(currency);
    $('#mtlcurrency').data('content', currency);        
    $('#mtllimit').val(limit);
    $('#mtllimit').data('content', limit);        
    showTab('#tabmodifytrustline', true);
}

function doConfirmTrustline(passphrase) {
	if (debug) console.log("doConfirmTrustline");
	if (confirmtl.nonce == lasttrustlinenonce) {
		// this is an accidental double tap
		return;
	} 
	blockInput();
	lasttrustlinenonce = confirmtl.nonce;
	validatePassphrase(passphrase, false,
		function() {
			if (confirmtl == undefined || confirmtl.nonce == undefined || sodium.crypto_generichash(16, JSON.stringify(confirmtl), ''+confirmtl.nonce, 'hex') != confirmtlhash ) {
				navigator.notification.alert("An error occured when trying to make your trustline. No trustline was created.", 
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
				navigator.notification.alert("A QR code of this signed trustline creation transaction has been generated. Scan it using your online device to complete the transaction.", 
					function(){
                        return sendTrustLineTxOffline(passphrase, confirmtl.atladdress, confirmtl.atlissueraddr, confirmtl.atlcurrency, confirmtl.atllimit, confirmtl.atlrippling, confirmtl.accseqid, confirmtl.ledseqid, confirmtl.fee);
                    }, 
					"Offline Transaction", 
					"OK"
				);            
                return;
            }
			checkConnection(
				function(){
					sendTrustLineTx(passphrase, confirmtl.atladdress, confirmtl.atlissueraddr, confirmtl.atlcurrency, confirmtl.atllimit, confirmtl.atlrippling, 
						function(wasqueued){
								navigator.notification.alert("Your trustline instruction was successfully " + ( wasqueued ? "queued, and should be executed shortly." : "executed." ), 
									function(){
										clearPaymentScreen();
										showTab("#tabaccounts");
										unblockInput();
									}, "Success", "OK"); 
						}, 
						function(err) {
							navigator.notification.alert("An error occured when trying to set the trustline. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your trustline details are incorrect or the receiving address has not been activated. " + err, 
							function(){
								lasttrustlinenonce = "";
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
					lasttrustlinenonce = "";
					unblockInput();
				},				
				"Error", "OK"
			);
		},
		function() { 
			navigator.notification.alert("Could not create trustline due to possible wallet corruption. We recommend backing up your wallet and reinstalling.", 
				function(){
					lasttrustlinenonce = "";
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
	var mtladdress = $("#mtladdress").val().trim();
	var mtlissueraddr = $("#mtlissueraddr").val().trim();
	var mtlcurrency = (""+$("#mtlcurrency").val()).trim().toUpperCase();
	var mtllimit = $("#mtllimit").val().trim();
    var offlinecode = $('#mtlofflinecode').val().trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
    var pl = false
    try { 
        pl = parseInt(mtllimit)
        if (pl < 0) pl = 0 
   } catch (e) {}
    if (mtllimit == $("#mtllimit").data("content") || (''+mtllimit).trim() != '' + pl ) {
        // disallow continuing if unmodified
		return navigator.notification.alert("You must enter a new trustline limit or 0 if you wish to delete the trustline.", 
			function(){
				$("#mtllimit").focus();
				unblockInput();
			}, 
			"Nothing Changed", 
			"OK"
		);           
    }
    mtllimit = pl + ''
    //if (mtllimit == undefined) mtllimit = "0";
    // the below validations arent strictly necessary because these fields should be read only
    // however there could be circumstances under which they were incorrectly populated so check anyway
    if (!validateAddress(mtladdress)) {
		return navigator.notification.alert("The address you are attempting to add a trustline to is not a valid XRP address.", 
			function(){
				$("#mtladdress").focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);    
    }
    if (!validateAddress(mtlissueraddr)) {
		return navigator.notification.alert("The counterparty / issuer address for the trustline is not a valid XRP address.", 
			function(){
				$("#mtlissueraddr").focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);    
    }
    if (!validateCurrency(mtlcurrency)) {
		return navigator.notification.alert("Invalid currency code. Must be 3 characters A-Z, 0-9 or any of the following ? ! @ # $ % ^ & * < > ( ) { } [ ] |", 
			function(){
				$("#mtlcurrency").focus();
				unblockInput();
			}, 
			"Invalid currency code", 
			"OK"
		);    
    }
    var invalidLimit = ()=>{
		return navigator.notification.alert("Invalid limit. Must be greater than or equal to 0.", 
			function(){
				$("#mtllimit").focus();
				unblockInput();
			}, 
			"Invalid limit", 
			"OK"
		);
    };
    try {
        var x = new BN(mtllimit);
        if (x.isNeg()) return invalidLimit();
    } catch (E) {
        return invalidLimit();
    }
    if (offlinemode) {
        ofl = validateOfflineCode(offlinecode, '#mtlofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
    // if execution reaches this point the validation has completed successfully
    // re-use existing add trustline sequence from here
    var nextscreen = function() {
        
        confirmtl = { 
            atladdress: forceraddr(mtladdress),
            atlissueraddr: forceraddr(mtlissueraddr),
            atlcurrency: mtlcurrency,
            atllimit: mtllimit,
            atlrippling: undefined,
            nonce: nonce,
            accseqid: accID, // used for offline tx
            ledseqid: ledID,
            fee: fee
        };
        confirmtlhash = sodium.crypto_generichash(16, JSON.stringify(confirmtl), ''+nonce, 'hex');
        $('#ctladdress')[0].innerText = mtladdress;
        $('#ctlissueraddr')[0].innerText = mtlissueraddr;
        $('#ctlcurrency')[0].innerText = mtlcurrency;
        $('#ctllimit')[0].innerText = mtllimit;
        $('#ctlrippling')[0].innerText = 'UNCHANGED';
        showTab("#tabtrustlineconfirm");
        
        unblockInput();
    };
	return nextscreen();
}

function doAddTrustline(nonce) {
    
	if (debug) console.log("doAddTrustline");
	blockInput();
	var atladdress = $("#atladdress").val().trim();
	var atlissueraddr = $("#atlissueraddr").val().trim();
	var atlcurrency = (""+$("#atlcurrency").val()).trim().toUpperCase();
	var atllimit = $("#atllimit").val().trim();
	var atlrippling = $("#atlrippling").val().trim().toUpperCase() == "ENABLED";
    var offlinecode = $('#atlofflinecode').val().trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
    var pl = false
    try {
        pl = parseInt(atllimit)
        if (pl < 0) pl = 0
    } catch (e) {}
    if (pl + '' != atllimit)
        return navigator.notification.alert("Invalid limit. Must be greater than or equal to 0.", 
            function(){
                $("#atllimit").focus();
                unblockInput();
            }, 
            "Invalid limit", 
            "OK"
        );
    atllimit = pl + ''
    if (!validateAddress(atladdress)) {
		return navigator.notification.alert("The address you are attempting to add a trustline to is not a valid XRP address.", 
			function(){
				$("#atladdress").focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);    
    }
    if (!validateAddress(atlissueraddr)) {
		return navigator.notification.alert("The counterparty / issuer address for the trustline is not a valid XRP address.", 
			function(){
				$("#atlissueraddr").focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);    
    }
    if (!validateCurrency(atlcurrency)) {
		return navigator.notification.alert("Invalid currency code. Must be 3 characters A-Z, 0-9 or any of the following ? ! @ # $ % ^ & * < > ( ) { } [ ] |", 
			function(){
				$("#atlcurrency").focus();
				unblockInput();
			}, 
			"Invalid currency code", 
			"OK"
		);    
    }
    if (offlinemode) {
        ofl = validateOfflineCode(offlinecode, '#atlofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
    // if execution reaches this point the validation has completed successfully
    var nextscreen = function() {
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
        $('#ctladdress')[0].innerText = atladdress;
        $('#ctlissueraddr')[0].innerText = atlissueraddr;
        $('#ctlcurrency')[0].innerText = atlcurrency;
        $('#ctllimit')[0].innerText = atllimit;
        $('#ctlrippling')[0].innerText = ( atlrippling ? 'ENABLED' : 'DISABLED' );
        showTab("#tabtrustlineconfirm");
        
        unblockInput();
    };
    checkAccountIsFunded(atladdress, 5, 'XRP', '', function(){
            navigator.notification.confirm("You must have " + xrpreserve + " XRP + 5 XRP for each trustline in the account you are sending from. This reserve is a XRP Ledger requirement. In some circumstances this message may appear in error if you believe that to be the case you can opt to attempt the transaction however this will attract a XRP Ledger fee." , 
				function(b){
					if (debug) console.log("button selected: " + b);
					if (b == 1) {
						nextscreen();
					} else {
						$('#atladdress').focus();
						unblockInput();
					}
				}, 
				"XRP Reserve not met", 
				[ "Try anyway", "Cancel" ]
                );},
                function() {
					$('#atladdress').focus();
					unblockInput();                    
                }, nextscreen);
}

function validateCurrency(cur) {
    return /^[A-Z0-9?!@#$%^&*<>(){}[\]|]{3}$/.test(""+cur);
}

function onToggleIssueOwnCurrency(forceoff) {
    if (debug) console.log("onToggleIssueOwnCurrency()");
    
    if (forceoff || $('#tglIssueOwnCurrency').data('checked') != "true") {
        $('#payissuerofl').val('');
        $('#payissuerofl').removeAttr('readonly');
        $('#payassetofl').attr('placeholder', 'Leave blank for XRP');
        $('#oflcurrencydiv').hide();
        $('#issueraddressbtnpaste').show();
        //$('#payasset').show();
        $('#payasset + .select2').show()
    } else {
        //$('#payasset').hide();
        $('#payasset + .select2').hide()
        $('#oflcurrencydiv').show();
        $('#payissuerofl').val('This account');
        $('#payissuerofl').attr('readonly', 'readonly');
        $('#payassetofl').removeAttr('placeholder');
        $('#issueraddressbtnpaste').hide();
        $('#payassetofl').focus();
    }
}

// Expose functions globally
window.refreshTrustlines = refreshTrustlines;
window.showModifyTrustline = showModifyTrustline;
window.doConfirmTrustline = doConfirmTrustline;
window.doModifyTrustline = doModifyTrustline;
window.doAddTrustline = doAddTrustline;
window.validateCurrency = validateCurrency;
window.onToggleIssueOwnCurrency = onToggleIssueOwnCurrency;