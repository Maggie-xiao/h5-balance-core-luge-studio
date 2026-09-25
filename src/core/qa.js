import { FEATURE_TYPES, MAP_SCHEMA, mapHash, totalLength } from './schema.js';
import { estimateDuration } from './generator.js';

const issue = (severity, code, message, ref) => ({ severity, code, message, ...(ref ? { ref } : {}) });

export function runQA(map, tuning = {}) {
  const issues = [];
  if (!map || map.schema !== MAP_SCHEMA) issues.push(issue('error', 'SCHEMA', 'Unsupported map schema'));
  if (!Array.isArray(map?.segments) || map.segments.length < 3) issues.push(issue('error', 'SEGMENTS', 'Course needs at least three segments'));
  if (!Array.isArray(map?.features)) issues.push(issue('error', 'FEATURES', 'Features must be an array'));
  if (issues.length) return report(map, issues, 0, 0);
  const ids = new Set();
  let heading = 0;
  let complexity = 0;
  for (const [index, segment] of map.segments.entries()) {
    if (!segment.id || ids.has(segment.id)) issues.push(issue('error', 'DUPLICATE_ID', 'Segment IDs must be unique', segment.id));
    ids.add(segment.id);
    if (!Number.isFinite(segment.len) || segment.len < 20 || segment.len > 600) issues.push(issue('error', 'LENGTH', 'Segment length must be 20-600 m', segment.id));
    if (Math.abs(segment.yaw || 0) > 80) issues.push(issue('error', 'TURN', 'Turn exceeds the supported 80 degree limit', segment.id));
    if (Math.abs(segment.bank || 0) > 40) issues.push(issue('error', 'BANK', 'Bank exceeds the supported 40 degree limit', segment.id));
    heading += segment.yaw || 0;
    complexity += Math.abs(segment.yaw || 0) / 35 + Math.abs(segment.spin || 0) / 180 + (segment.roof || 0) * .25;
    if (Math.abs(heading) > 125) issues.push(issue('warning', 'HEADING', 'Long turn sequence may feel repetitive', segment.id));
    if (index === 0 && segment.tag !== 'start') issues.push(issue('error', 'START', 'First segment must be the start', segment.id));
    if (index === map.segments.length - 1 && segment.tag !== 'finish') issues.push(issue('error', 'FINISH', 'Last segment must be the finish', segment.id));
  }
  const segmentById = new Map(map.segments.map((segment) => [segment.id, segment]));
  for (const feature of map.features) {
    const segment = segmentById.get(feature.segmentId);
    if (!FEATURE_TYPES.includes(feature.type)) issues.push(issue('error', 'FEATURE_TYPE', 'Unknown gameplay mechanism', feature.id));
    if (!segment) { issues.push(issue('error', 'OWNER', 'Mechanism has no segment', feature.id)); continue; }
    if (feature.offset < 35 || feature.offset + feature.length + 45 > segment.len) issues.push(issue('error', 'CLEARANCE', 'Mechanism needs readable approach and recovery space', feature.id));
    if (Math.abs(segment.yaw) > 8 || segment.spin || segment.roof) issues.push(issue('error', 'READABILITY', 'Mechanisms belong on open, nearly straight segments', feature.id));
    if (Math.abs(feature.theta) + feature.width / 2 > 1.1) issues.push(issue('error', 'LANE', 'Mechanism crosses the safe track boundary', feature.id));
  }
  const rewards = map.features.filter((feature) => ['energy', 'item-box', 'boost', 'conveyor', 'turbo-bottle'].includes(feature.type)).length;
  const hazards = map.features.filter((feature) => ['obstacle', 'tire-chicane', 'spinner', 'spikes', 'oil', 'moving-gate', 'slow'].includes(feature.type)).length;
  if (map.features.length >= 4 && rewards === 0) issues.push(issue('warning', 'NO_REWARD', 'Course has hazards but no reward line'));
  if (rewards > 0 && hazards > rewards * 2.5) issues.push(issue('warning', 'PUNISHING', 'Hazards substantially outnumber rewards'));
  const duration = estimateDuration(map, tuning);
  const target = Number(map.targetDuration || map.recipe?.duration || 120);
  const tolerance = Math.max(8, target * .12);
  if (Math.abs(duration - target) > tolerance) issues.push(issue('error', 'DURATION', `Estimated ${duration.toFixed(0)}s is outside ${target.toFixed(0)}s target tolerance`));
  else if (Math.abs(duration - target) > tolerance * .6) issues.push(issue('warning', 'DURATION_MARGIN', `Estimated duration ${duration.toFixed(0)}s is near the QA limit`));
  const curveRate = map.segments.filter((segment) => Math.abs(segment.yaw) > 4).length / map.segments.length;
  if (curveRate < .18) issues.push(issue('warning', 'VARIETY', 'Course has little directional variety'));
  const score = Math.max(0, Math.round(100 - issues.filter((x) => x.severity === 'error').length * 18 - issues.filter((x) => x.severity === 'warning').length * 5));
  return report(map, issues, duration, score, complexity);
}

function report(map, issues, duration, score, complexity = 0) {
  const errors = issues.filter((x) => x.severity === 'error');
  return { pass: errors.length === 0, score, issues, duration: Number(duration.toFixed?.(1) || 0), length: map?.segments ? totalLength(map) : 0, complexity: Number(complexity.toFixed(1)), hash: map?.segments ? mapHash(map) : null, testedAt: new Date().toISOString() };
}

export function autoTune(map, tuning = {}) {
  const copy = structuredClone(map);
  const duration = estimateDuration(copy, tuning);
  const target = Number(copy.targetDuration || copy.recipe?.duration || 120);
  const scalable = copy.segments.filter((segment) => !['start', 'finish'].includes(segment.tag));
  const fixed = copy.segments.filter((segment) => ['start', 'finish'].includes(segment.tag)).reduce((sum, segment) => sum + segment.len, 0);
  const scalableLength = scalable.reduce((sum, segment) => sum + segment.len, 0);
  const desired = Math.max(400, (target / duration) * (scalableLength + fixed) - fixed);
  const ratio = Math.min(1.25, Math.max(.8, desired / scalableLength));
  for (const segment of scalable) segment.len = Math.round(Math.min(600, Math.max(105, segment.len * ratio)));
  for (const feature of copy.features) {
    const segment = copy.segments.find((item) => item.id === feature.segmentId);
    feature.offset = Math.min(feature.offset, Math.max(35, segment.len - feature.length - 50));
  }
  copy.estimatedDuration = Number(estimateDuration(copy, tuning).toFixed(1));
  return copy;
}
