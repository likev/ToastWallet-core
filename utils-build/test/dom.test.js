'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

class MockClassList {
    constructor(el) {
        this._el = el;
    }
    _classes() {
        return (this._el.className || '').trim().split(/\s+/).filter(Boolean);
    }
    add(...cls) {
        const classes = new Set(this._classes());
        cls.forEach(c => classes.add(c));
        this._el.className = Array.from(classes).join(' ');
    }
    remove(...cls) {
        const classes = new Set(this._classes());
        cls.forEach(c => classes.delete(c));
        this._el.className = Array.from(classes).join(' ');
    }
    contains(c) {
        return this._classes().includes(c);
    }
}

class MockElement {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.nodeType = 1;
        this.id = '';
        this.className = '';
        this.classList = new MockClassList(this);
        this.attributes = new Map();
        this.children = [];
        this.childNodes = [];
        this.parentNode = null;
        this.style = {};
        this.listeners = new Map();
        this.value = '';
        this._textContent = '';
        this._innerHTML = '';
        this.offsetWidth = 100;
        this.offsetHeight = 50;
    }

    _matches(sel) {
        if (sel.startsWith('.') && this.classList && this.classList.contains(sel.slice(1))) return true;
        if (sel.startsWith('#') && this.id === sel.slice(1)) return true;
        if (this.tagName && this.tagName.toLowerCase() === sel.toLowerCase()) return true;
        if (sel.startsWith('[') && sel.endsWith(']')) {
            const attrName = sel.slice(1, -1);
            return this.hasAttribute(attrName);
        }
        return false;
    }

    closest(sel) {
        const parts = sel.includes(',') ? sel.split(',').map(s => s.trim()) : [sel.trim()];
        let cur = this;
        while (cur) {
            for (const part of parts) {
                if (cur._matches(part)) return cur;
            }
            cur = cur.parentNode;
        }
        return null;
    }

    hasAttribute(k) {
        return this.attributes.has(k);
    }
    setAttribute(k, v) {
        this.attributes.set(k, String(v));
    }
    getAttribute(k) {
        return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    removeAttribute(k) {
        this.attributes.delete(k);
    }

    get textContent() {
        if (this.childNodes.length > 0) {
            return this.childNodes.map(c => c.textContent || '').join('');
        }
        return this._textContent;
    }
    set textContent(val) {
        this._textContent = String(val);
        this.childNodes = [];
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML || this.textContent;
    }
    set innerHTML(val) {
        this._innerHTML = String(val);
        this._textContent = String(val);
    }

    addEventListener(event, fn) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(fn);
    }
    removeEventListener(event, fn) {
        if (!this.listeners.has(event)) return;
        const list = this.listeners.get(event).filter(f => f !== fn);
        this.listeners.set(event, list);
    }
    dispatchEvent(event) {
        if (!event.target) event.target = this;
        if (!event.srcElement) event.srcElement = this;
        const handlers = this.listeners.get(event.type) || [];
        for (const handler of handlers) {
            handler.call(this, event);
        }
        return true;
    }

    appendChild(child) {
        child.parentNode = this;
        this.childNodes.push(child);
        if (child.nodeType === 1) {
            this.children.push(child);
        }
        return child;
    }

    replaceChildren(...nodes) {
        this.childNodes = [];
        this.children = [];
        for (const n of nodes) {
            this.appendChild(n);
        }
    }

    querySelector(sel) {
        const res = this.querySelectorAll(sel);
        return res.length > 0 ? res[0] : null;
    }

    querySelectorAll(sel) {
        const results = [];
        const match = (el) => {
            if (sel.startsWith('.')) {
                return el.classList.contains(sel.slice(1));
            }
            if (sel.startsWith('#')) {
                return el.id === sel.slice(1);
            }
            if (sel.toLowerCase() === el.tagName.toLowerCase()) {
                return true;
            }
            return false;
        };

        const traverse = (parent) => {
            for (const child of parent.children) {
                if (match(child)) results.push(child);
                traverse(child);
            }
        };
        traverse(this);
        return results;
    }
}

