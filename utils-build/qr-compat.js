'use strict';

const qrBundle = require('./qr-bundle.cjs');
const { encodeQR, decodeQR, BarcodeDetector, QRCanvas, QRCamera, rearCamera, selfieCamera, frameLoop } = qrBundle;

const ECC_MAP = {
    'L': 'low',
    'M': 'medium',
    'Q': 'quartile',
    'H': 'high',
    'low': 'low',
    'medium': 'medium',
    'quartile': 'quartile',
    'high': 'high'
};

/**
 * kjua compatibility shim backed by paulmillr/qr
 * Generates QR code canvas or img element matching legacy kjua API
 */
function kjua(options) {
    if (typeof options === 'string') {
        options = { text: options };
    }
    const opts = Object.assign({
        render: 'image',
        crisp: true,
        minVersion: 1,
        ecLevel: 'L',
        size: 200,
        fill: '#333333',
        back: '#ffffff',
        text: '',
        quiet: 2
    }, options);

    const ecc = ECC_MAP[opts.ecLevel] || 'low';
    const textToEncode = String(opts.text !== undefined && opts.text !== null ? opts.text : '');

    const encodeOpts = { ecc };
    if (opts.minVersion && opts.minVersion > 1) {
        encodeOpts.version = opts.minVersion;
    }

    let matrix;
    const quietModules = typeof opts.quiet === 'number' ? Math.max(0, Math.floor(opts.quiet)) : 2;
    if (quietModules === 0) {
        // encodeQR requires border >= 1. To get quiet=0, encode with border=1 and slice off the 1-module border.
        const raw = encodeQR(textToEncode, 'raw', { ...encodeOpts, border: 1 });
        matrix = raw.slice(1, -1).map(row => row.slice(1, -1));
    } else {
        const border = Math.min(quietModules, 10);
        matrix = encodeQR(textToEncode, 'raw', { ...encodeOpts, border });
    }

    const count = matrix.length;
    const size = typeof opts.size === 'number' && opts.size > 0 ? opts.size : 200;

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = opts.back || '#ffffff';
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = opts.fill || '#333333';

            // Draw modules using integer pixel boundaries to eliminate subpixel seam gaps
            for (let r = 0; r < count; r++) {
                const y1 = Math.round((r * size) / count);
                const y2 = Math.round(((r + 1) * size) / count);
                for (let c = 0; c < count; c++) {
                    if (matrix[r][c]) {
                        const x1 = Math.round((c * size) / count);
                        const x2 = Math.round(((c + 1) * size) / count);
                        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
                    }
                }
            }
        }

        if (opts.render === 'canvas') {
            return canvas;
        }

        const img = document.createElement('img');
        try {
            img.src = canvas.toDataURL ? canvas.toDataURL('image/png') : '';
        } catch (e) {
            img.src = '';
        }
        img.width = size;
        img.height = size;
        img.style.width = size + 'px';
        img.style.height = size + 'px';
        return img;
    }

    // Non-DOM environment fallback (Node test runner without mocked DOM)
    return {
        matrix,
        text: textToEncode,
        size,
        fill: opts.fill,
        back: opts.back,
        render: opts.render,
        ecLevel: opts.ecLevel,
        quiet: opts.quiet,
        svg: encodeQR(textToEncode, 'svg', { ...encodeOpts, border: quietModules > 0 ? quietModules : 1 })
    };
}

/**
 * Instascan compatibility shim backed by paulmillr/qr
 */
