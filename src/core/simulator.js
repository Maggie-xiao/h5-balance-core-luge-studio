export const DEFAULT_TUNING = { baseSpeed: 21.5, maxSpeed: 40, acceleration: 8.5, brake: 11, steerGain: 1.4, balanceAssist: .32, hazardPenalty: 2.2 };

export function simulateStep(state, input, map, tuning, dt) {
  const merged = { ...DEFAULT_TUNING, ...tuning };
  const lean = Math.max(-1, Math.min(1, input.lean));
  const steer = Math.max(-1, Math.min(1, input.steer));
  state.speed = Math.max(5, Math.min(merged.maxSpeed, state.speed + (lean > 0 ? merged.acceleration * lean : merged.brake * lean) * dt));
  state.lateral += (steer * merged.steerGain - state.lateral * merged.balanceAssist) * dt;
  state.lateral = Math.max(-1.25, Math.min(1.25, state.lateral));
  state.distance += state.speed * dt;
  const feature = map.features.find((item) => {
    const segmentIndex = map.segments.findIndex((segment) => segment.id === item.segmentId);
    const start = map.segments.slice(0, segmentIndex).reduce((sum, segment) => sum + segment.len, 0) + item.offset;
    return state.distance >= start && state.distance < start + item.length && !state.hit.has(item.id);
  });
  if (feature) {
    state.hit.add(feature.id);
    if (feature.type === 'boost') state.speed = Math.min(merged.maxSpeed, state.speed + 6);
    if (feature.type === 'slow' || feature.type === 'slow-wall') state.speed = Math.max(7, state.speed - 7);
    if (feature.type === 'obstacle' && Math.abs(state.lateral - feature.theta) < feature.width) { state.speed *= .55; state.penalties += merged.hazardPenalty; }
  }
  state.elapsed += dt;
  return state;
}
