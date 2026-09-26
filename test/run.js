// Node runner: `node test/run.js` (or `npm test`). The browser equivalent is test/index.html.
const harness = require('./harness.js');

globalThis.test = harness.test;
globalThis.assert = harness.assert;
globalThis.Fountain = require('../src/fountain.js');
globalThis.Editing = require('../src/editing.js');
globalThis.Library = require('../src/library.js');
globalThis.Importing = require('../src/importing.js');
globalThis.Suggest = require('../src/suggest.js');
globalThis.Store = require('../src/store.js');
globalThis.Paginate = require('../src/paginate.js');
globalThis.Stats = require('../src/stats.js');
globalThis.Outline = require('../src/outline.js');
globalThis.Versions = require('../src/versions.js');

require('./fountain.test.js');
require('./editing.test.js');
require('./library.test.js');
require('./importing.test.js');
require('./suggest.test.js');
require('./store.test.js');
require('./paginate.test.js');
require('./stats.test.js');
require('./outline.test.js');
require('./versions.test.js');
require('./structure.test.js'); // reads files, so it runs here only (not in the browser runner)

const results = harness.runTests();
let failed = 0;
for (const r of results) {
    if (r.ok) console.log('  ok   ' + r.name);
    else { failed++; console.log('  FAIL ' + r.name + '\n         ' + r.error); }
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
process.exit(failed ? 1 : 0);
