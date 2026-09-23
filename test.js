/* Knight Platformer — Tahap 4 Release Candidate Audit tests.
 * 65 tests: 57 dasar (config/fisika/combat/AI/kamera/level/input/render/audio/asset)
 * + 8 baru Tahap 4 (pause, visibility, dt-clamp, DPR fallback, touch anti double,
 * restart-setelah-pause, resume GameOver, resume Win).
 * Jalan headless: node test.js (tanpa dependency, mock DOM minimal).
 * Target: semua PASS, 0 JS error.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const gamePath = path.join(__dirname, 'game.js');
const src = fs.readFileSync(gamePath, 'utf8');
const cssPath = path.join(__dirname, 'style.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const htmlPath = path.join(__dirname, 'index.html');
const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';

// ---------- Mock DOM minimal ----------
let imageInstances = [];
function makeClassList() {
  const s = new Set();
  return {
    add: (c) => s.add(c), remove: (c) => s.delete(c),
    contains: (c) => s.has(c), _set: s
  };
}
function makeElement(id, mockCtx) {
  const el = {
    id, listeners: {},
    classList: makeClassList(),
    textContent: '',
    width: 960, height: 540,
    _focused: false,
    addEventListener(type, fn) {
      (el.listeners[type] = el.listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    dispatch(type, ev) {
      (el.listeners[type] || []).forEach((fn) => fn(ev || {}));
    },
    focus() { el._focused = true; },
    getContext() { return mockCtx; },
    style: {}
  };
  // canvas + container butuh classList hidden awal untuk overlay
  if (id === 'gameover' || id === 'levelcomplete') el.classList.add('hidden');
  return el;
}
const mockCtx = new Proxy({}, {
  get(t, prop) {
    if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop === 'canvas') return {};
    // semua properti numerik/string: kembalikan 1/no-op
    return (...a) => {};
  },
  set() { return true; }
});
const elementIds = ['game', 'gameover', 'levelcomplete', 'btn-restart', 'btn-respawn',
  'btn-again', 'win-stats', 'canvas-container', 'btn-left', 'btn-right',
  'btn-jump', 'btn-attack',
  // Stage 5: menu + clear screens
  'mainmenu', 'menu-main', 'menu-controls', 'menu-about',
  'btn-play', 'btn-controls', 'btn-about', 'btn-back-controls', 'btn-back-about',
  'lvlclear', 'lvlclear-stats', 'btn-next', 'btn-replay', 'btn-lvlmenu',
  'gameclear', 'gameclear-stats', 'btn-again2', 'btn-gamemenu'];
const elements = {};
elementIds.forEach((id) => { elements[id] = makeElement(id, mockCtx); });

const docListeners = {};
const documentMock = {
  hidden: false,
  addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
  removeEventListener() {},
  getElementById(id) { return elements[id] || null; },
  createElement(tag) { return makeElement('el-' + tag + '-' + Math.random(), mockCtx); }
};
const winListeners = {};
const windowMock = {
  addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
  removeEventListener() {},
  devicePixelRatio: 1,
  innerWidth: 960, innerHeight: 540,
  AudioContext: undefined, webkitAudioContext: undefined,
  KnightGame: null
};
function fireWin(type, ev) {
  (winListeners[type] || []).forEach((fn) => fn(ev || {}));
}
function fireDoc(type, ev) {
  (docListeners[type] || []).forEach((fn) => fn(ev || {}));
}
// Image mock: sukses async (onload next tick), hitung instans
let pendingImageResolvers = [];
class MockImage {
  constructor() {
    this._src = ''; this.onload = null; this.onerror = null;
    imageInstances.push(this);
  }
  set src(v) {
    this._src = v;
    const self = this;
    // resolve async agar Promise.all bekerja seperti browser
    setTimeout(() => { if (self.onload) self.onload(); }, 0);
  }
  get src() { return this._src; }
}
const sandbox = {
  console, Math, JSON, Object, Array, String, Number, Boolean, Date,
  Promise, setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => 1, // jangan loop; cukup simpan
  cancelAnimationFrame: () => {},
  Image: MockImage,
  document: documentMock,
  window: windowMock,
  navigator: { userAgent: 'node-test' }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: 'game.js' });
} catch (e) {
  console.error('FATAL: game.js gagal dieksekusi di mock DOM:', e && e.stack || e);
  process.exit(1);
}
const G = windowMock.KnightGame;
if (!G) {
  console.error('FATAL: window.KnightGame tidak terbentuk');
  process.exit(1);
}

// ---------- Harness ----------
let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; failures.push(name + ' :: ' + (e && e.message || e)); console.log('FAIL ' + name + ' :: ' + (e && e.message || e)); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy, got ' + JSON.stringify(v)); }
function near(a, b, eps, msg) { if (Math.abs(a - b) > eps) throw new Error((msg || '') + ' expected ~' + b + ' got ' + a); }
function srcHas(s, msg) { if (!src.includes(s)) throw new Error(msg || ('source tidak mengandung: ' + s)); }
function noThrow(fn, msg) { try { fn(); } catch (e) { throw new Error((msg || 'throw') + ': ' + (e && e.message)); } }

// ---------- 57 TEST DASAR ----------
// Config (1-5)
test('01 DEBUG default false', () => { srcHas('const DEBUG = false'); eq(G.config.DEBUG, false); });
test('02 VIEW 960x540', () => { srcHas('VIEW_W = 960'); srcHas('VIEW_H = 540'); });
test('03 WORLD 2400x540', () => { const w = G.getWorld(); eq(w.w, 2400); eq(w.h, 540); eq(w.viewW, 960); srcHas('WORLD_W = 2400'); });
test('04 PLAYER_MAX_HP 100', () => { srcHas('PLAYER_MAX_HP = 100'); eq(G.getPlayer().hp, 100); });
test('05 MAX_PARTICLES 120 pool preallocated', () => { srcHas('MAX_PARTICLES = 120'); eq(G.fx.max(), 120); srcHas('preallocated'); });

// Fisika (6-11)
test('06 GRAVITY 2500', () => srcHas('GRAVITY = 2500'));
test('07 MAX_FALL 840', () => srcHas('MAX_FALL = 840'));
test('08 PLAYER_SPEED 210', () => srcHas('PLAYER_SPEED = 210'));
test('09 JUMP_FORCE 800', () => srcHas('JUMP_FORCE = 800'));
test('10 COYOTE_TIME 0.10', () => srcHas('COYOTE_TIME = 0.10'));
test('11 JUMP_BUFFER 0.12', () => srcHas('JUMP_BUFFER = 0.12'));

// Attack (12-16)
test('12 ATTACK_WINDUP 0.08', () => srcHas('ATTACK_WINDUP = 0.08'));
test('13 ATTACK_STRIKE 0.12', () => srcHas('ATTACK_STRIKE = 0.12'));
test('14 ATTACK_RECOVERY 0.16', () => srcHas('ATTACK_RECOVERY = 0.16'));
test('15 ATTACK_COOLDOWN 0.18', () => srcHas('ATTACK_COOLDOWN = 0.18'));
test('16 ATTACK_DAMAGE 12 + hitbox depan player', () => { srcHas('ATTACK_DAMAGE = 12'); srcHas('attackBox'); srcHas('didStrikeHit'); });

// Slime (17-22)
test('17 SLIME_MAX_HP 30', () => { srcHas('SLIME_MAX_HP = 30'); eq(G.getEnemies()[0].hp, 30); });
test('18 SLIME_PATROL 45 / CHASE 95', () => { srcHas('SLIME_PATROL_SPEED = 45'); srcHas('SLIME_CHASE_SPEED = 95'); });
test('19 SLIME_DETECT 230x120', () => { srcHas('SLIME_DETECT_X = 230'); srcHas('SLIME_DETECT_Y = 120'); });
test('20 SLIME_DAMAGE 10', () => srcHas('SLIME_DAMAGE = 10'));
test('21 SLIME_LEASH 380', () => srcHas('SLIME_LEASH = 380'));
test('22 slime punya patrol/chase/attack/hurt/death', () => {
  srcHas("'patrol'"); srcHas("'chase'"); srcHas("'attack'"); srcHas("'hurt'"); srcHas("state: 'patrol'");
});

// Kamera (23-25)
test('23 CAM_SMOOTH 4.5 + ahead R/L', () => { srcHas('CAM_SMOOTH = 4.5'); srcHas('CAM_AHEAD_R'); srcHas('CAM_AHEAD_L'); });
test('24 kamera dibatasi level (clamp 0..WORLD-VIEW)', () => { srcHas('WORLD_W - VIEW_W'); const c = G.getCamera(); ok(c.x >= 0 && c.x <= 2400 - 960, 'camera.x di luar batas'); });
test('25 kamera smooth lerp (tidak snap per-frame)', () => srcHas('dt * CAM_SMOOTH'));

// Level (26-33)
test('26 spawn player 80,300', () => { srcHas('playerSpawn'); const p = G.getPlayer(); G.restart(); const p2 = G.getPlayer(); eq(p2.x, 80); eq(p2.y, 300); });
test('27 3 slime di arena', () => { G.restart(); eq(G.getEnemies().length, 3); });
test('28 2 checkpoint', () => eq(G.getCheckpoints().length, 2));
test('29 goal x2280 w70 h120', () => { const g = G.getGoal(); eq(g.x, 2280); eq(g.w, 70); eq(g.h, 120); });
test('30 KILL_Y jatuh = death', () => srcHas('KILL_Y'));
test('31 2 celah (520-610 & 1050-1140)', () => { srcHas('x: 0,    y: 480, w: 520'); srcHas('x: 610,  y: 480, w: 440'); srcHas('x: 1140, y: 480, w: 610'); });
test('32 platform data terpusat di Level.platforms', () => srcHas('platforms: ['));
test('33 checkpoint & goal terpisah dari collision hard-code', () => { srcHas('checkpoints: ['); srcHas('goal: {'); });

// Player awal (34-38)
test('34 player w40 h78', () => { G.restart(); const p = G.getPlayer(); eq(p.w, 40); eq(p.h, 78); });
test('35 player hp 100 awal', () => { G.restart(); eq(G.getPlayer().hp, 100); });
test('36 player state awal idle/run valid', () => { G.restart(); ok(['idle', 'run', 'jump', 'fall'].includes(G.getPlayer().state), 'state=' + G.getPlayer().state); });
test('37 player facing awal 1', () => { G.restart(); eq(G.getPlayer().facing, 1); });
test('38 hitbox terpisah dari sprite (PLAYER_DRAW vs PLAYER_W/H)', () => { srcHas('PLAYER_DRAW'); srcHas('PLAYER_W = 40'); });

// Enemy awal (39-42)
test('39 slime w44 h32', () => { const s = G.getEnemies()[0]; eq(s.w, 44); eq(s.h, 32); });
test('40 slime state awal patrol/chase valid', () => { G.restart(); const s = G.getEnemies()[0]; ok(['patrol', 'chase'].includes(s.state), 'slime state=' + s.state); });
test('41 slime punya zona patrol minX/maxX', () => { const s = G.getEnemies()[0]; ok(s.minX < s.maxX, 'zona invalid'); });
test('42 slime prosedural (tanpa PNG eksternal)', () => srcHas('prosedural pixel-art'));

// Input keyboard (43-46)
test('43 KeyA/ArrowLeft -> Input.left', () => {
  fireWin('keydown', { code: 'KeyA', preventDefault() {} });
  eq(G.input.left, true);
  fireWin('keyup', { code: 'KeyA' });
  eq(G.input.left, false);
});
test('44 KeyD/ArrowRight -> Input.right', () => {
  fireWin('keydown', { code: 'KeyD', preventDefault() {} });
  eq(G.input.right, true);
  fireWin('keyup', { code: 'KeyD' });
  eq(G.input.right, false);
});
test('45 Space -> jumpPressed + jumpHeld', () => {
  G.input.jumpHeld = false; G.input.jumpPressed = false;
  fireWin('keydown', { code: 'Space', preventDefault() {} });
  eq(G.input.jumpHeld, true); eq(G.input.jumpPressed, true);
  fireWin('keyup', { code: 'Space' });
  eq(G.input.jumpHeld, false);
  G.input.jumpPressed = false;
});
test('46 KeyJ -> attackPressed', () => {
  G.input.attackPressed = false;
  fireWin('keydown', { code: 'KeyJ', preventDefault() {} });
  eq(G.input.attackPressed, true);
  G.input.attackPressed = false;
});

// Combat/HP (47-50)
test('47 hurtPlayer mengurangi HP + iframes', () => {
  G.restart(); const before = G.getPlayer().hp;
  G.hurtPlayer(10, G.getPlayer().x + 200);
  eq(G.getPlayer().hp, before - 10);
  ok(G.getPlayer().iframes > 0, 'iframes harus >0 setelah hurt');
});
test('48 iframes memblokir damage kedua (no double-hit)', () => {
  G.restart(); G.hurtPlayer(10, G.getPlayer().x + 200);
  const hp1 = G.getPlayer().hp;
  G.hurtPlayer(10, G.getPlayer().x + 200); // dalam iframes -> abaikan
  eq(G.getPlayer().hp, hp1);
});
test('49 HP 0 -> death', () => {
  G.restart(); G.hurtPlayer(999, G.getPlayer().x + 200);
  eq(G.getPlayer().hp, 0); eq(G.getPlayer().state, 'death');
});
test('50 respawn pulihkan HP/posisi/musuh', () => {
  G.hurtPlayer(999, 9999); G.respawn();
  eq(G.getPlayer().hp, 100);
  eq(G.getState(), 'playing');
  eq(G.getEnemies().length, 3);
});

// Checkpoint/Goal (51-53)
test('51 respawnPoint awal = spawn', () => { G.restart(); const r = G.getRespawnPoint(); eq(r.x, 80); eq(r.y, 300); });
test('52 progress 0..1 valid', () => {
  G.restart();
  const p0 = G.getProgress();
  ok(p0 >= 0 && p0 <= 0.2, 'progress awal harus ~0, got ' + p0);
  const pl = G.getPlayer(); const oldX = pl.x;
  pl.x = G.getGoal().x; // teleport ke goal
  const p1 = G.getProgress();
  ok(p1 > 0.9, 'progress di goal harus ~1, got ' + p1);
  pl.x = oldX; G.restart();
});
test('53 goalRect & checkpointRect ada', () => { srcHas('function goalRect'); srcHas('function checkpointRect'); });

// Render (54-55)
test('54 render scale 1..max, size konsisten', () => {
  const s = G.render.scale(), m = G.render.maxScale(), sz = G.render.size();
  ok(s >= 1 && s <= m, 'scale ' + s + ' di luar 1..' + m);
  eq(m, 2); eq(sz.w, Math.round(960 * s)); eq(sz.h, Math.round(540 * s));
});
test('55 pixel-art tajam (smoothing OFF + pixelated CSS)', () => {
  srcHas('imageSmoothingEnabled = false');
  ok(css.includes('image-rendering: pixelated') || css.includes('pixelated'), 'CSS pixelated hilang');
});

// Audio & aset (56-57)
test('56 AudioManager.play aman tanpa ctx', () => noThrow(() => { G.fx.audio.play('jump'); G.fx.audio.play('tidak-ada'); }));
test('57 18 PNG dimuat sekali via Promise.all', () => {
  eq(imageInstances.length, 18, 'Image instans harus 18, got ' + imageInstances.length);
  srcHas('Promise.all'); srcHas('assets/knight/idle_0.png'); srcHas('assets/knight/death_1.png');
});

// ---------- 8 TEST BARU TAHAP 4 ----------
test('58 pause/resume via setPaused (dunia diam, idempotent)', () => {
  G.setPaused(false); eq(G.isPaused(), false);
  G.setPaused(true); eq(G.isPaused(), true);
  G.setPaused(true); eq(G.isPaused(), true); // idempotent
  G.setPaused(false); eq(G.isPaused(), false);
  srcHas('drawPaused'); srcHas('AudioManager.suspend');
});
test('59 visibilitychange hidden->pause, visible->resume', () => {
  documentMock.hidden = true; G.handleVisibility(); eq(G.isPaused(), true);
  // event listener terdaftar
  ok((docListeners['visibilitychange'] || []).length >= 1, 'listener visibilitychange hilang');
  documentMock.hidden = false; G.handleVisibility(); eq(G.isPaused(), false);
  srcHas("document.addEventListener('visibilitychange'");
});
test('60 delta-time clamp: besar/invalid -> 1/60, normal lolos', () => {
  const e = 1 / 60;
  near(G.clampDt(0.016), 0.016, 1e-9, 'dt normal');
  eq(G.clampDt(0.1), e); eq(G.clampDt(5), e);
  eq(G.clampDt(0), e); eq(G.clampDt(-1), e); eq(G.clampDt(NaN), e);
  srcHas('clampDt'); srcHas('0.05');
});
test('61 DPR fallback: undefined/0/NaN/Infinity -> scale 1, 3 -> clamp 2', () => {
  const keep = windowMock.devicePixelRatio;
  const bad = [undefined, 0, -1, NaN, Infinity, 'buruk', null];
  bad.forEach((v) => {
    windowMock.devicePixelRatio = v;
    noThrow(() => G.render.rescan(), 'rescan DPR=' + String(v));
    eq(G.render.scale(), 1, 'DPR fallback=' + String(v));
  });
  windowMock.devicePixelRatio = 3;
  G.render.rescan(); eq(G.render.scale(), 2, 'DPR 3 harus clamp ke 2');
  windowMock.devicePixelRatio = 1;
  G.render.rescan(); eq(G.render.scale(), 1);
  windowMock.devicePixelRatio = keep; G.render.rescan();
  srcHas('RENDER_SCALE_MAX'); srcHas('devicePixelRatio');
});
test('62 touch+mouse tidak double-fire (guard 500ms)', () => {
  srcHas('lastTouch'); srcHas('500');
  const btn = elements['btn-attack'];
  ok((btn.listeners['touchstart'] || []).length >= 1, 'touchstart attack hilang');
  ok((btn.listeners['mousedown'] || []).length >= 1, 'mousedown attack hilang');
  G.restart(); G.input.attackPressed = false;
  btn.dispatch('touchstart', { cancelable: true, preventDefault() {} });
  eq(G.input.attackPressed, true, 'touchstart harus set attackPressed');
  G.input.attackPressed = false; // simulasi konsumsi frame
  btn.dispatch('mousedown', { cancelable: true, preventDefault() {} });
  eq(G.input.attackPressed, false, 'mousedown emulasi <500ms harus diabaikan (anti double)');
  // tombol gerak multi-touch independen
  const bl = elements['btn-left'], br = elements['btn-right'];
  G.input.left = false; G.input.right = false;
  bl.dispatch('touchstart', { cancelable: true, preventDefault() {} });
  br.dispatch('touchstart', { cancelable: true, preventDefault() {} });
  eq(G.input.left, true); eq(G.input.right, true);
  bl.dispatch('touchend', { cancelable: true, preventDefault() {} });
  eq(G.input.left, false); eq(G.input.right, true, 'multi-touch: lepas kiri jangan matikan kanan');
  br.dispatch('touchend', { cancelable: true, preventDefault() {} });
  eq(G.input.right, false);
  // cegah scroll: touch-action none + preventDefault
  ok(css.includes('touch-action: none') || css.includes('touch-action:none'), 'CSS touch-action none hilang');
});
test('63 restart setelah pause -> playing + unpaused', () => {
  G.restart(); G.setPaused(true); eq(G.isPaused(), true);
  noThrow(() => G.restart());
  eq(G.getState(), 'playing'); eq(G.isPaused(), false);
});
test('64 resume setelah Game Over (force + respawn)', () => {
  G.restart(); G.forceGameOver(); eq(G.getState(), 'gameover');
  G.setPaused(true);
  noThrow(() => G.respawn());
  eq(G.getState(), 'playing'); eq(G.isPaused(), false);
  eq(G.getPlayer().hp, 100);
  G.restart();
});
test('65 resume setelah Level Complete (force + restart)', () => {
  G.restart(); G.forceWin(); eq(G.getState(), 'win');
  G.setPaused(true);
  noThrow(() => G.restart());
  eq(G.getState(), 'playing'); eq(G.isPaused(), false);
  G.restart();
});

// ---------- 12 TEST BARU STAGE 5 ----------
test('66 menu state + PLAY -> transisi -> Level 1', () => {
  G.toMenu();
  eq(G.getState(), 'menu');
  ok(!elements['mainmenu'].classList.contains('hidden'), 'menu harus tampil');
  ok(elements['gameover'].classList.contains('hidden'), 'gameover harus sembunyi');
  elements['btn-play'].dispatch('click', {});
  ok(G.getTrans().active, 'transisi harus aktif setelah PLAY');
  G.stepTrans(0.3); G.stepTrans(0.3);
  eq(G.getState(), 'playing'); eq(G.getLevel(), 1);
  srcHas('mainmenu'); srcHas('btn-play');
});
test('67 level switching: Level 2 (varian + boss + shard)', () => {
  G.startLevel(2);
  eq(G.getLevel(), 2); eq(G.getState(), 'playing');
  eq(G.getEnemies().length, 3);
  const kinds = G.getEnemies().map((e) => e.kind);
  ok(kinds.includes('fast') && kinds.includes('heavy'), 'varian fast+heavy harus ada: ' + kinds);
  const b = G.getBoss();
  ok(b && b.hp === 120 && b.state === 'idle', 'boss RAJA SLIME hp120 idle');
  eq(G.getCheckpoints().length, 2);
  eq(G.getGoal(), null);
  eq(G.getShards().total, 8);
  G.startLevel(1); // kembalikan agar tidak pengaruhi sisanya
});
test('68 level reset: HP/posisi/musuh/boss/shard/stats pulih', () => {
  G.startLevel(2);
  G.hurtPlayer(30, 9999);
  ok(G.getPlayer().hp < 100, 'HP harus berkurang dulu');
  const at = G.getShards().at;
  const pl = G.getPlayer();
  pl.vx = 0; pl.vy = 0; // netralkan knockback agar posisi uji stabil
  pl.x = at.x - 20; pl.y = 402; // berdiri di tanah, overlap kotak shard
  G.step(1 / 60);
  eq(G.getShards().got, 1);
  G.startLevel(2);
  eq(G.getPlayer().hp, 100);
  eq(G.getShards().got, 0);
  eq(G.getEnemies().length, 3);
  eq(G.getBoss().hp, 120);
  const st = G.getStats();
  eq(st.levelKills, 0); eq(st.levelShards, 0);
  eq(G.getState(), 'playing');
});
test('69 enemy variant stats + slime klasik tak berubah', () => {
  srcHas('ENEMY_STATS');
  G.startLevel(2);
  const es = G.getEnemies();
  const fast = es.find((e) => e.kind === 'fast');
  const heavy = es.find((e) => e.kind === 'heavy');
  eq(fast.hp, 20); eq(fast.st.dmg, 8); ok(fast.st.chase > 95, 'fast harus lebih cepat');
  eq(heavy.hp, 60); eq(heavy.st.dmg, 18); eq(heavy.st.knockResist, 0.35);
  G.startLevel(1);
  const c = G.getEnemies()[0];
  eq(c.kind, 'slime'); eq(c.hp, 30); eq(c.w, 44); eq(c.h, 32);
});
test('70 collectible pickup: shard + counter + suara aman', () => {
  G.startLevel(1);
  eq(G.getShards().total, 6); eq(G.getShards().got, 0);
  const rs0 = G.getStats().runShards; // total run terbawa dari test sebelum
  const at = G.getShards().at;
  const pl = G.getPlayer();
  pl.x = at.x - 20; pl.y = at.y; // overlap kotak shard walau ada gravitasi
  G.step(1 / 60);
  eq(G.getShards().got, 1);
  eq(G.getStats().levelShards, 1); eq(G.getStats().runShards, rs0 + 1);
  noThrow(() => G.fx.audio.play('pickup'));
});
test('71 boss state transitions: idle -> telegraph -> attack', () => {
  G.startLevel(2);
  const b = G.getBoss(), pl = G.getPlayer();
  pl.iframes = 9999; // uji FSM, bukan damage player
  pl.x = b.x - 150; pl.y = 402;
  const seen = {};
  for (let i = 0; i < 150; i++) { G.step(1 / 60); seen[G.getBoss().state] = true; }
  ok(seen.telegraph, 'boss harus pernah telegraph, terlihat: ' + Object.keys(seen));
  ok(seen.strike || seen.charge || seen.shock || seen.recovery, 'boss harus menyerang, terlihat: ' + Object.keys(seen));
  pl.iframes = 0;
});
test('72 boss death -> GAME COMPLETE + stats', () => {
  G.startLevel(2);
  for (let k = 0; k < 4; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  eq(G.getBoss().state, 'death');
  for (let i = 0; i < 170; i++) G.step(1 / 60);
  eq(G.getState(), 'gamecomplete');
  ok(G.getStats().runKills >= 1, 'kill boss terhitung');
  ok(!elements['gameclear'].classList.contains('hidden'), 'layar game complete tampil');
});
test('73 level complete: goal L1 -> stats + NEXT/REPLAY/MENU', () => {
  G.startLevel(1);
  const pl = G.getPlayer();
  pl.x = 2290; pl.y = 400; // dalam gapura FINISH
  G.step(1 / 60);
  eq(G.getState(), 'levelcomplete');
  ok(!elements['lvlclear'].classList.contains('hidden'), 'layar level complete tampil');
  G.startLevel(1);
});
test('74 NEXT LEVEL: lvlclear -> transisi -> Level 2 main', () => {
  G.startLevel(1);
  const pl = G.getPlayer();
  pl.x = 2290; pl.y = 400;
  G.step(1 / 60);
  eq(G.getState(), 'levelcomplete');
  elements['btn-next'].dispatch('click', {});
  ok(G.getTrans().active, 'transisi ke L2 aktif');
  G.stepTrans(0.3); G.stepTrans(0.3);
  eq(G.getState(), 'playing'); eq(G.getLevel(), 2);
});
test('75 stats: total lintas level, per-level reset', () => {
  G.restart(); // total fresh, Level 1
  const e0 = G.getEnemies()[0];
  for (let k = 0; k < 3; k++) { G.getEnemies()[0].iframes = 0; G.hurtEnemy(e0.id, 12, 0); }
  for (let i = 0; i < 40; i++) G.step(1 / 60);
  eq(G.getStats().runKills, 1);
  G.startLevel(2);
  eq(G.getStats().levelKills, 0, 'levelStats reset di level baru');
  eq(G.getStats().runKills, 1, 'total kill terbawa lintas level');
});
test('76 transition state: out -> load -> in -> playing', () => {
  G.startLevel(1);
  G.startTrans(2);
  let tr = G.getTrans();
  eq(tr.active, true); eq(tr.phase, 'out');
  G.stepTrans(0.1);
  eq(G.getTrans().active, true);
  G.stepTrans(0.3); // out selesai -> load L2
  eq(G.getLevel(), 2);
  G.stepTrans(0.3); // in selesai
  tr = G.getTrans();
  eq(tr.active, false);
  eq(G.getState(), 'playing');
});
test('77 input isolation: menu tidak bocorkan input ke gameplay', () => {
  G.toMenu();
  G.input.attackPressed = true; G.input.jumpPressed = true;
  G.input.jumpHeld = true; G.input.left = true;
  G.startLevel(1);
  eq(G.input.attackPressed, false); eq(G.input.jumpPressed, false);
  eq(G.input.jumpHeld, false); eq(G.input.left, false);
  eq(G.getPlayer().state, 'idle');
  G.restart(); // kembalikan kondisi standar
});

// ---------- Ringkasan ----------
console.log('\n==== RINGKASAN ====');
console.log('PASS: ' + pass + ' / ' + (pass + fail) + ', FAIL: ' + fail);
if (failures.length) { console.log('Failures:'); failures.forEach((f) => console.log(' - ' + f)); }
setTimeout(() => { // beri waktu Image async selesai agar 0 unhandled rejection
  if (fail > 0) process.exit(1);
}, 50);
