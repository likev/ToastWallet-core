function getSavedGateways(callback) {
	var f	= function(savedgateways) { try {
		if (savedgateways.data == undefined) {
			savedgateways = {};
		} else {
			savedgateways = JSON.parse(savedgateways.data);
		}
		callback(savedgateways);
	} catch(e) { handle_error(e); } }
	db.get("savedgateways").then(f).catch(f);
}

function loadSavedInterfaceSettings() {
	var f	= function(saved) { try {
		if (saved.data != undefined) {
			saved = JSON.parse(saved.data);
            interface_settings = saved
		}
	} catch(e) { handle_error(e); } }
	db.get("interfacesettings").then(f).catch(f);
}

function saveInterfaceSettings() {
    db.upsert("interfacesettings",
        function(doc) {
            return { data: JSON.stringify(interface_settings) };
        })
}

function getAccounts(callback) {
	var f	= function(secrets) { try {
		if (secrets.data == undefined) {
			secrets = {};
		} else {
			secrets = JSON.parse(secrets.data);
		}
		callback(secrets);
	} catch(e) { handle_error(e); } }
	db.get("accounts").then(f).catch(f);
}

function getAccountInfo(address, successfunc, failurefunc) {
  address = forceraddr(address)
  if (!validateAddress(address)) return failurefunc();
  var request = {
    command: 'account_info',
    account: address,
    ledger_index: 'validated'
  };
  var timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 500));
  return Promise.race([
    remote.request(request).then(res => res.result),
    timeoutPromise
  ]).then( result=> {
	if (result == undefined) return;
	if ("account_data" in result) {
        // check for trustlines and add as 'trustlines' key if found
        var get_exchange_rates = (address, result) => {
            for (var i in result.account_data['trustlines']) {
                var tl = result.account_data['trustlines'][i];
                if (tl['exchangerate'] != undefined) continue;
                var issuer = tl['specification']['counterparty'];
                var currency = tl['specification']['currency'];
                return getExchangeRate(currency, issuer, (exchangerate, data)=> {
                    data.result.account_data['trustlines'][data.index]['exchangerate'] = exchangerate;
                    return get_exchange_rates(data.address, data.result);
                }, {address: address, result: result, currency: currency, issuer: issuer, index: i} );
            }
            // execution reaching here means all the trustline exchange rates are populated
            return successfunc(result.account_data);
        }
        var t = (address, result)=>{remote.getTrustlines(address).then( 
            (trustlines) => {
                // if trustlines are present on the account attach them to the account data
                result.account_data['trustlines'] = trustlines;
                // then recursively async fetch exchange rates for the trustlines
                return get_exchange_rates(address, result);
            }
        ).catch((E)=>{
                return successfunc(result.account_data);
        });}
        remote.getSettings(address).then(
            (settings)=>{
                result.account_data['flags'] = settings;
                t(address, result);
            }
        ).catch((E)=>{
            return t(address, result);
        });
        
	} else {
		failurefunc();
	}
		  
    }).catch((e)=>{ console.log(e); failurefunc(e)});
}

