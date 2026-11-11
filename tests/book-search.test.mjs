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

function setup({ cached = [], google = [], openLibraryCandidates = [], providerFailure = false, cacheFailure = false, stallCache = false, stallSave = false } = {}) {
  const calls = { providers: 0, writes: [] };
  const database = {
    select() { return this; }, abortSignal(signal) { this.signal = signal; return this; },
    ilike(column, pattern) { this.column = column; this.term = pattern.slice(1, -1).toLowerCase(); return this; },
    limit() {
      if (stallCache) {
        const signal = this.signal;
        return new Promise(resolve => signal.addEventListener('abort', () => resolve({ data: null, error: { message: 'Timed out' } }), { once: true }));
      }
      const data = cached.filter((book) => String(book[this.column] || '').toLowerCase().includes(this.term));
      return Promise.resolve({ data: cacheFailure ? null : data, error: cacheFailure ? { message: 'Cache unavailable' } : null });
    },
    upsert(rows) { calls.writes.push(...rows); return { abortSignal: (signal) => stallSave
      ? new Promise(resolve => signal.addEventListener('abort', () => resolve({ error: { message: 'Timed out' } }), { once: true }))
      : Promise.resolve({ error: null }) }; }
  };
  const context = {
    exports: {}, console: { error() {} }, URL, URLSearchParams, AbortSignal: { timeout: ms => AbortSignal.timeout(stallCache || stallSave ? Math.min(ms, 10) : ms) },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body) => ({ json: async () => body }) } };
      if (name === '@/lib/supabase') return { supabase: { from: () => database } };
      throw new Error(`Unexpected import: ${name}`);
    },
    async fetch(url) {
      calls.providers++;
      if (providerFailure) throw new Error('Provider unavailable');
      return { ok: true, json: async () => url.includes('googleapis')
        ? { items: google }
        : { docs: new URL(url).searchParams.get('q').startsWith('title:') ? openLibraryCandidates : [] } };
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

test('original series volumes rank above coloring and activity editions without excluding manga or children’s fiction', async () => {
 const google = ['One Piece Coloring Book', 'One Piece Activity Book for Kids', 'One Piece, Vol. 1', 'One Piece, Vol. 2', 'One Piece Adventure for Young Readers'].map((title,i)=>({id:`book-${i}`,volumeInfo:{title,authors:[i<2?'Companion Publisher':'Eiichiro Oda']}}));
 const {books}=await setup({google}).search('one piece');
 assert.equal(books[0].title,'One Piece, Vol. 1');
 assert.ok(books.findIndex(b=>b.title.includes('Young Readers'))<books.findIndex(b=>b.title.includes('Coloring')));
 assert.ok(books.some(b=>b.title.includes('Coloring')));
});
test('explicit coloring-book searches retain relevant coloring editions',async()=>{
 const {books}=await setup({google:[{id:'color',volumeInfo:{title:'One Piece Coloring Book',authors:['Publisher']}},{id:'original',volumeInfo:{title:'One Piece, Vol. 1',authors:['Eiichiro Oda']}}]}).search('one piece coloring');
 assert.equal(books[0].title,'One Piece Coloring Book');
});
test('author searches prioritize books by that author over titles mentioning their name',async()=>{
 const {books}=await setup({google:[{id:'about',volumeInfo:{title:'Freida McFadden Biography',authors:['Someone Else']}},{id:'novel',volumeInfo:{title:'The Housemaid',authors:['Freida McFadden']}}]}).search('Freida McFadden');
 assert.equal(books[0].title,'The Housemaid');
});

test('an exact provider match is found even when a partial match is cached', async () => {
  const app = setup({ cached: [cached], google: [exact] });
  const { books } = await app.search('Harry Potter');
  assert.equal(books[0].title, 'Harry Potter');
  assert.equal(books.length, 2);
  assert.equal(app.calls.providers, 4);
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

const noExit = { ...cached, external_id: 'no-exit', title: 'No Exit', author: 'Taylor Adams' };
const odyssey = { ...cached, external_id: 'odyssey', title: 'The Odyssey', author: 'Homer' };
test('a one-letter typo suggests No Exit without silently changing the search', async () => {
  const app = setup({ cached: [noExit, { ...cached, title: 'No Exit from Pakistan' }] });
  const result = await app.search('no exir');
  assert.equal(result.books.length, 0);
  assert.deepEqual(result.suggestions.map(book => book.title), ['No Exit']);
});
test('a close two-edit spelling suggests The Odyssey', async () => {
  const app = setup({ cached: [odyssey, { ...cached, title: 'The Jews of Odessa' }] });
  const result = await app.search('the odessy');
  assert.deepEqual(result.suggestions.map(book => book.title), ['The Odyssey']);
});
test('adjacent transposed letters can suggest the intended title', async () => {
  const app = setup({ cached: [noExit] });
  assert.equal((await app.search('no exti')).suggestions[0].title, 'No Exit');
});
test('exact and partial title matches do not trigger spelling suggestions', async () => {
  for (const query of ['no exit', 'no ex']) {
    const app = setup({ cached: [noExit] });
    assert.equal((await app.search(query)).suggestions.length, 0);
  }
});
test('unrelated titles and very short queries are never spelling suggestions', async () => {
  for (const query of ['odzzzz', 'ex', 'no exir from Mars']) {
    const app = setup({ cached: [noExit, odyssey] });
    assert.equal((await app.search(query)).suggestions.length, 0);
  }
});
test('a matching provider cover fills a cached cover without changing its identity', async () => {
  const google = [{ ...exact, volumeInfo: { ...exact.volumeInfo, imageLinks: { thumbnail: 'https://example.com/cover.jpg' } } }];
  const app = setup({ cached: [{ ...cached, title: 'Harry Potter', author: 'J. K. Rowling' }], google });
  const { books } = await app.search('Harry Potter');
  assert.equal(books[0].external_id, cached.external_id);
  assert.equal(books[0].cover_url, 'https://example.com/cover.jpg');
});
test('a missing provider cover can use a known ISBN', async () => {
  const google = [{ ...exact, volumeInfo: { ...exact.volumeInfo, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780141439518' }] } }];
  const app = setup({ google });
  assert.match((await app.search('Harry Potter')).books[0].cover_url, /isbn\/9780141439518-L.jpg/);
});
test('different authors do not share covers', async () => {
  const google = [{ ...exact, volumeInfo: { ...exact.volumeInfo, imageLinks: { thumbnail: 'https://example.com/cover.jpg' } } }];
  const app = setup({ cached: [{ ...cached, title: 'Harry Potter', author: 'Different Author' }], google });
  const result = await app.search('Harry Potter');
  assert.equal(result.books.find(book => book.author === 'Different Author').cover_url, null);
});

for (const [title, query] of [
  ['The Great Gatsby', 'the great gatsbi'],
  ['Frankenstein', 'frankenstien'],
  ['Pride and Prejudice', 'pride and prejudcie'],
  ['To Kill a Mockingbird', 'to kill a mockingbrid'],
  ['The Hobbit', 'the hobibt'],
  ['Velvet Horizons', 'velvet horiznos'],
]) {
  test(`the same spelling rule works for ${title}`, async () => {
    const app = setup({ cached: [{ ...cached, title, author: 'Fixture Author' }] });
    const result = await app.search(query);
    assert.equal(result.suggestions[0]?.title, title);
  });
}

test('uncached titles can be suggested using Open Library candidates', async () => {
  const app = setup({ openLibraryCandidates: [
    { key: '/works/OL1W', title: 'The Hobbit', author_name: ['J. R. R. Tolkien'], cover_i: 123 },
    { key: '/works/OL2W', title: 'The History of Hoboken', author_name: ['Another Author'] },
  ] });
  const result = await app.search('the hobibt');
  assert.deepEqual(result.suggestions.map(book => book.title), ['The Hobbit']);
  assert.match(result.suggestions[0].external_id, /^openlibrary-/);
});
test('an unrelated provider candidate is never shown as a spelling suggestion', async () => {
  const app = setup({ openLibraryCandidates: [
    { key: '/works/OL1W', title: 'The History of Hoboken', author_name: ['Another Author'] },
  ] });
  assert.equal((await app.search('the hobibt')).suggestions.length, 0);
});
test('cached spelling suggestions survive an Open Library outage', async () => {
  const app = setup({ cached: [noExit], providerFailure: true });
  assert.equal((await app.search('no exir')).suggestions[0].title, 'No Exit');
});

test('repeat searches reuse a complete merged response without new provider calls',async()=>{
 const app=setup({cached:[cached],google:[exact]});
 const first=await app.search('Harry Potter');const calls=app.calls.providers;
 const second=await app.search('Harry Potter');
 assert.deepEqual(second,first);assert.equal(app.calls.providers,calls);assert.equal(second.books.length,2);
});

test('empty results are not retained when a later provider request can succeed',async()=>{
 const google=[];const app=setup({google});
 assert.equal((await app.search('Harry Potter')).books.length,0);
 google.push(exact);
 assert.equal((await app.search('Harry Potter')).books[0].title,'Harry Potter');
});

test('provider outages without cached matches return an error rather than false no-results',async()=>{
 const app=setup({providerFailure:true});
 const result=await app.search('Harry Potter');
 assert.match(result.error,/temporarily unavailable/);
 assert.equal(result.books.length,0);
});


test('a stalled database lookup does not prevent external results',{timeout:1000},async()=>{
 const app=setup({google:[exact],stallCache:true});
 assert.equal((await app.search('Harry Potter')).books[0].title,'Harry Potter');
});
test('a stalled cache write does not hold back discovered books',{timeout:1000},async()=>{
 const app=setup({google:[exact],stallSave:true});
 assert.equal((await app.search('Harry Potter')).books[0].title,'Harry Potter');
});
