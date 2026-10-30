'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '../..');
const wwwDir = path.join(rootDir, 'www');
const jsDir = path.join(wwwDir, 'js');
const viewsDir = path.join(wwwDir, 'views');

function getAllFiles(dir, exts = ['.js', '.html']) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, exts));
        } else if (exts.some(ext => file.endsWith(ext))) {
            results.push(fullPath);
        }
    }
    return results;
}

test('no-legacy-deps: zero $(...) / jQuery(...) / $. calls and window.$ / window.jQuery assignments', () => {
    const jsFiles = getAllFiles(jsDir, ['.js']).filter(f => !f.endsWith('rippleutils-build.js'));
    const htmlFiles = [path.join(wwwDir, 'index.template.html'), path.join(wwwDir, 'index.html'), ...getAllFiles(viewsDir, ['.html'])];
    const allFiles = [...jsFiles, ...htmlFiles];

    const violations = [];
    const jqueryCallRegex = /(?:\$|jQuery)\s*\(/;
    const jqueryMethodRegex = /(?:\$|jQuery)\s*\.\s*[a-zA-Z]/;
    const windowDollarRegex = /window\s*\.\s*(?:\$|jQuery)\s*=/;

    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            // Skip pure comments
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
            // Strip out string regex literals or regex tests e.g. /^[0-9]+$/
            const cleaned = line.replace(/\/[^/\n\r]+\/[gimyus]*/g, '""');

            if (jqueryCallRegex.test(cleaned)) {
                violations.push({ file: path.relative(rootDir, file), line: idx + 1, content: trimmed, reason: 'jQuery call' });
            } else if (jqueryMethodRegex.test(cleaned)) {
                // Ensure not inside a comment
                violations.push({ file: path.relative(rootDir, file), line: idx + 1, content: trimmed, reason: 'jQuery method' });
            } else if (windowDollarRegex.test(cleaned)) {
                violations.push({ file: path.relative(rootDir, file), line: idx + 1, content: trimmed, reason: 'window.$ assignment' });
            }
        });
    }

    assert.equal(violations.length, 0, `Surviving jQuery references found:\n${JSON.stringify(violations, null, 2)}`);
});

test('no-legacy-deps: zero PouchDB runtime constructors or references in www/index.html', () => {
    const jsFiles = getAllFiles(jsDir, ['.js']).filter(f => !f.endsWith('rippleutils-build.js'));
    const indexHtml = path.join(wwwDir, 'index.html');
    const filesToCheck = [...jsFiles, indexHtml];

    const violations = [];
    const pouchRegex = /(?:new\s+PouchDB|PouchDB\s*\.|window\s*\.\s*PouchDB)/;

    for (const file of filesToCheck) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
            if (pouchRegex.test(line)) {
                violations.push({ file: path.relative(rootDir, file), line: idx + 1, content: trimmed });
            }
        });
    }

    assert.equal(violations.length, 0, `Surviving PouchDB references found:\n${JSON.stringify(violations, null, 2)}`);
});

test('no-legacy-deps: zero .select2(...) calls and zero :visible / :selected pseudo-selectors', () => {
    const jsFiles = getAllFiles(jsDir, ['.js']).filter(f => !f.endsWith('rippleutils-build.js'));
    const htmlFiles = [path.join(wwwDir, 'index.template.html'), path.join(wwwDir, 'index.html'), ...getAllFiles(viewsDir, ['.html'])];
    const allFiles = [...jsFiles, ...htmlFiles];

    const violations = [];
    const select2CallRegex = /\.select2\s*\(/;
    const pseudoSelectorRegex = /['"][^'"]*:(?:visible|selected)[^'"]*['"]/;

    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
            if (select2CallRegex.test(line)) {
                violations.push({ file: path.relative(rootDir, file), line: idx + 1, content: trimmed, reason: 'select2 call' });
            }
            if (pseudoSelectorRegex.test(line)) {
                violations.push({ file: path.relative(rootDir, file), line: idx + 1, content: trimmed, reason: 'jQuery pseudo-selector' });
            }
        });
    }

    assert.equal(violations.length, 0, `Surviving select2 or pseudo-selectors found:\n${JSON.stringify(violations, null, 2)}`);
});

test('no-legacy-deps: zero e.originalEvent references in runtime code', () => {
    const jsFiles = getAllFiles(jsDir, ['.js']).filter(f => !f.endsWith('rippleutils-build.js'));
    const violations = [];

    for (const file of jsFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (line.includes('originalEvent')) {
                violations.push({ file: path.relative(rootDir, file), line: idx + 1, content: line.trim() });
            }
        });
    }

    assert.equal(violations.length, 0, `Surviving originalEvent found:\n${JSON.stringify(violations, null, 2)}`);
});

test('no-legacy-deps: package.json dependencies contain ONLY the 4 approved packages', () => {
    const pkgPath = path.join(rootDir, 'utils-build/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).sort();

    assert.deepStrictEqual(deps, ['@noble/ciphers', '@noble/hashes', 'qr', 'xrpl'], 'Runtime dependencies must match exactly the 4 required packages');
});

test('no-legacy-deps: zero legacy vendor tags in index.template.html and index.html', () => {
    const legacyPatterns = [
        /jquery/i,
        /bootstrap/i,
        /select2/i,
        /pouchdb/i,
        /fontawesome/i,
        /clipboard\.js/i,
        /hashicon\.js/i
    ];

    for (const htmlFile of ['www/index.template.html', 'www/index.html']) {
        const fullPath = path.join(rootDir, htmlFile);
        const content = fs.readFileSync(fullPath, 'utf8');
        // Extract all <script src="..."> and <link href="...">
        const tagRegex = /<(?:script\s+[^>]*src|link\s+[^>]*href)=["']([^"']+)["']/gi;
        let match;
        while ((match = tagRegex.exec(content)) !== null) {
            const assetUrl = match[1];
            for (const pat of legacyPatterns) {
                assert.ok(!pat.test(assetUrl), `Legacy asset reference "${assetUrl}" in ${htmlFile} violates zero-legacy rule`);
            }
        }
    }
});

test('no-legacy-deps: dead legacy vendor directories and files are absent from repository', () => {
    const deadTargets = [
        'www/fontawesome',
        'www/js/jquery.mobile-1.4.5.min.js',
        'www/js/jquery-3.7.1.min.js',
        'www/js/bootstrap.min.js',
        'www/js/clipboard.js',
        'www/js/pouchdb.min.js',
        'www/js/pouchdb.upsert.min.js',
        'www/js/hashicon.js',
        'www/js/select2.js',
        'www/css/bootstrap.css',
        'www/css/bootstrap.min.css',
        'www/css/select2.css'
    ];

    for (const target of deadTargets) {
        const fullPath = path.join(rootDir, target);
        assert.ok(!fs.existsSync(fullPath), `Dead target must be absent: ${target}`);
    }
});
