'use strict';

let clipboardClearTimeout = null;

function fallbackCopyText(text) {
    if (typeof document === 'undefined') return false;
    let textArea;
    let succeeded = false;
    const activeElement = document.activeElement;
    try {
        textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, text.length);
        succeeded = document.execCommand('copy');
    } catch (err) {
        console.warn('fallbackCopyText error:', err);
    } finally {
        if (textArea) {
            try {
                textArea.value = '';
            } catch (e) {}
            if (textArea.parentNode) {
                textArea.parentNode.removeChild(textArea);
            }
        }
        if (activeElement && typeof activeElement.focus === 'function') {
            activeElement.focus();
        }
    }
    return succeeded;
}

function clearClipboard() {
    if (clipboardClearTimeout) {
        clearTimeout(clipboardClearTimeout);
        clipboardClearTimeout = null;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        const isSecure = typeof window !== 'undefined' ? (window.isSecureContext ?? true) : true;
        if (isSecure) {
            return navigator.clipboard.writeText('').catch(function() {
                fallbackCopyText('');
            });
        }
    }
    fallbackCopyText('');
    return Promise.resolve();
}

function copySecretWithWarning(secret, warningMessage, autoClearSeconds) {
    if (autoClearSeconds === undefined || autoClearSeconds === null) autoClearSeconds = 30;
    const msg = warningMessage || "Account secret copied to clipboard.\n\nWARNING: Copied secrets are accessible to clipboard managers and sync services. Toast Wallet will automatically attempt to clear your clipboard in " + autoClearSeconds + " seconds.";

    return clipboardCopy(secret).then(function() {
        if (typeof navigator !== 'undefined' && navigator.notification && typeof navigator.notification.alert === 'function') {
            navigator.notification.alert(msg, function() {}, "Copied (Security Warning)", "OK");
        } else if (typeof alert === 'function') {
            alert(msg);
        }
        if (clipboardClearTimeout) clearTimeout(clipboardClearTimeout);
        if (autoClearSeconds > 0) {
            clipboardClearTimeout = setTimeout(function() {
                clearClipboard();
            }, autoClearSeconds * 1000);
        }
    });
}

function clipboardCopy(data) {
    const text = String(data ?? '');
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        const isSecure = typeof window !== 'undefined' ? (window.isSecureContext ?? true) : true;
        if (isSecure) {
            return navigator.clipboard.writeText(text).catch(function (err) {
                console.warn('navigator.clipboard.writeText failed, falling back to execCommand:', err);
                fallbackCopyText(text);
            });
        }
    }
    fallbackCopyText(text);
    return Promise.resolve();
}

function clipboardPaste(f) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        return navigator.clipboard.readText()
            .then(function (text) {
                if (typeof f === 'function') {
                    f(text);
                }
            })
            .catch(function (err) {
                console.warn('navigator.clipboard.readText failed or permission denied:', err);
            });
    }
    return Promise.resolve();
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.clipboardCopy = clipboardCopy;
    window.clipboardPaste = clipboardPaste;
    window.clearClipboard = clearClipboard;
    window.copySecretWithWarning = copySecretWithWarning;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { clipboardCopy, clipboardPaste, fallbackCopyText, clearClipboard, copySecretWithWarning };
}
