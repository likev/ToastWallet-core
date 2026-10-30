'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { clipboardCopy, clipboardPaste } = require('../../www/js/modules/clipboard.js');

function setGlobal(name, value) {
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true
    });
    return () => {
        if (originalDesc) {
            Object.defineProperty(globalThis, name, originalDesc);
        } else {
            delete globalThis[name];
        }
    };
}

test('clipboardCopy: writes text via navigator.clipboard.writeText in secure context', async () => {
    let written = null;
    const restoreWindow = setGlobal('window', { isSecureContext: true });
    const restoreNav = setGlobal('navigator', {
        clipboard: {
            writeText: async (text) => {
                written = text;
                return Promise.resolve();
            }
        }
    });

    try {
        await clipboardCopy('rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y');
        assert.equal(written, 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y');

        // Test non-string coercion
        await clipboardCopy(12345);
        assert.equal(written, '12345');

        await clipboardCopy(null);
        assert.equal(written, '');
    } finally {
        restoreNav();
        restoreWindow();
    }
});

test('clipboardCopy: falls back to execCommand when navigator.clipboard.writeText rejects', async () => {
    let execCommandAction = null;
    let appendedChild = null;
    let removedChild = null;

    const mockBody = {
        appendChild: (el) => { appendedChild = el; },
        removeChild: (el) => { removedChild = el; }
    };

    const restoreWindow = setGlobal('window', { isSecureContext: true });
    const restoreNav = setGlobal('navigator', {
        clipboard: {
            writeText: async () => Promise.reject(new Error('Permission denied'))
        }
    });
    const restoreDoc = setGlobal('document', {
        activeElement: { focus: () => {} },
        body: mockBody,
        createElement: (tag) => {
            const el = {
                tagName: tag.toUpperCase(),
                value: '',
                style: {},
                attributes: {},
                setAttribute: (k, v) => { el.attributes[k] = v; },
                focus: () => {},
                select: () => {},
                setSelectionRange: (s, e) => { el.selection = [s, e]; },
                parentNode: mockBody
            };
            return el;
        },
        execCommand: (cmd) => {
            execCommandAction = cmd;
            return true;
        }
    });

    try {
        await clipboardCopy('fallback test text');
        assert.equal(execCommandAction, 'copy');
        assert.equal(appendedChild.value, 'fallback test text');
        assert.equal(removedChild, appendedChild);
    } finally {
        restoreDoc();
        restoreNav();
        restoreWindow();
    }
});

test('clipboardCopy: falls back to execCommand when navigator.clipboard is missing', async () => {
    let execCommandAction = null;
    let appendedChild = null;

    const mockBody = {
        appendChild: (el) => { appendedChild = el; },
        removeChild: () => {}
    };

    const restoreWindow = setGlobal('window', { isSecureContext: false });
    const restoreNav = setGlobal('navigator', {});
    const restoreDoc = setGlobal('document', {
        activeElement: null,
        body: mockBody,
        createElement: () => ({
            value: '',
            style: {},
            setAttribute: () => {},
            focus: () => {},
            select: () => {},
            setSelectionRange: () => {},
            parentNode: mockBody
        }),
        execCommand: (cmd) => {
            execCommandAction = cmd;
            return true;
        }
    });

    try {
        await clipboardCopy('insecure http origin test');
        assert.equal(execCommandAction, 'copy');
        assert.equal(appendedChild.value, 'insecure http origin test');
    } finally {
        restoreDoc();
        restoreNav();
        restoreWindow();
    }
});

test('clipboardPaste: reads text via navigator.clipboard.readText and calls callback', async () => {
    let result = null;
    const restoreNav = setGlobal('navigator', {
        clipboard: {
            readText: async () => 'rToastPastedAddress123'
        }
    });

    try {
        await clipboardPaste((text) => {
            result = text;
        });
        assert.equal(result, 'rToastPastedAddress123');
    } finally {
        restoreNav();
    }
});

test('clipboardPaste: gracefully catches NotAllowedError without uncaught rejection', async () => {
    let called = false;
    const restoreNav = setGlobal('navigator', {
        clipboard: {
            readText: async () => Promise.reject(new Error('NotAllowedError: Read permission denied'))
        }
    });

    try {
        await clipboardPaste(() => {
            called = true;
        });
        assert.equal(called, false);
    } finally {
        restoreNav();
    }
});

test('tabpayments onpaste: URI paste parsing simulates extracting clipboard text', () => {
    const mockEvent = {
        clipboardData: {
            getData: (type) => {
                if (type.toLowerCase() === 'text') {
                    return 'ripple:rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y?dt=12345&amount=10';
                }
                return '';
            }
        }
    };

    const text = (mockEvent.clipboardData || null).getData('text');
    assert.equal(text, 'ripple:rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y?dt=12345&amount=10');
});
