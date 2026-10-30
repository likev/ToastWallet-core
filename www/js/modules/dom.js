'use strict';

const elementDataMap = new WeakMap();

const defaultDisplayMap = {
    DIV: 'block',
    P: 'block',
    UL: 'block',
    OL: 'block',
    LI: 'list-item',
    TABLE: 'table',
    TR: 'table-row',
    TD: 'table-cell',
    TH: 'table-cell',
    TBODY: 'table-row-group',
    THEAD: 'table-header-group',
    BUTTON: 'inline-block',
    SPAN: 'inline',
    A: 'inline',
    I: 'inline',
    B: 'inline',
    STRONG: 'inline',
    EM: 'inline',
    INPUT: 'inline-block',
    SELECT: 'inline-block',
    TEXTAREA: 'inline-block',
    IMG: 'inline-block',
    LABEL: 'inline'
};

function defaultDisplayForTag(tagName) {
    return defaultDisplayMap[(tagName || '').toUpperCase()] || 'block';
}

function resolveElement(target) {
    if (!target) return null;
    if (typeof target === 'string') {
        if (typeof document === 'undefined') return null;
        if (target.startsWith('#') || target.startsWith('.') || target.includes('[') || target.includes(' ') || target.includes('>')) {
            return document.querySelector(target);
        }
        return document.getElementById(target) || document.querySelector(target);
    }
    if (target.nodeType === 1 || target === document || (typeof window !== 'undefined' && target === window)) {
        return target;
    }
    if (Array.isArray(target) || (typeof NodeList !== 'undefined' && target instanceof NodeList) || (typeof HTMLCollection !== 'undefined' && target instanceof HTMLCollection)) {
        return target.length > 0 ? target[0] : null;
    }
    return null;
}

function resolveElements(target) {
    if (!target) return [];
    if (typeof target === 'string') {
        if (typeof document === 'undefined') return [];
        return Array.from(document.querySelectorAll(target));
    }
    if (target.nodeType === 1) {
        return [target];
    }
    if (Array.isArray(target)) {
        return target.filter((el) => el && el.nodeType === 1);
    }
    if (typeof NodeList !== 'undefined' && target instanceof NodeList) {
        return Array.from(target);
    }
    if (typeof HTMLCollection !== 'undefined' && target instanceof HTMLCollection) {
        return Array.from(target);
    }
    return [];
}

function byId(id) {
    if (!id) return null;
    if (typeof id === 'string') {
        if (typeof document === 'undefined') return null;
        const cleanId = id.startsWith('#') ? id.slice(1) : id;
        return document.getElementById(cleanId);
    }
    if (id && id.nodeType === 1) return id;
    return null;
}

function qs(sel, root = (typeof document !== 'undefined' ? document : null)) {
    if (!sel || !root || typeof root.querySelector !== 'function') return null;
    return root.querySelector(sel);
}

function qsa(sel, root = (typeof document !== 'undefined' ? document : null)) {
    if (!sel || !root || typeof root.querySelectorAll !== 'function') return [];
    return Array.from(root.querySelectorAll(sel));
}

function showEl(target) {
    const els = resolveElements(target);
    for (const el of els) {
        el.style.display = '';
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            try {
                if (window.getComputedStyle(el).display === 'none') {
                    el.style.display = defaultDisplayForTag(el.tagName);
                }
            } catch (e) {
                el.style.display = defaultDisplayForTag(el.tagName);
            }
        } else if (el.style.display === 'none') {
            el.style.display = defaultDisplayForTag(el.tagName);
        }
        if (typeof window !== 'undefined' && typeof window.setSelectVisible === 'function' && el.tagName === 'SELECT') {
            window.setSelectVisible(el, true);
        }
    }
    return target;
}

function hideEl(target) {
    const els = resolveElements(target);
    for (const el of els) {
        el.style.display = 'none';
        if (typeof window !== 'undefined' && typeof window.setSelectVisible === 'function' && el.tagName === 'SELECT') {
            window.setSelectVisible(el, false);
        }
    }
    return target;
}

function toggleEl(target, force) {
    const els = resolveElements(target);
    for (const el of els) {
        const isHidden = !isVisible(el);
        const shouldShow = (typeof force === 'boolean') ? force : isHidden;
        if (shouldShow) {
            showEl(el);
        } else {
            hideEl(el);
        }
    }
    return target;
}

