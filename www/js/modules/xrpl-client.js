'use strict';

function setRemoteGateway(server) {
	currentServer = server;
	remote = new xrpl.Client(server, { connectionTimeout: 10000, maxFeeXRP: '0.01' });
	injectCompatibilityLayer(remote);
}

function resetServerStack() {
	serverStack = [];
    if (ontestnet) {
        serverStack.unshift(testnetServer);
	    setRemoteGateway(serverStack[0]);
        return;
    }
	for (var i = 0; i < defaultServerStack.length; i++) {
		serverStack.unshift(defaultServerStack[i]);
	}
	randShuffleArray(serverStack);
	setRemoteGateway(serverStack[0]);
}

function connectToRipple(funcsuccess, suppressbootsequence) {
	if (debug) console.log("connectToRipple " + currentServer);
	
	remote.connect().then(function() {
			if (debug) console.log("connect success");
			
			setText('.currentgateway', currentServer);
			// check if the user has connected via a custom gateway and add it to our gateway list for next time if they have
			var isDefaultGateway = false;
			for (var i = 0; i < defaultServerStack.length; i++) {
				if (defaultServerStack[i] == currentServer) {
					isDefaultGateway = true;
					break;
				}
			}
			if (!isDefaultGateway) {
				// we are connected to a non default gateway, store it for next time
				getSavedGateways(function(savedgateways) {
					// check if its already stored
					if (savedgateways['gateways'] == undefined) {
						savedgateways['gateways'] = [];
					}
					var exists = false;
					for (var i = 0; i < savedgateways['gateways'].length; i++) {
						if (savedgateways['gateways'][i] == currentServer) {
							exists = true;
							break;
						}
					}
					//  if its not then store it for next time
					if (!exists) {
						savedgateways['gateways'].unshift(currentServer);
						db.upsert("savedgateways",
							function(doc) {
							return { data: JSON.stringify(savedgateways)	}; 
						});					
					}
				});
			}
			remote.getServerInfo().then(info => {
				if (info != undefined && info['validatedLedger'] != undefined && info['validatedLedger']['reserveBaseXRP'] != undefined) 
					xrpreserve = parseInt('' +   info['validatedLedger']['reserveBaseXRP']);
					setText("#minxrp2", "" + xrpreserve);
					setText("#minxrp3", "" + xrpreserve);
			}).catch(e => {
				console.log("xrp reserve request error: " + e);
			});
			if (suppressbootsequence == undefined || !suppressbootsequence) hideSpinner();	
			funcsuccess();
		}).catch(function(e) {
			if (debug) console.log("connect error: " + e);
			
			for (var i = 0; i < serverStack.length; i++) {
				if (serverStack[i] == currentServer && i != serverStack.length-1) {
					// move it along a server
					setRemoteGateway(serverStack[i+1]);
					connectToRipple(funcsuccess);
					return;
				}	
			}
			// out of servers, show the error prompt
			hideSpinner();	
			showTab('#tabconnectionselect');
			return;
		});
}

function doRetryConnection(gateway) {
	if (gateway == undefined) gateway = "";
	gateway = gateway.trim();
	if (gateway == "") {
		// do nothing
	} else if (gateway.indexOf('://') == -1) {
		gateway = 'wss://' + gateway;
	}
	// check if already in the stack
	var exists = false;
	for (var i = 0; i < serverStack.length; i++) {
		if (serverStack[i] == gateway) {
			exists = true;
			break;
		}
	}
	if (gateway != "" && !exists) {
		serverStack.unshift(gateway);
	}
	
	setRemoteGateway(serverStack[0]);
	hideEl('#tabconnectionselect');
	hideEl('#navheader');
	removeClass('body', 'darkbackground');
	currenttab = "";
	showSpinner();
	normalboot();	
}

