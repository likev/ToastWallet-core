function sendPayment(passphrase, fromacc, xrpAmount, destination, sourceTag, destTag, invoiceID, asset, issuer, successfunc, failurefunc) {
	
	if (debug) console.log("sendPayment - " + xrpAmount);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
			var instructions = {maxLedgerVersionOffset: 30};
			var payment = {
			  source: {
			    address: fromacc,
			    maxAmount: {
			      value: xrpAmount + "",
			      currency: asset,
			    }
			  },
			  destination: {
			    address: destination,
			    amount: {
			      value: xrpAmount + "",
			      currency: asset,
			    },
			  }
			};
			if(sourceTag) {
				payment.source.tag = parseInt(sourceTag + "");
			}
			if(destTag) {
				payment.destination.tag = parseInt(destTag + "");
			}
			if (invoiceID !== undefined && invoiceID != "") {
				payment.invoiceID = invoiceID;
			}
            if (asset != 'XRP' && issuer != '' && issuer != undefined) {
                payment.source.maxAmount['counterparty'] = issuer;
                payment.destination.amount['counterparty'] = issuer;
            }
            console.log(payment);
			var preparepayment = function(fromacc, payment, instructions, ptries) {
				return remote.preparePayment(fromacc, payment, instructions).then(prepared => {
				    console.log('Payment transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                    secret = "";
				    console.log('Payment transaction signed...');
				    
				    submitSignedTransaction(signedTransaction, successfunc, failurefunc, ptries);
				    
				}, (fail) => 	 {
					console.log('Prepare payment failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								preparepayment(fromacc, payment, instructions, ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
				});
			}
			return preparepayment(fromacc, payment, instructions, 0);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});
}

