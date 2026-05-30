function renderOrderbookChart(orders, eleid, exchangerate, tlbalance) {
    var o = orders;
    var bids_raw = o.bids;
    var asks_raw = o.asks;
    var bids_unordered = {};
    var asks_unordered = {};
    for (var x in bids_raw) bids_unordered[1.0/parseFloat(""+o.bids[x].properties.makerExchangeRate)] = parseFloat(""+o.bids[x].specification.totalPrice.value);
    for (var x in asks_raw) asks_unordered[parseFloat(""+o.asks[x].properties.makerExchangeRate)] = parseFloat(""+o.asks[x].specification.totalPrice.value);
    var bids = {};
    var asks = {};
    Object.keys(bids_unordered).sort().forEach((key)=>{bids[key] = bids_unordered[key]});
    Object.keys(asks_unordered).sort().forEach((key)=>{asks[key] = asks_unordered[key]});
    // precalculate the sum of horizontal widths and total height of bids and asks
    var bidacc = 0;
    var askacc = 0;
    var range = 0;
    var smallestamount = Number.MAX_SAFE_INTEGER;
    // first the bids (next price - previous price)
    var last = -1;
    for (var x in bids) {
        if (last > -1) {
            range += x - last;
            bidacc += bids[x];
        }
        last = x;
        if (bids[x] < smallestamount) smallestamount = bids[x];
    }
    // calculate center width (first ask - last bid)
    var lastbid = last;
    var firstask = -1;
    for (var x in asks) { firstask = x; break }
    range += firstask - lastbid;
    // finally the asks (next price - previous price)
    last = -1;
    for (var x in asks) {
        if (last > -1) {
            range += x - last;
        }
        askacc += asks[x];
        last = x;
        if (asks[x] < smallestamount) smallestamount = asks[x];
    }
    askacc -= asks[last];
    // turn the range into a percent
    range = 100.00 / range;
    // calculate the vertical range
    var vertrange = 100.00 / (Math.max(askacc, bidacc) - smallestamount);
    // percentage accumulator helps us debug the drawing calculations
    var pcacc = 0;
    var chart = $(eleid);
    chart.empty();
    // draw bids
    last = -1;
    for (var x in bids) {
        if (last > -1) {
            var width_raw = x - last;
            var height_raw = bidacc - smallestamount;
            var amount = bids[x];
            var pc = width_raw * range;
            pcacc += pc;
            var width = display_currency_amount(pc);
            var height = display_currency_amount( height_raw * vertrange );
            chart.append('<span class="chartelegreen" style="width: '+width+'%; height: '+height+'%;"></span>');
            bidacc -= amount;
        }
        last = x;
    }
    // draw gap between bids and asks
    var width_raw = firstask - lastbid;
    var pc = width_raw * range;
    pcacc += pc;
    var hwidth = display_currency_amount(pc);
    chart.append('<span class="charteleblank" style="min-width: 1px; min-width: 1px; width: '+hwidth+'%; background: rgba(0,0,0,0); height: 100%;"></span>');
    // draw the asks
    askacc = 0;
    last = -1;
    for (var x in asks) {
        if (last > -1) {
            var width_raw = x - last;
            var amount = asks[last];
            askacc += amount;
            var height_raw = askacc - smallestamount;
            var pc = width_raw * range;
            pcacc += pc;
            var width = display_currency_amount(pc);
            var height = display_currency_amount( height_raw * vertrange );
            
            chart.append('<span class="chartelered" style="width: '+width+'%; height: '+height+'%;"></span>');
        }
        last = x;
    }
    lastbid = parseFloat(lastbid + "");
    firstask = parseFloat(firstask + ""); 
    $(eleid).parent().find(".bidask>.bid").html('<span class="currency">XRP</span> ' + ( lastbid == -1 ? 'N/A' : display_currency_amount(lastbid) )) ;
    $(eleid).parent().find(".bidask>.ask").html('<span class="currency">XRP</span> ' + ( firstask == -1 ? 'N/A' : display_currency_amount(firstask) ));
 
    // set these for order creation in the event of an empty book 
    if (lastbid == -1 && firstask == -1) {
        lastbid = 0.000001;
        firstask = 0.000001;
    } else if (lastbid != -1 && firstask == -1) {
        firstask = lastbid;
    } else if (firstask != -1 && lastbid == -1) {
        lastbid = firstask;
    }
    $(eleid).data('bid', display_currency_amount(lastbid));
    $(eleid).data('ask', display_currency_amount(firstask));
    // calculate exchange rate from the data we already have
    var valuationrate = 0;
    var bidcount = 0;
    for (var x in bids) bidcount++;
    for (var x in bids) if (--bidcount < 10) valuationrate += parseFloat(""+x);
    valuationrate /= 10.0;
    
    $(eleid).parent().find(".tlvaluation>.currency")[0].innerText = 'USD ' + display_currency_amount(exchangerate * tlbalance * valuationrate);
    $(eleid).parent().find(".tlvaluation").show();
}

function getOrders(account, then, then2) {
    remote.getOrders(account).then( (o) => { then(o, then2); } ).catch( (e)=> { console.log(e); then([], then2); } );
}

function getExchangeRate(currency, counterparty, then, then2) {
    if (currency == "") currency = 'USD'
    if (counterparty == "") counterparty = 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B'
	remote.getOrderbook(
		counterparty, 
		{"base": {"currency":currency, "counterparty": counterparty}, 
		"counter": {"currency":"XRP"}},  { limit: 20 }
	).then(orders => {
        var exchangerate = 0
        var divider = 0
        if (orders.bids.length > 0) {
            exchangerate += parseFloat("" + orders.bids[0].properties.makerExchangeRate)
            divider++
        }
        
        if (orders.asks.length > 0) {
            exchangerate += 1.0/parseFloat("" + orders.asks[0].properties.makerExchangeRate)
            divider++
        }
        if (divider == 0) return then(0, then2)
        return then(exchangerate/divider, then2)
    }).catch( (e)=>{
        console.log(e)
        return then(0, then2);
    });
}

// Expose functions globally
window.renderOrderbookChart = renderOrderbookChart;
window.getOrders = getOrders;
window.getExchangeRate = getExchangeRate;