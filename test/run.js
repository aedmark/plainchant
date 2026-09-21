// Node runner: `node test/run.js` (or `npm test`). The browser equivalent is test/index.html.
const harness = require('./harness.js');

globalThis.test = harness.test;
globalThis.assert = harness.assert;
globalThis.Fountain = require('../src/fountain.js');
globalThis.Editing = require('../src/editing.js');

require('./fountain.test.js');
require('./editing.test.js');

const results = harness.runTests();
let failed = 0;
for (const r of results) {
    if (r.ok) console.log('  ok   ' + r.name);
    else { failed++; console.log('  FAIL ' + r.name + '\n         ' + r.error); }
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
process.exit(failed ? 1 : 0);
