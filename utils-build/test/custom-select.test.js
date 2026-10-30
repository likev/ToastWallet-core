'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Minimal mock DOM for testing custom-select module in node:test
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
        this.dataset = {};
        this.listeners = new Map();
        this.value = '';
        this.selectedIndex = 0;
        this.options = [];
        this._textContent = '';
    }

    closest(sel) {
        let cur = this;
        while (cur) {
            if (sel.startsWith('.') && cur.classList && cur.classList.contains(sel.slice(1))) return cur;
            if (sel.startsWith('#') && cur.id === sel.slice(1)) return cur;
            if (cur.tagName && cur.tagName.toLowerCase() === sel.toLowerCase()) return cur;
            cur = cur.parentNode;
        }
        return null;
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

    setAttribute(k, v) {
        this.attributes.set(k, String(v));
    }
    getAttribute(k) {
        return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    removeAttribute(k) {
        this.attributes.delete(k);
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

    insertBefore(newNode, refNode) {
        newNode.parentNode = this;
        const childIdx = this.childNodes.indexOf(refNode);
        if (childIdx === -1) {
            this.childNodes.push(newNode);
        } else {
            this.childNodes.splice(childIdx, 0, newNode);
        }

        if (newNode.nodeType === 1) {
            const elIdx = this.children.indexOf(refNode);
            if (elIdx === -1) {
                this.children.push(newNode);
            } else {
                this.children.splice(elIdx, 0, newNode);
            }
        }
        return newNode;
    }

    removeChild(child) {
        const childIdx = this.childNodes.indexOf(child);
        if (childIdx !== -1) {
            this.childNodes.splice(childIdx, 1);
        }
        const elIdx = this.children.indexOf(child);
        if (elIdx !== -1) {
            this.children.splice(elIdx, 1);
        }
        child.parentNode = null;
        return child;
    }

    replaceChildren(...nodes) {
        this.childNodes = [];
        this.children = [];
        for (const n of nodes) {
            this.appendChild(n);
        }
    }

    get nextSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.childNodes.indexOf(this);
        return idx >= 0 && idx < this.parentNode.childNodes.length - 1 ? this.parentNode.childNodes[idx + 1] : null;
    }

    querySelector(sel) {
        const res = this.querySelectorAll(sel);
        return res.length > 0 ? res[0] : null;
    }

    querySelectorAll(sel) {
        const results = [];
        const match = (el) => {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                return el.classList.contains(cls);
            }
            if (sel.startsWith('#')) {
                const id = sel.slice(1);
                return el.id === id;
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

class MockTextNode {
    constructor(text) {
        this.nodeType = 3;
        this.textContent = String(text);
        this.parentNode = null;
    }
}

function createMockEnvironment() {
    const doc = {
        body: new MockElement('body'),
        createElement: (tag) => {
            const el = new MockElement(tag);
            return el;
        },
        createTextNode: (text) => new MockTextNode(text),
        querySelector: (sel) => doc.body.querySelector(sel),
        querySelectorAll: (sel) => doc.body.querySelectorAll(sel),
        addEventListener: () => {},
        removeEventListener: () => {}
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
        xaddr: (acc) => 'X' + acc,
        dispaddr: (acc) => acc.slice(0, 8) + '...',
        hashicon: (addr, size) => {
            const c = doc.createElement('canvas');
            c.width = size;
            c.height = size;
            return c;
        }
    };

    return { doc, win };
}

function setupGlobalEnv(mockEnv) {
    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;
    const prevEvent = globalThis.Event;

    globalThis.document = mockEnv.doc;
    globalThis.window = mockEnv.win;
    globalThis.Event = mockEnv.win.Event;

    return () => {
        if (prevDoc !== undefined) globalThis.document = prevDoc; else delete globalThis.document;
        if (prevWin !== undefined) globalThis.window = prevWin; else delete globalThis.window;
        if (prevEvent !== undefined) globalThis.Event = prevEvent; else delete globalThis.Event;
    };
}

test('custom-select: enhances select with trigger, dropdown, options and aria attrs', () => {
    const mockEnv = createMockEnvironment();
    const cleanup = setupGlobalEnv(mockEnv);

    try {
        const { enhanceSelect, closeAllCustomSelects, destroySelect } = require('../../www/js/modules/custom-select.js');

        const select = mockEnv.doc.createElement('select');
        select.id = 'testselect';
        mockEnv.doc.body.appendChild(select);

        for (let i = 0; i < 5; i++) {
            const opt = mockEnv.doc.createElement('option');
            opt.value = 'val_' + i;
            opt.textContent = 'Option ' + i;
            select.appendChild(opt);
            select.options.push(opt);
        }
        select.value = 'val_0';
        select.selectedIndex = 0;

        enhanceSelect(select);

        assert.ok(select.classList.contains('cs-native-hidden'), 'Native select must be hidden');
        assert.equal(select.getAttribute('tabindex'), '-1', 'Native select tabindex must be -1');

        const container = mockEnv.doc.querySelector('.custom-select-container');
        assert.ok(container, 'Container element must be inserted into DOM');

        const trigger = container.querySelector('.custom-select-trigger');
        assert.ok(trigger, 'Trigger must exist');
        assert.equal(trigger.getAttribute('aria-haspopup'), 'listbox');
        assert.equal(trigger.getAttribute('aria-expanded'), 'false');

        const label = trigger.querySelector('.custom-select-label');
        assert.equal(label.textContent, 'Option 0');

        const options = container.querySelectorAll('.custom-select-option');
        assert.equal(options.length, 5, 'Must render 5 option elements');
        assert.ok(options[0].classList.contains('cs-selected'), 'First option must have cs-selected');

        // Cleanup
        destroySelect(select);
        assert.ok(!mockEnv.doc.querySelector('.custom-select-container'), 'Container removed on destroy');
        assert.ok(!select.classList.contains('cs-native-hidden'), 'Native select restored');
    } finally {
        cleanup();
    }
});

test('custom-select: option click updates select value and dispatches change', () => {
    const mockEnv = createMockEnvironment();
    const cleanup = setupGlobalEnv(mockEnv);

    try {
        const { enhanceSelect, destroySelect } = require('../../www/js/modules/custom-select.js');

        const select = mockEnv.doc.createElement('select');
        select.id = 'clickselect';
        mockEnv.doc.body.appendChild(select);

        ['Apple', 'Banana', 'Cherry'].forEach((fruit, idx) => {
            const opt = mockEnv.doc.createElement('option');
            opt.value = fruit.toLowerCase();
            opt.textContent = fruit;
            select.appendChild(opt);
            select.options.push(opt);
        });
        select.value = 'apple';
        select.selectedIndex = 0;

        let changeFired = false;
        select.addEventListener('change', () => {
            changeFired = true;
        });

        enhanceSelect(select);

        const container = mockEnv.doc.querySelector('.custom-select-container');
        const options = container.querySelectorAll('.custom-select-option');

        // Click Banana (idx 1)
        options[1].dispatchEvent(new mockEnv.win.Event('click'));

        assert.equal(select.value, 'banana', 'select.value updated');
        assert.equal(select.selectedIndex, 1, 'select.selectedIndex updated');
        assert.ok(changeFired, 'change event was dispatched');

        const label = container.querySelector('.custom-select-label');
        assert.equal(label.textContent, 'Banana');

        destroySelect(select);
    } finally {
        cleanup();
    }
});

test('custom-select: search input filters options when options >= 10', () => {
    const mockEnv = createMockEnvironment();
    const cleanup = setupGlobalEnv(mockEnv);

    try {
        const { enhanceSelect, destroySelect } = require('../../www/js/modules/custom-select.js');

        const select = mockEnv.doc.createElement('select');
        select.id = 'searchselect';
        mockEnv.doc.body.appendChild(select);

        const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'NZD', 'SEK', 'XRP'];
        currencies.forEach(cur => {
            const opt = mockEnv.doc.createElement('option');
            opt.value = cur;
            opt.textContent = cur + ' Currency';
            select.appendChild(opt);
            select.options.push(opt);
        });
        select.value = 'USD';
        select.selectedIndex = 0;

        enhanceSelect(select);

        const container = mockEnv.doc.querySelector('.custom-select-container');
        const searchInput = container.querySelector('.custom-select-search-input');
        assert.ok(searchInput, 'Search input must exist for >= 10 items');

        // Filter for "xrp"
        searchInput.value = 'xrp';
        searchInput.dispatchEvent(new mockEnv.win.Event('input'));

        const options = container.querySelectorAll('.custom-select-option');
        const visibleOptions = options.filter(opt => opt.style.display !== 'none');
        assert.equal(visibleOptions.length, 1, 'Only 1 visible option after search');
        assert.ok(visibleOptions[0].textContent.includes('XRP'));

        // Filter for nonexistent "ZZZ"
        searchInput.value = 'ZZZ';
        searchInput.dispatchEvent(new mockEnv.win.Event('input'));

        const noMatch = container.querySelector('.cs-no-match');
        assert.ok(noMatch, 'No match element must appear');
        assert.equal(noMatch.style.display, '', 'No match element must be displayed');

        destroySelect(select);
    } finally {
        cleanup();
    }
});

test('custom-select: payfromaccount renders accselect2 with hashicon avatar', () => {
    const mockEnv = createMockEnvironment();
    const cleanup = setupGlobalEnv(mockEnv);

    try {
        const { enhanceSelect, destroySelect } = require('../../www/js/modules/custom-select.js');

        const select = mockEnv.doc.createElement('select');
        select.id = 'payfromaccount';
        mockEnv.doc.body.appendChild(select);

        const testAddr = 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y';
        const opt = mockEnv.doc.createElement('option');
        opt.value = testAddr;
        opt.textContent = testAddr;
        opt.dataset.account = testAddr;
        select.appendChild(opt);
        select.options.push(opt);

        select.value = testAddr;
        select.selectedIndex = 0;

        enhanceSelect(select);

        const container = mockEnv.doc.querySelector('.custom-select-container');
        const label = container.querySelector('.custom-select-label');
        const accSpan = label.querySelector('.accselect2');
        assert.ok(accSpan, 'Label must contain .accselect2 span');

        const canvas = accSpan.querySelector('canvas');
        assert.ok(canvas, 'accselect2 span must contain canvas hashicon');
        assert.equal(canvas.width, 20);

        destroySelect(select);
    } finally {
        cleanup();
    }
});

test('custom-select: setSelectVisible toggles container and select display', () => {
    const mockEnv = createMockEnvironment();
    const cleanup = setupGlobalEnv(mockEnv);

    try {
        const { enhanceSelect, setSelectVisible, destroySelect } = require('../../www/js/modules/custom-select.js');

        const select = mockEnv.doc.createElement('select');
        select.id = 'visibleselect';
        mockEnv.doc.body.appendChild(select);

        const opt = mockEnv.doc.createElement('option');
        opt.value = '1';
        opt.textContent = 'One';
        select.appendChild(opt);
        select.options.push(opt);

        enhanceSelect(select);
        const container = mockEnv.doc.querySelector('.custom-select-container');

        setSelectVisible(select, false);
        assert.equal(container.style.display, 'none');
        assert.equal(select.style.display, 'none');

        setSelectVisible(select, true);
        assert.equal(container.style.display, '');
        assert.equal(select.style.display, '');

        destroySelect(select);
    } finally {
        cleanup();
    }
});
