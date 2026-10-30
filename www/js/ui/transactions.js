'use strict';

function doViewTransaction(hash) {
    if (debug) console.log('doViewTransaction -- ' + hash);
    blockInput();	
    setVal('#vtxhash', hash);
    
    remote.request({
        command: "tx",
        transaction: hash
    }).then(res => {
        var tx = res.result ? (res.result.tx_json || res.result) : null;
        var meta = res.result ? (res.result.meta || res.result.metaData || (tx ? (tx.meta || tx.metaData) : null)) : null;
        var isValidated = !!(res.result && (res.result.validated === true || (tx && tx.validated === true)));
        var x = {
            result: 'success',
            transaction: {
                tx: tx,
                meta: meta
            }
        };
        unblockInput();
        if (!tx || !meta) {
            setVal('#vtxstatus', 'Unknown / Not Found');
            hideEl('#vtxdetails');
            showTab('#tabviewtransaction', true);
            return;
        }
        showEl('#vtxdetails');
        var statusStr = tx.TransactionType + (meta.TransactionResult ? ' - ' + meta.TransactionResult : ' - Unknown Status');
        if (!isValidated) statusStr += ' (UNVALIDATED)';
        setVal('#vtxstatus', statusStr); 
        setVal('#vtxfrom', dispaddr(tx.Account));
        var hasDtag = tx.DestinationTag !== undefined && tx.DestinationTag !== null && tx.DestinationTag !== false && !Number.isNaN(Number(tx.DestinationTag));
        setVal('#vtxdtag', hasDtag ? String(tx.DestinationTag) : 'not specified');
        if (interface_settings.display_xaddresses) {
            setVal('#vtxto', xaddr(tx.Destination, hasDtag ? tx.DestinationTag : false));
            hideEl('#vtxdtgroup');
        } else {
            showEl('#vtxdtgroup');
            setVal('#vtxto', tx.Destination);
        }
        var delivered;
        var rawDelivered = meta.delivered_amount !== undefined ? meta.delivered_amount : meta.DeliveredAmount;
        if (rawDelivered !== undefined && rawDelivered !== null) {
            if (typeof rawDelivered === 'string') {
                var dNum = Number(rawDelivered);
                if (!Number.isNaN(dNum)) {
                    delivered = (dNum / 1000000.0) + ' XRP';
                } else {
                    delivered = String(rawDelivered);
                }
            } else if (typeof rawDelivered === 'object' && rawDelivered !== null) {
                delivered = (rawDelivered.value !== undefined ? rawDelivered.value : '') + ' ' + (rawDelivered.currency || '');
            } else {
                delivered = String(rawDelivered);
            }
        } else {
            delivered = 'not specified';
        }
        setVal('#vtxdeliveredamount', delivered);
        setText('#vtxrawtx', JSON.stringify(x, null, 4) + '');
        showTab('#tabviewtransaction', true);
    }).catch(err => {
        unblockInput();
        setVal('#vtxstatus', 'Unknown / Not Found');
        hideEl('#vtxdetails');
        showTab('#tabviewtransaction', true);
    });
}

