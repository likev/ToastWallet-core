'use strict';

function selectAccountDetailsSubTab(tabele, subtabname) {
    removeClass('.accdetailsinnertabselected', 'accdetailsinnertabselected');
    addClass(tabele, 'accdetailsinnertabselected');
    if (subtabname == 'address') {
        hideEl('#accdetailstransactiondetails'); 
        hideEl('#accdetailstrustlinedetails'); 
        showEl('#accdetailsaddressdetails');
    } else if (subtabname == 'trustlines') {
        hideEl('#accdetailstransactiondetails'); 
        showEl('#accdetailstrustlinedetails'); 
        hideEl('#accdetailsaddressdetails');
        refreshTrustlines(activeaccount);
    } else if (subtabname == 'transactions') {
        showEl('#accdetailstransactiondetails'); 
        hideEl('#accdetailstrustlinedetails'); 
        hideEl('#accdetailsaddressdetails');
        checkConnection(() => {
            doGetTransactions(domData('#accdetailsaddress', 'content'), '');
            renderMoreContentIndicator();
        });
    }
    renderMoreContentIndicator();
}

function showSpinner(msg) {
    if (debug) console.log("showSpinner");
    addClass("body", "loading");
}

function hideSpinner() {
    if (debug) console.log("hideSpinner");
    removeClass("body", "loading");
}

