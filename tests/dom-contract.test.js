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
console.log('DOM contract test passed');
