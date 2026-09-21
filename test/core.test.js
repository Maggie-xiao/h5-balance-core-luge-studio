import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBatch, generateMap } from '../src/core/generator.js';
import { autoTune, runQA } from '../src/core/qa.js';
import { endlessManifest } from '../src/core/store.js';
import { EndlessLoader } from '../src/runtime/endless-loader.js';

test('generation is deterministic', () => assert.deepEqual(generateMap({ seed: 88 }), generateMap({ seed: 88 })));
test('batch seeds and maps are unique', () => {
  const maps = generateBatch({ seed: 4 }, 20);
  assert.equal(new Set(maps.map((map) => map.seed)).size, 20);
  assert.equal(new Set(maps.map((map) => JSON.stringify(map.segments))).size, 20);
});
test('default two minute map passes or is auto-tunable', () => {
  const map = generateMap({ seed: 4517, duration: 120, complexity: .45, difficulty: .45 });
  const first = runQA(map);
  const final = first.pass ? first : runQA(autoTune(map));
  assert.equal(final.pass, true, JSON.stringify(final.issues));
});
test('QA rejects unsafe mechanism placement', () => {
  const map = generateMap({ seed: 55 });
  map.features.push({ id: 'bad', type: 'obstacle', segmentId: 'start', offset: 3, theta: 0, width: 2, length: 4 });
  assert.equal(runQA(map).pass, false);
});
test('endless manifest includes approved passing revisions only', () => {
  const map = generateMap({ seed: 9 });
  const qa = runQA(autoTune(map));
  const library = [{ id: 'a', revision: 2, status: 'approved', qa, map }, { id: 'b', revision: 1, status: 'failed', qa: { ...qa, pass: false }, map }];
  assert.deepEqual(endlessManifest(library, ['b', 'a']).maps.map((item) => item.id), ['a']);
});
test('endless loader advances in order and loops', () => {
  const maps = [generateMap({ seed: 1 }), generateMap({ seed: 2 })];
  const manifest = { schema: 'neon-luge.endless.v1', maps: maps.map((map, index) => ({ id: String(index), hash: String(index + 1), map })) };
  const loader = new EndlessLoader(manifest);
  assert.equal(loader.current().map.seed, 1);
  assert.equal(loader.next().map.seed, 2);
  assert.equal(loader.next().map.seed, 1);
});
