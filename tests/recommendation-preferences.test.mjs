import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compiled(relativePath) {
  return ts.transpileModule(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const preferencesContext = { exports: {}, URL };
vm.runInNewContext(compiled('../lib/recommendation-preferences.ts'), preferencesContext);
const preferences = preferencesContext.exports;
const plain = value => JSON.parse(JSON.stringify(value));

test('Anything is exclusive, can be deselected, and does not use a specific-category slot', () => {
  assert.deepEqual(plain(preferences.toggleCategory(['Fantasy', 'Philosophy'], 'Anything')), ['Anything']);
  assert.deepEqual(plain(preferences.toggleCategory(['Anything'], 'Psychology')), ['Psychology']);
  assert.deepEqual(plain(preferences.toggleCategory(['Anything'], 'Anything')), []);
});

test('category selection allows a mixture of interests, enforces three, and allows deselection', () => {
  let selected = preferences.toggleCategory(['Philosophy'], 'Fantasy');
  selected = preferences.toggleCategory(selected, 'Psychology');
  assert.deepEqual(plain(preferences.toggleCategory(selected, 'History')), ['Philosophy', 'Fantasy', 'Psychology']);
  assert.deepEqual(plain(preferences.toggleCategory(selected, 'Fantasy')), ['Philosophy', 'Psychology']);
});

test('Philosophy and Psychology bring relevant priorities into the initial eight', () => {
  for (const category of ['Philosophy', 'Psychology']) {
    const first = preferences.visibleMatters([category], [], false);
    assert.equal(first.length, 8);
    for (const option of ['Big ideas', 'New perspectives', 'Human behaviour', 'Clear explanations']) assert.ok(first.includes(option), `${category}: ${option}`);
  }
});

test('mixed interests keep priorities from both categories accessible', () => {
  const initial = preferences.visibleMatters(['Philosophy', 'Fantasy'], [], false);
  assert.ok(initial.includes('Big ideas'));
  assert.ok(initial.includes('Atmosphere'));
  const expanded = preferences.visibleMatters(['Philosophy'], [], true);
  assert.equal(expanded.length, 15);
  assert.ok(expanded.includes('Twists'));
  assert.ok(expanded.includes('Romance'));
});

test('collapsing options and changing categories retain selected preferences', () => {
  const selected = ['Twists', 'Romance', 'Fast pace'];
  const collapsed = preferences.visibleMatters(['Philosophy'], selected, false);
  for (const option of selected) assert.ok(collapsed.includes(option));
  assert.ok(collapsed.length <= 11);
});

test('saved choices migrate old labels and discard invalid or excessive values', () => {
  assert.deepEqual(plain(preferences.normalizeMatters(['Plot twists', 'Strong characters', 'Fast pacing', 'Depth'])), ['Twists', 'Characters', 'Fast pace']);
  assert.deepEqual(plain(preferences.normalizeCategories(['Philosophy', 'Invalid', 'Philosophy', 'Fantasy', 'Psychology', 'History'])), ['Philosophy', 'Fantasy', 'Psychology']);
  assert.deepEqual(plain(preferences.normalizeCategories(null)), []);
  assert.deepEqual(plain(preferences.normalizeMatters([null, {}, 'Depth', 'Depth'])), ['Depth']);
});

async function requestRecommendations(body, scenario = {}) {
  let backupCalls = 0;
  let primaryAborted = false;
  let capturedPrompt = '';
  const providerBodies = [];
  const context = {
    exports: {}, URL, URLSearchParams, Response, AbortController, AbortSignal, setTimeout: (fn, ms) => setTimeout(fn, scenario.race && ms === 3000 ? 5 : ms), clearTimeout,
    process: { env: { GEMINI_API_KEY: 'test-fixture-only', ...(scenario.race ? { OPENROUTER_API_KEY: 'test-backup-only' } : {}) } },
    console: { log() {}, error() {} },
    require(name) {
      if (name === '@/lib/recommendation-preferences') return preferences;
      if (name === '@/lib/fetch-json') {
        const helper = { ...context, exports: {} };
        vm.runInNewContext(compiled('../lib/fetch-json.ts'), helper);
        return helper.exports;
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
    async fetch(url, options) {
      if (url.includes('openrouter.ai') || url.includes('generativelanguage.googleapis.com')) providerBodies.push(JSON.parse(options.body));
      if (url.includes('openrouter.ai')) {
        backupCalls++;
        const recommendations = Array.from({ length: 7 }, (_, i) => ({ title: `Backup Book ${i + 1}`, author: 'Fixture Author', reason: 'Fixture reasoning.' }));
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ recommendations }) } }] }) };
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        if (scenario.stall) return { ok: true, json: () => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => { primaryAborted = true; reject(new Error('Aborted primary')); }, { once: true })) };
        capturedPrompt = JSON.parse(options.body).contents[0].parts[0].text;
        const recommendations = Array.from({ length: 7 }, (_, i) => ({ title: `Fixture Book ${i + 1}`, author: 'Fixture Author', reason: 'Fixture reasoning.' }));
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ recommendations }) }] } }] }) };
      }
      return { ok: true, json: async () => url.includes('googleapis') ? { items: [] } : { docs: [] } };
    },
  };
  vm.runInNewContext(compiled('../app/api/recommend/route.ts'), context);
  const response = await context.exports.POST(new Request('http://localhost/api/recommend', { method: 'POST', body: JSON.stringify(body) }));
  return { prompt: capturedPrompt, response, data: await response.json(), backupCalls, primaryAborted, providerBodies };
}