function createMockDom() {
    const listeners = new Map();
    const doc = {
        body: new MockElement('body'),
        createElement: (tag) => new MockElement(tag),
        getElementById: (id) => {
            if (doc.body.id === id) return doc.body;
            return doc.body.querySelector('#' + id);
        },
        querySelector: (sel) => doc.body.querySelector(sel),
        querySelectorAll: (sel) => doc.body.querySelectorAll(sel),
        addEventListener: (event, fn, opts) => {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(fn);
        },
        removeEventListener: (event, fn) => {
            if (!listeners.has(event)) return;
            listeners.set(event, listeners.get(event).filter(f => f !== fn));
        },
        dispatchEvent: (event) => {
            const handlers = listeners.get(event.type) || [];
            for (const h of handlers) h(event);
            return true;
        }
    };

    const win = {
        document: doc,
        Event: class {
            constructor(type, opts = {}) {
                this.type = type;
                this.bubbles = !!opts.bubbles;
                this.target = null;
            }
            stopPropagation() {}
            preventDefault() {}
        },
        CustomEvent: class {
            constructor(type, opts = {}) {
                this.type = type;
                this.bubbles = !!opts.bubbles;
                this.cancelable = !!opts.cancelable;
                this.target = null;
            }
            stopPropagation() {}
            preventDefault() {}
        },
        getComputedStyle: (el) => {
            // Simulate stylesheet rule .screentab { display: none; }
            if (el.classList && el.classList.contains('screentab') && !el.style.display) {
                return { display: 'none', visibility: 'visible' };
            }
            return { display: el.style.display || 'block', visibility: 'visible' };
        }
    };

    return { doc, win };
}

function setupDomGlobals(mockEnv) {
    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;
    const prevEvent = globalThis.Event;
    const prevCustomEvent = globalThis.CustomEvent;

    globalThis.document = mockEnv.doc;
    globalThis.window = mockEnv.win;
    globalThis.Event = mockEnv.win.Event;
    globalThis.CustomEvent = mockEnv.win.CustomEvent;

    return () => {
        if (prevDoc !== undefined) globalThis.document = prevDoc; else delete globalThis.document;
        if (prevWin !== undefined) globalThis.window = prevWin; else delete globalThis.window;
        if (prevEvent !== undefined) globalThis.Event = prevEvent; else delete globalThis.Event;
        if (prevCustomEvent !== undefined) globalThis.CustomEvent = prevCustomEvent; else delete globalThis.CustomEvent;
    };
}

test('dom: byId, qs, qsa selection and null-tolerance', () => {
    const mockEnv = createMockDom();
    const cleanup = setupDomGlobals(mockEnv);

    try {
        const { byId, qs, qsa } = require('../../www/js/modules/dom.js');

        const div = mockEnv.doc.createElement('div');
        div.id = 'myid';
        div.className = 'myclass item';
        mockEnv.doc.body.appendChild(div);

        assert.equal(byId('myid'), div);
        assert.equal(byId('#myid'), div);
        assert.equal(byId('nonexistent'), null);
        assert.equal(byId(null), null);

        assert.equal(qs('#myid'), div);
        assert.equal(qs('.myclass'), div);
        assert.equal(qs(null), null);

        const items = qsa('.item');
        assert.equal(items.length, 1);
        assert.equal(items[0], div);
        assert.deepEqual(qsa(null), []);
    } finally {
        cleanup();
    }
});

test('dom: domData stores live JS function references (Trap #1)', () => {
    const mockEnv = createMockDom();
    const cleanup = setupDomGlobals(mockEnv);

    try {
        const { domData, removeDomData } = require('../../www/js/modules/dom.js');

        const tgl = mockEnv.doc.createElement('i');
        tgl.id = 'testtgl';
        mockEnv.doc.body.appendChild(tgl);

        let callbackCalled = false;
        const callbackFn = (arg) => {
            callbackCalled = arg;
        };

        // Store function reference
        domData(tgl, 'after', callbackFn);

        // Retrieve and execute
        const retrieved = domData(tgl, 'after');
        assert.equal(typeof retrieved, 'function', 'Must preserve live Function reference');
        retrieved(true);
        assert.equal(callbackCalled, true, 'Function reference must be executable');

        removeDomData(tgl, 'after');
        assert.equal(domData(tgl, 'after'), undefined);
    } finally {
        cleanup();
    }
});

test('dom: domData coerces data-allowunknown="false" to boolean false (Trap #1)', () => {
    const mockEnv = createMockDom();
    const cleanup = setupDomGlobals(mockEnv);

    try {
        const { domData } = require('../../www/js/modules/dom.js');

        const tgl = mockEnv.doc.createElement('i');
        tgl.setAttribute('data-allowunknown', 'false');
        tgl.setAttribute('data-hours', '24');
        mockEnv.doc.body.appendChild(tgl);

        const allowUnknown = domData(tgl, 'allowunknown');
        assert.strictEqual(allowUnknown, false, 'Must coerce "false" to boolean false');
        assert.equal(allowUnknown == false, true, 'Loose equality with boolean false must hold');

        const hours = domData(tgl, 'hours');
        assert.strictEqual(hours, 24, 'Must coerce numeric string to number');
    } finally {
        cleanup();
    }
});