function isVisible(target) {
    const el = resolveElement(target);
    if (!el || el.nodeType !== 1) return false;
    if (el.style && el.style.display === 'none') return false;
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        try {
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        } catch (e) {}
    }
    if (el.offsetWidth !== undefined && el.offsetHeight !== undefined) {
        return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length > 0));
    }
    return true;
}

function getVal(target) {
    const el = resolveElement(target);
    if (!el) return '';
    return (el.value !== undefined) ? el.value : '';
}

function setVal(target, val) {
    const v = (val === null || val === undefined) ? '' : String(val);
    const els = resolveElements(target);
    for (const el of els) {
        el.value = v;
        if (el.tagName === 'SELECT' && typeof window !== 'undefined' && typeof window.refreshSelect === 'function') {
            window.refreshSelect(el);
        }
    }
    return target;
}

function getText(target) {
    const el = resolveElement(target);
    if (!el) return '';
    return el.textContent || '';
}

function setText(target, str) {
    const text = (str === null || str === undefined) ? '' : String(str);
    const els = resolveElements(target);
    for (const el of els) {
        el.textContent = text;
    }
    return target;
}

function getHtml(target) {
    const el = resolveElement(target);
    if (!el) return '';
    return el.innerHTML || '';
}

function setHtml(target, html) {
    const content = (html === null || html === undefined) ? '' : String(html);
    const els = resolveElements(target);
    for (const el of els) {
        el.innerHTML = content;
    }
    return target;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function emptyEl(target) {
    const els = resolveElements(target);
    for (const el of els) {
        if (typeof el.replaceChildren === 'function') {
            el.replaceChildren();
        } else {
            el.innerHTML = '';
        }
    }
    return target;
}

function appendHtml(target, html) {
    if (!html) return target;
    const els = resolveElements(target);
    for (const el of els) {
        if (typeof el.insertAdjacentHTML === 'function') {
            el.insertAdjacentHTML('beforeend', html);
        } else {
            el.innerHTML += html;
        }
    }
    return target;
}

function appendNode(target, node) {
    if (!node) return target;
    const el = resolveElement(target);
    if (el && typeof el.appendChild === 'function') {
        el.appendChild(node);
    }
    return target;
}

function addClass(target, ...cls) {
    const valid = cls.filter(Boolean);
    if (valid.length === 0) return target;
    const els = resolveElements(target);
    for (const el of els) {
        if (el.classList) {
            el.classList.add(...valid);
        }
    }
    return target;
}

function removeClass(target, ...cls) {
    const valid = cls.filter(Boolean);
    if (valid.length === 0) return target;
    const els = resolveElements(target);
    for (const el of els) {
        if (el.classList) {
            el.classList.remove(...valid);
        }
    }
    return target;
}

function hasClass(target, cls) {
    const el = resolveElement(target);
    if (!el || !el.classList) return false;
    return el.classList.contains(cls);
}

function getAttr(target, name) {
    const el = resolveElement(target);
    if (!el || typeof el.getAttribute !== 'function') return null;
    return el.getAttribute(name);
}

function setAttr(target, name, val) {
    const els = resolveElements(target);
    for (const el of els) {
        if (typeof el.setAttribute === 'function') {
            el.setAttribute(name, String(val));
        }
    }
    return target;
}

function removeAttr(target, name) {
    const els = resolveElements(target);
    for (const el of els) {
        if (typeof el.removeAttribute === 'function') {
            el.removeAttribute(name);
        }
    }
    return target;
}

function setDisabled(target, disabled) {
    const els = resolveElements(target);
    const bool = !!disabled;
    for (const el of els) {
        el.disabled = bool;
        if (bool) {
            el.setAttribute('disabled', 'disabled');
        } else {
            el.removeAttribute('disabled');
        }
    }
    return target;
}

function toKebabCase(str) {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function coerceDataAttr(val) {
    if (val === null || val === undefined) return undefined;
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null') return null;
    if (val === 'undefined') return undefined;
    if (!isNaN(val) && val.trim() !== '') {
        const num = Number(val);
        if (!isNaN(num)) return num;
    }
    if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
        try {
            return JSON.parse(val);
        } catch (e) {}
    }
    return val;
}

function domData(target, key, val) {
    const el = resolveElement(target);
    if (!el) return undefined;

    let store = elementDataMap.get(el);
    if (!store) {
        store = new Map();
        elementDataMap.set(el, store);
    }

    if (arguments.length >= 3) {
        store.set(key, val);
        return val;
    }

    if (store.has(key)) {
        return store.get(key);
    }

    if (typeof el.getAttribute === 'function') {
        const attrVal = el.getAttribute('data-' + toKebabCase(key));
        if (attrVal !== null) {
            const coerced = coerceDataAttr(attrVal);
            store.set(key, coerced);
            return coerced;
        }
    }
    return undefined;
}

function removeDomData(target, key) {
    const el = resolveElement(target);
    if (!el) return;
    const store = elementDataMap.get(el);
    if (store) {
        if (key) {
            store.delete(key);
        } else {
            elementDataMap.delete(el);
        }
    }
    if (key && typeof el.removeAttribute === 'function') {
        el.removeAttribute('data-' + toKebabCase(key));
    }
}

let lastTouchTime = 0;
let bridgeInitialized = false;

function _resetBridgeForTesting() {
    bridgeInitialized = false;
    lastTouchTime = 0;
}

function initTouchClickBridge() {
    if (bridgeInitialized || typeof document === 'undefined') return;
    bridgeInitialized = true;

    document.addEventListener('touchstart', () => {
        lastTouchTime = Date.now();
    }, { capture: true, passive: true });

    document.addEventListener('touchend', () => {
        lastTouchTime = Date.now();
    }, { capture: true, passive: true });

    document.addEventListener('click', (e) => {
        if (Date.now() - lastTouchTime < 500) return;
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;

        const target = e.target;
        if (!target || !target.closest) return;

        if (target.closest('input, textarea, select, .custom-select-trigger, .custom-select-option, .custom-select-search-input')) {
            return;
        }

        const touchEl = target.closest('[ontouchend], [ontouchstart]');
        if (!touchEl) return;

        const clientX = e.clientX !== undefined ? e.clientX : 0;
        const clientY = e.clientY !== undefined ? e.clientY : 0;
        const pageX = e.pageX !== undefined ? e.pageX : clientX;
        const pageY = e.pageY !== undefined ? e.pageY : clientY;

        if (typeof window !== 'undefined') window.inClickProxy = true;
        try {
            if (touchEl.hasAttribute('ontouchstart')) {
                try {
                    const startEvt = new CustomEvent('touchstart', { bubbles: true, cancelable: true });
                    startEvt.touches = [];
                    startEvt.targetTouches = [];
                    startEvt.changedTouches = [{ clientX, clientY, pageX, pageY }];
                    touchEl.dispatchEvent(startEvt);
                } catch (err) {}
            }

            if (touchEl.hasAttribute('ontouchend')) {
                try {
                    const endEvt = new CustomEvent('touchend', { bubbles: true, cancelable: true });
                    endEvt.touches = [];
                    endEvt.targetTouches = [];
                    endEvt.changedTouches = [{ clientX, clientY, pageX, pageY }];
                    touchEl.dispatchEvent(endEvt);
                } catch (err) {}
            }
        } finally {
            if (typeof window !== 'undefined') window.inClickProxy = false;
        }

        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
    }, { capture: true });
}

// Expose globals for inline templates and global usage
if (typeof window !== 'undefined') {
    window.byId = byId;
    window.qs = qs;
    window.qsa = qsa;
    window.showEl = showEl;
    window.hideEl = hideEl;
    window.toggleEl = toggleEl;
    window.isVisible = isVisible;
    window.getVal = getVal;
    window.setVal = setVal;
    window.getText = getText;
    window.setText = setText;
    window.getHtml = getHtml;
    window.setHtml = setHtml;
    window.emptyEl = emptyEl;
    window.appendHtml = appendHtml;
    window.appendNode = appendNode;
    window.addClass = addClass;
    window.removeClass = removeClass;
    window.hasClass = hasClass;
    window.getAttr = getAttr;
    window.setAttr = setAttr;
    window.removeAttr = removeAttr;
    window.setDisabled = setDisabled;
    window.domData = domData;
    window.removeDomData = removeDomData;
    window.initTouchClickBridge = initTouchClickBridge;
    window.escapeHtml = escapeHtml;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        byId,
        qs,
        qsa,
        showEl,
        hideEl,
        toggleEl,
        isVisible,
        getVal,
        setVal,
        getText,
        setText,
        getHtml,
        setHtml,
        escapeHtml,
        emptyEl,
        appendHtml,
        appendNode,
        addClass,
        removeClass,
        hasClass,
        getAttr,
        setAttr,
        removeAttr,
        setDisabled,
        domData,
        removeDomData,
        initTouchClickBridge,
        _resetBridgeForTesting,
        resolveElement,
        resolveElements
    };
}
