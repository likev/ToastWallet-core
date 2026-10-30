'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '../..');
const wwwDir = path.join(rootDir, 'www');

test('ui-assets: every script and stylesheet in index.template.html exists in www', () => {
    const templatePath = path.join(wwwDir, 'index.template.html');
    const content = fs.readFileSync(templatePath, 'utf8');

    // Extract script src
    const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
    let match;
    const scripts = [];
    while ((match = scriptRegex.exec(content)) !== null) {
        scripts.push(match[1]);
    }

    // Extract link href (rel="stylesheet" or stylesheet links)
    const linkRegex = /<link\s+[^>]*href=["']([^"']+)["']/gi;
    const links = [];
    while ((match = linkRegex.exec(content)) !== null) {
        links.push(match[1]);
    }

    assert.ok(scripts.length > 0, 'Must have scripts in template');
    assert.ok(links.length > 0, 'Must have links in template');

    for (const src of scripts) {
        if (src.startsWith('http://') || src.startsWith('https://')) continue;
        const filePath = path.join(wwwDir, src);
        assert.ok(fs.existsSync(filePath), `Script asset must exist: ${src} -> ${filePath}`);
    }

    for (const href of links) {
        if (href.startsWith('http://') || href.startsWith('https://')) continue;
        const filePath = path.join(wwwDir, href);
        assert.ok(fs.existsSync(filePath), `Stylesheet asset must exist: ${href} -> ${filePath}`);
    }
});

test('ui-assets: purged dead vendor files and packages are absent', () => {
    const deadFiles = [
        'www/js/jquery.mobile-1.4.5.min.js',
        'www/js/bootstrap.min.js',
        'www/js/clipboard.js',
        'www/css/bootstrap.css',
        'www/css/bootstrap.css.map',
        'www/css/bootstrap.min.css.map',
        'www/css/bootstrap-theme.css',
        'www/css/bootstrap-theme.css.map',
        'www/css/bootstrap-theme.min.css',
        'www/css/bootstrap-theme.min.css.map',
        'www/js/pouchdb.min.js',
        'www/js/pouchdb.upsert.min.js',
        'www/js/hashicon.js',
        'www/css/bootstrap.min.css',
        'www/js/select2.js',
        'www/css/select2.css'
    ];

    for (const file of deadFiles) {
        const fullPath = path.join(rootDir, file);
        assert.ok(!fs.existsSync(fullPath), `Dead vendor file must not exist: ${file}`);
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'utils-build/package.json'), 'utf8'));
    assert.equal(pkg.dependencies['jquery'], undefined, 'jquery must be purged from package.json');
    assert.equal(pkg.dependencies['node-pre-gyp'], undefined, 'node-pre-gyp must be purged from package.json');
    assert.equal(pkg.dependencies['random-bytes'], undefined, 'random-bytes must be purged from package.json');
    assert.equal(pkg.dependencies['pouchdb'], undefined, 'pouchdb must be purged from package.json');
    assert.equal(pkg.dependencies['pouchdb-upsert'], undefined, 'pouchdb-upsert must be purged from package.json');
});