test('dom: showEl restores stylesheet-hidden .screentab to "block" (Trap #2)', () => {
    const mockEnv = createMockDom();
    const cleanup = setupDomGlobals(mockEnv);

    try {
        const { showEl, hideEl } = require('../../www/js/modules/dom.js');

        const tab = mockEnv.doc.createElement('div');
        tab.id = 'tabaccounts';
        tab.className = 'screentab'; // hidden by stylesheet rule
        mockEnv.doc.body.appendChild(tab);

        // Initially stylesheet says display: none
        assert.equal(mockEnv.win.getComputedStyle(tab).display, 'none');

        // showEl must detect getComputedStyle is 'none' and set inline display to 'block'
        showEl(tab);
        assert.equal(tab.style.display, 'block', 'showEl must assign defaultDisplayMap for DIV');

        // hideEl sets display: none
        hideEl(tab);
        assert.equal(tab.style.display, 'none');
    } finally {
        cleanup();
    }
});

test('dom: isVisible correctly evaluates visibility (Trap #3)', () => {
    const mockEnv = createMockDom();
    const cleanup = setupDomGlobals(mockEnv);

    try {
        const { isVisible, hideEl, showEl } = require('../../www/js/modules/dom.js');

        const el = mockEnv.doc.createElement('div');
        el.id = 'box';
        mockEnv.doc.body.appendChild(el);

        assert.equal(isVisible(el), true);

        hideEl(el);
        assert.equal(isVisible(el), false);

        showEl(el);
        assert.equal(isVisible(el), true);

        assert.equal(isVisible(null), false);
        assert.equal(isVisible(undefined), false);
    } finally {
        cleanup();
    }
});

test('dom: null-tolerant operations do not throw (Trap #5)', () => {
    const mockEnv = createMockDom();
    const cleanup = setupDomGlobals(mockEnv);

    try {
        const dom = require('../../www/js/modules/dom.js');

        assert.doesNotThrow(() => {
            dom.showEl(null);
            dom.hideEl('#nonexistent');
            dom.toggleEl(null);
            dom.getVal(null);
            dom.setVal('#nonexistent', 'foo');
            dom.getText(null);
            dom.setText(null, 'foo');
            dom.getHtml(null);
            dom.setHtml('#nonexistent', '<b>bar</b>');
            dom.emptyEl(null);
            dom.appendHtml(null, '<div></div>');
            dom.appendNode(null, null);
            dom.addClass(null, 'active');
            dom.removeClass('#nonexistent', 'active');
            dom.hasClass(null, 'active');
            dom.setDisabled(null, true);
            dom.domData(null, 'foo');
            dom.removeDomData(null, 'foo');
        });
    } finally {
        cleanup();
    }
});

test('dom: initTouchClickBridge delegates clicks and synthesizes touch events (Trap #4)', () => {
    const mockEnv = createMockDom();
    const cleanup = setupDomGlobals(mockEnv);

    try {
        const { initTouchClickBridge, _resetBridgeForTesting } = require('../../www/js/modules/dom.js');
        if (_resetBridgeForTesting) _resetBridgeForTesting();
        initTouchClickBridge();

        const btn = mockEnv.doc.createElement('button');
        btn.setAttribute('ontouchend', 'te(event, fn)');
        mockEnv.doc.body.appendChild(btn);

        const icon = mockEnv.doc.createElement('i');
        icon.className = 'fa fa-copy';
        btn.appendChild(icon);

        let touchEndDispatched = false;
        let inClickProxyDuringDispatch = null;
        btn.addEventListener('touchend', (e) => {
            touchEndDispatched = true;
            inClickProxyDuringDispatch = mockEnv.win.inClickProxy;
        });

        // Click event on child icon inside button
        let stoppedPropagation = false;
        let preventedDefault = false;
        const clickEvent = new mockEnv.win.Event('click', { bubbles: true });
        clickEvent.stopPropagation = () => { stoppedPropagation = true; };
        clickEvent.preventDefault = () => { preventedDefault = true; };
        clickEvent.target = icon;
        mockEnv.doc.dispatchEvent(clickEvent);

        assert.equal(touchEndDispatched, true, 'Desktop click on child icon must synthesize touchend on [ontouchend] target');
        assert.equal(inClickProxyDuringDispatch, true, 'window.inClickProxy must be true during synthetic dispatch');
        assert.equal(mockEnv.win.inClickProxy, false, 'window.inClickProxy must be reset to false after dispatch');
        assert.equal(stoppedPropagation, true, 'Click event stopPropagation must be called');
        assert.equal(preventedDefault, true, 'Click event preventDefault must be called');
    } finally {
        cleanup();
    }
});
