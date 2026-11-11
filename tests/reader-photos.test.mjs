import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const id = '11111111-1111-4111-8111-111111111111';
const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const path = `${id}/${uuid}.jpg`;
const old = `${id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg`;
const code = ts.transpileModule(fs.readFileSync(new URL('../lib/reader-photos.ts', import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({ signedIn=true, uploadError=false, profileError=false }={}) {
 const calls=[];
 const bucket={getPublicUrl: value=>({data:{publicUrl:`https://photos.example/${value}`}}),upload:async(p)=>{calls.push(['upload',p]);return{error:uploadError?new Error('Upload failed'):null}},remove:async(paths)=>{calls.push(['remove',...paths]);return{error:null}}};
 const supabase={
  auth:{getUser:async()=>({data:{user:signedIn?{id,is_anonymous:false}:null}})},
  storage:{from:()=>bucket},
  from:()=>({update(value) {
   calls.push(['update',value.avatar_path]);
   const result={data:profileError?null:{user_id:id},error:profileError?new Error('Profile failed'):null};
   return {eq:()=>({select:()=>({single:async()=>result})})};
  }}),
 };
 const context={exports:{},Blob,crypto:{randomUUID:()=>uuid},window:{dispatchEvent:()=>{}},CustomEvent:class{},require:name=>name==='@/lib/supabase'?{supabase}:{validReaderId:value=>/^[a-f0-9-]{36}$/i.test(value)}};
 vm.runInNewContext(code,context);return{api:context.exports,calls};
}
test('avatar paths cannot introduce remote URLs or another account folder',()=>{
 const {api}=fixture();assert.equal(api.validAvatarPath(path,id),true);
 for(const value of ['https://evil.example/p.jpg',`${id}/../${uuid}.jpg`,`${id}/${uuid}.svg`,path.replace(id,'22222222-2222-4222-8222-222222222222')])assert.equal(api.validAvatarPath(value,id),false);
 assert.equal(api.avatarUrl('https://evil.example/a.jpg'),null);
});
test('saving a photo uploads first, publishes its path, then cleans the old file',async()=>{
 const {api,calls}=fixture();assert.equal(await api.saveReaderPhoto(id,new Blob(['image'],{type:'image/jpeg'}),old),path);
 assert.deepEqual(calls,[['upload',path],['update',path],['remove',old]]);
});
test('upload failure preserves the old photo and its profile path',async()=>{
 const {api,calls}=fixture({uploadError:true});await assert.rejects(api.saveReaderPhoto(id,new Blob(['image'],{type:'image/jpeg'}),old),/Upload failed/);
 assert.deepEqual(calls,[['upload',path]]);
});
test('failed profile save removes the new upload but keeps the old photo',async()=>{
 const {api,calls}=fixture({profileError:true});await assert.rejects(api.saveReaderPhoto(id,new Blob(['image'],{type:'image/jpeg'}),old),/Profile failed/);
 assert.deepEqual(calls,[['upload',path],['update',path],['remove',path]]);
});
test('photo removal clears the profile before deleting the old asset',async()=>{
 const {api,calls}=fixture();assert.equal(await api.saveReaderPhoto(id,null,old),null);assert.deepEqual(calls,[['update',null],['remove',old]]);
});
test('signed out and unsupported files cannot write profile photos',async()=>{
 const {api,calls}=fixture({signedIn:false});await assert.rejects(api.saveReaderPhoto(id,null,old),/sign in/);assert.equal(calls.length,0);
 const signedIn=fixture();await assert.rejects(signedIn.api.prepareReaderPhoto(new File(['svg'],'x.svg',{type:'image/svg+xml'})),/JPG, PNG/);assert.equal(signedIn.calls.length,0);
});
