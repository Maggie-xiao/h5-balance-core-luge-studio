import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBatch, generateMap } from '../src/core/generator.js';
import { autoTune, runQA } from '../src/core/qa.js';
import { endlessManifest } from '../src/core/store.js';
import { EndlessLoader } from '../src/runtime/endless-loader.js';
import { simulateStep } from '../src/core/simulator.js';

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
test('drift charge converts into a boost when the rider releases', () => {
  const map = generateMap({ seed: 77 });
  map.segments[1].yaw = 30;
  const state = { speed: 20, lateral: 0, distance: map.segments[0].len + 1, elapsed: 0, penalties: 0, hit: new Set() };
  for (let index = 0; index < 40; index++) simulateStep(state, { steer: 1, lean: 0 }, map, {}, .025);
  assert.ok(state.driftCharge > .35);
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .025);
  assert.ok(state.boostTimer > 0);
});

test('item boxes auto-use a balance-board friendly reward', () => {
  const map = generateMap({ seed: 9 });
  const segment = map.segments[1];
  map.features = [{ id: 'box', type: 'item-box', segmentId: segment.id, offset: 40, theta: 0, width: .6, length: 3 }];
  const state = { speed: 20, lateral: 0, distance: map.segments[0].len + 40, elapsed: 0, penalties: 0, hit: new Set() };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.ok(['turbo', 'shield', 'magnet'].includes(state.item));
});

test('turbo bottles trigger a sustained speed boost', () => {
  const map = generateMap({ seed: 12 });
  const segment = map.segments[1];
  map.features = [{ id: 'turbo', type: 'turbo-bottle', segmentId: segment.id, offset: 40, theta: 0, width: .6, length: 3 }];
  const state = { speed: 12, lateral: 0, distance: map.segments[0].len + 40, elapsed: 0, penalties: 0, hit: new Set() };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.ok(state.boostTimer > 2.7);
  assert.equal(state.event, '拾取：烈焰涡轮');
});

test('ramps launch the kart and briefly boost it', () => {
  const map = generateMap({ seed: 14 });
  const segment = map.segments[1];
  map.features = [{ id: 'ramp', type: 'jump', segmentId: segment.id, offset: 40, theta: 0, width: .8, length: 12 }];
  const state = { speed: 12, lateral: 0, distance: map.segments[0].len + 40, elapsed: 0, penalties: 0, hit: new Set() };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.ok(state.jumpTimer > 1);
  assert.ok(state.boostTimer > .6);
});

test('conveyor belts add speed and sustained boost', () => {
  const map = generateMap({ seed: 18 });
  const segment = map.segments.find((item) => item.tag === 'straight' && item.id !== 'start');
  map.features = [{ id: 'belt', type: 'conveyor', segmentId: segment.id, offset: 40, theta: 0, width: .62, length: 28 }];
  const start = map.segments.slice(0, map.segments.indexOf(segment)).reduce((sum, item) => sum + item.len, 0);
  const state = { speed: 12, lateral: 0, distance: start + 40, elapsed: 0, penalties: 0, hit: new Set() };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.ok(state.speed > 16);
  assert.ok(state.boostTimer > 1.9);
  assert.equal(state.event, '磁力传送带');
});

test('a missed conveyor remains active while the kart steers onto it', () => {
  const map = generateMap({ seed: 19 });
  const segment = map.segments.find((item) => item.tag === 'straight' && item.id !== 'start');
  map.features = [{ id: 'belt', type: 'conveyor', segmentId: segment.id, offset: 40, theta: 0, width: .9, length: 28 }];
  const start = map.segments.slice(0, map.segments.indexOf(segment)).reduce((sum, item) => sum + item.len, 0);
  const state = { speed: 12, lateral: 1.1, distance: start + 40, elapsed: 0, penalties: 0, hit: new Set() };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.equal(state.hit.has('belt'), false);
  state.lateral = .3;
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.equal(state.hit.has('belt'), true);
  assert.equal(state.event, '磁力传送带');
});

