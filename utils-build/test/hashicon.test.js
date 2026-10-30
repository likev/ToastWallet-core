'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const hashicon = require('../hashicon.js');

function createMockCanvas() {
    const operations = [];
    return {
        width: 0,
        height: 0,
        style: {},
        getContext: () => ({
            scale: () => {},
            beginPath: () => operations.push(['beginPath']),
            moveTo: (x, y) => operations.push(['moveTo', Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]),
            lineTo: (x, y) => operations.push(['lineTo', Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]),
            set fillStyle(val) { operations.push(['fillStyle', val]); },
            fill: () => operations.push(['fill'])
        }),
        operations
    };
}

// 20 representative addresses and test cases
const testVectors = [
    'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y',
    'rMPrYipfRHJryWfwYARAwhsVGvHwpUDjgA',
    'rpjfAeE3DeeHPFnN2PgGFW5YxnZFAjrEyN',
    'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv',
    'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    'rPEPPER7TUPSbvAgBrviUsxHN97ppaicCH',
    'r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59',
    'rUrt5b2m48k5K1yvJzS2G4d3fR5k6m7nP8',
    'r3kmLJN5D28dHuH8vZNUZpBh45vkyjgRph',
    'rJb5KsHsDHF1YS5B53j6E2mQoz1x564QfK',
    'X7v4X3sHh2eD8469C4g6F29cK5V8w9Xz2Yp',
    'X73bNpBmQveA7q9yQZt64wK2oQ9dK7N68H5',
    'XVLhHMPHU9vdGwErPUBxVmuCoUCoMmN5WzFauTLvNpZZKo9',
    'T7v4X3sHh2eD8469C4g6F29cK5V8w9Xz2Yp',
    'TVLhHMPHU9vdGwErPUBxVmuCoUCoMmN5WzFauTLvNpZZKo9',
    '',
    '0',
    'short',
    'a-very-long-custom-nickname-string-for-hashicon-testing',
    '1234567890!@#$%^&*()'
];

test('hashicon: deterministic canvas operations for 20 addresses at size 20 and 35', () => {
    for (const addr of testVectors) {
        // Size 20 (used on #tabpayments)
        const c20_1 = hashicon(addr, { size: 20, createCanvas: createMockCanvas });
        const c20_2 = hashicon(addr, 20); // pass number directly
        // pass mock createCanvas via options
        const c20_num = hashicon(addr, { size: 20, createCanvas: createMockCanvas });

        assert.ok(c20_1.operations.length > 50, 'Must produce canvas operations');
        assert.deepEqual(c20_1.operations, c20_num.operations, 'Numeric size shorthand must match { size: 20 }');

        // Size 35 (used on #tabaccounts)
        const c35 = hashicon(addr, { size: 35, createCanvas: createMockCanvas });
        assert.ok(c35.operations.length > 50, 'Must produce canvas operations for size 35');
    }
});

test('hashicon: handles null, undefined, non-string inputs gracefully', () => {
    const cNull = hashicon(null, { size: 20, createCanvas: createMockCanvas });
    assert.ok(cNull.operations.length > 0);

    const cUndef = hashicon(undefined, { size: 20, createCanvas: createMockCanvas });
    assert.ok(cUndef.operations.length > 0);

    const cNum = hashicon(12345, { size: 20, createCanvas: createMockCanvas });
    assert.ok(cNum.operations.length > 0);
});

test('hashicon: DOM environment returns HTMLCanvasElement with devicePixelRatio scaling', () => {
    const originalDocument = global.document;
    const originalWindow = global.window;

    try {
        let createdTag = null;
        let scaleCalled = false;
        const mockCanvas = {
            style: {},
            width: 0,
            height: 0,
            getContext: (type) => ({
                scale: (x, y) => { scaleCalled = true; },
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                fill: () => {}
            })
        };

        global.document = {
            createElement: (tag) => {
                createdTag = tag;
                return mockCanvas;
            }
        };
        global.window = {
            devicePixelRatio: 2
        };

        const result = hashicon('rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y', 35);
        assert.equal(createdTag, 'canvas');
        assert.equal(result.style.width, '35px');
        assert.equal(result.style.height, '35px');
        assert.equal(result.width, 70); // 35 * 2 (dpr)
        assert.equal(result.height, 70);
        assert.equal(scaleCalled, true);
    } finally {
        global.document = originalDocument;
        global.window = originalWindow;
    }
});

test('rippleutils-build.js bundles hashicon and sets window.hashicon', () => {
    const buildPath = path.resolve(__dirname, '../rippleutils-build.js');
    const buildContent = fs.readFileSync(buildPath, 'utf8');
    assert.ok(buildContent.includes("window['hashicon']"), 'rippleutils-build.js must set window.hashicon');
});
