export const MAP_SCHEMA = 'neon-luge.map.v1';
export const GENERATOR_VERSION = 2;
export const ENVIRONMENTS = ['reef', 'alpine', 'neon-city', 'volcanic', 'aurora'];
export const SHAPES = ['flowing', 'switchbacks', 'spiral', 'mixed'];
export const FEATURE_TYPES = ['boost', 'slow', 'slow-wall', 'obstacle', 'jump', 'energy', 'item-box', 'oil', 'moving-gate'];

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function mapHash(map) {
  const { name, ...gameplay } = map;
  const source = JSON.stringify(canonical(gameplay));
  let a = 2166136261;
  for (let i = 0; i < source.length; i++) a = Math.imul(a ^ source.charCodeAt(i), 16777619);
  return (a >>> 0).toString(16).padStart(8, '0');
}

export function totalLength(map) {
  return map.segments.reduce((sum, segment) => sum + segment.len, 0);
}
