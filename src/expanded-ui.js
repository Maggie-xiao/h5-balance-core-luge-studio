const mode = document.getElementById('mode');
if (mode && !mode.querySelector('[value="versus"]')) {
  const option = document.createElement('option');
  option.value = 'versus';
  option.textContent = '双人同屏竞速';
  mode.insertBefore(option, mode.lastElementChild);
  mode.addEventListener('change', () => dispatchEvent(new CustomEvent('core-luge-mode', { detail: mode.value })));
}
const energy = document.getElementById('energy');
if (energy && !document.getElementById('coin-value')) energy.insertAdjacentHTML('beforeend', '<span class="coin-count">金币 <b id="coin-value">0</b></span><span id="versus-rank" hidden>1P 领先</span>');
if (!document.getElementById('collision-flash')) document.querySelector('.game-ui')?.insertAdjacentHTML('afterbegin', '<div id="collision-flash" class="collision-flash"></div>');
if (!document.getElementById('player-two-hud')) document.querySelector('.game-ui')?.insertAdjacentHTML('afterbegin', '<div id="split-divider" class="split-divider" hidden></div><section id="player-two-hud" class="player-two-hud" hidden><b>2P</b><span><small>速度</small><strong id="p2-speed">0</strong><em>km/h</em></span><span><small>进度</small><strong id="p2-progress">0%</strong></span></section>');
if (!document.getElementById('race-map')) document.querySelector('.game-ui')?.insertAdjacentHTML('afterbegin', '<aside id="race-map" class="race-map" hidden><canvas id="minimap" width="220" height="170"></canvas><div id="race-position"><strong>1</strong><small>/ 6</small></div></aside><ol id="race-ranking" class="race-ranking" hidden></ol><button id="sound-toggle" class="sound-toggle" aria-label="声音开关" title="声音开关">♪</button>');
document.getElementById('sound-toggle')?.addEventListener('click', event => { event.currentTarget.classList.toggle('muted'); dispatchEvent(new CustomEvent('core-luge-sound', { detail: !event.currentTarget.classList.contains('muted') })); });
const countdown = document.getElementById('countdown');
if (countdown && !countdown.querySelector('.start-lights')) countdown.innerHTML = '<div class="start-lights"><i></i><i></i><i></i></div><span>CORE LUGE GRAND PRIX</span><strong>3</strong><small>READY TO RACE</small>';
document.querySelector('.lobby-footer .controls')?.insertAdjacentHTML('beforeend', '<span class="p2-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 2P</span>');