function showTab(tab, dontClearText) {
    // while a link is pending we will handle it as soon as we can
    if (tab == '#tablogin') {
        // once booting and/or wallet setup has finished we want to start processing paylinks
        can_accept_paylink = true;
        // show the prompt
        if (paylink_pending)
            addClass('#tablogin>center>div', 'pinpad_pending');
    } else if (paylink_pending) { 
        handleOpenURL(paylink_pending);
    }
    
    if (tab == currenttab) return;
    try {
        if (typeof closeAllCustomSelects === 'function') closeAllCustomSelects();
    } catch(e) {}
    if (dontClearText == undefined) dontClearText = false;
    blockInput(true);
    if (debug) console.log("showTab(" + tab + ")");
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    removeClass(".pinpad", "shake");
    enteredpin = "";
    renderEnteredPin();
    
    removeClass("#morecontentindicator", "moreindicatorabovenav");
    removeClass("#morecontentindicator", "moreindicatordark");
    setVal("#accsecret", '');
    domData("#accsecret", 'content', '');
    emptyEl("#accsecretqr");
    hideEl("#accsecret");
    if ( tab == -1 && (
        currenttab == '#tabqrscan' || currenttab == '#taborderconfirm' || 
        currenttab == '#tabneworder' || currenttab == '#tabpaymentconfirm' ||
        currenttab == '#tabtrustlineconfirm'
    )) {
        // if the user has gone for a QR scan we dont want to wipe their form.
        // we also make a special exception allowing a market order to go backward from confirmation
        dontClearText = true;
    }
    if (!dontClearText) {
        setVal("input[type='password']", "");
        setVal("input[type='text']", "");
        setVal("textarea", "");
        emptyEl('#paytabredqr');
        emptyEl('#atltabredqr');
        emptyEl('#mtltabredqr');
        emptyEl('#paytabgreenqr');
        const togglesOn = qsa('.fa-toggle-on');
        for (const tgl of togglesOn) {
            addClass(tgl, 'fa-toggle-off');
            removeClass(tgl, 'fa-toggle-on');
        }
    }
    reset_xrbtns();
    showEl("#navheader");
    
    if (tab == -1) {
        // unwind mode
        if (previoustabs.length == 0) {
            unblockInput();
            return; // cannot unwind so do nothing
        }
        tab = currenttab = previoustabs.pop();
        if (tab == '#tabaccountflags' && validateAddress(getText('#cafaddress'))) {
            showAccountFlags(getText('#cafaddress'), true);
        }
    } else {
        //windup mode
        previoustabs.push(currenttab);
        currenttab = tab;
    }
    if (domData(tab, 'primarytab')) previoustabs = [];
    if (tab != "#tabqrscan" && scanner != undefined) {
        scanner.stop();
    }
    if (tab == "#tabpayments" && !dontClearText) {
        clearPaymentScreen();
    } else if (tab == "#tabaccounts") {
        if (!dontClearText) {
            refreshAccounts(onPaymentSelectFromAccount);	
        }
    } else if (tab == "#tabaccountsecret") {
        showEl("#divrsecaccpassword");
        showEl("#lblacpassword");
        hideEl("#lblaccsecret");
        showEl("#btnrevealsecret");
        showEl("#rsecaccpassword");
        hideEl("#btncopysecret");
        hideEl("#accsecret");
    } else if (tab == '#tabaddtrustline' && offlinemode) {
        var account = domData("#atladdress", 'content');
        emptyEl("#atltabredqr");
        appendNode("#atltabredqr", kjua({text: account, fill:"#ff0000"}));    
        showEl('#atlofflinecodediv');
    } else if (tab == '#tabmodifytrustline' && offlinemode) {
        var account = domData("#mtladdress", 'content');
        emptyEl("#mtltabredqr");
        appendNode("#mtltabredqr", kjua({text: account, fill:"#ff0000"}));    
        showEl('#mtlofflinecodediv');
    } else if (tab == '#tabaccountflags' && offlinemode) {
        var account = domData("#afaddress", 'content');
        emptyEl("#aftabredqr");
        appendNode("#aftabredqr", kjua({text: account, fill:"#ff0000"}));    
        showEl('#afofflinecodediv');
        showEl('#afoflwarningdiv');
    }
    if (tab == '#tabpayments') {
        var to = getVal('#toaddress');
        var toEl = byId('toaddress');
        if (to == 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y') {
            if (toEl) {
                toEl.style.backgroundColor = 'rgba(92, 184, 104, 0.63)';
                toEl.style.color = 'white';
                toEl.setAttribute('readonly', 'readonly');
            }
            setDisabled('.btnqrpay', true);
            removeAttr('.btnqrpay', 'ontouchend');
        } else {
            if (toEl) {
                toEl.style.backgroundColor = '';
                toEl.style.color = '';
                toEl.removeAttribute('readonly');
            }
            setDisabled('.btnqrpay', false);
            setAttr('#btnqrpay1', 'ontouchend', "te(event, ()=>{scanQR((x)=>{populatePaymentTabFromURI(x, '#toaddress')} )})");
            setAttr('#btnqrpay2', 'ontouchend', "te(event, ()=>{clipboardPaste((content)=>{populatePaymentTabFromURI(content, '#toaddress')})})");
        }
    }
    if (tab == '#tabaccounts') {
        var donorreminder = function() {
            getLastDonation(function(donation) {
                if (setupcompletedthissession) return; // no point asking people who just set up the wallet to donate
                if ('lastdonation' in donation && Math.floor(new Date().getTime()/1000) - parseInt(donation['lastdonation']) < 15552000 /* 180 days */) {
                    return;
                }
                if (!('lastreminder' in donation) || Math.floor(new Date().getTime()/1000) - parseInt(donation['lastreminder']) > 604800 /* 1 week */ ) {
                    donation['lastreminder'] = "" + Math.floor(new Date().getTime()/1000);
                    db.upsert("lastdonated", function(doc) {
                        return { data: JSON.stringify(donation) }; 
                    }).then(function() {
                        showDonationTab();
                    });
                }
            });
        };
        getAccounts(function(acc) {
            var acccount = 0;
            for (var i in acc) acccount++;
            if (debug) console.log("number of accounts: " + acccount);
            if (acccount > 0) {
                getLastBackupReminder(function(backupreminder) {
                    if (!('lastreminder' in backupreminder)) {
                        showBackupReminderTab();
                    } else {
                        donorreminder();
                    }
                });
            } else {
                donorreminder();
            }
        });
    }
    hideEl(".screentab");
    try {
        if (typeof enhanceSelect === 'function') {
            document.querySelectorAll(tab + ' select').forEach((el) => enhanceSelect(el));
        }
    } catch(e) {}
    // clean up stray dropdown
    if (offlinemode) {
        try {
            if (typeof destroySelect === 'function') destroySelect('#payasset');
        } catch (e) {}
    }
    showEl(tab);
    if (tab != '#tabaccounts') {
        const tabEl = resolveElement(tab);
        if (tabEl) tabEl.scrollTop = 0;
    }
    const headerLeft = qs('.headerleft');
    if (domData(tab, 'hasback') && previoustabs.length > 0 && 
            !( currenttab == '#tabpayments' && previoustabs.length == 1 && (previoustabs[0] == '#tabaccounts' || previoustabs[0] == '#tabsettings' ) )
    ) {
        console.log("previous tabs: "); console.log(previoustabs);
        if (headerLeft) {
            headerLeft.innerHTML = '<i class="fa fa-chevron-left" aria-hidden="true"></i>';
            headerLeft.onclick = function() { showTab(-1); };
            showEl(headerLeft);
        }
    } else if (headerLeft) {
        emptyEl(headerLeft);
        headerLeft.onclick = null;
    }
    const headerMiddle = qs('.headermiddle');
    if (headerMiddle) {
        const title = domData(tab, 'title');
        if (title) {
            headerMiddle.innerHTML = '<div>' + title + '</div>';
        } else {
            emptyEl(headerMiddle);
        }
    }
    const headerRight = qs('.headerright');
    const headerRightIcon = qs('.headerright>i');
    if (domData(tab, 'recovery')) { // set recovery icon for logged out tabs
        showEl(headerRight);
        hideEl("#navfooter");
        if (headerRightIcon) {
            removeClass(headerRightIcon, "fa-lock");
            addClass(headerRightIcon, "fa-medkit");
        }
        if (headerRight) {
            headerRight.onclick = function(){ showTab("#tabrecovery"); };
        }
    } else if (domData(tab, 'noright')) {
        hideEl(headerRight);
        hideEl("#navfooter");
    } else { // set logout icon for logged in tabs
        showEl(headerRight);
        showEl("#navfooter");
        if (headerRightIcon) {
            removeClass(headerRightIcon, "fa-medkit");
            addClass(headerRightIcon, "fa-lock");
        }
        if (headerRight) {
            headerRight.onclick = function(){ doShowLogin(); };
        }
        addClass("#morecontentindicator", "moreindicatorabovenav");
    }	
    removeClass("body", "darkbackground", "darkbackground2");
    const darkVal = domData(tab, 'dark');
    if (darkVal) { // dark background
        if (darkVal == '2' || darkVal === 2) {
            addClass("body", "darkbackground2");
        } else {
            addClass("body", "darkbackground");
        }
    } else {
        addClass("#morecontentindicator", "moreindicatordark");
    }
    renderMoreContentIndicator();
    // make sure the values of various input boxes are set correctly before displaying
    var inputs = qsa(currenttab + " input");
    for (var i = 0; i < inputs.length; i++) {
        var ele = inputs[i];
        if (!ele) continue;
        var content = domData(ele, 'content');
        var isaddress = domData(ele, 'dispaddr');
        if (content != undefined) ele.value = isaddress ? dispaddr(content) : content;
    }
    
    clickProxy();
    setTimeout(unblockInput, 200);
}

function rebindAllHandlers() {}
function clickProxy() {}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.selectAccountDetailsSubTab = selectAccountDetailsSubTab;
    window.showSpinner = showSpinner;
    window.hideSpinner = hideSpinner;
    window.showTab = showTab;
    window.rebindAllHandlers = rebindAllHandlers;
    window.clickProxy = clickProxy;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        selectAccountDetailsSubTab,
        showSpinner,
        hideSpinner,
        showTab,
        rebindAllHandlers,
        clickProxy
    };
}
