import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/book-polls.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const api=context.exports;
test('poll relations accept PostgREST single objects, arrays, and ordinary posts',()=>{
 const poll={post_id:'id',left_votes:2,right_votes:3};
 assert.equal(api.pollFromPost(poll),poll);assert.equal(api.pollFromPost([poll]),poll);assert.equal(api.pollFromPost([]),null);assert.equal(api.pollFromPost(undefined),null);
});
test('poll percentages sum to 100 with rounded and empty totals',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(api.pollPercentages(1,2))),{left:33,right:67});
 assert.deepEqual(JSON.parse(JSON.stringify(api.pollPercentages(0,0))),{left:0,right:0});
});
test('Top includes current votes, likes and replies without a weekly time window',()=>{
 const ordinary={discussion_likes:[{}],comments:[{},{}]};
 assert.equal(api.discussionEngagement(ordinary),5);
 assert.equal(api.discussionEngagement({...ordinary,book_polls:{left_votes:3,right_votes:4}}),12);
});
