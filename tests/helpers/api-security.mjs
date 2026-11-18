import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const source=ts.transpileModule(fs.readFileSync(new URL('../../lib/api-security.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
export function apiSecurityFixture({budget=true,error=null}={}){
 const calls=[];
 const context={exports:{},URL,Request,Response,AbortSignal,Uint8Array,TextDecoder,setTimeout,clearTimeout,Date,Map,console,
 require(name){if(name==='node:crypto')return crypto;if(name==='@/lib/supabase')return {supabase:{rpc:action=>{calls.push(action);return {abortSignal:async()=>({data:budget,error})}}}};throw Error(name)}};
 vm.runInNewContext(source,context);return {...context.exports,calls};
}
