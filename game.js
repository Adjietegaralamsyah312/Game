/* ==========================================================================
 * Knight 2D Platformer — release candidate Tahap 4 (vanilla JS + Canvas)
 *
 * Modul (dalam satu file agar tetap jalan via file:// tanpa build step):
 *   Config / Utils / AudioManager (WebAudio prosedural) / Assets / Input /
 *   Level / Physics / Animation / Player / Enemy (slime prosedural) /
 *   Combat / FX (partikel pool, shake, dekor parallax) / Kamera /
 *   Checkpoint+Goal / UI-HUD / Game state + respawn/restart / Main loop
 *
 * Kontrol : A/D atau Panah = gerak | Space/W/Panah-atas = lompat |
 *           J/X = serang | R/Enter = respawn (saat Game Over) / ulangi (menang)
 * Sentuh  : tombol ◀ ▶ ⤒ + ATTACK (❖)
 * Misi    : lewati 2 celah, kalahkan slime, sentuh CP, capai FINISH.
 * ========================================================================== */
(function () {
  'use strict';

  /* ============================ 1. CONFIG ============================ */
  const DEBUG = false;

  var VIEW_W = 960;
  var VIEW_H = 540;
  // Tahap 2: dunia lebih lebar dari layar — kamera side-scrolling mengikuti.
  var WORLD_W = 2400;
  var WORLD_H = 540;
  var KILL_Y = WORLD_H + 60; // jatuh ke celah = death

  // Fisika (px / detik — konsisten di semua FPS)
  var GRAVITY = 2500;
  var MAX_FALL = 840;
  var PLAYER_SPEED = 210;
  var JUMP_FORCE = 800;
  var JUMP_CUT = 240;      // kecepatan sisa saat tombol lompat dilepas
  var COYOTE_TIME = 0.10;
  var JUMP_BUFFER = 0.12;

  // Player
  var PLAYER_MAX_HP = 100;
  var PLAYER_W = 40, PLAYER_H = 78;
  var PLAYER_DRAW = 96;    // sprite 32px digambar 3x
  var HURT_DURATION = 0.35;
  var PLAYER_IFRAMES = 0.8;
  var PLAYER_KNOCKBACK_X = 300;
  var PLAYER_KNOCKBACK_Y = 320;

  // Serangan player (3 fase: windup -> strike -> recovery)
  var ATTACK_WINDUP = 0.08;    // attack_0.png
  var ATTACK_STRIKE = 0.12;    // attack_1.png (hitbox aktif)
  var ATTACK_RECOVERY = 0.16;  // attack_2.png
  var ATTACK_COOLDOWN = 0.18;  // jeda setelah recovery selesai
  var ATTACK_DAMAGE = 12;
  var ATTACK_W = 58, ATTACK_H = 64;
  var ATTACK_KNOCKBACK = 340;

  // Slime
  var SLIME_MAX_HP = 30;
  var SLIME_W = 44, SLIME_H = 32;
  var SLIME_PATROL_SPEED = 45;
  var SLIME_CHASE_SPEED = 95;
  var SLIME_DETECT_X = 230;
  var SLIME_DETECT_Y = 120;
  var SLIME_ATTACK_RANGE = 52;
  var SLIME_DAMAGE = 10;
  var SLIME_WINDUP = 0.35;
  var SLIME_STRIKE = 0.15;
  var SLIME_RECOVERY = 0.50;
  var SLIME_COOLDOWN = 0.90;
  var SLIME_HURT_DURATION = 0.25;
  var SLIME_DEATH_DURATION = 0.45;
  var SLIME_LEASH = 380; // chase boleh keluar zona patrol sejauh ini dari spawn

  // Kamera (Tahap 2)
  var CAM_SMOOTH = 4.5;      // kecepatan lerp kamera (per detik)
  var CAM_AHEAD_R = 0.38;    // offset pandangan ke arah hadap (kanan)
  var CAM_AHEAD_L = 0.62;    // offset pandangan ke arah hadap (kiri)

  // Polish Tahap 3 (visual ringan, aman untuk Android menengah)
  var MAX_PARTICLES = 120;   // batas pool partikel (preallocated, tanpa GC)
  var SHAKE_HIT = 3;         // attack player mengenai slime
  var SHAKE_HURT = 5;        // player terkena damage
  var SHAKE_DIE = 4;         // slime mati
  var LAND_DUST_MIN_VY = 550; // dentuman pendaratan (px/detik)
  var LAND_SQUASH_TIME = 0.12;
  var PAR_FAR = 0.2, PAR_MID = 0.5, PAR_NEAR = 0.85; // faktor parallax

  // Tahap 4: render scale terkontrol (DPR dibatasi — HP lemah tidak
  // menggambar backing store raksasa). Logika/collision tetap world-space.
  var RENDER_SCALE_MAX = 2;
  var renderScale = 1;

  /* ============================ 2. UTILS ============================ */
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Rect scratch untuk uji overlap per-frame (tanpa alokasi objek baru).
  var _r1 = { x: 0, y: 0, w: 0, h: 0 };
  var _r2 = { x: 0, y: 0, w: 0, h: 0 };
  function setR(r, x, y, w, h) { r.x = x; r.y = y; r.w = w; r.h = h; return r; }

  function debugLog() {
    if (DEBUG && typeof console !== 'undefined' && console.log) {
      console.log.apply(console, arguments);
    }
  }

  /* ========================= 3. AUDIO =========================
   * Web Audio API prosedural — tanpa file eksternal, tanpa download.
   * Konteks dibuat saat interaksi pertama (aturan autoplay browser);
   * play() aman dipanggil kapan pun (no-op bila belum unlocked / tanpa
   * dukungan WebAudio). Master gain kecil agar tidak memekakkan telinga.
   * =================================================================== */
  var AudioManager = (function () {
    var ctx = null, master = null, noiseBuf = null;

    function ensure() {
      if (ctx) return true;
      try {
        var AC = (typeof window !== 'undefined') &&
          (window.AudioContext || window.webkitAudioContext);
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.16;
        master.connect(ctx.destination);
        // Buffer noise 0.5 dtk — dibuat sekali, dipakai ulang semua SFX.
        noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return true;
      } catch (e) { ctx = null; return false; }
    }

    function unlock() {
      try {
        if (ensure() && ctx.state === 'suspended') {
          var pr = ctx.resume();
          if (pr && pr.catch) pr.catch(function () { /* abaikan */ });
        }
      } catch (e) { /* abaikan */ }
    }

    function suspend() {
      try {
        if (ctx && ctx.state === 'running') {
          var p = ctx.suspend();
          if (p && p.catch) p.catch(function () { /* abaikan */ });
        }
      } catch (e) { /* abaikan */ }
    }

    function tone(freq, dur, type, vol, slideTo, delay) {
      if (!ctx) return;
      var t0 = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }

    function noise(dur, vol, cutoff, delay) {
      if (!ctx || !noiseBuf) return;
      var t0 = ctx.currentTime + (delay || 0);
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff || 1200;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }

    var SFX = {
      jump:       function () { tone(280, 0.14, 'square', 0.35, 620); },
      attack:     function () { noise(0.12, 0.4, 2500); tone(220, 0.10, 'sawtooth', 0.25, 90); },
      hit:        function () { noise(0.08, 0.5, 1800); tone(180, 0.08, 'square', 0.4, 120); },
      hurt:       function () { tone(320, 0.22, 'square', 0.45, 110); },
      slimeDie:   function () { tone(260, 0.30, 'square', 0.4, 60); noise(0.25, 0.35, 900, 0.05); },
      checkpoint: function () { tone(523, 0.12, 'square', 0.4); tone(784, 0.18, 'square', 0.4, 0, 0.1); },
      win:        function () {
        var n = [523, 659, 784, 1047];
        for (var i = 0; i < n.length; i++) tone(n[i], 0.16, 'square', 0.4, 0, i * 0.11);
      },
      gameover:   function () { tone(220, 0.5, 'sawtooth', 0.4, 55); tone(110, 0.7, 'triangle', 0.4, 40, 0.1); }
    };

    return {
      play: function (name) {
        try { if (ctx && SFX[name]) SFX[name](); } catch (e) { /* abaikan */ }
      },
      unlock: unlock,
      suspend: suspend,
      isReady: function () { return !!ctx; }
    };
  })();

  /* ============================ 4. ASET ============================ */
  var SPRITE_PATHS = {
    idle:   ['assets/knight/idle_0.png', 'assets/knight/idle_1.png',
             'assets/knight/idle_2.png', 'assets/knight/idle_3.png'],
    run:    ['assets/knight/run_0.png', 'assets/knight/run_1.png',
             'assets/knight/run_2.png', 'assets/knight/run_3.png',
             'assets/knight/run_4.png', 'assets/knight/run_5.png'],
    jump:   ['assets/knight/jump_0.png'],
    fall:   ['assets/knight/fall_0.png'],
    attack: ['assets/knight/attack_0.png', 'assets/knight/attack_1.png',
             'assets/knight/attack_2.png'],
    hurt:   ['assets/knight/hurt_0.png'],
    death:  ['assets/knight/death_0.png', 'assets/knight/death_1.png']
  };
  var ANIM_ORDER = ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'death'];

  var sprites = { idle: [], run: [], jump: [], fall: [], attack: [], hurt: [], death: [] };
  var assetsReady = false;
  var assetErrors = [];

  // Fallback aman: kanvas magenta 32x32 agar game tidak crash bila 1 file hilang.
  function makeFallbackSprite(label) {
    var c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    var g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#000'; g.font = '10px monospace'; g.fillText('?', 13, 21);
    }
    debugLog('[asset] fallback untuk', label);
    return c;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        assetErrors.push(src);
        debugLog('[asset] GAGAL dimuat:', src);
        resolve(makeFallbackSprite(src)); // jangan crash seluruh game
      };
      img.src = src;
    });
  }

  /* ============================ 5. INPUT ============================ */
  var Input = {
    left: false, right: false, jumpHeld: false,
    jumpPressed: false,    // edge-trigger, dikonsumsi oleh Player
    attackPressed: false,  // edge-trigger, dikonsumsi oleh Player
    restartPressed: false  // edge-trigger, dikonsumsi oleh Game
  };

  window.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { Input.left = true; e.preventDefault(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { Input.right = true; e.preventDefault(); }
    else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (!Input.jumpHeld) Input.jumpPressed = true;
      Input.jumpHeld = true;
      e.preventDefault();
    }
    else if (e.code === 'KeyJ' || e.code === 'KeyX') {
      Input.attackPressed = true;
      e.preventDefault();
    }
    else if (e.code === 'KeyR' || e.code === 'Enter') { Input.restartPressed = true; }
  });
  window.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') Input.left = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') Input.right = false;
    else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') Input.jumpHeld = false;
  });

  function bindHoldButton(id, onDown, onUp) {
    var el = document.getElementById(id);
    if (!el) { debugLog('[input] tombol tidak ditemukan:', id); return; }
    // Guard: browser Android mengirim mouse emulasi <500ms setelah touch.
    // Tanpa guard, mousedown emulasi memicu edge kedua (double jump/dll).
    var lastTouch = -9999;
    var start = function (e) {
      if (e && e.cancelable) e.preventDefault();
      el.classList.add('pressed');
      onDown();
    };
    var end = function (e) {
      if (e && e.cancelable) e.preventDefault();
      el.classList.remove('pressed');
      onUp();
    };
    var startTouch = function (e) {
      try { lastTouch = nowPerf(); } catch (err) { lastTouch = 0; }
      start(e);
    };
    var startMouse = function (e) {
      try { if (nowPerf() - lastTouch < 500) return; } catch (err) { /* lanjut */ }
      start(e);
    };
    var endMouse = function (e) {
      try { if (nowPerf() - lastTouch < 500) { el.classList.remove('pressed'); return; } }
      catch (err) { /* lanjut */ }
      end(e);
    };
    el.addEventListener('touchstart', startTouch, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('mousedown', startMouse);
    el.addEventListener('mouseup', endMouse);
    el.addEventListener('mouseleave', function () {
      if (el.classList.contains('pressed')) end();
    });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ========================= 6. LEVEL DATA =========================
   * Vertical slice Tahap 2 (dunia 2400x540). Satu-satunya tempat definisi
   * level — mudah diedit. Zona:
   *   x 0-520     : starting area (tanah datar, spawn 80)
   *   x 520-610   : CELAH 1 (90px — harus dilompati)
   *   x 610-1050  : platform bertingkat rendah
   *   x 1050-1140 : CELAH 2 (90px)
   *   x 1140-1750 : ARENA COMBAT (datar, 3 slime)
   *   x 1750-2400 : pendakian akhir + GOAL di x ~2280
   * Lompatan penuh: tinggi ~128px, jarak ~134px — semua rute bisa dilalui.
   * ================================================================ */
  var GROUND_TOP = 480;
  var Level = {
    playerSpawn: { x: 80, y: 300 },
    platforms: [
      // --- Tanah (segmen + celah) ---
      { x: 0,    y: 480, w: 520,  h: 60 },  // starting area
      { x: 610,  y: 480, w: 440,  h: 60 },  // tengah (setelah celah 1)
      { x: 1140, y: 480, w: 610,  h: 60 },  // arena combat
      { x: 1750, y: 480, w: 650,  h: 60 },  // final (sampai ujung dunia)
      // --- Platform bertingkat (rute atas, opsional) ---
      // NOTE: jangan menggantung di koridor lompatan celah (lepas landas
      // x~482 dan x~1002 butuh langit bersih sampai kaki y~352).
      { x: 180,  y: 372, w: 150, h: 20 },   // start -> naik (108px)
      { x: 300,  y: 300, w: 140, h: 20 },   // lanjutan (+72px, di kiri koridor)
      { x: 650,  y: 365, w: 150, h: 20 },   // atas segmen tengah
      { x: 820,  y: 290, w: 140, h: 20 },   // (+75px, di kiri koridor celah 2)
      { x: 1180, y: 375, w: 150, h: 20 },   // tepi arena (105px dari tanah)
      { x: 1400, y: 300, w: 140, h: 20 },   // tengah arena (+75px)
      { x: 1620, y: 335, w: 130, h: 20 },   // headroom arena (bawah 355)
      { x: 1850, y: 365, w: 140, h: 20 },   // final (115px dari tanah)
      { x: 2080, y: 290, w: 140, h: 20 }    // tinggi dekat goal (+75px)
    ],
    enemySpawns: [
      { type: 'slime', x: 1230, y: 448, minX: 1180, maxX: 1360 }, // arena kiri
      { type: 'slime', x: 1450, y: 448, minX: 1380, maxX: 1560 }, // arena tengah
      { type: 'slime', x: 1630, y: 448, minX: 1580, maxX: 1700 }  // arena kanan
    ],
    checkpoints: [
      { x: 1160, baseY: 480, w: 34, h: 96, activated: false }, // awal arena
      { x: 1790, baseY: 480, w: 34, h: 96, activated: false }  // sebelum final
    ],
    goal: { x: 2280, baseY: 480, w: 70, h: 120 }
  };

  /* ====================== 7. FISIKA & COLLISION ====================== */
  function moveAndCollide(body, dt, platforms) {
    // Horizontal
    body.x += body.vx * dt;
    body.hitWall = false;
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (rectsOverlap(body, p)) {
        if (body.vx > 0) body.x = p.x - body.w;
        else if (body.vx < 0) body.x = p.x + p.w;
        else continue;
        body.hitWall = true;
        body.vx = 0;
      }
    }
    if (body.x < 0) { body.x = 0; body.hitWall = true; }
    if (body.x + body.w > WORLD_W) { body.x = WORLD_W - body.w; body.hitWall = true; }

    // Vertikal (gravitasi dihitung pemanggil sebelum fungsi ini)
    body.y += body.vy * dt;
    body.onGround = false;
    for (var j = 0; j < platforms.length; j++) {
      var q = platforms[j];
      if (rectsOverlap(body, q)) {
        if (body.vy > 0) {
          body.y = q.y - body.h;
          body.vy = 0;
          body.onGround = true;
        } else if (body.vy < 0) {
          body.y = q.y + q.h;
          body.vy = 0;
        }
      }
    }
  }

  function applyGravity(body, dt) {
    body.vy += GRAVITY * dt;
    if (body.vy > MAX_FALL) body.vy = MAX_FALL;
  }

  /* ========================== 8. PLAYER ========================== */
  function createPlayer() {
    return {
      x: Level.playerSpawn.x, y: Level.playerSpawn.y,
      w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0,
      facing: 1, onGround: false, hitWall: false,
      hp: PLAYER_MAX_HP,
      state: 'idle',      // idle|run|jump|fall|attack|hurt|death
      animTime: 0,
      coyote: 0, jumpBuf: 0,
      attackT: 0, attackCooldown: 0, swingId: 0, didStrikeHit: {},
      hurtT: 0, iframes: 0,
      deathT: 0, attackBox: null,
      landT: 0,      // squash pendaratan (polish Tahap 3)
      queued: false  // buffer serangan beruntun (responsif, Tahap 3)
    };
  }
  var player = createPlayer();

  function playerStartAttack() {
    player.state = 'attack';
    player.animTime = 0;
    player.attackT = 0;
    player.swingId++;
    player.didStrikeHit = {};
    player.attackBox = null;
    AudioManager.play('attack');
  }

  function playerTakeDamage(amount, fromX) {
    if (player.state === 'death' || player.iframes > 0) return;
    // Serangan sendiri tidak bisa di-interrupt oleh hurt yang baru? tetap bisa — prioritaskan hurt.
    player.hp -= amount;
    AudioManager.play('hurt');
    triggerScreenShake(SHAKE_HURT, 0.25);
    if (player.hp <= 0) {
      player.hp = 0;
      player.state = 'death';
      player.animTime = 0;
      player.deathT = 0;
      player.vx = 0;
      return;
    }
    player.state = 'hurt';
    player.animTime = 0;
    player.hurtT = 0;
    player.iframes = PLAYER_IFRAMES;
    var dir = (player.x + player.w / 2) < fromX ? -1 : 1;
    player.vx = dir * PLAYER_KNOCKBACK_X;
    player.vy = -PLAYER_KNOCKBACK_Y;
    player.onGround = false;
  }

  function updatePlayer(dt) {
    var move = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
    var dead = (player.state === 'death');

    if (player.iframes > 0) player.iframes = Math.max(0, player.iframes - dt);
    if (player.attackCooldown > 0) player.attackCooldown -= dt;
    if (player.landT > 0) player.landT = Math.max(0, player.landT - dt);

    // Konsumsi buffer lompat
    if (Input.jumpPressed) { player.jumpBuf = JUMP_BUFFER; Input.jumpPressed = false; }
    else player.jumpBuf = Math.max(0, player.jumpBuf - dt);

    if (!dead) {
      if (move > 0) player.facing = 1;
      else if (move < 0) player.facing = -1;
    }

    if (dead) {
      // Death: fisika tetap jalan (jatuh ke tanah), tanpa kontrol.
      player.deathT += dt;
      applyGravity(player, dt);
      moveAndCollide(player, dt, Level.platforms);
      player.animTime += dt;
      return;
    }

    if (player.state === 'hurt') {
      // Knockback meluncur, tanpa kontrol selama HURT_DURATION.
      player.hurtT += dt;
      applyGravity(player, dt);
      moveAndCollide(player, dt, Level.platforms);
      player.animTime += dt;
      if (player.hurtT >= HURT_DURATION) {
        player.state = player.onGround ? 'idle' : 'fall';
        player.animTime = 0;
      }
      return;
    }

    if (player.state === 'attack') {
      player.attackT += dt;
      var total = ATTACK_WINDUP + ATTACK_STRIKE + ATTACK_RECOVERY;
      // Buffer: serangan ditekan saat recovery => rantai kombo responsif.
      if (Input.attackPressed) { player.queued = true; Input.attackPressed = false; }
      // Movement dikunci saat grounded; di udara boleh drift 40%.
      var lockFactor = player.onGround ? 0 : 0.4;
      player.vx = move * PLAYER_SPEED * lockFactor;

      // Hitbox serangan aktif hanya pada fase STRIKE, di depan player.
      if (player.attackT >= ATTACK_WINDUP &&
          player.attackT < ATTACK_WINDUP + ATTACK_STRIKE) {
        var bx = player.facing === 1
          ? player.x + player.w
          : player.x - ATTACK_W;
        player.attackBox = {
          x: bx,
          y: player.y + player.h / 2 - ATTACK_H / 2,
          w: ATTACK_W, h: ATTACK_H
        };
      } else {
        player.attackBox = null;
      }

      applyGravity(player, dt);
      moveAndCollide(player, dt, Level.platforms);

      if (player.attackT >= total) {
        player.attackBox = null;
        if (player.queued) {
          // Kombo beruntun: langsung ayun lagi tanpa cooldown.
          player.queued = false;
          player.attackCooldown = 0;
          playerStartAttack();
        } else {
          player.state = player.onGround ? (move !== 0 ? 'run' : 'idle') : 'fall';
          player.animTime = 0;
          player.attackCooldown = ATTACK_COOLDOWN;
        }
      } else {
        player.animTime += dt;
      }
      return;
    }

    // Serangan baru? (tidak bisa saat death — sudah di-return di atas)
    if (Input.attackPressed && player.attackCooldown <= 0) {
      Input.attackPressed = false;
      playerStartAttack();
      return;
    }
    Input.attackPressed = false; // abaikan spam saat cooldown

    // --- Gerak normal ---
    player.vx = move * PLAYER_SPEED;

    if (player.onGround) player.coyote = COYOTE_TIME;
    else player.coyote = Math.max(0, player.coyote - dt);

    if (player.jumpBuf > 0 && (player.onGround || player.coyote > 0)) {
      player.vy = -JUMP_FORCE;
      player.onGround = false;
      player.coyote = 0;
      player.jumpBuf = 0;
      AudioManager.play('jump');
    }
    // Variable jump: lepas tombol => potong laju naik.
    if (!Input.jumpHeld && player.vy < -JUMP_CUT) player.vy = -JUMP_CUT;

    applyGravity(player, dt);
    var wasAir = !player.onGround;
    var vyBefore = player.vy;
    moveAndCollide(player, dt, Level.platforms);

    // Debu + squash saat mendarat keras (polish; partikel ringan).
    if (player.onGround && wasAir) {
      if (vyBefore > LAND_DUST_MIN_VY) {
        var ldx = player.x + player.w / 2, ldy = player.y + player.h;
        burst(ldx - 14, ldy - 2, 3, '#9aa3c7', 90, 0.35, 3, 300);
        burst(ldx + 14, ldy - 2, 3, '#9aa3c7', 90, 0.35, 3, 300);
        player.landT = LAND_SQUASH_TIME;
      } else {
        player.landT = 0;
      }
    }

    // Jatuh ke celah = death (respawn di checkpoint via overlay Game Over).
    // NOTE: harus return — state machine di bawah akan menimpa 'death'
    // menjadi 'fall' (onGround=false) sehingga game over tak pernah muncul.
    if (player.y > KILL_Y && player.state !== 'death') {
      player.hp = 0;
      player.state = 'death';
      player.animTime = 0;
      player.deathT = 0;
      player.vx = 0;
      player.vy = 0;
      AudioManager.play('die');
      return;
    }

    // --- State animasi ---
    var prev = player.state;
    if (!player.onGround) player.state = player.vy < 0 ? 'jump' : 'fall';
    else player.state = move !== 0 ? 'run' : 'idle';
    if (prev !== player.state) player.animTime = 0;
    else player.animTime += dt;
  }

  function playerAttackFrame() {
    // Petakan fase attack -> sprite attack_0/1/2.
    if (player.attackT < ATTACK_WINDUP) return sprites.attack[0];
    if (player.attackT < ATTACK_WINDUP + ATTACK_STRIKE) return sprites.attack[1];
    return sprites.attack[2];
  }

  function playerCurrentSprite() {
    switch (player.state) {
      case 'run': return sprites.run[Math.floor(player.animTime * 10) % sprites.run.length];
      case 'jump': return sprites.jump[0];
      case 'fall': return sprites.fall[0];
      case 'attack': return playerAttackFrame() || sprites.attack[0];
      case 'hurt': return sprites.hurt[0];
      case 'death':
        // death_0 lalu death_1 (tahan).
        return (player.deathT < 0.3 ? sprites.death[0] : sprites.death[1]) || sprites.death[0];
      default: return sprites.idle[Math.floor(player.animTime * 6) % sprites.idle.length];
    }
  }

  /* ====================== 9. ENEMY (SLIME) ====================== */
  var slimeUid = 0;

  function createSlime(spawn) {
    return {
      id: ++slimeUid,
      x: spawn.x, y: spawn.y, w: SLIME_W, h: SLIME_H,
      vx: 0, vy: 0, onGround: false, hitWall: false,
      spawnX: spawn.x, spawnY: spawn.y,
      minX: spawn.minX, maxX: spawn.maxX,
      dir: -1,
      hp: SLIME_MAX_HP,
      state: 'patrol', // patrol|chase|attack|hurt|death
      animTime: Math.random() * 10,
      atkT: 0, cooldown: 0, hurtT: 0, deathT: 0,
      iframes: 0, struckPlayer: false,
      dead: false, removeT: 0
    };
  }
  var enemies = [];

  function slimeTakeDamage(s, amount, fromX, knock) {
    if (s.dead || s.state === 'death' || s.iframes > 0) return false;
    s.hp -= amount;
    s.iframes = 0.25;
    // Damage feedback: flash (via iframes blink) + cipratan partikel.
    burst(s.x + s.w / 2, s.y + s.h / 2, 6, '#ffffff', 160, 0.3, 3, 250);
    burst(s.x + s.w / 2, s.y + s.h / 2, 4, '#ffd23f', 120, 0.35, 3, 250);
    AudioManager.play('hit');
    if (s.hp <= 0) {
      s.hp = 0;
      s.state = 'death';
      s.deathT = 0;
      s.vx = 0;
      // Poof kematian + shake kecil.
      burst(s.x + s.w / 2, s.y + s.h / 2, 10, '#4fc94f', 170, 0.6, 4, 350);
      burst(s.x + s.w / 2, s.y + s.h / 2, 5, '#a5f0a0', 120, 0.5, 3, 300);
      triggerScreenShake(SHAKE_DIE, 0.2);
      AudioManager.play('slimeDie');
      return true;
    }
    s.state = 'hurt';
    s.hurtT = 0;
    var dir = (s.x + s.w / 2) < fromX ? -1 : 1;
    s.vx = dir * (knock || ATTACK_KNOCKBACK);
    s.vy = -260;
    s.onGround = false;
    return true;
  }

  function slimeSeesPlayer(s) {
    if (player.state === 'death' || gameState !== 'playing') return false;
    var px = player.x + player.w / 2, sx = s.x + s.w / 2;
    var py = player.y + player.h / 2, sy = s.y + s.h / 2;
    return Math.abs(px - sx) < SLIME_DETECT_X && Math.abs(py - sy) < SLIME_DETECT_Y;
  }

  function slimeHasGroundAhead(s) {
    // Cek ada pijakan di depan kaki — agar slime tidak jalan off-platform.
    if (!s.onGround) return true;
    var footX = s.dir === 1 ? s.x + s.w + 4 : s.x - 4;
    var footY = s.y + s.h + 6;
    for (var i = 0; i < Level.platforms.length; i++) {
      var p = Level.platforms[i];
      if (footX >= p.x && footX <= p.x + p.w && footY >= p.y && footY <= p.y + p.h + 12) {
        if (s.y + s.h <= p.y + 14) return true;
      }
    }
    return false;
  }

  function updateSlime(s, dt) {
    s.animTime += dt;
    if (s.iframes > 0) s.iframes -= dt;
    if (s.cooldown > 0) s.cooldown -= dt;

    if (s.state === 'death') {
      s.deathT += dt;
      applyGravity(s, dt);
      s.vx = 0;
      moveAndCollide(s, dt, Level.platforms);
      if (s.deathT >= SLIME_DEATH_DURATION) s.dead = true; // dihapus Game
      return;
    }

    if (s.state === 'hurt') {
      s.hurtT += dt;
      applyGravity(s, dt);
      moveAndCollide(s, dt, Level.platforms);
      if (s.hurtT >= SLIME_HURT_DURATION) {
        s.state = slimeSeesPlayer(s) ? 'chase' : 'patrol';
      }
      return;
    }

    if (s.state === 'attack') {
      s.atkT += dt;
      var strikeEnd = SLIME_WINDUP + SLIME_STRIKE;
      var total = strikeEnd + SLIME_RECOVERY;
      // Lunge ke arah player hanya saat strike.
      if (s.atkT >= SLIME_WINDUP && s.atkT < strikeEnd) {
        s.vx = s.dir * SLIME_CHASE_SPEED * 1.6;
        // Lunge tidak boleh membawa slime off-platform.
        if (!slimeHasGroundAhead(s)) s.vx = 0;
      } else {
        s.vx = 0;
      }
      applyGravity(s, dt);
      moveAndCollide(s, dt, Level.platforms);
      // Damage diberikan oleh Combat (cek overlap strike-box sekali saja).
      if (s.atkT >= total) {
        s.state = slimeSeesPlayer(s) ? 'chase' : 'patrol';
        s.cooldown = SLIME_COOLDOWN;
      }
      return;
    }

    // patrol | chase
    var sees = slimeSeesPlayer(s);
    var px = player.x + player.w / 2, sx = s.x + s.w / 2;

    if (s.state === 'patrol' && sees) s.state = 'chase';
    else if (s.state === 'chase' && !sees) s.state = 'patrol';

    if (s.state === 'chase') {
      var distX = Math.abs(px - sx);
      if (distX <= SLIME_ATTACK_RANGE && s.cooldown <= 0 && Math.abs((player.y + player.h) - (s.y + s.h)) < 60) {
        s.state = 'attack';
        s.atkT = 0;
        s.struckPlayer = false;
        s.dir = px >= sx ? 1 : -1;
        s.vx = 0;
        AudioManager.play('attack');
      } else if (distX > SLIME_ATTACK_RANGE * 0.7) {
        s.dir = px >= sx ? 1 : -1;
        s.vx = s.dir * SLIME_CHASE_SPEED;
        // Jangan bunuh diri: tahan di tepi platform.
        // Chase BOLEH keluar zona patrol (dibatasi leash, lihat bawah).
        if (!slimeHasGroundAhead(s)) s.vx = 0;
      } else {
        s.vx = 0; // berhenti pada jarak tertentu
      }
    } else {
      // Patrol dalam batas minX..maxX; kembali ke zona bila di luar
      // (misalnya setelah chase jauh karena leash).
      if (s.x < s.minX) s.dir = 1;
      else if (s.x > s.maxX) s.dir = -1;
      s.vx = s.dir * SLIME_PATROL_SPEED;
    }

    applyGravity(s, dt);
    moveAndCollide(s, dt, Level.platforms);

    if (s.state === 'patrol') {
      // Balik arah saat menabrak tembok / tepi platform / batas patrol.
      if (s.hitWall) s.dir *= -1;
      if (!slimeHasGroundAhead(s)) s.dir *= -1;
      if (s.x <= s.minX) { s.x = s.minX; s.dir = 1; }
      if (s.x >= s.maxX) { s.x = s.maxX; s.dir = -1; }
    } else {
      // Chase: leash longgar dari titik spawn, bukan kunci zona patrol.
      var lo = s.spawnX - SLIME_LEASH, hi = s.spawnX + SLIME_LEASH;
      if (s.x < lo) s.x = lo;
      if (s.x > hi) s.x = hi;
    }

    if (s.y > WORLD_H + 100) { // jaring pengaman: kembali ke spawn
      s.x = s.spawnX; s.y = s.spawnY; s.vx = 0; s.vy = 0;
    }
  }

  /* ========================== 10. COMBAT ========================== */
  var Combat = {
    // Pukulan player -> semua slime yang overlap attackBox (sekali per swing).
    resolvePlayerAttack: function () {
      if (!player.attackBox) return;
      for (var i = 0; i < enemies.length; i++) {
        var s = enemies[i];
        if (s.dead || player.didStrikeHit[s.id]) continue;
        if (rectsOverlap(player.attackBox, s)) {
          player.didStrikeHit[s.id] = true;
          var px = player.x + player.w / 2;
          if (slimeTakeDamage(s, ATTACK_DAMAGE, px, ATTACK_KNOCKBACK)) {
            // Impact jelas tapi ringan: shake singkat (damage flash + suara
            // sudah di slimeTakeDamage).
            triggerScreenShake(SHAKE_HIT, 0.15);
          }
        }
      }
    },
    // Serangan slime -> player (sekali per attack slime).
    resolveEnemyAttacks: function () {
      if (player.state === 'death') return;
      setR(_r2, player.x, player.y, player.w, player.h);
      for (var i = 0; i < enemies.length; i++) {
        var s = enemies[i];
        if (s.dead || s.state !== 'attack' || s.struckPlayer) continue;
        if (s.atkT >= SLIME_WINDUP && s.atkT < SLIME_WINDUP + SLIME_STRIKE) {
          // Strike-box kecil di depan slime.
          if (s.dir === 1) setR(_r1, s.x + s.w - 6, s.y - 6, 32, s.h + 12);
          else setR(_r1, s.x - 26, s.y - 6, 32, s.h + 12);
          if (rectsOverlap(_r1, _r2)) {
            s.struckPlayer = true;
            playerTakeDamage(SLIME_DAMAGE, s.x + s.w / 2);
          }
        }
      }
    }
  };

  /* ============ 10b. FX: PARTIKEL, SHAKE, DEKOR (Tahap 3) ============
   * - Pool partikel preallocated MAX_PARTICLES: tanpa alokasi/GC di loop.
   * - Shake hanya offset render; camera.x tidak pernah bergeser permanen.
   * - Dekor parallax precomputed sekali di boot (seeded, deterministik).
   * ================================================================ */
  var particles = [];
  var particleCount = 0;
  var _pf;
  for (_pf = 0; _pf < MAX_PARTICLES; _pf++) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 3, grav: 0 });
  }

  function spawnParticle(x, y, vx, vy, life, color, size, grav) {
    for (var i = 0; i < particles.length; i++) {
      var pt = particles[i];
      if (!pt.active) {
        pt.active = true;
        pt.x = x; pt.y = y; pt.vx = vx; pt.vy = vy;
        pt.life = life; pt.maxLife = life;
        pt.color = color || '#ffffff';
        pt.size = size || 3;
        pt.grav = grav || 0;
        particleCount++;
        return true;
      }
    }
    return false; // pool penuh — spawn baru ditolak (batas maksimum)
  }

  function burst(x, y, n, color, speed, life, size, grav) {
    for (var k = 0; k < n; k++) {
      var a = Math.random() * Math.PI * 2;
      var sp = speed * (0.4 + Math.random() * 0.6);
      spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - speed * 0.35,
        life * (0.7 + Math.random() * 0.5), color, size, grav);
    }
  }

  function updateParticles(dt) {
    for (var i = 0; i < particles.length; i++) {
      var pt = particles[i];
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) { pt.active = false; particleCount--; continue; }
      pt.vy += pt.grav * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var pt = particles[i];
      if (!pt.active) continue;
      var a = pt.life / pt.maxLife;
      ctx.globalAlpha = a < 1 ? a : 1;
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  function clearParticles() {
    for (var i = 0; i < particles.length; i++) particles[i].active = false;
    particleCount = 0;
  }

  var shake = { mag: 0, t: 1, dur: 1, ox: 0, oy: 0 };

  function triggerScreenShake(amount, duration) {
    if (amount >= shake.mag || shake.t >= shake.dur) {
      shake.mag = amount;
      shake.t = 0;
      shake.dur = Math.max(0.01, duration);
    }
  }

  function updateShake(dt) {
    if (shake.t >= shake.dur) {
      shake.ox = 0; shake.oy = 0; shake.mag = 0;
      return;
    }
    shake.t += dt;
    var k = Math.max(0, 1 - shake.t / shake.dur);
    shake.ox = (Math.random() * 2 - 1) * shake.mag * k;
    shake.oy = (Math.random() * 2 - 1) * shake.mag * k * 0.6;
    if (shake.t >= shake.dur) { shake.ox = 0; shake.oy = 0; shake.mag = 0; }
  }

  function resetShake() {
    shake.mag = 0; shake.t = 1; shake.dur = 1; shake.ox = 0; shake.oy = 0;
  }

  var decorFar = [], decorMid = [], decorNear = [];
  (function buildDecor() {
    var seed = 12345;
    function rnd() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }
    var i;
    // Bintang: rentang layer jauh (WORLD_W*0.2 + VIEW_W agar penuh di semua cam).
    for (i = 0; i < 70; i++) {
      decorFar.push({ x: rnd() * (WORLD_W * PAR_FAR + VIEW_W), y: rnd() * 230, s: rnd() < 0.85 ? 2 : 3 });
    }
    for (i = 0; i < 9; i++) {
      decorMid.push({ x: i * 300 + rnd() * 120, w: 220 + rnd() * 140, h: 70 + rnd() * 60 });
    }
    for (i = 0; i < 12; i++) {
      decorNear.push({ x: i * 220 + rnd() * 100, w: 26 + rnd() * 30, h: 40 + rnd() * 50 });
    }
  })();

  /* ====================== 11. GAME STATE ====================== */
  var gameState = 'playing'; // playing | gameover | win
  var gameOverT = 0;
  var overlayEl = null;
  var restartBtn = null;   // "Ulangi dari Awal" (reset total)
  var respawnBtn = null;   // "Respawn di Checkpoint"
  var winOverlayEl = null;
  var againBtn = null;     // "Main Lagi" di layar menang

  // Checkpoint & statistik lari (vertical slice Tahap 2)
  var respawnPoint = { x: Level.playerSpawn.x, y: Level.playerSpawn.y };
  var deaths = 0;
  var timeElapsed = 0;
  var toast = { text: '', t: 0 };

  function showToast(text) {
    toast.text = text;
    toast.t = 2.2;
  }

  /* ---- Kamera side-scrolling: smooth, offset arah hadap, batas level ---- */
  var camera = { x: 0 };

  function cameraTarget() {
    var ahead = player.facing === 1 ? CAM_AHEAD_R : CAM_AHEAD_L;
    var t = (player.x + player.w / 2) - VIEW_W * ahead;
    return clamp(t, 0, WORLD_W - VIEW_W);
  }

  function updateCamera(dt) {
    var t = cameraTarget();
    camera.x += (t - camera.x) * Math.min(1, dt * CAM_SMOOTH);
    if (Math.abs(t - camera.x) < 0.5) camera.x = t;
  }

  function snapCamera() {
    camera.x = cameraTarget();
  }

  function playerCenterX() { return player.x + player.w / 2; }

  function getProgress() {
    var goalCX = Level.goal.x + Level.goal.w / 2;
    return clamp((playerCenterX() - Level.playerSpawn.x) / (goalCX - Level.playerSpawn.x), 0, 1);
  }

  function checkpointRect(cp) {
    return { x: cp.x, y: cp.baseY - cp.h, w: cp.w, h: cp.h };
  }

  function goalRect() {
    var g = Level.goal;
    return { x: g.x, y: g.baseY - g.h, w: g.w, h: g.h };
  }

  function checkCheckpoints() {
    if (player.state === 'death') return;
    setR(_r1, player.x, player.y, player.w, player.h);
    for (var i = 0; i < Level.checkpoints.length; i++) {
      var cp = Level.checkpoints[i];
      if (!cp.activated && rectsOverlap(_r1, checkpointRect(cp))) {
        cp.activated = true;
        respawnPoint = { x: cp.x - player.w / 2, y: cp.baseY - player.h };
        showToast('CHECKPOINT!');
        AudioManager.play('checkpoint');
      }
    }
  }

  function checkGoal() {
    if (player.state === 'death') return;
    setR(_r1, player.x, player.y, player.w, player.h);
    if (rectsOverlap(_r1, goalRect())) showWin();
  }

  function showGameOver() {
    if (gameState !== 'playing') return;
    gameState = 'gameover';
    gameOverT = 0;
    deaths++;
    AudioManager.play('gameover');
    if (overlayEl) overlayEl.classList.remove('hidden');
    if (respawnBtn && respawnBtn.focus) {
      try { respawnBtn.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
  }

  function showWin() {
    if (gameState !== 'playing') return;
    gameState = 'win';
    if (winOverlayEl) {
      var stat = document.getElementById('win-stats');
      if (stat) {
        stat.textContent = 'Waktu: ' + timeElapsed.toFixed(1) + ' dtk • Mati: ' + deaths +
          ' • Slime tersisa: ' + aliveEnemies();
      }
      winOverlayEl.classList.remove('hidden');
    }
    if (againBtn && againBtn.focus) {
      try { againBtn.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
    AudioManager.play('win');
  }

  function aliveEnemies() {
    var n = 0;
    for (var i = 0; i < enemies.length; i++) if (!enemies[i].dead) n++;
    return n;
  }

  // Respawn di checkpoint terakhir (atau spawn): HP pulih, musuh reset,
  // checkpoint TETAP aktif, timer & deaths lanjut. Efek sementara dibersihkan.
  // Tahap 4: selalu unpause + reset timer agar "restart setelah pause" aman.
  function respawn() {
    player = createPlayer();
    player.x = respawnPoint.x;
    player.y = respawnPoint.y;
    enemies = Level.enemySpawns.map(function (sp) { return createSlime(sp); });
    clearParticles();
    resetShake();
    Input.jumpPressed = false;
    Input.attackPressed = false;
    Input.restartPressed = false;
    gameState = 'playing';
    gameOverT = 0;
    snapCamera();
    if (overlayEl) overlayEl.classList.add('hidden');
    setPaused(false);
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    debugLog('[game] respawn di', respawnPoint.x, respawnPoint.y);
  }

  // Restart total: seperti game baru (checkpoint ikut reset).
  // Tahap 4: unpause agar tombol/tes "restart setelah pause" kembali main.
  function restart() {
    for (var i = 0; i < Level.checkpoints.length; i++) {
      Level.checkpoints[i].activated = false;
    }
    respawnPoint = { x: Level.playerSpawn.x, y: Level.playerSpawn.y };
    deaths = 0;
    timeElapsed = 0;
    toast.t = 0;
    clearParticles();
    resetShake();
    player = createPlayer();
    enemies = Level.enemySpawns.map(function (sp) { return createSlime(sp); });
    Input.jumpPressed = false;
    Input.attackPressed = false;
    Input.restartPressed = false;
    gameState = 'playing';
    gameOverT = 0;
    snapCamera();
    if (overlayEl) overlayEl.classList.add('hidden');
    if (winOverlayEl) winOverlayEl.classList.add('hidden');
    setPaused(false);
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    debugLog('[game] restart total');
  }

  /* ================== 12b. PAUSE / RESUME (Tahap 4) ==================
   * Tab disembunyikan / blur -> pause aman (dunia diam, audio suspend).
   * Kembali aktif -> `last` di-reset + dt clamp 0.05 sehingga tidak melonjak.
   * =================================================================== */
  var paused = false;

  function setPaused(v) {
    if (v === paused) return;
    paused = v;
    if (v) AudioManager.suspend();
    debugLog('[game] paused=', v);
  }

  function nowPerf() {
    try { return performance.now(); }
    catch (e) { return Date.now(); }
  }

  function onVisibility() {
    try {
      var hidden = !!(typeof document !== 'undefined' && document.hidden);
      setPaused(hidden);
      if (!hidden) last = nowPerf(); // cegah delta melonjak saat kembali
    } catch (e) { /* abaikan */ }
  }

  // Tahap 4: helper murni untuk clamp delta-time (diuji otomatis).
  // Aturan: dt tidak valid / >0.05 dtk => paksa 1/60 agar kembali dari
  // background tidak melonjak besar.
  function clampDt(dt) {
    if (!(dt > 0) || dt > 0.05) return 1 / 60;
    return dt;
  }

  /* ========================= 13. RENDER SETUP =========================
   * Backing store = 960x540 * renderScale (DPR dibatasi RENDER_SCALE_MAX).
   * Semua kode game memakai koordinat logis — collision tidak berubah.
   * =================================================================== */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function setupCanvas() {
    var dpr = 1;
    try {
      dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      if (!(dpr > 0) || !isFinite(dpr)) dpr = 1;
    } catch (e) { dpr = 1; }
    renderScale = Math.min(dpr, RENDER_SCALE_MAX);
    if (!(renderScale >= 1)) renderScale = 1;
    try {
      canvas.width = Math.round(VIEW_W * renderScale);
      canvas.height = Math.round(VIEW_H * renderScale);
    } catch (e) { /* headless aman */ }
    try {
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    } catch (e) { /* abaikan */ }
    ctx.imageSmoothingEnabled = false;
    return renderScale;
  }

  // Langit dibuat sekali di boot (tidak dialokasi per-frame).
  var skyGrad = null;

  // Langit + layer JAUH (0.2) + layer TENGAH (0.5): screen-space dengan
  // offset sendiri. Ringan: ~70 bintang + 9 bukit, culling di luar layar.
  function drawSkyFarMid() {
    ctx.fillStyle = skyGrad || '#232a5c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    var cx = camera.x, i, sx;
    // Bulan (layer jauh).
    ctx.fillStyle = '#f4f1d8';
    ctx.fillRect(Math.round(750 - cx * PAR_FAR), 50, 44, 44);
    ctx.fillStyle = '#d9d4b5';
    ctx.fillRect(Math.round(762 - cx * PAR_FAR), 62, 10, 10);
    ctx.fillStyle = '#8f97d6';
    for (i = 0; i < decorFar.length; i++) {
      sx = Math.round(decorFar[i].x - cx * PAR_FAR);
      if (sx < -4 || sx > VIEW_W + 4) continue;
      var sz = decorFar[i].s;
      ctx.fillRect(sx, decorFar[i].y | 0, sz, sz);
    }
    // Bukit siluet (layer tengah).
    ctx.fillStyle = '#232a5c';
    for (i = 0; i < decorMid.length; i++) {
      var h = decorMid[i];
      sx = Math.round(h.x - cx * PAR_MID);
      if (sx + h.w < 0 || sx > VIEW_W) continue;
      ctx.fillRect(sx, 480 - (h.h | 0), (h.w | 0), (h.h | 0));
    }
  }

  // Layer DEKAT (0.85): rumpun gelap di garis horizon. Screen-space dengan
  // offset sendiri (faktor PAR_NEAR) — digambar sebelum layer dunia 1.0.
  function drawNearLayer() {
    ctx.fillStyle = '#1a2048';
    for (var i = 0; i < decorNear.length; i++) {
      var b = decorNear[i];
      var sx = Math.round(b.x - camera.x * PAR_NEAR);
      if (sx + b.w < 0 || sx > VIEW_W) continue;
      ctx.fillRect(sx, 480 - (b.h | 0), (b.w | 0), (b.h | 0));
    }
  }

  function drawPlatforms() {
    for (var i = 0; i < Level.platforms.length; i++) {
      var p = Level.platforms[i];
      var isGround = (p.h > 30);
      ctx.fillStyle = isGround ? '#4a3b6b' : '#4d5aa8';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = isGround ? '#5ec46f' : '#7c8cf0';
      ctx.fillRect(p.x, p.y, p.w, 6);
      ctx.fillStyle = isGround ? '#3f9e52' : '#5b6ac4';
      ctx.fillRect(p.x, p.y + 6, p.w, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
      ctx.fillRect(p.x, p.y, 3, p.h);
      ctx.fillRect(p.x + p.w - 3, p.y, 3, p.h);
      // Tepi celah: garis peringatan kuning di ujung segmen tanah.
      if (isGround) {
        ctx.fillStyle = '#ffd23f';
        if (p.x > 0) ctx.fillRect(p.x, p.y, 4, 14);
        if (p.x + p.w < WORLD_W) ctx.fillRect(p.x + p.w - 4, p.y, 4, 14);
      }
    }
    // Penanda START di area awal.
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px monospace';
    ctx.fillText('START', 60, 465);
  }

  function drawCheckpoints() {
    for (var i = 0; i < Level.checkpoints.length; i++) {
      var cp = Level.checkpoints[i];
      var top = cp.baseY - cp.h;
      // Tiang + kaki.
      ctx.fillStyle = '#8a8fa8';
      ctx.fillRect(cp.x + 13, top, 6, cp.h);
      ctx.fillStyle = '#5a5e78';
      ctx.fillRect(cp.x + 8, cp.baseY - 8, 18, 8);
      // Bendera: abu-abu -> hijau saat aktif (+ kibaran 2-frame).
      var wave = cp.activated ? Math.floor(performance.now() / 200) % 2 : 0;
      ctx.fillStyle = cp.activated ? '#5ec46f' : '#6e7390';
      ctx.fillRect(cp.x + 19, top, 26, 16);
      if (wave) ctx.fillRect(cp.x + 19, top + 16, 20, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px monospace';
      ctx.fillText(cp.activated ? 'OK!' : 'CP' + (i + 1), cp.x - 2, top - 8);
    }
  }

  function drawGoal() {
    var r = goalRect();
    // Gapura finish: dua tiang emas + banner kotak-kotak.
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(r.x, r.y, 8, r.h);
    ctx.fillRect(r.x + r.w - 8, r.y, 8, r.h);
    for (var i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#111111' : '#ffffff';
      ctx.fillRect(r.x + 8 + i * 8, r.y, 8, 12);
      ctx.fillStyle = i % 2 ? '#ffffff' : '#111111';
      ctx.fillRect(r.x + 8 + i * 8, r.y + 12, 8, 12);
    }
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('FINISH', r.x - 8, r.y - 10);
  }

  function drawFacing(drawFn, x, centerX, facing) {
    ctx.save();
    if (facing === -1) {
      ctx.translate(centerX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-centerX, 0);
    }
    drawFn();
    ctx.restore();
  }

  function drawPlayer() {
    // I-frame blink (tidak berlaku saat death).
    if (player.state !== 'death' && player.iframes > 0) {
      if (Math.floor(player.animTime * 14) % 2 === 0) return;
    }
    var img = playerCurrentSprite();
    if (!img) return;
    // Squash pendaratan + napas idle (polish: offset piksel bulat, murah).
    var dw = PLAYER_DRAW, dh = PLAYER_DRAW;
    if (player.landT > 0) { dw = PLAYER_DRAW + 8; dh = PLAYER_DRAW - 8; }
    var dx = Math.round(player.x + player.w / 2 - dw / 2);
    var dy = Math.round(player.y + player.h - dh + 6);
    if (player.state === 'idle') dy += Math.round(Math.sin(player.animTime * 9));
    var cx = dx + dw / 2;
    drawFacing(function () {
      ctx.drawImage(img, dx, dy, dw, dh);
      // Hit flash singkat saat hurt.
      if (player.state === 'hurt') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(dx, dy, dw, dh);
      }
    }, dx, cx, player.facing);
  }

  // Efek tebasan: 3 garis energi mengikuti arah serangan, hanya fase strike.
  // Tanpa state tambahan — murni turunan dari attackBox yang sudah ada.
  function drawSlash() {
    if (!player.attackBox) return;
    var ab = player.attackBox;
    var fx = player.facing;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var i = 0; i < 3; i++) {
      var off = i * 12;
      var h = ab.h - 20 - i * 6;
      if (h < 4) h = 4;
      var x0 = fx === 1 ? ab.x + 6 + off : ab.x + ab.w - 11 - off;
      ctx.fillRect(Math.round(x0), Math.round(ab.y + 8 + i * 6), 5, h);
    }
    // Titik impact kuning di ujung ayunan.
    ctx.fillStyle = 'rgba(255,210,63,0.9)';
    var ex = fx === 1 ? ab.x + ab.w - 8 : ab.x + 2;
    ctx.fillRect(Math.round(ex), Math.round(ab.y + ab.h / 2 - 3), 6, 6);
  }

  /* Slime prosedural pixel-art: blob hijau + mata. Squash & stretch.
   * Hitbox (44x32) terpisah dari gambar — sesuai aturan plant.md. */
  function drawSlime(s) {
    var t = s.animTime;
    var squash = 1 + 0.07 * Math.sin(t * 7);
    var dw = Math.round(48 / squash), dh = Math.round(40 * squash);
    if (s.state === 'death') {
      var k = clamp(1 - s.deathT / SLIME_DEATH_DURATION, 0, 1);
      dh = Math.round(dh * (0.3 + 0.7 * k));
    }
    var dx = Math.round(s.x + s.w / 2 - dw / 2);
    var dy = Math.round(s.y + s.h - dh);
    var blink = s.iframes > 0 && Math.floor(t * 16) % 2 === 0;

    // Bayangan
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(Math.round(s.x + 4), Math.round(s.y + s.h - 3), s.w - 8, 4);

    var body = s.state === 'attack' && s.atkT < SLIME_WINDUP ? '#e05252' : '#4fc94f';
    var dark = '#2a8a3a', light = '#a5f0a0';

    ctx.fillStyle = blink ? '#ffffff' : body;
    ctx.fillRect(dx + 4, dy + 8, dw - 8, dh - 8);          // badan
    ctx.fillRect(dx + 8, dy + 3, dw - 16, 8);             // punuk atas
    ctx.fillStyle = dark;
    ctx.fillRect(dx + 4, dy + dh - 6, dw - 8, 6);         // perut bawah
    ctx.fillStyle = light;
    ctx.fillRect(dx + 8, dy + 6, 10, 5);                  // highlight

    // Mata (ikut arah hadap).
    var ex = s.dir === 1 ? dx + dw - 20 : dx + 8;
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex, dy + 12, 9, 11);
    ctx.fillRect(ex + 11, dy + 12, 9, 11);
    ctx.fillStyle = '#14142b';
    var pup = s.dir === 1 ? 3 : 0;
    ctx.fillRect(ex + 2 + pup, dy + 16, 4, 6);
    ctx.fillRect(ex + 13 + pup, dy + 16, 4, 6);

    // Telegraph windup: tanda seru pixel.
    if (s.state === 'attack' && s.atkT < SLIME_WINDUP) {
      ctx.fillStyle = '#ffd23f';
      var qx = Math.round(s.x + s.w / 2 - 2);
      ctx.fillRect(qx, dy - 18, 5, 10);
      ctx.fillRect(qx, dy - 5, 5, 5);
    }
  }

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
      if (!enemies[i].dead) drawSlime(enemies[i]);
    }
  }

  // HUD modern (screen-space, tidak ikut kamera): HP + progress + slime.
  function drawHUD() {
    ctx.textBaseline = 'middle';

    // --- Panel HP (kiri atas): ikon hati + bar + angka (teks + warna) ---
    var bx = 12, by = 12, bw = 210, bh = 24;
    var pct = clamp(player.hp / PLAYER_MAX_HP, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 4, by - 4, bw + 70, bh + 8);
    // Ikon hati pixel.
    ctx.fillStyle = player.hp > 0 ? '#e05252' : '#555';
    ctx.fillRect(bx, by + 4, 16, 16);
    ctx.fillRect(bx + 3, by + 1, 10, 5);
    ctx.fillRect(bx + 3, by + 17, 10, 5);
    ctx.fillStyle = '#20264d';
    ctx.fillRect(bx + 24, by, bw - 24, bh);
    ctx.fillStyle = pct > 0.5 ? '#5ec46f' : (pct > 0.25 ? '#ffd23f' : '#e05252');
    ctx.fillRect(bx + 24, by, Math.round((bw - 24) * pct), bh);
    // Kilau atas bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(bx + 24, by, Math.round((bw - 24) * pct), 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(player.hp + '/' + PLAYER_MAX_HP, bx + 34, by + bh / 2 + 1);

    // --- Progress level (tengah atas): player, checkpoint, goal ---
    var px = 330, pw = 300, py = 16, ph = 12;
    var prog = getProgress();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px - 6, py - 8, pw + 12, ph + 26);
    ctx.fillStyle = '#20264d';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#5a68b0';
    ctx.fillRect(px, py, Math.round(pw * prog), ph);
    var goalCX = Level.goal.x + Level.goal.w / 2;
    var span = goalCX - Level.playerSpawn.x;
    var i, mx;
    for (i = 0; i < Level.checkpoints.length; i++) {
      mx = px + Math.round(pw * (Level.checkpoints[i].x - Level.playerSpawn.x) / span);
      ctx.fillStyle = Level.checkpoints[i].activated ? '#5ec46f' : '#8a8fa8';
      ctx.fillRect(mx - 2, py - 3, 5, ph + 6);
    }
    // Bendera goal + panah player.
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(px + pw - 3, py - 6, 6, ph + 4);
    mx = px + Math.round(pw * prog);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 3, py - 5, 7, 6);
    ctx.fillRect(mx - 1, py + 1, 3, 8);
    ctx.fillStyle = '#c6ccea';
    ctx.font = '11px monospace';
    ctx.fillText('MAP ' + Math.round(prog * 100) + '%', px, py + ph + 9);

    // --- Slime tersisa (kanan atas): ikon + angka (teks + warna) ---
    var alive = aliveEnemies();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VIEW_W - 150, 8, 138, 32);
    ctx.fillStyle = '#4fc94f';
    ctx.fillRect(VIEW_W - 140, 16, 16, 12);
    ctx.fillRect(VIEW_W - 136, 12, 8, 5);
    ctx.fillStyle = alive > 0 ? '#a5f0a0' : '#8a8fa8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('SLIME x' + alive, VIEW_W - 118, 25);

    // --- Toast tengah (checkpoint / info) ---
    if (toast.t > 0) {
      var alpha = clamp(toast.t, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.6 * alpha).toFixed(2) + ')';
      var tw = 220;
      ctx.fillRect(VIEW_W / 2 - tw / 2, 56, tw, 30);
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(toast.text, VIEW_W / 2, 72);
      ctx.textAlign = 'left';
    }
  }

  function drawDebug(fps) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 92, 360, 128);
    ctx.fillStyle = '#8fff9f';
    ctx.font = '12px monospace';
    var label = player.state.toUpperCase();
    ctx.fillText('STATE:' + label + ' FACE:' + (player.facing === 1 ? 'R' : 'L'), 20, 106);
    ctx.fillText('FPS:' + fps.toFixed(0) + ' (' + msShown.toFixed(1) + 'ms)', 20, 122);
    ctx.fillText('POS:' + Math.round(player.x) + ',' + Math.round(player.y) +
      ' VY:' + Math.round(player.vy) + (player.onGround ? ' GND' : ' AIR'), 20, 138);
    ctx.fillText('CAM:' + Math.round(camera.x) + ' PROG:' + Math.round(getProgress() * 100) +
      '% CP:' + Level.checkpoints.map(function (c) { return c.activated ? 1 : 0; }).join('') +
      ' GS:' + gameState, 20, 154);
    ctx.fillText('PART:' + particleCount + '/' + MAX_PARTICLES +
      ' EN:' + enemies.length + ' SHAKE:' + shake.mag.toFixed(1), 20, 170);
    var dprTxt = '1';
    try { dprTxt = String(window.devicePixelRatio || 1); } catch (e) { /* abaikan */ }
    ctx.fillText('DSP:' + canvas.width + 'x' + canvas.height +
      ' DPR:' + dprTxt + ' x' + renderScale.toFixed(2), 20, 186);
    ctx.fillText('ATK box:' + (player.attackBox ? 'ON' : 'off') +
      ' EN0 hp:' + (enemies[0] ? enemies[0].hp : '-') +
      ' st:' + (enemies[0] ? enemies[0].state : '-'), 20, 202);
  }

  // Hitbox overlay — world-space, dipanggil di dalam transform kamera.
  function drawDebugBoxes() {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.strokeRect(player.x + 0.5, player.y + 0.5, player.w, player.h);
    if (player.attackBox) {
      ctx.strokeStyle = '#ff3333';
      ctx.strokeRect(player.attackBox.x + 0.5, player.attackBox.y + 0.5,
        player.attackBox.w, player.attackBox.h);
    }
    ctx.strokeStyle = '#ffdd00';
    for (var i = 0; i < enemies.length; i++) {
      var s = enemies[i];
      if (!s.dead) ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h);
    }
    ctx.strokeStyle = '#00ccff';
    for (var j = 0; j < Level.checkpoints.length; j++) {
      var c = checkpointRect(Level.checkpoints[j]);
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w, c.h);
    }
    var gr = goalRect();
    ctx.strokeRect(gr.x + 0.5, gr.y + 0.5, gr.w, gr.h);
  }

  function drawLoading() {
    ctx.fillStyle = '#1a1f3d';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Memuat sprite knight...', VIEW_W / 2, VIEW_H / 2);
    ctx.textAlign = 'left';
  }

  /* ========================= 14. MAIN LOOP ========================= */
  var last = 0, fpsAcc = 0, fpsN = 0, fpsShown = 60, msShown = 16.7;

  function drawPaused() {
    ctx.fillStyle = 'rgba(8,10,25,0.65)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.fillStyle = '#c6ccea';
    ctx.font = '14px monospace';
    ctx.fillText('Ketuk / klik untuk lanjut', VIEW_W / 2, VIEW_H / 2 + 20);
    ctx.textAlign = 'left';
  }

  function frame(t) {
    requestAnimationFrame(frame); // rantai tetap hidup saat pause (throttle browser)
    if (!assetsReady) { drawLoading(); return; }
    var dt = clampDt((t - last) / 1000);
    last = t;

    if (paused) { drawPaused(); return; } // dunia diam, audio sudah suspend

    if (DEBUG) {
      fpsAcc += 1 / dt; fpsN++;
      if (fpsN >= 20) {
        fpsShown = fpsAcc / fpsN;
        msShown = 1000 / (fpsShown > 0 ? fpsShown : 60);
        fpsAcc = 0; fpsN = 0;
      }
    }

    ctx.imageSmoothingEnabled = false;

    if (gameState === 'playing') {
      if (Input.restartPressed) Input.restartPressed = false;
      timeElapsed += dt;
      if (toast.t > 0) toast.t -= dt;
      updatePlayer(dt);
      Combat.resolvePlayerAttack();
      for (var i = 0; i < enemies.length; i++) updateSlime(enemies[i], dt);
      // Hapus slime yang selesai death (in-place, tanpa alokasi filter).
      for (var r = enemies.length - 1; r >= 0; r--) {
        if (enemies[r].dead) {
          enemies[r] = enemies[enemies.length - 1];
          enemies.pop();
        }
      }
      Combat.resolveEnemyAttacks();
      checkCheckpoints();
      checkGoal();
      updateShake(dt);
      updateParticles(dt);

      // Player death -> Game Over (beri jeda animasi death 1 detik).
      if (player.state === 'death' && player.deathT > 1.0) showGameOver();
      updateCamera(dt);
    } else if (gameState === 'gameover') {
      gameOverT += dt;
      updateShake(dt); // biarkan shake reda secara visual (gameplay sudah diam)
      // R / Enter = respawn di checkpoint (primer). Restart total via tombol.
      if (Input.restartPressed) { Input.restartPressed = false; respawn(); }
    } else { // win — dunia diam (partikel & timer ikut beku), overlay menang tampil
      updateShake(dt);
      if (Input.restartPressed) { Input.restartPressed = false; restart(); }
    }

    // Langit + parallax jauh/tengah (screen-space), lalu layer dekat (0.85,
    // screen-space dengan offset sendiri), lalu dunia 1.0 dengan offset
    // shake (render saja — camera.x tak berubah).
    drawSkyFarMid();
    drawNearLayer();
    var shx = Math.round(camera.x + shake.ox);
    var shy = Math.round(shake.oy);
    ctx.save();
    ctx.translate(-shx, shy);
    drawPlatforms();
    drawCheckpoints();
    drawGoal();
    drawEnemies();
    drawPlayer();
    drawSlash();
    drawParticles();
    if (DEBUG) drawDebugBoxes();
    ctx.restore();

    drawHUD();
    if (DEBUG) drawDebug(fpsShown);
  }

  /* ============================ 14. BOOT ============================ */
  overlayEl = document.getElementById('gameover');
  restartBtn = document.getElementById('btn-restart');
  respawnBtn = document.getElementById('btn-respawn');
  winOverlayEl = document.getElementById('levelcomplete');
  againBtn = document.getElementById('btn-again');

  bindHoldButton('btn-left',
    function () { Input.left = true; },
    function () { Input.left = false; });
  bindHoldButton('btn-right',
    function () { Input.right = true; },
    function () { Input.right = false; });
  bindHoldButton('btn-jump',
    function () { if (!Input.jumpHeld) Input.jumpPressed = true; Input.jumpHeld = true; },
    function () { Input.jumpHeld = false; });
  bindHoldButton('btn-attack',
    function () { Input.attackPressed = true; },
    function () { /* edge-trigger, tidak perlu off */ });

  if (restartBtn) {
    restartBtn.addEventListener('click', function () { restart(); });
  }
  if (respawnBtn) {
    respawnBtn.addEventListener('click', function () { respawn(); });
  }
  if (againBtn) {
    againBtn.addEventListener('click', function () { restart(); });
  }

  enemies = Level.enemySpawns.map(function (sp) { return createSlime(sp); });
  snapCamera();
  setupCanvas();

  // Pause aman: tab hidden (mobile) + blur (desktop alt-tab).
  try {
    if (document && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisibility);
    }
  } catch (e) { /* abaikan */ }
  window.addEventListener('blur', function () { setPaused(true); });
  window.addEventListener('focus', function () {
    try {
      if (typeof document !== 'undefined' && document.hidden) return;
    } catch (e) { /* abaikan */ }
    setPaused(false);
    last = nowPerf();
    try { AudioManager.unlock(); } catch (e) { /* abaikan */ }
  });
  // Ketuk/klik kanvas untuk lanjut (kasus pause via blur di desktop).
  // unlock() di sini aman: dipicu user-gesture sehingga audio boleh resume.
  if (canvas && canvas.addEventListener) {
    canvas.addEventListener('pointerdown', function () {
      try {
        if (paused && !(typeof document !== 'undefined' && document.hidden)) {
          setPaused(false);
          last = nowPerf();
          try { AudioManager.unlock(); } catch (e) { /* abaikan */ }
        }
      } catch (e) { /* abaikan */ }
    });
  }
  // DPR/orientasi berubah (rotasi HP): hitung ulang backing store, debounce.
  var resizeLast = 0;
  window.addEventListener('resize', function () {
    var n = nowPerf();
    if (n - resizeLast < 150) return;
    resizeLast = n;
    setupCanvas();
  });
  window.addEventListener('orientationchange', function () { setupCanvas(); });

  // Gradien langit dibuat sekali (bukan per-frame).
  try {
    skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    skyGrad.addColorStop(0, '#1b2350');
    skyGrad.addColorStop(0.6, '#2b3370');
    skyGrad.addColorStop(1, '#3a3f7d');
  } catch (e) { skyGrad = null; }

  // Audio unlock saat interaksi pertama (autoplay policy). Sekali saja.
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { AudioManager.unlock(); }, { once: true });
  });

  // Cegah scroll/zoom halaman saat sentuh area game (Android).
  var container = document.getElementById('canvas-container');
  if (container) {
    container.addEventListener('touchmove', function (e) {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  var allPaths = [];
  ANIM_ORDER.forEach(function (name) {
    SPRITE_PATHS[name].forEach(function (p) { allPaths.push({ name: name, src: p }); });
  });
  Promise.all(allPaths.map(function (e) { return loadImage(e.src); })).then(function (imgs) {
    for (var k = 0; k < allPaths.length; k++) {
      sprites[allPaths[k].name].push(imgs[k]);
    }
    assetsReady = true;
    debugLog('[asset] siap, error:', assetErrors.length);
  });

  requestAnimationFrame(function (t) { last = t; requestAnimationFrame(frame); });

  // Handle kecil untuk testing otomatis (tidak memengaruhi gameplay).
  window.KnightGame = {
    input: Input,
    config: { DEBUG: DEBUG },
    getPlayer: function () { return player; },
    getEnemies: function () { return enemies; },
    getState: function () { return gameState; },
    getCamera: function () { return camera; },
    getCheckpoints: function () { return Level.checkpoints; },
    getGoal: function () { return Level.goal; },
    getProgress: getProgress,
    getDeaths: function () { return deaths; },
    getRespawnPoint: function () { return respawnPoint; },
    getWorld: function () { return { w: WORLD_W, h: WORLD_H, viewW: VIEW_W }; },
    getTime: function () { return timeElapsed; },
    isPaused: function () { return paused; },
    setPaused: setPaused,
    handleVisibility: onVisibility,
    clampDt: clampDt,
    getAssetErrors: function () { return assetErrors; },
    hurtPlayer: function (n, x) { playerTakeDamage(n, x); },
    respawn: respawn,
    restart: restart,
    // Test-only: paksa state akhir agar "resume setelah Game Over / Win"
    // bisa diverifikasi headless tanpa menjalankan loop penuh.
    forceGameOver: showGameOver,
    forceWin: showWin,
    render: {
      scale: function () { return renderScale; },
      maxScale: function () { return RENDER_SCALE_MAX; },
      size: function () { return { w: canvas.width, h: canvas.height }; },
      rescan: setupCanvas
    },
    // Handle FX untuk testing (tidak memengaruhi gameplay).
    fx: {
      count: function () { return particleCount; },
      max: function () { return MAX_PARTICLES; },
      spawn: function (x, y) {
        spawnParticle(x, y, 0, -60, 0.5, '#ffffff', 3, 200);
        return particleCount;
      },
      shake: function (a, d) { triggerScreenShake(a, d); },
      shakeOffset: function () { return { x: shake.ox, y: shake.oy }; },
      audio: AudioManager
    }
  };
})();
