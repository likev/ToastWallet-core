'use strict';
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const svgsDir = path.join(rootDir, 'www/fontawesome/svgs');
const outputCss = path.join(rootDir, 'www/css/icons.css');

const solidIcons = [
    'backspace',
    'camera',
    'chevron-circle-down',
    'chevron-circle-left',
    'chevron-down',
    'chevron-left',
    'chevron-up',
    'circle',
    'circle-notch',
    'cog',
    'copy',
    'ellipsis-v',
    'exchange-alt',
    'external-link-alt',
    'eye',
    'home',
    'inbox',
    'lock',
    'medkit',
    'paper-plane',
    'paste',
    'plus-circle',
    'question',
    'question-circle',
    'redo-alt',
    'times',
    'times-circle',
    'toggle-off',
    'toggle-on',
    'spinner'
];

function svgToDataUri(svgContent) {
    // Strip comments, XML declarations, extra whitespace
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\?xml[\s\S]*?\?>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return `url("data:image/svg+xml,${encodeURIComponent(cleanSvg)}")`;
}

function parseSvg(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const vbMatch = content.match(/viewBox=["']([0-9\.\s]+)["']/i);
    let width = 512;
    let height = 512;
    if (vbMatch) {
        const parts = vbMatch[1].trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
            width = parts[2];
            height = parts[3];
        }
    }
    return {
        dataUri: svgToDataUri(content),
        width,
        height,
        emWidth: Math.round((width / height) * 1000) / 1000
    };
}

const vars = [];
const rules = [];

// Base icon rules
rules.push(`/* First-party SVG mask icon stylesheet */
:root {`);

// Process solid icons
for (const icon of solidIcons) {
    const file = path.join(svgsDir, 'solid', `${icon}.svg`);
    const parsed = parseSvg(file);
    vars.push(`  --icon-${icon}: ${parsed.dataUri};`);
}

// Process regular copy
const regCopyFile = path.join(svgsDir, 'regular/copy.svg');
const parsedRegCopy = parseSvg(regCopyFile);
vars.push(`  --icon-copy-regular: ${parsedRegCopy.dataUri};`);

rules.push(vars.join('\n'));
rules.push(`}\n`);

rules.push(`.fa, .fas, .far {
  display: inline-block;
  font-style: normal;
  font-variant: normal;
  line-height: 1;
  vertical-align: -0.125em;
  height: 1em;
  width: 1em;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}\n`);

// Class rules
for (const icon of solidIcons) {
    const file = path.join(svgsDir, 'solid', `${icon}.svg`);
    const parsed = parseSvg(file);
    const widthStyle = parsed.emWidth !== 1 ? `  width: ${parsed.emWidth}em;\n` : '';

    if (icon === 'copy') {
        rules.push(`.fa-copy, .fas.fa-copy {
${widthStyle}  -webkit-mask-image: var(--icon-copy);
  mask-image: var(--icon-copy);
}
.far.fa-copy {
  width: ${parsedRegCopy.emWidth}em;
  -webkit-mask-image: var(--icon-copy-regular);
  mask-image: var(--icon-copy-regular);
}\n`);
    } else if (icon === 'exchange-alt') {
        rules.push(`.fa-exchange, .fa-exchange-alt {
${widthStyle}  -webkit-mask-image: var(--icon-exchange-alt);
  mask-image: var(--icon-exchange-alt);
}\n`);
    } else {
        rules.push(`.fa-${icon} {
${widthStyle}  -webkit-mask-image: var(--icon-${icon});
  mask-image: var(--icon-${icon});
}\n`);
    }
}

// Animation
rules.push(`@keyframes fa-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.fa-spin {
  animation: fa-spin 2s infinite linear;
}
`);

const finalCss = rules.join('\n');
fs.writeFileSync(outputCss, finalCss, 'utf8');
console.log(`Successfully built ${outputCss} (${finalCss.length} bytes)`);
