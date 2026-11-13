import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{},Map,Date};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/reviews.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {latestReviewsByReader}=context.exports;
const row=(id,user_id,created_at,overall_rating)=>({id,user_id,created_at,overall_rating});
test('a reread replaces only that reader’s vote while preserving their earlier review',()=>{
 const reviews=[row('old','alice','2026-01-01',1),row('bob','bob','2026-02-01',3),row('new','alice','2026-03-01',5)];
 const latest=latestReviewsByReader(reviews);
 assert.equal(latest.length,2);assert.equal(latest.reduce((sum,r)=>sum+r.overall_rating,0)/latest.length,4);assert.equal(reviews.length,3);assert.equal(reviews[0].overall_rating,1);
});
test('editing an older review does not make its original date newer',()=>{
 const latest=latestReviewsByReader([row('new','alice','2026-03-01',5),{...row('old','alice','2026-01-01',2),updated_at:'2026-04-01'}]);
 assert.equal(latest[0].id,'new');
});
test('ties are deterministic and legacy missing dates do not displace dated reviews',()=>{
 assert.equal(latestReviewsByReader([row('a','alice',null,1),row('b','alice','2026-03-01',4),row('c','alice','2026-03-01',5)])[0].id,'c');
 assert.equal(latestReviewsByReader([]).length,0);
});