test('the real recommendation route sends categories and priorities to the AI provider', async () => {
  const { prompt, response, data } = await requestRecommendations({ categories: ['Philosophy', 'Fantasy'], matters: ['Big ideas', 'Atmosphere'], readingStyle: ['Easy read'], avoid: ['Graphic violence'], extraNotes: 'Nothing too long' });
  assert.equal(response.status, 200);
  assert.equal(data.recommendations.length, 5);
  assert.match(prompt, /Philosophy, Fantasy/);
  assert.match(prompt, /Big ideas, Atmosphere/);
  assert.match(prompt, /interests, not an intersection/);
  assert.match(prompt, /do not require every book to fit every category/);
  assert.match(prompt, /Easy read/);
  assert.match(prompt, /Graphic violence/);
  assert.match(prompt, /Nothing too long/);
});

test('Anything and empty categories request no category preference, including nonfiction', async () => {
  for (const categories of [[], ['Anything']]) {
    const { prompt, response } = await requestRecommendations({ categories, matters: ['Human behaviour'] });
    assert.equal(response.status, 200);
    assert.match(prompt, /No category preference\. Fiction and nonfiction are both welcome/);
    assert.match(prompt, /Human behaviour/);
  }
});


test('a stalled primary can be rescued by the existing backup without waiting for its timeout',{timeout:1000},async()=>{
 const result = await requestRecommendations({}, {race:true,stall:true});
 assert.equal(result.response.status,200);assert.equal(result.data.recommendations.length,5);
 assert.equal(result.backupCalls,1);assert.equal(result.primaryAborted,true);
});
test('a fast primary does not spend a free backup request',async()=>{
 const result = await requestRecommendations({}, {race:true});
 assert.equal(result.response.status,200);assert.equal(result.backupCalls,0);
});

test('both existing providers receive a bounded reasoning setting without changing the models', async () => {
 const primary = await requestRecommendations({});
 assert.equal(primary.providerBodies[0].generationConfig.thinkingConfig.thinkingLevel, 'LOW');
 const backup = await requestRecommendations({}, {race:true,stall:true});
 assert.equal(backup.providerBodies[1].model, 'openrouter/free');
 assert.equal(backup.providerBodies[1].reasoning.effort, 'low');
});