function doOfflineMode(withboot) {
	offlinemode = true;
	remote = new xrpl.Client("wss://s1.ripple.com", { connectionTimeout: 10000, maxFeeXRP: '0.01' });
	injectCompatibilityLayer(remote);
	showEl('#offlinemodewarning');
	if (withboot) normalboot();	
}

function checkConnection(connectedfunc) {
	if (debug) console.log("checkConnection()");
	var isOffline = false;
	if (typeof navigator.onLine !== 'undefined') {
		isOffline = !navigator.onLine;
	}
	if (isOffline) {
		navigator.notification.alert('Internet Connection Lost.', 
			function() {
				hideSpinner();
				unblockInput();
				doShowLogin();
				normalboot();
			},
			'Connection Lost',
			'OK'
		);
	} else {
		if (debug) console.log("checkConnection() -> call connectedfunc()");
		connectedfunc();
	}
}

function serverCycle(doafter, tries, failurefunc) {
    if (tries >= serverStack.length - 1) {
        if (debug) console.log("send failed 3: servercycles expired");
        unblockInput();
        return failurefunc("[No gateways responded. Is your Internet connected?]");
    }
    var serverIndex = 0;
    for (var i = 0; i < serverStack.length; i++) {
        if (serverStack[i] == currentServer) {
            serverIndex = i + 1;
            break;
        }
    }
    serverIndex %= serverStack.length;
    setRemoteGateway(serverStack[serverIndex]);
    connectToRipple(doafter, true); 
}

