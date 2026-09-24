export const DEFAULT_TUNING = { baseSpeed: 21.5, maxSpeed: 40, acceleration: 8.5, brake: 11, steerGain: 1.4, balanceAssist: .32, hazardPenalty: 2.2, driftChargeRate: 1, driftBoost: 5.5 };

function segmentAt(map, distance) {
  let start = 0;
  for (const segment of map.segments) {
    if (distance < start + segment.len) return { segment, start };
    start += segment.len;
  }
  return { segment: map.segments.at(-1), start };
}

export function simulateStep(state, input, map, tuning, dt) {
  const merged = { ...DEFAULT_TUNING, ...tuning };
  const lean = Math.max(-1, Math.min(1, input.lean));
  const steer = Math.max(-1, Math.min(1, input.steer));
  state.energy ??= 0; state.combo ??= 0; state.driftCharge ??= 0; state.boostTimer ??= 0; state.shieldTimer ??= 0; state.jumpTimer ??= 0; state.item ??= null; state.event ??= '';
  const { segment } = segmentAt(map, state.distance);
  const drifting = Math.abs(segment.yaw || 0) >= 10 && Math.abs(steer) >= .4 && Math.sign(steer) === Math.sign(segment.yaw);
  if (drifting) state.driftCharge = Math.min(1.5, state.driftCharge + merged.driftChargeRate * Math.abs(steer) * dt);
  else if (state.driftCharge > .35) { state.boostTimer = .8 + Math.min(1.2, state.driftCharge); state.event = '漂移加速'; state.driftCharge = 0; }
  else state.driftCharge = Math.max(0, state.driftCharge - dt * .8);
  state.boostTimer = Math.max(0, state.boostTimer - dt); state.shieldTimer = Math.max(0, state.shieldTimer - dt); state.jumpTimer = Math.max(0, state.jumpTimer - dt);
  state.speed = Math.max(5, Math.min(merged.maxSpeed, state.speed + (lean > 0 ? merged.acceleration * lean : merged.brake * lean) * dt));
  if (state.boostTimer > 0) state.speed = Math.min(merged.maxSpeed + 6, state.speed + merged.driftBoost * dt);
  state.lateral += (steer * merged.steerGain - state.lateral * merged.balanceAssist) * dt;
  state.lateral = Math.max(-1.25, Math.min(1.25, state.lateral));
  state.distance += state.speed * dt;
  const feature = map.features.find((item) => {
    const segmentIndex = map.segments.findIndex((segment) => segment.id === item.segmentId);
    const start = map.segments.slice(0, segmentIndex).reduce((sum, segment) => sum + segment.len, 0) + item.offset;
    return state.distance >= start && state.distance < start + item.length && !state.hit.has(item.id);
  });
  if (feature) {
    const touches = Math.abs(state.lateral - feature.theta) < feature.width / 2 + .12;
    const movingTheta = feature.type === 'moving-gate' ? Math.sin(state.elapsed * 2.4) * .62 : feature.type === 'spinner' ? Math.sin(state.elapsed * 2.8) * .72 : feature.theta;
    const hitsHazard = ['obstacle', 'tire-chicane', 'spinner', 'oil', 'moving-gate'].includes(feature.type) && Math.abs(state.lateral - movingTheta) < feature.width;
    if (touches || hitsHazard) state.hit.add(feature.id);
    if (touches && feature.type === 'boost') { state.boostTimer = 1.35; state.event = '路线加速'; }
    if (touches && feature.type === 'conveyor') { state.boostTimer = 2; state.speed = Math.min(merged.maxSpeed + 5, state.speed + 5); state.event = '磁力传送带'; }
    if (touches && feature.type === 'turbo-bottle') { state.boostTimer = 2.8; state.speed = Math.min(merged.maxSpeed+4,state.speed+4); state.event = '拾取：烈焰涡轮'; }
    if (touches && feature.type === 'jump') { state.jumpTimer = 1.05; state.boostTimer = Math.max(state.boostTimer,.7); state.event = '飞跃跳台'; }
    if (touches && (feature.type === 'slow' || feature.type === 'slow-wall')) state.speed = Math.max(7, state.speed - 7);
    if (touches && feature.type === 'energy') { state.energy = Math.min(10, state.energy + 1); state.combo += 1; state.speed = Math.min(merged.maxSpeed, state.speed + .8); state.event = `能量连击 ×${state.combo}`; }
    if (touches && feature.type === 'item-box') {
      const roll = (map.seed + state.hit.size * 17) % 3;
      state.item = ['turbo', 'shield', 'magnet'][roll];
      if (state.item === 'turbo') state.boostTimer = 2.2;
      if (state.item === 'shield') state.shieldTimer = 6;
      if (state.item === 'magnet') state.energy = Math.min(10, state.energy + 2);
      state.event = { turbo: '补给：涡轮', shield: '补给：护盾', magnet: '补给：能量磁吸' }[state.item];
    }
    if (hitsHazard && state.shieldTimer <= 0) { state.speed *= feature.type === 'oil' ? .68 : .55; state.penalties += merged.hazardPenalty; state.combo = 0; state.event = feature.type === 'oil' ? '油膜打滑' : feature.type === 'spinner' ? '撞上旋转横杆' : feature.type === 'tire-chicane' ? '撞上轮胎阵' : '发生碰撞'; }
    else if (hitsHazard) { state.shieldTimer = 0; state.event = '护盾抵消碰撞'; }
  }
  state.elapsed += dt;
  return state;
}
