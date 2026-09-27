const HAZARDS = new Set(['obstacle', 'tire-chicane', 'spinner', 'spikes', 'oil', 'moving-gate']);
const LANES = [-.96, -.72, -.48, -.24, 0, .24, .48, .72, .96];

export function featureDistance(map, feature) {
  let distance = 0;
  for (const segment of map.segments) {
    if (segment.id === feature.segmentId) return distance + feature.offset;
    distance += segment.len;
  }
  return distance;
}

export function hazardRadius(feature) {
  if (feature.type === 'spinner') return .94;
  if (feature.type === 'moving-gate') return .84;
  if (feature.type === 'spikes') return .86;
  if (feature.type === 'tire-chicane') return .86;
  return feature.width / 2 + .58;
}

export function planAutopilot(state, map, previousLane = 0) {
  const lookAhead = 48 + state.speed * .7;
  const hazards = [];
  for (const feature of map.features) {
    if (!HAZARDS.has(feature.type) || state.hit.has(feature.id)) continue;
    const ahead = featureDistance(map, feature) - state.distance;
    if (ahead < -2 || ahead > lookAhead) continue;
    const arrival = state.elapsed + Math.max(0, ahead) / Math.max(8, state.speed);
    const lane = feature.type === 'moving-gate' ? Math.sin(arrival * 2.4) * .62 : feature.type === 'spinner' ? Math.sin(arrival * 2.8) * .72 : feature.theta;
    hazards.push({ ahead, lane, radius: hazardRadius(feature) });
  }
  let targetLane = 0;
  let bestScore = Infinity;
  for (const lane of LANES) {
    let score = Math.abs(lane) * .12 + Math.abs(lane - previousLane) * .3;
    for (const hazard of hazards) {
      const urgency = 1 - hazard.ahead / lookAhead;
      const clearance = Math.abs(lane - hazard.lane) - hazard.radius;
      if (clearance < .2) score += 100 + urgency * 160 + (.2 - clearance) * 100;
      else score += Math.max(0, .48 - clearance) * urgency * 5;
    }
    if (score < bestScore) { bestScore = score; targetLane = lane; }
  }
  const risk = hazards.filter((hazard) => hazard.ahead < 20 && Math.abs(state.lateral - hazard.lane) < hazard.radius + .16).length;
  return { lane: targetLane, risk, steer: Math.max(-1, Math.min(1, (targetLane - state.lateral) * 4.2)), lean: 1 };
}
