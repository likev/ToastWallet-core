'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '../..');
const baseCssPath = path.join(rootDir, 'www/css/base.css');

test('base-css: file exists and contains essential box-sizing & reboot styles', () => {
    assert.ok(fs.existsSync(baseCssPath), 'base.css must exist');
    const content = fs.readFileSync(baseCssPath, 'utf8');

    assert.ok(content.includes('box-sizing: border-box'), 'base.css must define box-sizing: border-box');
    assert.ok(content.includes('html {'), 'base.css must configure html reboot');
    assert.ok(content.includes('body {'), 'base.css must configure body defaults');
    assert.ok(content.includes('font-family:'), 'base.css must declare font-family');
});

test('base-css: all 13 required Bootstrap component classes and states exist', () => {
    const content = fs.readFileSync(baseCssPath, 'utf8');

    const requiredClasses = [
        '.btn',
        '.btn-default',
        '.btn-primary',
        '.btn-success',
        '.btn-info',
        '.btn-warning',
        '.btn-danger',
        '.active',
        '.form-control',
        '.input-group',
        '.input-group-btn',
        '.list-group',
        '.list-group-item'
    ];

    for (const cls of requiredClasses) {
        assert.ok(content.includes(cls), `base.css must contain class selector: ${cls}`);
    }

    // Verify key geometries & behaviors
    assert.ok(content.includes('display: table'), '.input-group must support table layout');
    assert.ok(content.includes('display: flex'), '.input-group must support flex layout for custom expiry');
    assert.ok(content.includes('height: 34px'), '.form-control must have 34px standard height');
    assert.ok(content.includes('padding: 6px 12px'), '.btn and .form-control must have 6px 12px padding');
    assert.ok(content.includes('border-radius: 4px'), 'Controls must have 4px standard radius');
});
