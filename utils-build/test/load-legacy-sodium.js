'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

let cachedSodium = null;

function loadLegacySodium() {
  if (cachedSodium) return cachedSodium;
  const sodiumPath = path.resolve(__dirname, '../../www/js/sodium.js');
  let src = null;
  if (fs.existsSync(sodiumPath)) {
    src = fs.readFileSync(sodiumPath, 'utf8');
  } else {
    try {
      src = execSync('git show xrpl.js-4.6.0:www/js/sodium.js', {
        cwd: path.resolve(__dirname, '../..'),
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
    } catch (e) {
      return null;
    }
  }

  const origWindow = globalThis.window;
  const origSelf = globalThis.self;
  globalThis.window = globalThis;
  globalThis.self = globalThis;

  try {
    vm.runInThisContext('(function(exports, module, define, require){\n' + src + '\n})()', { filename: 'sodium.js' });
    cachedSodium = globalThis.sodium;
  } finally {
    if (origWindow !== undefined) {
      globalThis.window = origWindow;
    } else {
      delete globalThis.window;
    }
    if (origSelf !== undefined) {
      globalThis.self = origSelf;
    } else {
      delete globalThis.self;
    }
    delete globalThis.sodium;
  }
  return cachedSodium;
}

module.exports = loadLegacySodium;
