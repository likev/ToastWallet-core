function xaddr(raddr, tag) {
	try {
		return xrpl.classicAddressToXAddress(raddr, tag, false);
	} catch (e) {
		return false;
	}
}
function raddr(xaddr) {
	try {
		var res = xrpl.xAddressToClassicAddress(xaddr);
		return {raddr: res.classicAddress, tag: res.tag};
	} catch (e) {
		return false;
	}
}
function isXAddress(x) {
    try {
        var r = raddr(x)
        return true
    } catch (e) {}
    return false
}
//if the address is an x-address, converts to an r-address and uses the dtag in the x-address
//if the address is an r-address and dt is a valid integer returns the same structure populated with these
// return value = { raddr: "rdfasdfa...", tag: false|integer }
function forceraddrtag(x, dt) {
    if (!x || typeof(x) != 'string') return false
    
    var tag = false
    if (typeof(dt) == 'string') {
        try { 
            var pdt = parseInt(dt + '') 
            tag = ( pdt + '' == (dt + '').trim() ? pdt : false )
        } catch (e) {}
    } else if (typeof(dt) == 'number') {
        tag = dt
    }
    if (tag) tag = Math.round(tag)
    
    if (tag > 0xffffffff || tag < 0) tag = false
    if (xrpl.isValidClassicAddress(x)) return { raddr: x, tag: tag }
    if (x.substr(0,1) == 'X') {
        try {
            var r = raddr(x)
            return (xrpl.isValidClassicAddress(r.raddr) ? r : false)
        } catch (e) {}
    }
    // execution should never reach here
    return false
}
function forceraddr(x) {
    x = forceraddrtag(x)
    if (x && x.raddr) return x.raddr
    return false
}
// display an address according to the current interface settings
function dispaddr(x, dt) {
    if (x.substr(0,1) == 'r' && interface_settings.display_xaddresses) return xaddr(x, (dt == undefined ? false : dt))
    if (x.substr(0,1) == 'X' && !interface_settings.display_xaddresses) return raddr(x).raddr
    return x
}
function truncaddr(x) {
    if (x.length > 33) return x.substr(0, 30) + '...'
    return x
}
function validateAddress(x) {
    return forceraddr(x) !== false
}
function validateSecret(x) {
	try {
		xrpl.deriveAddress(
			xrpl.deriveKeypair(x).publicKey
		); 
	} catch(e) { return false; }
	return true;
}

// Expose functions globally
window.xaddr = xaddr;
window.raddr = raddr;
window.isXAddress = isXAddress;
window.forceraddrtag = forceraddrtag;
window.forceraddr = forceraddr;
window.dispaddr = dispaddr;
window.truncaddr = truncaddr;
window.validateAddress = validateAddress;
window.validateSecret = validateSecret;
