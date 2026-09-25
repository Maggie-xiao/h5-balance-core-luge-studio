import { generateBatch, generateMap } from './core/generator.js';
import { autoTune, runQA } from './core/qa.js';
import { endlessManifest, loadLibrary, loadPlaylist, saveLibrary, savePlaylist, upsertMap } from './core/store.js';
import { DEFAULT_TUNING, simulateStep } from './core/simulator.js';
import { totalLength } from './core/schema.js';

const $ = (id) => document.getElementById(id);
const FEATURE_LABELS = { boost: '加速带', conveyor: '磁力传送带', 'turbo-bottle':'涡轮加速瓶', slow: '减速带', obstacle: '施工路障', 'tire-chicane':'轮胎阵', spinner:'旋转横杆', spikes:'尖刺板', jump: '跳台', 'slow-wall': '摩擦墙', energy: '能量晶体', 'item-box': '随机补给', oil: '油膜', 'moving-gate': '横移门' };
const FEATURE_COLORS = { boost: '#63db9b', conveyor: '#42d9ff', 'turbo-bottle':'#ffcf4f', slow: '#f4b85c', obstacle: '#ef766f', 'tire-chicane':'#1f3136', spinner:'#ff7f68', spikes:'#d7e4e7', jump: '#7ba7ff', 'slow-wall': '#d887ce', energy: '#f5df62', 'item-box': '#65dff2', oil: '#8f75aa', 'moving-gate': '#ff8c72' };
let library = loadLibrary();
let playlist = loadPlaylist();
let currentMap = library[0] ? structuredClone(library[0].map) : null;
let currentEntryId = library[0]?.id || null;
let selectedSegmentId = null;
let libraryFilter = 'all';
let tuning = { ...DEFAULT_TUNING };
let toastTimer;
let debugFrame;
let debugState;
const keys = new Set();

