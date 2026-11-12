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
 api.writeAccountCache('reader','alice',{photo:'new'});api.syncAccountCache('alice',true);assert.equal(api.readAccountCache('reader'),undefined);
});
test('account presentation cache cannot retain private data in server module state',()=>{
 const {api}=fixture(false);api.syncAccountCache('alice');api.writeAccountCache('profile','alice',{private:true});assert.equal(api.readAccountCache('profile'),undefined);
});
