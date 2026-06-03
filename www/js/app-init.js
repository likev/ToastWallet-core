debug = true;
ontestnet = false;
emergencybackup = false;
offlinemode = false;
toastepoc = 36225052; // this is the ledger seq number from which toast wallet bases its offline tx qr codes
if (ontestnet) toastepoc = 0;
xrpreserve = 20; // this will be updated by querying the server when it connects, if there's an error getting this data the default will be used
timepaused = 0;

// this variable is set to true at the end of all boot and wallet setup, ie at the first login screen
can_accept_paylink = false
// contains all interface settings like whether or not to use x-addresses by default
// and which currency to display in
interface_settings = {
    valuation_counterparty: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', // bitstamp is default
    valuation_currency: 'USD',
    display_xaddresses: false
}
// given an address sitting in an inputgroup, if the button is placed in the input group the 
// address in the first input box in the group will be swapped with the r or X address
// depending on what's currently there
// arguments:
//  e - touch event
//  qrtoupdate - optional; a QR code id to update
//  after - optional; function to execute after, passed the src element and target input box
//  dt - optional; destination tag
//  ignoreprefix - optional, a string to match at the start and dis/recard
function xrbtn_press(e, qrtoupdate, after, dt, ignoreprefix) {
    console.log('xrbtn_press')
    console.log(e)
    if (dt == undefined || typeof(dt) == 'string' && parseInt(dt)+'' != dt.replace(/\s/, '').replace(/\s/g,''))
        dt = false

    var e = e.srcElement
    var src = e
    var t = e.getElementsByClassName('addrtype')[0]
    if (!t) t = e.parentElement.getElementsByClassName('addrtype')[0]
    while(e && !e.classList.contains('input-group'))
        e = e.parentElement
    if (!e || !(e = e.getElementsByTagName('input')[0]) || !t)
        return
    var val = e.value
    if (typeof(ignoreprefix) == 'string' && e.value.substr(0, ignoreprefix.length) == ignoreprefix)
        val = e.value.substr(ignoreprefix.length)
    else
        ignoreprefix = ''
    e.value = ignoreprefix + (val.substr(0,1) == 'X' ? 
        ($(t).text('x'), raddr(val).raddr) : 
        ($(t).text('r'), xaddr(val, dt))) 

    if (qrtoupdate) {
        $(qrtoupdate).empty();
        $(qrtoupdate).append(kjua({text: e.value}));
    }
    if (after) after(src, e, val)
}
// update all xr btns to reflect current interface setting
// but if the input box contains the other type of address use that info instead
function reset_xrbtns() {
    var xrbtns = $('.xrbtn .addrtype')
    for (var i = 0; i < xrbtns.length; ++i) {
        var e = xrbtns[i]
        while(e && !e.classList.contains('input-group'))
            e = e.parentElement
        if (!e || !(e = e.getElementsByTagName('input')[0]))
            return
        var xr = interface_settings.display_xaddresses ? 'r' : 'x'
        var prefix = e.value.length > 0 ? e.value.substr(0,1) : ''
        if (prefix) xr = ( prefix  == 'X' ? 'r' : 'x' )        
        xrbtns[i].innerText = xr
    }
}
function refreshWebView() {
}
function renderMoreContentIndicator() {
    if (debug) console.log("renderMoreContentIndicator()");
    if (currenttab == "") return;
    if ($(currenttab)[0].scrollHeight - $(currenttab).scrollTop() - $(currenttab).outerHeight() < 10) {
        $("#morecontentindicator").hide();
    } else {
        if (!nativekeyboardvisible) $("#morecontentindicator").show();
    }
    if (nativekeyboardvisible) $("#morecontentindicator").hide();
}
function quickSelectInput(e) {
    if (e == undefined) return;
    try {
        $('select').select2('close')
    } catch(e) {}
    $(e).focus();
}
function stopClick(e) {
    e.stopPropagation();
    e.preventDefault();
    return false;
}
// this is a function the deep link handlers on android and ios search for
function handleOpenURL(link, e) {                 
    console.log("incoming pay-link: " + link);
    paylink_pending = link;
    $('#tablogin>center>div').addClass('pinpad_pending')
    if (
        currenttab == "#tabpinset1" || 
        currenttab == "#tabpinset2"  || 
        currenttab == "#tabsetpassphrase" || 
        currenttab == "#tabrecovery" || 
        currenttab == "#tabconnectionselect" || 
        currenttab == "#tabbackupreminder" || 
        currenttab == "#tabcorruptionprompt" ||
        currenttab == "#tablicense" ||
        currenttab == "#tabshowrecovery" ||
        currenttab == "#tabqrscan" ||
        currenttab == "#tabsubmitofflinetx" ||
        currenttab == "#tabrestore2" ||
        currenttab == "#tabgreenqr" ) {
        console.log("will not interrupt pin or passphrase or backup prompt, storing pay link"); 
        return;
    }
    
    if (e == 'boot' || !can_accept_paylink || $('#tablogin').is(":visible")) {
        // do nothing 
    } else {
        // wallet is open so go to payment page immediately
        doPayLink();
    }
}
function openExternalUrl(url) {
    try {
        return window.open(url, '_blank')
    } catch (E) {
        console.log(E);
    }
}
// finds the first label above a control, returns the input element if label can't be found
function find_label(ele) {
    var original_ele = ele;
    if (!ele) return ele;
    try {
        var totaliter = 0;
        if (ele.is('label')) return ele;
        var first = true;
        do {
            if (!first) ele = ele.parent(); else first = false;
            if (ele.is('label')) return ele;
            while (ele.prev().length > 0) {
                ele = ele.prev();
                if (ele.is('label')) return ele;
                if (totaliter++ > 100) return original_ele;
            }
        } while(ele.parent().length > 0);
    } catch (E) {
        return original_ele
    }
}
nativekeyboardvisible = false;
prekeyboardscrollpos = 0;
function afterCordovaLoad()  {
    if (debug) console.log("afterCordovaLoad");
    $('.deviceversion').text(navigator.userAgent);
    try {
        if (window.screen && window.screen.orientation && typeof window.screen.orientation.lock === 'function') {
            window.screen.orientation.lock('portrait').catch(function(e) {
                console.log("Screen orientation lock rejected: " + e);
            });
        }
    } catch(e) {
        console.log("Screen orientation lock not supported: " + e);
    }

    $(".screentab").scroll(renderMoreContentIndicator);
    var morecontentfunc;
    $("#morecontentindicator").on("touchstart", morecontentfunc = function() {
        if (debug) console.log("onTouchStartMoreContent()");
        if (currenttab == "") return;
        $(currenttab).animate({ scrollTop: $(currenttab)[0].scrollHeight }, "fast");
        renderMoreContentIndicator();
        return false;
    });

    /* This is a visual patch for iOS devices where the phone uses a margin at the top
    ** for various status indicators. 
    */
    console.log("User agent: " + navigator.userAgent);
    if (debug) console.log("afterCordovaLoad:2");
    document.addEventListener("pause", function(){
        if (debug) console.log("onPause");
        document.activeElement.blur();
            if (debug) console.log("onPause - record time");
            timepaused = $.now();
    }, false);
    document.addEventListener("resume", function() {
        if (debug) console.log("onResume");
           
        if (
            currenttab != "#tabpinset1" && 
            currenttab != "#tabpinset2"  && 
            currenttab != "#tabsetpassphrase" && 
            currenttab != "#tabrecovery" && 
            currenttab != "#tabconnectionselect" && 
            currenttab != "#tabbackupreminder" && 
            currenttab != "#tabcorruptionprompt" &&
            currenttab != "#tablicense" &&
            currenttab != "#tabshowrecovery" &&
            currenttab != "#tabqrscan" &&
            currenttab != "#tabsubmitofflinetx" &&
            currenttab != "#tabrestore2" &&
            currenttab != "#tabgreenqr" &&
            $.now() - timeatlastQR > 30 /* this fixes a bug with android */
        ) {
            if ($.now() - timepaused > 30000) {
                unblockInput();
                doShowLogin();
            }
        }
    });
    var toggleswitchfunc;
    $(".toggleswitch").on('click',toggleswitchfunc = function(e) {
        if (debug) console.log("onToggleSwitch()");
        var ele; 
        var _this;
        if (inClickProxy && e.srcElement != undefined) {
            ele = $($(e.srcElement).children()[0]);
            _this = $(e.srcElement);
        } else {
            ele = $($(this).children()[0]);
            _this = $(this);
        }
        var allowunknown = _this.data('allowunknown');
        
        if (!ele) return;
        if (ele.hasClass("unknowntoggle")) {
            ele.removeClass("unknowntoggle");
            ele.addClass("fa-toggle-off");
            _this.data("checked", "false");
        } else if (ele.hasClass("fa-toggle-off")) {
            ele.removeClass("fa-toggle-off");
            ele.addClass("fa-toggle-on");
            _this.data("checked", "true");
        } else {
            if (allowunknown == undefined || allowunknown == false) {
                ele.removeClass("fa-toggle-on");
                ele.addClass("fa-toggle-off");
                _this.data("checked", "false");
            } else {
                ele.removeClass("fa-toggle-on");
                ele.addClass("unknowntoggle");
                _this.data("checked", "unknown");
            }
        }
        if (_this.data('after') != undefined) {
            var f = _this.data('after');
            if (typeof(f) == "string") {
                var funcName = f.replace(/[\(\);\s]/g, "");
                if (funcName && typeof window[funcName] === "function") {
                    window[funcName]();
                }
            } else if (typeof(f) == "function") {
                f(_this);
            }
        }
    });

    $('#navheader').on('cut copy paste',
            function(e){
                if (debug) console.log("onHeaderCopyCutPaste()");
                e.preventDefault();
            });
    $('#navfooter').on('cut copy paste',function(e){
                if (debug) console.log("onFooterCopyCutPaste()");
                e.preventDefault();
            });
    if (ontestnet) $('#testnetwarning').show();
    var paylink_handler = function(e,s) {
        var link = s.replace(/^.*?:\/\//g, "");
        handleOpenURL(link, e);
    };
    // since we're booting, if the wallet was started with a pay link we need to process that now
    if (typeof(document.location) == 'object' && typeof(document.location.search) == 'string') {
        console.log("paylink passed on boot: " + document.location.search);
        var pieces = document.location.search.split("?paylink=");
        if (pieces.length > 1) {
            var decodedLink = '';
            try {
                decodedLink = decodeURIComponent(pieces[1].replace(/\s+/g, '').replace(/[0-9a-f]{2}/g, '%$&'));
            } catch (err) {
                for (var i = 0; i < pieces[1].length; i += 2) {
                    decodedLink += String.fromCharCode(parseInt(pieces[1].substr(i, 2), 16));
                }
            }
            paylink_handler("boot", decodedLink);
        }
    }
}

// Expose functions globally
window.handleOpenURL = handleOpenURL;
window.openExternalUrl = openExternalUrl;
window.stopClick = stopClick;
window.afterCordovaLoad = afterCordovaLoad;
