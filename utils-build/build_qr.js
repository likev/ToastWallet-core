const esbuild = require('esbuild');
const path = require('path');

console.log('Building qr-bundle.cjs...');
esbuild.buildSync({
    stdin: {
        contents: `
            import encodeQR from 'qr';
            import decodeQR, { BarcodeDetector } from 'qr/decode.js';
            import { QRCanvas, QRCamera, rearCamera, selfieCamera, frameLoop, svgToPng, gifToPng } from 'qr/dom.js';
            export {
                encodeQR,
                decodeQR,
                BarcodeDetector,
                QRCanvas,
                QRCamera,
                rearCamera,
                selfieCamera,
                frameLoop,
                svgToPng,
                gifToPng
            };
        `,
        resolveDir: __dirname,
        loader: 'js'
    },
    bundle: true,
    format: 'cjs',
    outfile: path.join(__dirname, 'qr-bundle.cjs')
});
console.log('Successfully built qr-bundle.cjs!');