const garageIntro = document.querySelector('.garage-intro');
const vehicleGrid = document.querySelector('.vehicle-grid');
if (garageIntro && vehicleGrid && !document.getElementById('garage-mode')) {
  garageIntro.innerHTML = '<div class="arcade-kicker"><span>WORLD TOUR</span><i>SEASON 01</i></div><h1><span>CORE</span> LUGE</h1><p>选择赛事与赛车</p><div class="arcade-status"><span><small>车手等级</small><b>08</b></span><span><small>核心晶体</small><b>3,764</b></span></div><div class="garage-season"><span>极光赛季</span><b>12</b><small>天后结束</small></div>';
  garageIntro.insertAdjacentHTML('afterend', '<div class="garage-section-title"><span>01</span><div><small>SELECT EVENT</small><strong>赛事模式</strong></div><i>WORLD TOUR</i></div><div class="garage-mode" id="garage-mode" role="radiogroup" aria-label="游戏模式"><button class="active" data-race-mode="grand-prix" role="radio" aria-checked="true"><i>GP</i><span><b>大奖赛</b><small>6车竞速 · 争夺冠军</small></span><em>01</em></button><button data-race-mode="survival" role="radio" aria-checked="false"><i>SV</i><span><b>生存赛</b><small>8车混战 · 坚持到底</small></span><em>02</em></button><button data-race-mode="time-trial" role="radio" aria-checked="false"><i>TT</i><span><b>计时赛</b><small>单人挑战 · 刷新纪录</small></span><em>03</em></button><button data-race-mode="versus" role="radio" aria-checked="false"><i>VS</i><span><b>对战赛</b><small>双人分屏 · AI 陪跑</small></span><em>04</em></button></div><div class="garage-section-title vehicle-title"><span>02</span><div><small>CHOOSE MACHINE</small><strong>赛车车库</strong></div><i>4 MACHINES</i></div><h2 class="driver-label" id="driver-one-label"><span>1P</span> 选择赛车</h2>');
  document.getElementById('driver-one-label').insertAdjacentHTML('afterend', '<section class="vehicle-showcase" id="vehicle-showcase"><div class="showcase-copy"><span id="showcase-class">漂移型</span><h2 id="showcase-name">脉冲 X</h2><p id="showcase-trait">灵敏漂移 · 快速充能</p><div class="showcase-stats"><i><em>速度</em><b id="showcase-speed"></b></i><i><em>操控</em><b id="showcase-steer"></b></i><i><em>稳定</em><b id="showcase-stability"></b></i></div></div><div class="showcase-platform"><div id="showcase-kart" class="vehicle-preview pulse"><i class="cockpit"></i><i class="body"></i><i class="rail left"></i><i class="rail right"></i></div><span>01</span></div><div class="showcase-badge">PLAYER 1</div></section>');
  const showcaseSpecs = { comet: ['全能型', '彗星 MK-I', '均衡响应 · 推荐新车手', 76, 78, 74, '01'], razor: ['极速型', '风刃 GT', '极速推进 · 精准压弯', 96, 62, 58, '02'], trail: ['稳定型', '岩虎 R', '强力抓地 · 宽容稳定', 67, 72, 96, '03'], pulse: ['漂移型', '脉冲 X', '灵敏漂移 · 快速充能', 82, 94, 64, '04'] };
  const updateShowcase = id => {
    const spec = showcaseSpecs[id] || showcaseSpecs.comet;
    document.getElementById('showcase-class').textContent = spec[0];
    document.getElementById('showcase-name').textContent = spec[1];
    document.getElementById('showcase-trait').textContent = spec[2];
    document.getElementById('showcase-speed').style.width = `${spec[3]}%`;
    document.getElementById('showcase-steer').style.width = `${spec[4]}%`;
    document.getElementById('showcase-stability').style.width = `${spec[5]}%`;
    document.querySelector('.showcase-platform>span').textContent = spec[6];
    document.getElementById('showcase-kart').className = `vehicle-preview ${id}`;
  };
  vehicleGrid.querySelectorAll('[data-vehicle]').forEach(card => card.addEventListener('click', () => updateShowcase(card.dataset.vehicle)));
  updateShowcase(localStorage.getItem('core-luge.vehicle') || 'comet');
  const secondGrid = vehicleGrid.cloneNode(true);
  secondGrid.id = 'player-two-vehicles';
  secondGrid.classList.add('player-two-grid');
  secondGrid.hidden = true;
  secondGrid.setAttribute('aria-label', '2P 赛车选择');
  secondGrid.querySelectorAll('[data-vehicle]').forEach((card, index) => {
    card.dataset.vehicleTwo = card.dataset.vehicle;
    delete card.dataset.vehicle;
    card.classList.toggle('selected', index === 1);
    card.setAttribute('aria-checked', index === 1 ? 'true' : 'false');
  });
  vehicleGrid.insertAdjacentElement('afterend', secondGrid);
  secondGrid.insertAdjacentHTML('beforebegin', '<h2 class="driver-label player-two-label" hidden><span>2P</span> 选择赛车 <small>WASD 控制</small></h2>');

  let playerTwoVehicle = localStorage.getItem('core-luge.vehicle-two') || 'razor';
  const syncSecondSelection = id => {
    playerTwoVehicle = id;
    localStorage.setItem('core-luge.vehicle-two', id);
    secondGrid.querySelectorAll('[data-vehicle-two]').forEach(card => {
      const active = card.dataset.vehicleTwo === id;
      card.classList.toggle('selected', active);
      card.setAttribute('aria-checked', active);
    });
    dispatchEvent(new CustomEvent('core-luge-vehicle-two', { detail: id }));
  };
  secondGrid.querySelectorAll('[data-vehicle-two]').forEach(card => card.addEventListener('click', () => syncSecondSelection(card.dataset.vehicleTwo)));
  syncSecondSelection(playerTwoVehicle);

  const selectRaceMode = selected => {
    const versus = selected === 'versus';
    localStorage.setItem('core-luge.race-mode', selected);
    document.body.dataset.raceMode = selected;
    document.querySelectorAll('[data-race-mode]').forEach(item => {
      const active = item.dataset.raceMode === selected;
      item.classList.toggle('active', active);
      item.setAttribute('aria-checked', active);
    });
    secondGrid.hidden = !versus;
    document.querySelector('.player-two-label').hidden = !versus;
    document.getElementById('driver-one-label').classList.toggle('versus', versus);
    if (mode) mode.value = versus ? 'versus' : 'tour';
    dispatchEvent(new CustomEvent('core-luge-mode', { detail: selected }));
  };
  document.querySelectorAll('[data-race-mode]').forEach(button => button.addEventListener('click', () => selectRaceMode(button.dataset.raceMode)));
  const savedMode = localStorage.getItem('core-luge.race-mode');
  selectRaceMode(['grand-prix', 'survival', 'time-trial', 'versus'].includes(savedMode) ? savedMode : 'grand-prix');
  if (mode) mode.closest('label').hidden = true;
}
