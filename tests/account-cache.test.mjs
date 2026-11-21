import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../lib/account-cache.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(browser=true){let now=1000;const context={exports:{},Date:{now:()=>now},...(browser?{window:{}}:{})};vm.runInNewContext(code,context);return{api:context.exports,tick:ms=>{now+=ms}};}
test('account presentation cache clears on logout and switching accounts',()=>{
 const {api}=fixture();api.syncAccountCache('alice');api.writeAccountCache('profile','alice',{private:'shelf'});assert.equal(api.readAccountCache('profile').private,'shelf');
 api.syncAccountCache('bob');assert.equal(api.readAccountCache('profile'),undefined);api.writeAccountCache('profile','alice',{private:'stale response'});assert.equal(api.readAccountCache('profile'),undefined);
 api.writeAccountCache('profile','bob',{private:'bob shelf'});api.syncAccountCache(null);assert.equal(api.readAccountCache('profile'),undefined);
});
test('account presentation cache expires and invalidates on account edits',()=>{
 const {api,tick}=fixture();api.syncAccountCache('alice');api.writeAccountCache('reader','alice',{photo:'old'});tick(30001);assert.equal(api.readAccountCache('reader'),undefined);
 api.writeAccountCache('reader','alice',{photo:'new'});api.writeAccountCache('profile','alice',{books:[]});api.invalidateAccountCache('profile');assert.equal(api.readAccountCache('profile'),undefined);assert.equal(api.readAccountCache('reader').photo,'new');
 api.syncAccountCache('alice',true);assert.equal(api.readAccountCache('reader'),undefined);
});
test('account presentation cache cannot retain private data in server module state',()=>{
 const {api}=fixture(false);api.syncAccountCache('alice');api.writeAccountCache('profile','alice',{private:true});assert.equal(api.readAccountCache('profile'),undefined);
});

const readersCode=ts.transpileModule(fs.readFileSync(new URL('../lib/readers.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function readerApi(cache,getUser) {
 const context={exports:{},Set,require(name){
  if(name==='./account-cache')return cache;
  if(name==='@/lib/supabase')return {supabase:{auth:{getUser}}};
  throw Error(name);
 }};
 vm.runInNewContext(readersCode,context);return context.exports;
}
test('a delayed identity response cannot restore an account after switching readers',async()=>{
 const {api:cache}=fixture();cache.syncAccountCache('alice');cache.writeAccountCache('profile','alice',{private:'alice shelf'});
 let release;let calls=0;
 const readers=readerApi(cache,()=>++calls===1?new Promise(resolve=>release=resolve):Promise.resolve({data:{user:{id:'bob',is_anonymous:false}}}));
 const pending=readers.accountUser();cache.syncAccountCache('bob');release({data:{user:{id:'alice',is_anonymous:false}}});
 assert.equal((await pending).id,'bob');assert.equal(cache.readAccountCache('user').id,'bob');assert.equal(cache.readAccountCache('profile'),undefined);
});
test('a delayed identity response cannot sign a reader back in after logout',async()=>{
 const {api:cache}=fixture();cache.syncAccountCache('alice');let release;let calls=0;
 const readers=readerApi(cache,()=>++calls===1?new Promise(resolve=>release=resolve):Promise.resolve({data:{user:null}}));
 const pending=readers.accountUser();cache.syncAccountCache(null);release({data:{user:{id:'alice',is_anonymous:false}}});
 assert.equal(await pending,null);assert.equal(cache.readAccountCache('user'),undefined);
});
test('identity rechecks remain bounded during repeated account changes',async()=>{
 const {api:cache}=fixture();let calls=0;
 const readers=readerApi(cache,async()=>{cache.syncAccountCache('changed-'+(++calls));return {data:{user:{id:'stale',is_anonymous:false}}};});
 assert.equal(await readers.accountUser(),null);assert.equal(calls,2);
});
