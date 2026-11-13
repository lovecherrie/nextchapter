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
async function bookDetails({ title = 'No Exit', google = [googleItem], library = [libraryDoc], googleUnavailable = false, topics = false, author = "Taylor Adams", work = { description: { value: "An Open Library description." } }, edition = {}, stalledGoogle = false } = {}) {
  const calls = [];
  const context = {
    exports: {}, URLSearchParams, AbortController, setTimeout: (fn, ms) => setTimeout(fn, stalledGoogle ? 20 : ms), clearTimeout,
    console: { error() {} },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    async fetch(url) {
      calls.push(url);
      if (url.includes('googleapis') && stalledGoogle) return { ok: true, json: () => new Promise(() => {}) };
      if (url.includes('googleapis')) return { ok: !googleUnavailable, json: async () => ({ items: google }) };
      if (url.includes('/search.json')) return { ok: true, json: async () => ({ docs: library }) };
      return { ok: true, json: async () => url.includes('/books/') ? edition : work };
    },
  };
  vm.runInNewContext(compile('../app/api/book/details/route.ts'), context);
  const response = await context.exports.GET({ nextUrl: new URL(`http://localhost/api/book/details?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}${topics ? '&topics=1' : ''}`) });
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

test('genre-only lookup merges catalog subjects and skips work descriptions', async () => {
 const {data,calls,response}=await bookDetails({topics:true,google:[{volumeInfo:{...googleItem.volumeInfo,categories:['Fiction']}}],library:[{...libraryDoc,subject:['Thrillers','Suspense','Mystery']}]});
 assert.equal(response.status,200);assert.deepEqual(data.categories,['Fiction','Thrillers','Suspense','Mystery']);assert.equal(calls.length,2);assert.equal('description' in data,false);
});
test('genre-only lookup does not use a different author’s same-title book',async()=>{
 const {response}=await bookDetails({topics:true,google:[],library:[{...libraryDoc,author_name:['Wrong Author'],subject:['Romance']}]});assert.equal(response.status,503);
});

test('same title by the wrong author cannot supply a description from either provider', async () => {
 const {data}=await bookDetails({google:[{volumeInfo:{...googleItem.volumeInfo,authors:['Someone Else']}}],library:[{...libraryDoc,author_name:['Someone Else']}]});
 assert.equal(data.description,null); assert.equal(data.cover,null);
});
test('non-Latin titles and authors retain their distinct identities', async () => {
 const {data}=await bookDetails({title:'人間失格',author:'太宰治',google:[{volumeInfo:{title:'別の本',authors:['別人'],description:'Wrong'}},{volumeInfo:{title:'人間失格',authors:['太宰治'],description:'Correct description'}}],library:[]});
 assert.equal(data.description,'Correct description');
});
test('edition description fills a missing work description without inventing text', async () => {
 const {data,calls}=await bookDetails({google:[],library:[{...libraryDoc,edition_key:['OL123M']}],work:{},edition:{title:'No Exit',description:{value:'<p>Edition description.</p>'},number_of_pages:333,publishers:['Edition Publisher'],publish_date:'2018'}});
 assert.equal(data.description,'Edition description.'); assert.equal(data.pageCount,333); assert.equal(data.publisher,'Edition Publisher'); assert.ok(calls.some(url=>url.endsWith('/books/OL123M.json')));
});
test('unrelated edition cannot overwrite matched work metadata', async () => {
 const {data}=await bookDetails({google:[],library:[{...libraryDoc,edition_key:['OL123M']}],work:{},edition:{title:'A Different Book',description:'Wrong',number_of_pages:999}});
 assert.equal(data.description,null);assert.equal(data.pageCount,null);
});
test('a stalled Google response body times out and preserves the other provider result', async () => {
 const {data}=await bookDetails({stalledGoogle:true});assert.equal(data.description,'An Open Library description.');
});
