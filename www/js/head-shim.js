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
    $("#inputblocker").show();
    if (noloading == undefined || (noloading != undefined && !noloading)) $('body').addClass('liteloading');
}
function unblockInput() {
    $("#inputblocker").hide();
    $('body').removeClass('liteloading');
}
var setupcompletedthissession = false;

window.onerror = function(message, url, lineNumber) {  
    if ((message + "").startsWith("Uncaught, unspecified")) return; // not entirely sure what this error is but it seems to happen very occasionally when switching back after inactivity and doesn't seem to affect behaviour 
    x = "We're sorry: An unexpected error has occured with Toast Wallet. Please report the below to support@toastwallet.com along with what you were trying to do at the time the error occured. If you haven't already it would be prudent to make a backup of your wallet. You may need to restart Toast Wallet by closing it manually. " + message + " " + url + " " + lineNumber;
    console.log("Error: `" + message + "`, url: " + url + " line: " + lineNumber);
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
            $('#gracefulerror').html('<center><h1>Unexpected Error</h1></center><br><div>' + x + '</div><br><center><div><button class="btn btn-primary" onclick="$(\'#gracefulerror\').css(\'display\', \'none\');">Close Error</button>');
            $('#gracefulerror').css('display', 'block');
            unblockInput();
        } catch (EE){}
    }
}
