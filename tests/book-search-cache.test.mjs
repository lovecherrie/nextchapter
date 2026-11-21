import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(fs.readFileSync(new URL('../lib/book-search-cache.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture(browser = true) {
  let now = 1000;
  const context = { exports: {}, Date: { now: () => now }, ...(browser ? { window: {} } : {}) };
  vm.runInNewContext(compiled, context);
  return { ...context.exports, advance: ms => { now += ms; } };
}
const result = title => ({ books: [{ title }], suggestions: [] });

test('returning to a recent public search reuses results and typo suggestions', () => {
  const cache = fixture();
  const value = { books: [{ title: 'Other result' }], suggestions: [{ title: 'The Odyssey' }] };
  cache.rememberBookSearch('  The Odessy ', value);
  assert.equal(cache.cachedBookSearch('the odessy'), value);
  assert.equal(cache.cachedBookSearch('a different query'), undefined);
  cache.advance(120001);
  assert.equal(cache.cachedBookSearch('the odessy'), undefined);
});
test('empty responses do not prevent another search from finding a recovered result', () => {
  const cache = fixture();
  cache.rememberBookSearch('No Exit', { books: [], suggestions: [] });
  assert.equal(cache.cachedBookSearch('No Exit'), undefined);
  cache.rememberBookSearch('No Exit', result('No Exit'));
  assert.equal(cache.cachedBookSearch('No Exit').books[0].title, 'No Exit');
});
test('catalogue cache stays bounded and retains a refreshed query', () => {
  const cache = fixture();
  for (let index = 0; index < 12; index++) cache.rememberBookSearch(String(index), result(String(index)));
  cache.rememberBookSearch('0', result('refreshed'));
  cache.rememberBookSearch('12', result('new'));
  assert.equal(cache.cachedBookSearch('1'), undefined);
  assert.equal(cache.cachedBookSearch('0').books[0].title, 'refreshed');
});
test('catalogue presentation cache never persists in server module state', () => {
  const cache = fixture(false);
  cache.rememberBookSearch('No Exit', result('No Exit'));
  assert.equal(cache.cachedBookSearch('No Exit'), undefined);
});
