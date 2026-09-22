const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'core-luge.player.v1';
const today = new Date().toISOString().slice(0, 10);
let profile;
try { profile = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { profile = {}; }
profile = { crystals: 0, xp: 0, bestByDay: {}, ...profile };
function renderProfile(){const level=Math.floor(profile.xp/500)+1;$('pilot-level').textContent=`${String(level).padStart(2,'0')} · ${level<3?'新秀':level<6?'巡回车手':'核心大师'}`;$('crystal-total').textContent=profile.crystals.toLocaleString('zh-CN');$('daily-best').textContent=profile.bestByDay[today]||'--:--.-';$('level-progress').style.width=`${profile.xp%500/5}%`;$('next-unlock').textContent=`再获得 ${500-profile.xp%500} 晶体解锁新尾焰`}
let awarded=false;new MutationObserver(()=>{const visible=!$('results').hidden;if(!visible){awarded=false;return}if(awarded)return;awarded=true;const energy=Number($('result-energy').textContent)||0,hits=Number($('result-hits').textContent)||0,reward=120+energy*18+Math.max(0,60-hits*20),time=$('result-time').textContent;profile.crystals+=reward;profile.xp+=reward;if(!profile.bestByDay[today]||time<profile.bestByDay[today])profile.bestByDay[today]=time;localStorage.setItem(SAVE_KEY,JSON.stringify(profile));$('result-reward').textContent=`+${reward} 核心晶体`;$('rank-medal').textContent=hits===0&&energy>=5?'S':hits<=1?'A':hits<=3?'B':'C';$('mission-fill').style.width=`${Math.min(100,energy/5*100)}%`;renderProfile()}).observe($('results'),{attributes:true,attributeFilter:['hidden']});renderProfile();
