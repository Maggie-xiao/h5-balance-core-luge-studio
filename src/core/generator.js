import { makeRng } from './rng.js';
import { ENVIRONMENTS, GENERATOR_VERSION, MAP_SCHEMA, SHAPES } from './schema.js';

const BASE_SPEED = 21.5;
const weightsFor = (mix) => Object.entries(mix).flatMap(([type, weight]) => Array(Math.max(0, Math.round(weight))).fill(type));

function chooseTurn(rng, shape, heading, difficulty) {
  const maximum = 18 + difficulty * 18;
  let turn;
  if (shape === 'switchbacks') turn = rng.sign() * rng.int(maximum * .65, maximum);
  else if (shape === 'spiral') turn = rng.int(maximum * .45, maximum);
  else if (shape === 'flowing') turn = rng.sign() * rng.int(5, maximum * .6);
  else turn = rng.sign() * rng.int(3, maximum);
  if (Math.abs(heading + turn) > 105) turn *= -1;
  return Math.round(turn);
}

export function estimateDuration(map, tuning = {}) {
  const speed = Number(tuning.baseSpeed || BASE_SPEED);
  const difficultyDrag = 1 + map.recipe.difficulty * .045;
  const mechanismDrag = map.features.reduce((sum, feature) => sum + ({ boost: -.7, 'turbo-bottle': -.8, slow: 1.1, 'slow-wall': .7, obstacle: .8, jump: .45, energy: -.15, 'item-box': -.25, oil: .65, 'moving-gate': .55 }[feature.type] || 0), 0);
  return Math.max(1, map.segments.reduce((sum, segment) => sum + segment.len / Math.max(8, speed - Math.abs(segment.yaw) * .055 - segment.drop * .03), 0) * difficultyDrag + mechanismDrag);
}

export function generateMap(options = {}) {
  const recipe = {
    seed: Number(options.seed ?? 4517) >>> 0,
    duration: Math.min(240, Math.max(45, Number(options.duration ?? 120))),
    difficulty: Math.min(1, Math.max(0, Number(options.difficulty ?? .5))),
    complexity: Math.min(1, Math.max(0, Number(options.complexity ?? .5))),
    shape: SHAPES.includes(options.shape) ? options.shape : 'mixed',
    environment: ENVIRONMENTS.includes(options.environment) ? options.environment : 'reef',
    mechanisms: { boost: 3, 'turbo-bottle': 3, slow: 2, obstacle: 3, jump: 2, 'slow-wall': 1, energy: 4, 'item-box': 2, oil: 2, 'moving-gate': 1, ...(options.mechanisms || {}) },
  };
  const rng = makeRng(recipe.seed);
  const targetLength = recipe.duration * BASE_SPEED * (1 - recipe.difficulty * .035);
  const count = Math.max(8, Math.round(7 + recipe.duration / 12 * (.72 + recipe.complexity * .55)));
  const rideLength = targetLength - 306;
  const segments = [{ id: 'start', len: 56, yaw: 0, drop: 1, rad: 4.6, roof: 0, bank: 0, spin: 0, ease: 12, tag: 'start' }];
  let heading = 0;
  for (let index = 0; index < count; index++) {
    const len = Math.round(rideLength / count + rng.int(-22, 22));
    const quiet = index === 0 || index === count - 1;
    const yaw = quiet ? 0 : chooseTurn(rng, recipe.shape, heading, recipe.difficulty);
    heading += yaw;
    const tunnel = !quiet && recipe.complexity > .45 && rng.chance(.08 + recipe.complexity * .12);
    const bridge = !quiet && !tunnel && Math.abs(yaw)<=4 && recipe.complexity > .42 && rng.chance(.07 + recipe.complexity * .1);
    segments.push({
      id: `seg-${index + 1}`, len: Math.max(105, len), yaw,
      drop: Number((4 + recipe.difficulty * 6 + rng.next() * 4).toFixed(1)),
      rad: Number((4.7 - recipe.difficulty * .8).toFixed(1)), roof: tunnel ? 1 : 0,
      bank: yaw ? -Math.sign(yaw) * Math.round(8 + Math.abs(yaw) * .24) : 0,
      spin: tunnel && recipe.complexity > .8 && rng.chance(.16) ? 360 : 0,
      ease: Math.min(42, Math.round(len * .2)), tag: tunnel ? 'tunnel' : bridge ? 'bridge' : yaw > 4 ? 'left' : yaw < -4 ? 'right' : 'straight',
    });
  }
  segments.push({ id: 'finish', len: 250, yaw: 0, drop: 1.2, rad: 4.6, roof: 0, bank: 0, spin: 0, ease: 30, tag: 'finish' });
  const candidates = segments.filter((segment) => ['straight','bridge'].includes(segment.tag) && segment.len >= 130 && !segment.roof);
  const pool = weightsFor(recipe.mechanisms);
  const features = [];
  const density = .52 + recipe.complexity * .34;
  for (const segment of candidates) {
    if (!pool.length || !rng.chance(density)) continue;
    const type = rng.pick(pool);
    const length = ['obstacle', 'energy', 'item-box','turbo-bottle'].includes(type) ? 3 : type === 'jump' ? 12 : type === 'moving-gate' ? 5 : 20;
    const theta = Number((rng.pick([-.42, 0, .42])).toFixed(2));
    features.push({ id: `feature-${features.length + 1}`, type, segmentId: segment.id, offset: Math.round(segment.len * .38), theta, width: ['obstacle', 'oil', 'moving-gate'].includes(type) ? .42 : .62, length, ...(type === 'jump' ? { jumpLength: 24 } : { strength: 1 }) });
    // Risk/reward split: the fast line stays optional and always has a readable safe lane.
    if (type === 'obstacle' && segment.len >= 155 && rng.chance(.55)) {
      features.push({ id: `feature-${features.length + 1}`, type: 'boost', segmentId: segment.id, offset: Math.round(segment.len * .38 + 10), theta: Number((-theta || .42).toFixed(2)), width: .38, length: 14, strength: 1.15, riskReward: true });
    }
    if (segment.len >= 155 && rng.chance(.48)) {
      const bonusType=rng.chance(.55)?'item-box':'boost',bonusOffset=Math.min(segment.len-24,Math.round(segment.len*.66));
      features.push({id:`feature-${features.length+1}`,type:bonusType,segmentId:segment.id,offset:bonusOffset,theta:Number(rng.pick([-.42,0,.42]).toFixed(2)),width:.55,length:bonusType==='boost'?18:3,strength:1.2});
    }
  }
  const map = { schema: MAP_SCHEMA, name: `Course ${recipe.seed}`, seed: recipe.seed, generatorVersion: GENERATOR_VERSION, difficulty: recipe.difficulty >= .58 ? 'advanced' : 'beginner', environment: recipe.environment, recipe, segments, features };
  map.targetDuration = recipe.duration;
  map.estimatedDuration = Number(estimateDuration(map).toFixed(1));
  return map;
}

export function generateBatch(options, count = 12) {
  const base = Number(options.seed ?? Date.now()) >>> 0;
  return Array.from({ length: count }, (_, index) => generateMap({ ...options, seed: (base + Math.imul(index, 2654435761)) >>> 0 }));
}
