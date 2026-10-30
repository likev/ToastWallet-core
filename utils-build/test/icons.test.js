'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '../..');
const wwwDir = path.join(rootDir, 'www');
const iconsCssPath = path.join(wwwDir, 'css/icons.css');

function collectFiles(dir, exts, excludeDirs = []) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (excludeDirs.includes(entry.name)) continue;
            results = results.concat(collectFiles(fullPath, exts, excludeDirs));
        } else if (entry.isFile()) {
            if (exts.some((ext) => entry.name.endsWith(ext))) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

test('icons: every fa-* class in html and js files has a matching rule in icons.css', () => {
    assert.ok(fs.existsSync(iconsCssPath), 'icons.css must exist');
    const iconsCss = fs.readFileSync(iconsCssPath, 'utf8');

    // Collect all html and js files (exclude fontawesome directory and compiled bundles if needed)
    const files = collectFiles(wwwDir, ['.html', '.js'], ['fontawesome', 'node_modules'])
        .filter((f) => !f.endsWith('rippleutils-build.js'));

    const faTokenRegex = /\bfa-[a-z0-9-]+/g;
    const foundIcons = new Set();

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = faTokenRegex.exec(content)) !== null) {
            foundIcons.add(match[0]);
        }
    }

    assert.ok(foundIcons.size > 0, 'Must find fa-* icons in the codebase');

    for (const icon of foundIcons) {
        if (icon === 'fa-spin') {
            assert.ok(iconsCss.includes('.fa-spin'), 'icons.css must include .fa-spin');
            assert.ok(iconsCss.includes('@keyframes fa-spin'), 'icons.css must include @keyframes fa-spin');
            continue;
        }

        // Each fa-name should be present as a selector in icons.css
        const selectorMatch = iconsCss.includes(`.${icon}`) || iconsCss.includes(`${icon}`);
        assert.ok(selectorMatch, `Icon class ${icon} must have a matching rule in icons.css`);
    }
});

test('icons: zero references to "Font Awesome" remain in www/css/', () => {
    const cssFiles = collectFiles(path.join(wwwDir, 'css'), ['.css']);
    for (const file of cssFiles) {
        const content = fs.readFileSync(file, 'utf8');
        assert.ok(
            !content.toLowerCase().includes('font awesome'),
            `File ${path.relative(rootDir, file)} must not contain any reference to Font Awesome`
        );
    }
});

test('icons: fa-spin animation and essential mask rules exist', () => {
    const iconsCss = fs.readFileSync(iconsCssPath, 'utf8');
    assert.ok(iconsCss.includes('mask-image'), 'icons.css must use mask-image');
    assert.ok(iconsCss.includes('-webkit-mask-image'), 'icons.css must use -webkit-mask-image');
    assert.ok(iconsCss.includes('currentColor'), 'icons.css must use currentColor for tinting');
    assert.ok(iconsCss.includes('.fa-toggle-on'), 'icons.css must define .fa-toggle-on');
    assert.ok(iconsCss.includes('.fa-toggle-off'), 'icons.css must define .fa-toggle-off');
});
