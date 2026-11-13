import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/community-browse.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const api=context.exports;
test('catalog subjects match reading genres without inventing missing metadata',()=>{
 assert.equal(api.matchesCommunityGenre('Romance',['Fiction / Romance / Contemporary']),true);
 assert.equal(api.matchesCommunityGenre('Mystery & Crime',['Detective and mystery stories']),true);
 assert.equal(api.matchesCommunityGenre('Manga & Graphic Novels',['Comics and graphic novels']),true);
 assert.equal(api.matchesCommunityGenre('Romance',[]),false);
 assert.equal(api.matchesCommunityGenre('Romance',['Fiction']),false);
});
test('science fiction is not mistakenly treated as nonfiction',()=>{
 assert.equal(api.matchesCommunityGenre('Nonfiction',['Fiction / Science Fiction']),false);
 assert.equal(api.matchesCommunityGenre('Nonfiction',['Non-fiction','Business and management']),true);
});
test('author matching and topic identities tolerate case and accents',()=>{
 assert.equal(api.browseText(' GABRIEL GARCÍA MÁRQUEZ ').includes(api.browseText('garcia')),true);
 assert.notEqual(api.bookTopicKey({title:'Same title',author:'Author One'}),api.bookTopicKey({title:'Same title',author:'Author Two'}));
});

test('saved genre corrections classify sparse catalogue entries without guessing from titles',()=>{
 const book={title:'A catalogue book',author:'An Author',book_genres:{genres:['Manga & Graphic Novels','Fantasy']}};
 assert.equal(api.matchesCommunityGenre('Manga & Graphic Novels',api.savedBookGenres(book)),true);
 assert.equal(api.matchesCommunityGenre('Fantasy',api.savedBookGenres(book)),true);
 assert.equal(api.savedBookGenres({title:'Manga sounding title',author:'Someone'}).length,0);
 assert.equal(api.savedBookGenres({...book,book_genres:[{genres:['Fantasy']},{genres:['Fantasy']}]}).length,1);
});
