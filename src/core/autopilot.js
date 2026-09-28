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

export function applyAutopilotSafety(state, map) {
  const imminent = [];
  for (const feature of map.features) {
    if (!HAZARDS.has(feature.type) || state.hit.has(feature.id)) continue;
    const ahead = featureDistance(map, feature) - state.distance;
    if (ahead < -feature.length || ahead > Math.max(7, state.speed * .18)) continue;
    const lane = feature.type === 'moving-gate' ? Math.sin(state.elapsed * 2.4) * .62 : feature.type === 'spinner' ? Math.sin(state.elapsed * 2.8) * .72 : feature.theta;
    imminent.push({ lane, radius: hazardRadius(feature) });
  }
  if (!imminent.length || imminent.every((hazard) => Math.abs(state.lateral - hazard.lane) >= hazard.radius + .16)) return false;
  let safest = state.lateral, bestClearance = -Infinity;
  for (const lane of LANES) {
    const clearance = Math.min(...imminent.map((hazard) => Math.abs(lane - hazard.lane) - hazard.radius));
    if (clearance > bestClearance) { bestClearance = clearance; safest = lane; }
  }
  state.lateral = safest;
  return true;
}

export function planAutopilot(state, map, previousLane = 0) {
  const lookAhead = 62 + state.speed * .9;
  const hazards = [];
  for (const feature of map.features) {
    if (!HAZARDS.has(feature.type) || state.hit.has(feature.id)) continue;
    const ahead = featureDistance(map, feature) - state.distance;
    if (ahead < -2 || ahead > lookAhead) continue;
    const arrival = state.elapsed + Math.max(0, ahead) / Math.max(8, state.speed);
    const lane = feature.type === 'moving-gate' ? Math.sin(arrival * 2.4) * .62 : feature.type === 'spinner' ? Math.sin(arrival * 2.8) * .72 : feature.theta;
    const currentLane = feature.type === 'moving-gate' ? Math.sin(state.elapsed * 2.4) * .62 : feature.type === 'spinner' ? Math.sin(state.elapsed * 2.8) * .72 : feature.theta;
    hazards.push({ ahead, lane, currentLane, radius: hazardRadius(feature), type: feature.type });
  }
  let targetLane = 0;
  let bestScore = Infinity;
  for (const lane of LANES) {
    let score = Math.abs(lane) * .12 + Math.abs(lane - previousLane) * .8;
    for (const hazard of hazards) {
      const urgency = 1 - hazard.ahead / lookAhead;
      const clearance = Math.abs(lane - hazard.lane) - hazard.radius;
      if (clearance < .2) score += 100 + urgency * 160 + (.2 - clearance) * 100;
      else score += Math.max(0, .48 - clearance) * urgency * 5;
      if (hazard.ahead < 42 && Math.abs(previousLane) > .6 && Math.sign(lane) !== Math.sign(previousLane)) score += 240;
    }
    if (score < bestScore) { bestScore = score; targetLane = lane; }
  }
  const imminent = hazards.filter((hazard) => hazard.ahead < 24);
  const risk = imminent.filter((hazard) => Math.abs(state.lateral - hazard.lane) < hazard.radius + .2).length;
  const targetUnsafe = imminent.some((hazard) => Math.abs(targetLane - hazard.lane) < hazard.radius + .12);
  const laneError = Math.abs(targetLane - state.lateral);
  const brakingHazard = hazards.some((hazard) => hazard.ahead < Math.max(32, state.speed * 1.45) && (['spinner', 'moving-gate'].includes(hazard.type) || Math.abs(targetLane - hazard.lane) < hazard.radius + .12));
  const blockedAtCrossing = hazards.some((hazard) => ['spinner', 'moving-gate'].includes(hazard.type) && hazard.ahead < 9 && Math.abs(state.lateral - hazard.currentLane) < hazard.radius + .12);
  const lean = blockedAtCrossing || brakingHazard ? -1 : laneError > .34 && imminent.length ? .25 : 1;
  return { lane: targetLane, risk, steer: Math.max(-1, Math.min(1, (targetLane - state.lateral) * 4.8)), lean };
}
