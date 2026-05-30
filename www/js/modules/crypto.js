function setPin(pin, successfunc, failfunc) {
    var salt = sodium.randombytes_buf(32);
    var hash = sodium.crypto_pwhash_scryptsalsa208sha256(32, pin, salt, 4, 33554432);
    var pindata = {
            salt: tohex_chksum(salt),
            hash: tohex_chksum(hash)
    };
    db.upsert("pindata",
            function(doc) {
            return { data: JSON.stringify(pindata)}; }).then(
            function(x){
                    successfunc();
            }).catch(function(x){
                    failfunc();
            });
}

function validatePin(pin, successfunc, failfunc, nopinsetfunc) {
    var f = function(pindata) { try {
            if (pindata.data == undefined || pindata.data == "") {
                    // this means the app has never run before.
                    return nopinsetfunc();
            } else {
                    pindata = JSON.parse(pindata.data);
                    var salt = fromhex_chksum(pindata.salt);
                    var hash;
                    if (salt.length === 16) {
                        hash = tohex_chksum(sodium.crypto_shorthash(pin, salt));
                    } else {
                        var scryptHash = sodium.crypto_pwhash_scryptsalsa208sha256(32, pin, salt, 4, 33554432);
                        hash = tohex_chksum(scryptHash);
                    }
                    if (hash == pindata.hash)
                            return successfunc();
                    return failfunc();
            } } catch(e) { handle_error(e); } };
    db.get("pindata").then(f).catch(f);
}

/* Generate a checksum and prepend it to data, returns as hex */
function tohex_chksum(data) {
	if (typeof data == 'string') data = sodium.from_string(data);
	return sodium.crypto_generichash(4, data, '', 'hex') + sodium.to_hex(data);
}

/* Remove a checksum from the front of data, check if the data matches 
** return the data if the checksum matches (as uint8array) or false
** if data does not match */
function fromhex_chksum(hex, format) {
	var chksum = hex.slice(0,8);
	var payload = sodium.from_hex(hex.slice(8));
	if (sodium.crypto_generichash(4, payload, '', 'hex') != chksum) return false;
	if (format == 'string') return sodium.to_string(payload);
	return payload;
}

function randShuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor((sodium.randombytes_buf(1)[0]/256) * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

// Expose globally
window.setPin = setPin;
window.validatePin = validatePin;
window.tohex_chksum = tohex_chksum;
window.fromhex_chksum = fromhex_chksum;
window.randShuffleArray = randShuffleArray;
