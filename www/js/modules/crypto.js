function getScryptParamsForVersion(version) {
    if (version === 2) {
        return { opsLimit: 524288, memLimit: 16777216 };
    }
    return { opsLimit: 4, memLimit: 33554432 };
}

function setPin(pin, successfunc, failfunc) {
    var salt = sodium.randombytes_buf(32);
    var p = getScryptParamsForVersion(2);
    var hash = sodium.crypto_pwhash_scryptsalsa208sha256(32, pin, salt, p.opsLimit, p.memLimit);
    var pindata = {
            version: 2,
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
                    if (!salt) return failfunc();
                    var hash;
                    if (salt.length === 16) {
                        // Legacy 16-byte-salt SipHash PIN. Verify first, then transparently re-store as 32-byte-salt scrypt v2.
                        hash = tohex_chksum(sodium.crypto_shorthash(pin, salt));
                        if (hash == pindata.hash) {
                            // Guard against normalboot()'s validatePin("", ...) startup probe.
                            if (pin !== "") {
                                try {
                                    return setPin(pin,
                                        function() {
                                            if (typeof debug !== 'undefined' && debug) console.log("validatePin: upgraded legacy PIN to scrypt v2");
                                            successfunc();
                                        },
                                        function() {
                                            console.warn("validatePin: legacy PIN upgrade write failed; will retry next unlock");
                                            successfunc();
                                        });
                                } catch (upgradeErr) {
                                    console.warn("validatePin: legacy PIN upgrade threw; will retry next unlock");
                                    return successfunc();
                                }
                            }
                            return successfunc();
                        }
                        return failfunc();
                    } else {
                        var p = getScryptParamsForVersion(pindata.version);
                        var scryptHash = sodium.crypto_pwhash_scryptsalsa208sha256(32, pin, salt, p.opsLimit, p.memLimit);
                        hash = tohex_chksum(scryptHash);
                    }
                    if (hash == pindata.hash) {
                        if (pindata.version !== 2 && pin !== "") {
                            try {
                                return setPin(pin,
                                    function() {
                                        if (typeof debug !== 'undefined' && debug) console.log("validatePin: upgraded legacy scrypt PIN to v2");
                                        successfunc();
                                    },
                                    function() {
                                        console.warn("validatePin: v2 PIN upgrade write failed; will retry next unlock");
                                        successfunc();
                                    });
                            } catch (upgradeErr) {
                                return successfunc();
                            }
                        }
                        return successfunc();
                    }
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
window.getScryptParamsForVersion = getScryptParamsForVersion;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setPin,
        validatePin,
        tohex_chksum,
        fromhex_chksum,
        randShuffleArray,
        getScryptParamsForVersion
    };
}