function sendPaymentOffline(passphrase, fromacc, xrpAmount, destination, sourceTag, destTag, invoiceID, asset, issuer, accSeqID, ledSeqID, fee) {
	
	if (debug) console.log("sendPaymentOffline - " + xrpAmount);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
			var payment = {
			  source: {
			    address: fromacc,
			    maxAmount: {
			      value: xrpAmount + "",
			      currency: asset,
			    },
		      	    tag: parseInt(sourceTag + "")
			  },
			  destination: {
			    address: destination,
			    amount: {
			      value: xrpAmount + "",
			      currency: asset,
			    }
			  }
			};
            if (destTag) 
                payment.destination['tag'] = parseInt(destTag + "")
            
            if (asset != 'XRP' && issuer != '' && issuer != undefined) {
                payment.source.maxAmount['counterparty'] = issuer;
                payment.destination.amount['counterparty'] = issuer;
                payment['allowPartialPayment'] = true;
            }
			if (invoiceID !== undefined && invoiceID != "") {
				payment.invoiceID = invoiceID;
			}
            remote.preparePayment(fromacc, payment, instructions).then(prepared => {
 				    console.log('Payment transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
				    
                    secret = "";
				    
                    console.log('Payment transaction signed...');
                    $('#divgreenqrdisplay').empty();
                    $('#divgreenqrdisplay').append(kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function sendTrustLineTx(passphrase, fromacc, issuer, currency, limit, rippling, successfunc, failurefunc) {
	
	if (debug) console.log("sendTrustLineTx - " + issuer + " currency " + currency + " limit " + limit + " rippling " + rippling + " foraddr " + fromacc);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
			var instructions = {maxLedgerVersionOffset: 30};
			var trustline = {
                "currency" : currency,
                "counterparty" : issuer,
                "limit" : limit
			};
            if (rippling != undefined) {
                trustline["ripplingDisabled"] = !rippling;
            }
			var preparetrustline = function(fromacc, trustline, instructions, ptries) {
				return remote.prepareTrustline(fromacc, trustline, instructions).then(prepared => {
				    console.log('Trustline transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                    
                    secret = "";
				    
                    console.log('Trustline transaction signed...');
				    
				    submitSignedTransaction(signedTransaction, successfunc, failurefunc, ptries);
				    
				}, (fail) => 	 {
					console.log('Prepare trustline failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								preparepayment(fromacc, trustline, instructions, ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
				});
			}
			return preparetrustline(fromacc, trustline, instructions, 0);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});    
}

function sendTrustLineTxOffline(passphrase, fromacc, issuer, currency, limit, rippling, accSeqID, ledSeqID, fee) {
	if (debug) console.log("sendTrustLineTx - " + issuer + " currency " + currency + " limit " + limit + " rippling " + rippling + " foraddr " + fromacc + " accSeqID " +  accSeqID + " ledSeqID " + ledSeqID + " fee " + fee);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
			var trustline = {
                "currency" : currency,
                "counterparty" : issuer,
                "limit" : limit,
			};
            if (rippling != undefined) {
                trustline["ripplingDisabled"] = !rippling;
            }
            remote.prepareTrustline(fromacc, trustline, instructions).then(prepared => {
                console.log('Trustline transaction prepared...');
                const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                console.log('Trustline transaction signed...');
                secret = "";
                    $('#divgreenqrdisplay').empty();
                    $('#divgreenqrdisplay').append(kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
         
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function sendOfferCreate(passphrase, fromacc, amount, asset, issuer, price, sell, fok, ioc, passive, expiry, successfunc, failurefunc) {
	
	if (debug) console.log("sendOfferCreate - " + fromacc + " asset: " + asset + " issuer: " + issuer + " price: " + price + " sell: " + sell + " fok: " + fok + " ioc: " + ioc + " passive: " + passive);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
			var instructions = {maxLedgerVersionOffset: 30};
			var order = {
			  direction: (sell ? 'sell' : 'buy'),
              quantity: {
                    currency: asset,
                    counterparty: issuer,
                    value: "" + amount
              },
              totalPrice: {
                    currency: 'XRP',
                    value:  roundXRP( price * amount )  + ''
              }
			};
            if (typeof(expiry) === 'string') order['expirationTime'] = expiry;
            if (passive) order['passive'] = true;
            if (fok) order['fillOrKill'] = true;
            if (ioc && !fok) order['immediateOrCancel'] = true;
            
            console.log(order);
			var prepareorder = function(fromacc, order, instructions, ptries) {
				return remote.prepareOrder(fromacc, order, instructions).then(prepared => {
				    console.log('OfferCreate transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                    secret = "";
				    console.log('OfferCreate transaction signed...');
				    
				    submitSignedTransaction(signedTransaction, successfunc, failurefunc, ptries);
				    
				}, (fail) => 	 {
					console.log('Prepare order failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								prepareorder(fromacc, order, instructions, ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
				});
			}
			return prepareorder(fromacc, order, instructions, 0);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});
}

function sendOfferCreateOffline(passphrase, fromacc, amount, asset, issuer, price, sell, fok, ioc, passive, expiry, accSeqID, ledSeqID, fee) {
	
	if (debug) console.log("sendOfferCreateOffline - " + fromacc + " asset: " + asset + " issuer: " + issuer + " price: " + price + " sell: " + sell + " fok: " + fok + " ioc: " + ioc + " passive: " + passive + ", accSeqId: " + accSeqId + ", ledSeqID: " + ledSeqID + ", fee: " + fee);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
			var order = {
			  direction: (sell ? 'sell' : 'buy'),
              quantity: {
                    currency: asset,
                    counterparty: issuer,
                    value: "" + amount 
              },
              totalPrice: {
                    currency: 'XRP',
                    value:  roundXRP( price * amount ) + '' 
              }
			};
            if (typeof(expiry) === 'string') order['expirationTime'] = expiry;
            if (passive) order['passive'] = true;
            if (fok) order['fillOrKill'] = true;
            if (ioc && !fok) order['immediateOrCancel'] = true;
            
            console.log(order)
            remote.prepareOrder(fromacc, order, instructions).then(prepared => {
 				    console.log('Order transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
				    
                    secret = "";
				    
                    console.log('Order transaction signed...');
                    $('#divgreenqrdisplay').empty();
                    $('#divgreenqrdisplay').append(kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function sendOfferCancel(passphrase, fromacc, seq, successfunc, failurefunc) {
	
	if (debug) console.log("sendOfferCancel - " + fromacc + " seq: " + seq);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
			var instructions = {maxLedgerVersionOffset: 30};
			var cancel = {
                orderSequence: seq
            };
            console.log(cancel);
			var preparecancelorder = function(fromacc, cancel, instructions, ptries) {
				return remote.prepareOrderCancellation(fromacc, cancel, instructions).then(prepared => {
				    console.log('OfferCancel transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                    secret = "";
				    console.log('OfferCancel transaction signed...');
				    
				    submitSignedTransaction(signedTransaction, successfunc, failurefunc, ptries);
				    
				}, (fail) => 	 {
					console.log('Prepare cancelorder failed: ' + fail);
					if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
						return serverCycle(
							function() {
								preparecancelorder(fromacc, cancel, instructions, ptries + 1);
							}, ptries + 1, failurefunc);
					}
					unblockInput();
					failurefunc("" + fail);
				});
			}
			return preparecancelorder(fromacc, cancel, instructions, 0);
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});
}

function sendOfferCancelOffline(passphrase, fromacc, seq, accSeqID, ledSeqID, fee) {
	
	if (debug) console.log("sendOfferCancelOffline - " + seq + ", accSeqID: " + accSeqID + ", ledSeqID: " + ledSeqID + ", fee: " + fee);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
			var cancel = {
                orderSequence: seq
            };
          
            console.log(cancel);
            remote.prepareOrderCancellation(fromacc, cancel, instructions).then(prepared => {
 				    console.log('OfferCancel transaction prepared...');
				    const {signedTransaction} = remote.sign(prepared.txJSON, secret);
				    
                    secret = "";
				    
                    console.log('OfferCancel transaction signed...');
                    $('#divgreenqrdisplay').empty();
                    $('#divgreenqrdisplay').append(kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function sendAccountFlagsTx(passphrase, fromacc, defaultRipple, depositAuth, disableMasterKey, disallowIncomingXRP, globalFreeze, noFreeze, requireAuthorization, requireDestinationTag, successfunc, failurefunc) {
	
	if (debug) console.log('sendAccountFlagsTx - ' + 'defaultRipple: ' + defaultRipple + ', ' + 'depositAuth: ' + depositAuth + ', ' + 'disableMasterKey: ' + disableMasterKey + ', ' + 'disallowIncomingXRP: ' + disallowIncomingXRP + ', ' + 'globalFreeze: ' + globalFreeze + ', ' + 'noFreeze: ' + noFreeze + ', ' + 'requireAuthorization: ' + requireAuthorization + ', ' + requireDestinationTag);
	
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            var flags = {
                "defaultRipple": defaultRipple, "depositAuth": depositAuth, "disableMasterKey": disableMasterKey, "disallowIncomingXRP": disallowIncomingXRP, "globalFreeze": globalFreeze, "noFreeze": noFreeze, "requireAuthorization": requireAuthorization, "requireDestinationTag": requireDestinationTag
            }
            var submit_flag_change = (flags, secret) => {
                for (var f in flags) {
                    // drop any flags we're not changing
                    if (flags[f] == 'unchanged') {
                        delete(flags[f]);
                        continue;
                    }
                    // grab the first flag off the top and submit it
                    var instructions = {maxLedgerVersionOffset: 30};
                    var settings = {};
                    
                    settings[f] = ( flags[f] == "true" );
                    
                    delete(flags[f]);
                    var preparesettings = function(fromacc, settings, instructions, ptries) {
                        return remote.prepareSettings(fromacc, settings, instructions).then(prepared => {
                            console.log('Trustline transaction prepared...');
                            const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                            
                           
                            
                            console.log('Settings transaction signed...');
                            
                            submitSignedTransaction(signedTransaction, ()=>{ submit_flag_change(flags, secret); }, failurefunc, ptries);
                            
                        }, (fail) => 	 {
                            console.log('Prepare settings failed: ' + fail);
                            if ((fail + "").toLowerCase().indexOf("notconnected") != -1) {
                                return serverCycle(
                                    function() {
                                        preparepayment(fromacc, settings, instructions, ptries + 1);
                                    }, ptries + 1, failurefunc);
                            }
                            unblockInput();
                            failurefunc("" + fail);
                        });
                    }
                    return preparesettings(fromacc, settings, instructions, 0);
                }
                // if code execution reaches here then all submissions were successful!
                successfunc();
            };
            
            submit_flag_change(flags, secret);
            secret = "";
		
		},
		function() {
			unblockInput();
			failurefunc("Could not load secret. Wallet may be corrupted.");
		});    
}

function  sendAccountFlagsTxOffline(passphrase, fromacc, defaultRipple, depositAuth, disableMasterKey, disallowIncomingXRP, globalFreeze, noFreeze, requireAuthorization, requireDestinationTag, accSeqID, ledSeqID, fee) {
	if (debug) console.log('sendAccountFlagsTx - ' + 'defaultRipple: ' + defaultRipple + ', ' + 'depositAuth: ' + depositAuth + ', ' + 'disableMasterKey: ' + disableMasterKey + ', ' + 'disallowIncomingXRP: ' + disallowIncomingXRP + ', ' + 'globalFreeze: ' + globalFreeze + ', ' + 'noFreeze: ' + noFreeze + ', ' + 'requireAuthorization: ' + requireAuthorization + ', ' + requireDestinationTag + " accSeqID " +  accSeqID + " ledSeqID " + ledSeqID + " fee " + fee);
	blockInput();
	
	getSecretForAccount(passphrase, fromacc, 
		function(secret) {
            try {
			var instructions = {
                maxLedgerVersion: (ledSeqID + 1029 + toastepoc ), // valid for one hour
                sequence: (accSeqID),
                fee: fee + ""
            };
            var settings = {};
            // only allow one flag to be set, whichever comes first
            if (defaultRipple != 'unchanged') settings['defaultRipple'] = ( defaultRipple == 'true' );
            else if (depositAuth != 'unchanged') settings['depositAuth'] = ( depositAuth == 'true' );
            else if (disableMasterKey != 'unchanged') settings['disableMasterKey'] = ( disableMasterKey == 'true' );
            else if (disallowIncomingXRP != 'unchanged') settings['disallowIncomingXRP'] = ( disallowIncomingXRP == 'true' );
            else if (globalFreeze != 'unchanged') settings['globalFreeze'] = ( globalFreeze == 'true' );
            else if (noFreeze != 'unchanged') settings['noFreeze'] = ( noFreeze == 'true' );
            else if (requireAuthorization != 'unchanged') settings['requireAuthorization'] = ( requireAuthorization == 'true' );
            else if (requireDestinationTag != 'unchanged') settings['requireDestinationTag'] = ( requireDestinationTag == 'true' );
            remote.prepareSettings(fromacc, settings, instructions).then(prepared => {
                console.log('Settings transaction prepared...');
                const {signedTransaction} = remote.sign(prepared.txJSON, secret);
                console.log('Settings transaction signed...');
                secret = "";
                    $('#divgreenqrdisplay').empty();
                    $('#divgreenqrdisplay').append(kjua({text: 'ripple:signed-transaction:' + signedTransaction, fill: "#008000", ecLevel: 'L', size: 340}));
                    showTab('#tabgreenqr');
                    unblockInput();
            },
            E => {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );            
            });
         
            } catch (E) {
                console.log(E);
                navigator.notification.alert("Unexpected error " + E, 
                    function(){
                        unblockInput();
                    }, 
                "Failure", 
                "OK"
                );
            }
        },
		function() {
            navigator.notification.alert("Could not load secret. Wallet may be corrupted.", 
                function(){
                    unblockInput();
                }, 
                "Failure", 
                "OK"
            );
		}
    );
}

function submitSignedTransaction(signedTransaction, successfunc, failurefunc, tries) {
    remote.submit(signedTransaction).then(
        data => {
            if (debug) console.log("Submission result: " + data.resultCode );
            if (data.resultCode == 'tesSUCCESS' || data.resultCode == 'terQUEUED') {
                if (debug) console.log("send successful [" + data.resultCode + "]");
                unblockInput();
                return successfunc(data.resultCode == 'terQUEUED');
            } else if ((data.resultCode + "").toLowerCase().indexOf('max_ledger') != -1) {
                // failed to be submitted
                // cycle servers and try again
                
                return serverCycle(
                    function() {
                        submitSignedTransaction(signedTransaction, successfunc, failurefunc, tries + 1);
                    }, tries + 1, failurefunc);
            } else {
                if (debug) console.log("send failed 2: " + data.resultCode);
                unblockInput();
                return failurefunc(data.resultCode + "");						
            }
        }, 
        (e) => {
            if (debug) console.log("send failed: " + e);
            if ((e + "").toLowerCase().indexOf("notconnected") != -1) {
                return serverCycle(
                    function() {
                        submitSignedTransaction(signedTransaction, successfunc, failurefunc, tries + 1);
                    }, 
                    tries + 1, failurefunc
                );
            }
                            
            unblockInput();
            failurefunc(e + "");
        }
    );
}
// Expose functions globally
window.sendPayment = sendPayment;
window.sendPaymentOffline = sendPaymentOffline;
window.sendTrustLineTx = sendTrustLineTx;
window.sendTrustLineTxOffline = sendTrustLineTxOffline;
window.sendOfferCreate = sendOfferCreate;
window.sendOfferCreateOffline = sendOfferCreateOffline;
window.sendOfferCancel = sendOfferCancel;
window.sendOfferCancelOffline = sendOfferCancelOffline;
window.sendAccountFlagsTx = sendAccountFlagsTx;
window.sendAccountFlagsTxOffline = sendAccountFlagsTxOffline;
window.submitSignedTransaction = submitSignedTransaction;
