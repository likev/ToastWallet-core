function doViewTransaction(hash) {
    if (debug) console.log('doViewTransaction -- ' + hash);
    blockInput();	
    $('#vtxhash').val(hash);
    
    remote.request({
        command: "tx",
        transaction: hash
    }).then(res => {
        var tx = res.result;
        var x = {
            result: 'success',
            transaction: {
                tx: tx,
                meta: tx.meta
            }
        };
        unblockInput();
        // todo: better server error handling here
        if (typeof(x.transaction) == "undefined" || typeof(x.transaction.tx) == "undefined" || typeof(x.transaction.meta) == "undefined") {
            $('#vtxstatus').val('Unknown / Not Found');
            $('#vtxdetails').hide();
            showTab('#tabviewtransaction', true);
            return;
        }
        // execution to here means the tx details were returned
        $('#vtxdetails').show();
        $('#vtxstatus').val(x.transaction.tx.TransactionType + ( typeof(x.transaction.meta.TransactionResult) != undefined ? ' - ' + x.transaction.meta.TransactionResult : ' - Unknown Status')); 
        $('#vtxfrom').val( dispaddr(x.transaction.tx.Account) )
        $('#vtxdtag').val( typeof(x.transaction.tx.DestinationTag) == 'undefined' ? 'not specified' :   x.transaction.tx.DestinationTag)
        if (interface_settings.display_xaddresses) {
            $('#vtxto').val(xaddr(x.transaction.tx.Destination,  x.transaction.tx.DestinationTag == undefined ? false : x.transaction.tx.DestinationTag))
            $('#vtxdtgroup').hide()
        } else {
            $('#vtxdtgroup').show()
            $('#vtxto').val(x.transaction.tx.Destination)
        }
        $('#vtxdeliveredamount').val( typeof(x.transaction.meta.delivered_amount) != undefined ?  x.transaction.meta.delivered_amount/1000000.0 : 'not specified') ;
        $('#vtxrawtx')[0].innerText = JSON.stringify(x, null, 4) + '';
        showTab('#tabviewtransaction', true);
    }).catch(err => {
        unblockInput();
        $('#vtxstatus').val('Unknown / Not Found');
        $('#vtxdetails').hide();
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
        var txs = res.result.transactions || [];
        for (var i = 0; i < txs.length; i++) {
            var t = txs[i].tx;
            if (t && t.TransactionType === 'Payment' && typeof t.Amount === 'string') {
                payments.push({
                    source: t.Account,
                    destination: t.Destination,
                    amount: parseFloat(t.Amount) / 1000000.0,
                    tx_hash: t.hash || t.TxnSignature
                });
                if (payments.length >= 10) break;
            }
        }
        
        var nextMarker = res.result.marker ? JSON.stringify(res.result.marker) : undefined;
        var x = {
            payments: payments,
            marker: nextMarker
        };
        
		var root = $('#accdetailstransactiondetails');
		root.empty();
		var tx = "";
		var count = 0;
		if (x.payments != undefined) {
			for (var i in x.payments) {
				tx += '<li class="txrow '+(x.payments[i].source == address ? 'txsent' : 'txreceived')+'" data-txhash="'+x.payments[i].tx_hash+'" ontouchstart="ts(event)" ontouchend="te(event, ()=>{doViewTransaction(\''+x.payments[i].tx_hash+'\')})">';
				var outgoing = (x.payments[i].source == address);
				tx += '<span><i class="fa ' + ( outgoing ? 'fa-paper-plane' : 'fa-inbox' ) + '" aria-hidden="true"></i>';
				var addr = ( outgoing ? x.payments[i].destination : x.payments[i].source ) 
                tx += dispaddr( addr ) + '</span>';
				tx += '<span >' + x.payments[i].amount + '</span>';
				tx += '</li>'
				count++;
			}
		}
		if (count == 0) {
			tx = '<li style="color:black;"><center><i>No transactions found</i></center></li>';
		}
		root.append('<ul class="transactionlist">'+tx+'</ul>');
		if (x.marker != undefined && count > 0) {
			root.append('<button  type="button" class="btn btn-primary" ontouchstart="ts(event)" ontouchend="te(event, ()=>{doGetTransactions(\'' + address + '\', ' + JSON.stringify(x.marker).replace(/"/g, '&quot;') + ')})">More</button>');
		} else if (count > 0) {
			root.append('<button  type="button" class="btn btn-primary" ontouchstart="ts(event)" ontouchend="te(event, ()=>{doGetTransactions(\'' + address + '\', \'\')})">Back to Start</button>');			
		}
		clickProxy();	
		unblockInput();
    }).catch(err => {
        if (debug) console.log("Get transactions error: " + err);
        unblockInput();
		var root = $('#accdetailstransactiondetails');
		root.empty();
		root.append('<ul class="transactionlist"><li style="color:black;"><center><i>Error loading transactions</i></center></li></ul>');
    });
}

// Expose functions globally
window.doViewTransaction = doViewTransaction;
window.doGetTransactions = doGetTransactions;