function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600); }
function download(name, value) { const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
function recipe() {
  return { seed: Number($('seed').value), duration: Number($('duration').value), difficulty: Number($('difficulty').value) / 100, complexity: Number($('complexity').value) / 100, shape: $('shape-control').querySelector('.active').dataset.value, environment: $('environment').value, mechanisms: Object.fromEntries([...document.querySelectorAll('[data-mechanism]')].map((input) => [input.dataset.mechanism, Number(input.value)])) };
}

for (const type of Object.keys(FEATURE_LABELS)) {
  const label = document.createElement('label'); label.textContent = FEATURE_LABELS[type];
  const defaults = { boost: 3, conveyor: 3, 'turbo-bottle':3, slow: 3, obstacle: 3, 'tire-chicane':3, spinner:2, spikes:2, jump: 2, 'slow-wall': 1, energy: 4, 'item-box': 2, oil: 2, 'moving-gate': 2 };
  label.innerHTML += `<input data-mechanism="${type}" type="number" min="0" max="10" value="${defaults[type]}">`;
  $('mechanism-inputs').append(label);
}
for (const [key, value] of Object.entries(DEFAULT_TUNING)) {
  const row = document.createElement('div'); row.className = 'tuning-row';
  row.innerHTML = `<label><span>${({ baseSpeed:'基础速度',maxSpeed:'最高速度',acceleration:'后仰加速',brake:'前倾制动',steerGain:'转向增益',balanceAssist:'平衡辅助',hazardPenalty:'碰撞罚时',driftChargeRate:'漂移蓄能速度',driftBoost:'漂移加速强度' })[key]}</span><output>${value}</output></label><input data-tuning="${key}" type="range" min="${key === 'maxSpeed' ? 20 : key === 'baseSpeed' ? 10 : key === 'balanceAssist' ? 0 : .5}" max="${key === 'maxSpeed' ? 60 : key === 'baseSpeed' ? 35 : key === 'balanceAssist' ? 1 : 18}" step="${key === 'balanceAssist' ? .01 : .1}" value="${value}">`;
  $('tuning-inputs').append(row);
}

document.querySelectorAll('.tabs button').forEach((button) => button.addEventListener('click', () => openTab(button.dataset.tab)));
function openTab(name) {
  document.querySelectorAll('.tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
  document.querySelectorAll('.tab-page').forEach((page) => page.classList.toggle('active', page.id === `tab-${name}`));
  if (name === 'library') renderLibrary();
  if (name === 'editor') renderEditor();
  if (name === 'endless') renderEndless();
  if (name === 'debug') startDebug(); else stopDebug();
  requestAnimationFrame(renderAllCanvases);
}

['duration','difficulty','complexity'].forEach((id) => $(id).addEventListener('input', () => { $(`${id}-output`).textContent = id === 'duration' ? `${$(id).value} 秒` : `${$(id).value}%`; }));
$('shape-control').addEventListener('click', (event) => { if (!event.target.dataset.value) return; [...event.currentTarget.children].forEach((x) => x.classList.toggle('active', x === event.target)); });
$('random-seed').addEventListener('click', () => { $('seed').value = crypto.getRandomValues(new Uint32Array(1))[0]; });
$('generate-one').addEventListener('click', () => acceptGenerated([generateMap(recipe())], true));
$('generate-batch').addEventListener('click', () => acceptGenerated(generateBatch(recipe(), Number($('batch-count').value)), false));

function acceptGenerated(maps, focus) {
  let pass = 0;
  for (let map of maps) {
    let qa = runQA(map, tuning);
    if (!qa.pass && qa.issues.every((entry) => ['DURATION','DURATION_MARGIN'].includes(entry.code))) { map = autoTune(map, tuning); qa = runQA(map, tuning); }
    const result = upsertMap(library, map, qa);
    library = result.library; if (qa.pass) pass++;
    if (focus || !currentMap) { currentMap = structuredClone(map); currentEntryId = result.entry.id; }
  }
  saveLibrary(library); renderCurrent(); updateCounts();
  toast(maps.length === 1 ? '赛道已生成并完成 QA' : `${maps.length} 张已生成，${pass} 张通过自动 QA`);
}

function drawTrack(canvas, map, options = {}) {
  const ctx = canvas.getContext('2d'); const rect = canvas.getBoundingClientRect(); const ratio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.max(1, rect.width * ratio); canvas.height = Math.max(1, rect.height * ratio); ctx.scale(ratio, ratio); ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = options.transparent ? 'transparent' : '#0c1214'; ctx.fillRect(0, 0, rect.width, rect.height);
  if (!map) return;
  let x = 0, y = 0, heading = 0; const points = [{ x, y, segment: map.segments[0] }];
  for (const segment of map.segments) {
    const steps = Math.max(2, Math.ceil(segment.len / 35));
    for (let n = 1; n <= steps; n++) { heading += (segment.yaw || 0) / steps * Math.PI / 180; x += Math.sin(heading) * segment.len / steps; y += Math.cos(heading) * segment.len / steps; points.push({ x, y, segment }); }
  }
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y); const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((rect.width - 56) / Math.max(1, maxX - minX), (rect.height - 56) / Math.max(1, maxY - minY));
  const project = (p) => ({ x: 28 + (p.x - minX) * scale + (rect.width - 56 - (maxX - minX) * scale) / 2, y: rect.height - 28 - (p.y - minY) * scale - (rect.height - 56 - (maxY - minY) * scale) / 2 });
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); points.forEach((point, i) => { const p = project(point); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.strokeStyle = '#21363b'; ctx.lineWidth = Math.max(7, 12 * Math.min(1, scale)); ctx.stroke(); ctx.strokeStyle = '#67aab4'; ctx.lineWidth = Math.max(2, 4 * Math.min(1, scale)); ctx.stroke();
  let distance = 0; const markers = new Map(); for (const segment of map.segments) { markers.set(segment.id, distance); distance += segment.len; }
  for (const feature of map.features) { const target = markers.get(feature.segmentId) + feature.offset; let walked = 0, marker = points[0]; for (let i = 1; i < points.length; i++) { const dx=points[i].x-points[i-1].x,dy=points[i].y-points[i-1].y,part=Math.hypot(dx,dy); if(walked+part>=target){const t=(target-walked)/part;marker={x:points[i-1].x+dx*t,y:points[i-1].y+dy*t};break} walked+=part; } const p=project(marker); ctx.beginPath();ctx.arc(p.x,p.y,options.small?3:5,0,Math.PI*2);ctx.fillStyle=FEATURE_COLORS[feature.type];ctx.fill(); }
  if (options.selected) { const selected = points.filter((p) => p.segment.id === options.selected); if(selected.length){ctx.beginPath();selected.forEach((point,i)=>{const p=project(point);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();} }
}

function renderCurrent() {
  const entry = library.find((item) => item.id === currentEntryId); const qa = currentMap ? runQA(currentMap, tuning) : null;
  $('map-title').textContent = currentMap?.name || '设置参数后生成第一张赛道';
  $('map-status').textContent = qa ? qa.pass ? 'QA 通过' : 'QA 未通过' : '待生成'; $('map-status').className = `status ${qa?.pass ? 'pass' : qa ? 'failed' : 'review'}`;
  $('map-metrics').innerHTML = qa ? metric('预计时长', `${qa.duration.toFixed(0)}s`) + metric('总长度', `${qa.length.toFixed(0)}m`) + metric('复杂度', qa.complexity) + metric('QA 分数', qa.score) : '';
  if (!qa) $('qa-summary').textContent = '生成后会自动执行结构、安全、节奏与可玩性检查。';
  else $('qa-summary').innerHTML = `<strong>${qa.pass ? '自动 QA 已通过' : `${qa.issues.filter((x)=>x.severity==='error').length} 项需要处理`}</strong>${qa.issues.length ? qa.issues.slice(0,3).map((x)=>`<span class="issue">${x.message}</span>`).join('') : '<span class="issue">结构、安全距离、时长与玩法节奏均在阈值内。</span>'}${entry?.status === 'approved' ? '<span class="issue">已人工批准。</span>' : ''}`;
  requestAnimationFrame(() => drawTrack($('track-canvas'), currentMap));
}
const metric = (label, value) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;

function renderLibrary() {
  const root = $('library-grid'); root.replaceChildren();
  const entries = library.filter((entry) => libraryFilter === 'all' || entry.status === libraryFilter);
  if (!entries.length) { root.innerHTML = '<div class="empty-state">暂无符合条件的地图</div>'; return; }
  entries.forEach((entry) => {
    const card = document.createElement('article'); card.className = 'map-card';
    card.innerHTML = `<div class="card-head"><strong>${entry.map.name}</strong><span class="status ${entry.status}">${({review:'待审核',approved:'已批准',failed:'未通过'})[entry.status]}</span></div><canvas></canvas><div class="card-meta"><span>${entry.qa.duration.toFixed(0)} 秒</span><span>${entry.qa.length.toFixed(0)} 米</span><span>QA ${entry.qa.score}</span></div><div class="card-actions"><button data-action="open">编辑</button><button data-action="review">查看</button>${entry.qa.pass ? `<button data-action="approve" class="${entry.status === 'approved' ? '' : 'primary'}">${entry.status === 'approved' ? '取消批准' : '批准'}</button>` : ''}</div>`;
    card.addEventListener('click', (event) => handleCard(entry, event.target.dataset.action)); root.append(card); requestAnimationFrame(() => drawTrack(card.querySelector('canvas'), entry.map, { small: true }));
  });
}
function handleCard(entry, action) {
  if (!action) return; currentMap = structuredClone(entry.map); currentEntryId = entry.id;
  if (action === 'open') openTab('editor');
  if (action === 'review') { openTab('generate'); renderCurrent(); }
  if (action === 'approve') { entry.status = entry.status === 'approved' ? 'review' : 'approved'; saveLibrary(library); renderLibrary(); renderEndless(); toast(entry.status === 'approved' ? '地图已批准，可加入 Endless' : '已撤销批准'); }
}
document.querySelector('.filter-group').addEventListener('click', (event) => { if(!event.target.dataset.filter)return; libraryFilter=event.target.dataset.filter; [...event.currentTarget.children].forEach((x)=>x.classList.toggle('active',x===event.target));renderLibrary(); });

function renderEditor() {
  $('editor-empty').hidden = Boolean(currentMap); const list = $('segment-list'); list.replaceChildren();
  if (!currentMap) return;
  if (!selectedSegmentId || !currentMap.segments.some((x)=>x.id===selectedSegmentId)) selectedSegmentId=currentMap.segments[1]?.id || currentMap.segments[0].id;
  currentMap.segments.forEach((segment,index)=>{const li=document.createElement('li');li.innerHTML=`<button class="${segment.id===selectedSegmentId?'selected':''}"><span>${index+1}. ${segment.tag}</span><small>${segment.len}m</small></button>`;li.onclick=()=>{selectedSegmentId=segment.id;renderEditor()};list.append(li)});
  renderInspector(); renderEditorQA(); requestAnimationFrame(()=>drawTrack($('editor-canvas'),currentMap,{selected:selectedSegmentId}));
}
function renderInspector() {
  const form=$('inspector');form.replaceChildren();const segment=currentMap.segments.find((x)=>x.id===selectedSegmentId);$('selection-label').textContent=segment.id;
  for(const [key,label,min,max,step] of [['len','长度 m',20,600,1],['yaw','转向 °',-80,80,1],['drop','坡度 °',.4,22,.1],['rad','半径 m',3,6,.1],['bank','倾斜 °',-40,40,1],['roof','封闭度',0,1,.1],['spin','翻滚 °',-360,360,15],['ease','过渡 m',1,120,1]]){const field=document.createElement('label');field.textContent=label;field.innerHTML+=`<input name="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${segment[key]??0}">`;field.querySelector('input').onchange=(e)=>{segment[key]=Number(e.target.value);renderEditorQA();drawTrack($('editor-canvas'),currentMap,{selected:selectedSegmentId})};form.append(field)}
}
function renderEditorQA(){const qa=runQA(currentMap,tuning);$('editor-qa').innerHTML=`<div class="qa-line"><strong>${qa.pass?'QA 通过':`QA ${qa.issues.filter((x)=>x.severity==='error').length} 个错误`}</strong> · ${qa.duration.toFixed(1)} 秒 · ${qa.length.toFixed(0)} 米</div>`+qa.issues.slice(0,5).map((x)=>`<div class="qa-line">${x.severity==='error'?'●':'△'} ${x.message}</div>`).join('')}
$('add-segment').onclick=()=>{if(!currentMap)return;const finish=currentMap.segments.pop();const id=`seg-${crypto.randomUUID().slice(0,6)}`;currentMap.segments.push({id,len:160,yaw:0,drop:6,rad:4.2,roof:0,bank:0,spin:0,ease:30,tag:'straight'},finish);selectedSegmentId=id;renderEditor()};
$('auto-tune').onclick=()=>{if(!currentMap)return;currentMap=autoTune(currentMap,tuning);renderEditor();toast('已按目标时长调整赛段')};
$('save-revision').onclick=()=>{if(!currentMap)return;const qa=runQA(currentMap,tuning);const result=upsertMap(library,currentMap,qa,currentEntryId);library=result.library;currentEntryId=result.entry.id;saveLibrary(library);updateCounts();renderEditor();toast(qa.pass?'修订已保存，等待人工批准':'修订已保存，但未通过 QA')};

function startDebug(){if(!currentMap){$('debug-message').hidden=false;return}$('debug-message').hidden=true;resetDebug();let last=performance.now();const loop=(now)=>{const dt=Math.min(.033,(now-last)/1000);last=now;const input={steer:(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),lean:(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0)};simulateStep(debugState,input,currentMap,tuning,dt);renderDebug(input);if(debugState.distance>=totalLength(currentMap))resetDebug();debugFrame=requestAnimationFrame(loop)};debugFrame=requestAnimationFrame(loop)}
function stopDebug(){cancelAnimationFrame(debugFrame)}
function resetDebug(){debugState={speed:tuning.baseSpeed,lateral:0,distance:0,elapsed:0,penalties:0,hit:new Set()}}
function renderDebug(input){const canvas=$('debug-canvas'),ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,2);canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;ctx.scale(ratio,ratio);const w=rect.width,h=rect.height;ctx.fillStyle='#091012';ctx.fillRect(0,0,w,h);const center=w/2-debugState.lateral*w*.14;for(let y=-80;y<h+120;y+=90){const perspective=(y+120)/(h+200);ctx.strokeStyle='#1e3439';ctx.lineWidth=2+perspective*8;ctx.beginPath();ctx.moveTo(center-w*(.08+perspective*.32),y);ctx.lineTo(center+w*(.08+perspective*.32),y);ctx.stroke()}ctx.fillStyle=debugState.boostTimer>0?'#f5df62':'#63db9b';ctx.fillRect(w/2-16,h*.72,32,50);ctx.fillStyle='#dff8ea';ctx.fillRect(w/2-5,h*.72+6,10,18);$('debug-speed').textContent=`${Math.round(debugState.speed*3.6)} km/h`;$('debug-distance').textContent=`${Math.round(debugState.distance)} / ${Math.round(totalLength(currentMap))} m`;$('debug-time').textContent=`${debugState.elapsed.toFixed(1)} s +${debugState.penalties.toFixed(1)}`;$('debug-drift').textContent=`漂移 ${Math.round(debugState.driftCharge*100)}%`;$('debug-energy').textContent=`能量 ${debugState.energy}/10${debugState.combo>1?` · 连击 ×${debugState.combo}`:''}`;$('debug-event').textContent=debugState.event||'稳定滑行';$('balance-dot').style.left=`${50+debugState.lateral*38}%`}
window.addEventListener('keydown',(e)=>{if(e.key.startsWith('Arrow')){e.preventDefault();keys.add(e.key)}});window.addEventListener('keyup',(e)=>keys.delete(e.key));
document.querySelectorAll('[data-tuning]').forEach((input)=>input.addEventListener('input',()=>{tuning[input.dataset.tuning]=Number(input.value);input.parentElement.querySelector('output').textContent=input.value;if(currentMap)renderCurrent()}));$('debug-reset').onclick=resetDebug;

function renderEndless(){const pool=$('approved-pool'),list=$('playlist');pool.replaceChildren();list.replaceChildren();const approved=library.filter((entry)=>entry.status==='approved'&&entry.qa.pass);approved.filter((entry)=>!playlist.includes(entry.id)).forEach((entry)=>{const item=document.createElement('div');item.className='pool-item';item.innerHTML=`<strong>${entry.map.name}</strong><span class="muted">${entry.qa.duration.toFixed(0)}s</span><button>＋</button>`;item.querySelector('button').onclick=()=>{playlist.push(entry.id);savePlaylist(playlist);renderEndless()};pool.append(item)});playlist=playlist.filter((id)=>approved.some((entry)=>entry.id===id));playlist.forEach((id,index)=>{const entry=approved.find((x)=>x.id===id);const item=document.createElement('li');item.draggable=true;item.dataset.id=id;item.innerHTML=`<span class="muted">${String(index+1).padStart(2,'0')}</span><strong>${entry.map.name}</strong><button data-move="up" title="上移">↑</button><button data-move="down" title="下移">↓</button><button data-remove title="移除">×</button>`;item.onclick=(e)=>{if(e.target.dataset.remove!==undefined)playlist.splice(index,1);if(e.target.dataset.move==='up'&&index) [playlist[index-1],playlist[index]]=[playlist[index],playlist[index-1]];if(e.target.dataset.move==='down'&&index<playlist.length-1)[playlist[index+1],playlist[index]]=[playlist[index],playlist[index+1]];savePlaylist(playlist);renderEndless()};item.ondragstart=(e)=>e.dataTransfer.setData('text/plain',id);item.ondragover=(e)=>e.preventDefault();item.ondrop=(e)=>{e.preventDefault();const from=e.dataTransfer.getData('text/plain'),fromIndex=playlist.indexOf(from);playlist.splice(fromIndex,1);playlist.splice(index,0,from);savePlaylist(playlist);renderEndless()};list.append(item)});savePlaylist(playlist)}
$('export-endless').onclick=()=>{const manifest=endlessManifest(library,playlist);if(!manifest.maps.length){toast('请先批准地图并加入播放清单');return}download('core-luge-endless.json',manifest)};

$('export-map-button').onclick=()=>currentMap?download(`${currentMap.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`,currentMap):toast('请先选择地图');
$('import-button').onclick=()=>$('file-input').click();$('file-input').onchange=async(e)=>{try{const value=JSON.parse(await e.target.files[0].text());const maps=value.schema==='neon-luge.endless.v1'?value.maps.map((x)=>x.map):[value];for(const map of maps){const qa=runQA(map,tuning);const result=upsertMap(library,map,qa);library=result.library;currentMap=map;currentEntryId=result.entry.id}saveLibrary(library);updateCounts();renderCurrent();toast(`已导入 ${maps.length} 张地图并完成 QA`)}catch(error){toast(`导入失败：${error.message}`)}e.target.value=''};
function updateCounts(){$('library-count').textContent=library.length}
function renderAllCanvases(){if(document.querySelector('#tab-generate.active'))drawTrack($('track-canvas'),currentMap);if(document.querySelector('#tab-editor.active')&&currentMap)drawTrack($('editor-canvas'),currentMap,{selected:selectedSegmentId})}
window.addEventListener('resize',renderAllCanvases);
updateCounts();renderCurrent();renderLibrary();renderEndless();