function injectCompatibilityLayer(client) {
    var parseFlags = (flagsInt) => {
        flagsInt = flagsInt || 0;
        return {
            requireDestinationTag: (flagsInt & 0x00020000) !== 0,
            requireAuthorization: (flagsInt & 0x00040000) !== 0,
            disallowIncomingXRP: (flagsInt & 0x00080000) !== 0,
            disableMasterKey: (flagsInt & 0x00100000) !== 0,
            noFreeze: (flagsInt & 0x00200000) !== 0,
            globalFreeze: (flagsInt & 0x00400000) !== 0,
            defaultRipple: (flagsInt & 0x00800000) !== 0,
            depositAuth: (flagsInt & 0x01000000) !== 0
        };
    };
    client.getSettings = function(address) {
        return client.request({ command: "account_info", account: address }).then(res => {
            var data = res.result.account_data;
            var settings = parseFlags(data.Flags);
            if (data.RegularKey) {
                settings.regularKey = data.RegularKey;
            }
            return settings;
        });
    };
    client.getTrustlines = function(address) {
        return client.request({ command: "account_lines", account: address }).then(res => {
            return (res.result.lines || []).map(line => ({
                specification: {
                    currency: line.currency,
                    counterparty: line.account,
                    limit: line.limit
                },
                state: {
                    balance: line.balance
                }
            }));
        });
    };
    client.getOrders = function(account) {
        var parseAmount = (amt) => {
            if (typeof amt === 'string') {
                return { currency: 'XRP', counterparty: '', value: (parseFloat(amt) / 1000000.0).toString() };
            } else {
                return { currency: amt.currency, counterparty: amt.issuer, value: amt.value };
            }
        };
        return client.request({ command: "account_offers", account: account }).then(res => {
            return (res.result.offers || []).map(offer => {
                var pays = parseAmount(offer.taker_pays);
                var gets = parseAmount(offer.taker_gets);
                var isSell = (offer.flags & 0x00020000) !== 0;
                return {
                    specification: {
                        direction: isSell ? 'sell' : 'buy',
                        quantity: isSell ? gets : pays,
                        totalPrice: isSell ? pays : gets
                    },
                    properties: {
                        sequence: offer.seq
                    }
                };
            });
        });
    };
    client.getOrderbook = function(issuer, book, options) {
        var base = book.base;
        var counter = book.counter;
        var limit = (options && options.limit) || 20;
        var formatCurrency = (c) => {
            if (c.currency === 'XRP') {
                return { currency: 'XRP' };
            } else {
                return { currency: c.currency, issuer: c.counterparty || issuer };
            }
        };
        var base_formatted = formatCurrency(base);
        var counter_formatted = formatCurrency(counter);
        var asksPromise = client.request({
            command: "book_offers",
            taker_gets: base_formatted,
            taker_pays: counter_formatted,
            limit: limit
        });
        var bidsPromise = client.request({
            command: "book_offers",
            taker_gets: counter_formatted,
            taker_pays: base_formatted,
            limit: limit
        });
        return Promise.all([asksPromise, bidsPromise]).then(([asksRes, bidsRes]) => {
            var mapOffer = (offer, isAsk) => {
                var BigNumber = window.BigNumber;
                var getsAmount = typeof offer.TakerGets === 'string'
                    ? new BigNumber(offer.TakerGets).dividedBy(1000000)
                    : new BigNumber(offer.TakerGets.value);
                var paysAmount = typeof offer.TakerPays === 'string'
                    ? new BigNumber(offer.TakerPays).dividedBy(1000000)
                    : new BigNumber(offer.TakerPays.value);
                
                var price;
                var quantity;
                var totalPrice;
                if (isAsk) {
                    quantity = getsAmount;
                    totalPrice = paysAmount;
                    price = totalPrice.dividedBy(quantity);
                } else {
                    quantity = paysAmount;
                    totalPrice = getsAmount;
                    price = totalPrice.dividedBy(quantity);
                }
                return {
                    specification: {
                        direction: isAsk ? 'buy' : 'sell',
                        quantity: { value: quantity.toString() },
                        totalPrice: { value: totalPrice.toString() }
                    },
                    properties: {
                        makerExchangeRate: price.toString()
                    }
                };
            };
            var asks = (asksRes.result.offers || []).map(o => mapOffer(o, true));
            var bids = (bidsRes.result.offers || []).map(o => mapOffer(o, false));
            return { asks: asks, bids: bids };
        });
    };
    client.generateAddress = function() {
        var w = xrpl.Wallet.generate("ecdsa-secp256k1");
        return {
            address: w.classicAddress,
            secret: w.seed
        };
    };
    
    client.getLedger = function(opts) {
        return client.request({ command: "ledger", ledger_index: "validated" }).then(res => {
            return {
                ledgerVersion: res.result.ledger_index
            };
        });
    };
    
    client.getAccountInfo = function(account) {
        return client.request({ command: "account_info", account: account }).then(res => {
            return {
                sequence: res.result.account_data.Sequence
            };
        });
    };
    client.getFee = function() {
        return client.request({ command: "fee" }).then(res => {
            var drops = (res.result && res.result.drops && res.result.drops.minimum_fee) || "12";
            var xrp = (parseFloat(drops) / 1000000.0).toString();
            return xrp;
        });
    };
    client.getServerInfo = function() {
        return client.request({ command: "server_info" }).then(res => {
            var base_xrp = 20;
            if (res.result && res.result.info && res.result.info.validated_ledger) {
                base_xrp = res.result.info.validated_ledger.reserve_base_xrp;
            }
            return {
                validatedLedger: {
                    reserveBaseXRP: base_xrp
                }
            };
        });
    };
    var formatOfferAmount = (amt) => {
        if (amt.currency === 'XRP') {
            return xrpl.xrpToDrops(amt.value);
        } else {
            return {
                currency: amt.currency,
                issuer: amt.counterparty || amt.issuer,
                value: amt.value
            };
        }
    };
    function isValidTag(tag) {
        if (tag === undefined || tag === null || tag === false || tag === '') return false;
        const num = Number(tag);
        return Number.isInteger(num) && num >= 0 && num <= 4294967295;
    }

    var MAX_FEE_DROPS = 10000; // 0.01 XRP

    function finalizeTx(tx, instructions) {
        if (instructions) {
            if (instructions.fee !== undefined && instructions.fee !== null && instructions.fee !== '') {
                var feeDrops = parseInt(xrpl.xrpToDrops(instructions.fee + ""), 10);
                if (isNaN(feeDrops) || feeDrops <= 0 || feeDrops > MAX_FEE_DROPS) {
                    return Promise.reject(new Error("Fee exceeds maximum allowed limit of 0.01 XRP: " + feeDrops + " drops"));
                }
                tx.Fee = feeDrops + "";
            }
            if (instructions.sequence !== undefined) {
                tx.Sequence = parseInt(instructions.sequence, 10);
            }
            if (instructions.maxLedgerVersion !== undefined) {
                tx.LastLedgerSequence = parseInt(instructions.maxLedgerVersion, 10);
            }
        }
        if (tx.Sequence === undefined || tx.Fee === undefined) {
            return client.autofill(tx).then(autofilled => {
                var autoFee = autofilled.Fee ? parseInt(autofilled.Fee, 10) : NaN;
                if (isNaN(autoFee) || autoFee <= 0 || autoFee > MAX_FEE_DROPS) {
                    throw new Error("Autofilled fee exceeds maximum allowed limit of 0.01 XRP: " + autofilled.Fee + " drops");
                }
                if (instructions && instructions.maxLedgerVersionOffset !== undefined && instructions.maxLedgerVersion === undefined) {
                    return client.getLedgerIndex().then(currentLedger => {
                        if (autofilled.LastLedgerSequence > currentLedger + instructions.maxLedgerVersionOffset) {
                            autofilled.LastLedgerSequence = currentLedger + instructions.maxLedgerVersionOffset;
                        }
                        return { txJSON: JSON.stringify(autofilled) };
                    }).catch(() => {
                        return { txJSON: JSON.stringify(autofilled) };
                    });
                }
                return { txJSON: JSON.stringify(autofilled) };
            });
        } else {
            var staticFee = tx.Fee ? parseInt(tx.Fee, 10) : NaN;
            if (isNaN(staticFee) || staticFee <= 0 || staticFee > MAX_FEE_DROPS) {
                return Promise.reject(new Error("Fee exceeds maximum allowed limit of 0.01 XRP: " + tx.Fee + " drops"));
            }
            return Promise.resolve({ txJSON: JSON.stringify(tx) });
        }
    }

    client.preparePayment = function(fromacc, payment, instructions) {
        var tx = {
            TransactionType: "Payment",
            Account: fromacc,
            Destination: payment.destination.address,
            Amount: payment.destination.amount.currency === 'XRP' 
                    ? xrpl.xrpToDrops(payment.destination.amount.value) 
                    : {
                        currency: payment.destination.amount.currency,
                        issuer: payment.destination.amount.counterparty || payment.destination.amount.issuer,
                        value: payment.destination.amount.value
                      }
        };
        if (payment.destination && isValidTag(payment.destination.tag)) {
            tx.DestinationTag = parseInt(payment.destination.tag, 10);
        }
        if (payment.source && isValidTag(payment.source.tag)) {
            tx.SourceTag = parseInt(payment.source.tag, 10);
        }
        if (payment.invoiceID) {
            tx.InvoiceID = payment.invoiceID;
        }
        if (payment.allowPartialPayment) {
            tx.Flags = 0x00020000;
        }
        return finalizeTx(tx, instructions);
    };
    var asfFlags = {
        requireDestinationTag: 1,
        requireAuthorization: 2,
        disallowIncomingXRP: 3,
        disableMasterKey: 4,
        noFreeze: 6,
        globalFreeze: 7,
        defaultRipple: 8,
        depositAuth: 9
    };
    client.prepareSettings = function(fromacc, settings, instructions) {
        var tx = {
            Account: fromacc
        };
        if (settings.regularKey !== undefined) {
            tx.TransactionType = "SetRegularKey";
            if (settings.regularKey) {
                tx.RegularKey = settings.regularKey;
            }
        } else {
            tx.TransactionType = "AccountSet";
            for (var key in asfFlags) {
                if (settings[key] !== undefined) {
                    var flagValue = asfFlags[key];
                    if (settings[key]) {
                        tx.SetFlag = flagValue;
                    } else {
                        tx.ClearFlag = flagValue;
                    }
                    break;
                }
            }
        }
        return finalizeTx(tx, instructions);
    };
    client.prepareTrustline = function(fromacc, trustline, instructions) {
        var tx = {
            TransactionType: "TrustSet",
            Account: fromacc,
            LimitAmount: {
                currency: trustline.currency,
                issuer: trustline.counterparty,
                value: trustline.limit
            }
        };
        if (trustline.ripplingDisabled !== undefined) {
            tx.Flags = trustline.ripplingDisabled ? 0x00020000 : 0x00040000;
        }
        return finalizeTx(tx, instructions);
    };
    client.prepareOrder = function(fromacc, order, instructions) {
        var gets = order.direction === 'sell' ? order.quantity : order.totalPrice;
        var pays = order.direction === 'sell' ? order.totalPrice : order.quantity;
        var tx = {
            TransactionType: "OfferCreate",
            Account: fromacc,
            TakerGets: formatOfferAmount(gets),
            TakerPays: formatOfferAmount(pays)
        };
        var flags = 0;
        if (order.direction === 'sell') {
            flags |= 0x00080000;
        }
        if (order.passive) {
            flags |= 0x00010000;
        }
        if (order.immediateOrCancel) {
            flags |= 0x00020000;
        }
        if (order.fillOrKill) {
            flags |= 0x00040000;
        }
        if (flags !== 0) {
            tx.Flags = flags;
        }
        if (order.expirationTime) {
            tx.Expiration = xrpl.isoTimeToRippleTime(order.expirationTime);
        }
        return finalizeTx(tx, instructions);
    };
    client.prepareOrderCancellation = function(fromacc, cancel, instructions) {
        var tx = {
            TransactionType: "OfferCancel",
            Account: fromacc,
            OfferSequence: parseInt(cancel.orderSequence)
        };
        return finalizeTx(tx, instructions);
    };
    client.sign = function(txJSON, secret, options) {
        var tx = JSON.parse(txJSON);
        var signFee = tx.Fee ? parseInt(tx.Fee, 10) : NaN;
        if (isNaN(signFee) || signFee <= 0 || signFee > MAX_FEE_DROPS) {
            throw new Error("Transaction fee exceeds maximum allowed limit of 0.01 XRP: " + tx.Fee + " drops");
        }
        var alg;
        if (options && options.algorithm) {
            alg = options.algorithm;
        } else if (tx.Account && typeof window !== 'undefined' && window.AppState && window.AppState.accounts && window.AppState.accounts[tx.Account] && window.AppState.accounts[tx.Account].algorithm) {
            alg = window.AppState.accounts[tx.Account].algorithm;
        } else {
            alg = secret.startsWith('sEd') ? 'ed25519' : 'ecdsa-secp256k1';
        }
        var wallet = xrpl.Wallet.fromSeed(secret, { algorithm: alg });
        var signed = wallet.sign(tx);
        return {
            signedTransaction: signed.tx_blob,
            id: signed.hash
        };
    };
    client.submit = function(signedTxHex) {
        return client.request({ command: "submit", tx_blob: signedTxHex }).then(res => {
            return {
                resultCode: res.result.engine_result,
                resultMessage: res.result.engine_result_message
            };
        });
    };
}

// Expose functions globally
window.setRemoteGateway = setRemoteGateway;
window.resetServerStack = resetServerStack;
window.connectToRipple = connectToRipple;
window.doRetryConnection = doRetryConnection;
window.doOfflineMode = doOfflineMode;
window.checkConnection = checkConnection;
window.serverCycle = serverCycle;
window.injectCompatibilityLayer = injectCompatibilityLayer;
