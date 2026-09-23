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
    // Stage 7: jalur terpisah — sfxG (SFX) dan musicG (BGM) sejajar ke
    // master, sehingga volume keduanya tidak saling mengganggu.
    var sfxG = null, musicG = null;
    // Stage 6: pengaturan audio (default = perilaku lama persis).
    var sfxOn = true, sfxVol = 1, musicOn = true, musicVol = 0.7;
    var BASE_GAIN = 0.16, MUSIC_LEVEL = 0.5;

    function applyGain() {
      try {
        if (master) master.gain.value = BASE_GAIN;
        if (sfxG) sfxG.gain.value = (sfxOn ? sfxVol : 0);
      } catch (e) { /* abaikan */ }
      musicTarget();
    }

    // Target gain BGM (ramp halus ~150-500ms; 0 = diam total).
    function musicTarget() {
      try {
        if (!musicG || !ctx) return;
        var t = (musicOn && musicVol > 0) ? musicVol * MUSIC_LEVEL : 0;
        if (!music.playing) t = 0;
        musicG.gain.setTargetAtTime(t, ctx.currentTime, 0.12);
      } catch (e) { /* abaikan */ }
    }

    function ensure() {
      if (ctx) return true;
      try {
        var AC = (typeof window !== 'undefined') &&
          (window.AudioContext || window.webkitAudioContext);
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = BASE_GAIN;
        master.connect(ctx.destination);
        sfxG = ctx.createGain();
        sfxG.connect(master);
        musicG = ctx.createGain();
        musicG.connect(master);
        applyGain(); // hormati pengaturan (default = perilaku lama)
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
        updateMusicState(); // BGM mengikuti setting setelah gesture
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
      o.connect(g); g.connect(sfxG || master);
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
      src.connect(f); f.connect(g); g.connect(sfxG || master);
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
      gameover:   function () { tone(220, 0.5, 'sawtooth', 0.4, 55); tone(110, 0.7, 'triangle', 0.4, 40, 0.1); },
      // Stage 5: event baru (menu, shard, varian, boss). Tetap prosedural.
      click:      function () { tone(660, 0.07, 'square', 0.3, 880); },
      pickup:     function () { tone(880, 0.09, 'square', 0.35, 1320); tone(1320, 0.12, 'square', 0.3, 1760, 0.07); },
      hitHeavy:   function () { noise(0.10, 0.5, 900); tone(140, 0.12, 'square', 0.45, 70); },
      bossAttack: function () { tone(160, 0.25, 'sawtooth', 0.45, 60); noise(0.15, 0.3, 700); },
      bossHurt:   function () { tone(240, 0.18, 'sawtooth', 0.45, 90); noise(0.10, 0.4, 1200); },
      bossDie:    function () { tone(300, 0.6, 'sawtooth', 0.45, 40); noise(0.5, 0.4, 800, 0.1); },
      shock:      function () { noise(0.18, 0.45, 600); tone(120, 0.18, 'triangle', 0.4, 50); }
    };

    /* ---- BGM prosedural (Stage 7): dark fantasy loop, Web Audio native ----
     * Komposisi D minor ~100 BPM: intro (pad+bass) -> motif -> variasi ->
     * motif -> loop. Layer: bass pulsa, pad akor, arpeggio, lead motif.
     * Scheduler lookahead dari game loop memakai AudioContext.currentTime
     * (tanpa setInterval). Semua node pendek ber-stop() pasti: tanpa bocor,
     * tanpa duplikat (start idempotent). */
    var MUS_BPM = 100;
    var MUS_STEP = 60 / MUS_BPM / 2; // ketuk 1/8 = 0.3 dtk
    var MUS_LOOP = 64;               // 8 bar x 8 ketuk (~19 dtk per loop)
    var MUS_AHEAD = 0.4;             // lookahead scheduler
    var MUS_CHORDS = [
      [57, 60, 62], // Dm
      [58, 62, 65], // Bb
      [55, 58, 62], // Gm
      [57, 61, 64]  // A
    ];
    var MUS_BASS = [38, 34, 31, 33]; // D2 Bb1 G1 A1
    // Motif utama (jarang, setengah nada) — 16 ketuk per akor, 0 = istirahat.
    var MUS_LEAD_A = [
      74, 0, 0, 0, 72, 0, 0, 0, 70, 0, 0, 0, 69, 0, 67, 0,
      70, 0, 0, 0, 69, 0, 0, 0, 67, 0, 0, 0, 65, 0, 67, 0,
      67, 0, 0, 0, 70, 0, 0, 0, 72, 0, 0, 0, 70, 0, 69, 0,
      69, 0, 0, 0, 73, 0, 0, 0, 72, 0, 69, 0, 67, 0, 65, 0
    ];
    // Variasi (rapat, arpeggio 1/8) — loop ganjil.
    var MUS_LEAD_B = [
      62, 65, 69, 72, 74, 72, 69, 65, 67, 69, 70, 72, 74, 0, 72, 0,
      70, 72, 74, 72, 70, 69, 67, 65, 67, 69, 70, 72, 70, 69, 67, 0,
      67, 70, 72, 74, 72, 70, 67, 65, 64, 65, 67, 69, 67, 65, 64, 0,
      69, 73, 72, 69, 67, 65, 64, 62, 64, 65, 67, 64, 62, 0, 0, 0
    ];

    var music = { playing: false, step: 0, loop: 0, next: 0, starts: 0 };
    var musicScheduled = 0;

    function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

    function musNote(m, t, dur, type, vol, cutoff) {
      try {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(midiHz(m), t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        if (cutoff) {
          var f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = cutoff;
          g.connect(f);
          f.connect(musicG);
        } else {
          g.connect(musicG);
        }
        o.start(t);
        o.stop(t + dur + 0.05);
        musicScheduled++;
      } catch (e) { /* abaikan */ }
    }

    function scheduleStep(s, t) {
      var bar = Math.floor(s / 16) % 4; // satu akor per 2 bar
      var ch = MUS_CHORDS[bar];
      var i;
      // Pad: awal tiap akor (3 nada, lembut, lowpass).
      if (s % 16 === 0) {
        for (i = 0; i < ch.length; i++) {
          musNote(ch[i], t, 16 * MUS_STEP, 'triangle', 0.045, 900);
        }
      }
      // Bass: intro (16 ketuk pertama) whole-note; lalu pulsa ketuk 0/4 + kuint di 6.
      if (s < 16) {
        if (s % 8 === 0) musNote(MUS_BASS[bar], t, 0.5, 'sine', 0.08);
      } else if (s % 2 === 0) {
        musNote(s % 8 === 6 ? MUS_BASS[bar] + 7 : MUS_BASS[bar], t, 0.26, 'triangle', 0.10);
      }
      if (s < 16) return; // intro: tanpa arp/lead
      // Arpeggio nada akor +12, bergilir tiap ketuk.
      musNote(ch[s % 3] + 12, t, 0.22, 'square', 0.030);
      // Lead: motif (loop genap) / variasi (loop ganjil).
      var lead = (music.loop % 2 === 0) ? MUS_LEAD_A : MUS_LEAD_B;
      if (lead[s] > 0) musNote(lead[s], t, 0.26, 'square', 0.055);
    }

    // Dipanggil tiap frame game loop (bukan interval): jadwalkan nada
    // sampai currentTime + lookahead. Aman saat suspended (clock beku).
    function musicTick() {
      if (!music.playing || !ctx) return;
      try {
        if (ctx.state !== 'running') return;
        while (music.next < ctx.currentTime + MUS_AHEAD) {
          scheduleStep(music.step, music.next);
          music.next += MUS_STEP;
          music.step++;
          if (music.step >= MUS_LOOP) { music.step = 0; music.loop++; }
        }
      } catch (e) { /* abaikan */ }
    }

    function startMusic() {
      if (music.playing) return; // anti duplikat: start kedua = no-op
      if (!ctx) return;          // belum unlock: mulai setelah gesture
      try {
        music.playing = true;
        music.step = 0;
        music.loop = 0;
        music.next = ctx.currentTime + 0.1;
        music.starts++;
        musicTarget(); // fade-in via musicG
      } catch (e) { music.playing = false; }
    }

    function stopMusic() {
      music.playing = false;
      musicTarget(); // fade-out via musicG (node terjadwal reda sendiri)
    }

    // Musik mengikuti state game + setting + pause. Tanpa loop kedua.
    function updateMusicState() {
      if (!ctx) return;
      try {
        if (ctx.state === 'suspended') {
          var pr = ctx.resume();
          if (pr && pr.catch) pr.catch(function () { /* abaikan */ });
        }
      } catch (e) { /* abaikan */ }
      if (!musicOn || musicVol <= 0) { stopMusic(); return; }
      if ((typeof gameState !== 'undefined' && gameState === 'playing' && !paused) ||
          (typeof gameState !== 'undefined' && gameState === 'menu')) {
        startMusic();
      } else {
        stopMusic(); // gameover/complete/settings: diam
      }
    }

    function musicInfo() {
      return { playing: music.playing, starts: music.starts,
               scheduled: musicScheduled,
               audible: !!(music.playing && musicOn && musicVol > 0) };
    }

    return {
      play: function (name) {
        // OFF / volume 0 = benar-benar diam (tanpa membuat node audio).
        if (!sfxOn || sfxVol <= 0) return;
        try { if (ctx && SFX[name]) SFX[name](); } catch (e) { /* abaikan */ }
      },
      unlock: unlock,
      suspend: suspend,
      isReady: function () { return !!ctx; },
      // Stage 6: volume 0-100 (clamp), berlaku langsung tanpa reload.
      setSfx: function (on, vol) {
        sfxOn = !!on;
        sfxVol = clamp(Math.round(Number(vol)) / 100, 0, 1);
        if (!(sfxVol >= 0)) sfxVol = 1;
        applyGain();
      },
      setMusic: function (on, vol) {
        musicOn = !!on;
        musicVol = clamp(Math.round(Number(vol)) / 100, 0, 1);
        if (!(musicVol >= 0)) musicVol = 0.7;
        musicTarget(); // live: gain BGM ikut serta tanpa reload
        updateMusicState();
      },
      getCfg: function () {
        return { sfxOn: sfxOn, sfxVol: Math.round(sfxVol * 100),
                 musicOn: musicOn, musicVol: Math.round(musicVol * 100),
                 muted: !(sfxOn && sfxVol > 0) };
      },
      // Stage 7: kontrol BGM eksplisit (idempotent, tanpa node bocor).
      startMusic: startMusic,
      stopMusic: stopMusic,
      updateMusicState: updateMusicState,
      musicTick: musicTick,
      musicInfo: musicInfo
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
   * Stage 5: dua level dalam struktur data yang sama (mudah diedit).
   * Level 1 = level existing PERSIS (physics/layout musuh/checkpoint/goal
   * tidak berubah) + rute Gold Shard (non-colliding, nol risiko regresi).
   * Level 2 = konten baru: traversal, 2 celah, encounter Fast+Heavy,
   * checkpoint, arena boss RAJA SLIME.
   * Zona Level 1:
   *   x 0-520     : starting area (tanah datar, spawn 80)
   *   x 520-610   : CELAH 1 (90px — harus dilompati)
   *   x 610-1050  : platform bertingkat rendah
   *   x 1050-1140 : CELAH 2 (90px)
   *   x 1140-1750 : ARENA COMBAT (datar, 3 slime)
   *   x 1750-2400 : pendakian akhir + GOAL di x ~2280
   * Lompatan penuh: tinggi ~128px, jarak ~134px — semua rute bisa dilalui.
   * ================================================================ */
  var GROUND_TOP = 480;
  var Level1 = {
    name: 'Level 1',
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
    goal: { x: 2280, baseY: 480, w: 70, h: 120 },
    bossSpawn: null,
    bossArena: null,
    // Gold Shard: mudah = eksplorasi, menengah = traversal,
    // sulit = risk/reward (HARD di atas celah — diambil sambil melompat).
    shards: [
      { x: 250, y: 430 },   // tanah start (mudah)
      { x: 350, y: 258 },   // atas platform 300,300 (menengah)
      { x: 565, y: 378 },   // atas CELAH 1: lompat untuk mengambil (sulit)
      { x: 1250, y: 430 },  // arena combat (lawan Slime)
      { x: 1470, y: 258 },  // atas platform arena (menengah)
      { x: 2200, y: 430 }   // dekat goal (menengah)
    ]
  };
  /* Level 2 (Stage 5): traversal baru + encounter varian + arena boss.
   *   x 0-420     : start datar (spawn 80)
   *   x 420-510   : CELAH 1 (90px)
   *   x 510-1010  : dataran + fast slime
   *   x 1010-1100 : CELAH 2 (90px)
   *   x 1100-1520 : arena encounter (heavy slime)
   *   x 1520-1820 : pendakian + fast slime kedua
   *   x 1820-1910 : CELAH 3 (90px, sebelum boss)
   *   x 1910-2400 : ARENA BOSS (datar lebar 490px, RAJA SLIME)
   * goal: null — Level 2 selesai saat boss dikalahkan. */
  var Level2 = {
    name: 'Level 2',
    playerSpawn: { x: 80, y: 300 },
    platforms: [
      { x: 0,    y: 480, w: 420,  h: 60 },  // start
      { x: 510,  y: 480, w: 500,  h: 60 },  // dataran fast encounter
      { x: 1100, y: 480, w: 420,  h: 60 },  // arena heavy encounter
      { x: 1520, y: 480, w: 300,  h: 60 },  // pendakian
      { x: 1910, y: 480, w: 490,  h: 60 },  // arena boss
      // Rute atas opsional (langkah <=115px, di luar koridor celah).
      { x: 150,  y: 372, w: 140, h: 20 },
      { x: 560,  y: 365, w: 140, h: 20 },
      { x: 730,  y: 290, w: 130, h: 20 },
      { x: 1140, y: 372, w: 140, h: 20 },
      { x: 1330, y: 297, w: 130, h: 20 },
      { x: 1560, y: 365, w: 130, h: 20 },
      { x: 1690, y: 290, w: 120, h: 20 },
      { x: 2050, y: 350, w: 140, h: 20 }    // pijakan taktik di arena boss
    ],
    enemySpawns: [
      { type: 'fast',  x: 700,  y: 448, minX: 560,  maxX: 960  }, // solo: tekanan mobilitas
      { type: 'heavy', x: 1250, y: 440, minX: 1130, maxX: 1560 }, // solo: tekanan ruang/timing
      { type: 'fast',  x: 1620, y: 448, minX: 1500, maxX: 1790 }  // kombo: overlap 1500-1560 vs heavy
    ],
    checkpoints: [
      { x: 1140, baseY: 480, w: 34, h: 96, activated: false }, // tengah
      { x: 1935, baseY: 480, w: 34, h: 96, activated: false }  // gerbang boss
    ],
    goal: null, // boss sebagai final encounter
    bossSpawn: { x: 2150, y: 380 },
    bossArena: { minX: 1930, maxX: 2360 },
    shards: [
      { x: 250, y: 430 },   // start
      { x: 465, y: 380 },   // bibir celah 1 (risiko kecil)
      { x: 795, y: 250 },   // atas platform tinggi
      { x: 1055, y: 380 },  // bibir celah 2
      { x: 1395, y: 257 },  // atas platform arena
      { x: 1750, y: 250 },  // pendakian atas
      { x: 1865, y: 380 },  // bibir celah 3
      { x: 2250, y: 430 }   // sudut arena boss
    ]
  };
  var Levels = [Level1, Level2];
  var currentLevel = 1;
  // Pointer level aktif — seluruh sistem (fisika, kamera, render) membaca
  // dari sini sehingga ganti level = tukar pointer + reset state.
  var Level = Levels[0];

  /* Stage 8: identitas visual per level (data saja, pixel-art compatible).
   * Level 1 = cerah (fantasy onboarding); Level 2 = gelap/mengancam
   * (foreshadowing boss). Tanpa texture system baru. */
  var LEVEL_THEME = [
    { sky: ['#1b2350', '#2b3370', '#3a3f7d'],
      ground: '#4a3b6b', grass: '#5ec46f', grassD: '#3f9e52',
      plat: '#4d5aa8', platTop: '#7c8cf0', platD: '#5b6ac4',
      moon: '#f4f1d8', moonD: '#d9d4b5' },
    { sky: ['#100c28', '#221542', '#3d1f4d'],
      ground: '#33244d', grass: '#a04d5e', grassD: '#5c2f47',
      plat: '#3a2f5c', platTop: '#6b5a9e', platD: '#463a75',
      moon: '#e08a7a', moonD: '#a05a4a' }
  ];

  function levelTheme() {
    return LEVEL_THEME[currentLevel - 1] || LEVEL_THEME[0];
  }

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
      attackT: 0, attackCooldown: 0, didStrikeHit: {},
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
    player.didStrikeHit = {};
    player.attackBox = null;
    // Ayunan baru selalu mulai tanpa buffer (B2): queued basi dari ayunan
    // yang di-interrupt hurt/death tidak boleh bocor ke kombo berikutnya.
    // Kombo/buffer normal aman: queued hanya di-set selama ayunan berjalan.
    player.queued = false;
    AudioManager.play('attack');
  }

  function playerTakeDamage(amount, fromX) {
    if (player.state === 'death' || player.iframes > 0) return;
    // Serangan sendiri tidak bisa di-interrupt oleh hurt yang baru? tetap bisa — prioritaskan hurt.
    player.hp -= amount;
    AudioManager.play('hurt');
    triggerScreenShake(SHAKE_HURT, 0.25);
    // Feedback jelas saat terkena: cipratan merah (pool bounded).
    burst(player.x + player.w / 2, player.y + player.h / 2, 6, '#e05252', 150, 0.4, 3, 300);
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
      AudioManager.play('hurt'); // umpan instan; jingle 'gameover' menyusul di overlay
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

  /* ====================== 9. ENEMY (SLIME) ======================
   * Stage 5: tabel stats reusable untuk varian. Entri 'slime' memakai
   * konstanta yang sama persis seperti sebelumnya sehingga perilaku
   * slime klasik tidak berubah sedikit pun. Varian hanya menambah entri.
   * =================================================================== */
  var slimeUid = 0;

  var ENEMY_STATS = {
    slime: { hp: SLIME_MAX_HP, w: SLIME_W, h: SLIME_H,
      patrol: SLIME_PATROL_SPEED, chase: SLIME_CHASE_SPEED,
      detectX: SLIME_DETECT_X, detectY: SLIME_DETECT_Y,
      range: SLIME_ATTACK_RANGE, dmg: SLIME_DAMAGE,
      windup: SLIME_WINDUP, strike: SLIME_STRIKE,
      recovery: SLIME_RECOVERY, cooldown: SLIME_COOLDOWN,
      knockResist: 1, hitSound: 'hit',
      body: '#4fc94f', dark: '#2a8a3a', light: '#a5f0a0', label: 'SLIME' },
    // Fast Slime: HP rendah, gerak & serang cepat, damage moderat.
    fast: { hp: 20, w: 40, h: 28,
      patrol: 70, chase: 140, detectX: 250, detectY: 130,
      range: 48, dmg: 8, windup: 0.25, strike: 0.12,
      recovery: 0.40, cooldown: 0.70,
      knockResist: 1, hitSound: 'hit',
      body: '#4fc9c9', dark: '#2a7a8a', light: '#a5f0f0', label: 'FAST' },
    // Heavy Slime: HP tinggi, lambat, tahan knockback, damage tinggi,
    // telegraph lebih jelas (windup panjang + warna merah).
    heavy: { hp: 60, w: 56, h: 40,
      patrol: 30, chase: 60, detectX: 210, detectY: 110,
      range: 58, dmg: 18, windup: 0.50, strike: 0.18,
      recovery: 0.60, cooldown: 1.10,
      knockResist: 0.35, hitSound: 'hitHeavy',
      body: '#9a5fc9', dark: '#5a2a8a', light: '#d0a5f0', label: 'HEAVY' }
  };

  // R1: lookup own-property yang aman — kunci prototype-chain seperti
  // 'constructor'/'toString' tak boleh menghasilkan stat invalid/NaN.
  function enemyKindOf(type) {
    return Object.prototype.hasOwnProperty.call(ENEMY_STATS, type) ? type : 'slime';
  }

  function createSlime(spawn) {
    var kind = enemyKindOf(spawn.type);
    var st = ENEMY_STATS[kind];
    return {
      id: ++slimeUid,
      kind: kind,
      st: st,
      x: spawn.x, y: spawn.y, w: st.w, h: st.h,
      vx: 0, vy: 0, onGround: false, hitWall: false,
      spawnX: spawn.x, spawnY: spawn.y,
      minX: spawn.minX, maxX: spawn.maxX,
      dir: -1,
      hp: st.hp,
      state: 'patrol', // patrol|chase|attack|hurt|death
      animTime: Math.random() * 10,
      atkT: 0, cooldown: 0, hurtT: 0, deathT: 0,
      iframes: 0, struckPlayer: false,
      dead: false
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
    AudioManager.play(s.st.hitSound || 'hit');
    if (s.hp <= 0) {
      s.hp = 0;
      s.state = 'death';
      s.deathT = 0;
      s.vx = 0;
      // Poof kematian + shake kecil (warna mengikuti varian).
      burst(s.x + s.w / 2, s.y + s.h / 2, 10, s.st.body, 170, 0.6, 4, 350);
      burst(s.x + s.w / 2, s.y + s.h / 2, 5, s.st.light, 120, 0.5, 3, 300);
      triggerScreenShake(SHAKE_DIE, 0.2);
      AudioManager.play('slimeDie');
      return true;
    }
    s.state = 'hurt';
    s.hurtT = 0;
    var dir = (s.x + s.w / 2) < fromX ? -1 : 1;
    // Heavy: knockback resistance (fraksi dari knock normal).
    s.vx = dir * (knock || ATTACK_KNOCKBACK) * (s.st.knockResist || 1);
    s.vy = -260;
    s.onGround = false;
    return true;
  }

  function slimeSeesPlayer(s) {
    if (player.state === 'death' || gameState !== 'playing') return false;
    var px = player.x + player.w / 2, sx = s.x + s.w / 2;
    var py = player.y + player.h / 2, sy = s.y + s.h / 2;
    return Math.abs(px - sx) < s.st.detectX && Math.abs(py - sy) < s.st.detectY;
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
      var strikeEnd = s.st.windup + s.st.strike;
      var total = strikeEnd + s.st.recovery;
      // Lunge ke arah player hanya saat strike.
      if (s.atkT >= s.st.windup && s.atkT < strikeEnd) {
        s.vx = s.dir * s.st.chase * 1.6;
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
        s.cooldown = s.st.cooldown;
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
      if (distX <= s.st.range && s.cooldown <= 0 && Math.abs((player.y + player.h) - (s.y + s.h)) < 60) {
        s.state = 'attack';
        s.atkT = 0;
        s.struckPlayer = false;
        s.dir = px >= sx ? 1 : -1;
        s.vx = 0;
        AudioManager.play('attack');
      } else if (distX > s.st.range * 0.7) {
        s.dir = px >= sx ? 1 : -1;
        s.vx = s.dir * s.st.chase;
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
      s.vx = s.dir * s.st.patrol;
    }

    applyGravity(s, dt);
    moveAndCollide(s, dt, Level.platforms);

    if (s.state === 'patrol') {
      // Balik arah saat menabrak tembok / tepi platform / batas patrol.
      // B3: hanya SATU reversal per frame (else-if) agar keduanya tak
      // saling membatalkan saat terjadi bersamaan.
      if (s.hitWall) s.dir *= -1;
      else if (!slimeHasGroundAhead(s)) s.dir *= -1;
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
    // Stage 5: juga mengenai boss (kunci 'boss' agar sekali per ayunan).
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
      if (boss && !boss.dead && boss.state !== 'death' && !player.didStrikeHit.boss) {
        if (rectsOverlap(player.attackBox, boss)) {
          player.didStrikeHit.boss = true;
          if (hurtBoss(ATTACK_DAMAGE, player.x + player.w / 2)) {
            triggerScreenShake(SHAKE_HIT, 0.15);
          }
        }
      }
    },
    // Serangan slime -> player (sekali per attack slime).
    // Stage 5: serangan strike boss (sekali per pola).
    resolveEnemyAttacks: function () {
      if (player.state === 'death') return;
      setR(_r2, player.x, player.y, player.w, player.h);
      for (var i = 0; i < enemies.length; i++) {
        var s = enemies[i];
        if (s.dead || s.state !== 'attack' || s.struckPlayer) continue;
        if (s.atkT >= s.st.windup && s.atkT < s.st.windup + s.st.strike) {
          // Strike-box kecil di depan slime.
          if (s.dir === 1) setR(_r1, s.x + s.w - 6, s.y - 6, 32, s.h + 12);
          else setR(_r1, s.x - 26, s.y - 6, 32, s.h + 12);
          if (rectsOverlap(_r1, _r2)) {
            s.struckPlayer = true;
            playerTakeDamage(s.st.dmg, s.x + s.w / 2);
          }
        }
      }
      if (boss && !boss.dead && boss.state === 'strike' && !boss.struckPlayer) {
        if (boss.atkT >= 0 && boss.atkT < 0.2) {
          if (boss.dir === 1) setR(_r1, boss.x + boss.w - 8, boss.y - 8, 48, boss.h + 16);
          else setR(_r1, boss.x - 40, boss.y - 8, 48, boss.h + 16);
          if (rectsOverlap(_r1, _r2)) {
            boss.struckPlayer = true;
            playerTakeDamage(BOSS_STRIKE_DMG, boss.x + boss.w / 2);
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
  // Stage 5: 'menu' (awal) + 'levelcomplete' + 'gamecomplete' melengkapi
  // state lama ('playing','gameover','win' dipertahankan apa adanya).
  var gameState = 'menu'; // menu|playing|gameover|win|levelcomplete|gamecomplete
  var gameOverT = 0;
  var overlayEl = null;
  var restartBtn = null;   // "Ulangi dari Awal" (reset total)
  var respawnBtn = null;   // "Respawn di Checkpoint"
  var btnGameOverMenu = null; // "MENU" di Game Over -> toMenu() yang ada
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
    // Level tanpa goal fisik (Level 2): progres menuju arena boss.
    if (!Level.goal) {
      if (Level.bossSpawn) {
        return clamp((playerCenterX() - Level.playerSpawn.x) / (Level.bossSpawn.x - Level.playerSpawn.x), 0, 1);
      }
      return 0;
    }
    var goalCX = Level.goal.x + Level.goal.w / 2;
    return clamp((playerCenterX() - Level.playerSpawn.x) / (goalCX - Level.playerSpawn.x), 0, 1);
  }

  function checkpointRect(cp) {
    return { x: cp.x, y: cp.baseY - cp.h, w: cp.w, h: cp.h };
  }

  function goalRect() {
    var g = Level.goal;
    if (!g) return null;
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
    if (!Level.goal || player.state === 'death') return;
    setR(_r1, player.x, player.y, player.w, player.h);
    // Level 1 finish -> layar Level Complete baru; legacy 'win'
    // dipertahankan untuk kompatibilitas (forceWin/testing).
    if (rectsOverlap(_r1, goalRect())) {
      if (currentLevel === 1) showLevelComplete();
      else showWin();
    }
  }

  function showGameOver() {
    if (gameState !== 'playing') return;
    gameState = 'gameover';
    gameOverT = 0;
    deaths++;
    // Persistent: total kematian lintas sesi (event-driven, bukan per-frame).
    save.totalDeaths++;
    persistSave();
    AudioManager.play('gameover');
    AudioManager.updateMusicState(); // BGM gameplay fade-out
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
    AudioManager.updateMusicState();
  }

  function aliveEnemies() {
    var n = 0;
    for (var i = 0; i < enemies.length; i++) if (!enemies[i].dead) n++;
    return n;
  }

  /* ============ 11b. STAGE 5: BOSS, SHARD, STATS, TRANSISI ============
   * Semua memakai sistem existing (fisika, partikel, shake, audio).
   * Tidak ada rAF/interval baru, tidak ada alokasi di loop panas
   * (shockwave dibatasi + hapus swap-pop in-place).
   * ================================================================ */
  var BOSS_MAX_HP = 120, BOSS_W = 64, BOSS_H = 56;
  var BOSS_DETECT_X = 420, BOSS_DETECT_Y = 170;
  var BOSS_PATTERNS = ['strike', 'charge', 'shock'];
  var BOSS_STRIKE_DMG = 15, BOSS_CHARGE_DMG = 18, BOSS_SHOCK_DMG = 12;

  var boss = null;
  var shocks = [];
  var shards = [];
  var runStats = { kills: 0, shards: 0 };     // total lintas level
  var levelStats = { kills: 0, shards: 0, time: 0 }; // per level
  var victoryArmed = false, victoryT = 0;
  var VICTORY_DELAY = 1.2;
  var trans = { active: false, phase: '', t: 0, dur: 0.25, target: 1 };

  // Overlay Stage 5 (diisi saat boot, semua null-guard).
  var menuEl = null, menuMain = null, menuControls = null, menuAbout = null;
  var btnPlay = null, btnControls = null, btnAbout = null;
  var btnBackC = null, btnBackA = null;
  var lvlclearEl = null, lvlclearStats = null;
  var btnNext = null, btnReplay = null, btnLvlMenu = null;
  var gameclearEl = null, gameclearStats = null;
  var btnAgain2 = null, btnGameMenu = null;

  function createBoss(spawn, arena) {
    return {
      id: ++slimeUid, kind: 'boss',
      x: spawn.x, y: spawn.y, w: BOSS_W, h: BOSS_H,
      vx: 0, vy: 0, onGround: false, hitWall: false,
      spawnX: spawn.x, spawnY: spawn.y,
      arenaMin: arena.minX, arenaMax: arena.maxX,
      dir: -1, hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP,
      state: 'idle', // idle|telegraph|strike|charge|shock|recovery|hurt|death
      animTime: 0, idleT: 0, teleT: 0, teleDur: 0.5,
      atkT: 0, recT: 0, recDur: 0.6,
      pattern: 'strike', patIdx: 0, cooldown: 1.0,
      hurtT: 0, deathT: 0, iframes: 0, struckPlayer: false,
      enraged: false, dead: false,
      introduced: false, dustT: 0 // intro arena + debu charge (visual saja)
    };
  }

  function bossSeesPlayer(b) {
    if (player.state === 'death' || gameState !== 'playing') return false;
    var px = player.x + player.w / 2, bx = b.x + b.w / 2;
    var py = player.y + player.h / 2, by = b.y + b.h / 2;
    return Math.abs(px - bx) < BOSS_DETECT_X && Math.abs(py - by) < BOSS_DETECT_Y;
  }

  function hurtBoss(amount, fromX) {
    var b = boss;
    if (!b || b.dead || b.state === 'death' || b.iframes > 0) return false;
    b.hp -= amount;
    b.iframes = 0.3;
    burst(b.x + b.w / 2, b.y + b.h / 2, 8, '#ffffff', 180, 0.3, 3, 250);
    burst(b.x + b.w / 2, b.y + b.h / 2, 5, '#ffd23f', 140, 0.35, 3, 250);
    AudioManager.play('bossHurt');
    // B4: death diprioritaskan — killing blow tak boleh memicu enrage.
    if (b.hp <= 0) {
      b.hp = 0;
      b.state = 'death';
      b.deathT = 0;
      b.vx = 0;
      burst(b.x + b.w / 2, b.y + b.h / 2, 16, '#ffd23f', 220, 0.8, 4, 350);
      burst(b.x + b.w / 2, b.y + b.h / 2, 10, '#ffffff', 160, 0.7, 3, 300);
      triggerScreenShake(SHAKE_DIE + 2, 0.4);
      AudioManager.play('bossDie');
      return true;
    }
    if (!b.enraged && b.hp <= 40) {
      b.enraged = true;
      burst(b.x + b.w / 2, b.y, 12, '#e05252', 200, 0.6, 4, 300);
      triggerScreenShake(SHAKE_HURT, 0.3);
      AudioManager.play('bossAttack');
      showToast('RAJA SLIME MURKA!');
    }
    b.state = 'hurt';
    b.hurtT = 0;
    var dir = (b.x + b.w / 2) < fromX ? -1 : 1;
    b.vx = dir * ATTACK_KNOCKBACK * (b.enraged ? 0.25 : 0.4);
    b.vy = -240;
    b.onGround = false;
    // Boss terkena: feedback lebih kuat (shake + yang sudah ada).
    triggerScreenShake(SHAKE_HIT, 0.12);
    return true;
  }

  function updateBoss(b, dt) {
    b.animTime += dt;
    if (b.iframes > 0) b.iframes -= dt;
    if (b.cooldown > 0) b.cooldown -= dt;
    var px = player.x + player.w / 2, bx = b.x + b.w / 2;
    var spdMul = b.enraged ? 1.25 : 1, cdMul = b.enraged ? 0.65 : 1;

    if (b.state === 'death') {
      b.deathT += dt;
      b.vx = 0;
      applyGravity(b, dt);
      moveAndCollide(b, dt, Level.platforms);
      if (b.deathT >= 1.0 && !b.dead) {
        b.dead = true;
        runStats.kills++;
        levelStats.kills++;
        victoryArmed = true;
        victoryT = 0;
      }
      return;
    }

    if (b.state === 'hurt') {
      b.hurtT += dt;
      applyGravity(b, dt);
      moveAndCollide(b, dt, Level.platforms);
      if (b.hurtT >= 0.25) { b.state = 'idle'; b.idleT = 0; }
    } else if (b.state === 'idle') {
      b.vx = 0;
      b.idleT += dt;
      b.dir = px >= bx ? 1 : -1;
      // Opening: presentasi saat pemain memasuki zona boss (sekali per boss).
      if (!b.introduced && player.x > b.arenaMin - 120) {
        b.introduced = true;
        showToast('RAJA SLIME MUNCUL!');
        AudioManager.play('bossAttack');
        triggerScreenShake(SHAKE_HURT, 0.3);
      }
      if (b.idleT >= 0.5 && b.cooldown <= 0 && bossSeesPlayer(b)) {
        b.pattern = BOSS_PATTERNS[b.patIdx % BOSS_PATTERNS.length];
        b.patIdx++;
        b.teleDur = b.pattern === 'charge' ? 0.6 : 0.5;
        b.teleT = 0;
        b.state = 'telegraph';
        AudioManager.play('bossAttack'); // telegraph terbaca via suara
      }
    } else if (b.state === 'telegraph') {
      b.vx = 0;
      b.teleT += dt;
      b.dir = px >= bx ? 1 : -1;
      if (b.teleT >= b.teleDur) {
        b.state = b.pattern; // strike | charge | shock
        b.atkT = 0;
        b.struckPlayer = false;
        if (b.pattern === 'shock') {
          spawnShocks(b);
          AudioManager.play('shock');
        }
      }
    } else if (b.state === 'strike') {
      b.atkT += dt;
      if (b.atkT < 0.2) b.vx = b.dir * 165 * spdMul;
      else b.vx = 0;
      if (b.atkT >= 0.8) { b.state = 'recovery'; b.recT = 0; b.recDur = 0.6; b.cooldown = 1.0 * cdMul; }
    } else if (b.state === 'charge') {
      b.atkT += dt;
      if (b.atkT < 0.45 && !b.hitWall) {
        b.vx = b.dir * 380 * spdMul;
        // Enrage terasa beda: debu charge (visual saja, pool bounded).
        if (b.enraged) {
          b.dustT -= dt;
          if (b.dustT <= 0) {
            b.dustT = 0.08;
            spawnParticle(b.x + b.w / 2, b.y + b.h - 2,
              (Math.random() * 2 - 1) * 60, -40, 0.4, '#8a7a9e', 3, 200);
          }
        }
        // Contact damage sekali per charge.
        if (!b.struckPlayer && player.state !== 'death') {
          setR(_r1, b.x, b.y, b.w, b.h);
          setR(_r2, player.x, player.y, player.w, player.h);
          if (rectsOverlap(_r1, _r2)) {
            b.struckPlayer = true;
            playerTakeDamage(BOSS_CHARGE_DMG, bx);
          }
        }
      } else {
        b.vx = 0;
        b.state = 'recovery'; b.recT = 0; b.recDur = 0.8; b.cooldown = 1.6 * cdMul;
      }
    } else if (b.state === 'shock') {
      b.atkT += dt;
      b.vx = 0;
      if (b.atkT >= 0.3) { b.state = 'recovery'; b.recT = 0; b.recDur = 0.7; b.cooldown = 1.8 * cdMul; }
    } else if (b.state === 'recovery') {
      b.vx = 0;
      b.recT += dt;
      if (b.recT >= b.recDur) { b.state = 'idle'; b.idleT = 0; }
    }

    applyGravity(b, dt);
    moveAndCollide(b, dt, Level.platforms);
    // Boss tidak boleh keluar arena maupun level.
    if (b.x < b.arenaMin) { b.x = b.arenaMin; b.vx = 0; }
    if (b.x > b.arenaMax) { b.x = b.arenaMax; b.vx = 0; }
    if (b.y > WORLD_H + 100) { b.x = b.spawnX; b.y = b.spawnY; b.vx = 0; b.vy = 0; }
  }

  function spawnShocks(b) {
    if (shocks.length >= 6) return; // batas: tanpa spam
    var gy = b.y + b.h - 40;
    for (var d = -1; d <= 1; d += 2) {
      shocks.push({ x: b.x + b.w / 2 - 13, y: gy, w: 26, h: 40,
        vx: d * 230, life: 1.6, dmg: BOSS_SHOCK_DMG, hitDone: false,
        minX: b.arenaMin - 60, maxX: b.arenaMax + 60 });
    }
  }

  function updateShocks(dt) {
    for (var i = shocks.length - 1; i >= 0; i--) {
      var sh = shocks[i];
      sh.x += sh.vx * dt;
      sh.life -= dt;
      if (!sh.hitDone && player.state !== 'death') {
        setR(_r1, sh.x, sh.y, sh.w, sh.h);
        setR(_r2, player.x, player.y, player.w, player.h);
        if (rectsOverlap(_r1, _r2)) {
          sh.hitDone = true;
          playerTakeDamage(sh.dmg, sh.x + sh.w / 2);
        }
      }
      if (sh.life <= 0 || sh.x < sh.minX || sh.x > sh.maxX) {
        shocks[i] = shocks[shocks.length - 1];
        shocks.pop();
      }
    }
  }

  /* ---- Collectible Gold Shard (non-colliding, hanya overlap) ---- */
  function resetShards() {
    shards = Level.shards.map(function (p) {
      return { x: p.x, y: p.y, taken: false, bob: Math.random() * 6 };
    });
  }

  function shardGot() {
    var n = 0;
    for (var i = 0; i < shards.length; i++) if (shards[i].taken) n++;
    return n;
  }

  function updateShards(dt) {
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.taken) continue;
      s.bob += dt;
      if (player.state === 'death') continue;
      setR(_r1, s.x - 13, s.y - 13, 26, 26);
      setR(_r2, player.x, player.y, player.w, player.h);
      if (rectsOverlap(_r1, _r2)) {
        s.taken = true;
        runStats.shards++;
        levelStats.shards++;
        // Persistent: total shard lintas sesi (event, bukan per-frame).
        save.totalShards++;
        persistSave();
        burst(s.x, s.y, 8, '#ffd23f', 140, 0.5, 3, 250);
        AudioManager.play('pickup');
      }
    }
  }

  /* ---- 11c. PERSISTENCE (Stage 6): satu key terversi, guarded ----
   * knightSaveV1 menyimpan progres + settings saja (tanpa data sensitif,
   * tanpa state runtime). IO event-driven: settings, checkpoint/progress,
   * complete, death, reset — TIDAK PERNAH per-frame. localStorage rusak /
   * hilang -> fallback in-memory + default, tanpa console spam. */
  var SAVE_KEY = 'knightSaveV1';
  var memStore = {};

  function storeGet(k) {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(k);
    } catch (e) { /* abaikan, pakai memori */ }
    try { return (k in memStore) ? memStore[k] : null; }
    catch (e2) { return null; }
  }

  function storeSet(k, v) {
    var done = false;
    try {
      if (typeof localStorage !== 'undefined') { localStorage.setItem(k, v); done = true; }
    } catch (e) { /* abaikan, pakai memori */ }
    if (!done) { try { memStore[k] = String(v); } catch (e2) { /* abaikan */ } }
  }

  function storeDel(k) {
    try {
      if (typeof localStorage !== 'undefined') { localStorage.removeItem(k); return; }
    } catch (e) { /* abaikan */ }
    try { delete memStore[k]; } catch (e2) { /* abaikan */ }
  }

  function getDefaultSave() {
    return {
      version: 1,
      bestTime: null, bestL1: null, bestL2: null, bestShards: 0,
      totalShards: 0, totalDeaths: 0,
      level1Completed: false, level2Completed: false, gameCompleted: false,
      level2Unlocked: false,
      sfxEnabled: true, sfxVolume: 100,
      musicEnabled: true, musicVolume: 70,
      inputPreference: 'auto'
    };
  }

  function saveNum(v, dflt, lo, hi) {
    var n = Number(v);
    if (!isFinite(n)) return dflt;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  // Validasi schema: rusak / versi beda -> default penuh (tanpa crash).
  function sanitizeSave(o) {
    var d = getDefaultSave();
    if (!o || typeof o !== 'object' || o.version !== 1) return d;
    d.bestTime = (o.bestTime == null) ? null : saveNum(o.bestTime, null, 0, 1e9);
    d.bestL1 = (o.bestL1 == null) ? null : saveNum(o.bestL1, null, 0, 1e9);
    d.bestL2 = (o.bestL2 == null) ? null : saveNum(o.bestL2, null, 0, 1e9);
    d.bestShards = Math.floor(saveNum(o.bestShards, 0, 0, 1e9));
    d.totalShards = Math.floor(saveNum(o.totalShards, 0, 0, 1e9));
    d.totalDeaths = Math.floor(saveNum(o.totalDeaths, 0, 0, 1e9));
    d.level1Completed = !!o.level1Completed;
    d.level2Completed = !!o.level2Completed;
    d.gameCompleted = !!o.gameCompleted;
    d.level2Unlocked = !!o.level2Unlocked;
    d.sfxEnabled = !!o.sfxEnabled;
    d.sfxVolume = Math.round(saveNum(o.sfxVolume, 100, 0, 100));
    d.musicEnabled = !!o.musicEnabled;
    d.musicVolume = Math.round(saveNum(o.musicVolume, 70, 0, 100));
    d.inputPreference = (o.inputPreference === 'keyboard' || o.inputPreference === 'touch')
      ? o.inputPreference : 'auto';
    return d;
  }

  var save = getDefaultSave();

  function loadSave() {
    var raw = storeGet(SAVE_KEY);
    if (!raw) { save = getDefaultSave(); }
    else {
      try {
        save = sanitizeSave(JSON.parse(raw));
      } catch (e) {
        save = getDefaultSave(); // JSON corrupt -> default + tulis ulang valid
        persistSave();
      }
    }
    // R2: migrasi satu-kali — hapus key lama 'knightBestV1' (guarded,
    // idempotent). Tak menyentuh knightSaveV1, progresi, best, atau fallback.
    try { storeDel('knightBestV1'); } catch (e) { /* abaikan */ }
    applyAudioSettings(); // audio selalu ikut save yang aktif
    return save;
  }

  function persistSave() {
    try { storeSet(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* abaikan */ }
  }

  function resetSave() {
    save = getDefaultSave();
    persistSave();
    applyAudioSettings();
    refreshSettingsUI();
    refreshRecordsUI();
  }

  function applyAudioSettings() {
    try {
      AudioManager.setSfx(save.sfxEnabled, save.sfxVolume);
      AudioManager.setMusic(save.musicEnabled, save.musicVolume);
    } catch (e) { /* abaikan */ }
  }

  // Level 1 selalu terbuka; Level 2 butuh unlock (kompatibel: unlock
  // otomatis diberikan saat Level 1 selesai, jadi alur Stage 5 utuh).
  function canPlayLevel(n) {
    if (n <= 1) return true;
    return !!save.level2Unlocked;
  }

  // Kompatibilitas baca best lama (bentuk {time, shards} seperti dulu).
  function loadBest() {
    return { time: save.bestTime, shards: save.bestShards };
  }

  /* ---- Overlay & panel ---- */
  function hideAllOverlays() {
    var els = [overlayEl, winOverlayEl, menuEl, lvlclearEl, gameclearEl,
               settingsEl, resetEl];
    for (var i = 0; i < els.length; i++) {
      if (els[i]) els[i].classList.add('hidden');
    }
    showMenuPanel('main');
  }

  function showMenuPanel(name) {
    var map = { main: menuMain, controls: menuControls, about: menuAbout };
    for (var k in map) {
      if (map[k]) {
        if (k === name) map[k].classList.remove('hidden');
        else map[k].classList.add('hidden');
      }
    }
  }

  function clearInput() {
    Input.left = false; Input.right = false;
    Input.jumpHeld = false; Input.jumpPressed = false;
    Input.attackPressed = false; Input.restartPressed = false;
  }

  function resetTotals() {
    deaths = 0;
    timeElapsed = 0;
    runStats = { kills: 0, shards: 0 };
  }

  // Muat level n (1-based): tukar pointer + reset total per-level.
  // Tanpa reload browser; partikel/FX tidak bocor antar-level.
  // Reset level TIDAK menyentuh save persistent (total/rekor aman).
  function loadLevelInternal(n) {
    currentLevel = n;
    Level = Levels[n - 1];
    for (var i = 0; i < Level.checkpoints.length; i++) {
      Level.checkpoints[i].activated = false;
    }
    respawnPoint = { x: Level.playerSpawn.x, y: Level.playerSpawn.y };
    toast.t = 0;
    clearParticles();
    resetShake();
    player = createPlayer();
    player.x = respawnPoint.x;
    player.y = respawnPoint.y;
    enemies = Level.enemySpawns.map(function (sp) { return createSlime(sp); });
    boss = Level.bossSpawn ? createBoss(Level.bossSpawn, Level.bossArena) : null;
    shocks = [];
    resetShards();
    levelStats = { kills: 0, shards: 0, time: 0 };
    victoryArmed = false;
    victoryT = 0;
    clearInput();
    snapCamera();
    // Copy misi sesuai level aktual (pendek, ramah HP).
    try {
      var me = document.getElementById('mission');
      if (me) {
        me.innerHTML = (n === 2)
          ? 'L2: lewati celah • shard • checkpoint • kalahkan <b>RAJA SLIME</b>'
          : 'L1: shard • kalahkan slime • checkpoint • capai <b>FINISH</b>';
      }
    } catch (e) { /* abaikan */ }
  }

  function startLevel(n) {
    loadLevelInternal(n);
    trans.active = false; // start langsung membatalkan transisi yang jalan
    trans.phase = '';
    gameState = 'playing';
    hideAllOverlays();
    setPaused(false);
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    AudioManager.updateMusicState(); // BGM gameplay tanpa overlap
    debugLog('[game] start level', n);
  }

  // PLAY dari menu / PLAY AGAIN: total di-reset lalu transisi ke Level 1.
  function playFresh() {
    resetTotals();
    startTrans(1);
  }

  function toMenu() {
    gameState = 'menu';
    hideAllOverlays();
    if (menuEl) menuEl.classList.remove('hidden');
    clearInput();
    setPaused(false);
    camera.x = 120; // vista menu
    refreshRecordsUI();
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    AudioManager.updateMusicState(); // musik menu (sesuai setting)
    debugLog('[game] ke menu');
  }

  /* ---- 11d. SETTINGS (Stage 6): state + panel + reset ----
   * Dibuka dari Main Menu. State 'settings' tidak menjalankan simulasi
   * (frame hanya updateShake). Esc/BACK kembali ke menu. Semua kontrol
   * touch-friendly + keyboard-navigable, gaya konsisten dengan menu. */
  var settingsEl = null;
  var btnSettings = null;
  var setSfx = null, setSfxDown = null, setSfxUp = null, setSfxVal = null;
  var setMusic = null, setMusicDown = null, setMusicUp = null, setMusicVal = null;
  var setInput = null, btnResetProgress = null, btnSettingsBack = null;
  var resetEl = null, btnResetCancel = null, btnResetConfirm = null;
  var aboutRecords = null;

  function fmtTime(t) {
    if (t == null || !isFinite(t)) return '-';
    return Number(t).toFixed(1) + 's';
  }

  function openSettings() {
    if (gameState !== 'menu') return;
    gameState = 'settings';
    hideAllOverlays();
    if (settingsEl) settingsEl.classList.remove('hidden');
    clearInput();
    refreshSettingsUI();
    if (setSfx && setSfx.focus) {
      try { setSfx.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
    debugLog('[game] settings dibuka');
  }

  function settingsBack() {
    toMenu(); // parent settings selalu Main Menu
  }

  function refreshSettingsUI() {
    try {
      if (setSfx) setSfx.textContent = 'SFX: ' + (save.sfxEnabled ? 'ON' : 'OFF');
      if (setSfxVal) setSfxVal.textContent = save.sfxVolume + '%';
      if (setMusic) setMusic.textContent = 'MUSIC: ' + (save.musicEnabled ? 'ON' : 'OFF');
      if (setMusicVal) setMusicVal.textContent = save.musicVolume + '%';
      if (setInput) setInput.textContent = 'INPUT: ' + String(save.inputPreference).toUpperCase();
    } catch (e) { /* abaikan */ }
  }

  function refreshRecordsUI() {
    try {
      if (!aboutRecords) return;
      var done = (save.level1Completed ? 1 : 0) + (save.level2Completed ? 1 : 0);
      aboutRecords.textContent =
        'Best L1: ' + fmtTime(save.bestL1) + ' • Best L2: ' + fmtTime(save.bestL2) +
        ' • Best: ' + fmtTime(save.bestTime) + ' • Shard: ' + save.bestShards +
        ' • Mati: ' + save.totalDeaths + ' • Selesai: ' + done + '/2';
    } catch (e) { /* abaikan */ }
  }

  function bumpVol(which, delta) {
    if (which === 'sfx') {
      save.sfxVolume = clamp(save.sfxVolume + delta, 0, 100);
    } else {
      save.musicVolume = clamp(save.musicVolume + delta, 0, 100);
    }
    persistSave();
    applyAudioSettings();
    refreshSettingsUI();
  }

  function cycleInput() {
    save.inputPreference =
      save.inputPreference === 'auto' ? 'keyboard' :
      save.inputPreference === 'keyboard' ? 'touch' : 'auto';
    persistSave();
    refreshSettingsUI();
  }

  // Kontrak gating simulasi untuk test: true hanya saat loop update jalan.
  function isSimActive() {
    return gameState === 'playing' && !paused && !trans.active;
  }

  // Transisi fade-out -> load -> fade-in (pendek, tanpa loading palsu).
  function startTrans(n) {
    // Guard: level di luar daftar ditolak diam-diam (anti crash console).
    if (trans.active || !(n >= 1 && n <= Levels.length)) return;
    hideAllOverlays();
    try { AudioManager.unlock(); } catch (e) { /* abaikan */ }
    trans.active = true;
    trans.phase = 'out';
    trans.t = 0;
    trans.target = n;
  }

  function updateTrans(dt) {
    if (!trans.active) return;
    if (trans.phase === 'out') {
      trans.t += dt;
      if (trans.t >= trans.dur) {
        loadLevelInternal(trans.target);
        trans.phase = 'in';
        trans.t = trans.dur;
      }
    } else {
      trans.t -= dt;
      if (trans.t <= 0) {
        trans.active = false;
        trans.phase = '';
        gameState = 'playing';
        setPaused(false);
        try { last = nowPerf(); } catch (e) { /* abaikan */ }
        AudioManager.updateMusicState();
      }
    }
  }

  function transAlpha() {
    if (!trans.active) return 0;
    return clamp(trans.t / trans.dur, 0, 1);
  }

  function showLevelComplete() {
    if (gameState !== 'playing') return;
    gameState = 'levelcomplete';
    // Persistent: unlock L2 + best L1 (hanya jika lebih baik).
    save.level1Completed = true;
    save.level2Unlocked = true;
    if (save.bestL1 == null || levelStats.time < save.bestL1) save.bestL1 = levelStats.time;
    persistSave();
    refreshRecordsUI();
    if (lvlclearEl) {
      if (lvlclearStats) {
        lvlclearStats.textContent = 'Waktu: ' + levelStats.time.toFixed(1) + ' dtk • Musuh: ' +
          levelStats.kills + ' • Shard: ' + shardGot() + '/' + shards.length;
      }
      lvlclearEl.classList.remove('hidden');
    }
    if (btnNext && btnNext.focus) {
      try { btnNext.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
    AudioManager.play('win');
    AudioManager.updateMusicState(); // BGM gameplay berhenti
  }

  function showGameComplete() {
    if (gameState !== 'playing') return;
    gameState = 'gamecomplete';
    // Persistent: flag complete + best (hanya jika lebih baik).
    save.level2Completed = true;
    save.gameCompleted = true;
    if (save.bestTime == null || timeElapsed < save.bestTime) save.bestTime = timeElapsed;
    if (save.bestL2 == null || levelStats.time < save.bestL2) save.bestL2 = levelStats.time;
    if (runStats.shards > save.bestShards) save.bestShards = runStats.shards;
    persistSave();
    refreshRecordsUI();
    if (gameclearEl) {
      var txt = 'Waktu total: ' + timeElapsed.toFixed(1) + ' dtk • Musuh: ' +
        runStats.kills + ' • Shard: ' + runStats.shards + ' • Mati: ' + deaths;
      if (save.bestTime != null) txt += ' • Terbaik: ' + Number(save.bestTime).toFixed(1) + ' dtk';
      if (gameclearStats) gameclearStats.textContent = txt;
      gameclearEl.classList.remove('hidden');
    }
    if (btnAgain2 && btnAgain2.focus) {
      try { btnAgain2.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
    AudioManager.play('win');
    AudioManager.updateMusicState(); // BGM gameplay berhenti
  }

  // Lanjut ke Level 2 dengan gate unlock (praktis selalu terbuka karena
  // unlock diberikan saat Level 1 selesai; gate untuk konsistensi save).
  function nextLevel() {
    if (!canPlayLevel(2)) {
      showToast('Selesaikan Level 1 dulu!');
      AudioManager.play('click');
      return;
    }
    startTrans(2);
  }

  function foesLeft() {
    var n = aliveEnemies();
    if (boss && !boss.dead) n++;
    return n;
  }

  // Respawn di checkpoint terakhir (atau spawn): HP pulih, musuh + boss
  // reset, checkpoint TETAP aktif, timer & deaths lanjut. Shard yang sudah
  // diambil tetap diambil (retry ramah). Efek sementara dibersihkan.
  // Tahap 4: selalu unpause + reset timer agar "restart setelah pause" aman.
  function respawn() {
    player = createPlayer();
    player.x = respawnPoint.x;
    player.y = respawnPoint.y;
    enemies = Level.enemySpawns.map(function (sp) { return createSlime(sp); });
    boss = Level.bossSpawn ? createBoss(Level.bossSpawn, Level.bossArena) : null;
    shocks = [];
    victoryArmed = false;
    victoryT = 0;
    clearParticles();
    resetShake();
    clearInput();
    gameState = 'playing';
    gameOverT = 0;
    snapCamera();
    hideAllOverlays();
    setPaused(false);
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    AudioManager.updateMusicState(); // BGM resume tanpa overlap
    debugLog('[game] respawn di', respawnPoint.x, respawnPoint.y);
  }

  // Restart total: kembali ke Level 1 seperti game baru.
  // Tahap 4: unpause agar tombol/tes "restart setelah pause" kembali main.
  function restart() {
    resetTotals();
    loadLevelInternal(1);
    gameState = 'playing';
    hideAllOverlays();
    setPaused(false);
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    AudioManager.updateMusicState();
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

  // Langit dibuat sekali di boot per level (tidak dialokasi per-frame).
  var skyGrad = null;
  var skyGrads = [null, null];

  // Langit + layer JAUH (0.2) + layer TENGAH (0.5): screen-space dengan
  // offset sendiri. Ringan: ~70 bintang + 9 bukit, culling di luar layar.
  function drawSkyFarMid() {
    var th = levelTheme();
    ctx.fillStyle = skyGrads[currentLevel - 1] || skyGrad || '#232a5c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    var cx = camera.x, i, sx;
    // Bulan (layer jauh) — merah darah di Level 2.
    ctx.fillStyle = th.moon;
    ctx.fillRect(Math.round(750 - cx * PAR_FAR), 50, 44, 44);
    ctx.fillStyle = th.moonD;
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
    var th = levelTheme();
    for (var i = 0; i < Level.platforms.length; i++) {
      var p = Level.platforms[i];
      var isGround = (p.h > 30);
      ctx.fillStyle = isGround ? th.ground : th.plat;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = isGround ? th.grass : th.platTop;
      ctx.fillRect(p.x, p.y, p.w, 6);
      ctx.fillStyle = isGround ? th.grassD : th.platD;
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
    if (!r) return; // Level 2: boss sebagai final encounter, tanpa gapura
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
    // Kaki menapak tanah: baris opaque terbawah sprite (baris 26 dari 32,
    // terukur) harus tepat di hitbox bawah: dy + 27*3 = y + 78 -> +3.
    // (+6 lama membuat kaki melayang ~9px di atas tanah.)
    var dy = Math.round(player.y + player.h - dh + 3);
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

  /* Slime prosedural pixel-art: blob + mata. Squash & stretch.
   * Hitbox terpisah dari gambar. Geometri digambar proporsional terhadap
   * ukuran hitbox (faktor k) sehingga varian Fast/Heavy terdiferensiasi
   * visual; untuk slime klasik k=1 sehingga piksel identik seperti semula. */
  function drawSlime(s) {
    var t = s.animTime;
    var squash = 1 + 0.07 * Math.sin(t * 7);
    var dw = Math.round((s.w + 4) / squash), dh = Math.round((s.h + 8) * squash);
    if (s.state === 'death') {
      var k = clamp(1 - s.deathT / SLIME_DEATH_DURATION, 0, 1);
      dh = Math.round(dh * (0.3 + 0.7 * k));
    }
    var kf = dw / 48; // 1.0 untuk slime klasik
    var dx = Math.round(s.x + s.w / 2 - dw / 2);
    var dy = Math.round(s.y + s.h - dh);
    var blink = s.iframes > 0 && Math.floor(t * 16) % 2 === 0;

    // Bayangan
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(Math.round(s.x + 4), Math.round(s.y + s.h - 3), s.w - 8, 4);

    var windup = s.state === 'attack' && s.atkT < s.st.windup;
    // Heavy: telegraph lebih jelas (merah saat windup).
    var body = windup ? '#e05252' : s.st.body;
    var dark = s.st.dark, light = s.st.light;

    ctx.fillStyle = blink ? '#ffffff' : body;
    ctx.fillRect(Math.round(dx + 4 * kf), dy + Math.round(8 * kf), Math.round(dw - 8 * kf), dh - Math.round(8 * kf)); // badan
    ctx.fillRect(Math.round(dx + 8 * kf), dy + Math.round(3 * kf), Math.round(dw - 16 * kf), Math.round(8 * kf));    // punuk atas
    ctx.fillStyle = dark;
    ctx.fillRect(Math.round(dx + 4 * kf), dy + dh - Math.round(6 * kf), Math.round(dw - 8 * kf), Math.round(6 * kf)); // perut bawah
    ctx.fillStyle = light;
    ctx.fillRect(Math.round(dx + 8 * kf), dy + Math.round(6 * kf), Math.round(10 * kf), Math.round(5 * kf));         // highlight

    // Mata (ikut arah hadap).
    var ex = s.dir === 1 ? Math.round(dx + dw - 20 * kf) : Math.round(dx + 8 * kf);
    var ey = dy + Math.round(12 * kf), ew = Math.max(4, Math.round(9 * kf)), eh = Math.max(5, Math.round(11 * kf));
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex, ey, ew, eh);
    ctx.fillRect(ex + ew + Math.max(1, Math.round(2 * kf)), ey, ew, eh);
    ctx.fillStyle = '#14142b';
    var pup = s.dir === 1 ? Math.max(1, Math.round(3 * kf)) : 0;
    var pw2 = Math.max(2, Math.round(4 * kf)), ph2 = Math.max(3, Math.round(6 * kf));
    ctx.fillRect(ex + Math.max(1, Math.round(2 * kf)) + pup, ey + Math.max(1, Math.round(4 * kf)), pw2, ph2);
    ctx.fillRect(ex + ew + Math.max(1, Math.round(2 * kf)) + Math.max(1, Math.round(2 * kf)) + pup, ey + Math.max(1, Math.round(4 * kf)), pw2, ph2);

    // Telegraph windup: tanda seru pixel.
    if (windup) {
      ctx.fillStyle = '#ffd23f';
      var qx = Math.round(s.x + s.w / 2 - 2);
      ctx.fillRect(qx, dy - Math.round(18 * kf), Math.max(3, Math.round(5 * kf)), Math.round(10 * kf));
      ctx.fillRect(qx, dy - Math.max(3, Math.round(5 * kf)), Math.max(3, Math.round(5 * kf)), Math.max(3, Math.round(5 * kf)));
    }
  }

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
      if (!enemies[i].dead) drawSlime(enemies[i]);
    }
  }

  /* Stage 5: RAJA SLIME — blob besar + mahkota emas + alis marah.
   * Enraged: semburat merah. Telegraph: kedip putih + tanda seru besar. */
  function drawBoss() {
    if (!boss || boss.dead) return;
    var b = boss, t = b.animTime;
    var squash = 1 + 0.06 * Math.sin(t * 6);
    var dw = Math.round(72 / squash), dh = Math.round(64 * squash);
    if (b.state === 'death') {
      var k = clamp(1 - b.deathT / 1.0, 0, 1);
      dh = Math.round(dh * (0.3 + 0.7 * k));
    }
    var dx = Math.round(b.x + b.w / 2 - dw / 2);
    var dy = Math.round(b.y + b.h - dh);
    var tele = b.state === 'telegraph';
    var blink = (b.iframes > 0 && Math.floor(t * 16) % 2 === 0) || (tele && Math.floor(t * 10) % 2 === 0);

    // Bayangan
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(b.x + 6), Math.round(b.y + b.h - 3), b.w - 12, 5);

    var body = b.enraged ? '#c94f5f' : '#7a3fc9';
    ctx.fillStyle = blink ? '#ffffff' : body;
    ctx.fillRect(dx + 5, dy + 12, dw - 10, dh - 12);   // badan
    ctx.fillRect(dx + 11, dy + 5, dw - 22, 10);        // punuk
    ctx.fillStyle = b.enraged ? '#8a2a3a' : '#4a248a';
    ctx.fillRect(dx + 5, dy + dh - 8, dw - 10, 8);     // perut
    ctx.fillStyle = b.enraged ? '#f0a5a5' : '#c9a5f0';
    ctx.fillRect(dx + 11, dy + 9, 13, 6);              // highlight
    // Mahkota emas.
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(dx + 14, dy - 8, dw - 28, 12);
    for (var ci = 0; ci < 3; ci++) {
      ctx.fillRect(dx + 18 + ci * Math.round((dw - 36) / 2), dy - 14, 8, 8);
    }
    // Mata marah (ikut arah hadap).
    var ex = b.dir === 1 ? dx + dw - 28 : dx + 12;
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex, dy + 18, 12, 13);
    ctx.fillRect(ex + 15, dy + 18, 12, 13);
    ctx.fillStyle = '#e05252'; // sorot merah
    ctx.fillRect(ex + (b.dir === 1 ? 5 : 2), dy + 22, 5, 7);
    ctx.fillRect(ex + 15 + (b.dir === 1 ? 5 : 2), dy + 22, 5, 7);
    // Alis miring.
    ctx.fillStyle = '#2a1a4a';
    if (b.dir === 1) {
      ctx.fillRect(ex - 2, dy + 13, 16, 4);
      ctx.fillRect(ex + 13, dy + 13, 16, 4);
    } else {
      ctx.fillRect(ex, dy + 13, 16, 4);
      ctx.fillRect(ex + 15, dy + 13, 16, 4);
    }
    // Telegraph: tanda seru besar.
    if (tele) {
      ctx.fillStyle = '#ffd23f';
      var qx = Math.round(b.x + b.w / 2 - 3);
      ctx.fillRect(qx, dy - 30, 7, 15);
      ctx.fillRect(qx, dy - 11, 7, 7);
    }
  }

  // Shockwave boss: dua gelombang tanah ke kiri & kanan.
  function drawShocks() {
    for (var i = 0; i < shocks.length; i++) {
      var sh = shocks[i];
      var fl = Math.floor(sh.life * 12) % 2 === 0;
      ctx.fillStyle = fl ? '#ffd23f' : '#e0682a';
      ctx.fillRect(Math.round(sh.x), Math.round(sh.y), sh.w, sh.h);
      ctx.fillStyle = '#fff2c9';
      ctx.fillRect(Math.round(sh.x) + 4, Math.round(sh.y), sh.w - 8, 6);
    }
  }

  // Gold Shard: belah ketupat berkilau + animasi bob 2-frame.
  function drawShards() {
    for (var i = 0; i < shards.length; i++) {
      var s = shards[i];
      if (s.taken) continue;
      var bobY = Math.round(s.y + Math.sin(s.bob * 4) * 3);
      var tw = Math.floor(s.bob * 6) % 2 === 0;
      ctx.fillStyle = tw ? '#ffd23f' : '#ffed9e';
      ctx.fillRect(s.x - 3, bobY - 8, 6, 16);
      ctx.fillRect(s.x - 8, bobY - 3, 16, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x - 2, bobY - 5, 4, 4);
    }
  }

  // Dekorasi subtil arena boss (hanya Level 2): pilar + panji merah.
  function drawArenaDecor() {
    if (currentLevel !== 2 || !Level.bossArena) return;
    var g = GROUND_TOP;
    ctx.fillStyle = '#2c2140';
    ctx.fillRect(Level.bossArena.minX - 14, g - 120, 14, 120);
    ctx.fillRect(Level.bossArena.maxX, g - 120, 14, 120);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(Level.bossArena.minX - 14, g - 120, 14, 8);
    ctx.fillRect(Level.bossArena.maxX, g - 120, 14, 8);
    ctx.fillStyle = '#a03a3a';
    var fx = Math.round((Level.bossArena.minX + Level.bossArena.maxX) / 2 - 20);
    ctx.fillRect(fx, g - 150, 40, 26);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(fx + 8, g - 144, 24, 6);
    // Obor arena: api 2-frame tanpa alokasi (flicker waktu, murah).
    var fl = Math.floor(nowPerf() / 180) % 2;
    var fh = fl ? 14 : 10;
    ctx.fillStyle = '#e0682a';
    ctx.fillRect(Level.bossArena.minX - 11, g - 120 - fh, 8, fh);
    ctx.fillRect(Level.bossArena.maxX + 3, g - 120 - fh, 8, fh);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(Level.bossArena.minX - 9, g - 120 - fh, 4, fh - 4);
    ctx.fillRect(Level.bossArena.maxX + 5, g - 120 - fh, 4, fh - 4);
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

    // --- Progress level (tengah atas): player, checkpoint, goal/boss ---
    var px = 330, pw = 300, py = 16, ph = 12;
    var prog = getProgress();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px - 6, py - 8, pw + 12, ph + 26);
    ctx.fillStyle = '#20264d';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#5a68b0';
    ctx.fillRect(px, py, Math.round(pw * prog), ph);
    // Ujung kanan: goal fisik (Level 1) atau arena boss (Level 2).
    var endX = Level.goal ? (Level.goal.x + Level.goal.w / 2)
                          : (Level.bossSpawn ? Level.bossSpawn.x : Level.playerSpawn.x + 1);
    var span = Math.max(1, endX - Level.playerSpawn.x);
    var i, mx;
    for (i = 0; i < Level.checkpoints.length; i++) {
      mx = px + Math.round(pw * (Level.checkpoints[i].x - Level.playerSpawn.x) / span);
      ctx.fillStyle = Level.checkpoints[i].activated ? '#5ec46f' : '#8a8fa8';
      ctx.fillRect(mx - 2, py - 3, 5, ph + 6);
    }
    // Penanda ujung + panah player.
    ctx.fillStyle = Level.goal ? '#ffd23f' : '#e05252';
    ctx.fillRect(px + pw - 3, py - 6, 6, ph + 4);
    mx = px + Math.round(pw * prog);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 3, py - 5, 7, 6);
    ctx.fillRect(mx - 1, py + 1, 3, 8);
    ctx.fillStyle = '#c6ccea';
    ctx.font = '11px monospace';
    ctx.fillText('MAP ' + Math.round(prog * 100) + '%', px, py + ph + 9);

    // --- Musuh tersisa (kanan atas): ikon + angka (teks + warna) ---
    var alive = foesLeft();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VIEW_W - 150, 8, 138, 32);
    ctx.fillStyle = '#4fc94f';
    ctx.fillRect(VIEW_W - 140, 16, 16, 12);
    ctx.fillRect(VIEW_W - 136, 12, 8, 5);
    ctx.fillStyle = alive > 0 ? '#a5f0a0' : '#8a8fa8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('FOE x' + alive, VIEW_W - 118, 25);

    // --- Shard + level (kanan, baris kedua; kecil agar tak tutup game) ---
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VIEW_W - 150, 44, 138, 24);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(VIEW_W - 140, 51, 10, 10);
    ctx.fillRect(VIEW_W - 137, 48, 4, 16);
    ctx.fillStyle = '#fff2c9';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(shardGot() + '/' + shards.length + '  LV' + currentLevel, VIEW_W - 124, 57);

    // --- Bar HP boss (tengah atas, hanya saat boss aktif) ---
    if (currentLevel === 2 && boss && !boss.dead) {
      var bbw = 300, bbx = VIEW_W / 2 - bbw / 2, bby = 52;
      var bpct = clamp(boss.hp / boss.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bbx - 4, bby - 18, bbw + 8, 40);
      ctx.fillStyle = '#c6ccea';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(boss.enraged ? 'RAJA SLIME — MURKA!' : 'RAJA SLIME', VIEW_W / 2, bby - 8);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#3a1020';
      ctx.fillRect(bbx, bby, bbw, 12);
      ctx.fillStyle = bpct > 0.3 ? '#c94f6f' : '#e05252';
      ctx.fillRect(bbx, bby, Math.round(bbw * bpct), 12);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(bbx, bby, Math.round(bbw * bpct), 3);
    }

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
      ' st:' + (enemies[0] ? enemies[0].state : '-') +
      ' LV:' + currentLevel +
      (boss ? ' BOSS:' + boss.hp + '/' + boss.state : ''), 20, 202);
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
    if (gr) ctx.strokeRect(gr.x + 0.5, gr.y + 0.5, gr.w, gr.h);
    if (boss && !boss.dead) {
      ctx.strokeStyle = '#ff33cc';
      ctx.strokeRect(boss.x + 0.5, boss.y + 0.5, boss.w, boss.h);
    }
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

  /* Stage 5: satu langkah simulasi gameplay. Dipakai frame() dan
   * diekspos sebagai step() untuk testing deterministik headless. */
  function updatePlaying(dt) {
    if (Input.restartPressed) Input.restartPressed = false;
    timeElapsed += dt;
    levelStats.time += dt;
    if (toast.t > 0) toast.t -= dt;
    updatePlayer(dt);
    Combat.resolvePlayerAttack();
    for (var i = 0; i < enemies.length; i++) updateSlime(enemies[i], dt);
    // Hapus slime yang selesai death (in-place, tanpa alokasi filter).
    for (var r = enemies.length - 1; r >= 0; r--) {
      if (enemies[r].dead) {
        runStats.kills++;
        levelStats.kills++;
        enemies[r] = enemies[enemies.length - 1];
        enemies.pop();
      }
    }
    if (boss && !boss.dead) updateBoss(boss, dt);
    updateShocks(dt);
    Combat.resolveEnemyAttacks();
    checkCheckpoints();
    checkGoal();
    updateShards(dt);
    updateShake(dt);
    updateParticles(dt);

    // Kemenangan boss -> Game Complete (jeda agar FX kematian terbaca).
    if (victoryArmed) {
      victoryT += dt;
      if (victoryT >= VICTORY_DELAY) {
        victoryArmed = false;
        showGameComplete();
      }
    }

    // Player death -> Game Over (beri jeda animasi death 1 detik).
    if (player.state === 'death' && player.deathT > 1.0) showGameOver();
    updateCamera(dt);
  }

  function drawWorld() {
    drawSkyFarMid();
    drawNearLayer();
    var shx = Math.round(camera.x + shake.ox);
    var shy = Math.round(shake.oy);
    ctx.save();
    ctx.translate(-shx, shy);
    drawArenaDecor();
    drawPlatforms();
    drawCheckpoints();
    drawGoal();
    drawShards();
    drawEnemies();
    drawBoss();
    drawPlayer();
    drawSlash();
    drawShocks();
    drawParticles();
    if (DEBUG) drawDebugBoxes();
    ctx.restore();
  }

  // Vista statis di belakang menu utama (tanpa simulasi gameplay).
  function drawMenuVista() {
    camera.x = 120;
    drawSkyFarMid();
    drawNearLayer();
    ctx.save();
    ctx.translate(-Math.round(camera.x), 0);
    drawPlatforms();
    drawCheckpoints();
    drawGoal();
    ctx.restore();
  }

  function drawTransOverlay() {
    var a = transAlpha();
    if (a <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,' + a.toFixed(2) + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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

    // Transisi level berjalan di semua state non-pause.
    updateTrans(dt);
    // Scheduler BGM (lookahead via Web Audio clock; no-op bila diam).
    AudioManager.musicTick();

    if (gameState === 'menu') {
      drawMenuVista();
      drawTransOverlay();
      return;
    }

    // Stage 6: settings tidak menjalankan simulasi apa pun.
    if (gameState === 'settings') {
      updateShake(dt);
      drawMenuVista();
      drawTransOverlay();
      return;
    }

    if (gameState === 'playing') {
      updatePlaying(dt);
    } else if (gameState === 'gameover') {
      gameOverT += dt;
      updateShake(dt); // biarkan shake reda secara visual (gameplay sudah diam)
      // R / Enter = respawn di checkpoint (primer). Restart total via tombol.
      if (Input.restartPressed) { Input.restartPressed = false; respawn(); }
    } else if (gameState === 'levelcomplete') {
      updateShake(dt);
      // R / Enter = lanjut ke Level 2 (terkunci sampai L1 selesai).
      if (Input.restartPressed) { Input.restartPressed = false; nextLevel(); }
    } else if (gameState === 'gamecomplete') {
      updateShake(dt);
      // R / Enter = main lagi dari Level 1.
      if (Input.restartPressed) { Input.restartPressed = false; playFresh(); }
    } else { // win (legacy) — dunia diam, overlay menang tampil
      updateShake(dt);
      if (Input.restartPressed) { Input.restartPressed = false; restart(); }
    }

    // Langit + parallax + dunia (shake hanya offset render).
    drawWorld();

    drawTransOverlay();
    drawHUD();
    if (DEBUG) drawDebug(fpsShown);
  }

  /* ============================ 14. BOOT ============================ */
  overlayEl = document.getElementById('gameover');
  restartBtn = document.getElementById('btn-restart');
  respawnBtn = document.getElementById('btn-respawn');
  btnGameOverMenu = document.getElementById('btn-gameover-menu');
  winOverlayEl = document.getElementById('levelcomplete');
  againBtn = document.getElementById('btn-again');
  // Stage 5: overlay menu + level-complete + game-complete.
  menuEl = document.getElementById('mainmenu');
  menuMain = document.getElementById('menu-main');
  menuControls = document.getElementById('menu-controls');
  menuAbout = document.getElementById('menu-about');
  btnPlay = document.getElementById('btn-play');
  btnControls = document.getElementById('btn-controls');
  btnAbout = document.getElementById('btn-about');
  btnBackC = document.getElementById('btn-back-controls');
  btnBackA = document.getElementById('btn-back-about');
  lvlclearEl = document.getElementById('lvlclear');
  lvlclearStats = document.getElementById('lvlclear-stats');
  btnNext = document.getElementById('btn-next');
  btnReplay = document.getElementById('btn-replay');
  btnLvlMenu = document.getElementById('btn-lvlmenu');
  gameclearEl = document.getElementById('gameclear');
  gameclearStats = document.getElementById('gameclear-stats');
  btnAgain2 = document.getElementById('btn-again2');
  btnGameMenu = document.getElementById('btn-gamemenu');
  // Stage 6: overlay settings + reset + records.
  btnSettings = document.getElementById('btn-settings');
  settingsEl = document.getElementById('settings');
  setSfx = document.getElementById('set-sfx');
  setSfxDown = document.getElementById('set-sfx-vol-down');
  setSfxUp = document.getElementById('set-sfx-vol-up');
  setSfxVal = document.getElementById('set-sfx-vol-val');
  setMusic = document.getElementById('set-music');
  setMusicDown = document.getElementById('set-music-vol-down');
  setMusicUp = document.getElementById('set-music-vol-up');
  setMusicVal = document.getElementById('set-music-vol-val');
  setInput = document.getElementById('set-input');
  btnResetProgress = document.getElementById('btn-reset-progress');
  btnSettingsBack = document.getElementById('btn-settings-back');
  resetEl = document.getElementById('reset-confirm');
  btnResetCancel = document.getElementById('btn-reset-cancel');
  btnResetConfirm = document.getElementById('btn-reset-confirm');
  aboutRecords = document.getElementById('about-records');

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
  // Stage 5: tombol menu & layar selesai (semua null-guard, touch-friendly).
  function onClick(el, fn) {
    if (el) el.addEventListener('click', function () {
      AudioManager.play('click');
      fn();
    });
  }
  onClick(btnPlay, function () { playFresh(); });
  onClick(btnControls, function () { showMenuPanel('controls'); });
  onClick(btnAbout, function () { showMenuPanel('about'); });
  onClick(btnBackC, function () { showMenuPanel('main'); });
  onClick(btnBackA, function () { showMenuPanel('main'); });
  onClick(btnNext, function () { nextLevel(); });
  onClick(btnReplay, function () { startTrans(currentLevel); });
  onClick(btnLvlMenu, function () { toMenu(); });
  onClick(btnAgain2, function () { playFresh(); });
  onClick(btnGameMenu, function () { toMenu(); });
  // Bug fix: Game Over -> Main Menu via toMenu() yang sudah ada.
  // toMenu() tak menyentuh save/progresi/unlock/best; BGM ikut state menu.
  onClick(btnGameOverMenu, function () { toMenu(); });
  // Stage 6: settings + reset (semua null-guard, touch-friendly).
  onClick(btnSettings, function () { openSettings(); });
  onClick(setSfx, function () {
    save.sfxEnabled = !save.sfxEnabled;
    persistSave(); applyAudioSettings(); refreshSettingsUI();
  });
  onClick(setSfxDown, function () { bumpVol('sfx', -10); });
  onClick(setSfxUp, function () { bumpVol('sfx', 10); });
  onClick(setMusic, function () {
    save.musicEnabled = !save.musicEnabled;
    persistSave(); applyAudioSettings(); refreshSettingsUI();
  });
  onClick(setMusicDown, function () { bumpVol('music', -10); });
  onClick(setMusicUp, function () { bumpVol('music', 10); });
  onClick(setInput, function () { cycleInput(); });
  onClick(btnSettingsBack, function () { settingsBack(); });
  // Reset progress: SELALU via dialog konfirmasi (anti kepencet di HP).
  onClick(btnResetProgress, function () {
    if (resetEl) resetEl.classList.remove('hidden');
    if (btnResetCancel && btnResetCancel.focus) {
      try { btnResetCancel.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
  });
  onClick(btnResetCancel, function () {
    if (resetEl) resetEl.classList.add('hidden');
    if (btnResetProgress && btnResetProgress.focus) {
      try { btnResetProgress.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
  });
  onClick(btnResetConfirm, function () {
    if (resetEl) resetEl.classList.add('hidden');
    resetSave();
  });

  // Navigasi keyboard: menu (panel utama/kontrol/about), settings,
  // dan dialog reset. Atas/Bawah pindah tombol, Escape kembali.
  // Tidak menyentuh input gameplay.
  var menuNavIds = ['btn-play', 'btn-controls', 'btn-settings', 'btn-about'];
  // Navigasi settings: Atas/Bawah antar kontrol, Escape kembali ke menu.
  var settingsNavIds = ['set-sfx', 'set-sfx-vol-down', 'set-sfx-vol-up',
    'set-music', 'set-music-vol-down', 'set-music-vol-up',
    'set-input', 'btn-reset-progress', 'btn-settings-back'];
  var resetNavIds = ['btn-reset-cancel', 'btn-reset-confirm'];

  function focusNavId(ids, down) {
    var cur = -1;
    try {
      var ae = document.activeElement;
      for (var i = 0; i < ids.length; i++) {
        if (ae && ae.id === ids[i]) { cur = i; break; }
      }
    } catch (err) { /* abaikan */ }
    var nx = down ? (cur + 1) % ids.length : (cur - 1 + ids.length) % ids.length;
    var t = document.getElementById(ids[nx]);
    if (t && t.focus) { try { t.focus(); } catch (err) { /* abaikan */ } }
  }

  window.addEventListener('keydown', function (e) {
    // Dialog reset di atas settings: navigasi terbatas di dalamnya.
    if (gameState === 'settings' && resetEl && !resetEl.classList.contains('hidden')) {
      if (e.code === 'Escape') {
        if (resetEl) resetEl.classList.add('hidden');
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
      if (e.preventDefault) e.preventDefault();
      focusNavId(resetNavIds, e.code === 'ArrowDown');
      return;
    }
    if (gameState === 'settings') {
      if (e.code === 'Escape') {
        settingsBack();
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
      if (e.preventDefault) e.preventDefault();
      focusNavId(settingsNavIds, e.code === 'ArrowDown');
      return;
    }
    if (gameState !== 'menu') return;
    if (e.code === 'Escape') {
      showMenuPanel('main');
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
    if (e.preventDefault) e.preventDefault();
    var ids = [];
    if (menuMain && !menuMain.classList.contains('hidden')) ids = menuNavIds;
    else if (menuControls && !menuControls.classList.contains('hidden')) ids = ['btn-back-controls'];
    else if (menuAbout && !menuAbout.classList.contains('hidden')) ids = ['btn-back-about'];
    else return;
    focusNavId(ids, e.code === 'ArrowDown');
  });

  loadSave(); // sebelum dunia/audio: settings + progres pulih dulu
  applyAudioSettings();
  loadLevelInternal(1);
  setupCanvas();
  toMenu(); // boot ke menu utama (game tidak jalan di background)

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

  // Gradien langit dibuat sekali per level (bukan per-frame).
  try {
    for (var gi = 0; gi < LEVEL_THEME.length; gi++) {
      (function (idx) {
        var gr = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        gr.addColorStop(0, LEVEL_THEME[idx].sky[0]);
        gr.addColorStop(0.6, LEVEL_THEME[idx].sky[1]);
        gr.addColorStop(1, LEVEL_THEME[idx].sky[2]);
        skyGrads[idx] = gr;
      })(gi);
    }
    skyGrad = skyGrads[0];
  } catch (e) { skyGrad = null; skyGrads = [null, null]; }

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
    // Stage 5: level, menu, boss, shard, stats, transisi, stepping.
    getLevel: function () { return currentLevel; },
    getLevelName: function () { return Level.name; },
    startLevel: startLevel,
    startTrans: startTrans,
    getTrans: function () { return { active: trans.active, phase: trans.phase }; },
    stepTrans: updateTrans,
    step: updatePlaying,
    toMenu: toMenu,
    getBoss: function () { return boss; },
    hurtBoss: function (n, x) { return hurtBoss(n, x); },
    hurtEnemy: function (id, n, x) {
      for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].id === id) {
          var s = enemies[i];
          return slimeTakeDamage(s, n, (x === undefined ? s.x + 100 : x));
        }
      }
      return false;
    },
    enemyKindOf: enemyKindOf,
    getShards: function () {
      var first = null;
      for (var i = 0; i < shards.length; i++) {
        if (!shards[i].taken) { first = { x: shards[i].x, y: shards[i].y }; break; }
      }
      return { got: shardGot(), total: shards.length, at: first };
    },
    getStats: function () {
      return { runKills: runStats.kills, runShards: runStats.shards,
               levelKills: levelStats.kills, levelShards: levelStats.shards,
               levelTime: levelStats.time, deaths: deaths };
    },
    getBest: loadBest,
    // Stage 6: save/settings/state untuk UI + testing.
    getSave: function () {
      return JSON.parse(JSON.stringify(save));
    },
    reloadSave: loadSave,
    resetSave: resetSave,
    saveNow: persistSave,
    canPlayLevel: canPlayLevel,
    openSettings: openSettings,
    nextLevel: nextLevel,
    isSimActive: isSimActive,
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
