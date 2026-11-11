import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const code=ts.transpileModule(fs.readFileSync(new URL('../lib/readers.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(resolve=()=>({data:[],error:null}),user=null){
 const calls=[];
 class Query{
  constructor(table){this.table=table;this.steps=[];calls.push(this)}
  then(yes,no){return Promise.resolve(resolve(this)).then(yes,no)}
 }
 for(const method of ['select','eq','ilike','order','range','limit','abortSignal','in','insert','delete','update'])Query.prototype[method]=function(...args){this.steps.push({method,args});return this};
 for(const method of ['single','maybeSingle'])Query.prototype[method]=function(...args){this.steps.push({method,args});return Promise.resolve(resolve(this))};
 const context={exports:{},Set,console,require(name){if(name==='@/lib/supabase')return {supabase:{from:table=>new Query(table),auth:{getUser:async()=>({data:{user}})}}};throw Error(name)}};
 vm.runInNewContext(code,context);
 return {api:context.exports,calls};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function step(query,name){return query.steps.find(item=>item.method===name)}

test('reader search queries only public profiles, escapes wildcard characters, and paginates',async()=>{
 const {api,calls}=fixture();await api.searchReaders('A_%',20);
 assert.equal(calls[0].table,'reader_cards');
 assert.deepEqual(plain(step(calls[0],'eq').args),['is_public',true]);
 assert.deepEqual(plain(step(calls[0],'ilike').args),['display_name','%A\\_\\%%']);
 assert.deepEqual(plain(step(calls[0],'range').args),[20,39]);
 assert.ok(!step(calls[0],'select').args[0].includes('email'));
});
test('invalid reader URLs never query the database',async()=>{
 const {api,calls}=fixture();assert.equal(await api.getReader('not-a-user'),null);assert.equal(calls.length,0);
});
test('old anonymous identities are not treated as signed-in readers',async()=>{
 for(const user of [null,{id:alice,is_anonymous:true}]){
  const {api}=fixture(undefined,user);assert.equal(await api.currentReaderId(),null);
 }
 const {api}=fixture(undefined,{id:alice,is_anonymous:false});assert.equal(await api.currentReaderId(),alice);
});
test('follow/unfollow writes target the actual signed-in relationship and accept duplicate inserts',async()=>{
 const {api,calls}=fixture(()=>({error:{code:'23505'}}));await api.setReaderFollowing(alice,bob,true);
 assert.deepEqual(plain(step(calls[0],'insert').args),[{follower_id:alice,following_id:bob}]);
 const other=fixture();await other.api.setReaderFollowing(alice,bob,false);
 assert.deepEqual(plain(other.calls[0].steps.filter(item=>item.method==='eq').map(item=>item.args)),[['follower_id',alice],['following_id',bob]]);
});
test('self follows and invalid identities are rejected before a write',async()=>{
 const {api,calls}=fixture();await assert.rejects(api.setReaderFollowing(alice,alice,true));await assert.rejects(api.setReaderFollowing('bad',bob,true));assert.equal(calls.length,0);
});
test('permission errors are not disguised as successful follows',async()=>{
 const {api}=fixture(()=>({error:{code:'42501',message:'Permission denied'}}));await assert.rejects(api.setReaderFollowing(alice,bob,true));
});
test('follow status is scoped to the viewer and the displayed reader IDs',async()=>{
 const {api,calls}=fixture(()=>({data:[{following_id:bob}],error:null}));
 assert.deepEqual([...await api.followedReaders(alice,[bob])],[bob]);
 assert.deepEqual(plain(step(calls[0],'eq').args),['follower_id',alice]);assert.deepEqual(plain(step(calls[0],'in').args),['following_id',[bob]]);
});
test('a hidden activity choice prevents ratings and discussion queries',async()=>{
 const {api,calls}=fixture();assert.equal((await api.readerActivity({show_activity:false})).length,0);assert.equal(calls.length,0);
});
test('public reading activity never reads private Want to Read and retains spoiler flags',async()=>{
 const {api,calls}=fixture(query=>({data:[{id:query.table,created_at:'2026-01-01T00:00:00Z',contains_spoilers:true,content:'A spoiler',books:null}],error:null}));
 const result=await api.readerActivity({user_id:alice,show_activity:true});
 assert.deepEqual(calls.map(query=>query.table),['ratings','discussion_posts']);
 assert.ok(result.every(row=>row.contains_spoilers));assert.equal(result.length,2);
 for(const query of calls)assert.deepEqual(plain(step(query,'eq').args),['user_id',alice]);
});
test('followers lists resolve public reader cards in the relationship order',async()=>{
 const {api,calls}=fixture(query=>query.table==='reader_follows'?{data:[{follower_id:alice}],error:null}:{data:[{user_id:alice,display_name:'Alice'}],error:null});
 const result=await api.readerConnections(bob,'followers');
 assert.equal(result.readers[0].display_name,'Alice');assert.equal(result.hasMore,false);
 assert.deepEqual(plain(step(calls[0],'eq').args),['following_id',bob]);
 assert.deepEqual(plain(step(calls[1],'eq').args),['is_public',true]);
});
test('profile visibility updates touch only visibility fields on the owner row',async()=>{
 const {api,calls}=fixture(()=>({data:{user_id:alice},error:null}));await api.updateReaderVisibility(alice,false,false);
 assert.deepEqual(plain(step(calls[0],'update').args),[{is_public:false,show_activity:false}]);assert.deepEqual(plain(step(calls[0],'eq').args),['user_id',alice]);
});