function doGetTransactions(address, marker) {
	if (debug) console.log("doGetTransactions");
	//blockInput();
    address = forceraddr(address);
    
    var reqParam = {
        command: "account_tx",
        account: address,
        limit: 20
    };
    if (marker) {
        try {
            reqParam.marker = JSON.parse(marker);
        } catch (e) {
            reqParam.marker = marker;
        }
    }
    
    remote.request(reqParam).then(res => {
        var payments = [];
        var txs = (res.result && res.result.transactions) ? res.result.transactions : [];
        for (var i = 0; i < txs.length; i++) {
            var item = txs[i];
            var isVal = (item.validated === true || (res.result && res.result.validated === true));
            if (!isVal) continue;
            var t = item.tx_json || item.tx;
            if (!t) continue;
            var meta = item.meta || item.metaData;
            if (!meta || meta.TransactionResult !== 'tesSUCCESS') continue;
            if (t.TransactionType !== 'Payment') continue;

            var rawDelivered = meta.delivered_amount !== undefined ? meta.delivered_amount : meta.DeliveredAmount;
            if (rawDelivered === undefined || rawDelivered === null) continue;

            var amountStr;
            if (typeof rawDelivered === 'string') {
                var dNum = Number(rawDelivered);
                if (Number.isNaN(dNum)) continue; // skip non-numeric e.g. 'unavailable'
                amountStr = (dNum / 1000000.0) + ' XRP';
            } else if (typeof rawDelivered === 'object' && rawDelivered !== null) {
                amountStr = (rawDelivered.value !== undefined ? rawDelivered.value : '') + ' ' + (rawDelivered.currency || '');
            } else {
                amountStr = String(rawDelivered);
            }

            payments.push({
                source: t.Account,
                destination: t.Destination,
                amount: amountStr,
                tx_hash: item.hash || t.hash || t.TxnSignature
            });
            if (payments.length >= 10) break;
        }
        
        var nextMarker = (res.result && res.result.marker) ? JSON.stringify(res.result.marker) : undefined;
        var x = {
            payments: payments,
            marker: nextMarker
        };
        
		var root = byId('accdetailstransactiondetails');
		emptyEl(root);
		var ul = document.createElement('ul');
		ul.className = 'transactionlist';
		var count = 0;
		if (x.payments && x.payments.length > 0) {
			for (var j = 0; j < x.payments.length; j++) {
                var p = x.payments[j];
                var li = document.createElement('li');
                var outgoing = (p.source === address);
                li.className = 'txrow ' + (outgoing ? 'txsent' : 'txreceived');
                if (p.tx_hash) li.setAttribute('data-txhash', p.tx_hash);
                
                (function(h) {
                    li.addEventListener('touchstart', ts);
                    li.addEventListener('touchend', function(e) {
                        te(e, function() {
                            doViewTransaction(h);
                        });
                    });
                })(p.tx_hash);

                var sLeft = document.createElement('span');
                var icon = document.createElement('i');
                icon.className = 'fa ' + (outgoing ? 'fa-paper-plane' : 'fa-inbox');
                icon.setAttribute('aria-hidden', 'true');
                sLeft.appendChild(icon);
                sLeft.appendChild(document.createTextNode(' '));
                var addr = outgoing ? p.destination : p.source;
                sLeft.appendChild(document.createTextNode(dispaddr(addr)));

                var sRight = document.createElement('span');
                sRight.textContent = p.amount;

                li.appendChild(sLeft);
                li.appendChild(sRight);
                ul.appendChild(li);
                count++;
			}
		}
		if (count === 0) {
            var emptyLi = document.createElement('li');
            emptyLi.style.color = 'black';
            var center = document.createElement('center');
            var em = document.createElement('i');
            em.textContent = 'No transactions found';
            center.appendChild(em);
            emptyLi.appendChild(center);
            ul.appendChild(emptyLi);
		}
		root.appendChild(ul);
		if (x.marker !== undefined) {
            var btnMore = document.createElement('button');
            btnMore.type = 'button';
            btnMore.className = 'btn btn-primary';
            btnMore.textContent = 'More';
            (function(a, m) {
                btnMore.addEventListener('touchstart', ts);
                btnMore.addEventListener('touchend', function(e) {
                    te(e, function() {
                        doGetTransactions(a, m);
                    });
                });
            })(address, x.marker);
            root.appendChild(btnMore);
		} else if (count > 0) {
            var btnBack = document.createElement('button');
            btnBack.type = 'button';
            btnBack.className = 'btn btn-primary';
            btnBack.textContent = 'Back to Start';
            (function(a) {
                btnBack.addEventListener('touchstart', ts);
                btnBack.addEventListener('touchend', function(e) {
                    te(e, function() {
                        doGetTransactions(a, '');
                    });
                });
            })(address);
            root.appendChild(btnBack);
		}
		clickProxy();	
		unblockInput();
    }).catch(err => {
        if (debug) console.log("Get transactions error: " + err);
        unblockInput();
		var root = byId('accdetailstransactiondetails');
		if (root) {
			emptyEl(root);
			var errUl = document.createElement('ul');
			errUl.className = 'transactionlist';
			var errLi = document.createElement('li');
			errLi.style.color = 'black';
			var center = document.createElement('center');
			var em = document.createElement('i');
			em.textContent = 'Error loading transactions';
			center.appendChild(em);
			errLi.appendChild(center);
			errUl.appendChild(errLi);
			root.appendChild(errUl);
		}
    });
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.doViewTransaction = doViewTransaction;
    window.doGetTransactions = doGetTransactions;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        doViewTransaction,
        doGetTransactions
    };
}