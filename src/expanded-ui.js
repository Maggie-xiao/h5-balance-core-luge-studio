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
const countdown = document.getElementById('countdown');
if (countdown && !countdown.querySelector('.start-lights')) countdown.innerHTML = '<div class="start-lights"><i></i><i></i><i></i></div><span>CORE LUGE GRAND PRIX</span><strong>3</strong><small>READY TO RACE</small>';
document.querySelector('.lobby-footer .controls')?.insertAdjacentHTML('beforeend', '<span class="p2-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 2P</span>');

const garageIntro = document.querySelector('.garage-intro');
const vehicleGrid = document.querySelector('.vehicle-grid');
if (garageIntro && vehicleGrid && !document.getElementById('garage-mode')) {
  garageIntro.insertAdjacentHTML('afterend', '<div class="garage-mode" id="garage-mode" role="radiogroup" aria-label="游戏模式"><button class="active" data-race-mode="solo" role="radio" aria-checked="true"><b>单人模式</b><small>挑战随机巡回赛</small></button><button data-race-mode="versus" role="radio" aria-checked="false"><b>双人竞速</b><small>本地同屏对决</small></button></div><h2 class="driver-label" id="driver-one-label"><span>1P</span> 选择赛车</h2>');
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
  selectRaceMode(localStorage.getItem('core-luge.race-mode') || 'solo');
  if (mode) mode.closest('label').hidden = true;
}
