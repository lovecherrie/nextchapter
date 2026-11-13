import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/discussion-sections.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const label=context.exports.discussionSectionLabel;
test('optional sections preserve whole-book posts and label supported chapters/epilogues',()=>{
 assert.equal(label(null),null);assert.equal(label(undefined),null);
 assert.equal(label('chapter:12'),'Chapter 12');assert.equal(label('chapter:1000'),'Chapter 1000');assert.equal(label('epilogue'),'Epilogue');
});
test('invalid or arbitrary spoiler text cannot become a chapter label',()=>{
 for(const value of ['chapter:','chapter:0','chapter:1001','chapter:01','chapter:1.5','chapter:-1','The killer is…'])assert.equal(label(value),null);
});