function validateDataStores(funcok, funcnodata, funcdatacorrupt) {
	var saltlen = 72;
	var hashlen = 40;
	var f = function(pindata) {
		var pindatacorrupt = false;
		var pindatapresent = (pindata.data != undefined && pindata.data != "");
		if (pindatapresent) {
			try {
				pindata = JSON.parse(pindata.data);
				pindatacorrupt = 
					pindata.salt == undefined || (/[^a-fA-F0-9]/.test(pindata.salt)) || fromhex_chksum(pindata.salt) === false ||
					pindata.hash == undefined || (/[^a-fA-F0-9]/.test(pindata.hash)) || fromhex_chksum(pindata.hash) === false ;
			} catch(e) { pindatacorrupt = true; handle_error(e); }
		}
		var g = function(ppdata) {
			var ppdatacorrupt = false;
			var ppdatapresent = (ppdata.data != undefined && ppdata.data != "");
			if (ppdatapresent) {
				try {
					ppdata = JSON.parse(ppdata.data);
					ppdatacorrupt = 
						ppdata.salt1 == undefined || (/[^a-fA-F0-9]/.test(ppdata.salt1)) || fromhex_chksum(ppdata.salt1) === false || ppdata.salt1.length != saltlen ||
						ppdata.salt2 == undefined || (/[^a-fA-F0-9]/.test(ppdata.salt2)) || fromhex_chksum(ppdata.salt2) === false || ppdata.salt2.length != saltlen ||
						ppdata.hash == undefined || (/[^a-fA-F0-9]/.test(ppdata.hash)) || fromhex_chksum(ppdata.hash) === false || ppdata.hash.length != hashlen;
				} catch(e) { ppdatacorrupt = true; handle_error(e); }
			}
			var h = function(rpdata) {
				var rpdatacorrupt = false;
				var rpdatapresent = (rpdata.data != undefined && rpdata.data != "");
				if (rpdatapresent) {
					try {
						rpdata = JSON.parse(rpdata.data);
						rpdatacorrupt = 
							rpdata.salt1 == undefined || (/[^a-fA-F0-9]/.test(rpdata.salt1)) || fromhex_chksum(rpdata.salt1) === false || rpdata.salt1.length != saltlen ||
							rpdata.salt2 == undefined || (/[^a-fA-F0-9]/.test(rpdata.salt2)) || fromhex_chksum(rpdata.salt2) === false || rpdata.salt2.length != saltlen ||
							rpdata.hash == undefined || (/[^a-fA-F0-9]/.test(rpdata.hash)) || fromhex_chksum(rpdata.hash) === false || rpdata.hash.length != hashlen ||
							rpdata.erk == undefined || (/[^a-fA-F0-9]/.test(rpdata.erk)) || fromhex_chksum(rpdata.erk) === false;
					} catch(e) { rpdatacorrupt = true; handle_error(e); }
				}
				var i = function(accounts) {
					var accountscorrupt = false;
					var accountspresent = (accounts.data != undefined && accounts.data != "");
                                        try {
						accounts = JSON.parse(accounts.data);
						for (i in accounts) {
							accountscorrupt = 
							accounts[i].ppsalt == undefined || (/[^a-fA-F0-9]/.test(accounts[i].ppsalt)) || fromhex_chksum(accounts[i].ppsalt) === false || accounts[i].ppsalt.length != saltlen ||
							accounts[i].rpsalt == undefined || (/[^a-fA-F0-9]/.test(accounts[i].rpsalt)) || fromhex_chksum(accounts[i].rpsalt) === false || accounts[i].rpsalt.length != saltlen ||
							accounts[i].ppsecret == undefined || (/[^a-fA-F0-9]/.test(accounts[i].ppsecret)) || fromhex_chksum(accounts[i].ppsecret) === false || 
							accounts[i].rpsecret == undefined || (/[^a-fA-F0-9]/.test(accounts[i].rpsecret)) || fromhex_chksum(accounts[i].rpsecret) === false;
							if (accountscorrupt) break;
						}
                                        } catch(e) { if (accounts.data != "") accountscorrupt = true; handle_error(e); }
					if (pindatapresent && ppdatapresent && rpdatapresent && !pindatacorrupt && !ppdatacorrupt && !rpdatacorrupt && (!accountscorrupt || !accountspresent)) {
						funcok();
					} else if (!pindatapresent && !ppdatapresent && !rpdatapresent && !accountspresent) {
						funcnodata();
					} else {
						funcdatacorrupt( { 
							pindata : ( !pindatapresent ? "missing" : ( pindatacorrupt ? "corrupt" : "ok" ) ),
							ppdata : ( !ppdatapresent ? "missing" : ( ppdatacorrupt ? "corrupt" : "ok" ) ),
							rpdata : ( !rpdatapresent ? "missing" : ( rpdatacorrupt ? "corrupt" : "ok" ) ),
							accounts : ( !accountspresent ? "ok" : ( accountscorrupt ? "corrupt" : "ok" ) ) });
					}
					
				}
				db.get("accounts").then(i).catch(i);
			}
			db.get("rpdata").then(h).catch(h);
		}
		db.get("ppdata").then(g).catch(g);
	}
	db.get("pindata").then(f).catch(f);
}

// Expose functions globally
window.getSavedGateways = getSavedGateways;
window.loadSavedInterfaceSettings = loadSavedInterfaceSettings;
window.saveInterfaceSettings = saveInterfaceSettings;
window.getAccounts = getAccounts;
window.getAccountInfo = getAccountInfo;
window.validateDataStores = validateDataStores;
