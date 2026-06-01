function showPaymentTab(account, currency, issuer, balance) {
    if (debug) console.log("showPaymentTab - account: " + account + ", currency: " + currency + ", issuer: " + issuer + ", balance: " + balance); 
    clearPaymentScreen();
    $('#payfromaccount').find('[data-account="'+account+'"]').attr('selected', 'selected');
    onPaymentSelectFromAccount();
    $('#optpa-'+currency+'-'+issuer).attr('selected', 'selected');
    $('#payamount').val(balance);
    showTab('#tabpayments', true);
    $('#toaddress').focus();
}

function doPay(nonce) {
	if (debug) console.log("doPay");
	blockInput();
	var payfrom = $("#payfromaccount").find(":selected").data('account');
	var payto = $("#toaddress").val().trim();
	var dest = $("#desttag").val().trim();
	var invid = ($("#invoiceid").val().trim() + "").toUpperCase();
	var amount = $("#payamount").val().trim();
    var owncurrencytgl = $('#tglIssueOwnCurrency').data('checked') == 'true';
    var asset = ( $('#payasset').is(':visible') ? ("" + $('#payasset').find(':selected').data('asset')).trim().toUpperCase() :  $('#payassetofl').val().trim().toUpperCase() );
    var issuer = ( $('#payasset').is(':visible') ? $('#payasset').find(':selected').data('issuer') : $('#payissuerofl').val().trim() );
    if (owncurrencytgl) {
        issuer = payfrom;
    }
    if (asset == '') asset = 'XRP';
    var offlinecode = $('#payofflinecode').val().trim().replace(/ /g, "").toUpperCase();
    var accID = '';
    var ledID = '';
    var fee = '';
	if (amount != undefined && (amount+"").charAt(0) == '.') amount = "0" + amount;
	if (/^(.*)[?&][^=]*=(.*)$/m.test(payto)) {
		var oldpayto = payto;
		var newdest = oldpayto.replace(/^(.*)[?&][^=]*=(.*)$/mg, "$2");
		if (dest != "" && dest.trim() != newdest.trim()) {
			navigator.notification.alert("Destination tag specified twice. You specified a destination tag at the end of your send-to address then again in the destination box. Please remove one.", 
				function(){
					$("#desttag").focus();
					unblockInput();
				}, 
				"Destination tag duplicate", 
				"OK"
			);
			return;					
		}
		dest = newdest;
		payto = oldpayto.replace(/^(.*)[?&][^=]*=(.*)$/mg, "$1");
	}
	function parseDestinationTag(value) {
		var cleaned = String(value || '').trim().replace(/^0+(.+)$/g, "$1");
		if(cleaned === '') {
			return null;
		} else {
			return cleaned;
		}
	}
	function validateDestinationTag(value) {
		if(value === null || value === undefined) {
			return {
				valid: true,
				error: null
			}
		}
        var MAX_INT = 4294967295;
		if(!/^[0-9]+$/.test(''+value) || value < 0 || value > MAX_INT) {
			return {
					valid: false,
					error: 'Invalid destination tag be either blank or between 0 and ' + MAX_INT
			}
		}
		return {
			valid: true,
			error: false
		}
	}
	dest = parseDestinationTag(dest);
	var destTagResult = validateDestinationTag(dest);
	if (!destTagResult.valid) {
		navigator.notification.alert(destTagResult.error,
			function(){
				$("#desttag").focus();
				unblockInput();
			},
			"Destination tag invalid",
			"OK"
		);
		return;
	}
    if (offlinemode) {
        ofl = validateOfflineCode(offlinecode, '#payofflinecode');
        if (ofl === false) return;
        accID = ofl.accID;
        ledID = ofl.ledID;
        fee = ofl.fee;
    }
	if (invid != "") {
        if (!/^[A-F0-9]{64}$/m.test(invid)) {
			navigator.notification.alert("Invoice ID must either be blank or be hex-encoded 256bit value. We recommend not to use an invoice id unless your counter party has instructed you to use one.", 
				function(){
					$("#invoiceid").focus();
					unblockInput();
				}, 
				"Invoice ID invalid", 
				"OK"
			);
			return;				
		}
	}
	if (payfrom == undefined || payfrom == "") {
		navigator.notification.alert("You must select an account to pay from", 
			function(){
				$("#payfromaccount").focus();
				unblockInput();
			}, 
			"Select a from account", 
			"OK"
		);
		return;
	}
	if (payto == "") {
		navigator.notification.alert("You must select an address to pay to", 
			function(){
				$("#toaddress").focus();
				unblockInput();
			}, 
			"Select a to address", 
			"OK"
		);
		return;
	}
	if (!validateAddress(payto)) {
		navigator.notification.alert("The destination address you have entered does not appear to be a valid XRP address. You can still attempt to send but the XRP Ledger will charge a fee on failure.", 
			function(){
				$("#toaddress").focus();
				unblockInput();
			}, 
			"Unusual address format", 
			"OK"
		);
	}
	if (payto == payfrom) {
		navigator.notification.alert("A XRP address cannot pay XRP from itself to itself.", 
			function(){
				$("#toaddress").focus();
				unblockInput();
			}, 
			"Cannot pay to this address", 
			"OK"
		);
		return;	
	}
    if (asset == 'XRP' && ( issuer != '' || owncurrencytgl)) {
		navigator.notification.alert("You cannot specify an issuer for XRP.", 
			function(){
                if ($('#oflcurrencydiv').is(':visible')) {
                    $("#payassetofl").focus();
                } else {
    				$("#payasset").focus();
                }
				unblockInput();
			}, 
			"Select a payment amount", 
			"OK"
		);
		return;
    }
    if ( asset == 'XRP' ) issuer = '';
	if (amount == "" || parseFloat(amount)+ "" != (""+amount).trim()) {
		navigator.notification.alert("You must select a valid amount to send", 
			function(){
				$("#payamount").focus();
				unblockInput();
			}, 
			"Select a payment amount", 
			"OK"
		);
		return;
	}
	var nextscreen = function() {
        var paytoreal = forceraddrtag(payto, dest)
		confirmpay = { 
			payfrom: forceraddr(payfrom),
			payto: paytoreal.raddr,
			dest: paytoreal.tag,
			invid: invid,
			amount: amount,
			nonce: nonce,
            accseqid: accID, // used for offline tx
            ledseqid: ledID,
            fee: fee,
            asset: asset,
            issuer: issuer
		};
		confirmpayhash = sodium.crypto_generichash(16, JSON.stringify(confirmpay), ''+nonce, 'hex');
		$('#confirmpayfromaccount')[0].innerText = dispaddr(payfrom)
		$('#confirmpaytoaddress')[0].innerText = payto;
	    if (isXAddress(payto)) {
            $('#confirmdesttag')[0].parentNode.style.display = 'none'
        } else {
            $('#confirmdesttag')[0].parentNode.style.display = 'inherit'
    	}
        $('#confirmdesttag')[0].innerText =  paytoreal.tag || '(not provided)';
		$('#confirminvoiceid')[0].innerText = ( invid == "" ? "(not provided)" : invid );
		$('#confirmpayamount')[0].innerText = amount;
        $('#confirmasset')[0].innerText = asset;
        $('#confirmissuer')[0].innerText = dispaddr(issuer);
        if (asset == 'XRP') {
            $('#confirmissuerpaygroup').hide();
        } else {
            $('#confirmissuerpaygroup').show();
            if (owncurrencytgl) {
                $('#confirmissuer')[0].innerText = 'This Account';
            } else {
                $('#confirmissuer')[0].innerText = dispaddr(issuer);
            }
        }
		showTab("#tabpaymentconfirm", true);
		
		unblockInput();
	};
    checkAccountIsFunded(payfrom, amount, asset, issuer, function(){
			navigator.notification.confirm("You must leave " + xrpreserve + " XRP reserve in the account you are sending from. This is a XRP Ledger requirement. In some circumstances this message may appear in error if you believe that to be the case you can opt to attempt the transaction however this will attract a XRP Ledger fee." , 
				function(b){
					if (debug) console.log("button selected: " + b);
					if (b == 1) {
						nextscreen();
					} else {
						$('#payamount').focus();
						unblockInput();
					}
				}, 
				"XRP Reserve not met", 
				[ "Try anyway", "Cancel" ]
                );}, 
                function() { 
                    $('#payamount').focus();
                    unblockInput();
                }, nextscreen);
}