test('generated courses include both reward and hazard gameplay', () => {
  const map = generateMap({ seed: 4517, duration: 105, complexity: .72 });
  const hazards = map.features.filter((feature) => ['obstacle', 'tire-chicane', 'spinner', 'oil', 'moving-gate'].includes(feature.type));
  assert.ok(hazards.length >= 2);
  assert.ok(map.features.some((feature) => ['boost', 'conveyor', 'turbo-bottle', 'energy', 'item-box'].includes(feature.type)));
});

test('tire chicanes apply a collision penalty', () => {
  const map = generateMap({ seed: 23 });
  const segment = map.segments.find((item) => item.tag === 'straight' && item.id !== 'start');
  map.features = [{ id: 'tires', type: 'tire-chicane', segmentId: segment.id, offset: 40, theta: 0, width: .42, length: 5 }];
  const start = map.segments.slice(0, map.segments.indexOf(segment)).reduce((sum, item) => sum + item.len, 0);
  const state = { speed: 18, lateral: 0, distance: start + 40, elapsed: 0, penalties: 0, hit: new Set() };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.ok(state.penalties > 0);
  assert.equal(state.event, '轮胎墙反弹！');
  assert.equal(state.impactType, 'tire-chicane');
  assert.ok(state.impactTimer > .5);
  assert.notEqual(state.lateral, 0);
});

test('spike strips apply a stronger penalty', () => {
  const map = generateMap({ seed: 31 });
  const segment = map.segments.find((item) => item.tag === 'straight' && item.id !== 'start');
  map.features = [{ id: 'spikes', type: 'spikes', segmentId: segment.id, offset: 40, theta: 0, width: .42, length: 5 }];
  const start = map.segments.slice(0, map.segments.indexOf(segment)).reduce((sum, item) => sum + item.len, 0);
  const state = { speed: 20, lateral: 0, distance: start + 40, elapsed: 0, penalties: 0, hit: new Set() };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.ok(state.speed < 10);
  assert.ok(state.penalties > 3);
  assert.equal(state.event, '爆胎颠簸！');
  assert.equal(state.impactType, 'spikes');
  assert.ok(state.impactTimer > .8);
});

test('coins are collected independently from core energy', () => {
  const map = generateMap({ seed: 41 });
  const segment = map.segments.find((item) => item.tag === 'straight' && item.id !== 'start');
  map.features = [{ id: 'coin', type: 'coin', segmentId: segment.id, offset: 40, theta: 0, width: .5, length: 2 }];
  const start = map.segments.slice(0, map.segments.indexOf(segment)).reduce((sum, item) => sum + item.len, 0);
  const state = { speed: 12, lateral: 0, distance: start + 40, elapsed: 0, penalties: 0, hit: new Set(), energy: 0 };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.equal(state.coins, 1);
  assert.equal(state.energy, 0);
  assert.equal(state.event, '金币 ×1');
});

test('a missed collectible cannot mask an overlapping obstacle collision', () => {
  const map = generateMap({ seed: 52 });
  const segment = map.segments.find((item) => item.tag === 'straight' && item.id !== 'start');
  map.features = [
    { id: 'coin', type: 'coin', segmentId: segment.id, offset: 40, theta: -.8, width: .3, length: 5 },
    { id: 'barrier', type: 'obstacle', segmentId: segment.id, offset: 40, theta: 0, width: .42, length: 5 },
  ];
  const start = map.segments.slice(0, map.segments.indexOf(segment)).reduce((sum, item) => sum + item.len, 0);
  const state = { speed: 18, lateral: 0, distance: start + 40, elapsed: 0, penalties: 0, hit: new Set() };
  simulateStep(state, { steer: 0, lean: 0 }, map, {}, .016);
  assert.ok(state.penalties > 0);
  assert.equal(state.impactType, 'obstacle');
  assert.equal(state.event, '撞击失衡！');
  assert.equal(state.hit.has('coin'), false);
  assert.equal(state.hit.has('barrier'), true);
});
