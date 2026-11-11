import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(path){return ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText}
const library={exports:{},URL};vm.runInNewContext(compile('../lib/share-card.ts'),library);
const safe=library.exports;
test('share covers accept established image endpoints and reject arbitrary origins and redirects',()=>{
 for(const url of ['https://covers.openlibrary.org/b/id/123-L.jpg','https://books.google.com/books/content?id=abc&img=1&zoom=1'])assert.equal(safe.safeCoverUrl(url),url);
 for(const url of ['http://covers.openlibrary.org/b/id/1.jpg','https://covers.openlibrary.org.evil.test/b/id/1.jpg','https://books.google.com@127.0.0.1/books/content','https://books.google.com:444/books/content','https://books.google.com/redirect?url=http://127.0.0.1','https://127.0.0.1/x.png','data:image/png,x','https://covers.openlibrary.org/b/id/a.svg'])assert.equal(safe.safeCoverUrl(url),null,url);
 assert.equal(safe.shareFilename('../A Book: /\\ special?'),'aepilog-A-Book-special.png');
});
async function route(url,fetcher){let calls=0;const context={exports:{},URL,Response,Blob,AbortSignal,require:()=>safe,fetch:async(...args)=>{calls++;return fetcher(...args)}};vm.runInNewContext(compile('../app/api/share-cover/route.ts'),context);return{response:await context.exports.GET(new Request(`http://localhost/api/share-cover?url=${encodeURIComponent(url)}`)),calls}}
test('the cover endpoint rejects untrusted URLs without making a network request',async()=>{
 const result=await route('https://127.0.0.1/private',()=>{throw new Error('must not fetch')});assert.equal(result.response.status,400);assert.equal(result.calls,0);
});
test('the cover endpoint disables redirects and returns image bytes with caching',async()=>{
 const result=await route('https://covers.openlibrary.org/b/id/1-L.jpg',async(_url,options)=>{assert.equal(options.redirect,'error');return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}})});
 assert.equal(result.response.status,200);assert.equal(result.response.headers.get('content-type'),'image/jpeg');assert.deepEqual([...new Uint8Array(await result.response.arrayBuffer())],[1,2,3]);
});
test('oversized and non-image responses cannot be served as covers',async()=>{
 for(const headers of [{'content-type':'text/html'},{'content-type':'image/jpeg','content-length':'99999999'}]){
  const result=await route('https://covers.openlibrary.org/b/id/1-L.jpg',async()=>new Response('fixture',{headers}));assert.equal(result.response.status,404);
 }
 const result=await route('https://covers.openlibrary.org/b/id/1-L.jpg',async()=>new Response(new Uint8Array(2*1024*1024+1),{headers:{'content-type':'image/jpeg'}}));assert.equal(result.response.status,404);
});
