import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../lib/fetch-json.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function helper(fetch){const context={exports:{},fetch,AbortController,AbortSignal,setTimeout,clearTimeout};vm.runInNewContext(source,context);return context.exports.fetchJsonWithTimeout}
test('the deadline includes a stalled body after response headers arrive',{timeout:1000},async()=>{
 const call=helper(async(_url,{signal})=>({ok:true,json:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Body aborted')),{once:true}))}));
 await assert.rejects(call('https://example.com',{},20),/Body aborted/);
});
test('successful JSON parsing completes before the deadline',async()=>{
 const call=helper(async()=>({ok:true,json:async()=>({books:[1]})}));assert.deepEqual(await call('https://example.com',{},100),{books:[1]});
});
test('HTTP failures do not wait for an error response body',async()=>{
 const call=helper(async()=>({ok:false,status:429,json:()=>new Promise(()=>{})}));await assert.rejects(call('https://example.com',{},100),/429/);
});
