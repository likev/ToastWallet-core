function clipboardCopy(data) {
    try {
        if (window.require && window.require('electron') && window.require('electron').clipboard) 
            return window.require('electron').clipboard.writeText(data);
        if (device.platform == 'browser')
            return navigator.clipboard.writeText(data);
        cordova.plugins.clipboard.copy(data);
    } catch (E) {
        console.log(E);
    }
}
function clipboardPaste(f) {
    try {
        if (window.require && window.require('electron') && window.require('electron').clipboard) 
            return f(window.require('electron').clipboard.readText());
        if (device.platform == 'browser')
            return navigator.clipboard.readText().then(f);
        cordova.plugins.clipboard.paste(f);
    } catch (E) {
        console.log(E);
    }
}

// Expose functions globally
window.clipboardCopy = clipboardCopy;
window.clipboardPaste = clipboardPaste;
