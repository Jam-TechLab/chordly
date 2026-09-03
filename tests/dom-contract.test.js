const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'static', 'js', 'app.js'),
  'utf8'
);
const html = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'templates', 'index.html'),
  'utf8'
);

const referencedIds = Array.from(appJs.matchAll(/getElementById\(['"]([^'"]+)/g))
  .map(match => match[1]);
const missingIds = Array.from(new Set(referencedIds))
  .filter(id => !html.includes(`id="${id}"`));

assert.deepEqual(missingIds, [], `Missing DOM ids: ${missingIds.join(', ')}`);

const priorScriptIndex = html.indexOf('/static/js/harmony-priors.js');
const engineScriptIndex = html.indexOf('/static/js/chord-engine.js');
assert.ok(priorScriptIndex >= 0, 'Harmony prior asset is not loaded');
assert.ok(priorScriptIndex < engineScriptIndex, 'Harmony prior must load before the chord engine');
assert.ok(appJs.includes('function generateSectionsInContext(songData)'));
console.log('DOM contract test passed');
