'use strict';

const enhancedSelects = new Map();

function resolveSelect(target) {
    if (!target) return null;
    if (typeof target === 'string') {
        const sel = target.startsWith('#') || target.startsWith('.') ? target : '#' + target;
        return document.querySelector(sel);
    }
    if (typeof HTMLSelectElement !== 'undefined' && target instanceof HTMLSelectElement) {
        return target;
    }
    if (target.nodeType === 1 && target.tagName === 'SELECT') {
        return target;
    }
    return null;
}

function closeAllCustomSelects() {
    for (const data of enhancedSelects.values()) {
        if (data.container && data.container.classList.contains('cs-open')) {
            data.container.classList.remove('cs-open');
            data.trigger.setAttribute('aria-expanded', 'false');
            if (data.searchInput) {
                data.searchInput.value = '';
                filterOptions(data, '');
            }
        }
    }
}

function renderDefaultOption(opt, selectEl, customRenderer) {
    if (typeof customRenderer === 'function') {
        return customRenderer(opt);
    }
    if ((selectEl && selectEl.id === 'payfromaccount') || (opt.dataset && opt.dataset.account) || opt.getAttribute('data-account')) {
        const acc = opt.getAttribute('data-account') || (opt.dataset && opt.dataset.account) || opt.value;
        const xacc = (typeof window !== 'undefined' && typeof window.xaddr === 'function') ? window.xaddr(acc, false) : acc;
        const span = document.createElement('span');
        span.className = 'accselect2';
        if (typeof window !== 'undefined' && typeof window.hashicon === 'function') {
            const icon = window.hashicon(xacc, 20);
            if (icon) span.appendChild(icon);
        }
        const label = (opt.textContent === acc && typeof window !== 'undefined' && typeof window.dispaddr === 'function')
            ? window.dispaddr(acc)
            : opt.textContent;
        span.appendChild(document.createTextNode((span.childNodes.length > 0 ? ' ' : '') + label));
        return span;
    }
    const span = document.createElement('span');
    span.textContent = opt.textContent;
    return span;
}

function filterOptions(data, query) {
    const q = query.trim().toLowerCase();
    const items = data.optionsList.querySelectorAll('.custom-select-option');
    let hasMatch = false;
    items.forEach((item) => {
        if (item.classList.contains('cs-no-match')) return;
        const text = (item.textContent || '').toLowerCase();
        if (!q || text.includes(q)) {
            item.style.display = '';
            hasMatch = true;
        } else {
            item.style.display = 'none';
        }
    });

    let noMatchEl = data.optionsList.querySelector('.cs-no-match');
    if (!hasMatch) {
        if (!noMatchEl) {
            noMatchEl = document.createElement('li');
            noMatchEl.className = 'custom-select-option cs-no-match';
            noMatchEl.textContent = 'No matches found';
            data.optionsList.appendChild(noMatchEl);
        }
        noMatchEl.style.display = '';
    } else if (noMatchEl) {
        noMatchEl.style.display = 'none';
    }
}

function updateTriggerLabel(data) {
    const selectEl = data.select;
    const selectedOpt = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
    data.labelEl.replaceChildren();
    if (selectedOpt) {
        const rendered = renderDefaultOption(selectedOpt, selectEl, data.opts.renderOption);
        data.labelEl.appendChild(rendered);
    }
}

function buildOptionsList(data) {
    const selectEl = data.select;
    const list = data.optionsList;
    list.replaceChildren();

    Array.from(selectEl.options).forEach((opt, idx) => {
        const li = document.createElement('li');
        li.className = 'custom-select-option';
        li.setAttribute('role', 'option');
        li.setAttribute('data-index', idx);
        li.setAttribute('data-value', opt.value);

        if (idx === selectEl.selectedIndex) {
            li.classList.add('cs-selected');
        }

        const rendered = renderDefaultOption(opt, selectEl, data.opts.renderOption);
        li.appendChild(rendered);

        li.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectEl.value !== opt.value || selectEl.selectedIndex !== idx) {
                selectEl.value = opt.value;
                selectEl.selectedIndex = idx;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            updateTriggerLabel(data);
            closeAllCustomSelects();
        });

        list.appendChild(li);
    });
}

function attachSearchInput(data) {
    if (data.searchInput || !data.dropdown) return;
    const searchBox = document.createElement('div');
    searchBox.className = 'custom-select-search-box';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'custom-select-search-input';
    searchInput.placeholder = 'Search...';
    searchBox.appendChild(searchInput);
    if (data.optionsList && data.optionsList.parentNode === data.dropdown) {
        data.dropdown.insertBefore(searchBox, data.optionsList);
    } else {
        data.dropdown.appendChild(searchBox);
    }
    data.searchInput = searchInput;

    searchInput.addEventListener('input', (e) => {
        filterOptions(data, e.target.value);
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllCustomSelects();
            if (data.trigger) data.trigger.focus();
        }
    });
}

