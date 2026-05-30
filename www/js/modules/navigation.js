function selectAccountDetailsSubTab(tabele, subtabname) {
    $('.accdetailsinnertabselected').removeClass('accdetailsinnertabselected');
    $(tabele).addClass('accdetailsinnertabselected');
    if (subtabname == 'address') {
        $('#accdetailstransactiondetails').hide(); 
        $('#accdetailstrustlinedetails').hide(); 
        $('#accdetailsaddressdetails').show();
    } else if (subtabname == 'trustlines') {
        $('#accdetailstransactiondetails').hide(); 
        $('#accdetailstrustlinedetails').show(); 
        $('#accdetailsaddressdetails').hide();
        refreshTrustlines(activeaccount);
    } else if (subtabname == 'transactions') {
        $('#accdetailstransactiondetails').show(); 
        $('#accdetailstrustlinedetails').hide(); 
        $('#accdetailsaddressdetails').hide();
        checkConnection(()=>{doGetTransactions($('#accdetailsaddress').data('content'), '');  renderMoreContentIndicator(); });
    }
    renderMoreContentIndicator();
}

function showSpinner(msg) {
	if (debug) console.log("showSpinner");
	$("body").addClass("loading");
}

function hideSpinner() {
	if (debug) console.log("hideSpinner");
	$("body").removeClass("loading");
}

