function clipboardCopy(data) {
    try {
        return navigator.clipboard.writeText(data);
    } catch (E) {
        console.log(E);
    }
}
function clipboardPaste(f) {
    try {
        return navigator.clipboard.readText().then(f);
    } catch (E) {
        console.log(E);
    }
}

// Expose functions globally
window.clipboardCopy = clipboardCopy;
window.clipboardPaste = clipboardPaste;
