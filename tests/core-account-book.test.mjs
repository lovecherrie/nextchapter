import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(relativePath) {
  return ts.transpileModule(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const redirectContext = { exports: {}, URL };
vm.runInNewContext(compile('../lib/auth-redirect.ts'), redirectContext);
const { safeAuthReturn } = redirectContext.exports;
const origin = 'https://www.aepilog.com';

test('login can return to the original book, including its query and anchor', () => {
  const destination = '/book?id=google-one&title=No+Exit#ratings';
  assert.equal(safeAuthReturn(origin + destination, origin), destination);
  assert.equal(safeAuthReturn(destination, origin), destination);
});
test('login never follows an offsite destination or returns to the login page', () => {
  for (const value of [null, '', 'https://other.example/profile', '//other.example/book', 'javascript:alert(1)', '/auth', '/auth/?next=/book']) {
    assert.equal(safeAuthReturn(value, origin), '/profile', String(value));
  }
});

const googleItem = { volumeInfo: {
  title: 'No Exit', authors: ['Taylor Adams'], description: '<p>A reliable &amp; complete description.</p>',
  imageLinks: { thumbnail: 'http://example.com/google-cover.jpg' }, pageCount: 300, publisher: 'Fixture Publisher',
} };
const libraryDoc = { key: '/works/OL1W', title: 'No Exit', author_name: ['Taylor Adams'], cover_i: 12345, isbn: ['123456789X'], first_publish_year: 2017 };
async function bookDetails({ title = 'No Exit', google = [googleItem], library = [libraryDoc], googleUnavailable = false } = {}) {
  const calls = [];
  const context = {
    exports: {}, URLSearchParams, AbortController, setTimeout, clearTimeout,
    console: { error() {} },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    async fetch(url) {
      calls.push(url);
      if (url.includes('googleapis')) return { ok: !googleUnavailable, json: async () => ({ items: google }) };
      if (url.includes('/search.json')) return { ok: true, json: async () => ({ docs: library }) };
      return { ok: true, json: async () => ({ description: { value: 'An Open Library description.' } }) };
    },
  };
  vm.runInNewContext(compile('../app/api/book/details/route.ts'), context);
  const response = await context.exports.GET({ nextUrl: new URL(`http://localhost/api/book/details?title=${encodeURIComponent(title)}&author=Taylor%20Adams`) });
  return { response, data: await response.json(), calls };
}

test('book details return the matching description and cover', async () => {
  const { response, data } = await bookDetails();
  assert.equal(response.status, 200);
  assert.equal(data.description, 'A reliable & complete description.');
  assert.equal(data.cover, 'https://example.com/google-cover.jpg');
  assert.equal(data.pageCount, 300);
});
test('Open Library supplies the actual document cover when Google is unavailable', async () => {
  const { data } = await bookDetails({ googleUnavailable: true });
  assert.equal(data.description, 'An Open Library description.');
  assert.equal(data.cover, 'https://covers.openlibrary.org/b/id/12345-L.jpg?default=false');
});
test('unrelated provider books do not supply descriptions for the requested title', async () => {
  const { data } = await bookDetails({ google: [{ volumeInfo: { title: 'An Unrelated Book', authors: ['Different Author'], description: 'Wrong description' } }], library: [] });
  assert.equal(data.description, null);
  assert.equal(data.cover, null);
});
test('book details reject missing titles without querying providers', async () => {
  const { response, calls } = await bookDetails({ title: '' });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