function showTab(tab, dontClearText) {
    // while a link is pending we will handle it as soon as we can
    if (tab == '#tablogin') {
        // once booting and/or wallet setup has finished we want to start processing paylinks
        can_accept_paylink = true    
        // show the prompt
        if (paylink_pending)
            $('#tablogin>center>div').addClass('pinpad_pending')
    } else if (paylink_pending) { 
        handleOpenURL(paylink_pending)
    }
    
	if (tab == currenttab) return;
    try {
        $('select').select2('close')
    } catch(e) {}
    if (dontClearText == undefined) dontClearText = false;
	blockInput(true);
	if (debug) console.log("showTab(" + tab + ")");
	document.activeElement.blur();
	$(".pinpad").removeClass("shake");
	enteredpin = ""; renderEnteredPin();
	
	$("#morecontentindicator").removeClass("moreindicatorabovenav");
	$("#morecontentindicator").removeClass("moreindicatordark");
    $("#accsecret").val('');
    $("#accsecret").data('content', '');
    $("#accsecretqr").empty();
	$("#accsecret").hide();
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
   
    	$("input[type='password']").val("");
        $("input[type='text']").val("");
        $("textarea").val("");
        $('#paytabredqr').empty();
        $('#atltabredqr').empty();
        $('#mtltabredqr').empty();
        $('#paytabgreenqr').empty();
        $('.fa-toggle-on').addClass('fa-toggle-off').removeClass('fa-toggle-on');
    }
    reset_xrbtns()        
    $("#navheader").show();
	
	if (tab == -1) {
		// unwind mode
		if (previoustabs.length == 0) {
			unblockInput();
			return; // cannot unwind so do nothing
		}
		tab = currenttab = previoustabs.pop();
        if (tab == '#tabaccountflags' && validateAddress($('#cafaddress').text())) {
            showAccountFlags($('#cafaddress').text(), true);
        }
	} else {
		//windup mode
		previoustabs.push(currenttab);
		currenttab = tab;
	}
	if ($(tab).data('primarytab')) previoustabs = [];
	if (tab != "#tabqrscan" && scanner != undefined) {
		scanner.stop();
	}
    if (tab == "#tabpayments" && !dontClearText) {
            clearPaymentScreen();
    } else if (tab == "#tabaccounts") {
        if ( !dontClearText ) {
           // $('#payasset').html('<option id="optpa-xrp" data-asset="XRP" data-issuer="">XRP</option>');
            refreshAccounts( onPaymentSelectFromAccount );	
        }
	} else if (tab == "#tabaccountsecret") {
        $("#divrsecaccpassword").show();
		$("#lblacpassword").show();
		$("#lblaccsecret").hide();
		$("#btnrevealsecret").show();
		$("#rsecaccpassword").show();
		$("#btncopysecret").hide();
		$("#accsecret").hide();
    } else if (tab == '#tabaddtrustline' && offlinemode) {
        var account = $("#atladdress").data('content');
        $("#atltabredqr").empty();
        $("#atltabredqr").append(kjua({text: account, fill:"#ff0000"}));    
        $('#atlofflinecodediv').css('display', 'block')
    } else if (tab == '#tabmodifytrustline' && offlinemode) {
        var account = $("#mtladdress").data('content');
        $("#mtltabredqr").empty();
        $("#mtltabredqr").append(kjua({text: account, fill:"#ff0000"}));    
        $('#mtlofflinecodediv').css('display', 'block')
    } else if (tab == '#tabaccountflags' && offlinemode) {
        var account = $("#afaddress").data('content');
        $("#aftabredqr").empty();
        $("#aftabredqr").append(kjua({text: account, fill:"#ff0000"}));    
        $('#afofflinecodediv').css('display', 'block');
        $('#afoflwarningdiv').css('display', 'block');
    }
	if (tab == '#tabpayments') {
		var to = $('#toaddress').val();
		if (to == 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y') {
			$('#toaddress').css('background-color', 'rgba(92, 184, 104, 0.63)');
			$('#toaddress').css('color', 'white');
			$('#toaddress').attr('readonly', 'readonly');
			$('.btnqrpay').attr('disabled', 'disabled');
            $('.btnqrpay').removeAttr('ontouchend');
		} else {
			$('#toaddress').css('background-color', '');
			$('#toaddress').css('color', '');
			$('#toaddress').attr('readonly', null);
			$('.btnqrpay').removeAttr('disabled');
            $('#btnqrpay1').attr('ontouchend', "te(event, ()=>{scanQR((x)=>{populatePaymentTabFromURI(x, '#toaddress')} )})");
            $('#btnqrpay2').attr('ontouchend', "te(event, ()=>{clipboardPaste((content)=>{populatePaymentTabFromURI(content, '#toaddress')})})");
		}
	}
	if (tab == '#tabaccounts') {
 
		var donorreminder = function() {
			getLastDonation(function(donation) {
                if(setupcompletedthissession) return; // no point asking people who just set up the wallet to donate
                if (('' + device.platform).toLowerCase() == 'android') return; // no point pestering people who can't donate because Google is evil
				if ('lastdonation' in donation && Math.floor(new Date().getTime()/1000) - parseInt(donation['lastdonation']) < 15552000 /* 180 days */) {
					// do nothing
					return;
				}
				if (!('lastreminder' in donation) ||  Math.floor(new Date().getTime()/1000) - parseInt(donation['lastreminder']) > 604800 /* 1 week */ ) {
					// reminder
					
					donation['lastreminder'] = "" + Math.floor(new Date().getTime()/1000);
					db.upsert("lastdonated",
						function(doc) {
						return { data: JSON.stringify(donation)	}; 
					}).then( function() {
						showDonationTab();
					})
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
	var tabs = $(".screentab");
	for (var i = 0; i < tabs.length; i++) $("#" + tabs[i].id).hide();
    try {
        $(tab + ' select').select2({templateResult:formatSelect2, templateSelection:formatSelect2})
    } catch(e) {}
    select2EventProxy()
    //clean up stray dropdown
    if (offlinemode) 
        try {
            $("#payasset").select2('destroy')
        } catch (e) {}
    $(tab).show();
    if (tab != '#tabaccounts') $(tab).scrollTop(0);
    if ($(tab).data('hasback') && previoustabs.length > 0 && 
            !( currenttab == '#tabpayments' && previoustabs.length == 1 && (previoustabs[0] == '#tabaccounts' || previoustabs[0] == '#tabsettings' ) )
    ) {
        console.log("previous tabs: "); console.log(previoustabs);
		$(".headerleft").html('<i class="fa fa-chevron-left" aria-hidden="true"></i>');
		$(".headerleft").off();
		$(".headerleft").on('touchstart', function() {showTab(-1);});
		if ((device.platform + "").toLowerCase() == 'browser') $(".headerleft").on('click', function() {showTab(-1);});
		$(".headerleft").show();
	} else {
		$(".headerleft").empty();
		$(".headerleft").off();
	}
	if ($(tab).data('title')) {
		$(".headermiddle").html('<div>' + $(tab).data('title') + "</div>");
	} else {
		$(".headermiddle").empty();
	}
	if ($(tab).data('recovery')) { // set recovery icon for logged out tabs
		$(".headerright").show();
                $("#navfooter").hide();
                $(".headerright>i").removeClass("fa-lock");
                $(".headerright>i").addClass("fa-medkit");
                $(".headerright").off();
                $(".headerright").on('touchend', function(){ showTab("#tabrecovery"); });
                if ((device.platform + "").toLowerCase() == 'browser') $(".headerright").on('click', function(){ showTab("#tabrecovery"); });
	} else if ($(tab).data('noright')) {
                $(".headerright").hide();
                $("#navfooter").hide();
    } else { // set logout icon for logged in tabs
        		$(".headerright").show();
                $("#navfooter").show();
                $(".headerright>i").removeClass("fa-medkit");
                $(".headerright>i").addClass("fa-lock");
                $(".headerright").off();
                $(".headerright").on('touchend', function(){ doShowLogin(); });
                if ((device.platform + "").toLowerCase() == 'browser') $(".headerright").on('click', function(){ doShowLogin(); });
	        $("#morecontentindicator").addClass("moreindicatorabovenav");
    }	
	$("body").removeClass("darkbackground");
	$("body").removeClass("darkbackground2");
	if ($(tab).data('dark')) { // dark background
		if ($(tab).data('dark') == '2') {
			$("body").addClass("darkbackground2");
		} else {
			$("body").addClass("darkbackground");
		}
	} else {
		$("#morecontentindicator").addClass("moreindicatordark");
	}
	renderMoreContentIndicator();
	// make sure the values of various input boxes are set correctly before displaying
	var inputs = $(currenttab + " input");
	for (var i = 0; i < inputs.length; i++) {
		var ele = $('#' + inputs[i].id);
        if (!ele || !ele.data || !ele.val) continue;
        var content = ele.data('content');
        var isaddress = ele.data('dispaddr')
		if (content != undefined) ele.val(isaddress ? dispaddr(content) : content);
	}
	
	
	if ((device.platform + "").toLowerCase() == 'browser') {
		clickProxy();
	}
	setTimeout(unblockInput, 200);
}

// Expose functions globally
window.selectAccountDetailsSubTab = selectAccountDetailsSubTab;
window.showSpinner = showSpinner;
window.hideSpinner = hideSpinner;
window.showTab = showTab;
