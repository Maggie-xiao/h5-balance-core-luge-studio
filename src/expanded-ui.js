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
const countdown = document.getElementById('countdown');
if (countdown && !countdown.querySelector('.start-lights')) countdown.innerHTML = '<div class="start-lights"><i></i><i></i><i></i></div><span>CORE LUGE GRAND PRIX</span><strong>3</strong><small>READY TO RACE</small>';
document.querySelector('.lobby-footer .controls')?.insertAdjacentHTML('beforeend', '<span class="p2-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 2P</span>');
