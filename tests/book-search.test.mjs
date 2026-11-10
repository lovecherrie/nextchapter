import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual route with isolated providers and a database fixture.
// These tests never call external services or write production data.
const source = ts.transpileModule(
  fs.readFileSync(new URL('../app/api/books/search/route.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

function setup({ cached = [], google = [], providerFailure = false, cacheFailure = false } = {}) {
  const calls = { providers: 0, writes: [] };
  const database = {
    select() { return this; }, ilike() { return this; },
    limit() { return Promise.resolve({ data: cacheFailure ? null : cached, error: cacheFailure ? { message: 'Cache unavailable' } : null }); },
    upsert(rows) { calls.writes.push(...rows); return Promise.resolve({ error: null }); }
  };
  const context = {
    exports: {}, console: { error() {} }, URLSearchParams, AbortSignal,
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body) => ({ json: async () => body }) } };
      if (name === '@/lib/supabase') return { supabase: { from: () => database } };
      throw new Error(`Unexpected import: ${name}`);
    },
    async fetch(url) {
      calls.providers++;
      if (providerFailure) throw new Error('Provider unavailable');
      return { ok: true, json: async () => url.includes('googleapis') ? { items: google } : { docs: [] } };
    }
  };
  vm.runInNewContext(source, context);
  return {
    calls,
    async search(query) {
      const response = await context.exports.GET({ nextUrl: new URL(`http://localhost/api/books/search?q=${encodeURIComponent(query)}`) });
      return JSON.parse(JSON.stringify(await response.json()));
    }
  };
}
const cached = { id: 'uuid', external_id: 'google-cached', title: 'Harry Potter Companion', author: 'A Reader', cover_url: null };
const exact = { id: 'exact', volumeInfo: { title: 'Harry Potter', authors: ['J. K. Rowling'] } };

test('an exact provider match is found even when a partial match is cached', async () => {
  const app = setup({ cached: [cached], google: [exact] });
  const { books } = await app.search('Harry Potter');
  assert.equal(books[0].title, 'Harry Potter');
  assert.equal(books.length, 2);
  assert.equal(app.calls.providers, 3);
  assert.equal(app.calls.writes.length, 1);
});
test('provider outages preserve cached books', async () => {
  const app = setup({ cached: [cached], providerFailure: true });
  const { books } = await app.search('Harry Potter');
  assert.equal(books[0].external_id, cached.external_id);
  assert.equal(app.calls.writes.length, 0);
});
test('cache errors do not prevent external search', async () => {
  const app = setup({ cacheFailure: true, google: [exact] });
  assert.equal((await app.search('Harry Potter')).books[0].title, 'Harry Potter');
});
test('duplicate provider editions preserve the existing cached identity', async () => {
  const app = setup({ cached: [{ ...cached, title: 'Harry Potter', author: 'J. K. Rowling' }], google: [exact] });
  const { books } = await app.search('Harry Potter');
  assert.equal(books.length, 1);
  assert.equal(books[0].external_id, cached.external_id);
});
test('short queries do not call providers or save books', async () => {
  const app = setup();
  assert.deepEqual(await app.search('a'), { books: [] });
  assert.equal(app.calls.providers, 0);
  assert.equal(app.calls.writes.length, 0);
});