const Instascan = {
    Camera: {
        async getCameras() {
            if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
                return [];
            }
            try {
                if (typeof navigator.mediaDevices.enumerateDevices !== 'function') {
                    if (typeof navigator.mediaDevices.getUserMedia === 'function') {
                        try {
                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                            if (stream && typeof stream.getTracks === 'function') {
                                stream.getTracks().forEach(t => {
                                    if (typeof t.stop === 'function') t.stop();
                                });
                            }
                            return [{ id: 'default', name: 'Default Camera', deviceId: 'default' }];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                }

                let devices = await navigator.mediaDevices.enumerateDevices();
                let videoInputs = devices.filter(d => d.kind === 'videoinput');
                if (videoInputs.length === 0) {
                    return [];
                }

                // If labels are empty (camera permissions not yet granted to origin in modern browsers)
                const hasLabels = videoInputs.some(d => Boolean(d.label));
                if (!hasLabels && typeof navigator.mediaDevices.getUserMedia === 'function') {
                    try {
                        const tempStream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: { ideal: 'environment' } }
                        });
                        if (tempStream && typeof tempStream.getTracks === 'function') {
                            tempStream.getTracks().forEach(t => {
                                if (typeof t.stop === 'function') t.stop();
                            });
                        }
                        // Re-query now that permissions are granted and labels are populated
                        devices = await navigator.mediaDevices.enumerateDevices();
                        videoInputs = devices.filter(d => d.kind === 'videoinput');
                    } catch (permErr) {
                        return [];
                    }
                }

                if (videoInputs.length === 0) {
                    return [];
                }

                // Prioritize back/rear/environment cameras
                const isRear = (label) => /back|rear|environment/i.test(label || '');
                videoInputs.sort((a, b) => {
                    const aRear = isRear(a.label);
                    const bRear = isRear(b.label);
                    if (aRear && !bRear) return -1;
                    if (!aRear && bRear) return 1;
                    return 0;
                });

                return videoInputs.map((d, i) => ({
                    id: d.deviceId || String(i),
                    name: d.label || `Camera ${i + 1}`,
                    deviceId: d.deviceId || String(i)
                }));
            } catch (err) {
                return [];
            }
        }
    },

    Scanner: class Scanner {
        constructor(opts = {}) {
            this.opts = opts;
            this.video = opts.video || null;
            this.listeners = {};
            this.active = false;
            this.stream = null;
            this.cancelLoop = null;
            this._isScanning = false;
        }

        addListener(event, fn) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(fn);
            return this;
        }

        on(event, fn) {
            return this.addListener(event, fn);
        }

        removeListener(event, fn) {
            if (this.listeners[event]) {
                this.listeners[event] = this.listeners[event].filter(cb => cb !== fn);
            }
            return this;
        }

        off(event, fn) {
            return this.removeListener(event, fn);
        }

        removeAllListeners(event) {
            if (event) {
                delete this.listeners[event];
            } else {
                this.listeners = {};
            }
            return this;
        }

        emit(event, ...args) {
            const cbs = this.listeners[event];
            if (cbs) {
                for (const cb of cbs.slice()) {
                    try {
                        cb(...args);
                    } catch (e) {
                        if (typeof debug !== 'undefined' && debug) {
                            console.error('Scanner event listener threw:', e);
                        }
                    }
                }
            }
        }

        async start(camera) {
            this.stop();
            this.active = true;

            const video = this.video || (typeof document !== 'undefined' ? document.getElementById('qrpreview') : null);
            if (!video) {
                throw new Error('Video element not found for QR scanning');
            }
            this.video = video;

            video.setAttribute('autoplay', '');
            video.setAttribute('muted', '');
            video.setAttribute('playsinline', '');
            video.muted = true;

            let constraints;
            if (camera && camera.id && camera.id !== 'default') {
                constraints = {
                    video: {
                        deviceId: { ideal: camera.id },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };
            } else {
                constraints = {
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };
            }

            let stream = null;
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } else if (navigator.getUserMedia) {
                    stream = await new Promise((resolve, reject) => {
                        navigator.getUserMedia(constraints, resolve, reject);
                    });
                } else {
                    throw new Error('getUserMedia is not supported on this platform');
                }
            } catch (err) {
                // Retry with basic video constraints if ideal constraints failed
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                } else {
                    throw err;
                }
            }

            if (!this.active) {
                if (stream) {
                    try {
                        stream.getTracks().forEach(t => {
                            if (typeof t.stop === 'function') t.stop();
                        });
                    } catch (e) {}
                }
                return;
            }

            this.stream = stream;
            video.srcObject = stream;
            try {
                await video.play();
            } catch (e) {
                // Ignore autoplay/interrupted errors
            }

            const canvas = (typeof document !== 'undefined' && typeof document.createElement === 'function') ? document.createElement('canvas') : null;
            const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;

            let frameId = null;
            const scanFrame = () => {
                if (!this.active) return;

                if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && canvas && ctx && !this._isScanning) {
                    this._isScanning = true;
                    try {
                        // Downsample high-res camera streams (1080p/4K) to max 640px for fast ~10ms decode
                        const maxScanDim = 640;
                        let w = video.videoWidth;
                        let h = video.videoHeight;
                        if (w > maxScanDim || h > maxScanDim) {
                            if (w >= h) {
                                h = Math.round((h * maxScanDim) / w);
                                w = maxScanDim;
                            } else {
                                w = Math.round((w * maxScanDim) / h);
                                h = maxScanDim;
                            }
                        }

                        if (canvas.width !== w || canvas.height !== h) {
                            canvas.width = w;
                            canvas.height = h;
                        }
                        ctx.drawImage(video, 0, 0, w, h);
                        const imgData = ctx.getImageData(0, 0, w, h);
                        const decoded = decodeQR(imgData);
                        if (decoded) {
                            const content = typeof decoded === 'string' ? decoded : (decoded.data || decoded.text || String(decoded));
                            this.stop();
                            this.emit('scan', content);
                            return;
                        }
                    } catch (e) {
                        // decodeQR throws on frames without a valid QR code; continue loop
                    } finally {
                        this._isScanning = false;
                    }
                }

                if (this.active) {
                    if (typeof video.requestVideoFrameCallback === 'function') {
                        frameId = video.requestVideoFrameCallback(scanFrame);
                    } else if (typeof requestAnimationFrame === 'function') {
                        frameId = requestAnimationFrame(scanFrame);
                    } else {
                        frameId = setTimeout(scanFrame, 100);
                    }
                }
            };

            this.cancelLoop = () => {
                if (frameId !== null) {
                    if (typeof video.cancelVideoFrameCallback === 'function') {
                        video.cancelVideoFrameCallback(frameId);
                    }
                    if (typeof cancelAnimationFrame === 'function') {
                        cancelAnimationFrame(frameId);
                    }
                    clearTimeout(frameId);
                    frameId = null;
                }
            };

            if (typeof video.requestVideoFrameCallback === 'function') {
                frameId = video.requestVideoFrameCallback(scanFrame);
            } else if (typeof requestAnimationFrame === 'function') {
                frameId = requestAnimationFrame(scanFrame);
            } else {
                frameId = setTimeout(scanFrame, 100);
            }
        }

        stop() {
            this.active = false;
            this._isScanning = false;
            if (this.cancelLoop) {
                this.cancelLoop();
                this.cancelLoop = null;
            }
            if (this.stream) {
                try {
                    this.stream.getTracks().forEach(t => {
                        if (typeof t.stop === 'function') t.stop();
                    });
                } catch (e) {}
                this.stream = null;
            }
            if (this.video) {
                try {
                    if (typeof this.video.pause === 'function') {
                        this.video.pause();
                    }
                    this.video.srcObject = null;
                } catch (e) {}
            }
        }

        scan(imageSource) {
            if (!imageSource) return null;
            try {
                if (imageSource.data && imageSource.width && imageSource.height) {
                    return decodeQR(imageSource);
                }
                if (typeof imageSource.getContext === 'function' && imageSource.width && imageSource.height) {
                    const ctx = imageSource.getContext('2d');
                    if (ctx && typeof ctx.getImageData === 'function') {
                        const imgData = ctx.getImageData(0, 0, imageSource.width, imageSource.height);
                        return decodeQR(imgData);
                    }
                }
                if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
                    const canvas = document.createElement('canvas');
                    const w = imageSource.videoWidth || imageSource.naturalWidth || imageSource.width;
                    const h = imageSource.videoHeight || imageSource.naturalHeight || imageSource.height;
                    if (!w || !h) return null;
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imageSource, 0, 0, w, h);
                    const imgData = ctx.getImageData(0, 0, w, h);
                    return decodeQR(imgData);
                }
            } catch (e) {
                return null;
            }
            return null;
        }
    }
};

const compatExport = {
    kjua,
    Instascan,
    encodeQR,
    decodeQR,
    BarcodeDetector,
    QRCanvas,
    QRCamera,
    rearCamera,
    selfieCamera,
    frameLoop,
    qr: qrBundle
};

const targetGlobal = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : global);
if (targetGlobal) {
    targetGlobal.kjua = kjua;
    targetGlobal.Instascan = Instascan;
    targetGlobal.qr = compatExport;
}

module.exports = compatExport;
