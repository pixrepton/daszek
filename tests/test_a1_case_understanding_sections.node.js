// A1: case detail must show an honest "Dlaczego to widzę" / "Co się zmieniło"
// explanation when Node B provides it (via why_on_desk / what_changed_pl on
// the case row), and must omit the section entirely — never a placeholder —
// when Node B did not provide it (no fresh, correlated Understanding).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_JS = path.join(__dirname, '..', 'public', 'app.js');
const SOURCE = fs.readFileSync(APP_JS, 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = SOURCE.indexOf(marker);
  assert.notStrictEqual(start, -1, `Missing function ${name}`);
  const bodyStart = SOURCE.indexOf('{', start);
  let depth = 1;
  let index = bodyStart + 1;
  while (depth > 0 && index < SOURCE.length) {
    const ch = SOURCE[index];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    index += 1;
  }
  assert.strictEqual(depth, 0, `Unbalanced braces for ${name}`);
  return SOURCE.slice(start, index);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadFns(names) {
  const code = names.map(extractFunction).join('\n');
  const context = { escapeHtml, console };
  vm.createContext(context);
  vm.runInContext(`${code}\nthis.__exports = { ${names.join(', ')} };`, context);
  return context.__exports;
}

test('renderWhyOnDeskSection shows the honest reason when Node B provided one', () => {
  const { renderWhyOnDeskSection } = loadFns(['renderWhyOnDeskSection']);
  const html = renderWhyOnDeskSection({ why_on_desk: 'Klient po raz pierwszy podal konkretny termin.' });
  assert.match(html, /Dlaczego to widzę/);
  assert.match(html, /Klient po raz pierwszy podal konkretny termin\./);
});

test('renderWhyOnDeskSection renders nothing when Node B did not provide a reason', () => {
  const { renderWhyOnDeskSection } = loadFns(['renderWhyOnDeskSection']);
  assert.strictEqual(renderWhyOnDeskSection({}), '');
  assert.strictEqual(renderWhyOnDeskSection({ why_on_desk: '   ' }), '');
});

test('renderWhatChangedSection shows the honest delta when Node B provided one', () => {
  const { renderWhatChangedSection } = loadFns(['renderWhatChangedSection']);
  const html = renderWhatChangedSection({ what_changed_pl: 'Klient potwierdzil termin wizji lokalnej.' });
  assert.match(html, /Co się zmieniło/);
  assert.match(html, /Klient potwierdzil termin wizji lokalnej\./);
});

test('renderWhatChangedSection renders nothing when Node B did not provide a delta', () => {
  const { renderWhatChangedSection } = loadFns(['renderWhatChangedSection']);
  assert.strictEqual(renderWhatChangedSection({}), '');
});