function doConfirmPay(passphrase) {
	if (debug) console.log("doConfirmPay");
	if (confirmpay.nonce == lastpaidnonce) {
		// this is an accidental double tap
		return;
	} 
	blockInput();
	lastpaidnonce = confirmpay.nonce;
	validatePassphrase(passphrase, false,
		function() {
			if (confirmpay == undefined || confirmpay.nonce == undefined || sodium.crypto_generichash(16, JSON.stringify(confirmpay), ''+confirmpay.nonce, 'hex') != confirmpayhash ) {
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
            if (offlinemode) {
                // we're just going to create the payment as a QR code and display it
				navigator.notification.alert("A QR code of this signed transaction has been generated. Scan it using your online device to complete the transaction.", 
					function(){
                        return sendPaymentOffline(passphrase, confirmpay.payfrom, parseFloat(confirmpay.amount), confirmpay.payto, 0, confirmpay.dest, confirmpay.invid, confirmpay.asset, confirmpay.issuer, confirmpay.accseqid, confirmpay.ledseqid, confirmpay.fee);					
                    }, 
					"Offline Transaction", 
					"OK"
				);            
                return;
            }
			checkConnection(
				function(){
					sendPayment(passphrase, confirmpay.payfrom, parseFloat(confirmpay.amount), confirmpay.payto, 0, confirmpay.dest, confirmpay.invid, confirmpay.asset, confirmpay.issuer, 
						function(wasqueued){
							if (confirmpay.payto == 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y') {
								getLastDonation(function(donation) {
									donation['lastdonation'] = "" + Math.floor(new Date().getTime()/1000);
									donation['lastreminder'] = "" + Math.floor(new Date().getTime()/1000);
									db.upsert("lastdonated",
										function(doc) {
										return { data: JSON.stringify(donation)	}; 
									}).then( function() {
										navigator.notification.alert("Thank you for your donation! Your contribution helps us keep Toast Wallet running!", 
											function(){
												clearPaymentScreen();
												showTab("#tabaccounts");
												unblockInput();
											}, 
											"Success", 
											"OK"
										); 
									});
								});
							} else {
								navigator.notification.alert("Your payment was successfully " + ( wasqueued ? "queued, and will be sent shortly." : "sent." ), 
									function(){
										clearPaymentScreen();
										showTab("#tabaccounts");
										unblockInput();
									}, "Success", "OK"); 
								}
						}, 
						function(err) {
							navigator.notification.alert("An error occured when trying to make your payment. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your payment details are incorrect or the sending or receiving reserve is not met. " + err, 
							function(){
								lastpaidnonce = "";
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
					lastpaidnonce = "";
					unblockInput();
				},				
				"Error", "OK"
			);
		},
		function() { 
			navigator.notification.alert("Could not make payment due to possible wallet corruption. We recommend backing up your wallet and reinstalling.", 
				function(){
					lastpaidnonce = "";
					unblockInput();
				}, 
				"Error", 
				"OK"
			);
		}
	);
}

function clearPaymentScreen() {
	try {
        $('#desttag').attr('readonly', false)
        $('#currencyerror').hide();
        $('#currencyerror').empty();
        if ($('#payfromaccount').find(':selected').data('account') != activeaccount) {
            $('#payfromaccount').find(':selected').removeAttr('selected');
            $('#opt' + activeaccount).attr('selected', 'selected');
        }
        onPaymentSelectFromAccount();
		$("#toaddress").val("");
		$("#desttag").val("");
		$("#invoiceid").val("");
		$("#payamount").val("");
        $("#payamount").removeAttr('placeholder');
        var tgl = $($('#tglIssueOwnCurrency').children()[0]);
        tgl.removeClass('fa-toggle-on');
        tgl.removeClass('fa-toggle-off');
        tgl.addClass('fa-toggle-off');
        $('#tglIssueOwnCurrency').data('checked', 'false');
        onToggleIssueOwnCurrency(true);
        $('#payassetofl').val('');
        $('#payissuerofl').val('');
        $('#invoiceiddiv').css( 'display', 'none' );
//        $('#btnpayshowmore').html('More');
        if (offlinemode) {
            $('#oflcurrencydiv').show();
            $('#payasset').hide();
        } else {
            $('#oflcurrencydiv').hide();
            $('#payasset').show();
        }
	} catch(e) {handle_error(e);}
}

function onPaymentSelectFromAccount() {
    //clean up stray dropdown
    if (offlinemode) 
        try {
            $("#payasset").select2('destroy')
        } catch (e) {}
    if ($("#payfromaccount").find(":selected") == undefined) {
        if (activeaccount == undefined) return;
        $('#opt' + activeaccount).attr('selected', 'selected');
    } 
    var account = $("#payfromaccount").find(":selected").data('account');
    if (account == undefined) return;
    
    if (offlinemode) {
        $('#payofflinecodediv').css('display', 'block');
        $("#paytabredqr").empty();
        $("#paytabredqr").append(kjua({text: account, fill:"#ff0000"}));    
        $("#payasset").hide();
        try {
            $("#payasset").select2('destroy')
        } catch (e) {}
        $('#oflcurrencydiv').show();
        
    } else {
        $('#payasset').show();
        $('#payofflinecodediv').css('display', 'none');
        $("#paytabredqr").empty();
        var xrpoption = '<option data-issuer="" data-asset="XRP" id="optpa-xrp">XRP</option>';
        if (trustlinesdropdown[account] != undefined) {
            var tloptions = "";
            for (var x in trustlinesdropdown[account]) 
                tloptions += trustlinesdropdown[account][x];
            $('#payasset').html(xrpoption + tloptions);
        } else {
            $('#payasset').html(xrpoption);
        }
        try {
            $('#payasset').select2()
        } catch(e) {}
        select2EventProxy()
    }
}

function checkPayToAddressForCommonErrors() {
    var payto = ($('#toaddress').val() + '').trim()
    if (payto.substr(0,1) == 'r' && forceraddr(payto)) {
        if (payto == 'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv') {
            $('#lblpaytodesttag').html('Destination Tag (<i color="red">Required!</i>)');
        } else if (payto == 'rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh') {
            $('#lblpaytodesttag').html('Destination Tag (<i color="red">Required!</i>)');
        } else if (offlinemode) {
            $('#lblpaytodesttag').html('Destination Tag')
        } else {
            remote.getSettings(payto).then(e=>{
                $('#lblpaytodesttag').html('Destination Tag (<i color="red">Required!</i>)')
            }).catch(e=>{
                $('#lblpaytodesttag').html('Destination Tag')
            })
        }
    }
   
     $('#currencyerror').hide(); 
   
    // disable or enable desttag depending on if its an xaddress
    if (payto.substr(0,1) == 'X') { 
        $('#desttag').attr('readonly', true) 
        $('#desttag').val('')
    } else {
        $('#desttag').attr('readonly', false) 
    }
}

function populatePaymentTabFromURI(uri, targetfield) {
	// apply the draft standard
	var parsed = xls2d(uri)
    var xto = false
    try { xto = raddr(parsed.to) } catch (e) {}
    if (!parsed || !parsed.to || (
        !xrpl.isValidClassicAddress(parsed.to) &&
        !xto)) {
        // could not parse, that's fine we'll just populate it anyway
        if (targetfield) $(targetfield).val(uri)
        checkPayToAddressForCommonErrors()
        return
    }
    if (parsed.to) $('#toaddress').val(parsed.to)
    if (!xto && parsed.dt) $('#desttag').val(parsed.dt)
    if (parsed.amount) $('#payamount').val(parsed.amount)
    checkPayToAddressForCommonErrors()
    /*try {
        $('#payfromaccount').find('[data-account="'+account+'"]').attr('selected', 'selected');
    } catch (e) {}
    onPaymentSelectFromAccount();
    */
    $('#currencyerror').hide()
    if (parsed.currency.currency && parsed.currency.issuer) {
        if (offlinemode) {
            $('#payassetofl').val(parsed.currency.currency);
            $('#payissuerofl').val(parsed.currency.issuer);
        } else {
            if ($('#optpa-'+parsed.currency.currency+'-'+ parsed.currency.issuer).length > 0) {
                $('#optpa-'+parsed.currency.currency+'-'+ parsed.currency.issuer).attr('selected', 'selected');
            } else {
                $('#currencyerror').text('Pay URI specified ' + (''+parsed.currency.currency).replace(/[^a-z]/gi, '')  + ' issued by ' + (''+parsed.currency.issuer).replace(/[^a-z0-9]/gi, '') + " but you don't have a trustline for that on this account"); //todo: add a button here to make adding a trustline easy
                $('#currencyerror').show();
            }
        }
    } 
    if (parsed.invoiceid) {
        $('#invoiceiddiv').show();
        $('#invoiceid').val(parsed.invoiceid);
    }
}

function doPayLink() {
    console.log("doPayLink " + paylink_pending)
    
    var paylink = paylink_pending
    paylink_pending = null
    if (!paylink) return
    
    showTab("#tabpayments")
    populatePaymentTabFromURI(paylink)
    $('#tablogin>center>div').removeClass('pinpad_pending')
    if (activeaccount == "") 
        refreshAccounts()
}

function doSubmitOfflineTransaction(stage, content) {
    if (stage == undefined) stage = 0;
    if (offlinemode) {
        return navigator.notification.alert("You must use an Internet connected device to submit an offline transaction. To generate an offline transaction use the payments tab (center bottom).", 
            function() {
                showTab(-1);
                unblockInput();
            },
            "Not Connected", "OK"
        );
    }
    if (stage == 0) {
        
        $('#submitofflinetxstep1').css('display', 'block');
        $('#submitofflinetxstep2').css('display', 'none' );
        $('#submitofflinetxstep3').css('display', 'none' );
        showTab('#tabsubmitofflinetx');
    } else if (stage == 1) {
        blockInput();
        var account = content;
        // query the ledger sequence ID and account sequence ID
        if (account == undefined) account = $('#txtredqr').val();
        console.log("RED QR: " + account);
        account = forceraddr(account)
        if (!account || !validateAddress(account)) {
			return navigator.notification.alert("The QR code you scanned was not a valid XRP address", 
				function() {
                    doSubmitOfflineTransaction(0);
                    unblockInput();
                },
				"Failure", "OK"
			);
        }
        var failurefunc = function(fail) {
	        return navigator.notification.alert("An error occured when trying to query the XRP Ledger. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your device has no connectivity. " + fail,
				function() {
                    doSubmitOfflineTransaction(0);
                    unblockInput();
                },
				"Failure", "OK"
			);
        }
        var failurefuncAccNotFound = function(fail) {
	        return navigator.notification.alert("The account you are trying to submit a transaction on behalf of does not exist (has not been activated) on the network. " + fail,
				function() {
                    doSubmitOfflineTransaction(0);
                    unblockInput();
                },
				"Failure", "OK"
			);
        }
        var onApiFailure = function(fail, failurefunc, ptries) {
					console.log('API query failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								queryNetwork(ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
		};
        var queryNetwork = function(ptries) {
            checkConnection(() => {
                remote.getFee().then(fee => {
                    if (fee == undefined) {
                        fee = 12;
                    } else {
                        fee *= 1000000;
                    }
                    if (fee > 1000000) fee = 1000000; // we'd rather the tx fail than go through for more than 1 xrp
                    remote.getAccountInfo(account).then(info => {
                       var accseqid = info.sequence;
                        remote.getLedger({}).then(info2 => {
                            var ledseqid = info2.ledgerVersion - toastepoc; // toast wallet epoc
                            // encode these into a portable format
                            console.log("Ledger Seq ID: " + ledseqid);
                            console.log("Account Seq ID: " + accseqid);                        
                            console.log("Fee: " + fee);                        
                            var bytes = [];
                            // 4 byte int for the accseqid
                            bytes[0] = (accseqid & 0xff000000) >> 24;
                            bytes[1] = (accseqid & 0xff0000) >> 16;
                            bytes[2] = (accseqid & 0xff00) >> 8;
                            bytes[3] = (accseqid & 0xff) >> 0;                        
                            // 4 byte int for the ledseqid
                            bytes[4] = (ledseqid & 0xff000000) >> 24;
                            bytes[5] = (ledseqid & 0xff0000) >> 16;
                            bytes[6] = (ledseqid & 0xff00) >> 8;
                            bytes[7] = (ledseqid & 0xff) >> 0;                        
                   
                            // 4 byte int for the fee
                            bytes[8]  = (fee & 0xff000000) >> 24;
                            bytes[9]  = (fee & 0xff0000) >> 16;
                            bytes[10] = (fee & 0xff00) >> 8;
                            bytes[11] = (fee & 0xff) >> 0;                        
                            // 1 byte checksum
                            var hex = utils.bytesToHex(bytes);
                            var checksum = sodium.crypto_generichash(1, hex, 'offlinecode', 'hex');
                           
                            var fullhex = hex;
                            var removedZerosLedId = 0;
                            var removedZerosAccId = 0;
                            var removedZerosFee = 0;
                            // remove leading 0's from the ledgerid
                            while(hex.charAt(8) == '0') {
                                hex = hex.slice(0,8) + hex.slice(9);
                                removedZerosLedId++;
                            }
                            // remove leading 0's from the fee
                            while(hex.charAt(hex.length - 8 + removedZerosFee) == '0') {
                                hex =  hex.slice(0, hex.length - 8 + removedZerosFee) + hex.slice( hex.length - 7 + removedZerosFee);
                                removedZerosFee++;
                            }
                        
                            // remove leading 0's from acc seq id
                            while(hex.charAt(0) == '0') {
                                hex = hex.slice(1);
                                removedZerosAccId++;
                            }
                            // encode the zero removal
                            var compressionByte = 0;
                            compressionByte += removedZerosLedId; 
                            compressionByte += removedZerosAccId * 8;
                    
                            // add checksum to the beginning
                            hex = checksum + utils.bytesToHex([compressionByte]) +hex;
                            // due to the checksum we should be able to reconstruct this
                            hex = hex.toUpperCase();
                            console.log("Full offline code: " + checksum + utils.bytesToHex([compressionByte]) + fullhex);
                            // add spaces for ease of copying
                            var displayhex = "";
                            for (var i = 0; i < hex.length; i+= 4) 
                                displayhex += hex.slice(i, i + 4) + " ";
                            displayhex = displayhex.trim();
                            $('#lblofflinetxconfirm').text(displayhex);
                            unblockInput();
                            $('#submitofflinetxstep1').css('display', 'block');
                            $('#submitofflinetxstep2').css('display', 'block' );
                            $('#submitofflinetxstep3').css('display', 'block' );
                            showTab('#tabsubmitofflinetx');
                            
                        }).catch(e => {
                            return onApiFailure(e, failurefunc, ptries); 
                        });
                    }).catch(e => {
                        return onApiFailure(e, failurefuncAccNotFound, ptries); 
                    });
                }).catch(e => {
                    return onApiFailure(e, failurefunc, ptries); 
                });
            });
        };
        queryNetwork(0);
    } else if (stage == 2) {
        // ready to submit the transaction!
        blockInput();
        var signedTx = content;
        if (signedTx == undefined) signedTx =$('#txtgreenqr').val();
        if (signedTx.slice(0, 'ripple:signed-transaction:'.length) != 'ripple:signed-transaction:') {
            return  navigator.notification.alert("The QR code you scanned is not a valid transaction QR. Ensure you are scanning the GREEN QR code you received after finalizing your transaction on the offline device.", 
                        function(){
                            unblockInput();
                        }, "Invalid QR Code", "OK"
            ); 
        }
        
        // remove prefix from the tx
        signedTx =  signedTx.slice('ripple:signed-transaction:'.length);
        checkConnection(function(){
        submitSignedTransaction(
            signedTx,       
            function(wasqueued){
                    navigator.notification.alert("Your transaction was successfully " + ( wasqueued ? "queued." : "submitted." ), 
                        function(){
                            showTab(-1);
                            unblockInput();
                        }, "Success", "OK"); 
                    }
            , 
            function(err) {
                navigator.notification.alert("An error occured when trying to make your payment. This can occur if the gateways Toast Wallet connects to are overloaded, it can also occur if your payment details are incorrect or the receiving address has not been activated. " + err, 
                function(){
                    showTab(-1);
                    unblockInput();
                }, 
                "Error", "OK");
            },
            0
        );
        });        
    }
}

function xls2d(uri) {
    if (!uri || typeof(uri) != 'string') return false
    const cleaned_uri = uri.replace(/^(.*:.*)?\?/mg, "").replace(/\?/img, "&").replace(/^.*?:\/\//, '').replace(/^ripple:/img, "")
    
    function clean() {
        return cleaned_uri
    }   
    
    function to() {
        //NB: this regex is case sensitive to assist in correctly matching XRP ledger addresses
        var match =  /(?:(?:^|&)(?:to|TO|tO|To)=|^)([rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz]{25,55})/mg.exec(cleaned_uri)
        return (match == null ? false : match[1])
    }   
    
    function dt() {
        var match = /(?:^|&)dt=([0-9]+)|:([0-9]+)$/img.exec(cleaned_uri)
        if (match != null) return (match[1] ? match[1] : match[2])
        return false 
    }   
    
    function amount() {
        var match = /(?:^|&)am(?:oun)?t=([0-9\.]+)/img.exec(cleaned_uri)
        return (match == null ? false : match[1])
    }   
    
    function currency() {
        var match = /(?:^|&)cur(?:rency)?=(?:([rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz]{25,55}):)?([A-Z]{3}|[A-Fa-f]{40})/img.exec(cleaned_uri)
        return (match == null ? false : { issuer: ( match[1] ? match[1] : false ), currency: match[2] } )
    }   
    
    function invoiceid() {
        var match = /(?:^|&)inv(?:oice)?(?:id)?=([a-f]{64})/img.exec(cleaned_uri)
        return (match == null ? false : match[1])
    }   
    
    return {
        uri: uri,
        clean: clean(),
        to: to(),
        dt: dt(),
        amount: amount(),
        currency: currency(),
        invoiceid: invoiceid()
    }   
}

function decodeSecretAddressURI(uri, after, secretfield, addrfield, defaultfield) {
	uri = uri.replace(/^([a-z\/:.]+\/)?(.+)$/mg, "$2");
    var emplace = (val) => {
        var first = val.charAt(0) ;
        if (first == 's' && secretfield != undefined) {
            $(secretfield).val(val);
        } else if ((first == 'X' || first == 'r' || first == 'n') && addrfield != undefined) {
            $(addrfield).val(val);
        } else {
            $(defaultfield).val(val)
        }
    } 
	if (/^[^?&=]+$/m.test(uri) && defaultfield != undefined) {
		// if this is a simple regex with no uri stuff then we'll just import it directly into the
		// field next to the QR button
		//$(defaultfield).val(uri);
        emplace(uri)
	} else {
		var addressRegex = /(?:[?&]?([a-z]+)=|^)([^&?\r\n]*)/mg;
		var match = addressRegex.exec(uri);
		var matchcount = 0;
		while (match != null) {
			matchcount++;
			var key = ( match[1] == undefined ? "" : (match[1]+"").toLowerCase() );
			var val = ( match[2] == undefined ? "" : match[2] );
			emplace(val)
            match = addressRegex.exec(uri);
		}
	}
	return ( after ? after() : true )
}

function checkAccountIsFunded(payfrom, amount, asset, issuer, failurefunc, silentfailurefunc, successfunc) {
    if (offlinemode) return successfunc(); // skip this warning if we already know we can't check the balance
    payfrom = forceraddr(payfrom)
    issuer = forceraddr(issuer)
    if ( payfrom == issuer ) return successfunc();
    //todo: check if receiver has trustline setup to receive your currency
    
    if (asset == 'XRP' && payfrom in accountbalances) {
		var balance = accountbalances[payfrom] - amount;
		if (balance < xrpreserve) {
			return failurefunc();
		} else {
			return successfunc();
		}
    }
    if ( asset != 'XRP' &&  accountbalancestl[payfrom] != undefined && accountbalancestl[payfrom][asset] != undefined && accountbalancestl[payfrom][asset][issuer] != undefined ) {
        var balance = accountbalancestl[payfrom][asset][issuer] - amount;
        if (balance >= 0) {
            return successfunc();
        } else {
            return failurefunc();
        }
    }
    return navigator.notification.confirm("Toast Wallet was unable to check your account balance at this time. Please confirm that you have left " + xrpreserve + " XRP reserve in your account after the " + amount + " XRP transaction before continuing.",
			function(b){
				if (b == 1) {
					return successfunc();
				} else {
				    return silentfailurefunc();
				}
			}, 
			"XRP balance not confirmed", 
			[ "Yes continue", "Cancel" ]
	);			
}

function validateOfflineCode(offlinecode, offlinecodefield) {
        var codevalid = /^[A-F0-9]+$/m.test(offlinecode);        
        if (codevalid) {
            // grab the checksum from the front
            var checksum = offlinecode.slice(0,2);
            var compression = utils.hexToBytes(offlinecode.slice(2,4));
            offlinecode = offlinecode.slice(4);
            var removedZerosLedId = compression & 7;
            var removedZerosAccId = compression >> 3;
            var removedZerosFee = 24 - (offlinecode.length + removedZerosLedId + removedZerosAccId);
            console.log("removedZerosLedId: " + removedZerosLedId);
            console.log("removedZerosAccId: " + removedZerosAccId);
            console.log("removedZerosFee: " + removedZerosFee);            
            // from the checksum we need to figure out where to re-add our zeros
            // we know there are 24 digits to make up and we know the checksum
            // there will be up to six 0's added in three places
            var isValid = function(offlinecode, checksum) {
                return checksum.toUpperCase() == sodium.crypto_generichash(1, offlinecode, 'offlinecode', 'hex').toUpperCase();
            }
            accID = '0'.repeat(removedZerosAccId) + offlinecode.slice(0, 8 - removedZerosAccId);
            offlinecode = offlinecode.slice(8 - removedZerosAccId);
            ledID = '0'.repeat(removedZerosLedId) + offlinecode.slice(0, 8 - removedZerosLedId);
            offlinecode = offlinecode.slice(8 - removedZerosLedId);
            while(offlinecode.length < 8) offlinecode = '0' + offlinecode;
            fee = offlinecode;
            offlinecode = accID + ledID + fee;
            codevalid = isValid(offlinecode, checksum);
            console.log("offline code: " + offlinecode);
        }
        if (!codevalid) {
            navigator.notification.alert("Your offline code appears to be incorrect. Check you scanned the red QR code on the online version of Toast Wallet first.", 
                function(){
                    $(offlinecodefield).focus();
                    unblockInput();
                }, 
                "Offline code invalid", 
                "OK"
            );
            return false;
        } 
        accID = parseInt('0x' + accID);
        ledID = parseInt('0x' + ledID);
        fee = (parseInt('0x' + fee)/1000000.0) + "";
        console.log("Reconstructed LedID: " + accID);
        console.log("Reconstructed AccID: " + ledID);                        
        console.log("Reconstructed Fee: " + fee);   
        return { accID: accID, ledID: ledID, fee: fee };
       
}

// Expose functions globally
window.showPaymentTab = showPaymentTab;
window.doPay = doPay;
window.doConfirmPay = doConfirmPay;
window.clearPaymentScreen = clearPaymentScreen;
window.onPaymentSelectFromAccount = onPaymentSelectFromAccount;
window.checkPayToAddressForCommonErrors = checkPayToAddressForCommonErrors;
window.populatePaymentTabFromURI = populatePaymentTabFromURI;
window.doPayLink = doPayLink;
window.doSubmitOfflineTransaction = doSubmitOfflineTransaction;
window.xls2d = xls2d;
window.decodeSecretAddressURI = decodeSecretAddressURI;
window.checkAccountIsFunded = checkAccountIsFunded;
window.validateOfflineCode = validateOfflineCode;