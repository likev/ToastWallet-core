if (typeof navigator.notification === 'undefined') {
    navigator.notification = {
        alert: function(message, alertCallback, title, buttonName) {
            window.alert(message);
            if (typeof alertCallback === 'function') {
                alertCallback();
            }
        },
        confirm: function(message, confirmCallback, title, buttonLabels) {
            var result = window.confirm(message);
            if (typeof confirmCallback === 'function') {
                confirmCallback(result ? 1 : 2);
            }
        }
    };
}

if (window.module) module = window.module;

function blockInput(noloading) {
    var ib = document.getElementById("inputblocker");
    if (ib) ib.style.display = "block";
    if (noloading == undefined || !noloading) {
        if (document.body) document.body.classList.add('liteloading');
    }
}

function unblockInput() {
    var ib = document.getElementById("inputblocker");
    if (ib) ib.style.display = "none";
    if (document.body) document.body.classList.remove('liteloading');
}

var setupcompletedthissession = false;

window.onerror = function(message, url, lineNumber) {  
    if ((message + "").startsWith("Uncaught, unspecified")) return; // not entirely sure what this error is but it seems to happen very occasionally when switching back after inactivity and doesn't seem to affect behaviour 
    var x = "We're sorry: An unexpected error has occured with Toast Wallet. Please report the below to support@toastwallet.com along with what you were trying to do at the time the error occured. If you haven't already it would be prudent to make a backup of your wallet. You may need to restart Toast Wallet by closing it manually. " + String(message).slice(0, 120).replace(/s[1-9A-HJ-NP-Za-km-z]{24,}/g, "[redacted]") + " (line " + lineNumber + ")";
    if (typeof debug !== "undefined" && debug) console.log("Error: `" + message + "`, url: " + url + " line: " + lineNumber);
    try {
        navigator.notification.alert(x, 
            function(){
                unblockInput();
            }, 
            "Unexpected Error", 
            "OK"
        );
    } catch (E) {
        try {
            var ge = document.getElementById('gracefulerror');
            if (ge) {
                if (typeof ge.replaceChildren === 'function') {
                    ge.replaceChildren();
                } else {
                    ge.innerHTML = '';
                }
                var center1 = document.createElement('center');
                var h1 = document.createElement('h1');
                h1.textContent = 'Unexpected Error';
                center1.appendChild(h1);
                var divMsg = document.createElement('div');
                divMsg.textContent = x;
                var center2 = document.createElement('center');
                var divBtn = document.createElement('div');
                var btn = document.createElement('button');
                btn.className = 'btn btn-primary';
                btn.textContent = 'Close Error';
                btn.onclick = function() {
                    ge.style.display = 'none';
                };
                divBtn.appendChild(btn);
                center2.appendChild(divBtn);
                ge.appendChild(center1);
                ge.appendChild(document.createElement('br'));
                ge.appendChild(divMsg);
                ge.appendChild(document.createElement('br'));
                ge.appendChild(center2);
                ge.style.display = 'block';
            }
            unblockInput();
        } catch (EE){}
    }
};
