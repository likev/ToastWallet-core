'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    kjua,
    Instascan,
    encodeQR,
    decodeQR,
    BarcodeDetector
} = require('../qr-compat.js');

// Helper to render a boolean matrix into RGBA pixel buffer
function matrixToRgba(matrix, size, fgColor = [0, 0, 0], bgColor = [255, 255, 255]) {
    const count = matrix.length;
    const data = new Uint8Array(size * size * 4);
    for (let r = 0; r < count; r++) {
        const y1 = Math.round((r * size) / count);
        const y2 = Math.round(((r + 1) * size) / count);
        for (let c = 0; c < count; c++) {
            const isFg = matrix[r][c];
            const color = isFg ? fgColor : bgColor;
            const x1 = Math.round((c * size) / count);
            const x2 = Math.round(((c + 1) * size) / count);
            for (let y = y1; y < y2; y++) {
                for (let x = x1; x < x2; x++) {
                    const idx = (y * size + x) * 4;
                    data[idx] = color[0];
                    data[idx + 1] = color[1];
                    data[idx + 2] = color[2];
                    data[idx + 3] = 255;
                }
            }
        }
    }
    return { width: size, height: size, data };
}

test('kjua: basic generation in non-DOM environment', () => {
    const res = kjua({ text: 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y' });
    assert.equal(res.text, 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y');
    assert.equal(res.size, 200);
    assert.ok(Array.isArray(res.matrix));
    assert.ok(res.matrix.length >= 21);
    assert.ok(typeof res.svg === 'string');
    assert.ok(res.svg.startsWith('<svg'));
});

test('kjua: accepts string directly', () => {
    const res = kjua('test-address');
    assert.equal(res.text, 'test-address');
    assert.ok(res.matrix.length >= 21);
});

test('kjua: handles empty / null / undefined text without error', () => {
    const emptyRes = kjua({ text: '' });
    assert.equal(emptyRes.text, '');
    assert.ok(emptyRes.matrix.length >= 21);

    const nullRes = kjua({ text: null });
    assert.equal(nullRes.text, '');

    const undefRes = kjua({});
    assert.equal(undefRes.text, '');
});

test('kjua: options preservation', () => {
    const res = kjua({
        text: 'ripple:signed-transaction:1234',
        size: 340,
        fill: '#008000',
        back: '#f0f0f0',
        ecLevel: 'H'
    });
    assert.equal(res.size, 340);
    assert.equal(res.fill, '#008000');
    assert.equal(res.back, '#f0f0f0');
    assert.equal(res.ecLevel, 'H');
});

test('kjua: quiet=0 produces matrix without quiet zone border and decodes cleanly', () => {
    const text = 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y';
    const resQuiet0 = kjua({ text, quiet: 0 });
    const resQuiet2 = kjua({ text, quiet: 2 });

    // quiet=0 must have smaller matrix dimension than quiet=2 by exactly 4 modules (2 on each side)
    assert.equal(resQuiet0.matrix.length + 4, resQuiet2.matrix.length);

    // quiet=0 finder pattern corner (0,0) must be true (black module)
    assert.equal(resQuiet0.matrix[0][0], true);
    // quiet=2 corner (0,0) is quiet zone (white/false)
    assert.equal(resQuiet2.matrix[0][0], false);

    // Both must decode cleanly with decodeQR
    const img0 = matrixToRgba(resQuiet0.matrix, 300);
    assert.equal(decodeQR(img0), text);

    const img2 = matrixToRgba(resQuiet2.matrix, 300);
    assert.equal(decodeQR(img2), text);
});

test('kjua: roundtrip decode with decodeQR across Toast Wallet payloads', () => {
    const payloads = [
        'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y',
        'sEdTM1uX8pu2doiuRH9vdUQocDMBKHg',
        'ripple:signed-transaction:1200002280000000240000000161400000000000000168400000000000000c732102f928e44e2ad2b6',
        'X7abcdef1234567890abcdef1234567890abcdef1234567890'
    ];

    for (const text of payloads) {
        for (const ec of ['L', 'M', 'Q', 'H']) {
            const result = kjua({ text, ecLevel: ec, quiet: 2 });
            const image = matrixToRgba(result.matrix, 300);
            const decoded = decodeQR(image);
            assert.equal(decoded, text, `Decoded payload must match original for ecLevel=${ec}`);
        }
    }
});

test('kjua: roundtrip decode with Red QR (#ff0000) and Green QR (#008000)', () => {
    // Red QR used in offline mode account displays
    const redText = 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y';
    const redRes = kjua({ text: redText, fill: '#ff0000' });
    const redImg = matrixToRgba(redRes.matrix, 300, [255, 0, 0], [255, 255, 255]);
    assert.equal(decodeQR(redImg), redText);

    // Green QR used in signed transaction display
    const greenText = 'ripple:signed-transaction:12000022800000002400000001';
    const greenRes = kjua({ text: greenText, fill: '#008000', ecLevel: 'L', size: 340 });
    const greenImg = matrixToRgba(greenRes.matrix, 340, [0, 128, 0], [255, 255, 255]);
    assert.equal(decodeQR(greenImg), greenText);
});

test('kjua: DOM environment returns img and canvas appropriately', () => {
    const originalDocument = global.document;

    try {
        const createdElements = [];
        global.document = {
            createElement(tag) {
                const el = {
                    tagName: tag.toUpperCase(),
                    style: {},
                    attributes: {},
                    setAttribute(name, val) { this.attributes[name] = val; },
                    getAttribute(name) { return this.attributes[name]; }
                };
                if (tag === 'canvas') {
                    el.getContext = (type) => ({
                        fillStyle: '',
                        fillRect() {},
                        getImageData() { return { width: el.width, height: el.height, data: new Uint8Array(4) }; }
                    });
                    el.toDataURL = (format) => `data:${format};base64,MOCKDATA`;
                }
                createdElements.push(el);
                return el;
            }
        };

        // Render as image (default)
        const img = kjua({ text: 'dom-test', size: 250 });
        assert.equal(img.tagName, 'IMG');
        assert.equal(img.width, 250);
        assert.equal(img.height, 250);
        assert.equal(img.style.width, '250px');
        assert.equal(img.style.height, '250px');
        assert.equal(img.src, 'data:image/png;base64,MOCKDATA');

        // Render as canvas
        const canvas = kjua({ text: 'dom-test', size: 180, render: 'canvas' });
        assert.equal(canvas.tagName, 'CANVAS');
        assert.equal(canvas.width, 180);
        assert.equal(canvas.height, 180);
        assert.equal(canvas.style.width, '180px');
        assert.equal(canvas.style.height, '180px');
    } finally {
        global.document = originalDocument;
    }
});

test('Instascan: structure and API interface', () => {
    assert.ok(Instascan.Camera, 'Instascan.Camera must be defined');
    assert.equal(typeof Instascan.Camera.getCameras, 'function', 'getCameras must be a function');
    assert.equal(typeof Instascan.Scanner, 'function', 'Instascan.Scanner must be a constructor');
});

test('Instascan.Camera.getCameras: handles navigator availability and sorts rear cameras', async () => {
    const originalNavigator = global.navigator;

    try {
        // Without navigator
        delete global.navigator;
        const noNav = await Instascan.Camera.getCameras();
        assert.deepEqual(noNav, []);

        // With devices: sorts rear camera first
        global.navigator = {
            mediaDevices: {
                async enumerateDevices() {
                    return [
                        { kind: 'videoinput', deviceId: 'cam-front', label: 'Front FaceTime Camera' },
                        { kind: 'audioinput', deviceId: 'mic-1', label: 'Built-in Mic' },
                        { kind: 'videoinput', deviceId: 'cam-back', label: 'Back Environment Camera' }
                    ];
                },
                getUserMedia: async () => ({ getTracks: () => [] })
            }
        };

        const cameras = await Instascan.Camera.getCameras();
        assert.equal(cameras.length, 2);
        // Rear camera sorted first
        assert.equal(cameras[0].id, 'cam-back');
        assert.equal(cameras[1].id, 'cam-front');
        assert.equal(cameras[0].name, 'Back Environment Camera');
    } finally {
        global.navigator = originalNavigator;
    }
});

test('Instascan.Camera.getCameras: returns [] when zero video inputs exist without returning fake cameras', async () => {
    const originalNavigator = global.navigator;

    try {
        global.navigator = {
            mediaDevices: {
                async enumerateDevices() {
                    return [
                        { kind: 'audioinput', deviceId: 'mic-1', label: 'Built-in Mic' }
                    ];
                },
                getUserMedia: async () => ({ getTracks: () => [] })
            }
        };

        const cameras = await Instascan.Camera.getCameras();
        assert.deepEqual(cameras, [], 'Must return empty array when no video cameras exist');
    } finally {
        global.navigator = originalNavigator;
    }
});

test('Instascan.Camera.getCameras: handles unpermissioned state (empty labels) and permission denial gracefully', async () => {
    const originalNavigator = global.navigator;

    try {
        let permissionGranted = false;
        let tempStreamStopped = false;

        global.navigator = {
            mediaDevices: {
                async enumerateDevices() {
                    if (!permissionGranted) {
                        return [
                            { kind: 'videoinput', deviceId: '0', label: '' },
                            { kind: 'videoinput', deviceId: '1', label: '' }
                        ];
                    }
                    return [
                        { kind: 'videoinput', deviceId: '0', label: 'Front Camera' },
                        { kind: 'videoinput', deviceId: '1', label: 'Back Camera' }
                    ];
                },
                getUserMedia: async () => {
                    permissionGranted = true;
                    return {
                        getTracks: () => [{ stop: () => { tempStreamStopped = true; } }]
                    };
                }
            }
        };

        const cameras = await Instascan.Camera.getCameras();
        assert.equal(cameras.length, 2);
        assert.equal(cameras[0].id, '1', 'Back camera must be sorted first after permission grant');
        assert.equal(cameras[0].name, 'Back Camera');
        assert.ok(tempStreamStopped, 'Temporary permission probe stream must be stopped');

        // Test permission denial
        permissionGranted = false;
        global.navigator.mediaDevices.getUserMedia = async () => {
            throw new Error('NotAllowedError: Permission denied');
        };
        const deniedCameras = await Instascan.Camera.getCameras();
        assert.deepEqual(deniedCameras, [], 'Must return empty array on permission denial');
    } finally {
        global.navigator = originalNavigator;
    }
});

test('Instascan.Scanner: event listener methods (addListener, on, removeListener, off)', () => {
    const scanner = new Instascan.Scanner();
    let count1 = 0;
    let count2 = 0;
    const fn1 = (c) => { count1++; };
    const fn2 = (c) => { count2++; };

    scanner.addListener('scan', fn1);
    scanner.on('scan', fn2);

    scanner.emit('scan', 'content-1');
    assert.equal(count1, 1);
    assert.equal(count2, 1);

    scanner.removeListener('scan', fn1);
    scanner.emit('scan', 'content-2');
    assert.equal(count1, 1);
    assert.equal(count2, 2);

    scanner.off('scan', fn2);
    scanner.emit('scan', 'content-3');
    assert.equal(count1, 1);
    assert.equal(count2, 2);

    scanner.on('scan', fn1);
    scanner.removeAllListeners('scan');
    scanner.emit('scan', 'content-4');
    assert.equal(count1, 1);
});

test('Instascan.Scanner: listener errors do not break subsequent listeners', () => {
    const scanner = new Instascan.Scanner();
    let okCalled = false;

    scanner.addListener('scan', () => { throw new Error('Boom'); });
    scanner.addListener('scan', () => { okCalled = true; });

    scanner.emit('scan', 'data');
    assert.equal(okCalled, true);
});

test('Instascan.Scanner: stop is idempotent and pauses video before/after start', () => {
    const scanner = new Instascan.Scanner();
    // Calling stop when not started
    assert.doesNotThrow(() => scanner.stop());
    assert.doesNotThrow(() => scanner.stop());

    let tracksStopped = 0;
    scanner.stream = {
        getTracks: () => [
            { stop: () => { tracksStopped++; } },
            { stop: () => { tracksStopped++; } }
        ]
    };
    let loopCancelled = false;
    scanner.cancelLoop = () => { loopCancelled = true; };
    let videoPaused = false;
    scanner.video = {
        srcObject: {},
        pause: () => { videoPaused = true; }
    };

    scanner.stop();
    assert.equal(tracksStopped, 2);
    assert.equal(loopCancelled, true);
    assert.equal(videoPaused, true);
    assert.equal(scanner.video.srcObject, null);
    assert.equal(scanner.active, false);

    // Call stop again
    assert.doesNotThrow(() => scanner.stop());
});

test('Instascan.Scanner: start constraint handling with camera vs default', async () => {
    const originalNavigator = global.navigator;
    const originalDocument = global.document;

    try {
        let requestedConstraints = null;
        global.navigator = {
            mediaDevices: {
                getUserMedia: async (c) => {
                    requestedConstraints = c;
                    return { getTracks: () => [{ stop: () => {} }] };
                }
            }
        };

        const mockVideo = {
            setAttribute() {},
            play: async () => {},
            readyState: 4,
            videoWidth: 100,
            videoHeight: 100
        };
        global.document = { getElementById: () => mockVideo };

        const scanner = new Instascan.Scanner({ video: mockVideo });

        // When specific camera is provided, deviceId is used without forcing facingMode
        await scanner.start({ id: 'cam-front' });
        assert.deepEqual(requestedConstraints.video.deviceId, { ideal: 'cam-front' });
        assert.equal(requestedConstraints.video.facingMode, undefined);
        scanner.stop();

        // When no camera is provided, defaults to facingMode: environment
        await scanner.start();
        assert.deepEqual(requestedConstraints.video.facingMode, { ideal: 'environment' });
        assert.equal(requestedConstraints.video.deviceId, undefined);
        scanner.stop();
    } finally {
        global.navigator = originalNavigator;
        global.document = originalDocument;
    }
});

test('Instascan.Scanner: start and simulated scan detection with downscaled video frame', async () => {
    const originalNavigator = global.navigator;
    const originalDocument = global.document;

    try {
        let streamRequested = false;
        const mockStream = {
            getTracks: () => [{ stop: () => {} }]
        };
        global.navigator = {
            mediaDevices: {
                getUserMedia: async (constraints) => {
                    streamRequested = true;
                    return mockStream;
                }
            }
        };

        const targetQr = 'ripple:rToastTestAccount12345';
        const targetRgba = matrixToRgba(encodeQR(targetQr, 'raw', { ecc: 'low', border: 2 }), 320);

        let videoPlayed = false;
        let drawnWidth = 0;
        let drawnHeight = 0;

        // Simulate 1280x720 video feed (downscaling to maxScanDim=640 should produce 640x360 canvas)
        const mockVideo = {
            readyState: 4,
            videoWidth: 1280,
            videoHeight: 720,
            setAttribute() {},
            play: async () => { videoPlayed = true; },
            requestVideoFrameCallback: (cb) => {
                setImmediate(cb);
                return 123;
            },
            cancelVideoFrameCallback: () => {}
        };

        global.document = {
            getElementById: () => mockVideo,
            createElement: (tag) => {
                if (tag === 'canvas') {
                    const canvasObj = {
                        width: 0,
                        height: 0,
                        getContext: () => ({
                            drawImage: (img, sx, sy, sw, sh) => {
                                drawnWidth = sw;
                                drawnHeight = sh;
                            },
                            getImageData: () => targetRgba
                        })
                    };
                    return canvasObj;
                }
                return {};
            }
        };

        const scanner = new Instascan.Scanner({ video: mockVideo });
        let scannedResult = null;

        await new Promise((resolve) => {
            scanner.addListener('scan', (content) => {
                scannedResult = content;
                resolve();
            });
            scanner.start({ id: 'cam-1' });
        });

        assert.ok(streamRequested, 'getUserMedia must have been called');
        assert.ok(videoPlayed, 'video.play must have been called');
        assert.equal(scannedResult, targetQr, 'Scanner must emit decoded QR string');
        assert.equal(drawnWidth, 640, 'Canvas width must be downsampled to max dimension 640');
        assert.equal(drawnHeight, 360, 'Canvas height must be downsampled proportionally to 360');
        assert.equal(scanner.active, false, 'Scanner auto-stops on successful scan');
    } finally {
        global.navigator = originalNavigator;
        global.document = originalDocument;
    }
});

test('Instascan.Scanner: scan(imageSource) handles canvas, ImageData, and invalid input', () => {
    const scanner = new Instascan.Scanner();

    // Invalid / null
    assert.equal(scanner.scan(null), null);
    assert.equal(scanner.scan(undefined), null);
    assert.equal(scanner.scan({}), null);

    // ImageData
    const text = 'rToastMYRQh8boeo5Ys1CnPySmt3c9x3Y';
    const rgba = matrixToRgba(encodeQR(text, 'raw'), 200);
    assert.equal(scanner.scan(rgba), text);

    // Canvas object with getContext('2d')
    const mockCanvas = {
        width: rgba.width,
        height: rgba.height,
        getContext: (type) => ({
            getImageData: () => rgba
        })
    };
    assert.equal(scanner.scan(mockCanvas), text);
});

test('HTML templates and vendored files cleanup verification', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const templateHtml = fs.readFileSync(path.join(rootDir, 'www/index.template.html'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'www/index.html'), 'utf8');

    assert.ok(!templateHtml.includes('kjua-0.1.1.min.js'), 'index.template.html must not include kjua script tag');
    assert.ok(!templateHtml.includes('instascan.min.js'), 'index.template.html must not include instascan script tag');

    assert.ok(!indexHtml.includes('kjua-0.1.1.min.js'), 'index.html must not include kjua script tag');
    assert.ok(!indexHtml.includes('instascan.min.js'), 'index.html must not include instascan script tag');

    assert.ok(!fs.existsSync(path.join(rootDir, 'www/js/kjua-0.1.1.min.js')), 'kjua vendored file must not exist');
    assert.ok(!fs.existsSync(path.join(rootDir, 'www/js/instascan.min.js')), 'instascan vendored file must not exist');
});

test('rippleutils-build.js bundles qr, kjua, and Instascan', () => {
    const buildPath = path.resolve(__dirname, '../rippleutils-build.js');
    const buildContent = fs.readFileSync(buildPath, 'utf8');
    assert.ok(buildContent.includes("window['kjua']"), 'rippleutils-build.js must set window.kjua');
    assert.ok(buildContent.includes("window['Instascan']"), 'rippleutils-build.js must set window.Instascan');
    assert.ok(buildContent.includes("window['qr']"), 'rippleutils-build.js must set window.qr');
});