function enhanceSelect(target, opts = {}) {
    if (typeof document === 'undefined') return null;
    const selectEl = resolveSelect(target);
    if (!selectEl) return null;

    if (enhancedSelects.has(selectEl)) {
        refreshSelect(selectEl);
        return selectEl;
    }

    selectEl.classList.add('cs-native-hidden');
    selectEl.setAttribute('tabindex', '-1');

    const container = document.createElement('div');
    container.className = 'custom-select-container';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const labelEl = document.createElement('span');
    labelEl.className = 'custom-select-label';

    const arrowEl = document.createElement('span');
    arrowEl.className = 'custom-select-arrow';

    trigger.appendChild(labelEl);
    trigger.appendChild(arrowEl);

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';

    const optionsList = document.createElement('ul');
    optionsList.className = 'custom-select-options';
    optionsList.setAttribute('role', 'listbox');
    dropdown.appendChild(optionsList);

    container.appendChild(trigger);
    container.appendChild(dropdown);

    const isSearchable = opts.searchable || selectEl.options.length >= 10 || selectEl.id === 'valuationcurrency' || selectEl.id === 'ntloexpiry';

    const data = {
        select: selectEl,
        container,
        trigger,
        labelEl,
        dropdown,
        optionsList,
        searchInput: null,
        opts
    };

    if (isSearchable) {
        attachSearchInput(data);
    }

    enhancedSelects.set(selectEl, data);

    buildOptionsList(data);
    updateTriggerLabel(data);

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = container.classList.contains('cs-open');
        closeAllCustomSelects();
        if (!wasOpen) {
            container.classList.add('cs-open');
            trigger.setAttribute('aria-expanded', 'true');
            if (data.searchInput) {
                setTimeout(() => data.searchInput.focus(), 50);
            }
        }
    });

    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            if (!container.classList.contains('cs-open')) {
                trigger.click();
            }
        } else if (e.key === 'Escape') {
            closeAllCustomSelects();
        }
    });

    const onNativeChange = () => {
        updateTriggerLabel(data);
        const items = optionsList.querySelectorAll('.custom-select-option');
        items.forEach((item, idx) => {
            if (idx === selectEl.selectedIndex) {
                item.classList.add('cs-selected');
            } else {
                item.classList.remove('cs-selected');
            }
        });
    };
    selectEl.addEventListener('change', onNativeChange);
    data._onNativeChange = onNativeChange;

    if (selectEl.parentNode) {
        selectEl.parentNode.insertBefore(container, selectEl.nextSibling);
    }

    return selectEl;
}

function refreshSelect(target) {
    const selectEl = resolveSelect(target);
    if (!selectEl) return;
    const data = enhancedSelects.get(selectEl);
    if (!data) return;

    const shouldSearch = data.opts.searchable || selectEl.options.length >= 10 || selectEl.id === 'valuationcurrency' || selectEl.id === 'ntloexpiry';
    if (shouldSearch && !data.searchInput) {
        attachSearchInput(data);
    }

    buildOptionsList(data);
    updateTriggerLabel(data);
}

function destroySelect(target) {
    const selectEl = resolveSelect(target);
    if (!selectEl) return;
    const data = enhancedSelects.get(selectEl);
    if (!data) return;

    if (data._onNativeChange) {
        selectEl.removeEventListener('change', data._onNativeChange);
    }
    if (data.container && data.container.parentNode) {
        data.container.parentNode.removeChild(data.container);
    }
    selectEl.classList.remove('cs-native-hidden');
    selectEl.removeAttribute('tabindex');

    enhancedSelects.delete(selectEl);
}

function setSelectVisible(target, visible) {
    const selectEl = resolveSelect(target);
    if (!selectEl) return;
    const data = enhancedSelects.get(selectEl);
    if (data && data.container) {
        data.container.style.display = visible ? '' : 'none';
    }
    selectEl.style.display = visible ? '' : 'none';
}

function initGlobalListeners(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d || typeof d.addEventListener !== 'function') return;
    const handleOutside = (e) => {
        if (!e.target || !e.target.closest || !e.target.closest('.custom-select-container')) {
            closeAllCustomSelects();
        }
    };
    d.addEventListener('click', handleOutside);
    d.addEventListener('touchstart', handleOutside, { passive: true });
}

// Global outside click and touch handlers
if (typeof document !== 'undefined') {
    initGlobalListeners(document);
}

// Expose globally
if (typeof window !== 'undefined') {
    window.enhanceSelect = enhanceSelect;
    window.refreshSelect = refreshSelect;
    window.destroySelect = destroySelect;
    window.setSelectVisible = setSelectVisible;
    window.closeAllCustomSelects = closeAllCustomSelects;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        enhanceSelect,
        refreshSelect,
        destroySelect,
        setSelectVisible,
        closeAllCustomSelects,
        renderDefaultOption,
        initGlobalListeners
    };
}
