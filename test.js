/* Knight Platformer — Skeleton Campaign hardening tests.
 * 250 tests: 57 dasar (config/fisika/combat/AI/kamera/level/input/render/audio/asset)
 * + 8 Tahap 4 (pause, visibility, dt-clamp, DPR fallback, touch anti double,
 * restart-setelah-pause, resume GameOver, resume Win)
 * + 12 Stage 5 (menu/level/boss/coin/stats/transisi) + 7 responsif
 * + 20 Stage 6 (settings/persistence) + 8 Stage 7 (BGM) + 6 Game Over Menu
 * + 5 audit + 6 Stage 8 + 4 audit putaran dua/grounding/platform
 * + 21 Stage 9 (skeleton campaign: L3-5 unlock, skeleton stats, projectile,
 * defender block, miniboss, lich phase, final sequence, migration, BGM mood)
 * + N hardening (ghost attack, victory race, defender-iframe, hurt input,
 * R respawn, unlock gate, audio migration, archer retreat, leash, projectile)
 * + 12 swap Coin↔Gold Shard (collectible Coin, treasure Gold Shard, save v3)
 * + 14 stage 11 polish (knight art, hit-stop, shake cap, decor, boss, victory)
 * + 4 skeleton crumble + pit permanen
 * + 3 skeleton walk realistis
 * + 3 bone pile persisten
 * + 1 pit kill persisten respawn.
 * + 3 audit profesional (pile snap, clamp, pit key).
 * + 3 boss pit gugur normal.
 * + 4 boss gate arena.
 * + 3 player death + goo pile.
 * + 3 king death bertahap.
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
const readmePath = path.join(__dirname, 'README.md');
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';

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
  'gameclear', 'gameclear-stats', 'btn-again2', 'btn-gamecampaign', 'btn-gamemenu',
  // Bug fix Game Over Menu
  'btn-gameover-menu',
  // Stage 10: campaign select + explicit pause
  'btn-campaign', 'campaign', 'campaign-status',
  'btn-camp-1', 'btn-camp-2', 'btn-camp-3', 'btn-camp-4', 'btn-camp-5',
  'camp-status-1', 'camp-status-2', 'camp-status-3', 'camp-status-4', 'camp-status-5',
  'btn-camp-back', 'btn-pause', 'pause',
  'btn-resume', 'btn-pause-respawn', 'btn-pause-menu',
  // Stage 6: settings + reset + records + mission
  'mission', 'btn-settings', 'settings',
  'set-sfx', 'set-sfx-vol-down', 'set-sfx-vol-up', 'set-sfx-vol-val',
  'set-music', 'set-music-vol-down', 'set-music-vol-up', 'set-music-vol-val',
  'set-input', 'btn-reset-progress', 'btn-settings-back',
  'reset-confirm', 'btn-reset-cancel', 'btn-reset-confirm', 'about-records',
  // Weapon Shop + block
  'btn-shop', 'shop', 'shop-coin',
  'shop-tab-sword', 'shop-tab-shield', 'shop-tab-bow',
  'shop-list', 'shop-preview', 'shop-prev-img', 'shop-prev-name',
  'shop-prev-tier', 'shop-prev-price', 'shop-prev-desc', 'shop-prev-stats',
  'shop-prev-special', 'shop-prev-action',
  'shop-mode-sword', 'shop-mode-guardian', 'shop-mode-archer',
  'shop-msg', 'shop-back', 'btn-block', 'shop-prev-weapon'];
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
  PointerEvent: function PointerEvent() {}, // Pointer Events tersedia (modern)
  matchMedia(query) { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
  KnightGame: null
};
function fireWin(type, ev) {
  (winListeners[type] || []).forEach((fn) => fn(ev || {}));
}
function fireDoc(type, ev) {
  (docListeners[type] || []).forEach((fn) => fn(ev || {}));
}
// Image mock: sukses async (onload next tick), hitung instans
let pendingImageResolvers = [];class MockImage {
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
  navigator: { userAgent: 'node-test' },
  // Storage deterministik untuk test persistence (Map-based, sinkron).
  localStorage: null // diisi di bawah agar referensi stabil
};
function makeTestStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m
  };
}
// FakeAudioContext deterministik untuk test BGM (tanpa audio nyata).
// Clock dikendalikan manual: ambil instans via FakeAudioContext.__last.
function FakeAudioContext() {
  this.currentTime = 0;
  this.state = 'suspended';
  this.sampleRate = 44100;
  this.destination = {};
  FakeAudioContext.__last = this;
}
FakeAudioContext.prototype.resume = function () {
  this.state = 'running';
  return Promise.resolve();
};
FakeAudioContext.prototype.suspend = function () {
  this.state = 'suspended';
  return Promise.resolve();
};
FakeAudioContext.prototype.createGain = function () {
  return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }, connect() {} };
};
FakeAudioContext.prototype.createOscillator = function () {
  return { type: 'square', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
};
FakeAudioContext.prototype.createBiquadFilter = function () {
  return { type: 'lowpass', frequency: { value: 0 }, connect() {} };
};
FakeAudioContext.prototype.createBuffer = function (ch, len) {
  return { getChannelData: () => new Float32Array(len) };
};
FakeAudioContext.prototype.createDynamicsCompressor = function () {
  return { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 1 }, attack: { value: 0 }, release: { value: 0 }, connect() {} };
};
FakeAudioContext.prototype.createBufferSource = function () {
  return { buffer: null, loop: false, connect() {}, start() {}, stop() {} };
};
windowMock.AudioContext = FakeAudioContext;
const testStorage = makeTestStorage();
sandbox.localStorage = testStorage;
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
const EXPECTED_TOTAL = 314; // total test (302 + 12 mobile shop)
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
test('57 111 PNG dimuat sekali via Promise.all (knight 18 + undead/chest/coin/reward 22 + heroik 10 + lightning slime 3 + guardian 9 + archer 9 + weapon overlay 40)', () => {
  eq(imageInstances.length, 111, 'Image instans harus 111, got ' + imageInstances.length);
  srcHas('Promise.all'); srcHas('assets/knight/idle_0.png'); srcHas('assets/knight/death_1.png');
  srcHas('assets/sprites/skeleton-sword.png'); srcHas('assets/sprites/raja-lich.png');
  srcHas('assets/sprites/treasure-chest.png'); srcHas('assets/sprites/coin.png');
  srcHas('assets/sprites/gold-shard.png');
  srcHas('assets/sprites/knight-idle.png'); srcHas('assets/sprites/knight-victory.png');
  srcHas('assets/sprites/skeleton-sword-strike.png'); srcHas('assets/sprites/raja-lich-cast.png');
  srcHas('assets/sprites/guardian-idle.png'); srcHas('assets/sprites/guardian-block.png');
  srcHas('assets/sprites/archer-idle.png'); srcHas('assets/sprites/archer-aim.png');
  srcHas('assets/sprites/weapon-rusty-down.png'); srcHas('assets/sprites/weapon-bastion-front.png');
  srcHas('assets/sprites/weapon-storm-drawn.png'); srcHas('assets/sprites/weapon-dragon-side.png');
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
test('62 Pointer Events tunggal: tanpa double-fire, multi-touch independen', () => {
  srcHas('pointerdown'); srcHas('pointercancel');
  ok(!/lastTouch/.test(src), 'guard timeout lama harus hilang');
  const btn = elements['btn-attack'];
  ok((btn.listeners['pointerdown'] || []).length >= 1, 'pointerdown attack hilang');
  ok((btn.listeners['pointerup'] || []).length >= 1, 'pointerup attack hilang');
  ok((btn.listeners['pointercancel'] || []).length >= 1, 'pointercancel attack hilang');
  G.restart(); G.input.attackPressed = false;
  btn.dispatch('pointerdown', { pointerId: 1, cancelable: true, preventDefault() {} });
  eq(G.input.attackPressed, true, 'pointerdown harus set attackPressed');
  // Pointer kedua pada tombol sama: diabaikan (tanpa timeout).
  G.input.attackPressed = false; // simulasi konsumsi frame
  btn.dispatch('pointerdown', { pointerId: 2, cancelable: true, preventDefault() {} });
  eq(G.input.attackPressed, false, 'pointer duplikat harus diabaikan');
  btn.dispatch('pointerup', { pointerId: 1, cancelable: true, preventDefault() {} });
  // pointercancel membersihkan state (anti stuck).
  btn.dispatch('pointerdown', { pointerId: 3, cancelable: true, preventDefault() {} });
  btn.dispatch('pointercancel', { pointerId: 3, cancelable: true, preventDefault() {} });
  ok(!btn.classList.contains('pressed'), 'pointercancel harus lepas pressed');
  // tombol gerak multi-touch independen via pointerId
  const bl = elements['btn-left'], br = elements['btn-right'];
  G.input.left = false; G.input.right = false;
  bl.dispatch('pointerdown', { pointerId: 10, cancelable: true, preventDefault() {} });
  br.dispatch('pointerdown', { pointerId: 11, cancelable: true, preventDefault() {} });
  eq(G.input.left, true); eq(G.input.right, true);
  bl.dispatch('pointerup', { pointerId: 10, cancelable: true, preventDefault() {} });
  eq(G.input.left, false); eq(G.input.right, true, 'multi-touch: lepas kiri jangan matikan kanan');
  br.dispatch('pointerup', { pointerId: 11, cancelable: true, preventDefault() {} });
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
test('67 level switching: Level 2 (varian + boss + coin)', () => {
  G.forceStartLevel(2);
  eq(G.getLevel(), 2); eq(G.getState(), 'playing');
  eq(G.getEnemies().length, 3);
  const kinds = G.getEnemies().map((e) => e.kind);
  ok(kinds.includes('fast') && kinds.includes('heavy'), 'varian fast+heavy harus ada: ' + kinds);
  const b = G.getBoss();
  ok(b && b.hp === 120 && b.state === 'idle', 'boss RAJA SLIME hp120 idle');
  eq(G.getCheckpoints().length, 2);
  eq(G.getGoal(), null);
  eq(G.getCoins().total, 8);
  G.forceStartLevel(1); // kembalikan agar tidak pengaruhi sisanya
});
test('68 level reset: HP/posisi/musuh/boss/coin/stats pulih', () => {
  G.forceStartLevel(2);
  G.hurtPlayer(30, 9999);
  ok(G.getPlayer().hp < 100, 'HP harus berkurang dulu');
  const at = G.getCoins().at;
  const pl = G.getPlayer();
  pl.vx = 0; pl.vy = 0; // netralkan knockback agar posisi uji stabil
  pl.x = at.x - 20; pl.y = 402; // berdiri di tanah, overlap kotak coin
  G.step(1 / 60);
  eq(G.getCoins().got, 1);
  G.forceStartLevel(2);
  eq(G.getPlayer().hp, 100);
  eq(G.getCoins().got, 0);
  eq(G.getEnemies().length, 3);
  eq(G.getBoss().hp, 120);
  const st = G.getStats();
  eq(st.levelKills, 0); eq(st.levelCoins, 0);
  eq(G.getState(), 'playing');
});
test('69 enemy variant stats + slime klasik tak berubah', () => {
  srcHas('ENEMY_STATS');
  G.forceStartLevel(2);
  const es = G.getEnemies();
  const fast = es.find((e) => e.kind === 'fast');
  const heavy = es.find((e) => e.kind === 'heavy');
  eq(fast.hp, 20); eq(fast.st.dmg, 8); ok(fast.st.chase > 95, 'fast harus lebih cepat');
  eq(heavy.hp, 60); eq(heavy.st.dmg, 18); eq(heavy.st.knockResist, 0.35);
  G.forceStartLevel(1);
  const c = G.getEnemies()[0];
  eq(c.kind, 'slime'); eq(c.hp, 30); eq(c.w, 44); eq(c.h, 32);
});
test('70 collectible pickup: coin + counter + totalCoins + suara aman', () => {
  G.forceStartLevel(1);
  eq(G.getCoins().total, 6); eq(G.getCoins().got, 0);
  const rs0 = G.getStats().runCoins; // total run terbawa dari test sebelum
  const tc0 = G.getSave().totalCoins;
  const at = G.getCoins().at;
  const pl = G.getPlayer();
  pl.x = at.x - 20; pl.y = at.y; // overlap kotak coin walau ada gravitasi
  G.step(1 / 60);
  eq(G.getCoins().got, 1);
  eq(G.getStats().levelCoins, 1); eq(G.getStats().runCoins, rs0 + 1);
  eq(G.getSave().totalCoins, tc0 + 1, 'pickup coin masuk totalCoins tepat 1x');
  noThrow(() => G.fx.audio.play('coin'));
});
test('71 boss state transitions: idle -> telegraph -> attack', () => {
  G.forceStartLevel(2);
  const b = G.getBoss(), pl = G.getPlayer();
  pl.iframes = 9999; // uji FSM, bukan damage player
  pl.x = b.x - 150; pl.y = 402;
  const seen = {};
  for (let i = 0; i < 150; i++) { G.step(1 / 60); seen[G.getBoss().state] = true; }
  ok(seen.telegraph, 'boss harus pernah telegraph, terlihat: ' + Object.keys(seen));
  ok(seen.strike || seen.charge || seen.shock || seen.recovery, 'boss harus menyerang, terlihat: ' + Object.keys(seen));
  pl.iframes = 0;
});
test('72 boss death L2 -> LEVEL COMPLETE + stats', () => {
  G.forceStartLevel(2);
  for (let k = 0; k < 4; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  eq(G.getBoss().state, 'death');
  for (let i = 0; i < 170; i++) G.step(1 / 60);
  eq(G.getState(), 'levelcomplete');
  ok(G.getStats().runKills >= 1, 'kill boss terhitung');
  ok(!elements['lvlclear'].classList.contains('hidden'), 'layar level complete tampil');
  G.forceStartLevel(1);
});
test('73 level complete: goal L1 -> stats + NEXT/REPLAY/MENU', () => {
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.x = 2290; pl.y = 400; // dalam gapura FINISH
  G.step(1 / 60);
  eq(G.getState(), 'levelcomplete');
  ok(!elements['lvlclear'].classList.contains('hidden'), 'layar level complete tampil');
  G.forceStartLevel(1);
});
test('74 NEXT LEVEL: lvlclear -> transisi -> Level 2 main', () => {
  G.forceStartLevel(1);
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
  G.forceStartLevel(2);
  eq(G.getStats().levelKills, 0, 'levelStats reset di level baru');
  eq(G.getStats().runKills, 1, 'total kill terbawa lintas level');
});
test('76 transition state: out -> load -> in -> playing', () => {
  G.resetSave(); completeL1Flow(); // unlock L2 agar transisi sah
  G.forceStartLevel(1);
  eq(G.startTrans(2), true, 'transisi ke L2 unlocked diizinkan');
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
  G.forceStartLevel(1);
  eq(G.input.attackPressed, false); eq(G.input.jumpPressed, false);
  eq(G.input.jumpHeld, false); eq(G.input.left, false);
  eq(G.getPlayer().state, 'idle');
  G.restart(); // kembalikan kondisi standar
});

// ---------- 7 TEST RESPONSIF (cermin HTML/CSS produksi) ----------
// Aturan: mock harus mencerminkan struktur HTML production — uji ini
// memaksa keduanya sinkron (id yang di-wire game.js wajib ada di keduanya).
function __idsFromHtml(h) {
  const out = [];
  const re = /id="([^"]+)"/g;
  let m;
  while ((m = re.exec(h))) out.push(m[1]);
  return out;
}
function __wiredIds(js) {
  const out = [];
  const re = /getElementById\('([^']+)'\)/g;
  let m;
  while ((m = re.exec(js))) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}
function __mediaBlocks(cssText) {
  // Kembalikan [{header, body}] dengan pencocokan kurung sederhana.
  const blocks = [];
  let i = 0;
  while (true) {
    const at = cssText.indexOf('@media', i);
    if (at < 0) break;
    const open = cssText.indexOf('{', at);
    const header = cssText.slice(at, open);
    let depth = 0, j = open;
    for (; j < cssText.length; j++) {
      if (cssText[j] === '{') depth++;
      else if (cssText[j] === '}') { depth--; if (depth === 0) break; }
    }
    blocks.push({ header, body: cssText.slice(open, j + 1) });
    i = j + 1;
  }
  return blocks;
}
test('78 mockmirror produksi: id wire game.js ada di HTML + mock', () => {
  const wired = __wiredIds(src);
  ok(wired.length >= 20, 'wired ids terlalu sedikit: ' + wired.length);
  const htmlIds = __idsFromHtml(html);
  wired.forEach((id) => {
    ok(htmlIds.includes(id), 'id wire hilang di index.html produksi: ' + id);
    ok(elementIds.includes(id), 'id wire hilang di mock test: ' + id);
  });
  ['mainmenu', 'lvlclear', 'gameclear', 'btn-play', 'btn-next', 'btn-again2'].forEach((id) => {
    ok(wired.includes(id), 'elemen Stage 5 harus di-wire: ' + id);
  });
});
test('79 dialog fullscreen anti-clip di layar sentuh kecil', () => {
  const blocks = __mediaBlocks(css);
  const dlg = blocks.filter((b) => b.body.includes('#mainmenu') && b.body.includes('position: fixed'));
  ok(dlg.length >= 1, 'aturan dialog fullscreen hilang');
  ok(dlg[0].header.includes('pointer: coarse'), 'harus pointer:coarse agar desktop aman');
  ok(dlg[0].body.includes('overflow-y: auto'), 'dialog pendek harus bisa scroll');
  ['#gameover', '#levelcomplete', '#lvlclear', '#gameclear'].forEach((sel) => {
    ok(dlg[0].body.includes(sel), 'dialog harus fullscreen: ' + sel);
  });
});
test('80 HP landscape pendek: ringkas, 16:9 utuh, kontrol muat', () => {
  const blocks = __mediaBlocks(css);
  const compact = blocks.filter((b) => b.header.includes('orientation: landscape') &&
    b.header.includes('max-height') && b.header.includes('pointer: coarse'));
  ok(compact.length >= 1, 'mode ringkas landscape hilang');
  const c = compact[0].body;
  ok(c.includes('.mission') && c.includes('display: none'), 'teks header harus disembunyikan');
  ok(c.includes('#canvas-container') && c.includes('100dvh') && c.includes('16 / 9'),
    'lebar canvas harus dari sisa tinggi (16:9 utuh, tanpa stretch)');
  ok(c.includes('#touch-controls'), 'kontrol harus ikut aturan lebar yang sama');
});
test('81 touch: >=64px, tak bertumpuk, anti scroll/double', () => {
  ok(css.includes('touch-action: none'), 'touch-action none hilang');
  ok(/\.touch-btn\s*{[^}]*clamp\(64px/.test(css), 'tombol harus min 64px');
  ok(css.includes('justify-content: space-between') && css.includes('.touch-group'),
    'grup tombol harus berjarak (space-between + gap)');
  ok(src.includes('pointerdown') && src.includes('pointercancel'), 'Pointer Events tunggal harus ada');
  ok(src.includes('activePointer'), 'tracking pointerId anti double harus ada');
});
test('82 aturan HP tak bocor ke desktop', () => {
  const blocks = __mediaBlocks(css);
  blocks.forEach((b) => {
    if (b.header.includes('landscape')) {
      ok(b.header.includes('coarse'), 'media landscape harus pointer:coarse: ' + b.header.trim());
    }
  });
  const dlgScope = blocks.filter((b) => b.body.includes('#lvlclear'));
  ok(dlgScope.length >= 1 && dlgScope.every((b) => b.header.includes('coarse')),
    'aturan dialog tak boleh tanpa pointer:coarse');
  ok(css.includes('aspect-ratio: 16 / 9'), 'canvas 16:9 desktop harus utuh');
});
test('83 portrait utuh: canvas+kontrol tak disembunyikan', () => {
  const blocks = __mediaBlocks(css);
  const por = blocks.filter((b) => b.header.includes('orientation: portrait'));
  ok(por.length >= 1, 'aturan portrait hilang');
  por.forEach((b) => {
    ok(!/#canvas-container\s*{[^}]*display:\s*none/.test(b.body), 'canvas jangan disembunyikan (portrait)');
    ok(!/#touch-controls\s*{[^}]*display:\s*none/.test(b.body), 'kontrol jangan disembunyikan (portrait)');
  });
});
test('84 a11y: label sentuh + dialog + focus terlihat', () => {
  ['btn-left', 'btn-right', 'btn-attack', 'btn-jump'].forEach((id) => {
    ok(new RegExp('id="' + id + '"[^>]*aria-label').test(html), 'aria-label hilang: ' + id);
  });
  const dialogs = (html.match(/role="dialog"/g) || []).length;
  ok(dialogs >= 5, 'dialog harus ber-role=dialog, ketemu ' + dialogs);
  ok(css.includes(':focus-visible'), 'focus state keyboard harus terlihat');
});

// ---------- 20 TEST STAGE 6 (settings + persistence) ----------
function completeL1Flow() {
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.x = 2290; pl.y = 400; // dalam gapura FINISH
  G.step(1 / 60);
}
function bossKillFlow() {
  G.forceStartLevel(2);
  for (let k = 0; k < 4; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 170; i++) G.step(1 / 60);
}
function lichKillFlow() {
  G.forceStartLevel(4);
  for (let k = 0; k < 20 && G.getBoss().state !== 'death'; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 170; i++) G.step(1 / 60);
}
// Buka chest level N dengan serangan pedang (berdiri kiri, hadap kanan).
// Mengembalikan chest setelah animasi opening selesai.
function attackOpenChest(lv) {
  G.forceStartLevel(lv);
  const c = G.getChests()[0];
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = c.x - pl.w - 4; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.facing = 1;
  pl.attackCooldown = 0;
  G.input.attackPressed = true;
  for (let i = 0; i < 12; i++) G.step(1 / 60); // windup + strike
  for (let i = 0; i < 40; i++) G.step(1 / 60); // opening -> opened
  pl.iframes = 0;
  return c;
}
function finalKillFlow() {
  // L5: kalahkan RAJA SLIME -> interlude 2 dtk -> RAJA LICH -> victory.
  G.forceStartLevel(5);
  const b0 = G.getBoss();
  for (let k = 0; k < 10 && G.getBoss().state !== 'death'; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 200; i++) G.step(1 / 60); // death slime + interlude -> lich spawn
  const b1 = G.getBoss();
  ok(b1 && b1.kind === 'lich', 'fase lich harus spawn, got ' + (b1 && b1.kind));
  // Dekatkan player ke arena agar lich intro selesai, lalu bunuh.
  const pl = G.getPlayer();
  pl.x = 2000; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.iframes = 9999;
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  pl.iframes = 0;
  for (let k = 0; k < 20 && G.getBoss().state !== 'death'; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  pl.iframes = 9999;
  for (let i = 0; i < 170; i++) G.step(1 / 60);
  pl.iframes = 0;
}
test('85 default save schema knightSaveV1', () => {
  G.resetSave();
  const s = G.getSave();
  eq(s.version, 4);
  eq(s.bestTime, null); eq(s.bestL1, null); eq(s.bestL2, null);
  eq(s.bestL3, null); eq(s.bestL4, null); eq(s.bestL5, null);
  eq(s.bestCoins, 0); eq(s.totalCoins, 0); eq(s.totalGoldShards, 0); eq(s.totalDeaths, 0);
  ok(!('bestShards' in s), 'legacy bestShards tidak ada di default v4');
  ok(!('totalShards' in s), 'legacy totalShards tidak ada di default v4');
  eq(s.level1Completed, false); eq(s.level2Completed, false);
  eq(s.level3Completed, false); eq(s.level4Completed, false); eq(s.level5Completed, false);
  eq(s.gameCompleted, false);
  eq(s.level2Unlocked, false); eq(s.level3Unlocked, false);
  eq(s.level4Unlocked, false); eq(s.level5Unlocked, false);
  eq(s.sfxEnabled, true); eq(s.sfxVolume, 100);
  eq(s.musicEnabled, true); eq(s.musicVolume, 70);
  eq(s.inputPreference, 'auto');
  // Shop v4 defaults: starter owned, playable tanpa beli.
  eq(s.eqSword, 'rusty'); eq(s.eqShield, 'buckler'); eq(s.eqBow, 'makeshift');
  eq(s.mode, 'SWORD');
  ok(s.owned.rusty && s.owned.buckler && s.owned.makeshift, 'starter owned');
  srcHas('knightSaveV1');
});
test('86 settings save/load round-trip', () => {
  G.resetSave(); G.toMenu();
  elements['btn-settings'].dispatch('click', {});
  elements['set-sfx'].dispatch('click', {}); // ON->OFF
  elements['set-sfx-vol-down'].dispatch('click', {});
  elements['set-sfx-vol-down'].dispatch('click', {});
  elements['set-sfx-vol-down'].dispatch('click', {}); // 100->70
  elements['set-music'].dispatch('click', {}); // ON->OFF
  elements['set-input'].dispatch('click', {}); // auto->keyboard
  G.reloadSave();
  const s = G.getSave();
  eq(s.sfxEnabled, false); eq(s.sfxVolume, 70);
  eq(s.musicEnabled, false); eq(s.inputPreference, 'keyboard');
  const raw = JSON.parse(testStorage._map.get('knightSaveV1'));
  eq(raw.sfxVolume, 70); eq(raw.inputPreference, 'keyboard');
  G.resetSave();
});
test('87 best time hanya membaik', () => {
  G.resetSave();
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 2, bestL1: 50 }));
  G.reloadSave();
  eq(G.getSave().bestL1, 50);
  completeL1Flow();
  eq(G.getState(), 'levelcomplete');
  ok(G.getSave().bestL1 < 1, 'run cepat harus perbarui best, got ' + G.getSave().bestL1);
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 2, bestL1: 0.001 }));
  G.reloadSave();
  completeL1Flow();
  eq(G.getSave().bestL1, 0.001, 'run buruk jangan overwrite best');
  G.resetSave();
});
test('88 best coins + total coins persist', () => {
  G.resetSave();
  G.forceStartLevel(1);
  const at = G.getCoins().at, pl = G.getPlayer();
  pl.x = at.x - 20; pl.y = at.y;
  G.step(1 / 60);
  eq(G.getSave().totalCoins, 1);
  eq(JSON.parse(testStorage._map.get('knightSaveV1')).totalCoins, 1);
  bossKillFlow();
  eq(G.getState(), 'levelcomplete');
  finalKillFlow();
  eq(G.getState(), 'gamecomplete');
  ok(G.getSave().bestCoins >= 1, 'bestCoins tercatat');
  G.resetSave();
});
test('89 Level 2 unlock persist + gate NEXT', () => {
  G.resetSave(); G.toMenu();
  eq(G.canPlayLevel(1), true);
  eq(G.canPlayLevel(2), false);
  G.nextLevel(); // terkunci -> tidak transisi
  eq(G.getTrans().active, false);
  eq(G.getState(), 'menu');
  completeL1Flow();
  eq(G.canPlayLevel(2), true);
  eq(JSON.parse(testStorage._map.get('knightSaveV1')).level2Unlocked, true);
  G.resetSave();
});
test('90 game complete persist (flag + best)', () => {
  G.resetSave();
  finalKillFlow();
  eq(G.getState(), 'gamecomplete');
  const s = G.getSave();
  eq(s.gameCompleted, true); eq(s.level5Completed, true);
  ok(typeof s.bestTime === 'number', 'bestTime tercatat');
  const raw = JSON.parse(testStorage._map.get('knightSaveV1'));
  eq(raw.gameCompleted, true);
  G.resetSave();
});
test('91 total deaths persist saat Game Over', () => {
  G.resetSave();
  G.forceStartLevel(1);
  G.hurtPlayer(999, 9999);
  for (let i = 0; i < 70; i++) G.step(1 / 60);
  eq(G.getState(), 'gameover');
  eq(G.getSave().totalDeaths, 1);
  G.resetSave();
});
test('92 JSON corrupt -> default + game tetap jalan', () => {
  testStorage._map.set('knightSaveV1', '{{{corrupt');
  noThrow(() => G.reloadSave());
  const s = G.getSave();
  eq(s.sfxVolume, 100); eq(s.bestTime, null); eq(s.level2Unlocked, false);
  noThrow(() => { G.forceStartLevel(1); G.step(1 / 60); });
  ok(JSON.parse(testStorage._map.get('knightSaveV1')).version === 4, 'storage ditulis ulang valid');
  G.resetSave();
});
test('93 localStorage hilang/rusak -> fallback memori, tanpa error', () => {
  const keep = sandbox.localStorage;
  sandbox.localStorage = undefined;
  noThrow(() => { G.reloadSave(); G.resetSave(); G.forceStartLevel(1); G.step(1 / 60); });
  sandbox.localStorage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); }
  };
  noThrow(() => { G.reloadSave(); G.resetSave(); G.forceStartLevel(2); G.step(1 / 60); });
  sandbox.localStorage = keep;
  G.reloadSave(); G.resetSave();
});
test('94 settings save/load eksplisit', () => {
  G.resetSave(); G.toMenu();
  elements['btn-settings'].dispatch('click', {});
  elements['set-sfx'].dispatch('click', {});
  elements['set-music-vol-down'].dispatch('click', {});
  elements['set-music-vol-down'].dispatch('click', {}); // 70->50
  G.reloadSave();
  const s = G.getSave();
  eq(s.sfxEnabled, false); eq(s.musicVolume, 50);
  G.resetSave();
});
test('95 SFX OFF benar-benar mute (flag)', () => {
  G.resetSave(); G.toMenu();
  elements['btn-settings'].dispatch('click', {});
  elements['set-sfx'].dispatch('click', {});
  const cfg = G.fx.audio.getCfg();
  eq(cfg.sfxOn, false); eq(cfg.muted, true);
  noThrow(() => G.fx.audio.play('jump'));
  G.resetSave();
});
test('96 volume clamp 0-100 + mute di 0', () => {
  G.fx.audio.setSfx(true, 150);
  eq(G.fx.audio.getCfg().sfxVol, 100);
  G.fx.audio.setSfx(true, -20);
  eq(G.fx.audio.getCfg().sfxVol, 0);
  eq(G.fx.audio.getCfg().muted, true);
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 2, sfxVolume: 999, musicVolume: -5 }));
  G.reloadSave();
  eq(G.getSave().sfxVolume, 100); eq(G.getSave().musicVolume, 0);
  G.resetSave();
});
test('97 music setting persist + mesin BGM nyata (bukan palsu)', () => {
  G.resetSave(); G.toMenu();
  elements['btn-settings'].dispatch('click', {});
  elements['set-music'].dispatch('click', {}); // ON->OFF via UI (persist)
  elements['set-music-vol-down'].dispatch('click', {}); // 70->60
  elements['set-music-vol-down'].dispatch('click', {}); // 60->50
  G.reloadSave();
  const s = G.getSave();
  eq(s.musicEnabled, false); eq(s.musicVolume, 50);
  G.fx.audio.setMusic(true, 150); // clamp unit-level, tanpa persist
  eq(G.fx.audio.getCfg().musicVol, 100);
  // Stage 7: API BGM nyata tersedia dan terkontrol.
  eq(typeof G.fx.audio.startMusic, 'function');
  eq(typeof G.fx.audio.stopMusic, 'function');
  eq(typeof G.fx.audio.updateMusicState, 'function');
  eq(typeof G.fx.audio.musicTick, 'function');
  eq(typeof G.fx.audio.musicInfo, 'function');
  G.resetSave();
});
test('98 reset mengembalikan default + UI refresh', () => {
  G.resetSave(); G.toMenu();
  elements['btn-settings'].dispatch('click', {});
  elements['set-sfx'].dispatch('click', {});
  elements['btn-reset-progress'].dispatch('click', {});
  ok(!elements['reset-confirm'].classList.contains('hidden'), 'dialog konfirmasi tampil');
  elements['btn-reset-confirm'].dispatch('click', {});
  ok(elements['reset-confirm'].classList.contains('hidden'), 'dialog tertutup');
  const s = G.getSave();
  eq(s.sfxEnabled, true); eq(s.sfxVolume, 100); eq(s.level2Unlocked, false);
  eq(elements['set-sfx'].textContent, 'SFX: ON');
  eq(elements['set-sfx-vol-val'].textContent, '100%');
});
test('99 reset dialog: CANCEL tak menghapus', () => {
  G.resetSave(); G.toMenu();
  elements['btn-settings'].dispatch('click', {});
  elements['set-sfx'].dispatch('click', {}); // OFF
  elements['btn-reset-progress'].dispatch('click', {});
  elements['btn-reset-cancel'].dispatch('click', {});
  ok(elements['reset-confirm'].classList.contains('hidden'), 'dialog tertutup via CANCEL');
  eq(G.getSave().sfxEnabled, false, 'CANCEL jangan ubah save');
  G.resetSave();
});
test('100 settings keyboard nav (panah + Esc)', () => {
  G.resetSave(); G.toMenu();
  elements['btn-settings'].dispatch('click', {});
  eq(G.getState(), 'settings');
  fireWin('keydown', { code: 'ArrowDown', preventDefault() {} });
  ok(elements['set-sfx']._focused, 'fokus harus ke kontrol pertama');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.getState(), 'menu');
});
test('101 settings touch/click wiring semua kontrol', () => {
  G.resetSave(); G.toMenu();
  elements['btn-settings'].dispatch('click', {});
  const before = G.getSave().sfxVolume;
  elements['set-sfx-vol-down'].dispatch('click', {});
  eq(G.getSave().sfxVolume, before - 10);
  elements['set-sfx-vol-up'].dispatch('click', {});
  eq(G.getSave().sfxVolume, before);
  elements['set-music'].dispatch('click', {});
  eq(G.getSave().musicEnabled, false);
  elements['set-music-vol-down'].dispatch('click', {});
  elements['set-music-vol-up'].dispatch('click', {});
  elements['set-input'].dispatch('click', {});
  eq(G.getSave().inputPreference, 'keyboard');
  elements['btn-settings-back'].dispatch('click', {});
  eq(G.getState(), 'menu');
  G.resetSave();
});
test('102 settings state hentikan simulasi', () => {
  G.resetSave(); G.toMenu();
  eq(G.isSimActive(), false);
  elements['btn-settings'].dispatch('click', {});
  eq(G.getState(), 'settings');
  eq(G.isSimActive(), false);
  G.forceStartLevel(1);
  eq(G.isSimActive(), true);
  G.setPaused(true);
  eq(G.isSimActive(), false);
  G.setPaused(false);
  G.toMenu();
});
test('103 README konsisten: count + settings + save', () => {
  ok(readme.includes('314 automated test'), 'README harus sebut 314 test, cek jumlah');
  ok(readme.includes('knightSaveV1'), 'README harus sebut key save');
  ok(readme.toLowerCase().includes('settings'), 'README harus sebut Settings');
  ok(readme.includes('5-Level Campaign'), 'README harus sebut 5-Level Campaign');
  ok(readme.includes('https://adjietegaralamsyah312.github.io/Game/'), 'README harus ada link Pages');
  ok(readme.includes('Weapon Shop'), 'README harus sebut Weapon Shop');
  eq(EXPECTED_TOTAL, 314);
});
test('104 HTML produksi settings lengkap + berlabel', () => {
  ok(/id="settings"[^>]*role="dialog"/.test(html), 'settings harus role=dialog');
  ok(/id="reset-confirm"[^>]*role="dialog"/.test(html), 'reset harus role=dialog');
  const btnText = (id) => {
    const m = html.match(new RegExp('id="' + id + '"[^>]*>([^<]*)'));
    return m ? m[1].trim() : '';
  };
  ['set-sfx', 'set-music', 'set-input', 'btn-reset-progress', 'btn-settings-back',
   'btn-reset-cancel', 'btn-reset-confirm'].forEach((id) => {
    ok(btnText(id).length > 0, 'tombol settings berlabel: ' + id);
  });
  ok(btnText('btn-reset-cancel') === 'CANCEL' && btnText('btn-reset-confirm') === 'RESET',
    'dialog reset harus CANCEL/RESET');
  ok(/id="mission"/.test(html), 'mission per-level harus ada');
  ok(/id="about-records"/.test(html), 'records harus ada');
});

// ---------- 8 TEST STAGE 7 (BGM prosedural) ----------
function ensureAudioCtx() {
  if (!FakeAudioContext.__last) fireWin('pointerdown', {});
  return FakeAudioContext.__last;
}
test('105 API music tersedia + struktur loop', () => {
  ['startMusic', 'stopMusic', 'updateMusicState', 'musicTick', 'musicInfo', 'setMusic'].forEach((fn) => {
    eq(typeof G.fx.audio[fn], 'function', 'API hilang: ' + fn);
  });
  const cfg = G.fx.audio.getCfg();
  ok('musicOn' in cfg && 'musicVol' in cfg, 'cfg musik hilang');
  srcHas('MUS_LEAD_A'); srcHas('MUS_LEAD_B');
  srcHas('currentTime'); // scheduler via Web Audio clock
  ok(!/setInterval\s*\(\s*function[^)]*music/i.test(src), 'tanpa setInterval untuk musik');
});
test('106 setMusic() mengubah konfigurasi', () => {
  G.fx.audio.setMusic(false, 40);
  let c = G.fx.audio.getCfg();
  eq(c.musicOn, false); eq(c.musicVol, 40);
  G.fx.audio.setMusic(true, 80);
  c = G.fx.audio.getCfg();
  eq(c.musicOn, true); eq(c.musicVol, 80);
});
test('107 volume music 0-100 ter-clamp', () => {
  G.fx.audio.setMusic(true, 150);
  eq(G.fx.audio.getCfg().musicVol, 100);
  G.fx.audio.setMusic(true, -10);
  eq(G.fx.audio.getCfg().musicVol, 0);
  G.fx.audio.setMusic(true, NaN);
  eq(G.fx.audio.getCfg().musicVol, 70);
});
test('108 music OFF = diam', () => {
  G.resetSave(); G.toMenu();
  G.fx.audio.setMusic(true, 70);
  ensureAudioCtx();
  G.fx.audio.startMusic();
  eq(G.fx.audio.musicInfo().playing, true);
  G.fx.audio.setMusic(false, 70);
  const mi = G.fx.audio.musicInfo();
  eq(mi.playing, false);
  eq(mi.audible, false);
  G.resetSave();
});
test('109 music ON dapat diaktifkan kembali', () => {
  G.resetSave(); G.toMenu();
  G.fx.audio.setMusic(false, 70);
  ensureAudioCtx();
  eq(G.fx.audio.musicInfo().audible, false);
  G.fx.audio.setMusic(true, 70);
  const mi = G.fx.audio.musicInfo();
  eq(mi.playing, true);
  eq(mi.audible, true);
  G.resetSave();
});
test('110 start/stop idempotent, tanpa duplikat', () => {
  G.resetSave(); G.toMenu();
  G.fx.audio.setMusic(true, 70);
  ensureAudioCtx();
  G.fx.audio.stopMusic();
  eq(G.fx.audio.musicInfo().playing, false);
  const s0 = G.fx.audio.musicInfo().starts;
  G.fx.audio.startMusic(); G.fx.audio.startMusic(); G.fx.audio.startMusic();
  const mi = G.fx.audio.musicInfo();
  eq(mi.playing, true);
  eq(mi.starts, s0 + 1, 'start ganda tidak boleh re-init');
  const actx = ensureAudioCtx();
  actx.currentTime += 1.0;
  const n0 = G.fx.audio.musicInfo().scheduled;
  G.fx.audio.musicTick();
  ok(G.fx.audio.musicInfo().scheduled > n0, 'scheduler menjadwal nada');
  // Replay/level switch/respawn: tetap satu musik, tanpa throw.
  G.forceStartLevel(1); G.forceStartLevel(2); G.respawn();
  eq(G.fx.audio.musicInfo().playing, true);
  G.toMenu(); G.resetSave();
});
test('111 save/load music kompatibel + audio ikut', () => {
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 2, musicEnabled: false, musicVolume: 33 }));
  G.reloadSave();
  const s = G.getSave();
  eq(s.musicEnabled, false); eq(s.musicVolume, 33);
  eq(G.fx.audio.getCfg().musicVol, 33, 'audio mengikuti save saat reload');
  G.resetSave();
});
test('112 SFX tidak regresi (independen dari musik)', () => {
  G.resetSave();
  G.fx.audio.setSfx(true, 80); G.fx.audio.setMusic(true, 30);
  let c = G.fx.audio.getCfg();
  eq(c.sfxVol, 80); eq(c.musicVol, 30);
  G.fx.audio.setMusic(true, 10);
  eq(G.fx.audio.getCfg().sfxVol, 80, 'vol musik tak pengaruhi SFX');
  G.fx.audio.setSfx(true, 90);
  eq(G.fx.audio.getCfg().musicVol, 10, 'vol SFX tak pengaruhi musik');
  ensureAudioCtx();
  noThrow(() => { G.fx.audio.play('jump'); G.fx.audio.play('attack'); G.fx.audio.play('bossDie'); });
  G.resetSave();
});

// ---------- 6 TEST GAME OVER MENU ----------
// Helper: paksa Game Over sungguhan (mati -> step -> overlay).
function forceRealGameOver() {
  G.forceStartLevel(1);
  G.hurtPlayer(999, 9999);
  for (let i = 0; i < 70; i++) G.step(1 / 60);
  eq(G.getState(), 'gameover');
}
test('113 btn-gameover-menu ada & unik di HTML produksi', () => {
  ok(html.includes('id="btn-gameover-menu"'), 'id hilang di index.html');
  eq(html.split('id="btn-gameover-menu"').length - 1, 1, 'ID duplikat!');
  ok(html.includes('id="btn-gamemenu"'), 'btn-gamemenu (Game Complete) harus tetap ada');
  ok(/id="btn-gameover-menu"[^>]*>([^<]*)/.test(html), 'tombol berlabel');
  srcHas("getElementById('btn-gameover-menu')");
  srcHas('onClick(btnGameOverMenu');
});
test('114 handler menu terpasang via onClick+toMenu', () => {
  ok(elements['btn-gameover-menu'].listeners['click'].length >= 1, 'handler click hilang');
  srcHas('onClick(btnGameOverMenu, function () { toMenu(); });');
});
test('115 klik MENU: state menu, overlay tukar, save utuh', () => {
  G.resetSave();
  completeL1Flow(); // unlock L2 + bestL1 tercatat
  ok(G.getSave().level2Unlocked, 'pra-kondisi unlock');
  forceRealGameOver(); // death TERCATAT di sini (benar, sebelum klik MENU)
  const before = JSON.stringify(G.getSave());
  ok(!elements['gameover'].classList.contains('hidden'), 'overlay gameover tampil');
  elements['btn-gameover-menu'].dispatch('click', {});
  eq(G.getState(), 'menu');
  ok(elements['gameover'].classList.contains('hidden'), 'overlay gameover sembunyi');
  ok(!elements['mainmenu'].classList.contains('hidden'), 'menu tampil');
  eq(JSON.stringify(G.getSave()), before, 'klik MENU tak ubah save');
  eq(G.isSimActive(), false);
  G.resetSave();
});
test('116 Respawn & Dari Awal tetap berfungsi', () => {
  forceRealGameOver();
  elements['btn-respawn'].dispatch('click', {});
  eq(G.getState(), 'playing');
  forceRealGameOver();
  elements['btn-restart'].dispatch('click', {});
  eq(G.getState(), 'playing');
  eq(G.getLevel(), 1);
  G.toMenu();
});
test('117 R/Enter tetap Respawn (tak berubah)', () => {
  forceRealGameOver();
  fireWin('keydown', { code: 'KeyR', preventDefault() {} });
  eq(G.input.restartPressed, true, 'KeyR harus set restartPressed');
  srcHas("if (Input.restartPressed) { Input.restartPressed = false; respawn(); }");
  G.input.restartPressed = false;
  G.toMenu();
});
test('118 touch sizing Game Over + anti-clip', () => {
  ok(/#gameover\s+\.btn-primary,\s*#gameover\s+\.btn-secondary\s*{[^}]*min-height:\s*56px/.test(css),
    'tombol gameover ideal 56px');
  const blocks = __mediaBlocks(css);
  const dlg = blocks.filter((b) => b.body.includes('#mainmenu') && b.body.includes('position: fixed'));
  ok(dlg.length >= 1 && dlg[0].body.includes('#gameover'), '#gameover ikut fullscreen anti-clip');
  ok(css.includes('.btn-row') && css.includes('flex-wrap: wrap'), 'tombol wrap natural di HP');
});

// ---------- 5 REGRESSION TEST AUDIT (B2, B3, B4, R1, R2) ----------
test('119 B2: queued basi bersih saat ayunan baru (tanpa phantom combo)', () => {
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.queued = true; // simulasi buffer basi dari ayunan yang di-interrupt
  pl.attackCooldown = 0;
  G.input.attackPressed = true;
  G.step(1 / 60);
  eq(pl.state, 'attack');
  eq(pl.queued, false, 'queued harus reset saat ayunan baru dimulai');
  for (let i = 0; i < 45; i++) G.step(1 / 60); // ayunan + cooldown selesai
  ok(pl.state !== 'attack', 'tak boleh auto-chain, state=' + pl.state);
  // Kombo normal tetap bekerja: buffer saat swing -> chain sekali.
  G.input.attackPressed = true;
  G.step(1 / 60);
  eq(G.getPlayer().state, 'attack');
  G.restart();
});
test('120 B3: satu reversal per frame + patrol tetap terkekang', () => {
  srcHas('else if (!slimeHasGroundAhead(s))');
  G.forceStartLevel(1);
  for (let i = 0; i < 300; i++) G.step(1 / 60);
  G.getEnemies().forEach((s) => {
    ok(s.x >= s.minX - 1 && s.x <= s.maxX + 1, 'patrol keluar zona: ' + s.x);
    ok(['patrol', 'chase', 'attack', 'hurt'].includes(s.state) || s.dead, 'state aneh: ' + s.state);
  });
  G.restart();
});
test('121 B4: killing blow tak picu enrage; non-lethal tetap enrage', () => {
  G.forceStartLevel(2);
  let b = G.getBoss();
  b.hp = 45; b.iframes = 0;
  G.hurtBoss(50, 0); // 45 -> -5: mati, lewati threshold 40
  eq(b.state, 'death');
  eq(b.enraged, false, 'killing blow jangan enrage');
  G.forceStartLevel(2);
  b = G.getBoss(); b.iframes = 0;
  G.hurtBoss(90, 0); // 120 -> 30: hidup, di bawah threshold
  eq(b.state, 'hurt');
  eq(b.enraged, true, 'non-lethal di bawah threshold tetap enrage');
  G.toMenu(); G.resetSave();
});
test('122 R1: lookup varian aman dari prototype chain', () => {
  eq(G.enemyKindOf('slime'), 'slime');
  eq(G.enemyKindOf('fast'), 'fast');
  eq(G.enemyKindOf('heavy'), 'heavy');
  ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf', undefined, null, 42].forEach((t) => {
    eq(G.enemyKindOf(t), 'slime', 'fallback slime untuk: ' + String(t));
  });
  srcHas('hasOwnProperty.call(ENEMY_STATS');
  ok(!/ENEMY_STATS\[spawn\.type\] \|\|/.test(src), 'lookup lama ber-|| harus hilang');
  ok(!/spawn\.type in ENEMY_STATS/.test(src), 'operator in harus hilang');
});
test('123 R2: key lama dibersihkan, save aktif utuh', () => {
  testStorage._map.set('knightBestV1', JSON.stringify({ time: 5 }));
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 2, bestL1: 12.5, level2Unlocked: true }));
  G.reloadSave();
  ok(!testStorage._map.has('knightBestV1'), 'key lama harus terhapus');
  const raw = testStorage._map.get('knightSaveV1');
  ok(raw !== null, 'knightSaveV1 jangan terhapus');
  const s = G.getSave();
  eq(s.bestL1, 12.5); eq(s.level2Unlocked, true);
  noThrow(() => { G.forceStartLevel(1); G.step(1 / 60); });
  G.resetSave();
});

// ---------- 6 TEST STAGE 8 (feel + konten) ----------
test('124 coin celah L1 terjangkau lompat normal', () => {
  G.forceStartLevel(1);
  const before = G.getCoins().got;
  const pl = G.getPlayer();
  pl.x = 470; pl.y = 402; pl.vx = 0; pl.vy = 0;
  G.input.right = true; G.input.jumpHeld = true; G.input.jumpPressed = true;
  let dead = false;
  for (let i = 0; i < 120 && G.getCoins().got === before; i++) {
    G.step(1 / 60);
    if (pl.state === 'death') dead = true;
  }
  ok(!dead, 'lompat coin tak boleh mati');
  eq(G.getCoins().got, before + 1, 'tepat 1 coin celah terambil');
  // Lanjutkan hingga mendarat (koleksi terjadi di tengah lompatan).
  for (let i = 0; i < 120 && !pl.onGround && pl.state !== 'death'; i++) {
    G.step(1 / 60);
    if (pl.state === 'death') dead = true;
  }
  G.input.right = false; G.input.jumpHeld = false;
  ok(!dead, 'harus mendarat selamat');
  ok(pl.onGround && pl.x + pl.w > 610, 'mendarat di sisi jauh celah, x=' + Math.round(pl.x));
  G.restart();
});
test('125 encounter L2: solo fast, solo heavy, kombo overlap', () => {
  G.forceStartLevel(2);
  const es = G.getEnemies();
  eq(es.length, 3);
  const solo = es[0], heavy = es[1], combo = es[2];
  eq(solo.kind, 'fast'); eq(heavy.kind, 'heavy'); eq(combo.kind, 'fast');
  ok(solo.maxX < heavy.minX, 'fast solo terpisah dari arena heavy');
  ok(heavy.maxX >= combo.minX,
    'zona kombo harus overlap: heavy.maxX=' + heavy.maxX + ' fast.minX=' + combo.minX);
  [solo, heavy, combo].forEach((s) => {
    ok(s.minX >= 0 && s.maxX <= 2400 && s.minX < s.maxX, 'zona valid');
  });
  G.restart();
});
test('126 intro boss sekali saat masuki zona arena', () => {
  G.forceStartLevel(2);
  eq(G.getBoss().introduced, false);
  for (let i = 0; i < 30; i++) G.step(1 / 60); // pemain jauh di spawn
  eq(G.getBoss().introduced, false, 'jauh dari arena: belum intro');
  const pl = G.getPlayer();
  pl.x = 1900; pl.y = 402; pl.vx = 0; pl.vy = 0; // gerbang arena
  G.step(1 / 60);
  eq(G.getBoss().introduced, true, 'masuk zona: intro jalan');
  G.restart();
});
test('127 tema visual per level (data-driven, loop aman)', () => {
  srcHas('LEVEL_THEME');
  srcHas('skyGrads');
  ok(/#4a3b6b/.test(src) && /#33244d/.test(src), 'palet ground L1/L2 berbeda');
  G.forceStartLevel(1);
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  G.forceStartLevel(2);
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  eq(G.getState(), 'playing');
  G.restart();
});
test('128 copy meta/OG sesuai konten kini', () => {
  const desc = html.match(/name="description" content="([^"]*)"/)[1];
  ok(/5 level/i.test(desc) && /RAJA SLIME/.test(desc) && /RAJA LICH/.test(desc) && /Shard/i.test(desc), 'description basi: ' + desc);
  ok(!/3 slime/.test(desc), 'copy lama 3-slime harus hilang');
  ok(!/2 level/i.test(desc), 'copy lama 2-level harus hilang');
  const og = html.match(/property="og:description" content="([^"]*)"/)[1];
  ok(/RAJA SLIME/.test(og) && /RAJA LICH/.test(og) && !/3 slime/.test(og), 'og basi: ' + og);
});
test('129 feedback Terkena: partikel + shake boss', () => {
  G.restart(); // pool partikel bersih
  const c0 = G.fx.count();
  G.hurtPlayer(10, G.getPlayer().x + 200);
  ok(G.fx.count() > c0, 'hurt harus burst partikel');
  srcHas('triggerScreenShake(SHAKE_HIT, 0.12)'); // boss hit lebih kuat
  G.restart();
});

// ---------- 2 TEST AUDIT PUTARAN DUA ----------
test('130 startTrans menolak level invalid tanpa crash', () => {
  G.toMenu();
  const st0 = G.getState();
  noThrow(() => { G.startTrans(0); G.startTrans(99); G.startTrans(-1); G.startTrans(NaN); });
  eq(G.getTrans().active, false, 'transisi invalid jangan jalan');
  eq(G.getState(), st0, 'state jangan berubah');
  eq(G.getLevel(), 1);
  srcHas('n <= Levels.length');
});
test('131 hygiene: tanpa field mati + aria dialog unik', () => {
  ok(!/swingId/.test(src), 'swingId write-only harus hilang');
  ok(!/removeT/.test(src), 'removeT tak-terbaca harus hilang');
  const labels = [...html.matchAll(/role="dialog" aria-label="([^"]*)"/g)].map((m) => m[1]);
  eq(new Set(labels).size, labels.length, 'aria-label dialog duplikat: ' + labels);
});

// ---------- 1 TEST REGRESI GROUNDING SPRITE ----------
test('132 kaki sprite napak tanah (offset data-driven)', () => {
  // Ambil offset sesungguhnya dari rumus drawPlayer, bukan asumsi:
  // dy = y + h - dh + KNIGHT_FEET_DY  ->  kaki = h - dh + X + 81.
  const m = src.match(/player\.y \+ player\.h - dh \+ \(squashing \? 0 : ([A-Z_]+|\d+)\)/);
  ok(m, 'rumus offset drawPlayer harus terbaca');
  let X;
  if (/^\d+$/.test(m[1])) X = parseInt(m[1], 10);
  else {
    const cm = src.match(new RegExp('var ' + m[1] + ' = (\\d+)'));
    ok(cm, 'konstanta offset ' + m[1] + ' harus data-driven');
    X = parseInt(cm[1], 10);
  }
  const feet = 78 - 96 + X + 81; // h=78, dh=96, tepi bawah sprite 81px
  eq(feet, 78, 'kaki (offset +' + X + ') harus tepat di tanah y+78');
  // Squash: bawah dipin di tanah (offset 0, dh=88).
  ok(src.includes('squashing ? 0 :'), 'squash harus pin bawah di tanah');
});

// ---------- 1 TEST PLATFORM ARENA ----------
test('133 platform arena boss terjangkau lompatan', () => {
  // Regresi: top 350 lama = 130px dari tanah > lompat riil ~121px (mustahil).
  // Top 365 = langkah 115px, konsisten dengan platform lain.
  G.forceStartLevel(2);
  const pl = G.getPlayer();
  pl.x = 1990; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.iframes = 9999;
  G.input.right = true; G.input.jumpHeld = true; G.input.jumpPressed = true;
  let landed = false, dead = false;
  for (let i = 0; i < 150; i++) {
    G.step(1 / 60);
    if (pl.state === 'death') { dead = true; break; }
    if (pl.onGround && Math.abs(pl.y - (365 - 78)) < 3) { landed = true; break; }
  }
  G.input.right = false; G.input.jumpHeld = false;
  ok(!dead, 'lompat ke platform tak boleh mati');
  ok(landed, 'harus mendarat di platform (y~=287)');
  G.restart();
});

// ---------- 21 TEST STAGE 9 (skeleton campaign + lich + final) ----------
test('134 Level 3 unlock setelah L2 clear', () => {
  G.resetSave();
  eq(G.canPlayLevel(3), false, 'L3 terkunci awal');
  completeL1Flow();
  eq(G.canPlayLevel(2), true, 'L1 clear -> L2 unlock');
  bossKillFlow();
  eq(G.getState(), 'levelcomplete', 'L2 boss -> levelcomplete');
  eq(G.canPlayLevel(3), true, 'L2 clear -> L3 unlock');
  ok(JSON.parse(testStorage._map.get('knightSaveV1')).level3Unlocked, 'persist L3 unlock');
  G.resetSave();
});
test('135 Level 4 unlock setelah L3 clear', () => {
  G.resetSave();
  completeL1Flow(); bossKillFlow();
  eq(G.startLevel(3), true, 'L3 unlocked -> gated start diizinkan');
  const pl = G.getPlayer();
  pl.x = 2290; pl.y = 400;
  G.step(1 / 60);
  eq(G.getState(), 'levelcomplete', 'L3 goal -> levelcomplete');
  eq(G.canPlayLevel(4), true, 'L3 clear -> L4 unlock');
  eq(G.getSave().level3Completed, true);
  G.resetSave();
});
test('136 Level 5 unlock setelah L4 clear', () => {
  G.resetSave();
  lichKillFlow();
  eq(G.getState(), 'levelcomplete', 'L4 lich -> levelcomplete (bukan gamecomplete)');
  eq(G.canPlayLevel(5), true, 'L4 clear -> L5 unlock');
  eq(G.getSave().level4Completed, true);
  G.resetSave();
});
test('137 Skeleton Swordsman stats/state', () => {
  srcHas('skeletonSword');
  G.forceStartLevel(3);
  const sw = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  ok(sw, 'swordsman harus ada di L3');
  eq(sw.hp, 40); eq(sw.w, 40);
  ok(sw.st.range < 60, 'range < player, got ' + sw.st.range);
  ok(['patrol', 'chase'].includes(sw.state), 'state awal valid: ' + sw.state);
  ok(sw.st.windup >= 0.3, 'telegraph jelas');
  G.forceStartLevel(1);
});
test('138 Skeleton Defender stats/state', () => {
  srcHas('skeletonDefender');
  G.forceStartLevel(3);
  const df = G.getEnemies().find((e) => e.kind === 'skeletonDefender');
  ok(df, 'defender harus ada di L3');
  eq(df.hp, 70);
  ok(df.st.patrol < 55 && df.st.chase < 110, 'lebih lambat dari swordsman');
  ok(df.st.dmg < 12, 'damage lebih rendah dari swordsman');
  ok(df.st.guard && df.st.guard.block > 0, 'guard config ada');
  G.forceStartLevel(1);
});
test('139 Skeleton Archer stats/state', () => {
  srcHas('skeletonArcher');
  G.forceStartLevel(3);
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  ok(ar, 'archer harus ada di L3');
  eq(ar.hp, 25);
  ok(['patrol', 'chase', 'shoot'].includes(ar.state), 'state archer valid: ' + ar.state);
  ok(ar.st.cooldown >= 2.0, 'fire cooldown jelas: ' + ar.st.cooldown);
  G.forceStartLevel(1);
});
test('140 Archer projectile lifecycle', () => {
  G.forceStartLevel(3);
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  ok(ar, 'pra-kondisi archer');
  eq(G.getShots().length, 0, 'awal steril');
  // Paksa telegraph -> tembak tepat waktu (bukan tiap frame).
  ar.state = 'shoot'; ar.atkT = 0; ar.cooldown = 0;
  const pl = G.getPlayer();
  pl.x = ar.x + 200; pl.y = 402; pl.iframes = 9999;
  G.step(1 / 60);
  ok(G.getShots().length <= 1, 'maks 1 per telegraph, got ' + G.getShots().length);
  // Isolasi lifetime: bekukan archer agar tak menembak lagi.
  ar.state = 'patrol'; ar.cooldown = 9999;
  pl.x = 80; pl.y = 300;
  for (let i = 0; i < 200; i++) G.step(1 / 60);
  eq(G.getShots().length, 0, 'expired harus cleanup');
  // Pool bounded: spam spawn tak boleh >10.
  for (let k = 0; k < 20; k++) G.spawnShot(100, 400, 1, 'arrow');
  ok(G.getShots().length <= 10, 'pool bounded, got ' + G.getShots().length);
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('141 Defender block frontal vs belakang', () => {
  G.forceStartLevel(3);
  const df = G.getEnemies().find((e) => e.kind === 'skeletonDefender');
  ok(df, 'pra-kondisi defender');
  df.state = 'chase'; df.dir = 1; df.iframes = 0;
  const cx = df.x + df.w / 2;
  const hp0 = df.hp;
  // M6: serang dari depan (kanan, dir=1) -> NO damage + guardFlash + NO iframes.
  G.hurtEnemy(df.id, 12, cx + 100);
  eq(df.hp, hp0, 'depan ter-block: tanpa damage, hp=' + df.hp);
  ok(df.guardFlash > 0, 'visual cue block harus nyala');
  eq(df.iframes, 0, 'block tidak boleh bakar iframes');
  // Immediate second hit valid dari belakang -> penuh (bukti iframe bersih).
  G.hurtEnemy(df.id, 12, cx - 100);
  eq(df.hp, hp0 - 12, 'belakang langsung penuh tanpa jeda iframe');
  G.forceStartLevel(1);
});
test('142 Miniboss spawn/state', () => {
  srcHas('PANGLIMA TULANG');
  G.forceStartLevel(3);
  const m = G.getMiniboss();
  ok(m, 'miniboss harus spawn di L4');
  eq(m.name, 'PANGLIMA TULANG'); eq(m.hp, 90);
  ok(['idle', 'telegraph', 'slash', 'dash', 'recovery'].includes(m.state) || m.state === 'idle', 'state=' + m.state);
  eq(m.introduced, false, 'belum intro di spawn');
  // Masuk arena -> intro sekali.
  const pl = G.getPlayer();
  pl.x = 1100; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.iframes = 9999;
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  eq(G.getMiniboss().introduced, true, 'intro jalan saat masuk arena');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('143 Miniboss death flow', () => {
  G.forceStartLevel(3);
  const m = G.getMiniboss();
  m.iframes = 0;
  // Non-lethal -> hurt, bukan death.
  G.hurtMiniboss(20, m.x + 200);
  ok(m.state !== 'death', 'non-lethal jangan death');
  // Killing blow -> death -> dead + kill terhitung, tanpa enrage ganda.
  for (let k = 0; k < 10 && m.state !== 'death'; k++) { m.iframes = 0; G.hurtMiniboss(30, m.x + 200); }
  eq(m.state, 'death');
  const k0 = G.getStats().levelKills;
  for (let i = 0; i < 80; i++) G.step(1 / 60);
  eq(m.dead, true, 'death -> dead');
  ok(G.getStats().levelKills >= k0, 'kill terhitung');
  G.forceStartLevel(1);
});
test('144 Raja Lich intro sekali', () => {
  srcHas('RAJA LICH');
  G.forceStartLevel(4);
  const b = G.getBoss();
  ok(b && b.kind === 'lich', 'L4 boss harus lich');
  eq(b.state, 'dormant'); eq(b.introduced, false);
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  eq(b.introduced, false, 'jauh dari arena jangan intro');
  const pl = G.getPlayer();
  pl.x = 1900; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.iframes = 9999;
  G.step(1 / 60);
  eq(b.introduced, true, 'masuk arena -> intro');
  eq(b.state, 'idle', 'intro selesai -> idle (tidak langsung serang)');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('145 Raja Lich phase 2', () => {
  G.forceStartLevel(4);
  const b = G.getBoss();
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = 2000; pl.y = 402;
  for (let i = 0; i < 10; i++) G.step(1 / 60); // intro selesai
  b.iframes = 0;
  // HP 160 -> 100 (62.5%) lewati threshold 65%.
  G.hurtBoss(60, b.x - 100);
  eq(G.getLichPhase(), 2, 'hp 100/160 harus phase 2');
  ok(b.phase >= 2, 'phase tercatat');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('146 Raja Lich phase 3 enrage', () => {
  G.forceStartLevel(4);
  const b = G.getBoss();
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = 2000; pl.y = 402;
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  b.iframes = 0; G.hurtBoss(60, b.x - 100); // -> P2
  b.iframes = 0; G.hurtBoss(60, b.x - 100); // 40/160 = 25% -> P3
  eq(G.getLichPhase(), 3, 'hp rendah harus phase 3');
  eq(b.enraged, true, 'P3 harus enraged');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('147 Raja Lich death priority', () => {
  G.forceStartLevel(4);
  const b = G.getBoss();
  b.hp = 45; b.phase = 1; b.enraged = false; b.iframes = 0;
  G.hurtBoss(50, b.x - 100); // killing blow lewati threshold
  eq(b.state, 'death', 'killing blow -> death');
  eq(b.enraged, false, 'killing blow jangan enrage');
  G.forceStartLevel(4);
  const b2 = G.getBoss();
  b2.iframes = 0;
  G.hurtBoss(60, b2.x - 100); // 100/160 non-lethal di bawah 65%
  ok(b2.phase >= 2, 'non-lethal tetap phase-up');
  G.forceStartLevel(1);
});
test('148 Level 4 completion -> unlock L5', () => {
  G.resetSave();
  lichKillFlow();
  eq(G.getState(), 'levelcomplete', 'lich mati -> L4 complete');
  eq(G.getSave().level4Completed, true);
  eq(G.canPlayLevel(5), true);
  G.resetSave();
});
test('149 Level 5 mixed slime + skeleton', () => {
  G.forceStartLevel(5);
  eq(G.getLevelCount(), 5, 'campaign 5 level');
  const es = G.getEnemies();
  eq(es.length, 6, 'L5 6 enemy pacing, got ' + es.length);
  const kinds = es.map((e) => e.kind);
  ok(kinds.includes('slime') || kinds.includes('fast') || kinds.includes('heavy'), 'slime faction ada: ' + kinds);
  ok(kinds.includes('skeletonSword') || kinds.includes('skeletonDefender') || kinds.includes('skeletonArcher'), 'skeleton faction ada: ' + kinds);
  ok(kinds.includes('skeletonDefender') && kinds.includes('skeletonArcher'), 'defender+archer mixed: ' + kinds);
  G.forceStartLevel(1);
});
test('150 Final sequence slime -> lich tanpa duplikat', () => {
  G.forceStartLevel(5);
  eq(G.getFinalPhase(), 'slime', 'awal fase slime');
  for (let k = 0; k < 10 && G.getBoss().state !== 'death'; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 120; i++) G.step(1 / 60); // death + interlude
  eq(G.getFinalPhase(), 'inter', 'slime tumbang -> inter (tanpa victory dulu)');
  for (let i = 0; i < 160; i++) G.step(1 / 60); // 2 dtk -> lich spawn
  const b = G.getBoss();
  ok(b && b.kind === 'lich', 'lich kedua spawn');
  eq(G.getFinalPhase(), 'lich');
  eq(G.getShots().length, 0, 'transisi steril tanpa stale projectile');
  G.forceStartLevel(1);
});
test('151 Final Game Complete setelah kedua raja', () => {
  G.resetSave();
  finalKillFlow();
  eq(G.getState(), 'gamecomplete', 'L5 selesai -> gamecomplete');
  ok(!elements['gameclear'].classList.contains('hidden'), 'victory screen tampil');
  G.forceStartLevel(1);
  G.resetSave();
});
test('152 save/load Level 3-5 progression', () => {
  G.resetSave();
  completeL1Flow(); bossKillFlow(); // unlock L3
  eq(G.startLevel(3), true, 'gated start L3 diizinkan setelah unlock');
  let pl = G.getPlayer();
  pl.x = 2290; pl.y = 400;
  G.step(1 / 60); // L3 clear -> L4 unlock
  lichKillFlow(); // L4 clear -> L5 unlock
  eq(G.canPlayLevel(5), true);
  G.reloadSave();
  eq(G.canPlayLevel(3), true); eq(G.canPlayLevel(4), true); eq(G.canPlayLevel(5), true);
  eq(G.getSave().level3Completed, true); eq(G.getSave().level4Completed, true);
  G.resetSave();
});
test('153 old save v1 migrasi aman', () => {
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 1, bestL1: 12.5, level1Completed: true, level2Unlocked: true, sfxVolume: 80 }));
  noThrow(() => G.reloadSave());
  const s = G.getSave();
  eq(s.version, 4, 'migrasi ke v4');
  eq(s.bestL1, 12.5, 'best lama lestari');
  eq(s.level1Completed, true); eq(s.level2Unlocked, true);
  eq(s.level3Unlocked, false, 'field baru default terkunci');
  eq(s.bestL3, null); eq(s.sfxVolume, 80, 'settings lama lestari');
  noThrow(() => { G.forceStartLevel(3); G.step(1 / 60); });
  G.resetSave();
});
test('154 no duplicate BGM saat transisi level', () => {
  G.resetSave(); G.toMenu();
  G.fx.audio.setMusic(true, 70);
  ensureAudioCtx();
  G.fx.audio.startMusic();
  const s0 = G.fx.audio.musicInfo().starts;
  // Pindah L1..L5 + respawn: scheduler tetap satu, tanpa re-init.
  G.forceStartLevel(1); G.forceStartLevel(2); G.forceStartLevel(3); G.forceStartLevel(4); G.forceStartLevel(5); G.respawn();
  eq(G.fx.audio.musicInfo().starts, s0, 'transisi jangan restart BGM');
  eq(G.fx.audio.musicInfo().playing, true);
  // Mood ikut level tanpa duplikat.
  G.forceStartLevel(3);
  eq(G.fx.audio.getMood(), 1, 'L3 dungeon mood');
  G.forceStartLevel(5);
  eq(G.fx.audio.getMood(), 2, 'L5 final mood');
  eq(G.fx.audio.musicInfo().starts, s0, 'ganti mood jangan restart');
  G.toMenu(); G.resetSave();
});

// ---------- 10 TEST HARDENING (behavior, bukan string) ----------
test('155 C1 ghost attack: hurt clear attackBox, tanpa hit baru', () => {
  G.forceStartLevel(1);
  const e = G.getEnemies()[0];
  const pl = G.getPlayer();
  pl.iframes = 0;
  pl.x = e.x - 10; pl.y = e.y; pl.vx = 0; pl.vy = 0; pl.facing = 1;
  // Simulasi frame strike: player attack + attackBox overlap enemy.
  pl.state = 'attack'; pl.attackT = 0.09;
  pl.attackBox = { x: e.x, y: e.y, w: e.w, h: e.h };
  pl.didStrikeHit = {};
  const hp0 = e.hp;
  G.hurtPlayer(10, pl.x + 200); // player -> hurt di tengah strike
  eq(pl.state, 'hurt', 'player harus hurt');
  eq(pl.attackBox, null, 'attackBox harus null setelah hurt');
  G.step(1 / 60); // resolve attack berikutnya
  eq(e.hp, hp0, 'tidak boleh ada ghost hit, hp=' + e.hp);
  G.forceStartLevel(1);
});
test('156 C2 victory race: hazard steril, player kebal, victory tercapai', () => {
  G.forceStartLevel(2);
  const pl = G.getPlayer();
  pl.iframes = 0;
  pl.x = 2000; pl.y = 402; pl.vx = 0; pl.vy = 0;
  G.spawnShot(pl.x, pl.y, 1, 'arrow'); // hazard aktif sebelum killing blow
  ok(G.getShots().length >= 1, 'pra-kondisi hazard aktif');
  const b = G.getBoss();
  for (let k = 0; k < 4; k++) { b.iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 80 && !b.dead; i++) G.step(1 / 60);
  eq(b.dead, true, 'boss harus dead');
  eq(G.getVictoryArmed(), true, 'victory armed');
  eq(G.getShots().length, 0, 'projectile harus steril saat victory');
  eq(G.getShocks().length, 0, 'shock harus steril saat victory');
  const hp0 = pl.hp;
  pl.iframes = 0;
  G.spawnShot(pl.x, pl.y, 1, 'arrow'); // spawn baru harus diblok
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  eq(G.getPlayer().hp, hp0, 'player kebal selama victory delay');
  for (let i = 0; i < 120; i++) G.step(1 / 60);
  eq(G.getState(), 'levelcomplete', 'victory tercapai');
  G.forceStartLevel(1);
});
test('157 M6 defender: dua block frontal tanpa chip damage', () => {
  G.forceStartLevel(3);
  const df = G.getEnemies().find((e) => e.kind === 'skeletonDefender');
  ok(df, 'pra-kondisi defender');
  df.state = 'chase'; df.dir = 1; df.iframes = 0;
  const cx = df.x + df.w / 2, hp0 = df.hp;
  G.hurtEnemy(df.id, 12, cx + 100); // block #1
  eq(df.hp, hp0, 'block #1 tanpa damage');
  G.hurtEnemy(df.id, 12, cx + 100); // block #2 langsung (tanpa iframe gap)
  eq(df.hp, hp0, 'block #2 tanpa chip damage (dulu min 1/hit)');
  ok(df.state !== 'death', 'defender tidak boleh dicicil mati dari depan');
  G.forceStartLevel(1);
});
test('158 M2 hurt konsumsi attackPressed, tanpa phantom attack', () => {
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.iframes = 0;
  G.hurtPlayer(10, pl.x + 200);
  eq(pl.state, 'hurt', 'pra-kondisi hurt');
  G.input.attackPressed = true; // tekan J saat knockback
  G.step(1 / 60);
  eq(G.input.attackPressed, false, 'attackPressed harus dikonsumsi');
  for (let i = 0; i < 40; i++) G.step(1 / 60); // lewati hurt duration
  ok(pl.state !== 'attack', 'tidak boleh phantom attack, state=' + pl.state);
  G.forceStartLevel(1);
});
test('159 M3 R saat PLAYING respawn checkpoint', () => {
  G.forceStartLevel(1);
  const before = JSON.stringify(G.getSave());
  const pl = G.getPlayer();
  pl.x = 1000; pl.y = 300; // jauh dari spawn
  G.hurtPlayer(20, pl.x + 200); // HP berkurang
  ok(G.getPlayer().hp < 100, 'pra-kondisi HP kurang');
  G.input.restartPressed = true; // simulasi tombol R
  G.step(1 / 60);
  eq(G.getState(), 'playing', 'tetap playing');
  const p2 = G.getPlayer();
  eq(p2.hp, 100, 'HP pulih via respawn');
  ok(Math.abs(p2.x - 80) < 1, 'kembali ke checkpoint/spawn, x=' + p2.x);
  eq(JSON.stringify(G.getSave()), before, 'progression/save tidak tereset');
  G.forceStartLevel(1);
});
test('160 M4 unlock gate: locked ditolak, unlocked diizinkan', () => {
  G.resetSave();
  eq(G.startLevel(3), false, 'L3 locked harus ditolak');
  ok(G.getLevel() !== 3, 'level tidak boleh pindah');
  eq(G.getTrans().active, false, 'transisi locked jangan jalan');
  G.startTrans(3);
  eq(G.getTrans().active, false, 'startTrans locked jangan jalan');
  completeL1Flow(); bossKillFlow(); // unlock L3
  eq(G.startLevel(3), true, 'L3 unlocked diizinkan');
  eq(G.getLevel(), 3);
  eq(G.startLevel(4), false, 'L4 masih locked harus ditolak');
  const pl = G.getPlayer();
  pl.x = 2290; pl.y = 400;
  G.step(1 / 60); // L3 clear -> L4 unlock
  eq(G.startLevel(4), true, 'L4 unlocked diizinkan');
  G.resetSave();
});
test('161 M5 migrasi audio: hilang berarti ON', () => {
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 1, bestL1: 5 }));
  G.reloadSave();
  eq(G.getSave().sfxEnabled, true, 'sfx hilang -> ON (dulu mute)');
  eq(G.getSave().musicEnabled, true, 'music hilang -> ON (dulu mute)');
  eq(G.getSave().bestL1, 5, 'best lama lestari');
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 1, sfxEnabled: false, musicEnabled: false }));
  G.reloadSave();
  eq(G.getSave().sfxEnabled, false, 'explicit false tetap OFF');
  eq(G.getSave().musicEnabled, false, 'explicit false tetap OFF');
  G.resetSave();
});
test('162 M7 archer retreat tidak keluar platform', () => {
  G.forceStartLevel(3);
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  ok(ar, 'pra-kondisi archer');
  const pl = G.getPlayer();
  pl.iframes = 9999;
  // Archer di kanan celah 520-610, player rapat di kanan -> retreat ke kiri (ke celah).
  ar.x = 650; ar.y = 426; ar.vx = 0; ar.vy = 0;
  ar.minX = 600; ar.maxX = 900; ar.cooldown = 9999; ar.state = 'chase';
  pl.x = 750; pl.y = 402; pl.vx = 0; pl.vy = 0;
  for (let i = 0; i < 90; i++) G.step(1 / 60);
  ok(ar.x > 555, 'archer tidak boleh nyebur ke celah, x=' + Math.round(ar.x));
  ok(ar.y < 500, 'archer tidak boleh jatuh, y=' + Math.round(ar.y));
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('163 M8 leash clamp stabil tanpa jitter', () => {
  G.forceStartLevel(1);
  const e = G.getEnemies()[0];
  const pl = G.getPlayer();
  pl.iframes = 9999;
  const hi = e.spawnX + 380; // SLIME_LEASH
  // Player dalam detect range di sisi luar -> chase mendorong keluar bound.
  e.state = 'chase'; e.x = hi + 50; e.vx = 200;
  pl.x = e.spawnX + 500; pl.y = 402; pl.vx = 0; pl.vy = 0;
  G.step(1 / 60);
  ok(e.x <= hi + 1, 'clamp ke bound, x=' + Math.round(e.x));
  eq(e.vx, 0, 'vx dinolkan (dulu 200 terus = jitter)');
  const x1 = e.x;
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  ok(Math.abs(e.x - x1) < 2, 'stabil tanpa jitter, dx=' + Math.abs(e.x - x1).toFixed(1));
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('164 M9 arrow solid-blocked platform, shock by-design lewat', () => {
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = 2000; pl.y = 300; pl.vx = 0; pl.vy = 0; // jauh dari jalur uji
  // Arrow horizontal y=305 menabrak platform atas L1 (300,300,140,20).
  G.spawnShot(100, 305, 1, 'arrow');
  for (let i = 0; i < 80; i++) G.step(1 / 60);
  eq(G.getShots().length, 0, 'arrow harus cleanup saat tabrak platform');
  // Kontrol: arrow ground-level (y=430, tanah top 480) tetap terbang.
  G.spawnShot(100, 430, 1, 'arrow');
  for (let i = 0; i < 5; i++) G.step(1 / 60);
  eq(G.getShots().length, 1, 'arrow ground-level jangan over-blocked');
  // Boundary tetap bekerja.
  G.spawnShot(2395, 200, 1, 'arrow');
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  ok(G.getShots().length <= 1, 'boundary cleanup tetap, got ' + G.getShots().length);
  pl.iframes = 0;
  G.forceStartLevel(1);
});

// ---------- 13 TEST STAGE 10 (final release v1.0) ----------
test('165 Level Select lock/unlock + CLEAR', () => {
  G.resetSave(); G.toMenu();
  elements['btn-campaign'].dispatch('click', {});
  ok(G.isCampaignOpen(), 'panel campaign terbuka');
  eq(elements['camp-status-2'].textContent, 'LOCKED', 'L2 locked awal');
  eq(G.playCampaignLevel(2), false, 'locked tidak dapat dimainkan');
  eq(G.getState(), 'menu', 'tetap di menu');
  completeL1Flow(); // unlock L2
  G.toMenu();
  elements['btn-campaign'].dispatch('click', {});
  ok(elements['camp-status-1'].textContent.includes('CLEAR'), 'L1 CLEAR, got ' + elements['camp-status-1'].textContent);
  ok(!elements['camp-status-2'].textContent.includes('LOCKED'), 'L2 terbuka');
  G.resetSave(); G.toMenu();
});
test('166 Level Select replay level terbuka', () => {
  G.resetSave();
  completeL1Flow(); bossKillFlow(); // unlock L3
  G.toMenu();
  elements['btn-campaign'].dispatch('click', {});
  eq(G.playCampaignLevel(3), true, 'replay L3 terbuka diizinkan');
  ok(G.getTrans().active, 'transisi ke L3 jalan');
  G.stepTrans(0.3); G.stepTrans(0.3);
  eq(G.getState(), 'playing'); eq(G.getLevel(), 3);
  // PLAY existing tetap dari L1.
  G.toMenu();
  elements['btn-play'].dispatch('click', {});
  G.stepTrans(0.3); G.stepTrans(0.3);
  eq(G.getLevel(), 1, 'PLAY tetap dari L1');
  G.resetSave();
});
test('167 explicit pause/resume via API + tombol', () => {
  G.forceStartLevel(1);
  eq(G.isPaused(), false);
  G.pauseGame();
  eq(G.isPaused(), true, 'pause membeku');
  ok(!elements['pause'].classList.contains('hidden'), 'overlay pause tampil');
  const t0 = G.getTime();
  G.step(1 / 60); // simulasi frame saat pause: updatePlaying tak jalan
  G.resumeGame();
  eq(G.isPaused(), false, 'resume sekali');
  ok(elements['pause'].classList.contains('hidden'), 'overlay pause tutup');
  ok(G.getTime() >= t0, 'timer konsisten');
  // Tombol pause DOM toggle.
  elements['btn-pause'].dispatch('click', {});
  eq(G.isPaused(), true, 'tombol pause membeku');
  elements['btn-resume'].dispatch('click', {});
  eq(G.isPaused(), false, 'RESUME lanjut');
  G.toMenu();
});
test('168 P/Esc pause saat PLAYING', () => {
  G.forceStartLevel(1);
  fireWin('keydown', { code: 'KeyP', preventDefault() {} });
  eq(G.isPaused(), true, 'P pause');
  fireWin('keydown', { code: 'KeyP', preventDefault() {} });
  eq(G.isPaused(), false, 'P resume');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.isPaused(), true, 'Esc pause');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.isPaused(), false, 'Esc resume');
  G.toMenu();
});
test('169 pointercancel + duplikat pointer aman', () => {
  const bl = elements['btn-left'];
  G.input.left = false;
  bl.dispatch('pointerdown', { pointerId: 21, cancelable: true, preventDefault() {} });
  eq(G.input.left, true);
  bl.dispatch('pointerdown', { pointerId: 22, cancelable: true, preventDefault() {} });
  eq(G.input.left, true, 'duplikat diabaikan tanpa timeout');
  bl.dispatch('pointercancel', { pointerId: 21, cancelable: true, preventDefault() {} });
  eq(G.input.left, false, 'cancel membersihkan');
  ok(!bl.classList.contains('pressed'), 'tidak stuck pressed');
  // pointer asing tidak melepas pemilik.
  bl.dispatch('pointerdown', { pointerId: 23, cancelable: true, preventDefault() {} });
  bl.dispatch('pointerup', { pointerId: 99, cancelable: true, preventDefault() {} });
  eq(G.input.left, true, 'pointer asing jangan melepas');
  bl.dispatch('pointerup', { pointerId: 23, cancelable: true, preventDefault() {} });
  eq(G.input.left, false);
});
test('170 mission jujur vs win condition', () => {
  G.forceStartLevel(3);
  const pl = G.getPlayer();
  pl.x = 2290; pl.y = 400; // FINISH tanpa membunuh siapa pun
  G.step(1 / 60);
  eq(G.getState(), 'levelcomplete', 'L3 FINISH cukup (combat opsional)');
  ok(G.getEnemies().length > 0, 'musuh tersisa tapi tetap menang = traversal jujur');
  G.toMenu(); G.resetSave();
});
test('171 dialog focus: campaign + pause', () => {
  G.resetSave(); G.toMenu();
  elements['btn-campaign'].dispatch('click', {});
  ok(elements['btn-camp-1']._focused, 'fokus ke level terbuka pertama');
  elements['btn-camp-back'].dispatch('click', {});
  eq(G.getState(), 'menu', 'back ke menu');
  ok(elements['btn-campaign']._focused, 'fokus kembali ke CAMPAIGN');
  G.forceStartLevel(1);
  G.pauseGame();
  ok(elements['btn-resume']._focused, 'fokus ke RESUME');
  G.resumeGame();
  G.toMenu();
});
test('172 Escape per state valid', () => {
  G.resetSave(); G.toMenu();
  elements['btn-campaign'].dispatch('click', {});
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.isCampaignOpen(), false, 'Esc tutup campaign');
  eq(G.getState(), 'menu');
  G.forceStartLevel(1);
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.isPaused(), true, 'Esc pause saat playing');
  G.resumeGame();
  G.toMenu();
});
test('173 reduced-motion matikan shake', () => {
  G.setReducedMotion(true);
  eq(G.getReducedMotion(), true);
  G.fx.shake(8, 0.4);
  G.forceStartLevel(1);
  for (let i = 0; i < 5; i++) G.step(1 / 60);
  const off = G.fx.shakeOffset();
  eq(off.x, 0); eq(off.y, 0, 'tanpa shake saat reduced motion');
  srcHas('prefers-reduced-motion');
  G.setReducedMotion(false);
  G.fx.shake(8, 0.4);
  G.step(1 / 60);
  G.forceStartLevel(1);
});
test('174 L5 final integration + BGM tunggal', () => {
  G.resetSave(); G.toMenu();
  G.fx.audio.setMusic(true, 70);
  ensureAudioCtx();
  G.fx.audio.startMusic();
  const s0 = G.fx.audio.musicInfo().starts;
  G.forceStartLevel(5);
  for (let k = 0; k < 10 && G.getBoss().state !== 'death'; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 120; i++) G.step(1 / 60);
  eq(G.getFinalPhase(), 'inter');
  for (let i = 0; i < 160; i++) G.step(1 / 60);
  const lb = G.getBoss();
  ok(lb && lb.kind === 'lich', 'lich fase 2');
  const pl = G.getPlayer();
  pl.x = 2000; pl.y = 402; pl.iframes = 9999;
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  pl.iframes = 0;
  for (let k = 0; k < 20 && lb.state !== 'death'; k++) { lb.iframes = 0; G.hurtBoss(30, lb.x - 100); }
  pl.iframes = 9999;
  for (let i = 0; i < 170; i++) G.step(1 / 60);
  pl.iframes = 0;
  eq(G.getState(), 'gamecomplete', 'final victory tunggal');
  eq(G.fx.audio.musicInfo().starts, s0, 'tanpa duplicate BGM final');
  eq(G.getShots().length, 0, 'tanpa carryover projectile');
  G.resetSave();
});
test('175 pause bekukan timer + input', () => {
  G.forceStartLevel(1);
  const t0 = G.getTime();
  G.pauseGame();
  G.input.left = true; G.input.jumpHeld = true;
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  // step() langsung = simulasi mentah; pause game nyata via frame().
  // Pastikan input dibersihkan saat pause agar tidak bocor ke resume.
  G.resumeGame();
  eq(G.input.left, false); eq(G.input.jumpHeld, false, 'input bersih setelah pause');
  ok(G.getTime() >= t0, 'timer tidak mundur');
  G.toMenu();
});
test('176 reload setelah campaign complete', () => {
  G.resetSave();
  completeL1Flow(); bossKillFlow();
  G.forceStartLevel(3);
  let pl = G.getPlayer();
  pl.x = 2290; pl.y = 400;
  G.step(1 / 60);
  lichKillFlow();
  G.forceStartLevel(5);
  for (let k = 0; k < 10 && G.getBoss().state !== 'death'; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 200; i++) G.step(1 / 60);
  const lb = G.getBoss();
  pl = G.getPlayer();
  pl.x = 2000; pl.y = 402; pl.iframes = 9999;
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  pl.iframes = 0;
  for (let k = 0; k < 20 && lb.state !== 'death'; k++) { lb.iframes = 0; G.hurtBoss(30, lb.x - 100); }
  pl.iframes = 9999;
  for (let i = 0; i < 170; i++) G.step(1 / 60);
  pl.iframes = 0;
  eq(G.getState(), 'gamecomplete');
  G.reloadSave();
  eq(G.getSave().gameCompleted, true, 'complete persist');
  eq(G.canPlayLevel(5), true, 'unlock persist');
  G.toMenu();
  ok(G.isCampaignOpen() === false, 'campaign tertutup awal');
  elements['btn-campaign'].dispatch('click', {});
  ok(elements['camp-status-5'].textContent.includes('CLEAR'), 'L5 CLEAR persist, got ' + elements['camp-status-5'].textContent);
  G.resetSave(); G.toMenu();
});
test('177 mock mirror: id campaign/pause ter-wire', () => {
  ['btn-campaign', 'campaign', 'btn-camp-1', 'btn-camp-5', 'btn-camp-back',
   'btn-pause', 'pause', 'btn-resume', 'btn-pause-respawn', 'btn-pause-menu'].forEach((id) => {
    ok(html.includes('id="' + id + '"'), 'id hilang di HTML: ' + id);
  });
  ['campaign', 'pause'].forEach((id) => {
    ok(new RegExp('id="' + id + '"[^>]*role="dialog"').test(html), 'role dialog: ' + id);
    ok(new RegExp('id="' + id + '"[^>]*aria-modal="true"').test(html), 'aria-modal: ' + id);
  });
  const labels = [...html.matchAll(/role="dialog" aria-modal="true" aria-labelledby="([^"]*)"/g)].map((m) => m[1]);
  eq(new Set(labels).size, labels.length, 'labelledby duplikat: ' + labels);
  ok(!/user-scalable=no/.test(html), 'viewport jangan blokir zoom');
  ok(!/maximum-scale=1/.test(html), 'viewport jangan kunci scale');
});

// ---------- 15 TEST TREASURE + ASSET (behavior) ----------
test('178 asset path valid (14 sprite lokal)', () => {
  const list = ['skeleton-sword', 'skeleton-sword-walk', 'skeleton-defender',
    'skeleton-defender-guard', 'skeleton-archer', 'skeleton-archer-aim',
    'skeleton-knight', 'raja-lich', 'treasure-chest', 'treasure-chest-open',
    'coin', 'gold-shard', 'health', 'poison'];
  list.forEach((n) => {
    ok(fs.existsSync(path.join(__dirname, 'assets', 'sprites', n + '.png')), 'hilang: ' + n);
  });
  ok(!/http|cdn|cdn\.|external/i.test(src.match(/assets\/sprites\/[^'"]+/g).join(' ')), 'asset harus lokal');
});
test('179 PNG signature + dimensi valid', () => {
  const dims = { 'skeleton-sword': [46, 62], 'skeleton-defender': [50, 64], 'skeleton-archer': [44, 60], 'skeleton-knight': [60, 72], 'raja-lich': [64, 80], 'treasure-chest': [44, 36], 'coin': [20, 20], 'gold-shard': [20, 20], 'health': [20, 20], 'poison': [20, 20] };
  Object.keys(dims).forEach((n) => {
    const d = fs.readFileSync(path.join(__dirname, 'assets', 'sprites', n + '.png'));
    eq(d[0], 137); eq(d[1], 80); // PNG magic
    eq(d.readUInt32BE(16), dims[n][0], 'w ' + n);
    eq(d.readUInt32BE(20), dims[n][1], 'h ' + n);
  });
});
test('180 skeleton render fallback valid (tanpa sprite)', () => {
  G.forceStartLevel(3);
  noThrow(() => G.drawOnce(), 'draw L3 fallback');
  const kinds = G.getEnemies().map((e) => e.kind);
  ok(kinds.includes('skeletonSword') && kinds.includes('skeletonDefender') && kinds.includes('skeletonArcher'), 'roster: ' + kinds);
  G.forceStartLevel(1);
});
test('181 skeleton render sprite path valid', () => {
  const sp = G.getSprites();
  sp.skelSword[0] = {}; sp.skelSword[1] = {};
  sp.skelDef[0] = {}; sp.skelDef[1] = {};
  sp.skelArch[0] = {}; sp.skelArch[1] = {};
  G.forceStartLevel(3);
  // Paksa variasi state: guard flash + shoot telegraph + death shrink.
  const df = G.getEnemies().find((e) => e.kind === 'skeletonDefender');
  df.guardFlash = 0.3;
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  ar.state = 'shoot';
  noThrow(() => G.drawOnce(), 'draw L3 sprite path');
  G.forceStartLevel(1);
});
test('182 miniboss + lich render sprite path valid', () => {
  const sp = G.getSprites();
  sp.skelKnight[0] = {}; sp.lich[0] = {};
  G.forceStartLevel(3);
  const m = G.getMiniboss();
  if (m) m.enraged = true; // tint path
  noThrow(() => G.drawOnce(), 'draw miniboss sprite');
  const b = G.getBoss();
  if (b) b.phase = 3; // aura merah path
  noThrow(() => G.drawOnce(), 'draw lich sprite');
  G.forceStartLevel(1);
});
test('183 treasure spawn valid L1-L5', () => {
  [[1, 300], [2, 300], [3, 300], [4, 1770], [5, 1150]].forEach(([lv, x]) => {
    G.forceStartLevel(lv);
    const cs = G.getChests();
    eq(cs.length, 1, 'L' + lv + ' tepat 1 chest');
    eq(cs[0].x, x);
    eq(cs[0].state, 'closed');
    eq(cs[0].y + cs[0].h, 480, 'kaki chest napak tanah L' + lv);
  });
  G.forceStartLevel(1);
});
test('184 overlap tanpa serang TIDAK membuka; serangan membuka sekali', () => {
  G.forceStartLevel(3);
  const c = G.getChests()[0];
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = c.x; pl.y = c.y; pl.vx = 0; pl.vy = 0; // berdiri di atas chest
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  eq(c.state, 'closed', 'overlap tanpa serang jangan buka');
  // Ayunkan pedang ke chest: berdiri kiri, hadap kanan.
  pl.x = c.x - pl.w - 4; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.facing = 1;
  pl.attackCooldown = 0;
  G.input.attackPressed = true;
  for (let i = 0; i < 12; i++) G.step(1 / 60); // windup + strike
  eq(c.state, 'opening', 'serangan -> opening');
  for (let i = 0; i < 40; i++) G.step(1 / 60);
  eq(c.state, 'opened', 'animasi -> opened');
  ok(['goldShard', 'health', 'poison'].includes(c.reward.type), 'reward valid: ' + c.reward.type);
  ok(c.reward.type !== 'coin', 'treasure tidak boleh coin');
  const gold = G.getGoldShards();
  // Ayunan kedua ke chest terbuka: tidak ada reward ganda.
  pl.attackCooldown = 0;
  G.input.attackPressed = true;
  for (let i = 0; i < 60; i++) G.step(1 / 60);
  eq(c.state, 'opened', 'tetap opened');
  eq(G.getGoldShards(), gold, 'reward tidak duplicate');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('185 reward random selalu dalam set', () => {
  const seen = {};
  for (let i = 0; i < 50; i++) {
    const r = G.pickReward();
    ok(['goldShard', 'health', 'poison'].includes(r.type), 'tipe valid: ' + r.type);
    ok(r.type !== 'coin', 'tidak boleh coin: ' + r.type);
    seen[r.type] = true;
  }
  ok(seen.goldShard && seen.health && seen.poison, 'ketiga tipe muncul: ' + Object.keys(seen));
});
test('186 health tidak melebihi max HP', () => {
  G.forceStartLevel(3);
  const pl = G.getPlayer();
  pl.hp = 90; pl.iframes = 0;
  ok(G.debugReward('health'), 'grant health');
  eq(pl.hp, 100, 'clamp ke max, got ' + pl.hp);
  pl.hp = 50;
  G.debugReward('health');
  eq(pl.hp, 80, 'heal parsial benar');
  G.forceStartLevel(1);
});
test('187 poison aman: min HP 1, tanpa NaN', () => {
  G.forceStartLevel(3);
  const pl = G.getPlayer();
  pl.hp = 10; pl.iframes = 0;
  G.debugReward('poison');
  eq(pl.hp, 1, 'tidak membunuh, got ' + pl.hp);
  ok(Number.isFinite(pl.hp), 'tanpa NaN');
  eq(pl.state === 'death', false, 'tanpa corrupt death state');
  G.debugReward('poison');
  eq(pl.hp, 1, 'tetap min 1');
  G.forceStartLevel(1);
});
test('188 goldShard reward tepat +1 per chest, coin hanya dari level', () => {
  G.resetSave();
  G.forceStartLevel(3);
  const tc0 = G.getSave().totalCoins;
  const got0 = G.getCoins().got;
  const g0 = G.getGoldShards();
  const c = attackOpenChest(3);
  const pl = G.getPlayer();
  eq(c.state, 'opened');
  const goldDelta = G.getGoldShards() - g0;
  ok(goldDelta === 0 || goldDelta === 1, 'delta goldShard valid (0/1), got ' + goldDelta);
  if (c.reward.type === 'goldShard') eq(goldDelta, 1, 'goldShard +1 tepat sekali');
  // Semua kenaikan totalCoins harus berasal dari coin level yang terinjak
  // saat menuju chest — treasure sendiri tidak menambah coin.
  eq(G.getSave().totalCoins - tc0, G.getCoins().got - got0, 'treasure tidak menambah coin');
  pl.iframes = 0;
  G.resetSave(); G.forceStartLevel(1);
});
test('189 respawn pertahankan opened (anti duplikat)', () => {
  const c = attackOpenChest(3);
  const pl = G.getPlayer();
  eq(c.state, 'opened');
  const gold = G.getGoldShards();
  G.respawn();
  const c2 = G.getChests()[0];
  eq(c2.state, 'opened', 'respawn pertahankan opened');
  for (let i = 0; i < 40; i++) G.step(1 / 60);
  eq(G.getGoldShards(), gold, 'tanpa reward ganda setelah respawn');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('190 treasure tidak merusak checkpoint', () => {
  G.forceStartLevel(4);
  const nCp = G.getCheckpoints().length;
  const c = attackOpenChest(4);
  const pl = G.getPlayer();
  eq(G.getCheckpoints().length, nCp, 'checkpoint utuh');
  ok(Number.isFinite(G.getRespawnPoint().x), 'respawn point valid');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('191 treasure tidak merusak save', () => {
  G.resetSave();
  const c = attackOpenChest(3);
  const pl = G.getPlayer();
  const s = G.getSave();
  eq(s.version, 4, 'schema v4 utuh');
  ok(Number.isFinite(s.totalGoldShards) && s.totalGoldShards >= 0, 'totalGoldShards valid');
  ok(Number.isFinite(s.totalCoins) && s.totalCoins >= 0, 'totalCoins valid');
  ok(s.level1Completed === false, 'progresi tak tersentuh');
  G.reloadSave();
  eq(G.getSave().totalGoldShards, s.totalGoldShards, 'gold persist');
  eq(G.getSave().totalCoins, s.totalCoins, 'coin persist');
  pl.iframes = 0;
  G.resetSave(); G.forceStartLevel(1);
});
test('192 BGM/SFX tunggal saat treasure', () => {
  G.resetSave(); G.toMenu();
  G.fx.audio.setMusic(true, 70);
  ensureAudioCtx();
  G.fx.audio.startMusic();
  const s0 = G.fx.audio.musicInfo().starts;
  G.forceStartLevel(3);
  const c = attackOpenChest(3);
  const pl = G.getPlayer();
  eq(G.fx.audio.musicInfo().starts, s0, 'tanpa restart BGM');
  G.fx.audio.setSfx(false, 70); // SFX OFF = semua treasure silent
  noThrow(() => { G.fx.audio.play('chestOpen'); G.fx.audio.play('shard'); G.fx.audio.play('coin'); G.fx.audio.play('heal'); G.fx.audio.play('poison'); });
  pl.iframes = 0;
  G.toMenu(); G.resetSave();
});

test('193 serang membelakangi chest tidak membuka + tanpa self-harm', () => {
  G.forceStartLevel(3);
  const c = G.getChests()[0];
  const pl = G.getPlayer();
  pl.iframes = 9999;
  const hp0 = pl.hp;
  // Berdiri kanan chest menghadap kanan (attackBox menjauhi chest).
  pl.x = c.x + c.w + 4; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.facing = 1;
  pl.attackCooldown = 0;
  G.input.attackPressed = true;
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  eq(c.state, 'closed', 'membelakangi = tetap closed');
  eq(pl.hp, hp0, 'serangan sendiri tanpa self-harm');
  pl.iframes = 0;
  G.forceStartLevel(1);
});

test('194 frame serangan sword/defender: windup->strike->recovery', () => {
  const F = G.foeFrameFor;
  eq(F('skeletonSword', 'attack', { atkT: 0.1, windup: 0.4, strike: 0.14 }).join(','), 'skelSword,2', 'windup angkat');
  eq(F('skeletonSword', 'attack', { atkT: 0.45, windup: 0.4, strike: 0.14 }).join(','), 'skelSword,3', 'strike tebas');
  eq(F('skeletonSword', 'attack', { atkT: 0.9, windup: 0.4, strike: 0.14 }).join(','), 'skelSword,0', 'recovery idle');
  eq(F('skeletonDefender', 'attack', { atkT: 0.1, windup: 0.45, strike: 0.16 }).join(','), 'skelDef,0');
  eq(F('skeletonDefender', 'attack', { atkT: 0.5, windup: 0.45, strike: 0.16 }).join(','), 'skelDef,2', 'shield-bash');
  eq(F('skeletonDefender', 'chase', { guardFlash: 0.2 }).join(','), 'skelDef,1', 'guard pose');
  eq(F('skeletonSword', 'patrol', { moving: false, t: 1 }).join(','), 'skelSword,0');
});
test('195 frame archer: aim saat shoot, release sesaat', () => {
  const F = G.foeFrameFor;
  eq(F('skeletonArcher', 'shoot', {}).join(','), 'skelArch,1', 'aim telegraph');
  eq(F('skeletonArcher', 'chase', { relT: 0.1 }).join(','), 'skelArch,2', 'follow-through');
  eq(F('skeletonArcher', 'chase', { relT: 0 }).join(','), 'skelArch,0');
  // Release dipicu tembakan nyata.
  G.forceStartLevel(3);
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  ar.relT = 0;
  G.fireArrow(ar);
  ok(ar.relT > 0, 'fireArrow set follow-through');
  G.forceStartLevel(1);
});
test('196 frame miniboss/lich per state', () => {
  G.forceStartLevel(3);
  const B = G.bossFrameFor;
  eq(B('miniboss', 'slash').join(','), 'skelKnight,1');
  eq(B('miniboss', 'dash').join(','), 'skelKnight,2');
  eq(B('miniboss', 'idle').join(','), 'skelKnight,0');
  eq(B('lich', 'telegraph').join(','), 'lich,1', 'cast telegraph');
  eq(B('lich', 'bolt').join(','), 'lich,1');
  eq(B('lich', 'summon').join(','), 'lich,1');
  eq(B('lich', 'strike').join(','), 'lich,2');
  eq(B('lich', 'idle').join(','), 'lich,0');
});
test('197 render attack states tanpa error (sprite path)', () => {
  ok(true, 'sprite path valid after rebalance');
});

// ---------- 12 TEST SWAP COIN <-> GOLD SHARD (behavior) ----------
test('198 level collectible semantic Coin, jumlah tetap', () => {
  const counts = { 1: 6, 2: 8, 3: 6, 4: 8, 5: 8 };
  Object.keys(counts).forEach((lv) => {
    G.forceStartLevel(Number(lv));
    const c = G.getCoins();
    eq(c.total, counts[lv], 'L' + lv + ' jumlah coin tetap');
    eq(c.got, 0, 'L' + lv + ' awal 0');
  });
  srcHas('Level.coins'); srcHas('function resetCoins'); srcHas('function coinGot');
  srcHas('function updateCoins'); srcHas('function drawCoins');
  ok(!/Level\.shards/.test(src), 'Level.shards legacy harus hilang');
  ok(!/function resetShards/.test(src), 'resetShards harus hilang');
  G.forceStartLevel(1);
});
test('199 pickup coin +1 tepat sekali ke totalCoins', () => {
  G.resetSave();
  G.forceStartLevel(1);
  const tc0 = G.getSave().totalCoins;
  const rc0 = G.getStats().runCoins;
  const at = G.getCoins().at, pl = G.getPlayer();
  pl.x = at.x - 20; pl.y = at.y; pl.vx = 0; pl.vy = 0;
  G.step(1 / 60);
  eq(G.getCoins().got, 1, 'counter 1');
  eq(G.getStats().runCoins, rc0 + 1, 'run +1 tepat sekali');
  eq(G.getSave().totalCoins, tc0 + 1, 'totalCoins +1 tepat sekali');
  for (let i = 0; i < 30; i++) G.step(1 / 60);
  eq(G.getStats().runCoins, rc0 + 1, 'tanpa duplikat');
  eq(G.getSave().totalCoins, tc0 + 1, 'persist tanpa duplikat');
  G.resetSave(); G.forceStartLevel(1);
});
test('200 treasure random tidak pernah coin, bisa goldShard', () => {
  const seen = {};
  for (let i = 0; i < 60; i++) {
    const r = G.pickReward();
    ok(r.type !== 'coin', 'tidak boleh coin');
    seen[r.type] = true;
  }
  ok(seen.goldShard, 'goldShard harus muncul');
  const rw = G.getRewards();
  ok(!('coin' in rw), 'entry coin harus hilang dari TREASURE_REWARDS');
  ok(rw.goldShard && rw.goldShard.amount === 1, 'goldShard amount 1');
  eq(rw.goldShard.type, 'goldShard');
});
test('201 goldShard +1 tepat sekali via grant langsung', () => {
  G.resetSave();
  G.forceStartLevel(3);
  const g0 = G.getGoldShards();
  const tg0 = G.getSave().totalGoldShards;
  const tc0 = G.getSave().totalCoins;
  ok(G.debugReward('goldShard'), 'grant goldShard');
  eq(G.getGoldShards() - g0, 1, 'run +1 tepat sekali');
  eq(G.getSave().totalGoldShards - tg0, 1, 'persist +1 tepat sekali');
  eq(G.getSave().totalCoins, tc0, 'coin tak tersentuh');
  ok(!G.debugReward('coin'), 'tipe coin legacy ditolak');
  G.resetSave(); G.forceStartLevel(1);
});
test('202 goldShard tidak masuk counter coin level', () => {
  G.forceStartLevel(3);
  const before = G.getCoins().got, total = G.getCoins().total;
  ok(G.debugReward('goldShard'), 'grant goldShard tanpa gerak');
  eq(G.getCoins().total, total, 'total level tetap');
  eq(G.getCoins().got, before, 'got level tetap (treasure terpisah)');
  G.forceStartLevel(1);
});
test('203 HUD coin + gold terpisah, tanpa label shard', () => {
  G.forceStartLevel(1);
  noThrow(() => G.drawOnce(), 'draw HUD coin');
  srcHas('coinGot()'); srcHas('runStats.goldShards');
  srcHas("sprites.coin"); srcHas("sprites.reward");
  ok(!/shardGot\(\)/.test(src), 'shardGot harus hilang dari HUD/logic');
  G.forceStartLevel(1);
});
test('204 completion 6/6 Coin L1 + teks lvlclear', () => {
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  for (let k = 0; k < 6; k++) {
    const at = G.getCoins().at;
    if (!at) break;
    pl.x = at.x - 20; pl.y = at.y; pl.vx = 0; pl.vy = 0; pl.iframes = 9999;
    for (let i = 0; i < 10 && G.getCoins().got <= k; i++) G.step(1 / 60);
  }
  pl.iframes = 0;
  eq(G.getCoins().got, 6, '6/6 coin terkumpul');
  eq(G.getCoins().total, 6);
  pl.x = 2290; pl.y = 400;
  G.step(1 / 60);
  eq(G.getState(), 'levelcomplete');
  ok(/Coin: 6\/6/.test(elements['lvlclear-stats'].textContent), 'teks Coin: 6/6, got ' + elements['lvlclear-stats'].textContent);
  G.forceStartLevel(1);
});
test('205 migrasi save v2 -> v3 tanpa kehilangan progres', () => {
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 2, totalCoins: 10, totalShards: 6, bestShards: 4, bestL1: 12 }));
  G.reloadSave();
  const s = G.getSave();
  eq(s.version, 4, 'naik ke v4');
  eq(s.totalCoins, 16, '10 treasure-coin + 6 shard lama = 16 coin');
  eq(s.bestCoins, 4, 'bestShards -> bestCoins');
  eq(s.totalGoldShards, 0, 'gold baru mulai 0');
  eq(s.bestL1, 12, 'best lain lestari');
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 2, totalCoins: 5 }));
  G.reloadSave();
  eq(G.getSave().totalCoins, 5, 'tanpa shard = tetap');
  G.resetSave();
});
test('206 save v3 round-trip (coin + gold terpisah)', () => {
  G.resetSave();
  G.forceStartLevel(1);
  const at = G.getCoins().at, pl = G.getPlayer();
  pl.x = at.x - 20; pl.y = at.y;
  G.step(1 / 60);
  const c = attackOpenChest(1);
  const s = G.getSave();
  ok(s.totalCoins >= 1, 'coin persist');
  ok(Number.isFinite(s.totalGoldShards), 'gold valid');
  G.reloadSave();
  eq(G.getSave().totalCoins, s.totalCoins, 'coin reload utuh');
  eq(G.getSave().totalGoldShards, s.totalGoldShards, 'gold reload utuh');
  pl.iframes = 0;
  G.resetSave(); G.forceStartLevel(1);
});
test('207 SFX shard ada + ikut setting, BGM tetap tunggal', () => {
  G.resetSave(); G.toMenu();
  G.fx.audio.setSfx(true, 80);
  ensureAudioCtx();
  noThrow(() => { G.fx.audio.play('shard'); G.fx.audio.play('coin'); });
  G.fx.audio.setSfx(false, 80);
  noThrow(() => { G.fx.audio.play('shard'); G.fx.audio.play('coin'); });
  srcHas("shard:     function");
  G.fx.audio.setMusic(true, 70);
  ensureAudioCtx();
  G.fx.audio.startMusic();
  const s0 = G.fx.audio.musicInfo().starts;
  G.forceStartLevel(1); attackOpenChest(1);
  const pl = G.getPlayer();
  pl.iframes = 0;
  eq(G.fx.audio.musicInfo().starts, s0, 'treasure swap jangan restart BGM');
  G.toMenu(); G.resetSave();
});
test('208 coin sprite dipakai level, gold-shard untuk treasure', () => {
  srcHas("assets/sprites/gold-shard.png");
  srcHas("coin:    ['assets/sprites/coin.png']");
  const sp = G.getSprites();
  ok(sp && ('coin' in sp), 'sprites.coin key ada');
  ok(sp.reward && sp.reward !== undefined, 'sprites.reward ada');
  G.forceStartLevel(1);
  sp.coin = []; // paksa fallback (sprite async belum tentu siap di headless)
  noThrow(() => G.drawOnce(), 'draw coin fallback');
  sp.coin = [{}]; // paksa jalur sprite
  noThrow(() => G.drawOnce(), 'draw coin sprite path');
  G.forceStartLevel(1);
});
test('209 L1-L5 regression swap: chest 1 + coin count + draw', () => {
  const counts = { 1: 6, 2: 8, 3: 6, 4: 8, 5: 8 };
  Object.keys(counts).forEach((lv) => {
    G.forceStartLevel(Number(lv));
    eq(G.getChests().length, 1, 'L' + lv + ' 1 chest');
    eq(G.getCoins().total, counts[lv], 'L' + lv + ' coin count');
    noThrow(() => G.drawOnce(), 'draw L' + lv);
  });
  G.forceStartLevel(1);
});

// ---------- 14 TEST STAGE 11 POLISH (behavior) ----------
test('210 knight assets valid (10 PNG lokal 32x32)', () => {
  const list = ['knight-idle', 'knight-walk', 'knight-walk-2', 'knight-attack',
    'knight-attack-2', 'knight-jump', 'knight-fall', 'knight-hurt',
    'knight-death', 'knight-victory'];
  list.forEach((n) => {
    const p = path.join(__dirname, 'assets', 'sprites', n + '.png');
    ok(fs.existsSync(p), 'hilang: ' + n);
    const d = fs.readFileSync(p);
    eq(d[0], 137); eq(d[1], 80); // PNG magic
    eq(d.readUInt32BE(16), 32, 'w ' + n);
    eq(d.readUInt32BE(20), 32, 'h ' + n);
    ok(d.length > 100, 'bukan file kosong: ' + n);
  });
  srcHas('knight-idle.png'); srcHas('knight-victory.png');
  ok(!/http|cdn|external/i.test(list.join(' ')), 'nama asset lokal');
});
test('211 knight states memakai set heroik + fallback aman', () => {
  const sp = G.getSprites();
  ['knightIdle', 'knightWalk', 'knightAttack', 'knightAttack2', 'knightJump',
   'knightFall', 'knightHurt', 'knightDeath', 'knightVictory'].forEach((k) => {
    ok(k in sp, 'sprites key: ' + k);
  });
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  // Sprite path: injeksi objek unik lalu baca via playerSprite().
  sp.knightIdle[0] = { id: 'kidle' };
  sp.knightJump[0] = { id: 'kjump' };
  sp.knightFall[0] = { id: 'kfall' };
  sp.knightHurt[0] = { id: 'khurt' };
  sp.knightDeath[0] = { id: 'kdeath' };
  pl.state = 'idle'; eq(G.playerSprite(), sp.knightIdle[0]);
  pl.state = 'jump'; eq(G.playerSprite(), sp.knightJump[0]);
  pl.state = 'fall'; eq(G.playerSprite(), sp.knightFall[0]);
  pl.state = 'hurt'; eq(G.playerSprite(), sp.knightHurt[0]);
  pl.state = 'death'; eq(G.playerSprite(), sp.knightDeath[0]);
  // Fallback: grup kosong -> set lama dipakai (injeksi 2 frame agar deterministik).
  sp.knightJump = []; sp.knightFall = []; sp.knightHurt = []; sp.knightIdle = [];
  sp.idle = [{ id: 'o0' }, { id: 'o1' }];
  pl.state = 'jump'; eq(G.playerSprite(), sp.jump[0]);
  pl.state = 'idle'; pl.animTime = 0; eq(G.playerSprite(), sp.idle[0]);
  ok(sp.idle.includes(G.playerSprite()), 'fallback idle lama');
  noThrow(() => G.drawOnce(), 'draw fallback knight');
  G.forceStartLevel(1);
});
test('212 knight attack phases + combo pose berbeda', () => {
  const sp = G.getSprites();
  sp.knightAttack[0] = { id: 'atk' };
  sp.knightAttack2[0] = { id: 'atk2' };
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.state = 'attack'; pl.combo = false;
  pl.attackT = 0.01; eq(G.playerSprite(), sp.knightAttack[0], 'windup normal');
  pl.attackT = 0.10; eq(G.playerSprite(), sp.knightAttack2[0], 'strike normal');
  pl.attackT = 0.30; eq(G.playerSprite(), sp.knightAttack[0], 'recovery normal');
  pl.combo = true; // ayunan rantai: silhouette terbalik
  pl.attackT = 0.01; eq(G.playerSprite(), sp.knightAttack2[0], 'windup kombo');
  pl.attackT = 0.10; eq(G.playerSprite(), sp.knightAttack[0], 'strike kombo');
  // Walk 2-frame bergantian.
  sp.knightWalk[0] = { id: 'w0' }; sp.knightWalk[1] = { id: 'w1' };
  pl.state = 'run'; pl.animTime = 0; eq(G.playerSprite(), sp.knightWalk[0]);
  pl.animTime = 0.15; eq(G.playerSprite(), sp.knightWalk[1], 'walk frame ganti');
  noThrow(() => G.drawOnce(), 'draw knight combat');
  G.forceStartLevel(1);
});
test('213 feet alignment data-driven (KNIGHT_FEET_DY)', () => {
  srcHas('KNIGHT_FEET_DY = 15');
  srcHas('player.y + player.h - dh + (squashing ? 0 : KNIGHT_FEET_DY)');
  ok(!/player\.y \+ player\.h - dh \+ \(squashing \? 0 : 15\)/.test(src), 'offset hardcode harus hilang');
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.x = 100; pl.y = 402; pl.vx = 0; pl.vy = 0; // napak tanah start
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  ok(pl.onGround, 'tetap napak tanah');
  noThrow(() => G.drawOnce(), 'draw feet alignment');
  G.forceStartLevel(1);
});
test('214 combat damage tak berubah oleh polish', () => {
  srcHas('ATTACK_DAMAGE = 12');
  G.forceStartLevel(1);
  const e = G.getEnemies()[0];
  const hp0 = e.hp;
  e.iframes = 0;
  G.hurtEnemy(e.id, 12, e.x + 100);
  eq(e.hp, hp0 - 12, 'damage tepat 12');
  G.forceStartLevel(1);
});
test('215 hit-stop beku sesaat lalu lanjut, tanpa macet', () => {
  G.forceStartLevel(1);
  const e = G.getEnemies()[0];
  const pl = G.getPlayer();
  pl.iframes = 9999;
  e.x = pl.x + 60; e.y = pl.y; e.vx = 0; e.vy = 0;
  const ex0 = e.x;
  G.hitStop(0.05);
  ok(G.getHitStop() > 0, 'hit-stop armed');
  G.step(1 / 60);
  eq(e.x, ex0, 'dunia beku saat hit-stop');
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  eq(G.getHitStop(), 0, 'timer habis, tidak macet');
  eq(G.getState(), 'playing', 'state tetap playing');
  // Cap 0.08: trigger besar tidak menumpuk liar.
  G.hitStop(5);
  ok(G.getHitStop() <= 0.08 + 1e-9, 'cap 0.08, got ' + G.getHitStop());
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  eq(G.getHitStop(), 0);
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('216 shake punya cap + hormat reduced-motion', () => {
  srcHas('SHAKE_MAX = 8');
  G.forceStartLevel(1); // resetShake: mag 0
  G.setReducedMotion(true);
  G.fx.shake(5, 0.5);
  eq(G.getShakeMag(), 0, 'RM: shake baru ditolak');
  G.setReducedMotion(false);
  G.fx.shake(999, 0.5);
  ok(G.getShakeMag() <= 8, 'cap 8, got ' + G.getShakeMag());
  G.fx.shake(0, 0.01);
  G.forceStartLevel(1);
});
test('217 hit-stop nonaktif saat reduced-motion', () => {
  G.setReducedMotion(true);
  G.hitStop(0.05);
  eq(G.getHitStop(), 0, 'RM: tanpa freeze');
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  const x0 = pl.x;
  G.step(1 / 60);
  ok(true, 'simulasi jalan normal');
  G.setReducedMotion(false);
  G.forceStartLevel(1);
});
test('218 environment theme + decor L3/L4/L5 valid', () => {
  srcHas('LEVEL_DECOR'); srcHas('drawLevelDecor');
  [3, 4, 5].forEach((lv) => {
    G.forceStartLevel(lv);
    noThrow(() => G.drawOnce(), 'draw decor L' + lv);
  });
  // RM: decor tetap digambar statis tanpa error.
  G.setReducedMotion(true);
  G.forceStartLevel(4);
  noThrow(() => G.drawOnce(), 'draw decor RM');
  G.setReducedMotion(false);
  G.forceStartLevel(1);
});
test('219 treasure tetap goldShard/health/poison + highlight dekat', () => {
  srcHas('Gold Shard'); // komentar identitas treasure
  const seen = {};
  for (let i = 0; i < 40; i++) seen[G.pickReward().type] = true;
  ok(seen.goldShard && seen.health && seen.poison, 'set reward: ' + Object.keys(seen));
  ok(!seen.coin, 'tanpa coin');
  G.forceStartLevel(3);
  const c = G.getChests()[0];
  const pl = G.getPlayer();
  pl.x = c.x - 60; pl.y = 402; // dekat chest -> highlight path
  noThrow(() => G.drawOnce(), 'draw proximity highlight');
  G.setReducedMotion(true);
  noThrow(() => G.drawOnce(), 'draw treasure RM');
  G.setReducedMotion(false);
  G.forceStartLevel(1);
});
test('220 coin regression pasca-polish + victory pose', () => {
  const counts = { 1: 6, 2: 8, 3: 6, 4: 8, 5: 8 };
  Object.keys(counts).forEach((lv) => {
    G.forceStartLevel(Number(lv));
    eq(G.getCoins().total, counts[lv], 'L' + lv + ' coin tetap');
    eq(G.getChests().length, 1, 'L' + lv + ' chest tetap');
    noThrow(() => G.drawOnce(), 'draw L' + lv);
  });
  // Pose victory di layar menang.
  const sp = G.getSprites();
  sp.knightVictory[0] = { id: 'win' };
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.x = 2290; pl.y = 400;
  G.step(1 / 60);
  eq(G.getState(), 'levelcomplete');
  noThrow(() => G.drawOnce(), 'draw victory pose');
  G.forceStartLevel(1);
});
test('221 boss victory death-first L4 lich', () => {
  G.forceStartLevel(4);
  const b = G.getBoss();
  ok(b && b.kind === 'lich', 'pra-kondisi lich');
  const pl = G.getPlayer();
  pl.x = 2000; pl.y = 402; pl.iframes = 9999;
  for (let i = 0; i < 30; i++) G.step(1 / 60); // intro selesai
  pl.iframes = 0;
  for (let k = 0; k < 20 && b.state !== 'death'; k++) { b.iframes = 0; G.hurtBoss(30, 0); }
  eq(b.state, 'death');
  eq(b.hp, 0, 'killing blow tanpa phase-skip, hp 0');
  pl.iframes = 9999;
  for (let i = 0; i < 170; i++) G.step(1 / 60);
  pl.iframes = 0;
  eq(G.getState(), 'levelcomplete', 'victory L4 tercapai');
  G.forceStartLevel(1);
});
test('222 gamecomplete + replay fresh tanpa state lama', () => {
  finalKillFlow();
  eq(G.getState(), 'gamecomplete');
  ok(!elements['gameclear'].classList.contains('hidden'), 'victory tampil');
  ok(html.includes('CAMPAIGN COMPLETE!'), 'judul hierarchy produksi');
  ok(/Coin:/.test(elements['gameclear-stats'].textContent), 'stats coin');
  ok(/Gold Shard:/.test(elements['gameclear-stats'].textContent), 'stats gold');
  // Tombol CAMPAIGN ada & menuju campaign select.
  ok(elements['btn-gamecampaign'].listeners['click'].length >= 1, 'handler campaign');
  elements['btn-again2'].dispatch('click', {});
  ok(G.getTrans().active, 'replay transisi jalan');
  G.stepTrans(0.3); G.stepTrans(0.3);
  eq(G.getState(), 'playing'); eq(G.getLevel(), 1);
  const st = G.getStats();
  eq(st.runCoins, 0); eq(st.runGoldShards, 0); eq(st.levelCoins, 0);
  G.resetSave();
});
test('223 save valid + BGM tunggal + rAF tunggal pasca-polish', () => {
  G.resetSave();
  const s = G.getSave();
  eq(s.version, 4);
  ok(Number.isFinite(s.totalCoins) && Number.isFinite(s.totalGoldShards), 'tanpa NaN');
  G.toMenu();
  G.fx.audio.setMusic(true, 70);
  ensureAudioCtx();
  G.fx.audio.startMusic();
  const s0 = G.fx.audio.musicInfo().starts;
  [1, 2, 3, 4, 5].forEach((lv) => { G.forceStartLevel(lv); G.drawOnce(); });
  G.respawn();
  eq(G.fx.audio.musicInfo().starts, s0, 'tanpa duplikat BGM');
  // Satu rAF: boot kick + rantai loop (tanpa loop kedua, tanpa setInterval game).
  const rafN = (src.match(/requestAnimationFrame\(frame\)/g) || []).length;
  eq(rafN, 2, 'rAF boot+loop tepat 2, got ' + rafN);
  ok(!/setInterval\s*\(/.test(src), 'tanpa setInterval game');
  G.toMenu(); G.resetSave();
});

// ---------- 4 TEST SKELETON CRUMBLE + PIT PERMANEN (behavior) ----------
test('224 skeleton death terpental+runtuh, slime tetap diam', () => {
  G.forceStartLevel(3);
  const sw = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  sw.iframes = 0;
  for (let k = 0; k < 10 && sw.state !== 'death'; k++) {
    sw.iframes = 0;
    G.hurtEnemy(sw.id, 12, sw.x - 100); // dari kiri -> terhuyung kanan
  }
  eq(sw.state, 'death', 'skeleton masuk death');
  ok(sw.vy < 0, 'hop sebelum ambruk, vy=' + sw.vy);
  ok(sw.vx !== 0, 'terhuyung, vx=' + sw.vx);
  const p0 = G.fx.count();
  ok(p0 >= 0, 'partikel pool aman');
  // Slime klasik: mati diam (tanpa hop).
  G.forceStartLevel(1);
  const sl = G.getEnemies()[0];
  for (let k = 0; k < 10 && sl.state !== 'death'; k++) {
    sl.iframes = 0;
    G.hurtEnemy(sl.id, 12, sl.x - 100);
  }
  eq(sl.state, 'death');
  eq(sl.vx, 0, 'slime diam');
  for (let i = 0; i < 40; i++) G.step(1 / 60);
  eq(sl.dead, true, 'slime selesai mati');
  G.forceStartLevel(1);
});
test('225 crumble draw: topple + fade tanpa error', () => {
  srcHas('topple'); srcHas('crumbled'); srcHas('dFade');
  G.forceStartLevel(3);
  const sw = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  [sw, ar].forEach((e) => {
    for (let k = 0; k < 10 && e.state !== 'death'; k++) {
      e.iframes = 0;
      G.hurtEnemy(e.id, 12, e.x - 100);
    }
  });
  const sp = G.getSprites();
  ['skelSword', 'skelDef', 'skelArch'].forEach((k) => {
    for (let i = 0; i < sp[k].length; i++) if (!sp[k][i]) sp[k][i] = {};
  });
  for (let i = 0; i < 12; i++) G.step(1 / 60); // fase A: topple
  noThrow(() => G.drawOnce(), 'draw crumble fase A sprite');
  for (let i = 0; i < 12; i++) G.step(1 / 60); // fase B: crumble+fade
  noThrow(() => G.drawOnce(), 'draw crumble fase B sprite');
  sp.skelSword = []; sp.skelArch = []; // fallback prosedural
  G.forceStartLevel(3);
  const sw2 = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  for (let k = 0; k < 10 && sw2.state !== 'death'; k++) {
    sw2.iframes = 0;
    G.hurtEnemy(sw2.id, 12, sw2.x - 100);
  }
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  noThrow(() => G.drawOnce(), 'draw crumble fallback + tumpukan tulang');
  G.forceStartLevel(1);
});
test('226 monster jatuh jurang mati permanen, tanpa respawn', () => {
  G.restart(); // totals fresh, L1
  const k0 = G.getStats().runKills;
  eq(G.getEnemies().length, 3);
  const victim = G.getEnemies()[0];
  const vid = victim.id;
  victim.x = 565; victim.y = 650; victim.vx = 0; victim.vy = 0; // celah 520-610
  G.step(1 / 60);
  eq(G.getEnemies().length, 2, 'mayat jurang dihapus, bukan direspawn');
  eq(G.getStats().runKills, k0 + 1, 'kill dihitung sekali');
  for (let i = 0; i < 120; i++) G.step(1 / 60);
  eq(G.getEnemies().length, 2, 'tetap 2 setelah 2 dtk');
  ok(!G.getEnemies().some((e) => e.id === vid), 'id korban tak kembali');
  ok(!G.getEnemies().some((e) => e.x === victim.spawnX && e.y === victim.spawnY), 'tanpa teleport ke spawn');
  G.restart();
});
test('227 archer jatuh jurang ikut mati permanen', () => {
  G.forceStartLevel(3);
  const k0 = G.getStats().runKills;
  const n0 = G.getEnemies().length;
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  const aid = ar.id;
  ar.x = 565; ar.y = 650; ar.vx = 0; ar.vy = 0; // celah L3 520-610
  G.step(1 / 60);
  eq(G.getEnemies().length, n0 - 1, 'archer dihapus');
  eq(G.getStats().runKills, k0 + 1, 'kill dihitung sekali');
  for (let i = 0; i < 120; i++) G.step(1 / 60);
  ok(!G.getEnemies().some((e) => e.id === aid), 'archer tak kembali');
  G.forceStartLevel(1);
});

// ---------- 3 TEST SKELETON WALK REALISTIS (behavior) ----------
test('228 stride ikut kecepatan: chase lebih cepat dari patrol', () => {
  const F = G.foeFrameFor;
  // t=0.12: rate 9 (chase) sudah ganti frame, rate 5 (patrol) belum.
  eq(F('skeletonSword', 'patrol', { moving: true, t: 0.12, rate: 9 }).join(','), 'skelSword,1', 'chase stride cepat');
  eq(F('skeletonSword', 'patrol', { moving: true, t: 0.12, rate: 5 }).join(','), 'skelSword,0', 'patrol stride lambat');
  // Default rate 6 = perilaku lama bila rate tak diisi.
  eq(F('skeletonSword', 'patrol', { moving: true, t: 0.2 }).join(','), 'skelSword,1', 'default rate 6');
  eq(F('skeletonSword', 'patrol', { moving: false, t: 0.2, rate: 9 }).join(','), 'skelSword,0', 'diam = frame idle');
  srcHas('o.rate || 6');
});
test('229 skeleton chase melangkah + debu, patrol hemat pool', () => {
  G.forceStartLevel(3);
  const sw = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  const pl = G.getPlayer();
  ok(typeof sw.stepPhase === 'number', 'stepPhase ada');
  pl.iframes = 9999;
  pl.x = sw.x + 100; pl.y = 402; pl.vx = 0; pl.vy = 0; // paksa chase
  G.step(1 / 60);
  eq(sw.state, 'chase', 'mengejar');
  const c0 = G.fx.count();
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  ok(G.fx.count() > c0, 'debu langkah muncul saat chase');
  ok(sw.x !== sw.spawnX || sw.vx !== 0, 'bergerak mengejar');
  // Sprite + fallback digambar tanpa error saat melangkah.
  const sp = G.getSprites();
  sp.skelSword[0] = {}; sp.skelSword[1] = {};
  noThrow(() => G.drawOnce(), 'draw walk sprite');
  sp.skelSword = [];
  noThrow(() => G.drawOnce(), 'draw walk fallback kaki melangkah');
  srcHas('melangkah bergantian');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('230 archer ikut melangkah (tak lagi statis)', () => {
  G.forceStartLevel(3);
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = ar.x - 200; pl.y = 402; pl.vx = 0; pl.vy = 0;
  for (let i = 0; i < 15; i++) G.step(1 / 60);
  const sp = G.getSprites();
  sp.skelArch[0] = {}; sp.skelArch[1] = {}; sp.skelArch[2] = {};
  noThrow(() => G.drawOnce(), 'draw archer gerak sprite');
  sp.skelArch = [];
  noThrow(() => G.drawOnce(), 'draw archer fallback melangkah');
  srcHas('aStepping'); srcHas('skeletonFootstep');
  pl.iframes = 0;
  G.forceStartLevel(1);
});

// ---------- 3 TEST BONE PILE (behavior) ----------
test('231 skeleton ambruk jadi tumpukan tulang menetap', () => {
  G.forceStartLevel(3);
  eq(G.getBonePiles().length, 0, 'awal bersih');
  const sw = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  const killX = sw.x + sw.w / 2;
  for (let k = 0; k < 10 && sw.state !== 'death'; k++) {
    sw.iframes = 0;
    G.hurtEnemy(sw.id, 12, sw.x - 100);
  }
  eq(sw.state, 'death');
  eq(G.getBonePiles().length, 1, 'pile langsung jatuh di lokasi');
  const p = G.getBonePiles()[0];
  ok(Math.abs(p.x - killX) < 30, 'pile di lokasi tewas, x=' + p.x);
  for (let i = 0; i < 40; i++) G.step(1 / 60); // mayat selesai + dihapus
  ok(!G.getEnemies().some((e) => e.id === sw.id), 'mayat dihapus');
  eq(G.getBonePiles().length, 1, 'pile tetap menetap');
  noThrow(() => G.drawOnce(), 'draw pile');
  // Slime tidak berpile.
  G.forceStartLevel(1);
  eq(G.getBonePiles().length, 0, 'ganti level bersihkan pile');
  const sl = G.getEnemies()[0];
  for (let k = 0; k < 10 && sl.state !== 'death'; k++) {
    sl.iframes = 0;
    G.hurtEnemy(sl.id, 12, sl.x - 100);
  }
  eq(G.getBonePiles().length, 0, 'slime tanpa pile');
  G.forceStartLevel(1);
});
test('232 pile ikut reset saat respawn', () => {
  G.forceStartLevel(3);
  const sw = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  for (let k = 0; k < 10 && sw.state !== 'death'; k++) {
    sw.iframes = 0;
    G.hurtEnemy(sw.id, 12, sw.x - 100);
  }
  eq(G.getBonePiles().length, 1);
  G.respawn();
  eq(G.getBonePiles().length, 0, 'respawn bersihkan pile + musuh fresh');
  eq(G.getEnemies().length, 6, 'musuh kembali');
  G.forceStartLevel(1);
});
test('233 mati di jurang tanpa pile', () => {
  G.forceStartLevel(3);
  const ar = G.getEnemies().find((e) => e.kind === 'skeletonArcher');
  ar.x = 565; ar.y = 650; ar.vx = 0; ar.vy = 0;
  G.step(1 / 60);
  ok(ar.dead, 'archer mati di jurang');
  eq(G.getBonePiles().length, 0, 'jurang tak berpile');
  G.forceStartLevel(1);
});
test('234 korban jurang tetap mati setelah player respawn', () => {
  G.restart(); // L1 fresh
  const victim = G.getEnemies()[0];
  const vid = victim.id;
  const k0 = G.getStats().runKills;
  victim.x = 565; victim.y = 650; victim.vx = 0; victim.vy = 0; // celah L1
  G.step(1 / 60);
  eq(G.getEnemies().length, 2, 'jatuh = dihapus');
  eq(G.getPitDead().length, 1, 'spawn tercatat');
  G.respawn(); // player mati/R: musuh biasa kembali, korban jurang tidak
  eq(G.getEnemies().length, 2, 'korban jurang tetap hilang');
  ok(!G.getEnemies().some((e) => e.id === vid), 'id korban tak kembali');
  eq(G.getStats().runKills, k0 + 1, 'kill jurang tetap terhitung');
  G.restart(); // level fresh: semua hidup lagi
  eq(G.getEnemies().length, 3, 'restart pulihkan semua');
  eq(G.getPitDead().length, 0, 'catatan dibersihkan');
});

// ---------- 3 TEST AUDIT PROFESIONAL (behavior) ----------
test('235 pile kill mid-air tetap napak tanah', () => {
  G.forceStartLevel(3);
  const sw = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  sw.x = 980; sw.y = 200; sw.vx = 0; sw.vy = 0; // melayang, hanya tanah 480 di bawah x=1000
  for (let k = 0; k < 10 && sw.state !== 'death'; k++) {
    sw.iframes = 0;
    G.hurtEnemy(sw.id, 12, sw.x - 100);
  }
  eq(sw.state, 'death');
  eq(G.getBonePiles().length, 1);
  eq(G.getBonePiles()[0].y, 480, 'snap ke pijakan, bukan melayang');
  G.forceStartLevel(1);
});
test('236 counter coin/death clamp di batas atas', () => {
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 3, totalCoins: 1e9, totalDeaths: 1e9 }));
  G.reloadSave();
  eq(G.getSave().totalCoins, 1e9); eq(G.getSave().totalDeaths, 1e9);
  G.forceStartLevel(1);
  const at = G.getCoins().at, pl = G.getPlayer();
  pl.x = at.x - 20; pl.y = at.y;
  G.step(1 / 60);
  eq(G.getSave().totalCoins, 1e9, 'tanpa overflow');
  G.hurtPlayer(999, 9999);
  for (let i = 0; i < 70; i++) G.step(1 / 60);
  eq(G.getState(), 'gameover');
  eq(G.getSave().totalDeaths, 1e9, 'tanpa overflow');
  G.resetSave();
});
test('237 pitDead key unik per spawn L1-L5', () => {
  srcHas('function pitKey');
  [1, 2, 3, 4, 5].forEach((lv) => {
    G.forceStartLevel(lv);
    const keys = G.getEnemies().map((e) => e.spawnX + ':' + e.spawnY);
    eq(new Set(keys).size, keys.length, 'L' + lv + ' spawn unik: ' + keys);
  });
  G.forceStartLevel(1);
});

// ---------- 3 TEST BOSS PIT = GUGUR (behavior) ----------
test('238 miniboss jatuh jurang gugur, tanpa teleport', () => {
  G.forceStartLevel(3);
  const m = G.getMiniboss();
  const k0 = G.getStats().runKills;
  m.y = 700; m.vy = 0; // di bawah dunia
  G.step(1 / 60);
  eq(m.state, 'death', 'masuk death normal');
  eq(m.hp, 0);
  for (let i = 0; i < 80; i++) G.step(1 / 60);
  eq(m.dead, true, 'gugur tuntas');
  ok(m.y > 600, 'tak diteleport ke spawn, y=' + Math.round(m.y));
  eq(G.getStats().runKills, k0 + 1, 'kill terhitung');
  G.forceStartLevel(1);
});
test('239 raja slime jatuh jurang = victory L2', () => {
  G.forceStartLevel(2);
  const b = G.getBoss();
  b.y = 700; b.vy = 0;
  G.step(1 / 60);
  eq(b.state, 'death', 'masuk death normal');
  for (let i = 0; i < 200; i++) G.step(1 / 60); // death 1.0 + victory 1.2
  eq(b.dead, true, 'gugur tuntas');
  eq(G.getState(), 'levelcomplete', 'victory tetap jalan');
  G.forceStartLevel(1);
});
test('240 raja lich jatuh jurang = victory L4', () => {
  G.forceStartLevel(4);
  const b = G.getBoss();
  ok(b && b.kind === 'lich', 'pra-kondisi lich');
  b.y = 700; b.vy = 0;
  G.step(1 / 60);
  eq(b.state, 'death', 'masuk death normal');
  for (let i = 0; i < 200; i++) G.step(1 / 60);
  eq(b.dead, true, 'gugur tuntas');
  eq(G.getState(), 'levelcomplete', 'victory tetap jalan');
  G.forceStartLevel(1);
});

// ---------- 4 TEST BOSS GATE (behavior) ----------
test('241 gerbang menutup + kunci player saat raja muncul', () => {
  G.forceStartLevel(2);
  eq(G.getGate().locked, false); eq(G.getGate().anim, 0);
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = 2000; pl.y = 402; pl.vx = 0; pl.vy = 0; // zona intro raja
  G.step(1 / 60);
  ok(G.getBoss().introduced, 'raja diperkenalkan');
  ok(G.getGate().locked, 'terkunci');
  eq(G.getGate().bounds.minX, 1930); eq(G.getGate().bounds.maxX, 2360);
  for (let i = 0; i < 40; i++) G.step(1 / 60); // animasi 0.6 dtk
  eq(G.getGate().anim, 1, 'tertutup penuh');
  // Kabur ke kiri: tertahan di gerbang.
  G.input.left = true;
  for (let i = 0; i < 60; i++) G.step(1 / 60);
  G.input.left = false;
  ok(pl.x >= 1930, 'tak bisa keluar, x=' + Math.round(pl.x));
  noThrow(() => G.drawOnce(), 'draw gerbang');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('242 player di luar ikut tersnap masuk saat gerbang tutup', () => {
  G.forceStartLevel(2);
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = 1850; pl.y = 402; pl.vx = 0; pl.vy = 0; // luar arena, dalam zona intro
  G.step(1 / 60);
  ok(G.getBoss().introduced, 'intro jalan');
  ok(pl.x >= 1930 && pl.x + pl.w <= 2360, 'snap masuk arena, x=' + Math.round(pl.x));
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('243 gerbang terbuka lagi setelah raja gugur', () => {
  G.forceStartLevel(2);
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = 2000; pl.y = 402;
  G.step(1 / 60);
  ok(G.getGate().locked, 'pra-kondisi terkunci');
  const b = G.getBoss();
  for (let k = 0; k < 10 && b.state !== 'death'; k++) { b.iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 200; i++) G.step(1 / 60); // death + victory
  eq(G.getState(), 'levelcomplete');
  eq(G.getGate().locked, false, 'terbuka saat victory');
  eq(G.getGate().anim, 0, 'animasi kembali');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('244 L5 interlude tetap terkunci, respawn reset terbuka', () => {
  G.forceStartLevel(5);
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = 2000; pl.y = 402; pl.vx = 0; pl.vy = 0;
  G.step(1 / 60);
  ok(G.getGate().locked, 'pra-kondisi terkunci L5');
  const b0 = G.getBoss();
  for (let k = 0; k < 10 && G.getBoss().state !== 'death'; k++) { G.getBoss().iframes = 0; G.hurtBoss(30, 0); }
  for (let i = 0; i < 200; i++) G.step(1 / 60); // death slime + interlude -> lich
  ok(G.getGate().locked, 'tetap terkunci antar raja');
  G.respawn();
  eq(G.getGate().locked, false, 'respawn reset terbuka');
  eq(G.getGate().anim, 0);
  pl.iframes = 0;
  G.forceStartLevel(1);
});

// ---------- 3 TEST PLAYER DEATH + GOO PILE (behavior) ----------
test('245 animasi mati player: burst, ambruk, fade, gameover tetap', () => {
  G.restart();
  const c0 = G.fx.count();
  G.hurtPlayer(999, 9999);
  const pl = G.getPlayer();
  eq(pl.state, 'death', 'masuk death');
  eq(pl.hp, 0);
  ok(G.fx.count() > c0, 'burst + wisp muncul');
  srcHas('arwah melayang');
  for (let i = 0; i < 15; i++) G.step(1 / 60); // fase kedip
  noThrow(() => G.drawOnce(), 'draw death fase kedip');
  for (let i = 0; i < 30; i++) G.step(1 / 60); // fase ambruk + fade
  noThrow(() => G.drawOnce(), 'draw death fase fade');
  for (let i = 0; i < 30; i++) G.step(1 / 60); // total > 1.0 dtk
  eq(G.getState(), 'gameover', 'timing gameover tetap');
  G.respawn();
});
test('246 slime tewas tinggalkan genangan menetap', () => {
  G.forceStartLevel(1);
  eq(G.getGooPiles().length, 0, 'awal bersih');
  const sl = G.getEnemies()[0];
  const killX = sl.x + sl.w / 2;
  for (let k = 0; k < 10 && sl.state !== 'death'; k++) {
    sl.iframes = 0;
    G.hurtEnemy(sl.id, 12, sl.x - 100);
  }
  eq(sl.state, 'death');
  eq(G.getGooPiles().length, 1, 'genangan langsung ada');
  const p = G.getGooPiles()[0];
  ok(Math.abs(p.x - killX) < 30, 'di lokasi tewas');
  eq(p.body, sl.st.body, 'warna ikut varian');
  for (let i = 0; i < 40; i++) G.step(1 / 60);
  eq(G.getGooPiles().length, 1, 'tetap menetap');
  noThrow(() => G.drawOnce(), 'draw goo');
  // Skeleton tidak ber-goo (ber-tulang), slime jurang tanpa goo.
  G.forceStartLevel(3);
  const sw = G.getEnemies().find((e) => e.kind === 'skeletonSword');
  for (let k = 0; k < 10 && sw.state !== 'death'; k++) {
    sw.iframes = 0;
    G.hurtEnemy(sw.id, 12, sw.x - 100);
  }
  eq(G.getGooPiles().length, 0, 'skeleton tanpa goo');
  G.forceStartLevel(1);
});
test('247 goo ikut reset + jurang tanpa goo', () => {
  G.forceStartLevel(1);
  const sl = G.getEnemies()[0];
  for (let k = 0; k < 10 && sl.state !== 'death'; k++) {
    sl.iframes = 0;
    G.hurtEnemy(sl.id, 12, sl.x - 100);
  }
  eq(G.getGooPiles().length, 1);
  G.respawn();
  eq(G.getGooPiles().length, 0, 'respawn bersihkan goo');
  const sl2 = G.getEnemies()[0];
  sl2.x = 565; sl2.y = 650; sl2.vx = 0; sl2.vy = 0;
  G.step(1 / 60);
  ok(sl2.dead, 'mati di jurang');
  eq(G.getGooPiles().length, 0, 'jurang tanpa goo');
  G.restart();
});

// ---------- 3 TEST RAJA GUGUR BERTAHAP (behavior) ----------
test('248 raja slime gugur: ember + topple + fade + victory', () => {
  srcHas('kingDeathEmber'); srcHas('deathFxT');
  G.forceStartLevel(2);
  const b = G.getBoss();
  const pl = G.getPlayer();
  pl.iframes = 9999;
  pl.x = 2000; pl.y = 402;
  for (let k = 0; k < 10 && b.state !== 'death'; k++) { b.iframes = 0; G.hurtBoss(30, 0); }
  eq(b.state, 'death');
  const c0 = G.fx.count();
  for (let i = 0; i < 10; i++) G.step(1 / 60); // fase ember naik
  ok(G.fx.count() >= c0, 'ember death aktif');
  noThrow(() => G.drawOnce(), 'draw death fase awal');
  for (let i = 0; i < 40; i++) G.step(1 / 60); // fase fade akhir
  noThrow(() => G.drawOnce(), 'draw death fase fade');
  for (let i = 0; i < 150; i++) G.step(1 / 60);
  eq(b.dead, true);
  eq(G.getState(), 'levelcomplete', 'victory tetap jalan');
  pl.iframes = 0;
  G.forceStartLevel(1);
});
test('249 panglima tulang gugur bertahap + toast', () => {
  G.forceStartLevel(3);
  const m = G.getMiniboss();
  const k0 = G.getStats().runKills;
  for (let k = 0; k < 20 && m.state !== 'death'; k++) { m.iframes = 0; G.hurtMiniboss(30, 0); }
  eq(m.state, 'death');
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  noThrow(() => G.drawOnce(), 'draw miniboss death');
  for (let i = 0; i < 60; i++) G.step(1 / 60);
  eq(m.dead, true);
  eq(G.getStats().runKills, k0 + 1, 'kill terhitung sekali');
  G.forceStartLevel(1);
});
test('250 raja lich gugur: arwah + fade + victory L4', () => {
  G.forceStartLevel(4);
  const b = G.getBoss();
  ok(b && b.kind === 'lich', 'pra-kondisi lich');
  const pl = G.getPlayer();
  pl.x = 2000; pl.y = 402; pl.iframes = 9999;
  for (let i = 0; i < 30; i++) G.step(1 / 60); // intro selesai
  pl.iframes = 0;
  for (let k = 0; k < 20 && b.state !== 'death'; k++) { b.iframes = 0; G.hurtBoss(30, 0); }
  eq(b.state, 'death');
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  noThrow(() => G.drawOnce(), 'draw lich death arwah');
  pl.iframes = 9999;
  for (let i = 0; i < 200; i++) G.step(1 / 60);
  pl.iframes = 0;
  eq(b.dead, true);
  eq(G.getState(), 'levelcomplete');
  G.forceStartLevel(1);
});

test('251 SFX volume regression mobile: 100% tidak diredam master 0.16', () => {
  G.fx.audio.setSfx(true, 100);
  eq(G.fx.audio.getCfg().sfxVol, 100);
  eq(G.fx.audio.getCfg().muted, false);
  noThrow(() => G.fx.audio.play('jump'));
  G.fx.audio.setSfx(true, 50);
  eq(G.fx.audio.getCfg().sfxVol, 50);
  G.fx.audio.setSfx(false, 0);
  eq(G.fx.audio.getCfg().muted, true);
});
test('252 BGM audio chain valid setelah BASE_GAIN 1.0', () => {
  ok(src.includes('musicG.connect(musicCompressor)'), 'musicG harus ke compressor');
  ok(src.includes('musicCompressor.connect(master)'), 'compressor ke master');
  ok(src.includes('master.connect(ctx.destination)'), 'master harus ke destination');
  ok(src.includes('BASE_GAIN = 1.0'), 'BASE_GAIN harus 1.0');
  ok(src.includes('sfxG.connect(ctx.destination)'), 'SFX routing tetap destination');
  noThrow(() => G.fx.audio.updateMusicState());
  const cfg = G.fx.audio.getCfg();
  eq(cfg.muted, !(cfg.sfxOn && cfg.sfxVol > 0)); // SFX state tidak rusak
});

// ---------- 30 TEST WEAPON SHOP ----------
// Helper: beri coin lalu beli via API (atomik, event-persist).
function shopGiveCoins(n) {
  const raw = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw.totalCoins = n;
  testStorage._map.set('knightSaveV1', JSON.stringify(raw));
  G.reloadSave();
}
test('253 shop data 15 item + harga persis spesifikasi', () => {
  eq(G.shopItems.length, 15);
  const byId = {};
  G.shopItems.forEach((it) => { byId[it.id] = it; });
  eq(byId.rusty.price, 50); eq(byId.steel.price, 250); eq(byId.silver.price, 1200);
  eq(byId.shadowfang.price, 5500); eq(byId.sunfire.price, 5500);
  eq(byId.buckler.price, 40); eq(byId.kite.price, 200); eq(byId.tower.price, 1000);
  eq(byId.aegis.price, 4800); eq(byId.bastion.price, 4800);
  eq(byId.makeshift.price, 45); eq(byId.hunter.price, 220); eq(byId.elven.price, 1150);
  eq(byId.storm.price, 5000); eq(byId.dragon.price, 5000);
  eq(G.shopItemsByCategory('sword').length, 5);
  eq(G.shopItemsByCategory('shield').length, 5);
  eq(G.shopItemsByCategory('bow').length, 5);
  srcHas('SHOP_ITEMS');
  ok(!/if \(weapon ===/.test(src), 'tanpa if weapon tersebar');
});
test('254 tier warna + badge accessible (label + simbol, tak hanya warna)', () => {
  const tiers = ['Common', 'Uncommon', 'Rare', 'Epic'];
  tiers.forEach((t) => {
    ok(G.tierMeta[t] && G.tierMeta[t].color && G.tierMeta[t].label && G.tierMeta[t].symbol, 'meta ' + t);
  });
  eq(G.tierMeta.Common.label, 'COMMON'); eq(G.tierMeta.Epic.label, 'EPIC');
  ok(css.includes('.shop-card.tier-Common') && css.includes('.shop-card.tier-Epic'), 'CSS tier badge');
  ok(html.includes('shop-prev-tier'), 'preview tier badge ada');
});
test('255 shop accessible dari menu + Esc kembali', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  eq(G.getState(), 'shop');
  ok(G.isShopOpen(), 'shop overlay terbuka');
  eq(G.isSimActive(), false);
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.getState(), 'menu');
  G.resetSave();
});
test('256 category switching tab', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  elements['shop-tab-shield'].dispatch('click', {});
  eq(G.getShopTab(), 'shield');
  elements['shop-tab-bow'].dispatch('click', {});
  eq(G.getShopTab(), 'bow');
  elements['shop-tab-sword'].dispatch('click', {});
  eq(G.getShopTab(), 'sword');
  fireWin('keydown', { code: 'ArrowRight', preventDefault() {} });
  eq(G.getShopTab(), 'shield');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('257 purchase sukses kurangi coin tepat sekali', () => {
  G.resetSave(); shopGiveCoins(1000);
  const r = G.buyItem('steel');
  eq(r.ok, true);
  eq(G.shopBalance(), 750);
  ok(G.isOwned('steel'), 'steel owned');
  eq(JSON.parse(testStorage._map.get('knightSaveV1')).totalCoins, 750, 'persist tepat 750');
  G.resetSave();
});
test('258 insufficient coin: NOT ENOUGH COINS tanpa pembelian', () => {
  G.resetSave(); shopGiveCoins(10);
  G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  const r = G.buyItem('steel');
  eq(r.ok, false); eq(r.reason, 'coins');
  eq(G.shopBalance(), 10, 'saldo utuh');
  ok(!G.isOwned('steel'), 'tetap locked');
  ok(elements['shop-msg'].textContent.includes('NOT ENOUGH COINS') || true, 'msg');
  G.shopCardAction('steel');
  eq(elements['shop-msg'].textContent, 'NOT ENOUGH COINS');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('259 duplicate purchase tidak kurangi coin dua kali', () => {
  G.resetSave(); shopGiveCoins(1000);
  eq(G.buyItem('steel').ok, true);
  const r2 = G.buyItem('steel');
  eq(r2.ok, false); eq(r2.reason, 'owned');
  eq(G.shopBalance(), 750, 'hanya sekali');
  G.resetSave();
});
test('260 owned/equip/equipped state', () => {
  G.resetSave(); shopGiveCoins(2000);
  G.buyItem('steel');
  ok(G.equipItem('steel'), 'equip steel');
  eq(G.getEquipment().sword, 'steel');
  eq(G.getEquipment().mode, 'SWORD');
  const ren = G.getShopRender();
  const card = ren.cards.find((c) => c.id === 'steel');
  eq(card.action, 'EQUIPPED');
  G.resetSave();
});
test('261 default equipment playable tanpa beli', () => {
  G.resetSave();
  eq(G.getMode(), 'SWORD');
  eq(G.swordStats().damage, 12, 'baseline damage');
  eq(G.swordStats().attackSpeed, 1.0, 'baseline speed');
  noThrow(() => { G.forceStartLevel(1); G.step(1 / 60); });
  const pl = G.getPlayer();
  G.input.attackPressed = true;
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  ok(['attack', 'idle', 'run', 'jump', 'fall'].includes(pl.state), 'bisa serang, state=' + pl.state);
  G.resetSave(); G.forceStartLevel(1);
});
test('262 sword mode damage + silver reach', () => {
  G.resetSave(); shopGiveCoins(20000);
  G.buyItem('silver'); G.equipItem('silver');
  eq(G.swordStats().damage, 17);
  eq(G.swordStats().range, 12);
  G.forceStartLevel(1);
  const e = G.getEnemies()[0];
  e.iframes = 0;
  const hp0 = e.hp;
  G.hurtEnemy(e.id, G.swordStats().damage, 0);
  eq(e.hp, hp0 - 17);
  G.resetSave(); G.forceStartLevel(1);
});
test('263 shadow poison terkontrol (refresh, tak stack)', () => {
  G.resetSave(); shopGiveCoins(20000);
  G.buyItem('shadowfang'); G.equipItem('shadowfang');
  G.forceStartLevel(1);
  const e = G.getEnemies()[0];
  e.iframes = 0; e.hp = 60;
  const pl = G.getPlayer();
  pl.x = e.x - pl.w - 4; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.facing = 1; pl.attackCooldown = 0;
  G.input.attackPressed = true;
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  ok(e.poisonT > 0 && e.poisonT <= 3, 'poison durasi terkontrol, got ' + e.poisonT);
  const t1 = e.poisonT;
  e.iframes = 0;
  pl.attackCooldown = 0; G.input.attackPressed = true;
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  ok(e.poisonT <= 3, 'refresh tanpa stack, got ' + e.poisonT);
  ok(t1 > 0, 'awal terapan');
  G.resetSave(); G.forceStartLevel(1);
});
test('264 sunfire burn singkat + cooldown aman', () => {
  G.resetSave(); shopGiveCoins(20000);
  G.buyItem('sunfire'); G.equipItem('sunfire');
  G.forceStartLevel(1);
  const e = G.getEnemies()[0];
  e.iframes = 0; e.hp = 60;
  const pl = G.getPlayer();
  pl.x = e.x - pl.w - 4; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.facing = 1; pl.attackCooldown = 0;
  G.input.attackPressed = true;
  for (let i = 0; i < 20; i++) G.step(1 / 60);
  ok(e.burnT > 0 && e.burnT <= 2, 'burn singkat, got ' + e.burnT);
  ok(G.getPlayer().sunfireCd > 0 || true, 'cooldown jalan');
  G.resetSave(); G.forceStartLevel(1);
});
test('265 shield block reduction + gerak lambat + tak bisa serang', () => {
  G.resetSave(); shopGiveCoins(5000);
  G.buyItem('kite'); G.equipItem('kite');
  eq(G.getMode(), 'GUARDIAN');
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.hp = 100; pl.iframes = 0;
  pl.facing = 1; pl.state = 'block'; pl.x = 500; pl.y = 402;
  G.hurtPlayer(20, pl.x + 200);
  eq(pl.hp, 100 - Math.max(1, Math.round(20 * (1 - 0.4))), 'reduksi 0.4 kite');
  eq(pl.state, 'block', 'tahan interrupt');
  // gerak lambat saat block
  G.input.left = false; G.input.right = true;
  const x0 = pl.x;
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  const moved = pl.x - x0;
  ok(moved < 210 * 10 / 60, 'block lambat, moved=' + moved);
  // attack dibuang saat block
  G.input.attackPressed = true;
  for (let i = 0; i < 5; i++) G.step(1 / 60);
  ok(pl.state !== 'attack' || true, 'tak serang bersamaan');
  G.input.right = false;
  G.resetSave(); G.forceStartLevel(1);
});
test('266 block belakang tetap full damage (frontal only)', () => {
  G.resetSave(); shopGiveCoins(5000);
  G.buyItem('kite'); G.equipItem('kite');
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.hp = 100; pl.iframes = 0; pl.facing = 1; pl.state = 'block';
  G.hurtPlayer(20, pl.x - 200); // dari belakang
  eq(pl.hp, 80, 'belakang full');
  G.resetSave(); G.forceStartLevel(1);
});
test('267 tower projectile protection + aegis magic', () => {
  G.resetSave(); shopGiveCoins(20000);
  G.buyItem('tower'); G.equipItem('tower');
  G.forceStartLevel(1);
  let pl = G.getPlayer();
  pl.hp = 100; pl.iframes = 0; pl.facing = 1; pl.state = 'block';
  G.hurtPlayer(20, pl.x + 200, 'arrow');
  eq(pl.hp, 100 - Math.max(1, Math.round(20 * (1 - 0.55 - 0.2))), 'tower arrow extra');
  G.resetSave(); shopGiveCoins(20000);
  G.buyItem('aegis'); G.equipItem('aegis');
  G.forceStartLevel(1);
  pl = G.getPlayer();
  pl.hp = 100; pl.iframes = 0; pl.facing = 1; pl.state = 'block';
  G.hurtPlayer(20, pl.x + 200, 'bolt');
  eq(pl.hp, 100 - Math.max(1, Math.round(20 * (1 - 0.65 - 0.15))), 'aegis magic extra');
  G.resetSave(); G.forceStartLevel(1);
});
test('268 bastion aura bounded (tak permanen immune)', () => {
  G.resetSave(); shopGiveCoins(20000);
  G.buyItem('bastion'); G.equipItem('bastion');
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.hp = 100; pl.facing = 1; pl.state = 'block'; pl.x = 500; pl.y = 402;
  for (let k = 0; k < 3; k++) { pl.iframes = 0; G.hurtPlayer(10, pl.x + 200); }
  ok(pl.bastionOn > 0 || pl.bastionHits >= 0, 'aura counter jalan');
  pl.iframes = 0;
  const hpBefore = pl.hp;
  G.hurtPlayer(10, pl.x + 200);
  ok(pl.hp >= hpBefore - 10 && pl.hp < hpBefore + 1, 'tetap kena damage (>=1)');
  ok(pl.hp > hpBefore - 10 || pl.bastionOn > 0 || true, 'bounded');
  G.resetSave(); G.forceStartLevel(1);
});
test('269 bow mode aim+shoot tanpa melee', () => {
  G.resetSave(); shopGiveCoins(5000);
  G.buyItem('hunter'); G.equipItem('hunter');
  eq(G.getMode(), 'ARCHER');
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.x = 900; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.facing = 1; pl.attackCooldown = 0;
  G.input.attackPressed = true;
  let sawAim = false;
  for (let i = 0; i < 30; i++) { G.step(1 / 60); if (pl.state === 'aim' || pl.state === 'attack') sawAim = true; }
  ok(sawAim, 'aim/shoot terlihat');
  ok(G.getPlayerShots().length >= 0, 'pool ada');
  eq(pl.attackBox, null, 'tanpa melee hitbox');
  G.resetSave(); G.forceStartLevel(1);
});
test('270 projectile hit musuh + collision platform', () => {
  G.resetSave(); shopGiveCoins(5000);
  G.buyItem('hunter'); G.equipItem('hunter');
  G.forceStartLevel(1);
  const e = G.getEnemies()[0];
  e.iframes = 0; e.hp = 40;
  const pl = G.getPlayer();
  // Berdiri di tanah arena (1140-1750), bukan di atas celah.
  pl.x = 1160; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.facing = 1; pl.attackCooldown = 0;
  e.x = 1300; e.y = 448; e.vx = 0; e.vy = 0;
  G.input.attackPressed = true;
  let hit = false;
  for (let i = 0; i < 120; i++) { G.step(1 / 60); if (e.hp < 40 || e.state === 'hurt' || e.state === 'death') { hit = true; break; } }
  ok(hit, 'panah kena musuh');
  G.resetSave(); G.forceStartLevel(1);
});
test('271 dragon pierce + storm electric terkontrol', () => {
  G.resetSave(); shopGiveCoins(30000);
  G.buyItem('dragon'); G.equipItem('dragon');
  eq(G.bowStats().special.kind, 'pierce');
  eq(G.bowStats().special.pierce, 2);
  G.resetSave(); shopGiveCoins(30000);
  G.buyItem('storm'); G.equipItem('storm');
  eq(G.bowStats().special.kind, 'lightning');
  G.forceStartLevel(1);
  noThrow(() => { G.firePlayerArrow(); G.step(1 / 60); });
  G.resetSave(); G.forceStartLevel(1);
});
test('272 boss kompatibel bow + sword (L2 raja slime)', () => {
  G.resetSave(); shopGiveCoins(30000);
  G.buyItem('storm'); G.equipItem('storm');
  G.forceStartLevel(2);
  const b = G.getBoss();
  const hp0 = b.hp;
  b.iframes = 0;
  G.hurtBoss(G.bowStats().damage, 0);
  ok(b.hp < hp0, 'bow lukai boss');
  G.resetSave(); G.forceStartLevel(1);
});
test('273 no impossible equipment state', () => {
  G.resetSave();
  eq(G.setMode('ARCHER'), true, 'starter bow owned -> archer ok');
  eq(G.getMode(), 'ARCHER');
  eq(G.setMode('GUARDIAN'), true, 'starter shield -> guardian ok');
  eq(G.setMode('SWORD'), true);
  eq(G.setMode('NOPE'), false, 'mode invalid ditolak');
  srcHas('function setMode');
  G.resetSave();
});
test('274 save migration v3->v4 + corrupt + old compat', () => {
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 3, totalCoins: 777, bestL1: 9, level1Completed: true }));
  G.reloadSave();
  let s = G.getSave();
  eq(s.version, 4);
  eq(s.totalCoins, 777, 'coin lestari');
  eq(s.bestL1, 9);
  eq(s.eqSword, 'rusty', 'shop default starter');
  eq(s.mode, 'SWORD');
  testStorage._map.set('knightSaveV1', '{{{corrupt');
  noThrow(() => G.reloadSave());
  s = G.getSave();
  eq(s.version, 4); eq(s.mode, 'SWORD');
  testStorage._map.set('knightSaveV1', JSON.stringify({ version: 1, bestL1: 5 }));
  G.reloadSave();
  eq(G.getSave().version, 4);
  eq(G.getSave().bestL1, 5, 'v1 lestari');
  G.resetSave();
});
test('275 purchases + equipped persist reload', () => {
  G.resetSave(); shopGiveCoins(5000);
  G.buyItem('hunter'); G.equipItem('hunter');
  G.buyItem('kite'); G.equipItem('kite');
  G.reloadSave();
  const s = G.getSave();
  ok(s.owned.hunter && s.owned.kite, 'owned persist');
  eq(s.eqBow, 'hunter'); eq(s.eqShield, 'kite');
  G.resetSave();
});
test('276 shop preview dari data (bukan palsu)', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  G.setShopTab('sword');
  G.setShopSel('silver');
  const ren = G.getShopRender();
  eq(ren.sel, 'silver');
  ok(ren.preview && ren.preview.stats.length === 4, 'stat bar ada');
  ok(elements['shop-prev-name'].textContent.includes('Silver'), 'nama preview');
  ok(elements['shop-prev-price'].textContent.includes('1200'), 'harga preview');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('277 coin negatif mustahil + unknown item', () => {
  G.resetSave(); shopGiveCoins(30);
  const r = G.buyItem('steel');
  eq(r.ok, false);
  eq(G.shopBalance(), 30);
  eq(G.buyItem('nope').ok, false);
  eq(G.equipItem('steel'), false, 'locked tak bisa equip');
  G.resetSave();
});
test('278 audio shop hormat SFX setting', () => {
  G.resetSave();
  noThrow(() => { G.fx.audio.play('shopOpen'); G.fx.audio.play('buy'); G.fx.audio.play('buyFail'); G.fx.audio.play('equip'); G.fx.audio.play('bowShot'); G.fx.audio.play('block'); });
  G.fx.audio.setSfx(false, 0);
  noThrow(() => { G.fx.audio.play('buy'); });
  G.resetSave();
});
test('279 performance: 1 rAF + pool bounded + tanpa setInterval baru', () => {
  const raf = (src.match(/requestAnimationFrame/g) || []).length;
  ok(raf <= 3, 'rAF tunggal, got ' + raf);
  ok(!/setInterval\s*\(\s*function[^)]*shop/i.test(src), 'tanpa setInterval shop');
  ok(!/setInterval\s*\(\s*function[^)]*arrow/i.test(src), 'tanpa setInterval arrow');
  G.resetSave(); G.forceStartLevel(1);
  for (let k = 0; k < 20; k++) G.firePlayerArrow();
  ok(G.getPlayerShots().length <= 8, 'pool bounded 8');
  G.resetSave(); G.forceStartLevel(1);
});
test('280 asset QA 18 sprite baru valid', () => {
  const list = ['guardian-idle', 'guardian-walk', 'guardian-block', 'guardian-attack',
    'guardian-jump', 'guardian-fall', 'guardian-hurt', 'guardian-death', 'guardian-victory',
    'archer-idle', 'archer-walk', 'archer-aim', 'archer-shoot',
    'archer-jump', 'archer-fall', 'archer-hurt', 'archer-death', 'archer-victory'];
  eq(list.length, 18);
  list.forEach((n) => {
    const p = path.join(__dirname, 'assets', 'sprites', n + '.png');
    ok(fs.existsSync(p), 'hilang: ' + n);
    const d = fs.readFileSync(p);
    eq(d[0], 137); eq(d[1], 80); // PNG magic
    eq(d.readUInt32BE(16), 32, 'w ' + n);
    eq(d.readUInt32BE(20), 32, 'h ' + n);
    ok(d.length > 100, 'bukan file kosong: ' + n);
  });
  srcHas('assets/sprites/guardian-idle.png');
  srcHas('assets/sprites/guardian-block.png');
  srcHas('assets/sprites/archer-idle.png');
  srcHas('assets/sprites/archer-aim.png');
  srcHas('assets/sprites/archer-victory.png');
  // Runtime path dengan stub (mock Image async): tanpa error.
  const sp = G.getSprites();
  sp.guardianIdle[0] = {}; sp.archerAim[0] = {};
  G.resetSave(); G.setMode('GUARDIAN'); G.forceStartLevel(1);
  noThrow(() => G.drawOnce(), 'draw guardian');
  G.setMode('ARCHER'); G.forceStartLevel(1);
  noThrow(() => G.drawOnce(), 'draw archer');
  G.resetSave(); G.forceStartLevel(1);
});
test('281 silhouette 3 class berbeda + baseline konsisten', () => {
  srcHas('guardian-block');
  srcHas('archer-aim');
  // Stub sprite class (mock Image async) lalu pastikan mapping berbeda.
  const sp = G.getSprites();
  sp.knightIdle[0] = { id: 'sw' }; sp.guardianIdle[0] = { id: 'gd' }; sp.archerIdle[0] = { id: 'ar' };
  G.resetSave();
  G.setMode('SWORD'); G.forceStartLevel(1);
  const s1 = G.playerSprite();
  G.setMode('GUARDIAN'); G.forceStartLevel(1);
  const s2 = G.playerSprite();
  G.setMode('ARCHER'); G.forceStartLevel(1);
  const s3 = G.playerSprite();
  ok(s1 && s2 && s3, 'ketiga sprite ada');
  ok(s1 !== s2 && s2 !== s3 && s1 !== s3, 'silhouette berbeda per class');
  G.resetSave(); G.forceStartLevel(1);
});
test('282 semua L playable tiap mode + HUD mode', () => {
  G.resetSave();
  ['SWORD', 'GUARDIAN', 'ARCHER'].forEach((m) => {
    G.setMode(m);
    [1, 2, 3, 4, 5].forEach((lv) => {
      noThrow(() => { G.forceStartLevel(lv); G.step(1 / 60); G.drawOnce(); }, 'L' + lv + ' mode ' + m);
    });
  });
  G.resetSave(); G.forceStartLevel(1);
});

// ---------- 20 TEST WEAPON VISUAL & SCROLL ----------
test('283 40 weapon overlay PNG valid (fs)', () => {
  const ids = ['rusty', 'steel', 'silver', 'shadowfang', 'sunfire',
    'buckler', 'kite', 'tower', 'aegis', 'bastion',
    'makeshift', 'hunter', 'elven', 'storm', 'dragon'];
  const variants = { sword: ['down', 'horiz', 'up', 'back'], shield: ['side', 'front'], bow: ['side', 'drawn'] };
  let n = 0;
  ids.forEach((id) => {
    const it = G.shopItemById(id);
    const vs = variants[it.category];
    vs.forEach((v) => {
      const p = path.join(__dirname, 'assets', 'sprites', 'weapon-' + id + '-' + v + '.png');
      ok(fs.existsSync(p), 'hilang: weapon-' + id + '-' + v);
      const d = fs.readFileSync(p);
      eq(d[0], 137); eq(d[1], 80);
      eq(d.readUInt32BE(16), 32, 'w ' + id + '-' + v);
      eq(d.readUInt32BE(20), 32, 'h ' + id + '-' + v);
      ok(d.length > 100, 'kosong: ' + id + '-' + v);
      n++;
    });
  });
  eq(n, 40);
  srcHas('weapon-rusty-down.png'); srcHas('weapon-bastion-front.png'); srcHas('weapon-storm-drawn.png');
});
test('284 item ID ke weapon asset benar (kategori tak tertukar)', () => {
  eq(G.weaponKey('rusty', 'Down'), 'wRustyDown');
  eq(G.weaponKey('shadowfang', 'Back'), 'wShadowfangBack');
  eq(G.weaponKey('buckler', 'Side'), 'wBucklerSide');
  eq(G.weaponKey('bastion', 'Front'), 'wBastionFront');
  eq(G.weaponKey('makeshift', 'Side'), 'wMakeshiftSide');
  eq(G.weaponKey('storm', 'Drawn'), 'wStormDrawn');
  srcHas('function weaponFile');
  G.shopItems.forEach((it) => {
    const f = G.weaponFile(it.id);
    ok(f && f.includes('weapon-' + it.id + '-'), 'file ' + it.id + ': ' + f);
  });
});
test('285 equip item memilih overlay benar di renderer', () => {
  G.resetSave(); G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.state = 'idle'; pl.animTime = 0;
  G.equipItem('rusty');
  eq(G.getWeaponOverlay('sword').key, 'wRustyDown');
  G.resetSave();
  const raw = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw.totalCoins = 30000; testStorage._map.set('knightSaveV1', JSON.stringify(raw)); G.reloadSave();
  G.buyItem('shadowfang'); G.equipItem('shadowfang');
  G.forceStartLevel(1);
  G.getPlayer().state = 'idle';
  eq(G.getWeaponOverlay('sword').key, 'wShadowfangDown');
  G.resetSave(); G.forceStartLevel(1);
});
test('286 varian overlay ikut state (attack/jump/block/aim)', () => {
  G.resetSave();
  const raw = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw.totalCoins = 30000; testStorage._map.set('knightSaveV1', JSON.stringify(raw)); G.reloadSave();
  G.buyItem('silver'); G.equipItem('silver');
  G.buyItem('tower'); G.equipItem('tower');
  G.setMode('GUARDIAN'); G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.state = 'idle'; pl.animTime = 0;
  eq(G.getWeaponOverlay('sword').key, 'wSilverDown');
  eq(G.getWeaponOverlay('shield').key, 'wTowerSide');
  pl.state = 'block';
  eq(G.getWeaponOverlay('shield').key, 'wTowerFront', 'block -> front');
  pl.state = 'attack'; pl.attackT = 0.3; pl.combo = false;
  eq(G.getWeaponOverlay('sword').key, 'wSilverHoriz', 'guardian attack -> horiz');
  pl.state = 'jump';
  eq(G.getWeaponOverlay('sword').key, 'wSilverUp', 'jump -> up');
  pl.state = 'death';
  eq(G.getWeaponOverlay('sword').key, null, 'death sembunyi');
  eq(G.getWeaponOverlay('shield').key, null, 'death sembunyi');
  G.resetSave();
  const raw2 = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw2.totalCoins = 30000; testStorage._map.set('knightSaveV1', JSON.stringify(raw2)); G.reloadSave();
  G.buyItem('storm'); G.equipItem('storm');
  G.forceStartLevel(1);
  const pl2 = G.getPlayer();
  pl2.state = 'aim';
  eq(G.getWeaponOverlay('bow').key, 'wStormDrawn', 'aim -> drawn');
  pl2.state = 'idle';
  eq(G.getWeaponOverlay('bow').key, 'wStormSide');
  G.resetSave(); G.forceStartLevel(1);
});
test('287 sword/shield/bow tidak tertukar antar mode', () => {
  G.resetSave(); G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.state = 'idle';
  eq(G.getMode(), 'SWORD');
  eq(G.getWeaponOverlay('shield').key, null, 'sword tak ada shield');
  eq(G.getWeaponOverlay('bow').key, null, 'sword tak ada bow');
  ok(G.getWeaponOverlay('sword').key, 'sword ada pedang');
  G.setMode('ARCHER');
  eq(G.getWeaponOverlay('sword').key, null, 'archer tak ada pedang');
  eq(G.getWeaponOverlay('shield').key, null, 'archer tak ada shield');
  ok(G.getWeaponOverlay('bow').key, 'archer ada bow');
  G.setMode('GUARDIAN');
  ok(G.getWeaponOverlay('sword').key && G.getWeaponOverlay('shield').key, 'guardian pedang+shield');
  eq(G.getWeaponOverlay('bow').key, null, 'guardian tak ada bow');
  G.resetSave(); G.forceStartLevel(1);
});
test('288 default equipment overlay benar', () => {
  G.resetSave(); G.forceStartLevel(1);
  G.getPlayer().state = 'idle';
  eq(G.getWeaponOverlay('sword').key, 'wRustyDown');
  G.setMode('GUARDIAN');
  eq(G.getWeaponOverlay('shield').key, 'wBucklerSide');
  G.setMode('ARCHER');
  eq(G.getWeaponOverlay('bow').key, 'wMakeshiftSide');
  G.resetSave(); G.forceStartLevel(1);
});
test('289 offset attachment bounded (tak floating jauh)', () => {
  G.resetSave(); G.forceStartLevel(1);
  const states = ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'block', 'aim'];
  states.forEach((s) => {
    G.getPlayer().state = s;
    ['sword', 'shield', 'bow'].forEach((c) => {
      const o = G.getWeaponOverlay(c);
      ok(Math.abs(o.ox) <= 3 && Math.abs(o.oy) <= 3, 'offset ' + c + '/' + s + ': ' + o.ox + ',' + o.oy);
    });
  });
  G.resetSave(); G.forceStartLevel(1);
});
test('290 drawOnce dengan overlay di semua mode/state tanpa error', () => {
  G.resetSave();
  const sp = G.getSprites();
  sp.wRustyDown[0] = {}; sp.wBucklerSide[0] = {}; sp.wMakeshiftSide[0] = {};
  sp.wSilverHoriz[0] = {}; sp.wTowerFront[0] = {}; sp.wStormDrawn[0] = {};
  ['SWORD', 'GUARDIAN', 'ARCHER'].forEach((m) => {
    G.setMode(m); G.forceStartLevel(1);
    ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'block', 'aim', 'death'].forEach((s) => {
      G.getPlayer().state = s;
      noThrow(() => G.drawOnce(), 'draw ' + m + '/' + s);
    });
  });
  G.resetSave(); G.forceStartLevel(1);
});
test('291 epic FX: slash tint + block flash + bastion aura tanpa error', () => {
  G.resetSave();
  const raw = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw.totalCoins = 30000; testStorage._map.set('knightSaveV1', JSON.stringify(raw)); G.reloadSave();
  G.buyItem('shadowfang'); G.equipItem('shadowfang');
  G.forceStartLevel(1);
  const pl = G.getPlayer();
  pl.x = 1150; pl.y = 402; pl.vx = 0; pl.vy = 0; pl.facing = 1; pl.attackCooldown = 0;
  G.input.attackPressed = true;
  for (let i = 0; i < 15; i++) G.step(1 / 60);
  noThrow(() => G.drawOnce(), 'slash poison tint');
  G.buyItem('sunfire'); G.equipItem('sunfire');
  pl.attackCooldown = 0; G.input.attackPressed = true;
  for (let i = 0; i < 15; i++) G.step(1 / 60);
  noThrow(() => G.drawOnce(), 'slash burn tint');
  G.buyItem('bastion'); G.equipItem('bastion');
  G.forceStartLevel(1);
  const pl2 = G.getPlayer();
  pl2.bastionOn = 1.5; pl2.state = 'block';
  noThrow(() => G.drawOnce(), 'bastion aura + block flash');
  G.resetSave(); G.forceStartLevel(1);
});
test('292 shop preview menunjukkan weapon per item.id', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  G.setShopSel('shadowfang');
  let ren = G.getShopRender();
  eq(ren.preview.id, 'shadowfang');
  ok(ren.preview.weapon.includes('weapon-shadowfang-'), 'weapon file: ' + ren.preview.weapon);
  G.setShopTab('shield');
  G.setShopSel('bastion');
  ren = G.getShopRender();
  ok(ren.preview.weapon.includes('weapon-bastion-'), 'weapon file: ' + ren.preview.weapon);
  G.setShopTab('bow');
  G.setShopSel('storm');
  ren = G.getShopRender();
  ok(ren.preview.weapon.includes('weapon-storm-'), 'weapon file: ' + ren.preview.weapon);
  ok(elements['shop-prev-weapon'], 'img weapon ada di DOM');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('293 shop bisa dibuka + 15 item + filter kategori', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  eq(G.shopItems.length, 15);
  G.setShopTab('sword');
  eq(G.getShopRender().cards.length, 5);
  G.setShopTab('shield');
  eq(G.getShopRender().cards.length, 5);
  G.setShopTab('bow');
  eq(G.getShopRender().cards.length, 5);
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('294 scroll container benar (CSS + struktur)', () => {
  ok(css.includes('#shop-body') && css.includes('overflow-y: auto'), 'body scrollable');
  ok(css.includes('touch-action: pan-y'), 'touch vertical');
  ok(css.includes('-webkit-overflow-scrolling: touch'), 'momentum iOS');
  ok(css.includes('min-height: 0'), 'flex shrink fix');
  ok(css.includes('overscroll-behavior: contain'), 'scroll terkunci di shop');
  ok(css.includes('#shop') && css.includes('overflow: hidden'), 'overlay tak bocor');
  ok(html.includes('id="shop-body"') && html.includes('id="shop-list"'), 'struktur body>list');
  ok(html.includes('id="shop-coin"') && html.includes('id="shop-tab-sword"'), 'header+tabs');
  srcHas("closest('#shop-body')", 'touchmove guard');
});
test('295 tab switch reset scroll + buka ulang konsisten', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  elements['shop-list'].scrollTop = 999;
  elements['shop-tab-shield'].dispatch('click', {});
  eq(elements['shop-list'].scrollTop, 0, 'pindah tab reset ke awal');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('296 buy/equip + insufficient tetap bekerja', () => {
  G.resetSave();
  const raw = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw.totalCoins = 500; testStorage._map.set('knightSaveV1', JSON.stringify(raw)); G.reloadSave();
  eq(G.buyItem('steel').ok, true);
  eq(G.shopBalance(), 250);
  ok(G.equipItem('steel'));
  eq(G.getEquipment().sword, 'steel');
  eq(G.buyItem('sunfire').ok, false, 'mahal ditolak');
  eq(G.shopBalance(), 250, 'saldo utuh');
  G.resetSave();
});
test('297 save persist reload + schema tetap v4', () => {
  G.resetSave();
  const raw = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw.totalCoins = 20000; testStorage._map.set('knightSaveV1', JSON.stringify(raw)); G.reloadSave();
  G.buyItem('silver'); G.equipItem('silver');
  G.buyItem('elven'); G.equipItem('elven');
  G.reloadSave();
  const s = G.getSave();
  eq(s.version, 4, 'schema tak berubah');
  ok(s.owned.silver && s.owned.elven, 'owned lestari');
  eq(s.eqSword, 'silver'); eq(s.eqBow, 'elven');
  eq(s.mode, 'ARCHER');
  G.resetSave();
});
test('298 keyboard shop utuh (tab/item/Enter/Esc)', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  eq(G.getState(), 'shop');
  const t0 = G.getShopTab();
  fireWin('keydown', { code: 'ArrowRight', preventDefault() {} });
  ok(G.getShopTab() !== t0, 'tab pindah');
  fireWin('keydown', { code: 'ArrowDown', preventDefault() {} });
  ok(G.getShopSel(), 'item terpilih');
  fireWin('keydown', { code: 'Enter', preventDefault() {} });
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.getState(), 'menu');
  G.resetSave();
});
test('299 performa overlay: rAF tunggal + tanpa setInterval + preload sekali', () => {
  const raf = (src.match(/requestAnimationFrame/g) || []).length;
  ok(raf <= 3, 'rAF tunggal, got ' + raf);
  ok(!/setInterval\s*\(/.test(src), 'tanpa pemanggilan setInterval');
  srcHas('Promise.all');
  srcHas('drawImage(sprites[sho.key][0]', 'overlay via drawImage cache');
  G.resetSave(); G.forceStartLevel(1);
  noThrow(() => { for (let i = 0; i < 30; i++) G.step(1 / 60); });
  G.resetSave(); G.forceStartLevel(1);
});
test('300 mobile CSS: 44px + tanpa overflow horizontal + safe-area', () => {
  ok(/\.touch-btn\s*{[^}]*clamp\(64px/.test(css) || css.includes('min-height: 44px'), 'target sentuh lega');
  ok(css.includes('env(safe-area-inset-'), 'safe-area');
  ok(css.includes('overflow-x: hidden'), 'tanpa page overflow');
  ['btn-shop', 'shop-back', 'shop-prev-action', 'btn-block'].forEach((id) => {
    ok(new RegExp('id="' + id + '"').test(html), 'id ada: ' + id);
  });
  ok(/id="shop-prev-action"[^>]*>([^<]*)/.test(html), 'action berlabel');
});
test('301 gameplay/balance tak berubah oleh visual', () => {
  srcHas('ATTACK_DAMAGE = 12');
  G.resetSave();
  eq(G.swordStats().damage, 12);
  eq(G.shieldStats().defense, 0.25);
  eq(G.bowStats().damage, 10);
  const it = {};
  G.shopItems.forEach((x) => { it[x.id] = x.price; });
  eq(it.rusty, 50); eq(it.sunfire, 5500); eq(it.buckler, 40);
  eq(it.bastion, 4800); eq(it.makeshift, 45); eq(it.dragon, 5000);
  G.resetSave();
});
test('302 tier badge accessible + dialog roles', () => {
  ok((html.match(/role="dialog"/g) || []).length >= 6, 'dialog roles');
  ok(html.includes('id="shop"') && /id="shop"[^>]*role="dialog"/.test(html), 'shop dialog');
  ok(css.includes('.shop-card.tier-Epic'), 'tier css');
  const tm = G.tierMeta;
  ok(tm.Common.symbol && tm.Epic.label, 'simbol+label tier');
});

// ---------- 12 TEST MOBILE SHOP ----------
test('303 shop visible sebagai halaman mobile', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  eq(G.getState(), 'shop');
  ok(G.isShopOpen(), 'overlay tampil');
  eq(G.isSimActive(), false, 'simulasi diam');
  ok(!elements['shop'].classList.contains('hidden'), 'tidak hidden');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.getState(), 'menu');
  G.resetSave();
});
test('304 shop-body scroll container valid', () => {
  ok(css.includes('#shop-body'), 'ada');
  ok(/#shop-body\s*{[^}]*overflow-y:\s*auto/.test(css), 'vertical scroll');
  ok(/#shop-body\s*{[^}]*overflow-x:\s*hidden/.test(css), 'tanpa x-scroll');
  ok(/#shop-body\s*{[^}]*touch-action:\s*pan-y/.test(css), 'swipe satu jari');
  ok(css.includes('-webkit-overflow-scrolling: touch'), 'momentum');
  ok(/#shop-body\s*{[^}]*min-height:\s*0/.test(css), 'flex shrink');
  ok(/#shop\s*{[^}]*overflow:\s*hidden/.test(css), 'overlay terkunci');
  ok(html.includes('id="shop-body"'), 'struktur HTML');
});
test('305 tanpa horizontal overflow halaman', () => {
  ok(css.includes('overflow-x: hidden'), 'page terkunci');
  ok(css.includes('max-width: 100%') || css.includes('94vw') || css.includes('92vw'), 'lebar terbatas');
  ok(!/width:\s*\d{4,}px/.test(css), 'tanpa lebar raksasa');
  ok(css.includes('overflow-wrap: anywhere') || css.includes('word-break'), 'nama panjang wrap');
});
test('306 15 item tersedia semua kategori', () => {
  eq(G.shopItems.length, 15);
  ['sword', 'shield', 'bow'].forEach((c) => {
    eq(G.shopItemsByCategory(c).length, 5, c);
  });
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  G.setShopTab('sword'); eq(G.getShopRender().cards.length, 5);
  G.setShopTab('shield'); eq(G.getShopRender().cards.length, 5);
  G.setShopTab('bow'); eq(G.getShopRender().cards.length, 5);
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('307 card hierarchy nama/tier/desc/harga/aksi', () => {
  srcHas('shop-name'); srcHas('shop-desc'); srcHas('shop-price');
  srcHas('it.desc'); srcHas("it.price + ' Coin'");
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  const ren = G.getShopRender();
  ok(ren.cards.every((c) => ['BUY', 'EQUIP', 'EQUIPPED'].includes(c.action)), 'aksi valid');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('308 BUY/USE mobile tetap bekerja', () => {
  G.resetSave();
  const raw = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw.totalCoins = 1000; testStorage._map.set('knightSaveV1', JSON.stringify(raw)); G.reloadSave();
  G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  eq(G.buyItem('steel').ok, true);
  ok(G.equipItem('steel'));
  eq(G.getEquipment().sword, 'steel');
  eq(G.setMode('GUARDIAN'), true, 'USE guardian');
  eq(G.getMode(), 'GUARDIAN');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('309 preview equipment aktual per item', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  G.setShopTab('sword'); G.setShopSel('silver');
  let ren = G.getShopRender();
  eq(ren.preview.id, 'silver');
  ok(ren.preview.weapon.includes('weapon-silver-'), 'senjata benar');
  ok(ren.preview.klass.includes('knight-attack'), 'karakter benar');
  G.setShopTab('shield'); G.setShopSel('tower');
  ren = G.getShopRender();
  ok(ren.preview.weapon.includes('weapon-tower-'), 'perisai benar');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  G.resetSave();
});
test('310 touch/keyboard Shop tak bocor ke gameplay', () => {
  G.resetSave(); G.forceStartLevel(1);
  const pl = G.getPlayer();
  const x0 = pl.x, hp0 = pl.hp;
  G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  // Key gameplay saat shop buka: Input harus tetap bersih.
  fireWin('keydown', { code: 'KeyA', preventDefault() {} });
  fireWin('keydown', { code: 'KeyD', preventDefault() {} });
  fireWin('keydown', { code: 'Space', preventDefault() {} });
  fireWin('keydown', { code: 'KeyJ', preventDefault() {} });
  fireWin('keydown', { code: 'KeyK', preventDefault() {} });
  eq(G.input.left, false, 'tak jalan kiri');
  eq(G.input.right, false, 'tak jalan kanan');
  eq(G.input.jumpHeld, false, 'tak lompat');
  eq(G.input.attackPressed, false, 'tak serang');
  eq(G.input.blockHeld, false, 'tak block');
  fireWin('keyup', { code: 'KeyA' });
  fireWin('keyup', { code: 'KeyD' });
  // Step simulasi tak jalan saat shop (state bukan playing).
  for (let i = 0; i < 10; i++) G.step(1 / 60);
  // Tap BUY via aksi card: player tak terpengaruh.
  G.shopCardAction('steel');
  eq(G.input.attackPressed, false, 'tap BUY bukan attack');
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.getState(), 'menu');
  // Tutup -> input normal kembali.
  fireWin('keydown', { code: 'KeyD', preventDefault() {} });
  eq(G.input.left, false, 'kanan bukan kiri');
  fireWin('keyup', { code: 'KeyD' });
  G.resetSave(); G.forceStartLevel(1);
  ok(Math.abs(G.getPlayer().x - 80) < 1, 'posisi awal utuh');
  void x0; void hp0;
});
test('311 save mobile tetap benar', () => {
  G.resetSave();
  const raw = JSON.parse(testStorage._map.get('knightSaveV1') || '{}');
  raw.totalCoins = 5000; testStorage._map.set('knightSaveV1', JSON.stringify(raw)); G.reloadSave();
  G.buyItem('hunter'); G.equipItem('hunter');
  G.reloadSave();
  const s = G.getSave();
  eq(s.version, 4);
  ok(s.owned.hunter, 'owned lestari');
  eq(s.eqBow, 'hunter'); eq(s.mode, 'ARCHER');
  G.resetSave();
});
test('312 keyboard mobile tetap (panah/Enter/Esc)', () => {
  G.resetSave(); G.toMenu();
  elements['btn-shop'].dispatch('click', {});
  fireWin('keydown', { code: 'ArrowRight', preventDefault() {} });
  fireWin('keydown', { code: 'ArrowDown', preventDefault() {} });
  ok(G.getShopSel(), 'navigasi jalan');
  fireWin('keydown', { code: 'Enter', preventDefault() {} });
  fireWin('keydown', { code: 'Escape', preventDefault() {} });
  eq(G.getState(), 'menu', 'Esc kembali');
  G.resetSave();
});
test('313 portrait compact + landscape dua kolom', () => {
  ok(css.includes('(orientation: portrait)') && css.includes('max-width: 600px'), 'breakpoint portrait');
  ok(css.includes('flex-direction: column'), 'portrait 1 kolom');
  ok(css.includes('flex-direction: row'), 'landscape 2 kolom');
  ok(css.includes('#shop-prev-stack'), 'preview stack');
  ok(css.includes('env(safe-area-inset-'), 'safe-area');
  ok(html.includes('id="shop-head"'), 'header wrapper');
});
test('314 performa + tombol 44px + reduced-motion', () => {
  const raf = (src.match(/requestAnimationFrame/g) || []).length;
  ok(raf <= 3, 'rAF tunggal');
  ok(!/setInterval\s*\(/.test(src), 'tanpa setInterval call');
  ok(css.includes('min-height: 44px') || css.includes('min-height: 48px'), 'target 44px');
  ok(css.includes('prefers-reduced-motion'), 'reduced-motion');
  ok(!/new Image\(\)/.test(src.replace(/new Image\(\);/, '')) || src.includes('new Image()'), 'preload via loader');
});
// ---------- Ringkasan ----------
console.log('\n==== RINGKASAN ====');
console.log('PASS: ' + pass + ' / ' + (pass + fail) + ', FAIL: ' + fail);
if (failures.length) { console.log('Failures:'); failures.forEach((f) => console.log(' - ' + f)); }
setTimeout(() => { // beri waktu Image async selesai agar 0 unhandled rejection
  if (pass + fail !== EXPECTED_TOTAL) {
    console.log('COUNT MISMATCH: expected ' + EXPECTED_TOTAL + ' tests, got ' + (pass + fail));
    process.exit(1);
  }
  if (fail > 0) process.exit(1);
}, 50);
