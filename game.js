/* ==========================================================================
 * Knight Platformer v1.4.0 — Achievement + Difficulty Mode
 *
 * Modul (dalam satu file agar tetap jalan via file:// tanpa build step):
 *   Config / Utils / AudioManager (WebAudio prosedural) / Assets / Input
 *   (keyboard + Pointer Events) / Level 1-5 / Physics / Animation / Player /
 *   Enemy (slime + skeleton prosedural) / Miniboss + Boss (RAJA SLIME,
 *   RAJA LICH) / Combat / FX (partikel pool, shake, dekor parallax) /
 *   Kamera / Checkpoint+Goal / UI-HUD / Campaign Select / Pause /
 *   Game state + respawn/restart / Save v2 / Main loop (satu rAF)
 *
 * Kontrol : A/D atau Panah = gerak | Space/W/Panah-atas = lompat |
 *           J/X = serang | R = respawn checkpoint (playing) / Enter = lanjut |
 *           P/Esc = pause/resume (saat playing)
 * Sentuh  : tombol ◀ ▶ ⤒ + ATTACK (❖) via Pointer Events + tombol pause ⏸
 * Misi    : L1/L3 capai FINISH | L2 kalahkan RAJA SLIME |
 *           L4 kalahkan RAJA LICH | L5 kalahkan KEDUA RAJA.
 * L5 final gauntlet resets to the beginning on death (by design).
 * ========================================================================== */
(function () {
  'use strict';

  /* ============================ 1. CONFIG ============================ */
  var GAME_VERSION = '1.4.0';
  const DEBUG = false;

  /* Difficulty modifier (data-driven) */
  const DIFFICULTY_CONFIG = {
    normal: { enemyHp: 1, enemyDmg: 1, bossHp: 1, bossDmg: 1, enemyCooldown: 1, bossCooldown: 1, playerDmg: 1 },
    hard: { enemyHp: 2.0, enemyDmg: 1.8, bossHp: 2.5, bossDmg: 2.0, enemyCooldown: 0.75, bossCooldown: 0.6, playerDmg: 1 }
  };
  function getDifficultyMult() {
    return (save && save.difficulty === 'hard') ? DIFFICULTY_CONFIG.hard : DIFFICULTY_CONFIG.normal;
  }

  /* Skill / Ability System — data-driven, integrasi dengan 3 mode */
  const SKILLS = {
    dashSlash: { id: 'dashSlash', mode: 'SWORD', type: 'active', energyCost: 25, cooldown: 5, unlocked: false, name: 'Dash Slash', desc: 'Forward dash + attack', unlockedAtLevel: 2 },
    shieldBash: { id: 'shieldBash', mode: 'GUARDIAN', type: 'active', energyCost: 30, cooldown: 6, unlocked: false, name: 'Shield Bash', desc: 'Shield strike + knockback', unlockedAtLevel: 2 },
    multiShot: { id: 'multiShot', mode: 'ARCHER', type: 'active', energyCost: 35, cooldown: 5, unlocked: false, name: 'Multi Shot', desc: 'Multiple arrows', unlockedAtLevel: 2 },
    sharpEdge: { id: 'sharpEdge', mode: 'SWORD', type: 'passive', unlocked: false, name: 'Sharp Edge', desc: '+10% melee damage', unlockedAtLevel: 3 },
    comboMaster: { id: 'comboMaster', mode: 'SWORD', type: 'passive', unlocked: false, name: 'Combo Master', desc: '+15% combo damage', unlockedAtLevel: 4 },
    fortifiedGuard: { id: 'fortifiedGuard', mode: 'GUARDIAN', type: 'passive', unlocked: false, name: 'Fortified Guard', desc: '-20% damage when blocking', unlockedAtLevel: 3 },
    sturdy: { id: 'sturdy', mode: 'GUARDIAN', type: 'passive', unlocked: false, name: 'Sturdy', desc: '+10% HP survival', unlockedAtLevel: 4 },
    quickDraw: { id: 'quickDraw', mode: 'ARCHER', type: 'passive', unlocked: false, name: 'Quick Draw', desc: '-15% ranged cooldown', unlockedAtLevel: 3 },
    piercingArrow: { id: 'piercingArrow', mode: 'ARCHER', type: 'passive', unlocked: false, name: 'Piercing Arrow', desc: 'Arrow pierces certain enemies', unlockedAtLevel: 4 }
  };
  var skillEnergy = 100;
  var skillCooldowns = {};
  var skillLoadout = { active: null, passives: [] };

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
  // Stage 11: offset kaki data-driven — baris opaque terbawah sprite knight
  // (32px) harus tepat di hitbox bawah: dy + (32*3-15) = y + 78.
  var KNIGHT_FEET_DY = 15;
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
    var sfxG = null, musicG = null, musicCompressor = null;
    // Stage 6: pengaturan audio (default = perilaku lama persis).
    var sfxOn = true, sfxVol = 1, musicOn = true, musicVol = 0.7;
    var BASE_GAIN = 1.0, MUSIC_LEVEL = 1.0;

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
        sfxG.connect(ctx.destination);
        musicG = ctx.createGain();
        musicCompressor = ctx.createDynamicsCompressor();
        musicCompressor.threshold.value = -24;
        musicCompressor.knee.value = 30;
        musicCompressor.ratio.value = 4;
        musicCompressor.attack.value = 0.003;
        musicCompressor.release.value = 0.25;
        musicG.connect(musicCompressor);
        musicCompressor.connect(master);
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
      // Stage 5: event baru (menu, coin, varian, boss). Tetap prosedural.
      click:      function () { tone(660, 0.07, 'square', 0.3, 880); },
      pickup:     function () { tone(880, 0.09, 'square', 0.35, 1320); tone(1320, 0.12, 'square', 0.3, 1760, 0.07); },
      hitHeavy:   function () { noise(0.10, 0.5, 900); tone(140, 0.12, 'square', 0.45, 70); },
      bossAttack: function () { tone(160, 0.25, 'sawtooth', 0.45, 60); noise(0.15, 0.3, 700); },
      bossHurt:   function () { tone(240, 0.18, 'sawtooth', 0.45, 90); noise(0.10, 0.4, 1200); },
      bossDie:    function () { tone(300, 0.6, 'sawtooth', 0.45, 40); noise(0.5, 0.4, 800, 0.1); },
      shock:      function () { noise(0.18, 0.45, 600); tone(120, 0.18, 'triangle', 0.4, 50); },
      // Stage 9: identitas audio skeleton/lich (semua prosedural, tanpa BGM baru).
      skelHit:    function () { noise(0.07, 0.4, 2200); tone(340, 0.09, 'square', 0.35, 180); },
      swordSwing: function () { noise(0.10, 0.35, 3200); },
      shieldBlock: function () { tone(520, 0.09, 'square', 0.4, 480); noise(0.06, 0.3, 4000); },
      arrowShot:  function () { noise(0.08, 0.35, 4500); tone(900, 0.06, 'square', 0.25, 1400); },
      arrowImpact: function () { noise(0.09, 0.45, 1000); tone(150, 0.10, 'triangle', 0.4, 70); },
      minibossCue: function () { tone(130, 0.4, 'sawtooth', 0.45, 65); tone(98, 0.5, 'sawtooth', 0.4, 49, 0.1); },
      lichMagic:  function () { tone(220, 0.35, 'sawtooth', 0.4, 55); tone(330, 0.3, 'square', 0.3, 110, 0.05); },
      lichSummon: function () { tone(110, 0.4, 'sawtooth', 0.4, 440); noise(0.3, 0.3, 800, 0.1); },
      phaseShift: function () { noise(0.25, 0.45, 500); tone(90, 0.4, 'sawtooth', 0.5, 45); },
      // Treasure (prosedural, hormat SFX ON/volume via play()).
      chestOpen: function () { noise(0.12, 0.4, 900); tone(196, 0.15, 'square', 0.4, 392); },
      coin:      function () { tone(988, 0.09, 'square', 0.35, 1319); tone(1319, 0.14, 'square', 0.3, 1760, 0.07); },
      // Gold Shard treasure: shimmer permata (beda dari coin — sine cerah).
      shard:     function () { tone(1319, 0.10, 'sine', 0.35, 1760); tone(1760, 0.16, 'sine', 0.3, 2637, 0.08); },
      heal:      function () { tone(523, 0.12, 'sine', 0.4, 784); tone(784, 0.2, 'sine', 0.35, 1047, 0.1); },
      poison:    function () { tone(330, 0.25, 'sawtooth', 0.4, 110); noise(0.15, 0.35, 500, 0.05); },
      // Weapon Shop (prosedural, hormat SFX ON/volume via play()).
      shopOpen:  function () { tone(523, 0.09, 'square', 0.3, 784); tone(784, 0.1, 'square', 0.3, 1047, 0.07); },
      buy:       function () { tone(784, 0.1, 'square', 0.35, 1047); tone(1047, 0.16, 'square', 0.35, 1568, 0.08); },
      buyFail:   function () { tone(220, 0.15, 'square', 0.4, 147); },
      equip:     function () { tone(440, 0.09, 'square', 0.35, 660); tone(660, 0.12, 'square', 0.3, 880, 0.07); },
      bowShot:   function () { noise(0.07, 0.35, 5000); tone(1200, 0.05, 'square', 0.25, 1800); },
      block:     function () { tone(420, 0.08, 'square', 0.4, 380); noise(0.05, 0.3, 3500); }
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
    // Stage 9: mood BGM per level (0 slime, 1 dungeon, 2 final).
    // Di-set via setMood() saat load level; scheduler lanjut mulus
    // tanpa restart/re-init (tanpa duplikat).
    var musicMood = 0;

    function setMood(idx) {
      var n = Math.floor(Number(idx));
      if (!isFinite(n) || n < 0) n = 0;
      if (n > 2) n = 2;
      musicMood = n;
    }

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
      // Mood: dungeon lebih gelap (-2), final lebih cerah/tegang (+1).
      var tr = musicMood === 1 ? -2 : (musicMood === 2 ? 1 : 0);
      // Pad: awal tiap akor (3 nada, lembut, lowpass).
      if (s % 16 === 0) {
        for (i = 0; i < ch.length; i++) {
          musNote(ch[i] + tr, t, 16 * MUS_STEP, 'triangle', 0.045, 900);
        }
      }
      // Bass: intro (16 ketuk pertama) whole-note; lalu pulsa ketuk 0/4 + kuint di 6.
      if (s < 16) {
        if (s % 8 === 0) musNote(MUS_BASS[bar] + tr, t, 0.5, 'sine', 0.08);
      } else if (s % 2 === 0) {
        musNote((s % 8 === 6 ? MUS_BASS[bar] + 7 : MUS_BASS[bar]) + tr, t, 0.26, 'triangle', 0.10);
      }
      if (s < 16) return; // intro: tanpa arp/lead
      // Arpeggio nada akor +12, bergilir tiap ketuk.
      musNote(ch[s % 3] + 12 + tr, t, 0.22, 'square', 0.030);
      // Lead: slime = motif/variasi bergantian; dungeon = motif tegas;
      // final = variasi rapat (intens).
      var lead;
      if (musicMood === 1) lead = MUS_LEAD_A;
      else if (musicMood === 2) lead = MUS_LEAD_B;
      else lead = (music.loop % 2 === 0) ? MUS_LEAD_A : MUS_LEAD_B;
      if (lead[s] > 0) musNote(lead[s] + tr, t, 0.26, 'square', 0.055);
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
               scheduled: musicScheduled, mood: musicMood,
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
      musicInfo: musicInfo,
      // Stage 9: mood BGM per level (tanpa restart/duplikat scheduler).
      setMood: setMood,
      getMood: function () { return musicMood; }
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
    death:  ['assets/knight/death_0.png', 'assets/knight/death_1.png'],
    // Undead set (lokal, pixel-art dark fantasy; smoothing OFF saat draw).
    // Urutan frame: [idle, walk/alt, windup/cast, strike] agar mapping state murah.
    skelSword: ['assets/sprites/skeleton-sword.png',
                'assets/sprites/skeleton-sword-walk.png',
                'assets/sprites/skeleton-sword-windup.png',
                'assets/sprites/skeleton-sword-strike.png'],
    skelDef:   ['assets/sprites/skeleton-defender.png',
                'assets/sprites/skeleton-defender-guard.png',
                'assets/sprites/skeleton-defender-attack.png'],
    skelArch:  ['assets/sprites/skeleton-archer.png',
                'assets/sprites/skeleton-archer-aim.png',
                'assets/sprites/skeleton-archer-shoot.png'],
    skelKnight: ['assets/sprites/skeleton-knight.png',
                 'assets/sprites/skeleton-knight-slash.png',
                 'assets/sprites/skeleton-knight-dash.png'],
    lightningSlime: ['assets/sprites/lightning-slime.png',
                     'assets/sprites/lightning-slime-attack.png',
                     'assets/sprites/lightning-slime-dash.png'],
    lich:    ['assets/sprites/raja-lich.png',
              'assets/sprites/raja-lich-cast.png',
              'assets/sprites/raja-lich-strike.png'],
    chest:   ['assets/sprites/treasure-chest.png',
              'assets/sprites/treasure-chest-open.png'],
    // Stage 11: heroic knight set (lokal, 32px, bottom row ~26 —
    // kompatibel dengan matematika kaki PLAYER_DRAW). Dipakai player
    // bila siap; fallback ke assets/knight/* bila gagal/belum siap.
    knightIdle:   ['assets/sprites/knight-idle.png'],
    knightWalk:   ['assets/sprites/knight-walk.png',
                   'assets/sprites/knight-walk-2.png'],
    knightAttack:  ['assets/sprites/knight-attack.png'],
    knightAttack2: ['assets/sprites/knight-attack-2.png'],
    knightJump:   ['assets/sprites/knight-jump.png'],
    knightFall:   ['assets/sprites/knight-fall.png'],
    knightHurt:   ['assets/sprites/knight-hurt.png'],
    knightDeath:  ['assets/sprites/knight-death.png'],
    knightVictory: ['assets/sprites/knight-victory.png'],
    // Shop classes (lokal, 32px, bottom row 26 — kompatibel KNIGHT_FEET_DY).
    // Guardian: heavy armor + shield besar, silhouette lebar defensif.
    guardianIdle:   ['assets/sprites/guardian-idle.png'],
    guardianWalk:   ['assets/sprites/guardian-walk.png',
                     'assets/sprites/guardian-walk-2.png'],
    guardianBlock:  ['assets/sprites/guardian-block.png'],
    guardianAttack: ['assets/sprites/guardian-attack.png'],
    guardianJump:   ['assets/sprites/guardian-jump.png'],
    guardianFall:   ['assets/sprites/guardian-fall.png'],
    guardianHurt:   ['assets/sprites/guardian-hurt.png'],
    guardianDeath:  ['assets/sprites/guardian-death.png'],
    guardianVictory: ['assets/sprites/guardian-victory.png'],
    // Archer: ranger ringan + bow + quiver, silhouette ramping.
    archerIdle:   ['assets/sprites/archer-idle.png'],
    archerWalk:   ['assets/sprites/archer-walk.png',
                   'assets/sprites/archer-walk-2.png'],
    archerAim:    ['assets/sprites/archer-aim.png'],
    archerShoot:  ['assets/sprites/archer-shoot.png'],
    archerJump:   ['assets/sprites/archer-jump.png'],
    archerFall:   ['assets/sprites/archer-fall.png'],
    archerHurt:   ['assets/sprites/archer-hurt.png'],
    archerDeath:  ['assets/sprites/archer-death.png'],
    archerVictory: ['assets/sprites/archer-victory.png'],
    // Weapon overlay per item (CHARACTER BASE + WEAPON OVERLAY + FX).
    // Overlay hanya berisi senjata pada anchor canon generator base;
    // offset per-(mode,state) di WEAPON_ANCHOR menyerap beda 1px class/lean.
    wRustyDown: ['assets/sprites/weapon-rusty-down.png'],
    wRustyHoriz: ['assets/sprites/weapon-rusty-horiz.png'],
    wRustyUp: ['assets/sprites/weapon-rusty-up.png'],
    wRustyBack: ['assets/sprites/weapon-rusty-back.png'],
    wSteelDown: ['assets/sprites/weapon-steel-down.png'],
    wSteelHoriz: ['assets/sprites/weapon-steel-horiz.png'],
    wSteelUp: ['assets/sprites/weapon-steel-up.png'],
    wSteelBack: ['assets/sprites/weapon-steel-back.png'],
    wSilverDown: ['assets/sprites/weapon-silver-down.png'],
    wSilverHoriz: ['assets/sprites/weapon-silver-horiz.png'],
    wSilverUp: ['assets/sprites/weapon-silver-up.png'],
    wSilverBack: ['assets/sprites/weapon-silver-back.png'],
    wShadowfangDown: ['assets/sprites/weapon-shadowfang-down.png'],
    wShadowfangHoriz: ['assets/sprites/weapon-shadowfang-horiz.png'],
    wShadowfangUp: ['assets/sprites/weapon-shadowfang-up.png'],
    wShadowfangBack: ['assets/sprites/weapon-shadowfang-back.png'],
    wSunfireDown: ['assets/sprites/weapon-sunfire-down.png'],
    wSunfireHoriz: ['assets/sprites/weapon-sunfire-horiz.png'],
    wSunfireUp: ['assets/sprites/weapon-sunfire-up.png'],
    wSunfireBack: ['assets/sprites/weapon-sunfire-back.png'],
    wBucklerSide: ['assets/sprites/weapon-buckler-side.png'],
    wBucklerFront: ['assets/sprites/weapon-buckler-front.png'],
    wKiteSide: ['assets/sprites/weapon-kite-side.png'],
    wKiteFront: ['assets/sprites/weapon-kite-front.png'],
    wTowerSide: ['assets/sprites/weapon-tower-side.png'],
    wTowerFront: ['assets/sprites/weapon-tower-front.png'],
    wAegisSide: ['assets/sprites/weapon-aegis-side.png'],
    wAegisFront: ['assets/sprites/weapon-aegis-front.png'],
    wBastionSide: ['assets/sprites/weapon-bastion-side.png'],
    wBastionFront: ['assets/sprites/weapon-bastion-front.png'],
    wMakeshiftSide: ['assets/sprites/weapon-makeshift-side.png'],
    wMakeshiftDrawn: ['assets/sprites/weapon-makeshift-drawn.png'],
    wHunterSide: ['assets/sprites/weapon-hunter-side.png'],
    wHunterDrawn: ['assets/sprites/weapon-hunter-drawn.png'],
    wElvenSide: ['assets/sprites/weapon-elven-side.png'],
    wElvenDrawn: ['assets/sprites/weapon-elven-drawn.png'],
    wStormSide: ['assets/sprites/weapon-storm-side.png'],
    wStormDrawn: ['assets/sprites/weapon-storm-drawn.png'],
    wDragonSide: ['assets/sprites/weapon-dragon-side.png'],
    wDragonDrawn: ['assets/sprites/weapon-dragon-drawn.png'],
    // Coin level (collectible): coin.png. Treasure Gold Shard: gold-shard.png
    // (berlian emas — jelas beda dari koin bulat).
    coin:    ['assets/sprites/coin.png'],
    reward:  ['assets/sprites/gold-shard.png',
              'assets/sprites/health.png',
              'assets/sprites/poison.png']
  };
  var ANIM_ORDER = ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'death',
    'skelSword', 'skelDef', 'skelArch', 'skelKnight', 'lightningSlime', 'lich', 'chest', 'coin', 'reward',
    'knightIdle', 'knightWalk', 'knightAttack', 'knightAttack2', 'knightJump',
    'knightFall', 'knightHurt', 'knightDeath', 'knightVictory',
    'guardianIdle', 'guardianWalk', 'guardianBlock', 'guardianAttack', 'guardianJump',
    'guardianFall', 'guardianHurt', 'guardianDeath', 'guardianVictory',
    'archerIdle', 'archerWalk', 'archerAim', 'archerShoot', 'archerJump',
    'archerFall', 'archerHurt', 'archerDeath', 'archerVictory',
    'wRustyDown', 'wRustyHoriz', 'wRustyUp', 'wRustyBack',
    'wSteelDown', 'wSteelHoriz', 'wSteelUp', 'wSteelBack',
    'wSilverDown', 'wSilverHoriz', 'wSilverUp', 'wSilverBack',
    'wShadowfangDown', 'wShadowfangHoriz', 'wShadowfangUp', 'wShadowfangBack',
    'wSunfireDown', 'wSunfireHoriz', 'wSunfireUp', 'wSunfireBack',
    'wBucklerSide', 'wBucklerFront', 'wKiteSide', 'wKiteFront',
    'wTowerSide', 'wTowerFront', 'wAegisSide', 'wAegisFront',
    'wBastionSide', 'wBastionFront',
    'wMakeshiftSide', 'wMakeshiftDrawn', 'wHunterSide', 'wHunterDrawn',
    'wElvenSide', 'wElvenDrawn', 'wStormSide', 'wStormDrawn',
    'wDragonSide', 'wDragonDrawn'];

  var sprites = { idle: [], run: [], jump: [], fall: [], attack: [], hurt: [], death: [],
    skelSword: [], skelDef: [], skelArch: [], skelKnight: [], lightningSlime: [], lich: [], chest: [], coin: [], reward: [],
    knightIdle: [], knightWalk: [], knightAttack: [], knightAttack2: [], knightJump: [],
    knightFall: [], knightHurt: [], knightDeath: [], knightVictory: [],
    guardianIdle: [], guardianWalk: [], guardianBlock: [], guardianAttack: [], guardianJump: [],
    guardianFall: [], guardianHurt: [], guardianDeath: [], guardianVictory: [],
    archerIdle: [], archerWalk: [], archerAim: [], archerShoot: [], archerJump: [],
    archerFall: [], archerHurt: [], archerDeath: [], archerVictory: [],
    wRustyDown: [], wRustyHoriz: [], wRustyUp: [], wRustyBack: [],
    wSteelDown: [], wSteelHoriz: [], wSteelUp: [], wSteelBack: [],
    wSilverDown: [], wSilverHoriz: [], wSilverUp: [], wSilverBack: [],
    wShadowfangDown: [], wShadowfangHoriz: [], wShadowfangUp: [], wShadowfangBack: [],
    wSunfireDown: [], wSunfireHoriz: [], wSunfireUp: [], wSunfireBack: [],
    wBucklerSide: [], wBucklerFront: [], wKiteSide: [], wKiteFront: [],
    wTowerSide: [], wTowerFront: [], wAegisSide: [], wAegisFront: [],
    wBastionSide: [], wBastionFront: [],
    wMakeshiftSide: [], wMakeshiftDrawn: [], wHunterSide: [], wHunterDrawn: [],
    wElvenSide: [], wElvenDrawn: [], wStormSide: [], wStormDrawn: [],
    wDragonSide: [], wDragonDrawn: [] };
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

  /* ================== 4b. WEAPON SHOP (data-driven) ==================
   * 15 item, 3 kategori x 5. Harga persis spesifikasi. Engine membaca stats
   * via lookup (shopItemById/swordStats/shieldStats/bowStats) — tanpa
   * branching per-ID senjata yang tersebar di logic combat.
   * Tier: Common < Uncommon < Rare < Epic. Baseline game = Rusty Iron Sword
   * (dmg 12, speed 1.0, reach baseline) sehingga default 100% kompatibel. */
  var TIER_META = {
    Common:   { color: '#9aa3c7', bg: '#2a2f45', symbol: '●', label: 'COMMON' },
    Uncommon: { color: '#5ec46f', bg: '#1d3a26', symbol: '◆', label: 'UNCOMMON' },
    Rare:     { color: '#5aa9ff', bg: '#1c2c4d', symbol: '★', label: 'RARE' },
    Epic:     { color: '#c07bff', bg: '#35224d', symbol: '⬥', label: 'EPIC' }
  };
  var SHOP_ITEMS = [
    // ---- PEDANG ----
    { id: 'rusty', category: 'sword', name: 'Rusty Iron Sword', tier: 'Common', price: 50,
      desc: 'Pedang besi berkarat standar yang biasa dipakai pemula.',
      damage: 12, attackSpeed: 1.0, range: 0, defense: 0, projectileSpeed: 0, passive: null, special: null },
    { id: 'steel', category: 'sword', name: 'Sharpened Steel Blade', tier: 'Uncommon', price: 250,
      desc: 'Pedang baja yang sudah diasah tajam, cocok untuk petualang tingkat awal.',
      damage: 14, attackSpeed: 1.1, range: 0, defense: 0, projectileSpeed: 0, passive: null, special: null },
    { id: 'silver', category: 'sword', name: "Silver Knight's Broadsword", tier: 'Rare', price: 1200,
      desc: 'Pedang kebanggaan ksatria dengan ukiran perak murni.',
      damage: 17, attackSpeed: 1.15, range: 12, defense: 0, projectileSpeed: 0, passive: null, special: null },
    { id: 'shadowfang', category: 'sword', name: 'Shadowfang Saber', tier: 'Epic', price: 5500,
      desc: 'Pedang berbilah gelap yang bisa memberikan efek racun bayangan pada musuh.',
      damage: 20, attackSpeed: 1.2, range: 6, defense: 0, projectileSpeed: 0, passive: null,
      special: { kind: 'poison', dps: 3, duration: 3 } },
    { id: 'sunfire', category: 'sword', name: 'Sunfire Greatsword', tier: 'Epic', price: 5500,
      desc: 'Pedang pusaka besar yang memancarkan hawa panas matahari.',
      damage: 20, attackSpeed: 1.05, range: 8, defense: 0, projectileSpeed: 0, passive: null,
      special: { kind: 'burn', dps: 2, duration: 2, cooldown: 5 } },
    // ---- PERISAI ----
    { id: 'buckler', category: 'shield', name: 'Wooden Buckler', tier: 'Common', price: 40,
      desc: 'Perisai bundar kecil berbahan kayu tipis untuk menangkis serangan ringan.',
      damage: 0, attackSpeed: 1.0, range: 0, defense: 0.25, projectileSpeed: 0, passive: null, special: null },
    { id: 'kite', category: 'shield', name: 'Iron Kite Shield', tier: 'Uncommon', price: 200,
      desc: 'Perisai berbentuk layang-layang dari plat besi, memberikan perlindungan tubuh yang lebih baik.',
      damage: 0, attackSpeed: 1.0, range: 0, defense: 0.4, projectileSpeed: 0, passive: null, special: null },
    { id: 'tower', category: 'shield', name: 'Tower Guard Shield', tier: 'Rare', price: 1000,
      desc: 'Perisai badan besar yang kokoh, sangat handal untuk menahan serangan jarak jauh.',
      damage: 0, attackSpeed: 1.0, range: 0, defense: 0.55, projectileSpeed: 0, passive: null,
      special: { kind: 'projGuard', projExtra: 0.2 } },
    { id: 'aegis', category: 'shield', name: 'Mithril Aegis', tier: 'Epic', price: 4800,
      desc: 'Perisai ringan berbahan mithril yang memiliki daya tahan luar biasa terhadap sihir.',
      damage: 0, attackSpeed: 1.0, range: 0, defense: 0.65, projectileSpeed: 0, passive: null,
      special: { kind: 'magicGuard', magicExtra: 0.15 } },
    { id: 'bastion', category: 'shield', name: 'Bastion of the Immortal', tier: 'Epic', price: 4800,
      desc: 'Perisai legendaris dengan aura pelindung magis yang memperkuat pertahanan penggunanya.',
      damage: 0, attackSpeed: 1.0, range: 0, defense: 0.75, projectileSpeed: 0, passive: null,
      special: { kind: 'aura', hits: 3, window: 10, activeTime: 2, activeRed: 0.9, cooldown: 12 } },
    // ---- PEMANAH ----
    { id: 'makeshift', category: 'bow', name: 'Makeshift Wooden Bow', tier: 'Common', price: 45,
      desc: 'Busur kayu sederhana yang dibuat sendiri menggunakan tali biasa.',
      damage: 10, attackSpeed: 1.0, range: 420, defense: 0, projectileSpeed: 380, passive: null, special: null },
    { id: 'hunter', category: 'bow', name: "Hunter's Recurve Bow", tier: 'Uncommon', price: 220,
      desc: 'Busur lentur buatan pemburu profesional untuk tembakan yang lebih jauh dan akurat.',
      damage: 12, attackSpeed: 1.1, range: 460, defense: 0, projectileSpeed: 440, passive: null, special: null },
    { id: 'elven', category: 'bow', name: 'Elven Wind Bow', tier: 'Rare', price: 1150,
      desc: 'Busur buatan bangsa peri yang membuat anak panah melesat lebih cepat seperti angin.',
      damage: 14, attackSpeed: 1.2, range: 500, defense: 0, projectileSpeed: 520, passive: null,
      special: { kind: 'windTrail' } },
    { id: 'storm', category: 'bow', name: 'Stormpiercer Longbow', tier: 'Epic', price: 5000,
      desc: 'Busur panjang yang setiap anak panahnya dialiri oleh listrik statis.',
      damage: 16, attackSpeed: 1.1, range: 520, defense: 0, projectileSpeed: 520, passive: null,
      special: { kind: 'lightning', chain: 4, chainRange: 60 } },
    { id: 'dragon', category: 'bow', name: 'Dragonbone Greatbow', tier: 'Epic', price: 5000,
      desc: 'Busur raksasa yang terbuat dari tulang naga, menghasilkan daya tembus panah yang mematikan.',
      damage: 22, attackSpeed: 0.9, range: 540, defense: 0, projectileSpeed: 480, passive: null,
      special: { kind: 'pierce', pierce: 2 } }
  ];
  function shopItemById(id) {
    for (var _si = 0; _si < SHOP_ITEMS.length; _si++) {
      if (SHOP_ITEMS[_si].id === id) return SHOP_ITEMS[_si];
    }
    return null;
  }
  function shopItemsByCategory(cat) {
    var out = [];
    for (var _sj = 0; _sj < SHOP_ITEMS.length; _sj++) {
      if (SHOP_ITEMS[_sj].category === cat) out.push(SHOP_ITEMS[_sj]);
    }
    return out;
  }
  function swordStats() {
    return shopItemById(save.eqSword) || shopItemById('rusty');
  }
  function shieldStats() {
    return shopItemById(save.eqShield) || shopItemById('buckler');
  }
  function bowStats() {
    return shopItemById(save.eqBow) || shopItemById('makeshift');
  }
  function playerMode() {
    return (save.mode === 'GUARDIAN' || save.mode === 'ARCHER') ? save.mode : 'SWORD';
  }

  /* WEAPON OVERLAY LOOKUP (item.id -> sprite key per varian + file preview).
   * Kunci kapitalisasi: 'w' + Id + Varian. Preview memakai representatif
   * (down/side) agar bentuk item terbaca jelas di Shop. */
  function wKey(id, variant) {
    return 'w' + id.charAt(0).toUpperCase() + id.slice(1) + variant;
  }
  var WEAPON_VARIANT = {
    rusty: ['Down', 'Horiz', 'Up', 'Back'], steel: ['Down', 'Horiz', 'Up', 'Back'],
    silver: ['Down', 'Horiz', 'Up', 'Back'], shadowfang: ['Down', 'Horiz', 'Up', 'Back'],
    sunfire: ['Down', 'Horiz', 'Up', 'Back'],
    buckler: ['Side', 'Front'], kite: ['Side', 'Front'], tower: ['Side', 'Front'],
    aegis: ['Side', 'Front'], bastion: ['Side', 'Front'],
    makeshift: ['Side', 'Drawn'], hunter: ['Side', 'Drawn'], elven: ['Side', 'Drawn'],
    storm: ['Side', 'Drawn'], dragon: ['Side', 'Drawn']
  };
  var WEAPON_PREV_VARIANT = {
    rusty: 'Down', steel: 'Down', silver: 'Down', shadowfang: 'Down', sunfire: 'Down',
    buckler: 'Side', kite: 'Side', tower: 'Side', aegis: 'Side', bastion: 'Side',
    makeshift: 'Side', hunter: 'Side', elven: 'Side', storm: 'Side', dragon: 'Side'
  };
  function weaponFile(id) {
    var v = WEAPON_PREV_VARIANT[id];
    if (!v) return null;
    return 'assets/sprites/weapon-' + id + '-' + v.toLowerCase() + '.png';
  }
  /* Attachment per-(mode,state): varian + offset sprite-px yang menyerap
   * beda 1px antar class/lean (kalibrasi terhadap generator base).
   * Death -> null (senjata jatuh bersama badan; base corpse yang tampil). */
  var _wov = { key: null, ox: 0, oy: 0 }; // scratch reuse (tanpa alokasi/frame)
  function pickWeaponOverlay(cat, forceUp) {
    _wov.key = null; _wov.ox = 0; _wov.oy = 0;
    var mode = 'SWORD';
    try { mode = playerMode(); } catch (e) { mode = 'SWORD'; }
    var st = player.state;
    if (st === 'death') return _wov;
    if (cat === 'sword') {
      if (mode === 'ARCHER') return _wov;
      var id = 'rusty';
      try { id = save.eqSword || 'rusty'; } catch (e) { id = 'rusty'; }
      var knight = (mode !== 'GUARDIAN');
      var wf = 0;
      try { wf = Math.floor(player.animTime * 10) % 2; } catch (e2) { wf = 0; }
      // Layar menang: base memakai pose victory (pedang ke atas).
      if (forceUp) {
        _wov.key = wKey(id, 'Up');
        _wov.ox = knight ? 0 : 1; _wov.oy = 1;
        return _wov;
      }
      if (st === 'attack') {
        if (!knight) {
          // Guardian menyerang dengan PERISAI (shield bash), bukan pedang:
          // overlay pedang disembunyikan, overlay perisai (front) yang maju.
          // Base sword tertutup overlay shield (tangan tetap terlihat megang).
          return _wov;
        }
        // Knight: cerminkan playerAttackFrame: windup->Back, strike->Horiz,
        // recovery->Back (non-kombo) / Horiz (kombo).
        var spd = 1;
        try { var _s = swordStats(); spd = (_s && _s.attackSpeed > 0) ? _s.attackSpeed : 1; } catch (e3) { spd = 1; }
        var wu = ATTACK_WINDUP / spd, sst = ATTACK_STRIKE / spd;
        var combo = !!player.combo;
        var phase = (player.attackT < wu) ? 'windup' : ((player.attackT < wu + sst) ? 'strike' : 'recovery');
        var wantHoriz = combo ? (phase !== 'strike') : (phase === 'strike');
        if (wantHoriz) {
          _wov.key = wKey(id, 'Horiz');
          _wov.ox = 2; _wov.oy = 1;
        } else {
          _wov.key = wKey(id, 'Back');
          _wov.ox = 1; _wov.oy = 0;
        }
        return _wov;
      }
      if (st === 'jump') {
        _wov.key = wKey(id, 'Up');
        _wov.ox = knight ? 1 : 2; _wov.oy = 0;
        return _wov;
      }
      _wov.key = wKey(id, 'Down');
      if (knight) {
        if (st === 'run') _wov.ox = (wf === 0) ? 1 : 0;
        else if (st === 'hurt') _wov.ox = -2;
      } else {
        _wov.ox = 1;
        if (st === 'run') _wov.ox = 2;
        else if (st === 'hurt') _wov.ox = -1;
        else if (st === 'block') { _wov.ox = 0; _wov.oy = -1; }
      }
      return _wov;
    }
    if (cat === 'shield') {
      if (mode !== 'GUARDIAN') return _wov;
      var sid = 'buckler';
      try { sid = save.eqShield || 'buckler'; } catch (e4) { sid = 'buckler'; }
      if (st === 'block') {
        _wov.key = wKey(sid, 'Front');
        _wov.ox = -1; _wov.oy = 0;
      } else if (st === 'attack') {
        // Shield bash: perisai didorong ke depan (thrust).
        _wov.key = wKey(sid, 'Front');
        _wov.ox = 2; _wov.oy = 0;
      } else {
        _wov.key = wKey(sid, 'Side');
        _wov.ox = 0;
        if (st === 'run' || st === 'attack' || st === 'jump') _wov.ox = 1;
        else if (st === 'hurt') _wov.ox = -2;
      }
      return _wov;
    }
    if (cat === 'bow') {
      if (mode !== 'ARCHER') return _wov;
      var bid = 'makeshift';
      try { bid = save.eqBow || 'makeshift'; } catch (e5) { bid = 'makeshift'; }
      if (st === 'aim' || st === 'attack') {
        _wov.key = wKey(bid, 'Drawn');
        _wov.ox = 1; _wov.oy = 0;
      } else {
        _wov.key = wKey(bid, 'Side');
        _wov.ox = 0;
        if (st === 'run' || st === 'jump') _wov.ox = 1;
        else if (st === 'hurt') _wov.ox = -2;
      }
      return _wov;
    }
    return _wov;
  }

  /* ============================ 5. INPUT ============================ */
  var Input = {
    left: false, right: false, jumpHeld: false,
    jumpPressed: false,    // edge-trigger, dikonsumsi oleh Player
    attackPressed: false,  // edge-trigger, dikonsumsi oleh Player
    blockHeld: false,      // tahan untuk block (Guardian); dibersihkan saat pause/menu
    restartPressed: false,  // edge-trigger, dikonsumsi oleh Game
    skillPressed: false    // skill active
  };

  window.addEventListener('keydown', function (e) {
    // Shop mobile: gesture/keyboard di Shop tak boleh bocor ke gameplay
    // (swipe bukan movement, tap BUY bukan attack). Navigasi Shop diurus
    // listener nav; state dibersihkan via clearInput saat buka/tutup.
    if (typeof gameState !== 'undefined' && gameState === 'shop') return;
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
    else if (e.code === 'KeyQ') {
      Input.skillPressed = true;
      e.preventDefault();
    }
    else if (e.code === 'KeyK' || e.code === 'KeyL' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      Input.blockHeld = true;
      e.preventDefault();
    }
    else if (e.code === 'KeyR' || e.code === 'Enter') { Input.restartPressed = true; }
  });
  window.addEventListener('keyup', function (e) {
    if (typeof gameState !== 'undefined' && gameState === 'shop') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') Input.left = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') Input.right = false;
    else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') Input.jumpHeld = false;
    else if (e.code === 'KeyK' || e.code === 'KeyL' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') Input.blockHeld = false;
  });

  /* Stage 10: satu jalur Pointer Events (pointerdown/up/cancel/leave).
   * Multi-touch native via pointerId (left+jump, right+attack, dst).
   * Tidak ada guard timeout: tidak double-trigger by-design (satu pointer
   * aktif per tombol, pointer kedua diabaikan). pointercancel + rotasi
   * membersihkan state agar tidak stuck pressed. */
  function bindHoldButton(id, onDown, onUp) {
    var el = document.getElementById(id);
    if (!el) { debugLog('[input] tombol tidak ditemukan:', id); return; }
    var activePointer = null; // pointerId penahan saat ini (satu per tombol)
    var pidOf = function (e) {
      return (e && e.pointerId !== undefined && e.pointerId !== null) ? e.pointerId : 'mouse';
    };
    var down = function (e, pid) {
      if (activePointer !== null) return; // duplikat: abaikan
      activePointer = pid;
      if (e && e.cancelable) e.preventDefault();
      el.classList.add('pressed');
      onDown();
    };
    var up = function (e, pid) {
      if (activePointer !== null && pid !== activePointer) return;
      activePointer = null;
      if (e && e.cancelable) e.preventDefault();
      try { el.classList.remove('pressed'); } catch (err) { /* abaikan */ }
      onUp();
    };
    var clearHold = function () {
      activePointer = null;
      try { el.classList.remove('pressed'); } catch (err) { /* abaikan */ }
      try {
        if (id === 'btn-left') Input.left = false;
        else if (id === 'btn-right') Input.right = false;
        else if (id === 'btn-jump') Input.jumpHeld = false;
        else if (id === 'btn-block') Input.blockHeld = false;
      } catch (err) { /* abaikan */ }
    };
    if (typeof window !== 'undefined' && window.PointerEvent) {
      el.addEventListener('pointerdown', function (e) { down(e, pidOf(e)); });
      el.addEventListener('pointerup', function (e) { up(e, pidOf(e)); });
      el.addEventListener('pointercancel', function (e) { up(e, pidOf(e)); });
      el.addEventListener('pointerleave', function (e) {
        if (activePointer !== null) up(e, pidOf(e));
      });
    } else {
      // Fallback legacy (browser sangat lama tanpa PointerEvent).
      el.addEventListener('touchstart', function (e) { down(e, 'touch'); }, { passive: false });
      el.addEventListener('touchend', function (e) { up(e, 'touch'); });
      el.addEventListener('touchcancel', function (e) { up(e, 'touch'); });
      el.addEventListener('mousedown', function (e) { down(e, 'mouse'); });
      el.addEventListener('mouseup', function (e) { up(e, 'mouse'); });
    }
    // Rotasi/orientasi: jangan tinggalkan tombol pressed (anti stuck).
    if (typeof window !== 'undefined' && window.addEventListener) {
      try {
        window.addEventListener('orientationchange', function () { clearHold(); });
      } catch (err) { /* abaikan */ }
    }
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ========================= 6. LEVEL DATA =========================
   * Lima level dalam struktur data yang sama (mudah diedit).
   * Level 1 = level existing PERSIS (physics/layout musuh/checkpoint/goal
   * tidak berubah) + rute Coin (non-colliding, nol risiko regresi).
   * Level 2 = traversal, 3 celah, encounter Fast+Heavy,
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
    treasures: [{ x: 300, y: 444 }],
    // Coin: mudah = eksplorasi, menengah = traversal,
    // sulit = risk/reward (HARD di atas celah — diambil sambil lompat).
    coins: [
      { x: 250, y: 430 },   // tanah start (mudah)
      { x: 350, y: 258 },   // atas platform 300,300 (menengah)
      { x: 565, y: 378 },   // atas CELAH 1: lompat untuk mengambil (sulit)
      { x: 1250, y: 430 },  // arena combat (lawan Slime)
      { x: 1470, y: 258 },  // atas platform arena (menengah)
      { x: 2200, y: 430 }   // dekat goal (menengah)
    ],
    miniSpawn: { x: 1750, y: 440 },
    miniArena: { minX: 1600, maxX: 1900 }
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
      { x: 2050, y: 365, w: 140, h: 20 }    // pijakan taktik di arena boss
      // NOTE: langkah dari tanah 115px (batas lompat riil ~121px).
      // Jangan di atas y=365 — tak terjangkau dan jadi dekorasi mati.
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
    treasures: [{ x: 300, y: 444 }],
    coins: [
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
  var Level3 = {
    name: 'Level 3',
    playerSpawn: { x: 80, y: 300 },
    platforms: [
      { x: 0,    y: 480, w: 520,  h: 60 },
      { x: 610,  y: 480, w: 440,  h: 60 },
      { x: 1140, y: 480, w: 610,  h: 60 },
      { x: 1840, y: 480, w: 560,  h: 60 },
      { x: 180,  y: 372, w: 150, h: 20 },
      { x: 300,  y: 300, w: 140, h: 20 },
      { x: 650,  y: 365, w: 150, h: 20 },
      { x: 820,  y: 290, w: 140, h: 20 },
      { x: 1180, y: 375, w: 150, h: 20 },
      { x: 1400, y: 300, w: 140, h: 20 },
      { x: 1620, y: 335, w: 130, h: 20 },
      { x: 1920, y: 365, w: 140, h: 20 },
      { x: 2120, y: 290, w: 140, h: 20 }
    ],
    enemySpawns: [
      { type: 'skeletonSword',    x: 700,  y: 424, minX: 620,  maxX: 950  },
      { type: 'skeletonDefender', x: 1250, y: 422, minX: 1170, maxX: 1400 },
      { type: 'skeletonArcher',   x: 1520, y: 426, minX: 1450, maxX: 1700 },
      { type: 'skeletonSword',    x: 1620, y: 424, minX: 1500, maxX: 1730 },
      { type: 'skeletonDefender', x: 1980, y: 422, minX: 1870, maxX: 2120 },
      { type: 'skeletonArcher',   x: 2210, y: 426, minX: 2100, maxX: 2360 }
    ],
    checkpoints: [
      { x: 1160, baseY: 480, w: 34, h: 96, activated: false },
      { x: 1860, baseY: 480, w: 34, h: 96, activated: false }
    ],
    goal: { x: 2280, baseY: 480, w: 70, h: 120 },
    bossSpawn: null,
    bossArena: null,
    bossKind: null,
    bossMods: null,
    miniSpawn: { x: 1400, y: 400 },
    miniArena: { minX: 1200, maxX: 1600 },
    lichSpawn: null,
    lichArena: null,
    treasures: [{ x: 300, y: 444 }],
    musicSet: 1,
    coins: [
      { x: 250, y: 430 },
      { x: 350, y: 258 },
      { x: 565, y: 378 },
      { x: 1250, y: 430 },
      { x: 1470, y: 258 },
      { x: 2200, y: 430 }
    ]
  };
  /* Level 4 (Stage 9): LICH DOMAIN — escalation L3 + RAJA LICH.
   * Backbone skeleton tetap, placement lebih cerdas (choke defender,
   * archer support, verticality via rute atas). RAJA LICH sebagai final
   * encounter (goal null). Midboss Panglima Tulang berada di Level 3. */
  var Level4 = {
    name: 'Level 4',
    playerSpawn: { x: 80, y: 300 },
    platforms: [
      { x: 0,    y: 480, w: 420,  h: 60 },
      { x: 510,  y: 480, w: 500,  h: 60 },
      { x: 1100, y: 480, w: 420,  h: 60 },
      { x: 1520, y: 480, w: 300,  h: 60 },
      { x: 1910, y: 480, w: 490,  h: 60 },
      { x: 150,  y: 372, w: 140, h: 20 },
      { x: 560,  y: 365, w: 140, h: 20 },
      { x: 730,  y: 290, w: 130, h: 20 },
      { x: 1140, y: 372, w: 140, h: 20 },
      { x: 1330, y: 297, w: 130, h: 20 },
      { x: 1560, y: 365, w: 130, h: 20 },
      { x: 1690, y: 290, w: 120, h: 20 },
      { x: 2050, y: 365, w: 140, h: 20 }
    ],
    enemySpawns: [
      { type: 'skeletonSword',    x: 700,  y: 424, minX: 560,  maxX: 960  },
      { type: 'skeletonDefender', x: 1150, y: 422, minX: 1080, maxX: 1300 },
      { type: 'skeletonArcher',   x: 1400, y: 426, minX: 1300, maxX: 1520 },
      { type: 'skeletonSword',    x: 1500, y: 424, minX: 1400, maxX: 1650 },
      { type: 'skeletonDefender', x: 1650, y: 422, minX: 1560, maxX: 1810 },
      { type: 'skeletonArcher',   x: 1750, y: 426, minX: 1650, maxX: 1820 }
    ],
    checkpoints: [
      { x: 1140, baseY: 480, w: 34, h: 96, activated: false },
      { x: 1935, baseY: 480, w: 34, h: 96, activated: false }
    ],
    goal: null,
    bossSpawn: { x: 2150, y: 380 },
    bossArena: { minX: 1930, maxX: 2360 },
    bossKind: 'lich',
    bossMods: null,
    miniSpawn: null,
    miniArena: null,
    lichSpawn: null,
    lichArena: null,
    treasures: [{ x: 1770, y: 444 }],
    musicSet: 1,
    coins: [
      { x: 250, y: 430 },
      { x: 465, y: 380 },
      { x: 795, y: 250 },
      { x: 1055, y: 380 },
      { x: 1395, y: 257 },
      { x: 1750, y: 250 },
      { x: 1865, y: 380 },
      { x: 2250, y: 430 }
    ]
  };
  /* Level 5 (Stage 9): FINAL CONVERGENCE — slime + skeleton + kedua raja.
   * Progression: mixed intro -> slime-focused -> skeleton-focused ->
   * high-pressure -> RAJA SLIME -> interlude -> RAJA LICH -> GAME COMPLETE.
   * Boss pertama slimeKing (bossSpawn), boss kedua lich (lichSpawn). */
  var Level5 = {
    name: 'Level 5',
    playerSpawn: { x: 80, y: 300 },
    platforms: [
      { x: 0,    y: 480, w: 420,  h: 60 },
      { x: 510,  y: 480, w: 500,  h: 60 },
      { x: 1100, y: 480, w: 420,  h: 60 },
      { x: 1520, y: 480, w: 300,  h: 60 },
      { x: 1910, y: 480, w: 490,  h: 60 },
      { x: 150,  y: 372, w: 140, h: 20 },
      { x: 560,  y: 365, w: 140, h: 20 },
      { x: 730,  y: 290, w: 130, h: 20 },
      { x: 1140, y: 372, w: 140, h: 20 },
      { x: 1330, y: 297, w: 130, h: 20 },
      { x: 1560, y: 365, w: 130, h: 20 },
      { x: 1690, y: 290, w: 120, h: 20 },
      { x: 2050, y: 365, w: 140, h: 20 }
    ],
    enemySpawns: [
      { type: 'slime',            x: 650,  y: 448, minX: 560,  maxX: 900  },
      { type: 'skeletonSword',    x: 850,  y: 424, minX: 750,  maxX: 1000 },
      { type: 'fast',             x: 1200, y: 448, minX: 1100, maxX: 1350 },
      { type: 'heavy',            x: 1350, y: 440, minX: 1300, maxX: 1550 },
      { type: 'skeletonDefender', x: 1620, y: 422, minX: 1540, maxX: 1730 },
      { type: 'skeletonArcher',   x: 1740, y: 426, minX: 1650, maxX: 1850 }
    ],
    checkpoints: [
      { x: 1140, baseY: 480, w: 34, h: 96, activated: false },
      { x: 1935, baseY: 480, w: 34, h: 96, activated: false }
    ],
    goal: null,
    bossSpawn: { x: 2150, y: 380 },
    bossArena: { minX: 1930, maxX: 2360 },
    bossKind: 'slimeKing',
    bossMods: { hpMul: 0.9 },
    miniSpawn: null,
    miniArena: null,
    lichSpawn: { x: 2150, y: 360 },
    lichArena: { minX: 1930, maxX: 2360 },
    treasures: [{ x: 1150, y: 444 }],
    musicSet: 2,
    coins: [
      { x: 250, y: 430 },
      { x: 465, y: 380 },
      { x: 795, y: 250 },
      { x: 1055, y: 380 },
      { x: 1395, y: 257 },
      { x: 1750, y: 250 },
      { x: 1865, y: 380 },
      { x: 2250, y: 430 }
    ]
  };
  // L1/L2 butuh field Stage 9 agar loader generik aman (null = nonaktif).
  Level1.bossKind = Level1.bossKind || null;
  Level1.bossMods = Level1.bossMods || null;
  Level1.miniSpawn = Level1.miniSpawn || null;
  Level1.miniArena = Level1.miniArena || null;
  Level1.lichSpawn = Level1.lichSpawn || null;
  Level1.lichArena = Level1.lichArena || null;
  Level1.treasures = Level1.treasures || null;
  Level1.musicSet = Level1.musicSet || 0;
  Level2.bossKind = Level2.bossKind || 'slimeKing';
  Level2.bossMods = Level2.bossMods || null;
  Level2.miniSpawn = Level2.miniSpawn || null;
  Level2.miniArena = Level2.miniArena || null;
  Level2.lichSpawn = Level2.lichSpawn || null;
  Level2.lichArena = Level2.lichArena || null;
  Level2.treasures = Level2.treasures || null;
  Level2.musicSet = Level2.musicSet || 0;
  var Levels = [Level1, Level2, Level3, Level4, Level5];
  var currentLevel = 1;
  // Stage 9: indeks mood BGM aktif (0 slime, 1 dungeon, 2 final).
  // Diganti saat load level; scheduler lanjut mulus tanpa restart.
  var musicSetIdx = 0;
  // Copy misi per level: jujur terhadap kondisi menang aktual (Option A).
  // L1/L3 menang via FINISH (combat opsional); L2/L4/L5 via boss.
  var MISSION_COPY = {
    1: 'L1: coin • checkpoint • capai <b>FINISH</b>',
    2: 'L2: lewati celah • coin • checkpoint • kalahkan <b>RAJA SLIME</b>',
    3: 'L3: coin • checkpoint • capai <b>FINISH</b>',
    4: 'L4: coin • checkpoint • kalahkan <b>RAJA LICH</b>',
    5: 'L5: coin • kalahkan <b>KEDUA RAJA</b>'
  };
  // Pointer level aktif — seluruh sistem (fisika, kamera, render) membaca
  // dari sini sehingga ganti level = tukar pointer + reset state.
  var Level = Levels[0];

  /* Stage 8: identitas visual per level (data saja, pixel-art compatible).
   * Level 1 = cerah (fantasy onboarding); Level 2 = gelap/mengancam
   * (foreshadowing boss). Tanpa texture system baru.
   * Stage 9: L3 fortress dingin, L4 crypt ungu, L5 konvergensi akhir. */
  var LEVEL_THEME = [
    { sky: ['#1b2350', '#2b3370', '#3a3f7d'],
      ground: '#4a3b6b', grass: '#5ec46f', grassD: '#3f9e52',
      plat: '#4d5aa8', platTop: '#7c8cf0', platD: '#5b6ac4',
      moon: '#f4f1d8', moonD: '#d9d4b5' },
    { sky: ['#100c28', '#221542', '#3d1f4d'],
      ground: '#33244d', grass: '#a04d5e', grassD: '#5c2f47',
      plat: '#3a2f5c', platTop: '#6b5a9e', platD: '#463a75',
      moon: '#e08a7a', moonD: '#a05a4a' },
    { sky: ['#0d1420', '#1a2636', '#2c3e52'],
      ground: '#2e3440', grass: '#7a8a99', grassD: '#4c5663',
      plat: '#3b4252', platTop: '#8a97a8', platD: '#5a6578',
      moon: '#c9d6e8', moonD: '#8a97a8' },
    { sky: ['#0c0718', '#1c1030', '#341a4d'],
      ground: '#241a38', grass: '#6b4a8a', grassD: '#3d2a52',
      plat: '#2e2145', platTop: '#7a5fc9', platD: '#4a3a75',
      moon: '#b46ae0', moonD: '#6b3a8a' },
    { sky: ['#140808', '#2a1420', '#4d2030'],
      ground: '#3a2030', grass: '#c46a5e', grassD: '#7a3a4a',
      plat: '#4a2a3a', platTop: '#c98a6b', platD: '#6b4a52',
      moon: '#ffd23f', moonD: '#a0682a' }
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
      state: 'idle',      // idle|run|jump|fall|attack|hurt|death|block|aim
      animTime: 0,
      coyote: 0, jumpBuf: 0,
      attackT: 0, attackCooldown: 0, didStrikeHit: {},
      hurtT: 0, iframes: 0,
      deathT: 0, attackBox: null,
      landT: 0,      // squash pendaratan (polish Tahap 3)
      queued: false, // buffer serangan beruntun (responsif, Tahap 3)
      combo: false,  // Stage 11: ayunan rantai memakai pose attack-2
      blockT: 0, aimT: 0, shotFired: false, // shop: block hold & bow aim
      blockStam: 2, blockCd: 0, bashSfx: false, blockBreak: false, // guardian: stamina + shield bash
      bastionHits: 0, bastionWin: 0, bastionOn: 0, bastionCd: 0, // bastion aura (bounded)
      sunfireCd: 0 // sunfire burn cooldown global (bounded)
    };
  }
  var player = createPlayer();
  // Kapasitas stamina block dari stats perisai (data-driven, tanpa ubah data):
  // 0.5 + defense*4 -> buckler 1.5s ... bastion 3.5s. Regen 0.8/s saat lepas.
  function blockMax() {
    var sh = null;
    try { sh = shieldStats(); } catch (e) { sh = null; }
    var d = (sh && sh.defense > 0) ? sh.defense : 0;
    return 0.5 + d * 4;
  }

  function playerStartAttack(combo) {
    // Shop Archer: serangan utama = ranged (aim), bukan melee.
    if (playerMode() === 'ARCHER') {
      player.state = 'aim';
      player.animTime = 0;
      player.aimT = 0;
      player.shotFired = false;
      player.attackBox = null;
      player.queued = false;
      player.combo = false;
      return;
    }
    player.state = 'attack';
    player.animTime = 0;
    player.attackT = 0;
    player.didStrikeHit = {};
    player.attackBox = null;
    player.bashSfx = false;
    // Ayunan baru selalu mulai tanpa buffer (B2): queued basi dari ayunan
    // yang di-interrupt hurt/death tidak boleh bocor ke kombo berikutnya.
    // Kombo/buffer normal aman: queued hanya di-set selama ayunan berjalan.
    player.queued = false;
    // Stage 11: pose kombo hanya untuk ayunan rantai (tanpa ubah timing).
    player.combo = !!combo;
    AudioManager.play('attack');
  }

  function playerTakeDamage(amount, fromX, dmgType) {
    // C2: setelah kemenangan boss (victoryArmed), player kebal —
    // sisa hazard tidak boleh membatalkan victory selama delay.
    if (typeof victoryArmed !== 'undefined' && victoryArmed) return;
    if (player.state === 'death' || player.iframes > 0) return;
    var dtype = dmgType || 'melee';
    // Guardian: block frontal = KEBAL damage selama stamina tersisa.
    // Syarat: mode GUARDIAN + sedang block + stamina > 0 + penyerang di depan.
    // Stamina habis -> block jebol otomatis (lihat updatePlayer) + cooldown,
    // sehingga tidak bisa turtle permanen. Dari belakang: full damage.
    if (playerMode() === 'GUARDIAN' && player.state === 'block' && player.blockStam > 0) {
      var pcx0 = player.x + player.w / 2;
      var front = (player.facing === 1 && fromX >= pcx0) || (player.facing === -1 && fromX < pcx0);
      if (front) {
        // Skeleton defender (heavy) menyerang -> perisai hancur lebih cepat.
        // Deteksi sederhana: jika serangan dari depan pada jarak dekat (< 80px)
        // dalam state block sementara stamina rendah, anggap serangan berat.
        var distToHit = Math.abs((player.x + player.w / 2) - fromX);
        var isDefenderHit = (distToHit < 80 && player.blockStam < 1.0);
        if (isDefenderHit) {
          player.blockStam = Math.max(0, player.blockStam - 0.7); // serangan berat
          player.blockBreak = true;
          player.blockBreakT = 1.2; // crack visual lebih lama
        } else {
          player.blockStam = Math.max(0, player.blockStam - 0.2); // serangan biasa
        }
        if (isDefenderHit) {
          player.blockStam = Math.max(0, player.blockStam - 0.7); // serangan berat
          player.blockBreak = true;
          player.blockBreakT = 1.0; // crack visual lebih lama
        } else {
          player.blockStam = Math.max(0, player.blockStam - 0.15); // serangan biasa
        }
        var sh = shieldStats();
        player.iframes = 0.1;
        AudioManager.play('block');
        var bcol = '#cfe3ff';
        if (sh && sh.special && sh.special.kind === 'magicGuard' &&
            (dtype === 'bolt' || dtype === 'shock' || dtype === 'magic')) bcol = '#7df9ff';
        else if (sh && sh.id === 'bastion') bcol = '#c07bff';
        burst(pcx0 + player.facing * 24, player.y + player.h / 2, 5, bcol, 120, 0.3, 3, 250);
        // Bastion: hit block terhitung untuk aura (visual + bertahan).
        if (sh && sh.id === 'bastion' && player.bastionCd <= 0) {
          if (player.bastionWin <= 0) { player.bastionHits = 0; player.bastionWin = 10; }
          player.bastionHits++;
          if (player.bastionHits >= 3) {
            player.bastionHits = 0; player.bastionWin = 0;
            player.bastionOn = 2; player.bastionCd = 12;
            burst(pcx0, player.y + 10, 8, '#c07bff', 130, 0.5, 3, 200);
          }
        }
        return; // kebal: tanpa damage, tanpa interrupt (tetap block)
      }
    }
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
      // C1: stale attackBox tidak boleh hidup setelah death.
      player.attackBox = null;
      player.queued = false;
      player.didStrikeHit = {};
      // Animasi mati: ledakan merah + arwah melayang (visual saja,
      // pool bounded; ambruk + fade menyusul di drawPlayer).
      burst(player.x + player.w / 2, player.y + player.h / 2, 10, '#e05252', 200, 0.6, 4, 350);
      var wi;
      for (wi = 0; wi < 5; wi++) {
        spawnParticle(player.x + player.w / 2 + (Math.random() * 20 - 10), player.y + 20,
          (Math.random() * 2 - 1) * 30, -80 - Math.random() * 40, 1.0, '#9fd8ff', 3, -60);
      }
      return;
    }
    player.state = 'hurt';
    player.animTime = 0;
    player.hurtT = 0;
    player.iframes = PLAYER_IFRAMES;
    // C1: stale attackBox tidak boleh hidup setelah hurt.
    player.attackBox = null;
    player.queued = false;
    player.didStrikeHit = {};
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
    // Shop timers (bounded, visual/gameplay aman).
    if (player.bastionWin > 0) player.bastionWin = Math.max(0, player.bastionWin - dt);
    if (player.bastionOn > 0) player.bastionOn = Math.max(0, player.bastionOn - dt);
    if (player.bastionCd > 0) player.bastionCd = Math.max(0, player.bastionCd - dt);
    if (player.sunfireCd > 0) player.sunfireCd = Math.max(0, player.sunfireCd - dt);
    if (player.blockCd > 0) player.blockCd = Math.max(0, player.blockCd - dt);
    // Stamina block regen saat tidak blocking (tak bisa turtle selamanya,
    // tapi pulih cepat setelah lepas).
    if (player.state !== 'block') {
      var _bm = blockMax();
      if (player.blockStam < _bm) player.blockStam = Math.min(_bm, player.blockStam + 0.8 * dt);
    }

    // Konsumsi buffer lompat
    if (Input.jumpPressed) { player.jumpBuf = JUMP_BUFFER; Input.jumpPressed = false; }
    else player.jumpBuf = Math.max(0, player.jumpBuf - dt);

    // M2: attackPressed tidak boleh bocor melalui hurt/death.
    // Serangan hanya valid dari state normal/attack; simpan intent lokal.
    var wantAttack = !!Input.attackPressed;
    Input.attackPressed = false;
    if (Input.skillPressed) {
      Input.skillPressed = false;
      if (gameState === 'playing' && !dead) activateActiveSkill();
    }

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
      // Shop: kecepatan serangan dari stats pedang (baseline 1.0 = timing utuh).
      var _sw = swordStats();
      var _spd = (_sw && _sw.attackSpeed > 0) ? _sw.attackSpeed : 1;
      var _wu = ATTACK_WINDUP / _spd, _st = ATTACK_STRIKE / _spd, _rc = ATTACK_RECOVERY / _spd;
      var total = _wu + _st + _rc;
      // Buffer: serangan ditekan saat recovery => rantai kombo responsif.
      if (wantAttack) { player.queued = true; wantAttack = false; }
      // Movement dikunci saat grounded; di udara boleh drift 40%.
      var lockFactor = player.onGround ? 0 : 0.4;
      player.vx = move * PLAYER_SPEED * lockFactor;

      // Hitbox serangan aktif hanya pada fase STRIKE, di depan player.
      // Shop: Silver reach (+range) memperpanjang hitbox.
      // Shop Archer: recovery tembakan tanpa melee hitbox.
      if (playerMode() !== 'ARCHER' && player.attackT >= _wu &&
          player.attackT < _wu + _st) {
        var _rw = ATTACK_W + ((_sw && _sw.range) || 0);
        var bx = player.facing === 1
          ? player.x + player.w
          : player.x - _rw;
        player.attackBox = {
          x: bx,
          y: player.y + player.h / 2 - ATTACK_H / 2,
          w: _rw, h: ATTACK_H
        };
      } else {
        player.attackBox = null;
      }

      applyGravity(player, dt);
      moveAndCollide(player, dt, Level.platforms);

      if (player.attackT >= total) {
        player.attackBox = null;
        if (player.queued) {
          // Kombo beruntun: langsung ayun lagi tanpa cooldown (pose attack-2).
          player.queued = false;
          player.attackCooldown = 0;
          playerStartAttack(true);
        } else {
          player.state = player.onGround ? (move !== 0 ? 'run' : 'idle') : 'fall';
          player.animTime = 0;
          player.attackCooldown = ATTACK_COOLDOWN / _spd;
        }
      } else {
        player.animTime += dt;
      }
      return;
    }

    // Shop Guardian: tahan block -> state block (defensif, gerak lambat).
    // Attack tidak aktif bersamaan secara tidak masuk akal: intent dibuang.
    // Stamina terkuras 1/dtk; habis -> jebol paksa + cooldown 1 dtk.
    if (player.state === 'block') {
      player.blockT += dt;
      player.attackBox = null;
      if (wantAttack) wantAttack = false;
      player.vx = move * PLAYER_SPEED * 0.4;
      player.blockStam -= dt;
        if (player.blockStam <= 0) {
        player.blockStam = 0;
        player.blockCd = 1.2;
        player.blockBreak = true;
        player.blockBreakT = 0.8;
        if (player.state === 'block') { // jebol: ledakan visual + suara
          burst(player.x + player.w / 2, player.y + player.h / 2, 8, '#e05252', 160, 0.5, 3, 300);
          AudioManager.play('hurt');
        }
        player.state = player.onGround ? (move !== 0 ? 'run' : 'idle') : 'fall';
        player.animTime = 0;
        player.blockT = 0;
        try { showToast('BLOCK JEBOL!'); } catch (e) { /* abaikan */ }
        AudioManager.play('buyFail');
      } else if (!Input.blockHeld || playerMode() !== 'GUARDIAN') {
        player.state = player.onGround ? (move !== 0 ? 'run' : 'idle') : 'fall';
        player.animTime = 0;
        player.blockT = 0;
      } else {
        player.animTime += dt;
      }
      applyGravity(player, dt);
      moveAndCollide(player, dt, Level.platforms);
      return;
    }

    // Shop Archer: aim (0.25s) -> tembak -> recovery. Tanpa melee hitbox.
    if (player.state === 'aim') {
      player.aimT += dt;
      player.attackBox = null;
      player.vx = move * PLAYER_SPEED * 0.5;
      var _bw0 = bowStats();
      var _aimDur = 0.25 / ((_bw0 && _bw0.attackSpeed > 0) ? _bw0.attackSpeed : 1);
      if (!player.shotFired && player.aimT >= _aimDur) {
        player.shotFired = true;
        firePlayerArrow();
        AudioManager.play('bowShot');
        player.state = 'attack';
        player.animTime = 0;
        player.attackT = 0;
        player.didStrikeHit = {};
        player.queued = false;
        player.combo = false;
        return;
      }
      applyGravity(player, dt);
      moveAndCollide(player, dt, Level.platforms);
      player.animTime += dt;
      return;
    }

    // Serangan baru? (tidak bisa saat death/hurt — sudah di-return di atas,
    // dan wantAttack sudah dikonsumsi di awal sehingga tidak bocor.)
    // Shop: Guardian + tahan block -> block (attack dibuang); Archer -> aim.
    // Block butuh stamina + tanpa cooldown jebol.
    if (playerMode() === 'GUARDIAN' && Input.blockHeld && player.attackCooldown <= 0 &&
        player.blockCd <= 0 && player.blockStam > 0) {
      wantAttack = false;
      player.state = 'block';
      player.animTime = 0;
      player.blockT = 0;
      player.attackBox = null;
      AudioManager.play('block');
      return;
    }
    if (wantAttack && player.attackCooldown <= 0) {
      wantAttack = false;
      if (playerMode() === 'ARCHER') {
        player.state = 'aim';
        player.animTime = 0;
        player.aimT = 0;
        player.shotFired = false;
        player.attackBox = null;
        return;
      }
      playerStartAttack();
      return;
    }
    wantAttack = false; // abaikan spam saat cooldown

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

  // Stage 11: set knight heroik diutamakan; fallback ke set lama bila
  // sprite belum siap/gagal (tanpa crash, tanpa ubah timing/hitbox).
  function knightImg(list, i, fallback) {
    try {
      if (list && list[i]) return list[i];
    } catch (e) { /* abaikan, pakai fallback */ }
    return fallback;
  }

  function playerAttackFrame() {
    // Petakan fase attack -> pose (kombo memakai silhouette attack-2).
    var windup = player.attackT < ATTACK_WINDUP;
    var strike = !windup && player.attackT < ATTACK_WINDUP + ATTACK_STRIKE;
    if (player.combo) {
      if (windup) return knightImg(sprites.knightAttack2, 0, sprites.attack[0]);
      if (strike) return knightImg(sprites.knightAttack, 0, sprites.attack[1]);
      return knightImg(sprites.knightAttack2, 0, sprites.attack[2]);
    }
    if (windup) return knightImg(sprites.knightAttack, 0, sprites.attack[0]);
    if (strike) return knightImg(sprites.knightAttack2, 0, sprites.attack[1]);
    return knightImg(sprites.knightAttack, 0, sprites.attack[2]);
  }

  function playerCurrentSprite() {
    var mode = 'SWORD';
    try { mode = playerMode(); } catch (e) { mode = 'SWORD'; }
    var P = '';
    if (mode === 'GUARDIAN') P = 'guardian';
    else if (mode === 'ARCHER') P = 'archer';
    else P = 'knight';
    function cls(key, fb) {
      var list = sprites[P + key];
      if (list && list[0]) return list[0];
      return fb;
    }
    switch (player.state) {
      case 'run':
        if (P === 'knight' && sprites.knightWalk && sprites.knightWalk.length >= 2) {
          return sprites.knightWalk[Math.floor(player.animTime * 10) % 2];
        }
        if ((P === 'guardian' || P === 'archer') && sprites[P + 'Walk'] && sprites[P + 'Walk'].length >= 2) {
          return sprites[P + 'Walk'][Math.floor(player.animTime * 10) % 2];
        }
        if ((P === 'guardian' || P === 'archer') && sprites[P + 'Walk'] && sprites[P + 'Walk'][0]) {
          return sprites[P + 'Walk'][0];
        }
        return sprites.run[Math.floor(player.animTime * 10) % sprites.run.length];
      case 'jump': return knightImg(sprites[P + 'Jump'], 0, sprites.jump[0]);
      case 'fall': return knightImg(sprites[P + 'Fall'], 0, sprites.fall[0]);
      case 'attack':
        if (P === 'guardian') return knightImg(sprites.guardianAttack, 0, playerAttackFrame() || sprites.attack[0]);
        if (P === 'archer') return knightImg(sprites.archerShoot, 0, sprites.attack[0]);
        return playerAttackFrame() || sprites.attack[0];
      case 'block': return knightImg(sprites.guardianBlock, 0, sprites.knightHurt ? sprites.knightHurt[0] : sprites.hurt[0]);
      case 'aim': return knightImg(sprites.archerAim, 0, sprites.knightAttack ? sprites.knightAttack[0] : sprites.attack[0]);
      case 'hurt': return knightImg(sprites[P + 'Hurt'], 0, sprites.hurt[0]);
      case 'death':
        if (sprites[P + 'Death'] && sprites[P + 'Death'][0]) return sprites[P + 'Death'][0];
        if (P === 'knight' && sprites.knightDeath && sprites.knightDeath[0]) return sprites.knightDeath[0];
        // death_0 lalu death_1 (tahan).
        return (player.deathT < 0.3 ? sprites.death[0] : sprites.death[1]) || sprites.death[0];
      default:
        if (sprites[P + 'Idle'] && sprites[P + 'Idle'][0]) return sprites[P + 'Idle'][0];
        if (P === 'knight' && sprites.knightIdle && sprites.knightIdle[0]) return sprites.knightIdle[0];
        return sprites.idle[Math.floor(player.animTime * 6) % sprites.idle.length];
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
      body: '#9a5fc9', dark: '#5a2a8a', light: '#d0a5f0', label: 'HEAVY' },
    // Stage 9: SKELETON SWORDSMAN — melee seimbang, jangkauan < player.
    skeletonSword: { hp: 40, w: 40, h: 56,
      patrol: 55, chase: 110, detectX: 260, detectY: 140,
      range: 46, dmg: 12, windup: 0.40, strike: 0.14,
      recovery: 0.50, cooldown: 1.00,
      knockResist: 0.8, hitSound: 'skelHit',
      body: '#c9cfdd', dark: '#7a8296', light: '#ffffff', label: 'SWORD' },
    // Stage 9: SKELETON DEFENDER — tank perisai, guard frontal.
    skeletonDefender: { hp: 70, w: 44, h: 58,
      patrol: 35, chase: 65, detectX: 220, detectY: 120,
      range: 44, dmg: 9, windup: 0.45, strike: 0.16,
      recovery: 0.55, cooldown: 1.20,
      knockResist: 0.5, hitSound: 'skelHit', guard: { block: 0.8 },
      body: '#8f9bb0', dark: '#565f73', light: '#d6deea', label: 'DEFENDER' },
    // Stage 9: SKELETON ARCHER — ranged, jaga jarak, AI khusus (updateArcher).
    skeletonArcher: { hp: 25, w: 38, h: 54,
      patrol: 40, chase: 80, detectX: 420, detectY: 150,
      range: 0, dmg: 8, windup: 0.50, strike: 0.10,
      recovery: 0.40, cooldown: 2.20,
      knockResist: 1, hitSound: 'skelHit',
      body: '#b0a58f', dark: '#6b6350', light: '#e8dfc9', label: 'ARCHER' }
  };

  // R1: lookup own-property yang aman — kunci prototype-chain seperti
  // 'constructor'/'toString' tak boleh menghasilkan stat invalid/NaN.
  function enemyKindOf(type) {
    return Object.prototype.hasOwnProperty.call(ENEMY_STATS, type) ? type : 'slime';
  }

  function createSlime(spawn) {
    var kind = enemyKindOf(spawn.type);
    var baseSt = ENEMY_STATS[kind];
    var mult = getDifficultyMult();
    // Copy stats to avoid mutating global ENEMY_STATS
    var st = {};
    for (var _k in baseSt) st[_k] = baseSt[_k];
    st.hp = Math.round(baseSt.hp * mult.enemyHp);
    if (st.dmg != null) st.dmg = Math.round(baseSt.dmg * mult.enemyDmg);
    if (st.cooldown != null) st.cooldown = baseSt.cooldown / mult.enemyCooldown;
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
      iframes: 0, struckPlayer: false, guardFlash: 0, relT: 0, // relT: follow-through lepas panah
      stepPhase: 0, // fase langkah kaki (debu stride, visual saja)
      poisonT: 0, poisonDps: 0, burnT: 0, burnDps: 0, dotFxT: 0, // shop DoT (terkontrol, refresh tanpa stack)
      dead: false
    };
  }
  var enemies = [];

  /* Shop: efek khusus pedang (data-driven dari SHOP_ITEMS.special).
   * - poison (Shadowfang): refresh duration, tidak stack tanpa batas.
   * - burn (Sunfire): durasi singkat + cooldown global aman.
   * Berlaku untuk musuh biasa + miniboss. Boss utama (slime king/lich)
   * kebal DoT agar FSM/victory tidak rusak (direct hit tetap masuk). */
  function applySwordEffect(s, b, m) {
    var sw = null;
    try { sw = swordStats(); } catch (e) { return; }
    if (!sw || !sw.special) return;
    var sp = sw.special;
    if (sp.kind === 'poison') {
      var t = s || m || null;
      if (!t || t.dead || t.state === 'death') return;
      t.poisonT = sp.duration; // refresh, bukan tambah (anti stack)
      t.poisonDps = sp.dps;
      t.dotFxT = 0;
      burst(t.x + t.w / 2, t.y + t.h / 2, 4, '#7a3fc9', 90, 0.4, 3, 200);
      AudioManager.play('poison');
    } else if (sp.kind === 'burn') {
      if (player.sunfireCd > 0) return;
      player.sunfireCd = sp.cooldown;
      var t2 = s || m || null;
      if (!t2 || t2.dead || t2.state === 'death') return;
      t2.burnT = sp.duration;
      t2.burnDps = sp.dps;
      t2.dotFxT = 0;
      burst(t2.x + t2.w / 2, t2.y + t2.h / 2, 6, '#ff9a3c', 130, 0.4, 3, 200);
      AudioManager.play('shock');
    }
  }
  // Tick DoT musuh + miniboss (dipanggil tiap frame playing; tanpa alokasi).
  function tickDots(dt) {
    var i, e;
    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      if (e.dead || e.state === 'death') continue;
      var dps = 0;
      if (e.poisonT > 0) { e.poisonT -= dt; dps += e.poisonDps || 0; }
      if (e.burnT > 0) { e.burnT -= dt; dps += e.burnDps || 0; }
      if (dps > 0) {
        e.hp -= dps * dt;
        e.dotFxT -= dt;
        if (e.dotFxT <= 0) {
          e.dotFxT = 0.25;
          burst(e.x + e.w / 2, e.y + e.h / 2, 2, e.burnT > 0 ? '#ff9a3c' : '#7a3fc9', 70, 0.3, 2, 150);
        }
        if (e.hp <= 0) {
          e.hp = 0;
          e.iframes = 0;
          // Kematian via jalur normal (sekali, tanpa iframe block).
          var keepIf = e.iframes;
          e.iframes = 0;
          slimeTakeDamage(e, 0.5, e.x + e.w / 2 + 100);
          if (e.state !== 'death' && e.hp <= 0) {
            e.state = 'death'; e.deathT = 0; e.vx = 0;
          }
          e.iframes = keepIf;
        }
      } else { e.poisonDps = 0; e.burnDps = 0; }
    }
    var mb = null;
    try { mb = miniboss; } catch (e2) { mb = null; }
    if (mb && !mb.dead && mb.state !== 'death') {
      var mdps = 0;
      if (mb.poisonT > 0) { mb.poisonT -= dt; mdps += mb.poisonDps || 0; }
      if (mb.burnT > 0) { mb.burnT -= dt; mdps += mb.burnDps || 0; }
      if (mdps > 0) {
        mb.hp -= mdps * dt;
        if (mb.hp <= 0) {
          mb.hp = 0;
          mb.iframes = 0;
          hurtMiniboss(0.5, mb.x + mb.w / 2 + 100);
          if (mb.state !== 'death') { mb.state = 'death'; mb.deathT = 0; mb.vx = 0; }
        }
      } else { mb.poisonDps = 0; mb.burnDps = 0; }
    }
  }

  function slimeTakeDamage(s, amount, fromX, knock) {
    if (s.dead || s.state === 'death' || s.iframes > 0) return false;
    // Skill passive modifier (light, data-driven, safe)
    var dmgMult = 1;
    try {
      if (save && save.skills && save.skills.unlocked) {
        if (save.mode === 'SWORD' && save.skills.unlocked.sharpEdge) dmgMult = 1.10;
      }
    } catch (e) {}
    amount = amount * dmgMult;
    // Stage 9: Defender guard frontal (hanya saat siaga, bukan mid-attack).
    // Tanpa guard stats -> jalur klasik persis (nol perubahan perilaku lama).
    // M6: blocked hit = no damage + no iframes (feedback saja); hit valid
    // berikutnya tidak boleh termakan iframe dari block sebelumnya.
    var effKnock = knock || ATTACK_KNOCKBACK;
    if (s.st.guard && (s.state === 'patrol' || s.state === 'chase')) {
      var front = (s.dir === 1 && fromX >= s.x + s.w / 2) ||
                  (s.dir === -1 && fromX < s.x + s.w / 2);
      if (front) {
        // Menahan jalur: tetap siaga, hanya terdorong sedikit.
        // Tanpa damage, tanpa hurt, tanpa iframe burn.
        s.guardFlash = 0.3; // cue visual jelas: serangan TAK hilang sia-sia
        burst(s.x + (s.dir === 1 ? s.w : 0), s.y + s.h / 2, 5, '#cfe3ff', 120, 0.3, 3, 250);
        burst(s.x + s.w / 2, s.y + s.h / 2, 3, '#ffffff', 120, 0.25, 3, 250);
        AudioManager.play('shieldBlock');
        var bdir = (s.x + s.w / 2) < fromX ? -1 : 1;
        s.vx = bdir * effKnock * 0.2 * 0.3;
        return true;
      }
    }
    var effSound = s.st.hitSound || 'hit';
    s.hp -= amount;
    s.iframes = 0.25;
    // Damage feedback: flash (via iframes blink) + cipratan partikel.
    burst(s.x + s.w / 2, s.y + s.h / 2, 6, '#ffffff', 160, 0.3, 3, 250);
    burst(s.x + s.w / 2, s.y + s.h / 2, 4, '#ffd23f', 120, 0.35, 3, 250);
    AudioManager.play(effSound);
    if (s.hp <= 0) {
      s.hp = 0;
      s.state = 'death';
      s.deathT = 0;
      s.vx = 0;
      // Poof kematian + shake kecil (warna mengikuti varian).
      burst(s.x + s.w / 2, s.y + s.h / 2, 10, s.st.body, 170, 0.6, 4, 350);
      burst(s.x + s.w / 2, s.y + s.h / 2, 5, s.st.light, 120, 0.5, 3, 300);
      // Skeleton runtuh realistis: tulang bertebaran + badan terpental
      // sedikit (hop), lalu ambruk di update/draw. Slime tak berubah.
      var skel = (s.kind === 'skeletonSword' || s.kind === 'skeletonDefender' ||
                  s.kind === 'skeletonArcher');
      if (skel) {
        burst(s.x + s.w / 2, s.y + 10, 7, '#e8e4d8', 150, 0.6, 3, 400);
        burst(s.x + s.w / 2, s.y + s.h / 2, 4, '#8f9bb0', 110, 0.5, 3, 300);
        s.vx = s.dir * 50; // terhuyung ke arah hadap
        s.vy = -160;       // hop kecil sebelum ambruk
        s.onGround = false;
        dropBonePile(s); // badan berubah jadi tumpukan tulang di tanah
      } else {
        dropGooPile(s); // sisa lendir menetap seperti tumpukan tulang
      }
      triggerScreenShake(SHAKE_DIE, 0.2);
      AudioManager.play('slimeDie');
      return true;
    }
    s.state = 'hurt';
    s.hurtT = 0;
    var dir = (s.x + s.w / 2) < fromX ? -1 : 1;
    // Heavy: knockback resistance (fraksi dari knock normal).
    s.vx = dir * effKnock * (s.st.knockResist || 1);
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

  // Debu langkah skeleton saat mengejar (sinkron stride draw, pool guarded).
  // Patrol tidak berdebu (hemat pool); hanya chase + napak tanah + bergerak.
  function skeletonFootstep(s) {
    if (s.state !== 'chase' || !s.onGround || s.vx === 0) return;
    if (particleCount >= 40) return;
    var ph = Math.floor(s.animTime * 9) % 2;
    if (ph !== s.stepPhase) {
      s.stepPhase = ph;
      if (ph === 0) {
        spawnParticle(s.x + (s.dir === 1 ? s.w - 2 : 2), s.y + s.h - 2,
          -s.dir * 20, -30, 0.3, '#8a8fa8', 2, 150);
      }
    }
  }

  /* Tumpukan tulang persisten: skeleton yang ambruk berubah jadi pile
   * di tanah (tetap sampai ganti level/respawn). Maks 20 (ring, tanpa
   * alokasi berlebih). Slime/miniboss/boss tidak berpile. */
  var bonePiles = [];
  var bonePileIdx = 0;
  var BONE_PILE_MAX = 20;

  /* Korban jurang permanen: spawn musuh yang jatuh ke jurang dicatat
   * agar TIDAK dibangun ulang saat player respawn (retry). Sword-kill
   * biasa tetap kembali (desain retry); jurang = hilang selamanya dalam
   * level run ini. Dibersihkan saat ganti level/restart. */
  var pitDead = [];

  function pitKey(s) { return s.spawnX + ':' + s.spawnY; }

  function dropBonePile(s) {
    if (s.y > WORLD_H) return; // mati di jurang: tak ada pile
    // Snap ke tanah: kill mid-air (mis. tebasan lompat) tetap berpile
    // di pijakan terdekat di bawah, bukan melayang. Event-only (murah).
    var gx = s.x + s.w / 2, gy = s.y + s.h, groundY = 0;
    for (var i = 0; i < Level.platforms.length; i++) {
      var p = Level.platforms[i];
      if (gx >= p.x && gx <= p.x + p.w && p.y >= gy - 8 && (groundY === 0 || p.y < groundY)) {
        groundY = p.y;
      }
    }
    var pile = { x: Math.round(gx), y: Math.round(groundY || gy),
      dir: s.dir, a: Math.random(), b: Math.random() };
    if (bonePiles.length < BONE_PILE_MAX) bonePiles.push(pile);
    else { bonePiles[bonePileIdx] = pile; bonePileIdx = (bonePileIdx + 1) % BONE_PILE_MAX; }
  }

  function clearBonePiles() { bonePiles.length = 0; bonePileIdx = 0; }

  /* Sisa lendir slime: paralel dengan bone pile — slime (biasa/fast/
   * heavy) yang tewas meninggalkan genangan warna variannya, menetap
   * sampai ganti level/respawn. Maks 20 (ring). Mati di jurang: tak ada. */
  var gooPiles = [];
  var gooPileIdx = 0;
  var GOO_PILE_MAX = 20;

  function dropGooPile(s) {
    if (s.y > WORLD_H) return; // mati di jurang: tak ada sisa
    var gx = s.x + s.w / 2, gy = s.y + s.h, groundY = 0;
    for (var i = 0; i < Level.platforms.length; i++) {
      var p = Level.platforms[i];
      if (gx >= p.x && gx <= p.x + p.w && p.y >= gy - 8 && (groundY === 0 || p.y < groundY)) {
        groundY = p.y;
      }
    }
    var pile = { x: Math.round(gx), y: Math.round(groundY || gy),
      body: s.st.body, dark: s.st.dark, light: s.st.light,
      a: Math.random(), b: Math.random() };
    if (gooPiles.length < GOO_PILE_MAX) gooPiles.push(pile);
    else { gooPiles[gooPileIdx] = pile; gooPileIdx = (gooPileIdx + 1) % GOO_PILE_MAX; }
  }

  function clearGooPiles() { gooPiles.length = 0; gooPileIdx = 0; }

  function drawGooPiles() {
    for (var i = 0; i < gooPiles.length; i++) {
      var p = gooPiles[i];
      if (p.x < camera.x - 60 || p.x > camera.x + VIEW_W + 60) continue;
      var o1 = Math.round(p.a * 8), o2 = Math.round(p.b * 6);
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(p.x - 16, p.y - 3, 32, 4); // bayangan
      ctx.fillStyle = p.dark;
      ctx.fillRect(p.x - 14 + o1, p.y - 5, 28, 5); // genangan dasar
      ctx.fillRect(p.x - 20 + o2, p.y - 3, 10, 3); // ceceran kiri
      ctx.fillRect(p.x + 12 - o1, p.y - 3, 9, 3);  // ceceran kanan
      ctx.fillStyle = p.body;
      ctx.fillRect(p.x - 10 + o2, p.y - 8, 20, 5); // gumpalan
      ctx.fillStyle = p.light;
      ctx.fillRect(p.x - 6 + o1, p.y - 7, 6, 2);   // kilau gelembung
      ctx.fillRect(p.x + 4 - o2, p.y - 6, 4, 2);
    }
  }

  function drawBonePiles() {
    for (var i = 0; i < bonePiles.length; i++) {
      var p = bonePiles[i];
      if (p.x < camera.x - 60 || p.x > camera.x + VIEW_W + 60) continue;
      var o1 = Math.round(p.a * 6), o2 = Math.round(p.b * 6);
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(p.x - 14, p.y - 3, 28, 4); // bayangan
      ctx.fillStyle = '#a8a49a';
      ctx.fillRect(p.x - 12 + o1, p.y - 6, 20, 4); // alas gelap
      ctx.fillRect(p.x - 8, p.y - 10 + o2, 12, 3);
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(p.x - 10 + o2, p.y - 9, 16, 4); // rusuk
      ctx.fillRect(p.x - 4, p.y - 14, 8, 6);       // tengkorak
      ctx.fillRect(p.x + (p.dir === 1 ? 6 : -13) + o1 - 2, p.y - 7, 7, 3); // anggota
      ctx.fillStyle = '#14142b';
      ctx.fillRect(p.x - 2, p.y - 13, 3, 3); // rongga mata
      ctx.fillRect(p.x + 3, p.y - 13, 2, 2);
    }
  }

  function slimeHasGroundAhead(s, moveDir) {
    // Cek ada pijakan di depan kaki — agar slime tidak jalan off-platform.
    // M7: arah cek mengikuti arah GERAK aktual (bukan facing visual),
    // karena archer retreat bergerak mundur (-dir).
    if (!s.onGround) return true;
    var d = (moveDir === 1 || moveDir === -1) ? moveDir : s.dir;
    var footX = d === 1 ? s.x + s.w + 4 : s.x - 4;
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
    if (s.guardFlash > 0) s.guardFlash -= dt;
    if (s.cooldown > 0) s.cooldown -= dt;

    // Jatuh ke jurang = mati permanen (tidak respawn ke spawn, bahkan
    // saat player respawn — spawn dicatat di pitDead). Kill dihitung
    // sekali oleh loop hapus di updatePlaying.
    if (s.y > WORLD_H + 100 && !s.dead) {
      pitDead.push(pitKey(s));
      s.dead = true;
      return;
    }

    if (s.state === 'death') {
      s.deathT += dt;
      applyGravity(s, dt);
      // Skeleton terhuyung runtuh (redam cepat); slime diam seperti semula.
      var isSkel = (s.kind === 'skeletonSword' || s.kind === 'skeletonDefender' ||
                    s.kind === 'skeletonArcher');
      if (isSkel) s.vx -= s.vx * Math.min(1, 8 * dt);
      else s.vx = 0;
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
        // Identitas audio skeleton (slime klasik tetap 'attack').
        AudioManager.play((s.kind === 'skeletonSword' || s.kind === 'skeletonDefender') ? 'swordSwing' : 'attack');
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
      // M8: nol-kan vx saat clamp agar tidak jitter mendorong boundary.
      var lo = s.spawnX - SLIME_LEASH, hi = s.spawnX + SLIME_LEASH;
      if (s.x < lo) { s.x = lo; if (s.vx < 0) s.vx = 0; }
      if (s.x > hi) { s.x = hi; if (s.vx > 0) s.vx = 0; }
    }
    skeletonFootstep(s);
    // NOTE: tidak ada teleport kembali — jatuh jurang = mati (cek di atas).
  }

  /* Stage 9: SKELETON ARCHER — AI ranged khusus (ringkas, reuse primitif).
   * patrol saat target invalid; jaga jarak 170-320px; telegraph 0.5 dtk
   * lalu tembak panah (pool `shots`). Tak pernah state 'attack' slime. */
  function archerTargetValid(s) {
    if (player.state === 'death' || gameState !== 'playing') return false;
    var px = player.x + player.w / 2, sx = s.x + s.w / 2;
    var py = player.y + player.h, sy = s.y + s.h;
    return Math.abs(px - sx) < 460 && Math.abs(py - sy) < 150;
  }

  function updateArcher(s, dt) {
    s.animTime += dt;
    if (s.iframes > 0) s.iframes -= dt;
    if (s.guardFlash > 0) s.guardFlash -= dt;
    if (s.relT > 0) s.relT -= dt;
    if (s.cooldown > 0) s.cooldown -= dt;
    var px = player.x + player.w / 2, sx = s.x + s.w / 2;

    // Jatuh ke jurang = mati permanen (tidak respawn ke spawn, bahkan
    // saat player respawn — spawn dicatat di pitDead).
    if (s.y > WORLD_H + 100 && !s.dead) {
      pitDead.push(pitKey(s));
      s.dead = true;
      return;
    }

    if (s.state === 'death') {
      s.deathT += dt;
      applyGravity(s, dt);
      // Archer ikut runtuh skeleton (redam cepat, bukan diam kaku).
      s.vx -= s.vx * Math.min(1, 8 * dt);
      moveAndCollide(s, dt, Level.platforms);
      if (s.deathT >= SLIME_DEATH_DURATION) s.dead = true;
      return;
    }

    if (s.state === 'hurt') {
      s.hurtT += dt;
      applyGravity(s, dt);
      moveAndCollide(s, dt, Level.platforms);
      if (s.hurtT >= SLIME_HURT_DURATION) s.state = 'patrol';
      return;
    }

    s.dir = px >= sx ? 1 : -1;

    if (s.state === 'shoot') {
      // Telegraph: diam + tandai, lalu lepas panah tepat waktu.
      s.vx = 0;
      s.atkT += dt;
      if (s.atkT >= s.st.windup) {
        fireArrow(s);
        AudioManager.play('arrowShot');
        s.state = 'chase';
        s.cooldown = s.st.cooldown;
      }
    } else if (!archerTargetValid(s)) {
      if (s.x < s.minX) s.dir = 1;
      else if (s.x > s.maxX) s.dir = -1;
      s.vx = s.dir * s.st.patrol;
      s.state = 'patrol';
    } else {
      var distX = Math.abs(px - sx);
      if (s.cooldown <= 0 && distX < 420) {
        s.state = 'shoot';
        s.atkT = 0;
        s.vx = 0;
      } else if (distX > 320) {
        s.vx = s.dir * s.st.chase;
        if (!slimeHasGroundAhead(s)) s.vx = 0;
        s.state = 'chase';
      } else if (distX < 170) {
        // Mundur jaga jarak; cek tanah ke arah RETREAT (bukan facing).
        // M7: tanpa ini archer dapat berjalan mundur keluar platform.
        s.vx = -s.dir * s.st.chase * 0.8;
        if (!slimeHasGroundAhead(s, -s.dir)) s.vx = 0;
        s.state = 'chase';
      } else {
        s.vx = 0;
        s.state = 'chase';
      }
    }

    applyGravity(s, dt);
    moveAndCollide(s, dt, Level.platforms);
    // Archer memegang zona patrol (tak pernah keluar level).
    if (s.x < s.minX) { s.x = s.minX; s.dir = 1; }
    if (s.x > s.maxX) { s.x = s.maxX; s.dir = -1; }
    skeletonFootstep(s);
    // NOTE: tidak ada teleport kembali — jatuh jurang = mati (cek di atas).
  }

  /* Stage 9: pool projectile terpadu (panah archer + bolt lich).
   * Bounded (maks 10), swap-pop in-place, cleanup lifetime/batas/hit. */
  var shots = [];

  function spawnShot(x, y, dir, kind) {
    // C2: tidak ada projectile baru setelah victory armed.
    if (typeof victoryArmed !== 'undefined' && victoryArmed) return;
    if (shots.length >= 10) return;
    if (kind === 'bolt') {
      shots.push({ x: x, y: y, w: 16, h: 10, vx: dir * 260, vy: 0,
        life: 2.2, dmg: BOSS_SHOCK_DMG, kind: 'bolt', hitDone: false });
    } else {
      shots.push({ x: x, y: y, w: 14, h: 6, vx: dir * 320, vy: 0,
        life: 2.0, dmg: 8, kind: 'arrow', hitDone: false });
    }
  }

  function fireArrow(s) {
    spawnShot(s.x + s.w / 2 - 7, s.y + 14, s.dir, 'arrow');
    // Stage 11: semburan lepas panah di ujung busur (pool bounded, visual saja).
    burst(s.x + s.w / 2 + s.dir * 20, s.y + 17, 3, '#e8dfc9', 90, 0.2, 2, 150);
    s.relT = 0.18; // follow-through release realistis
  }

  function updateShots(dt) {
    for (var i = shots.length - 1; i >= 0; i--) {
      var sh = shots[i];
      var prevX = sh.x;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.life -= dt;
      // Mati saat expired / keluar arena — tak pernah menembus batas.
      var out = sh.life <= 0 || sh.x < -40 || sh.x > WORLD_W + 40 ||
                sh.y < -60 || sh.y > WORLD_H + 60;
      // M9: arrow/bolt solid-blocked oleh platform (swept AABB prev->new
      // agar tidak tunneling). Shockwave bangga: ground-hugging wave yang
      // by-design melewati platform rendah (diurus updateShocks).
      if (!out) {
        var swX0 = prevX < sh.x ? prevX : sh.x;
        var swX1 = (prevX < sh.x ? sh.x : prevX) + sh.w;
        for (var pi = 0; pi < Level.platforms.length; pi++) {
          var pp = Level.platforms[pi];
          if (swX1 > pp.x && swX0 < pp.x + pp.w &&
              sh.y + sh.h > pp.y && sh.y < pp.y + pp.h) {
            out = true;
            burst(sh.x + sh.w / 2, sh.y + sh.h / 2, 3, '#9aa3c7', 80, 0.25, 2, 200);
            break;
          }
        }
      }
      if (!out && !sh.hitDone && player.state !== 'death') {
        setR(_r1, sh.x, sh.y, sh.w, sh.h);
        setR(_r2, player.x, player.y, player.w, player.h);
        if (rectsOverlap(_r1, _r2)) {
          sh.hitDone = true;
          playerTakeDamage(sh.dmg, sh.x + sh.w / 2, sh.kind === 'bolt' ? 'bolt' : 'arrow');
          burst(sh.x + sh.w / 2, sh.y + sh.h / 2, 4, '#c9a227', 100, 0.3, 3, 200);
          AudioManager.play('arrowImpact');
        }
      }
      if (out || sh.hitDone) {
        shots[i] = shots[shots.length - 1];
        shots.pop();
      }
    }
  }

  function drawShots() {
    for (var i = 0; i < shots.length; i++) {
      var sh = shots[i];
      var x0 = Math.round(sh.x), y0 = Math.round(sh.y);
      if (sh.kind === 'bolt') {
        // Bola sihir ungu + ekor.
        ctx.fillStyle = '#b46ae0';
        ctx.fillRect(x0, y0, sh.w, sh.h);
        ctx.fillStyle = '#e8c9ff';
        ctx.fillRect(x0 + 3, y0 + 2, sh.w - 6, sh.h - 4);
        ctx.fillStyle = 'rgba(180,106,224,0.5)';
        ctx.fillRect(x0 - (sh.vx > 0 ? 8 : -2), y0 + 2, 8, sh.h - 4);
      } else {
        // Panah kayu + mata terang, ikut arah.
        ctx.fillStyle = '#7a5c3a';
        ctx.fillRect(x0, y0 + 2, sh.w, 2);
        ctx.fillStyle = '#e8e8e8';
        if (sh.vx > 0) ctx.fillRect(x0 + sh.w - 4, y0, 4, sh.h);
        else ctx.fillRect(x0, y0, 4, sh.h);
      }
    }
  }

  /* Shop Archer: panah player (pool bounded 8, tanpa alokasi per-frame —
   * spawn hanya saat menembak). Tabrakan swept-AABB vs platform, lalu
   * musuh/boss/miniboss/chest (panah bisa membuka chest tertutup).
   * Boss utama kompatibel: direct hit via hurtBoss/hurtMiniboss. */
  var playerShots = [];
  var PLAYER_SHOTS_MAX = 8;

  function firePlayerArrow() {
    if (typeof victoryArmed !== 'undefined' && victoryArmed) return;
    if (playerShots.length >= PLAYER_SHOTS_MAX) return;
    var bw = bowStats();
    var dir = player.facing;
    var big = !!(bw && bw.special && bw.special.kind === 'pierce');
    playerShots.push({
      x: dir === 1 ? player.x + player.w : player.x - (big ? 20 : 14),
      y: player.y + player.h - 32, // setinggi badan musuh darat (slime/skeleton/boss)
      w: big ? 20 : 14, h: big ? 8 : 6,
      vx: dir * ((bw && bw.projectileSpeed) || 380), vy: 0,
      life: ((bw && bw.range) || 420) / ((bw && bw.projectileSpeed) || 380),
      dmg: (bw && bw.damage) || 10,
      pierce: (bw && bw.special && bw.special.kind === 'pierce') ? bw.special.pierce : 0,
      electric: !!(bw && bw.special && bw.special.kind === 'lightning'),
      windy: !!(bw && bw.special && bw.special.kind === 'windTrail'),
      hitIds: {},
      bowId: bw ? bw.id : 'makeshift'
    });
    burst(player.x + player.w / 2 + dir * 24, player.y + player.h / 2, 3, '#e8dfc9', 90, 0.2, 2, 150);
  }

  function damageFromArrow(e, dmg, px) {
    if (e.dead || e.state === 'death') return false;
    if (player.didStrikeHit['a' + e.id]) return false;
    return slimeTakeDamage(e, dmg, px, ATTACK_KNOCKBACK);
  }

  function updatePlayerShots(dt) {
    for (var i = playerShots.length - 1; i >= 0; i--) {
      var sh = playerShots[i];
      var prevX = sh.x;
      sh.x += sh.vx * dt;
      sh.life -= dt;
      var out = sh.life <= 0 || sh.x < -40 || sh.x > WORLD_W + 40;
      if (!out) {
        var swX0 = prevX < sh.x ? prevX : sh.x;
        var swX1 = (prevX < sh.x ? sh.x : prevX) + sh.w;
        for (var pi = 0; pi < Level.platforms.length; pi++) {
          var pp = Level.platforms[pi];
          if (swX1 > pp.x && swX0 < pp.x + pp.w &&
              sh.y + sh.h > pp.y && sh.y < pp.y + pp.h) {
            out = true;
            burst(sh.x + sh.w / 2, sh.y + sh.h / 2, 3, '#9aa3c7', 80, 0.25, 2, 200);
            break;
          }
        }
      }
      if (!out) {
        var px = sh.vx > 0 ? sh.x - 10 : sh.x + sh.w + 10;
        var k;
        for (k = 0; k < enemies.length; k++) {
          var e = enemies[k];
          if (e.dead || e.state === 'death' || sh.hitIds['e' + e.id]) continue;
          setR(_r1, Math.min(prevX, sh.x), sh.y, Math.abs(sh.x - prevX) + sh.w, sh.h);
          setR(_r2, e.x, e.y, e.w, e.h);
          if (rectsOverlap(_r1, _r2)) {
            sh.hitIds['e' + e.id] = true;
            if (slimeTakeDamage(e, sh.dmg, px, ATTACK_KNOCKBACK)) {
              triggerScreenShake(SHAKE_HIT, 0.15);
              if (sh.electric) {
                burst(e.x + e.w / 2, e.y + e.h / 2, 4, '#7df9ff', 120, 0.3, 3, 200);
                chainLightning(e);
              }
              if (sh.windy) burst(e.x + e.w / 2, e.y, 3, '#cfd8dc', 80, 0.3, 2, 150);
            }
            AudioManager.play('arrowImpact');
            if (sh.pierce > 0) { sh.pierce--; }
            else { out = true; }
            break;
          }
        }
        if (!out && boss && !boss.dead && boss.state !== 'death' && !sh.hitIds.boss) {
          setR(_r1, Math.min(prevX, sh.x), sh.y, Math.abs(sh.x - prevX) + sh.w, sh.h);
          setR(_r2, boss.x, boss.y, boss.w, boss.h);
          if (rectsOverlap(_r1, _r2)) {
            sh.hitIds.boss = true;
            if (hurtBoss(sh.dmg, px)) {
              triggerScreenShake(SHAKE_HIT, 0.15);
              if (sh.electric) burst(boss.x + boss.w / 2, boss.y, 4, '#7df9ff', 120, 0.3, 3, 200);
            }
            AudioManager.play('arrowImpact');
            if (sh.pierce > 0) { sh.pierce--; }
            else { out = true; }
          }
        }
        if (!out && miniboss && !miniboss.dead && miniboss.state !== 'death' && !sh.hitIds.mini) {
          setR(_r1, Math.min(prevX, sh.x), sh.y, Math.abs(sh.x - prevX) + sh.w, sh.h);
          setR(_r2, miniboss.x, miniboss.y, miniboss.w, miniboss.h);
          if (rectsOverlap(_r1, _r2)) {
            sh.hitIds.mini = true;
            if (hurtMiniboss(sh.dmg, px)) {
              triggerScreenShake(SHAKE_HIT, 0.15);
              if (sh.electric) burst(miniboss.x + miniboss.w / 2, miniboss.y, 4, '#7df9ff', 120, 0.3, 3, 200);
            }
            AudioManager.play('arrowImpact');
            if (sh.pierce > 0) { sh.pierce--; }
            else { out = true; }
          }
        }
        // Panah membuka chest tertutup (sekali per panah per chest).
        // Dunia beku saat victory: tidak ada pembukaan baru.
        if (!out && !(typeof victoryArmed !== 'undefined' && victoryArmed)) {
          for (var ci = 0; ci < chests.length; ci++) {
            var ch = chests[ci];
            if (ch.state !== 'closed' || sh.hitIds['c' + ci]) continue;
            setR(_r1, Math.min(prevX, sh.x), sh.y, Math.abs(sh.x - prevX) + sh.w, sh.h);
            setR(_r2, ch.x, ch.y, ch.w, ch.h);
            if (rectsOverlap(_r1, _r2)) {
              sh.hitIds['c' + ci] = true;
              ch.state = 'opening';
              ch.openT = 0;
              burst(ch.x + ch.w / 2, ch.y + 8, 5, '#c9a227', 100, 0.3, 2, 200);
              AudioManager.play('chestOpen');
              triggerScreenShake(SHAKE_HIT, 0.1);
              out = true;
              break;
            }
          }
        }
      }
      if (sh.windy && !out) {
        // Trail angin ringan (pool bounded, visual saja).
        burst(sh.x + sh.w / 2, sh.y + sh.h / 2, 1, '#cfd8dc', 20, 0.2, 2, 0);
      }
      if (out) {
        playerShots[i] = playerShots[playerShots.length - 1];
        playerShots.pop();
      }
    }
  }

  // Stormpiercer: rantai listrik ke 1 musuh terdekat (terkontrol, bounded).
  function chainLightning(fromE) {
    var bw = null;
    try { bw = bowStats(); } catch (e) { return; }
    if (!bw || !bw.special || bw.special.kind !== 'lightning') return;
    var rng = bw.special.chainRange || 60;
    var best = null, bd = rng;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e === fromE || e.dead || e.state === 'death') continue;
      var d = Math.abs((e.x + e.w / 2) - (fromE.x + fromE.w / 2));
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      var keep = best.iframes;
      best.iframes = 0;
      slimeTakeDamage(best, bw.special.chain || 4, fromE.x + fromE.w / 2, ATTACK_KNOCKBACK);
      best.iframes = Math.max(best.iframes, keep);
      burst(best.x + best.w / 2, best.y + best.h / 2, 3, '#7df9ff', 110, 0.3, 2, 200);
    }
  }

  function drawPlayerShots() {
    for (var i = 0; i < playerShots.length; i++) {
      var sh = playerShots[i];
      var x0 = Math.round(sh.x), y0 = Math.round(sh.y);
      if (sh.electric) {
        ctx.fillStyle = '#2ebeff';
        ctx.fillRect(x0, y0 + 2, sh.w, 2);
        ctx.fillStyle = '#fff9c4';
        if (sh.vx > 0) ctx.fillRect(x0 + sh.w - 4, y0, 4, sh.h);
        else ctx.fillRect(x0, y0, 4, sh.h);
      } else if (sh.w > 14) {
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(x0, y0 + 3, sh.w, 3);
        ctx.fillStyle = '#fff';
        if (sh.vx > 0) ctx.fillRect(x0 + sh.w - 5, y0, 5, sh.h);
        else ctx.fillRect(x0, y0, 5, sh.h);
      } else {
        ctx.fillStyle = '#7a5c3a';
        ctx.fillRect(x0, y0 + 2, sh.w, 2);
        ctx.fillStyle = '#e8e8e8';
        if (sh.vx > 0) ctx.fillRect(x0 + sh.w - 4, y0, 4, sh.h);
        else ctx.fillRect(x0, y0, 4, sh.h);
      }
    }
  }

  /* Guardian shield bash: visual + suara tameng saat menghantam.
   * Damage/timing/hitbox sama dengan melee (tanpa ubah balance). */
  function bashHitFX(x, y) {
    var guard = false;
    try { guard = (playerMode() === 'GUARDIAN'); } catch (e) { guard = false; }
    if (!guard) return;
    burst(x, y, 5, '#cfe3ff', 140, 0.3, 3, 250);
    if (!player.bashSfx) {
      player.bashSfx = true;
      AudioManager.play('shieldBlock');
    }
  }

  /* ========================== 10. COMBAT ========================== */
  var Combat = {
    // Pukulan player -> semua slime yang overlap attackBox (sekali per swing).
    // Stage 5: juga mengenai boss (kunci 'boss' agar sekali per ayunan).
    // C1: hanya proses saat player benar-benar dalam attack state.
    resolvePlayerAttack: function () {
      if (!player.attackBox) return;
      if (player.state !== 'attack') return;
      // Shop: damage + efek dari stats pedang (data-driven, tanpa if id).
      var _swd = swordStats();
      var _dmg = (_swd && _swd.damage > 0) ? _swd.damage : ATTACK_DAMAGE;
      for (var i = 0; i < enemies.length; i++) {
        var s = enemies[i];
        if (s.dead || player.didStrikeHit[s.id]) continue;
        if (rectsOverlap(player.attackBox, s)) {
          player.didStrikeHit[s.id] = true;
          var px = player.x + player.w / 2;
          if (slimeTakeDamage(s, _dmg, px, ATTACK_KNOCKBACK)) {
            applySwordEffect(s, null, null);
            bashHitFX(s.x + s.w / 2, s.y + s.h / 2);
            // Impact jelas tapi ringan: shake singkat (damage flash + suara
            // sudah di slimeTakeDamage). Stage 11: hit-stop micro-freeze
            // (kill lebih lama, tanpa ubah damage/timing).
            triggerScreenShake(SHAKE_HIT, 0.15);
            triggerHitStop(s.state === 'death' ? 0.06 : 0.03);
          }
        }
      }
      if (boss && !boss.dead && boss.state !== 'death' && !player.didStrikeHit.boss) {
        if (rectsOverlap(player.attackBox, boss)) {
          player.didStrikeHit.boss = true;
          if (hurtBoss(_dmg, player.x + player.w / 2)) {
            applySwordEffect(null, boss, null);
            bashHitFX(boss.x + boss.w / 2, boss.y + boss.h / 2);
            triggerScreenShake(SHAKE_HIT, 0.15);
            triggerHitStop(0.04);
          }
        }
      }
      if (miniboss && !miniboss.dead && miniboss.state !== 'death' && !player.didStrikeHit.mini) {
        if (rectsOverlap(player.attackBox, miniboss)) {
          player.didStrikeHit.mini = true;
          if (hurtMiniboss(_dmg, player.x + player.w / 2)) {
            applySwordEffect(null, null, miniboss);
            bashHitFX(miniboss.x + miniboss.w / 2, miniboss.y + miniboss.h / 2);
            triggerScreenShake(SHAKE_HIT, 0.15);
            triggerHitStop(0.04);
          }
        }
      }
      // Treasure dibuka dengan serangan (sekali per ayunan, chest tertutup saja).
      // Dunia beku saat victory: tidak ada pembukaan baru.
      if (typeof victoryArmed !== 'undefined' && victoryArmed) return;
      for (var ci = 0; ci < chests.length; ci++) {
        var ch = chests[ci];
        if (ch.state !== 'closed' || player.didStrikeHit['c' + ci]) continue;
        setR(_r1, player.attackBox.x, player.attackBox.y, player.attackBox.w, player.attackBox.h);
        setR(_r2, ch.x, ch.y, ch.w, ch.h);
        if (rectsOverlap(_r1, _r2)) {
          player.didStrikeHit['c' + ci] = true;
          ch.state = 'opening';
          ch.openT = 0;
          burst(ch.x + ch.w / 2, ch.y + 8, 5, '#c9a227', 100, 0.3, 2, 200);
          AudioManager.play('chestOpen');
          triggerScreenShake(SHAKE_HIT, 0.1);
        }
      }
    },
    // Serangan slime -> player (sekali per attack slime).
    // Stage 5: serangan strike boss (sekali per pola).
    // C2: setelah victory, enemy tidak boleh melukai player.
    resolveEnemyAttacks: function () {
      if (typeof victoryArmed !== 'undefined' && victoryArmed) return;
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
      // Strike boss: slime king (0-0.2 dtk) & lich (0-0.2 dtk, box wider).
      if (boss && !boss.dead && boss.state === 'strike' && !boss.struckPlayer &&
          boss.atkT >= 0 && boss.atkT < 0.2) {
        var bw = boss.kind === 'lich' ? 52 : 48;
        if (boss.dir === 1) setR(_r1, boss.x + boss.w - 8, boss.y - 8, bw, boss.h + 16);
        else setR(_r1, boss.x - bw + 8, boss.y - 8, bw, boss.h + 16);
        if (rectsOverlap(_r1, _r2)) {
          boss.struckPlayer = true;
          playerTakeDamage(boss.kind === 'lich' ? 16 : BOSS_STRIKE_DMG, boss.x + boss.w / 2);
        }
      }
      if (miniboss && !miniboss.dead && miniboss.state === 'slash' && !miniboss.struckPlayer) {
        if (miniboss.atkT >= 0 && miniboss.atkT < 0.22) {
          if (miniboss.dir === 1) setR(_r1, miniboss.x + miniboss.w - 6, miniboss.y - 8, 44, miniboss.h + 16);
          else setR(_r1, miniboss.x - 38, miniboss.y - 8, 44, miniboss.h + 16);
          if (rectsOverlap(_r1, _r2)) {
            miniboss.struckPlayer = true;
            playerTakeDamage(16, miniboss.x + miniboss.w / 2);
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
  // Stage 11: cap anti runaway — shake tak pernah melebihi maksimum,
  // durasi pendek; stacking berlebih ditolak oleh guard existing.
  var SHAKE_MAX = 8;

  function triggerScreenShake(amount, duration) {
    // Reduced motion: shake visual dinonaktifkan, gameplay tidak berubah.
    if (reducedMotion) return;
    var a = amount > SHAKE_MAX ? SHAKE_MAX : amount;
    if (a >= shake.mag || shake.t >= shake.dur) {
      shake.mag = a;
      shake.t = 0;
      shake.dur = Math.max(0.01, duration);
    }
  }

  /* Stage 11: HIT-STOP / micro-freeze (30–80ms, impact terasa berat).
   * Hanya saat playing, bukan victory/death/pause/menu. Timer dikonsumsi
   * di awal updatePlaying (deterministik untuk testing). Reduced-motion:
   * hit-stop dinonaktifkan (jalan terus). Cap 0.08 dtk, tanpa freeze UI. */
  var hitStopT = 0;
  var HIT_STOP_MAX = 0.08;

  function triggerHitStop(t) {
    if (reducedMotion) return;
    if (!(t > 0)) return;
    var nt = hitStopT + t;
    hitStopT = nt > HIT_STOP_MAX ? HIT_STOP_MAX : nt;
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

  /* Stage 11: LEVEL DECORATIONS (data-driven, world-space, tanpa alokasi
   * per-frame). Setiap level punya identitas: torch (api 2-frame
   * deterministik), banner, ruin, bones, rune, soul, slime, pillar.
   * Semua menapak GROUND_TOP; x dipilih di segmen tanah (di luar celah).
   * Collision tidak berubah — murni visual. */
  var LEVEL_DECOR = {
    1: [{ k: 'torch', x: 200 }, { k: 'slime', x: 450 }, { k: 'ruin', x: 900 },
        { k: 'torch', x: 1300 }, { k: 'slime', x: 1500 }, { k: 'ruin', x: 2000 }],
    2: [{ k: 'torch', x: 300 }, { k: 'banner', x: 700 }, { k: 'slime', x: 800 },
        { k: 'ruin', x: 1200 }, { k: 'banner', x: 1300 }, { k: 'slime', x: 1600 },
        { k: 'torch', x: 2100 }],
    3: [{ k: 'banner', x: 400 }, { k: 'bones', x: 800 }, { k: 'banner', x: 1300 },
        { k: 'bones', x: 1500 }, { k: 'torch', x: 1800 }, { k: 'banner', x: 2000 },
        { k: 'bones', x: 2200 }],
    4: [{ k: 'rune', x: 300 }, { k: 'soul', x: 700 }, { k: 'pillar', x: 1000 },
        { k: 'rune', x: 1200 }, { k: 'soul', x: 1600 }, { k: 'pillar', x: 1800 },
        { k: 'rune', x: 2000 }, { k: 'torch', x: 2200 }],
    5: [{ k: 'torch', x: 200 }, { k: 'slime', x: 300 }, { k: 'banner', x: 600 },
        { k: 'bones', x: 900 }, { k: 'rune', x: 1400 }, { k: 'ruin', x: 1700 },
        { k: 'torch', x: 2100 }]
  };
  var DECOR_BANNER = { 1: '#5ec46f', 2: '#a03a3a', 3: '#8a97a8', 4: '#b46ae0', 5: '#c98a6b' };

  function drawLevelDecor() {
    var list = LEVEL_DECOR[currentLevel];
    if (!list) return;
    var g = GROUND_TOP;
    // Api/obor 2-frame deterministik (pola sama seperti obor arena).
    var fl = 0;
    try { fl = reducedMotion ? 0 : Math.floor(nowPerf() / 180) % 2; } catch (e) { fl = 0; }
    var i, d, x;
    for (i = 0; i < list.length; i++) {
      d = list[i];
      x = Math.round(d.x);
      if (x < camera.x - 60 || x > camera.x + VIEW_W + 60) continue; // cull murah
      if (d.k === 'torch') {
        ctx.fillStyle = '#4a3524';
        ctx.fillRect(x, g - 30, 5, 30);
        ctx.fillStyle = '#2c2118';
        ctx.fillRect(x - 2, g - 34, 9, 5);
        var fh = fl ? 13 : 10;
        ctx.fillStyle = '#e0682a';
        ctx.fillRect(x - 1, g - 34 - fh, 7, fh);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + 1, g - 34 - fh, 3, fh - 4);
      } else if (d.k === 'banner') {
        ctx.fillStyle = '#2c2118';
        ctx.fillRect(x, g - 74, 3, 74);
        ctx.fillStyle = DECOR_BANNER[currentLevel] || '#8a8fa8';
        ctx.fillRect(x + 3, g - 70, 20, 26);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 3, g - 70 + 22, 20, 4);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + 9, g - 64, 8, 4);
      } else if (d.k === 'ruin') {
        ctx.fillStyle = '#3a3f5c';
        ctx.fillRect(x, g - 18, 26, 18);
        ctx.fillRect(x + 4, g - 28, 14, 10);
        ctx.fillStyle = '#262b40';
        ctx.fillRect(x, g - 4, 26, 4);
        ctx.fillRect(x + 4, g - 28, 14, 3);
      } else if (d.k === 'bones') {
        ctx.fillStyle = '#a8a49a';
        ctx.fillRect(x, g - 6, 24, 6);
        ctx.fillStyle = '#d6d3c9';
        ctx.fillRect(x + 3, g - 10, 8, 5);
        ctx.fillRect(x + 13, g - 9, 6, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 5, g - 9, 3, 3);
      } else if (d.k === 'rune') {
        var pulse = 1;
        try { pulse = reducedMotion ? 1 : (0.7 + 0.3 * Math.sin(nowPerf() / 400 + x)); } catch (e) { pulse = 1; }
        ctx.fillStyle = '#241a38';
        ctx.fillRect(x, g - 14, 22, 14);
        ctx.fillStyle = pulse > 0.85 ? '#e8c9ff' : '#b46ae0';
        ctx.fillRect(x + 4, g - 11, 14, 3);
        ctx.fillRect(x + 9, g - 14, 4, 14);
      } else if (d.k === 'soul') {
        var bob = 0;
        try { bob = reducedMotion ? 0 : Math.round(Math.sin(nowPerf() / 500 + x) * 4); } catch (e) { bob = 0; }
        ctx.fillStyle = 'rgba(159,216,255,0.35)';
        ctx.fillRect(x - 2, g - 52 + bob, 12, 12);
        ctx.fillStyle = '#9fd8ff';
        ctx.fillRect(x + 1, g - 49 + bob, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, g - 48 + bob, 3, 3);
      } else if (d.k === 'slime') {
        ctx.fillStyle = '#2a8a3a';
        ctx.fillRect(x, g - 5, 26, 5);
        ctx.fillStyle = '#4fc94f';
        ctx.fillRect(x + 4, g - 9, 12, 5);
        ctx.fillRect(x + 16, g - 7, 7, 3);
        ctx.fillStyle = '#a5f0a0';
        ctx.fillRect(x + 6, g - 8, 4, 2);
      } else if (d.k === 'pillar') {
        ctx.fillStyle = '#241a38';
        ctx.fillRect(x, g - 92, 16, 92);
        ctx.fillStyle = '#4a3670';
        ctx.fillRect(x, g - 92, 16, 6);
        ctx.fillRect(x, g - 8, 16, 8);
        ctx.fillStyle = '#b46ae0';
        ctx.fillRect(x + 6, g - 86, 4, 60);
      }
    }
  }

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
    // Level tanpa goal fisik (L2/L4/L5): progres menuju arena boss/lich.
    if (!Level.goal) {
      var bs = Level.bossSpawn || Level.lichSpawn;
      if (bs) {
        return clamp((playerCenterX() - Level.playerSpawn.x) / (bs.x - Level.playerSpawn.x), 0, 1);
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
    // Minor D: goal fisik (L1/L3) selalu -> Level Complete.
    // Legacy showWin() hanya via forceWin test hook, bukan jalur goal.
    if (rectsOverlap(_r1, goalRect())) showLevelComplete();
  }

  function showGameOver() {
    if (gameState !== 'playing') return;
    gameState = 'gameover';
    gameOverT = 0;
    deaths++;
    // Persistent: total kematian lintas sesi (event-driven, bukan per-frame;
    // clamp agar simetri dengan sanitasi save dan tak pernah overflow).
    save.totalDeaths = Math.min(1e9, Math.floor(saveNum(save.totalDeaths, 0, 0, 1e9)) + 1);
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

  /* ============ 11b. STAGE 5: BOSS, COIN, STATS, TRANSISI ============
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
  // Level collectible = COIN (single currency). Treasure reward = GOLD SHARD
  // (resource terpisah, run-only + total persist). Dua resource tidak tertukar.
  var coins = [];
  var runStats = { kills: 0, coins: 0, goldShards: 0 }; // total lintas level
  var levelStats = { kills: 0, coins: 0, time: 0 }; // per level
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
  var btnAgain2 = null, btnGameMenu = null, btnGameCampaign = null;

  function createBoss(spawn, arena, mods) {
    // mods opsional (mis. L5 gauntlet): {hpMul}. L2 tanpa mods = perilaku
    // existing persis (non-regresi RAJA SLIME Level 2).
    var hpMul = (mods && mods.hpMul > 0) ? mods.hpMul : 1;
    var mult = getDifficultyMult();
    var hp = Math.round(BOSS_MAX_HP * hpMul * mult.bossHp);
    return {
      id: ++slimeUid, kind: 'slimeKing', name: 'RAJA SLIME',
      x: spawn.x, y: spawn.y, w: BOSS_W, h: BOSS_H,
      vx: 0, vy: 0, onGround: false, hitWall: false,
      spawnX: spawn.x, spawnY: spawn.y,
      arenaMin: arena.minX, arenaMax: arena.maxX,
      dir: -1, hp: hp, maxHp: hp,
      state: 'idle', // idle|telegraph|strike|charge|shock|recovery|hurt|death
      animTime: 0, idleT: 0, teleT: 0, teleDur: 0.5,
      atkT: 0, recT: 0, recDur: 0.6,
      pattern: 'strike', patIdx: 0, cooldown: 1.0,
      hurtT: 0, deathT: 0, iframes: 0, struckPlayer: false,
      enraged: false, dead: false,
      enraged: false, dead: false,
      introduced: false, dustT: 0, deathFxT: 0 // intro arena + debu charge/final (visual saja)
    };
  }

  function bossSeesPlayer(b) {
    if (player.state === 'death' || gameState !== 'playing') return false;
    var px = player.x + player.w / 2, bx = b.x + b.w / 2;
    var py = player.y + player.h / 2, by = b.y + b.h / 2;
    return Math.abs(px - bx) < BOSS_DETECT_X && Math.abs(py - by) < BOSS_DETECT_Y;
  }

  // Dispatcher serangan player ke boss aktif (slime king / lich).
  function hurtBoss(amount, fromX) {
    if (boss && boss.kind === 'lich') return hurtLich(amount, fromX);
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
      triggerHitStop(0.08); // beku dramatis killing blow (cap, timing utuh)
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
      // Minor E: mayat tetap di arena selama animasi (visual-only).
      if (b.x < b.arenaMin) b.x = b.arenaMin;
      if (b.x > b.arenaMax) b.x = b.arenaMax;
      // Gugur bertahap: bara esensi naik tiap 0.12 dtk (visual saja).
      b.deathFxT -= dt;
      if (b.deathFxT <= 0) { b.deathFxT = 0.12; kingDeathEmber(b, 'slimeKing'); }
      if (b.deathT >= 1.0 && !b.dead) {
        b.dead = true;
        onBossDefeated();
      }
      return;
    }

    if (b.state === 'hurt') {
      b.hurtT += dt;
      applyGravity(b, dt);
      moveAndCollide(b, dt, Level.platforms);
      if (b.hurtT >= 0.25) { b.state = 'idle'; b.idleT = 0; }
      return; // M1: cegah integrasi ganda
    }

    if (b.state === 'idle') {
      b.vx = 0;
      b.idleT += dt;
      b.dir = px >= bx ? 1 : -1;
      // Opening: presentasi saat pemain memasuki zona boss (sekali per boss).
      if (!b.introduced && player.x > b.arenaMin - 120) {
        b.introduced = true;
        showToast('RAJA SLIME MUNCUL!');
        AudioManager.play('bossAttack');
        triggerScreenShake(SHAKE_HURT, 0.3);
        // Stage 11: aura intro (visual saja, pool bounded, tanpa ubah AI).
        burst(b.x + b.w / 2, b.y + b.h / 2, 12, '#4fc94f', 180, 0.6, 4, 250);
        burst(b.x + b.w / 2, b.y + b.h / 2, 6, '#ffffff', 120, 0.5, 3, 200);
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
    // Jatuh ke jurang = gugur via death normal (kill/victory tetap jalan
    // lewat onBossDefeated). Tanpa teleport kembali.
    if (b.y > WORLD_H + 100 && !b.dead && b.state !== 'death') {
      b.hp = 0;
      b.state = 'death';
      b.deathT = 0;
      b.vx = 0; b.vy = 0;
      AudioManager.play('bossDie');
    }
  }

  function spawnShocks(b) {
    // C2: tidak ada shockwave baru setelah victory armed.
    if (typeof victoryArmed !== 'undefined' && victoryArmed) return;
    if (shocks.length >= 6) return; // batas: tanpa spam
    var gy = b.y + b.h - 40;
    for (var d = -1; d <= 1; d += 2) {
      shocks.push({ x: b.x + b.w / 2 - 13, y: gy, w: 26, h: 40,
        vx: d * 230, life: 1.6, dmg: BOSS_SHOCK_DMG, hitDone: false,
        minX: b.arenaMin - 60, maxX: b.arenaMax + 60 });
    }
  }

  function updateShocks(dt) {
    // Design rule (M9): shockwave adalah ground-hugging wave — by-design
    // TIDAK di-block platform (arena boss datar), cleanup via life/arena
    // bounds. Arrow/bolt sebaliknya solid-blocked (lihat updateShots).
    for (var i = shocks.length - 1; i >= 0; i--) {
      var sh = shocks[i];
      sh.x += sh.vx * dt;
      sh.life -= dt;
      if (!sh.hitDone && player.state !== 'death') {
        setR(_r1, sh.x, sh.y, sh.w, sh.h);
        setR(_r2, player.x, player.y, player.w, player.h);
        if (rectsOverlap(_r1, _r2)) {
          sh.hitDone = true;
          playerTakeDamage(sh.dmg, sh.x + sh.w / 2, 'shock');
        }
      }
      if (sh.life <= 0 || sh.x < sh.minX || sh.x > sh.maxX) {
        shocks[i] = shocks[shocks.length - 1];
        shocks.pop();
      }
    }
  }

  /* Raja gugur bertahap (visual saja, durasi 1.0 dtk + victory utuh):
   * bara esensi naik selama death (warna per jenis), lalu fade akhir.
   * Tanpa ubah damage/timing/death-first/victoryArmed. */
  function kingDeathEmber(o, kind) {
    var cx = o.x + o.w / 2, i;
    if (kind === 'lich') {
      // Arwah ungu melayang ke atas.
      for (i = 0; i < 3; i++) {
        spawnParticle(cx + (Math.random() * 24 - 12), o.y + 10 + Math.random() * 30,
          (Math.random() * 2 - 1) * 20, -70 - Math.random() * 50, 0.7,
          i ? '#b46ae0' : '#e8c9ff', 3, -40);
      }
    } else if (kind === 'miniboss') {
      burst(cx, o.y + 10, 3, '#e8e4d8', 130, 0.5, 3, 300);
    } else {
      burst(cx, o.y + 10, 3, '#7a3fc9', 130, 0.5, 3, 300);
      burst(cx, o.y + 20, 2, '#c9a5f0', 100, 0.4, 3, 250);
    }
  }

  /* Stage 9: MINIBOSS — Lightning Slime (L1, slime midboss) / Panglima Tulang (L3, skeleton midboss).
   * FSM ringkas reuse primitif (fisika, burst, shake, suara): idle →
   * telegraph → slash(berat)/dash(charge) → recovery → hurt → death.
   * Enrage <36 HP: cooldown lebih cepat. Bukan copy Heavy Slime:
   * pola, timing, dan presentasi sendiri. */
  var MINIBOSS_HP = 90;
  var miniboss = null;

  function createMiniboss(spawn, arena) {
    var isSlimeMid = (currentLevel === 1);
    return {
      id: ++slimeUid, kind: 'miniboss', name: isSlimeMid ? 'Lightning Slime' : 'PANGLIMA TULANG',
      x: spawn.x, y: spawn.y, w: isSlimeMid ? 56 : 52, h: isSlimeMid ? 48 : 64,
      vx: 0, vy: 0, onGround: false, hitWall: false,
      spawnX: spawn.x, spawnY: spawn.y,
      arenaMin: arena.minX, arenaMax: arena.maxX,
      dir: -1, hp: MINIBOSS_HP, maxHp: MINIBOSS_HP,
      state: 'idle', // idle|telegraph|slash|dash|recovery|hurt|death
      animTime: 0, idleT: 0, teleT: 0, teleDur: 0.6,
      atkT: 0, recT: 0, recDur: 0.6,
      pattern: 'slash', patIdx: 0, cooldown: 1.2,
      hurtT: 0, deathT: 0, iframes: 0, struckPlayer: false,
      enraged: false, dead: false, introduced: false, deathFxT: 0
    };
  }

  function miniSeesPlayer(m) {
    if (player.state === 'death' || gameState !== 'playing') return false;
    var px = player.x + player.w / 2, mx = m.x + m.w / 2;
    var py = player.y + player.h / 2, my = m.y + m.h / 2;
    return Math.abs(px - mx) < 400 && Math.abs(py - my) < 170;
  }

  function hurtMiniboss(amount, fromX) {
    var m = miniboss;
    if (!m || m.dead || m.state === 'death' || m.iframes > 0) return false;
    m.hp -= amount;
    m.iframes = 0.3;
    burst(m.x + m.w / 2, m.y + m.h / 2, 7, '#ffffff', 170, 0.3, 3, 250);
    burst(m.x + m.w / 2, m.y + m.h / 2, 4, '#ffd23f', 130, 0.35, 3, 250);
    AudioManager.play('skelHit');
    // Death selalu prioritas (B4): killing blow tak picu enrage.
    if (m.hp <= 0) {
      m.hp = 0;
      m.state = 'death';
      m.deathT = 0;
      m.vx = 0;
      burst(m.x + m.w / 2, m.y + m.h / 2, 14, '#ffd23f', 200, 0.8, 4, 350);
      burst(m.x + m.w / 2, m.y + m.h / 2, 8, '#ffffff', 150, 0.7, 3, 300);
      triggerScreenShake(SHAKE_DIE + 1, 0.35);
      triggerHitStop(0.08); // beku dramatis killing blow (cap, timing utuh)
      AudioManager.play('bossDie');
      return true;
    }
    if (!m.enraged && m.hp <= 32) {
      m.enraged = true;
      burst(m.x + m.w / 2, m.y, 10, '#e05252', 190, 0.6, 4, 300);
      triggerScreenShake(SHAKE_HURT, 0.3);
      AudioManager.play('minibossCue');
      showToast(currentLevel === 1 ? 'LIGHTNING SLIME MURKA!' : 'PANGLIMA TULANG MURKA!');
    }
    m.state = 'hurt';
    m.hurtT = 0;
    var dir = (m.x + m.w / 2) < fromX ? -1 : 1;
    m.vx = dir * ATTACK_KNOCKBACK * 0.5;
    m.vy = -240;
    m.onGround = false;
    triggerScreenShake(SHAKE_HIT, 0.1);
    return true;
  }

  function updateMiniboss(m, dt) {
    m.animTime += dt;
    if (m.iframes > 0) m.iframes -= dt;
    if (m.cooldown > 0) m.cooldown -= dt;
    var px = player.x + player.w / 2, mx = m.x + m.w / 2;
    var cdMul = m.enraged ? 0.6 : 1;

    if (m.state === 'death') {
      m.deathT += dt;
      m.vx = 0;
      applyGravity(m, dt);
      moveAndCollide(m, dt, Level.platforms);
      // Minor E: mayat tetap di arena selama animasi (visual-only).
      if (m.x < m.arenaMin) m.x = m.arenaMin;
      if (m.x > m.arenaMax) m.x = m.arenaMax;
      // Gugur bertahap: serpihan tulang tiap 0.12 dtk (visual saja).
      m.deathFxT -= dt;
      if (m.deathFxT <= 0) { m.deathFxT = 0.12; kingDeathEmber(m, 'miniboss'); }
      if (m.deathT >= 1.0 && !m.dead) {
        m.dead = true;
        runStats.kills++;
        levelStats.kills++;
        if (!save.achievements.first_blood) unlockAchievement('first_blood');
        showToast(currentLevel === 1 ? 'LIGHTNING SLIME TUMBANG!' : 'PANGLIMA TULANG TUMBANG!');
      }
      return;
    }

    if (m.state === 'hurt') {
      m.hurtT += dt;
      applyGravity(m, dt);
      moveAndCollide(m, dt, Level.platforms);
      if (m.hurtT >= 0.25) { m.state = 'idle'; m.idleT = 0; }
      return; // M1: cegah integrasi ganda
    } else if (m.state === 'idle') {
      m.vx = 0;
      m.idleT += dt;
      m.dir = px >= mx ? 1 : -1;
      // Intro sekali saat pemain memasuki arena.
      if (!m.introduced && player.x > m.arenaMin - 120) {
        m.introduced = true;
        showToast(currentLevel === 1 ? 'LIGHTNING SLIME MUNCUL!' : 'PANGLIMA TULANG MUNCUL!');
        AudioManager.play('minibossCue');
        triggerScreenShake(SHAKE_HURT, 0.3);
        // Stage 11: aura intro (visual saja, tanpa ubah pola/timing).
        burst(m.x + m.w / 2, m.y + m.h / 2, 12, '#d6deea', 180, 0.6, 4, 250);
        burst(m.x + m.w / 2, m.y + m.h / 2, 6, '#c9a227', 120, 0.5, 3, 200);
      }
      if (m.idleT >= 0.6 && m.cooldown <= 0 && miniSeesPlayer(m)) {
        m.pattern = (m.patIdx % 2 === 0) ? 'slash' : 'dash';
        m.patIdx++;
        m.teleDur = m.pattern === 'dash' ? 0.7 : 0.6;
        m.teleT = 0;
        m.state = 'telegraph';
        AudioManager.play('swordSwing');
      }
    } else if (m.state === 'telegraph') {
      m.vx = 0;
      m.teleT += dt;
      m.dir = px >= mx ? 1 : -1;
      if (m.teleT >= m.teleDur) {
        m.state = m.pattern;
        m.atkT = 0;
        m.struckPlayer = false;
      }
    } else if (m.state === 'slash') {
      m.atkT += dt;
      if (m.atkT < 0.22) m.vx = m.dir * 150;
      else m.vx = 0;
      if (m.atkT >= 0.85) {
        m.state = 'recovery'; m.recT = 0; m.recDur = 0.6;
        m.cooldown = 1.1 * cdMul;
      }
    } else if (m.state === 'dash') {
      m.atkT += dt;
      if (m.atkT < 0.4 && !m.hitWall) {
        m.vx = m.dir * (m.enraged ? 430 : 360);
        if (!m.struckPlayer && player.state !== 'death') {
          setR(_r1, m.x, m.y, m.w, m.h);
          setR(_r2, player.x, player.y, player.w, player.h);
          if (rectsOverlap(_r1, _r2)) {
            m.struckPlayer = true;
            playerTakeDamage(14, mx);
          }
        }
      } else {
        m.vx = 0;
        m.state = 'recovery'; m.recT = 0; m.recDur = 0.8;
        m.cooldown = 1.7 * cdMul;
      }
    } else if (m.state === 'recovery') {
      m.vx = 0;
      m.recT += dt;
      if (m.recT >= m.recDur) { m.state = 'idle'; m.idleT = 0; }
    }

    applyGravity(m, dt);
    moveAndCollide(m, dt, Level.platforms);
    if (m.x < m.arenaMin) { m.x = m.arenaMin; m.vx = 0; }
    if (m.x > m.arenaMax) { m.x = m.arenaMax; m.vx = 0; }
    // Jatuh ke jurang = gugur via death normal (kill/toast tetap jalan).
    // Tanpa teleport kembali.
    if (m.y > WORLD_H + 100 && !m.dead && m.state !== 'death') {
      m.hp = 0;
      m.state = 'death';
      m.deathT = 0;
      m.vx = 0; m.vy = 0;
      AudioManager.play('bossDie');
    }
  }

  function drawMiniboss() {
    var m = miniboss;
    if (!m || m.dead) return;
    var t = m.animTime;
    var dw = 60, dh = 72;
    // Gugur bertahap: topple + ambruk + fade akhir (durasi 1.0 dtk utuh).
    var mTopple = 0, mFade = 1;
    if (m.state === 'death') {
      var k = clamp(1 - m.deathT / 1.0, 0, 1);
      dh = Math.round(dh * (0.3 + 0.7 * k));
      mTopple = Math.round(Math.min(8, m.deathT * 20)) * (m.dir === 1 ? 1 : -1);
      if (m.deathT > 0.7) mFade = clamp((1.0 - m.deathT) / 0.3, 0, 1);
    }
    var dx = Math.round(m.x + m.w / 2 - dw / 2) + mTopple;
    var dy = Math.round(m.y + m.h - dh);
    var tele = m.state === 'telegraph';
    var blink = (m.iframes > 0 && Math.floor(t * 16) % 2 === 0) ||
                (tele && Math.floor(t * 10) % 2 === 0);

    if (mFade < 1) { ctx.save(); ctx.globalAlpha = mFade; }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(m.x + 6), Math.round(m.y + m.h - 3), m.w - 12, 5);

    // Sprite Skeleton Knight: slash/dash realistis per state.
    var kfr = bossFrameFor('miniboss', m.state);
    var kimg = kfr[0] ? foeImg(sprites[kfr[0]], kfr[1]) : null;
    if (kimg) {
      drawFoeSprite(kimg, dx, dy, dw, dh, m.dir, blink);
      // Swoosh slash + garis laju dash (visual saja).
      if (m.state === 'slash' && m.atkT < 0.3) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        var kx = m.dir === 1 ? dx + dw - 20 : dx + 12;
        ctx.fillRect(kx, Math.round(dy + dh / 2 - 12), 10, 24);
      }
      if (m.state === 'dash') {
        ctx.fillStyle = 'rgba(200,205,230,0.35)';
        var lx = m.dir === 1 ? dx - 14 : dx + dw + 6;
        ctx.fillRect(lx, Math.round(dy + 14), 12, 3);
        ctx.fillRect(lx, Math.round(dy + 26), 12, 3);
      }
      // Enrage: semburat merah elite (visual saja).
      if (m.enraged) {
        ctx.fillStyle = 'rgba(224,82,82,0.25)';
        ctx.fillRect(dx, dy, dw, dh);
      }
    } else {
    var slimeVis = (currentLevel === 1);
    if (slimeVis) {
      // Lightning Slime — polished midboss pixel-art procedural
      var bob = (currentLevel === 1) ? Math.sin(t * 3) * 3 : 0; // idle bob
      var intensity = (m.state === 'slash' || m.state === 'dash' || m.enraged) ? 1.2 : 1.0;
      var cx = dx + dw / 2, cy = dy + dh / 2 - 6 + bob;

      // Shadow under body
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + dh / 2 - 4, dw / 2 + 4, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main organic slime body (rounded, slightly wider at bottom)
      ctx.fillStyle = m.enraged ? '#c0392b' : '#27ae60';
      ctx.beginPath();
      ctx.arc(cx, cy, dw / 2 - 2, Math.PI * 0.2, Math.PI * 1.8);
      ctx.lineTo(cx + dw / 2 - 4, cy + dh / 2 - 6);
      ctx.lineTo(cx - dw / 2 + 4, cy + dh / 2 - 6);
      ctx.closePath();
      ctx.fill();
      // Lower gel drip
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(cx - 6, cy + dh / 2 - 10, 12, 8);
      ctx.fillRect(cx - 14, cy + dh / 2 - 6, 6, 4);
      ctx.fillRect(cx + 8, cy + dh / 2 - 8, 6, 4);

      // Mid-body highlight (shading)
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 2, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner glowing core — bright blue with yellow pulse
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      // Core glow ring
      ctx.fillStyle = 'rgba(52,152,219,0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 14 * intensity, 0, Math.PI * 2);
      ctx.fill();

      // Lightning arcs around body (organic jagged lines)
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - dw/2 + 2, cy - 10);
      ctx.lineTo(cx - dw/2 + 8, cy - 18);
      ctx.lineTo(cx - dw/2 + 4, cy + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + dw/2 - 2, cy - 12);
      ctx.lineTo(cx + dw/2 - 6, cy - 20);
      ctx.lineTo(cx + dw/2 + 4, cy + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + dh/2 - 2);
      ctx.lineTo(cx - 10, cy + dh/2 + 8);
      ctx.lineTo(cx + 4, cy + dh/2 + 2);
      ctx.stroke();
      // Small side sparks
      ctx.fillStyle = '#fdfefe';
      ctx.fillRect(cx - dw/2 - 2, cy - 6, 3, 3);
      ctx.fillRect(cx + dw/2 + 2, cy - 4, 3, 3);
      ctx.fillRect(cx - dw/2 - 4, cy + 6, 3, 3);

      // Eyes — sharp, menacing (slightly angled)
      ctx.fillStyle = '#1a1a2e';
      var eyeOff = m.dir === 1 ? 10 : -10;
      ctx.fillRect(cx + eyeOff - 4, cy - 16, 8, 5);
      ctx.fillRect(cx - eyeOff - 4, cy - 10, 8, 5);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(cx + eyeOff - 2, cy - 14, 4, 3);
      ctx.fillRect(cx - eyeOff - 2, cy - 8, 4, 3);
      // Eye highlights
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx + eyeOff - 1, cy - 13, 2, 1);
      ctx.fillRect(cx - eyeOff - 1, cy - 7, 2, 1);

      // Attack / enrage aura boost (more sparks on attack)
      if (m.state === 'slash' || m.state === 'dash' || m.enraged) {
        ctx.strokeStyle = 'rgba(255,215,0,0.7)';
        ctx.lineWidth = 1;
        for (var s = 0; s < 6; s++) {
          var ang = (s / 6) * Math.PI * 2 + t * 2;
          var rx = Math.cos(ang) * (dw / 2 + 2);
          var ry = Math.sin(ang) * (dh / 2 + 2);
          ctx.beginPath();
          ctx.moveTo(cx + rx * 0.3, cy + ry * 0.3);
          ctx.lineTo(cx + rx, cy + ry);
          ctx.stroke();
        }
      }
    } else {
    // Armor berat + jubah (enrage = semburat merah).
    ctx.fillStyle = blink ? '#ffffff' : (m.enraged ? '#8a3a4a' : '#5a6478');
    ctx.fillRect(dx + 8, dy + 16, dw - 16, dh - 16);   // torso armor
    ctx.fillRect(dx + 14, dy + 6, dw - 28, 12);        // helm tengkorak
    ctx.fillStyle = m.enraged ? '#5c1a26' : '#39404f';
    ctx.fillRect(dx + 8, dy + dh - 10, dw - 16, 10);   // kaki berat
    ctx.fillStyle = '#3a2f5c';                          // jubah
    ctx.fillRect(dx + 4, dy + 20, 8, dh - 24);
    ctx.fillRect(dx + dw - 12, dy + 20, 8, dh - 24);
    // Mata + pedang besar.
    var ex = m.dir === 1 ? dx + dw - 26 : dx + 12;
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(ex, dy + 8, 6, 6);
    ctx.fillRect(ex + 8, dy + 8, 6, 6);
    var swx = m.dir === 1 ? dx + dw - 8 : dx - 10;
    ctx.fillStyle = '#d6deea';
    ctx.fillRect(swx, tele ? dy - 10 : dy + 10, 7, 34);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(swx - 3, tele ? dy + 22 : dy + 40, 13, 5);
    } // end skeleton fallback
    } // end fallback prosedural
    if (tele) {
      ctx.fillStyle = '#ffd23f';
      var qx = Math.round(m.x + m.w / 2 - 3);
      ctx.fillRect(qx, dy - 30, 7, 15);
      ctx.fillRect(qx, dy - 11, 7, 7);
    }
    if (mFade < 1) ctx.restore();
  }

  /* Stage 9: RAJA LICH — boss final L4 + klimaks L5.
   * 3 phase deterministik: P1 strike; P2 (<65%) +bolt; P3 (<35%) enrage.
   * Summon dibatasi (maks 2 sword hidup). Death selalu prioritas
   * (killing blow tak picu phase/enrage — pelajaran B4). */
  var LICH_HP = 160;

  function createLich(spawn, arena, mods) {
    var hpMul = (mods && mods.hpMul > 0) ? mods.hpMul : 1;
    var mult = getDifficultyMult();
    var hp = Math.round(LICH_HP * hpMul * mult.bossHp);
    return {
      id: ++slimeUid, kind: 'lich', name: 'RAJA LICH',
      x: spawn.x, y: spawn.y, w: 56, h: 72,
      vx: 0, vy: 0, onGround: false, hitWall: false,
      spawnX: spawn.x, spawnY: spawn.y,
      arenaMin: arena.minX, arenaMax: arena.maxX,
      dir: -1, hp: hp, maxHp: hp,
      state: 'dormant', // dormant|idle|telegraph|strike|bolt|summon|recovery|hurt|death
      animTime: 0, idleT: 0, teleT: 0, teleDur: 0.5,
      atkT: 0, recT: 0, recDur: 0.6,
      pattern: 'strike', patIdx: 0, cooldown: 1.2,
      hurtT: 0, deathT: 0, iframes: 0, struckPlayer: false,
      phase: 1, phaseAnn: 1, enraged: false,
      dead: false, introduced: false, deathFxT: 0
    };
  }

  function lichSeesPlayer(b) {
    if (player.state === 'death' || gameState !== 'playing') return false;
    var px = player.x + player.w / 2, bx = b.x + b.w / 2;
    var py = player.y + player.h / 2, by = b.y + b.h / 2;
    return Math.abs(px - bx) < 460 && Math.abs(py - by) < 180;
  }

  function liveSwords() {
    var n = 0;
    for (var i = 0; i < enemies.length; i++) {
      if (!enemies[i].dead && enemies[i].kind === 'skeletonSword') n++;
    }
    return n;
  }

  function lichPhase(b) {
    var f = b.hp / b.maxHp;
    return f <= 0.35 ? 3 : (f <= 0.65 ? 2 : 1);
  }

  function hurtLich(amount, fromX) {
    var b = boss;
    if (!b || b.kind !== 'lich' || b.dead || b.state === 'death' || b.iframes > 0) return false;
    b.hp -= amount;
    b.iframes = 0.3;
    burst(b.x + b.w / 2, b.y + b.h / 2, 8, '#ffffff', 180, 0.3, 3, 250);
    burst(b.x + b.w / 2, b.y + b.h / 2, 5, '#b46ae0', 140, 0.35, 3, 250);
    AudioManager.play('bossHurt');
    // Death selalu prioritas (B4).
    if (b.hp <= 0) {
      b.hp = 0;
      b.state = 'death';
      b.deathT = 0;
      b.vx = 0;
      burst(b.x + b.w / 2, b.y + b.h / 2, 16, '#b46ae0', 220, 0.8, 4, 350);
      burst(b.x + b.w / 2, b.y + b.h / 2, 10, '#ffffff', 160, 0.7, 3, 300);
      triggerScreenShake(SHAKE_DIE + 2, 0.4);
      triggerHitStop(0.08); // beku dramatis killing blow (cap, timing utuh)
      AudioManager.play('bossDie');
      return true;
    }
    var np = lichPhase(b);
    if (np > b.phase) {
      b.phase = np;
      b.enraged = (np >= 3);
      triggerScreenShake(SHAKE_HURT, 0.3);
      AudioManager.play('phaseShift');
      showToast(np >= 3 ? 'RAJA LICH MURKA!' : 'RAJA LICH MENGAMUK!');
      // Stage 11: pulse transisi phase (visual saja, tanpa ubah damage).
      burst(b.x + b.w / 2, b.y + b.h / 2, 10, np >= 3 ? '#e05252' : '#b46ae0', 170, 0.6, 4, 250);
    }
    b.state = 'hurt';
    b.hurtT = 0;
    var dir = (b.x + b.w / 2) < fromX ? -1 : 1;
    b.vx = dir * ATTACK_KNOCKBACK * 0.4;
    b.vy = -240;
    b.onGround = false;
    triggerScreenShake(SHAKE_HIT, 0.12);
    return true;
  }

  function updateLich(b, dt) {
    b.animTime += dt;
    if (b.iframes > 0) b.iframes -= dt;
    if (b.cooldown > 0) b.cooldown -= dt;
    // Jatuh ke jurang = gugur via death normal (berlaku juga saat dormant
    // yang return lebih awal — cek di atas agar tak pernah lolos).
    if (b.y > WORLD_H + 100 && !b.dead && b.state !== 'death') {
      b.hp = 0;
      b.state = 'death';
      b.deathT = 0;
      b.vx = 0; b.vy = 0;
      AudioManager.play('bossDie');
    }
    var px = player.x + player.w / 2, bx = b.x + b.w / 2;
    var rage = b.phase >= 3;
    var cdMul = rage ? 0.6 : (b.phase >= 2 ? 0.85 : 1);
    var spdMul = rage ? 1.2 : 1;

    // Dormant: diam sampai pemain memasuki arena (intro sekali).
    if (b.state === 'dormant') {
      b.vx = 0;
      applyGravity(b, dt);
      moveAndCollide(b, dt, Level.platforms);
      if (player.x > b.arenaMin - 100) {
        b.introduced = true;
        b.state = 'idle';
        b.idleT = 0;
        showToast('RAJA LICH MUNCUL!');
        AudioManager.play('lichMagic');
        triggerScreenShake(SHAKE_HURT, 0.3);
        // Stage 11: aura entrance ungu (visual saja, tanpa ubah FSM).
        burst(b.x + b.w / 2, b.y + b.h / 2, 14, '#b46ae0', 190, 0.7, 4, 250);
        burst(b.x + b.w / 2, b.y + b.h / 2, 6, '#e8c9ff', 120, 0.5, 3, 200);
      }
      return;
    }

    if (b.state === 'death') {
      b.deathT += dt;
      b.vx = 0;
      applyGravity(b, dt);
      moveAndCollide(b, dt, Level.platforms);
      // Minor E: mayat tetap di arena selama animasi (visual-only).
      if (b.x < b.arenaMin) b.x = b.arenaMin;
      if (b.x > b.arenaMax) b.x = b.arenaMax;
      // Gugur bertahap: arwah naik tiap 0.12 dtk (visual saja).
      b.deathFxT -= dt;
      if (b.deathFxT <= 0) { b.deathFxT = 0.12; kingDeathEmber(b, 'lich'); }
      if (b.deathT >= 1.0 && !b.dead) {
        b.dead = true;
        onBossDefeated();
      }
      return;
    }

    if (b.state === 'hurt') {
      b.hurtT += dt;
      applyGravity(b, dt);
      moveAndCollide(b, dt, Level.platforms);
      if (b.hurtT >= 0.25) { b.state = 'idle'; b.idleT = 0; }
      return; // M1: cegah integrasi ganda
    } else if (b.state === 'idle') {
      b.vx = 0;
      b.idleT += dt;
      b.dir = px >= bx ? 1 : -1;
      if (b.idleT >= 0.5 && b.cooldown <= 0 && lichSeesPlayer(b)) {
        // Rotasi pola adil; summon dilewati bila pasukan penuh.
        for (var k = 0; k < 3; k++) {
          var cand = ['strike', 'bolt', 'summon'][(b.patIdx + k) % 3];
          if (cand === 'summon' && (b.phase < 2 || liveSwords() >= 2)) continue;
          if (cand === 'bolt' && b.phase < 2 && b.patIdx % 2 === 1) continue;
          b.pattern = cand;
          break;
        }
        b.patIdx++;
        b.teleDur = 0.5 + (b.pattern === 'bolt' ? 0.1 : 0);
        b.teleT = 0;
        b.state = 'telegraph';
        AudioManager.play('bossAttack');
      }
    } else if (b.state === 'telegraph') {
      b.vx = 0;
      b.teleT += dt;
      b.dir = px >= bx ? 1 : -1;
      if (b.teleT >= b.teleDur) {
        b.state = b.pattern;
        b.atkT = 0;
        b.struckPlayer = false;
        if (b.pattern === 'bolt') {
          spawnShot(b.x + b.w / 2 - 8, b.y + 20, b.dir, 'bolt');
          AudioManager.play('lichMagic');
        } else if (b.pattern === 'summon') {
          var sx = clamp(b.x + (b.dir * 90), b.arenaMin, b.arenaMax - 40);
          var added = createSlime({ type: 'skeletonSword', x: sx, y: b.y, minX: b.arenaMin, maxX: b.arenaMax });
          enemies.push(added);
          burst(sx + 20, b.y + 20, 10, '#b46ae0', 150, 0.6, 4, 250);
          AudioManager.play('lichSummon');
        }
      }
    } else if (b.state === 'strike') {
      b.atkT += dt;
      if (b.atkT < 0.2) b.vx = b.dir * 150 * spdMul;
      else b.vx = 0;
      if (b.atkT >= 0.8) {
        b.state = 'recovery'; b.recT = 0; b.recDur = 0.6;
        b.cooldown = 1.1 * cdMul;
      }
    } else if (b.state === 'bolt' || b.state === 'summon') {
      b.atkT += dt;
      b.vx = 0;
      if (b.atkT >= 0.35) {
        b.state = 'recovery'; b.recT = 0; b.recDur = 0.7;
        b.cooldown = (b.pattern === 'summon' ? 3.0 : 1.6) * cdMul;
      }
    } else if (b.state === 'recovery') {
      b.vx = 0;
      b.recT += dt;
      if (b.recT >= b.recDur) { b.state = 'idle'; b.idleT = 0; }
    }

    applyGravity(b, dt);
    moveAndCollide(b, dt, Level.platforms);
    if (b.x < b.arenaMin) { b.x = b.arenaMin; b.vx = 0; }
    if (b.x > b.arenaMax) { b.x = b.arenaMax; b.vx = 0; }
    // NOTE: cek jurang ada di atas (dormant return lebih awal).
  }

  function drawLich() {
    var b = boss;
    if (!b || b.kind !== 'lich' || b.dead) return;
    var t = b.animTime;
    var dw = 64, dh = 80;
    // Gugur bertahap: topple + ambruk + fade akhir (durasi 1.0 dtk utuh).
    var lTopple = 0, lFade = 1;
    if (b.state === 'death') {
      var k = clamp(1 - b.deathT / 1.0, 0, 1);
      dh = Math.round(dh * (0.3 + 0.7 * k));
      lTopple = Math.round(Math.min(8, b.deathT * 20)) * (b.dir === 1 ? 1 : -1);
      if (b.deathT > 0.7) lFade = clamp((1.0 - b.deathT) / 0.3, 0, 1);
    }
    var dx = Math.round(b.x + b.w / 2 - dw / 2) + lTopple;
    var dy = Math.round(b.y + b.h - dh);
    var tele = b.state === 'telegraph';
    var blink = (b.iframes > 0 && Math.floor(t * 16) % 2 === 0) ||
                (tele && Math.floor(t * 10) % 2 === 0);

    if (lFade < 1) { ctx.save(); ctx.globalAlpha = lFade; }

    // Aura undead (berdenyut, makin merah saat enrage).
    var pulse = 0.5 + 0.5 * Math.sin(t * (b.phase >= 3 ? 9 : 4));
    ctx.fillStyle = b.phase >= 3
      ? 'rgba(224,82,82,' + (0.18 + 0.12 * pulse).toFixed(2) + ')'
      : 'rgba(150,90,220,' + (0.12 + 0.10 * pulse).toFixed(2) + ')';
    ctx.fillRect(dx - 6, dy - 6, dw + 12, dh + 12);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(b.x + 6), Math.round(b.y + b.h - 3), b.w - 12, 5);

    // Sprite Raja Lich: cast (telegraph/bolt/summon) vs strike realistis.
    var lfr = bossFrameFor('lich', b.state);
    var limg = lfr[0] ? foeImg(sprites[lfr[0]], lfr[1]) : null;
    if (limg) {
      drawFoeSprite(limg, dx, dy, dw, dh, b.dir, blink);
      // Kilau orb saat cast + swoosh staff saat strike.
      if (b.state === 'telegraph' || b.state === 'bolt' || b.state === 'summon') {
        ctx.fillStyle = 'rgba(205,130,255,' + (0.25 + 0.2 * pulse).toFixed(2) + ')';
        var ox = b.dir === 1 ? dx + dw - 16 : dx + 6;
        ctx.fillRect(ox, dy - 2, 12, 12);
      }
      if (b.state === 'strike' && b.atkT < 0.3) {
        ctx.fillStyle = 'rgba(232,201,255,0.5)';
        var sx2 = b.dir === 1 ? dx + dw - 18 : dx + 8;
        ctx.fillRect(sx2, Math.round(dy + dh / 2 - 12), 10, 24);
      }
    } else {
    // Jubah + torso.
    ctx.fillStyle = blink ? '#ffffff' : '#2c2140';
    ctx.fillRect(dx + 10, dy + 22, dw - 20, dh - 22);
    ctx.fillStyle = blink ? '#ffffff' : '#4a3670';
    ctx.fillRect(dx + 14, dy + 26, dw - 28, dh - 34);
    // Helm bertanduk + mahkota.
    ctx.fillStyle = '#c9cfdd';
    ctx.fillRect(dx + 18, dy + 4, dw - 36, 14);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(dx + 14, dy - 4, 8, 8);
    ctx.fillRect(dx + dw / 2 - 4, dy - 8, 8, 12);
    ctx.fillRect(dx + dw - 22, dy - 4, 8, 8);
    // Mata ungu menyala.
    var ex = b.dir === 1 ? dx + dw - 28 : dx + 16;
    ctx.fillStyle = '#b46ae0';
    ctx.fillRect(ex, dy + 8, 6, 6);
    ctx.fillRect(ex + 8, dy + 8, 6, 6);
    // Staff di sisi hadap (terangkat saat telegraph).
    var stx = b.dir === 1 ? dx + dw - 8 : dx + 1;
    ctx.fillStyle = '#5a4a6b';
    ctx.fillRect(stx, tele ? dy - 14 : dy + 6, 5, 44);
    ctx.fillStyle = tele ? '#e8c9ff' : '#b46ae0';
    ctx.fillRect(stx - 3, tele ? dy - 20 : dy, 11, 11);
    } // end fallback prosedural
    if (tele) {
      ctx.fillStyle = '#ffd23f';
      var qx = Math.round(b.x + b.w / 2 - 3);
      ctx.fillRect(qx, dy - 34, 7, 15);
      ctx.fillRect(qx, dy - 15, 7, 7);
    }
    if (lFade < 1) ctx.restore();
  }

  /* ---- Collectible Coin level (non-colliding, hanya overlap) ----
   * Identitas: COIN. Satu-satunya sumber currency coin (totalCoins += 1
   * per pickup, tepat sekali). Jumlah/placement/collision/pickup/animation/
   * particle sama seperti dulu; yang berubah hanya identitas + SFX coin. */
  function resetCoins() {
    coins = Level.coins.map(function (p) {
      return { x: p.x, y: p.y, taken: false, bob: Math.random() * 6 };
    });
  }

  function coinGot() {
    var n = 0;
    for (var i = 0; i < coins.length; i++) if (coins[i].taken) n++;
    return n;
  }

  function updateCoins(dt) {
    for (var i = 0; i < coins.length; i++) {
      var s = coins[i];
      if (s.taken) continue;
      s.bob += dt;
      if (player.state === 'death') continue;
      setR(_r1, s.x - 13, s.y - 13, 26, 26);
      setR(_r2, player.x, player.y, player.w, player.h);
      if (rectsOverlap(_r1, _r2)) {
        s.taken = true;
        runStats.coins++;
        levelStats.coins++;
        // Persistent: total coin lintas sesi (event, bukan per-frame; clamp
        // konsisten dengan reward treasure agar tak pernah overflow/NaN).
        save.totalCoins = Math.min(1e9, Math.floor(saveNum(save.totalCoins, 0, 0, 1e9)) + 1);
        persistSave();
        burst(s.x, s.y, 8, '#ffd23f', 140, 0.5, 3, 250);
        AudioManager.play('coin');
      }
    }
  }

  /* ---- Treasure Chest (non-colliding, overlap untuk membuka) ----
   * State: closed -> opening (0.45 dtk) -> opened (sekali, anti duplikat).
   * Reward data-driven via TREASURE_REWARDS, terpisah dari coin level.
   * Treasure TIDAK menambah coin — hanya goldShard/health/poison. */
  var TREASURE_REWARDS = {
    goldShard: { type: 'goldShard', amount: 1, visual: 0, sound: 'shard' },
    health: { type: 'health', heal: 30, visual: 1, sound: 'heal' },
    poison: { type: 'poison', dmg: 15, visual: 2, sound: 'poison' }
  };
  var TREASURE_W = 44, TREASURE_H = 36, TREASURE_OPEN_T = 0.45;
  var chests = [];

  function resetChests() {
    var list = Level.treasures || [];
    chests = list.map(function (p) {
      return { x: p.x, y: p.y, w: TREASURE_W, h: TREASURE_H,
        state: 'closed', openT: 0, reward: null, iconT: 0,
        bob: Math.random() * 6 };
    });
  }

  function chestOpenedCount() {
    var n = 0;
    for (var i = 0; i < chests.length; i++) {
      if (chests[i].state === 'opened') n++;
    }
    return n;
  }

  // Random aman: selalu salah satu dari goldShard/health/poison, tanpa NaN.
  function pickTreasureReward() {
    var r = Math.random();
    if (!(r >= 0) || r >= 1) r = 0.5; // guard ekstrem
    if (r < 0.5) return TREASURE_REWARDS.goldShard;
    if (r < 0.8) return TREASURE_REWARDS.health;
    return TREASURE_REWARDS.poison;
  }

  function applyTreasureReward(c) {
    var rw = c.reward;
    if (!rw) return;
    var cx = c.x + c.w / 2, cy = c.y;
    if (rw.type === 'goldShard') {
      // Gold Shard treasure: resource sendiri (+1, tepat sekali).
      // Tidak masuk counter coin level, tidak menambah totalCoins.
      runStats.goldShards = (runStats.goldShards || 0) + rw.amount;
      save.totalGoldShards = Math.floor(saveNum(save.totalGoldShards, 0, 0, 1e9)) + rw.amount;
      persistSave();
      burst(cx, cy, 8, '#ffe98a', 140, 0.5, 3, 250);
      AudioManager.play('shard');
    } else if (rw.type === 'health') {
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + rw.heal);
      burst(cx, cy, 8, '#5ec46f', 130, 0.5, 3, 250);
      AudioManager.play('heal');
    } else if (rw.type === 'poison') {
      // Buruk tetapi aman: tidak pernah membunuh (min 1), tanpa state rusak.
      player.hp = Math.max(1, player.hp - rw.dmg);
      burst(cx, cy, 8, '#965ac9', 130, 0.5, 3, 250);
      AudioManager.play('poison');
    }
  }

  function updateChests(dt) {
    var frozen = player.state === 'death' || victoryArmed;
    for (var i = 0; i < chests.length; i++) {
      var c = chests[i];
      c.bob += dt;
      if (c.state === 'opened') {
        c.iconT += dt;
        continue;
      }
      if (c.state === 'opening') {
        // Beku saat player mati/victory: reward tak bocor di luar gameplay.
        if (frozen) continue;
        c.openT += dt;
        if (c.openT >= TREASURE_OPEN_T) {
          c.state = 'opened';
          c.iconT = 0;
          c.reward = pickTreasureReward();
          applyTreasureReward(c);
          burst(c.x + c.w / 2, c.y, 10, '#ffffff', 150, 0.5, 3, 250);
        }
        continue;
      }
      // closed: hanya serangan yang membuka (lihat resolvePlayerAttack).
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
      version: 5,
      bestTime: null, bestL1: null, bestL2: null,
      bestL3: null, bestL4: null, bestL5: null, bestCoins: 0,
      totalCoins: 0, totalGoldShards: 0, totalDeaths: 0,
      level1Completed: false, level2Completed: false,
      level3Completed: false, level4Completed: false, level5Completed: false,
      gameCompleted: false,
      level2Unlocked: false, level3Unlocked: false,
      level4Unlocked: false, level5Unlocked: false,
      sfxEnabled: true, sfxVolume: 100,
      musicEnabled: true, musicVolume: 70,
      inputPreference: 'auto',
      // Weapon Shop (v4): starter owned, agar game tetap playable
      // tanpa membeli apa pun.
      owned: { rusty: true, buckler: true, makeshift: true },
      eqSword: 'rusty', eqShield: 'buckler', eqBow: 'makeshift',
      mode: 'SWORD',
      difficulty: 'normal',
      achievements: {
        first_blood: false,
        first_clear: false,
        boss_slayer: false,
        king_slayer: false,
        collector: false,
        no_death_clear: false,
        speed_runner: false,
        master_of_sword: false,
        master_of_guardian: false,
        master_of_archer: false,
        hard_clear: false,
        campaign_complete: false
      },
      hardProgress: {
        level1Completed: false, level2Completed: false, level3Completed: false, level4Completed: false, level5Completed: false,
        gameCompleted: false,
        level2Unlocked: false, level3Unlocked: false, level4Unlocked: false, level5Unlocked: false,
        bestTime: null, bestL1: null, bestL2: null, bestL3: null, bestL4: null, bestL5: null,
        bestCoins: 0
      },
      skills: {
        unlocked: { dashSlash: false, shieldBash: false, multiShot: false, sharpEdge: false, comboMaster: false, fortifiedGuard: false, sturdy: false, quickDraw: false, piercingArrow: false },
        active: null,
        passives: []
      }
    };
  }

  function saveNum(v, dflt, lo, hi) {
    var n = Number(v);
    if (!isFinite(n)) return dflt;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  // Validasi schema: rusak / versi tak dikenal -> default penuh.
  // Migrasi aman: save v1/v2 lama tetap valid (semantic swap coin/shard).
  // Aturan migrasi v1/v2 -> v3 (tanpa kehilangan progres):
  // - totalCoins lama (treasure coin) TETAP coin — jangan dianggap gold shard.
  // - totalShards lama (level gold shard = coin di identitas baru) digabung
  //   ke totalCoins baru (keduanya kini currency coin yang sama).
  // - bestShards lama -> bestCoins baru (posisi/count run sama).
  // - totalGoldShards baru mulai 0 (resource treasure baru, tanpa histori).
  // Migrasi v1/v2/v3 -> v4: progres + settings + coins utuh; shop diisi
  // default starter (tanpa menebak pembelian lama).
  function sanitizeSave(o) {
    var d = getDefaultSave();
    if (!o || typeof o !== 'object' || (o.version !== 1 && o.version !== 2 && o.version !== 3 && o.version !== 4 && o.version !== 5)) return d;
    d.bestTime = (o.bestTime == null) ? null : saveNum(o.bestTime, null, 0, 1e9);
    d.bestL1 = (o.bestL1 == null) ? null : saveNum(o.bestL1, null, 0, 1e9);
    d.bestL2 = (o.bestL2 == null) ? null : saveNum(o.bestL2, null, 0, 1e9);
    d.bestL3 = (o.bestL3 == null) ? null : saveNum(o.bestL3, null, 0, 1e9);
    d.bestL4 = (o.bestL4 == null) ? null : saveNum(o.bestL4, null, 0, 1e9);
    d.bestL5 = (o.bestL5 == null) ? null : saveNum(o.bestL5, null, 0, 1e9);
    // Preserve achievement/difficulty/hard progress for v5 (and v4 if present)
    d.difficulty = (o.difficulty === 'hard') ? 'hard' : 'normal';
    d.skills = (o.skills && typeof o.skills === 'object') ? o.skills : {
      unlocked: { dashSlash: false, shieldBash: false, multiShot: false, sharpEdge: false, comboMaster: false, fortifiedGuard: false, sturdy: false, quickDraw: false, piercingArrow: false },
      active: null, passives: []
    };
    d.achievements = (o.achievements && typeof o.achievements === 'object') ? o.achievements : {
      first_blood: false, first_clear: false, boss_slayer: false, king_slayer: false,
      collector: false, no_death_clear: false, speed_runner: false,
      master_of_sword: false, master_of_guardian: false, master_of_archer: false,
    hard_clear: false, campaign_complete: false,
    skill_apprentice: false, skill_master: false, ability_expert: false, triple_master: false
  };
    // Fill missing achievement keys (data-driven extension safe)
    var defAch = { first_blood: false, first_clear: false, boss_slayer: false, king_slayer: false,
      collector: false, no_death_clear: false, speed_runner: false,
      master_of_sword: false, master_of_guardian: false, master_of_archer: false,
      hard_clear: false, campaign_complete: false };
    for (var _ak in defAch) { if (d.achievements[_ak] === undefined) d.achievements[_ak] = defAch[_ak]; }
    d.hardProgress = (o.hardProgress && typeof o.hardProgress === 'object') ? o.hardProgress : {
      level1Completed: false, level2Completed: false, level3Completed: false, level4Completed: false, level5Completed: false,
      gameCompleted: false, level2Unlocked: false, level3Unlocked: false, level4Unlocked: false, level5Unlocked: false,
      bestTime: null, bestL1: null, bestL2: null, bestL3: null, bestL4: null, bestL5: null, bestCoins: 0
    };
    // bestCoins: v3 langsung; v1/v2 fallback ke bestShards legacy.
    var legacyBest = Math.floor(saveNum(o.bestShards, 0, 0, 1e9));
    d.bestCoins = Math.floor(saveNum((o.bestCoins == null ? legacyBest : o.bestCoins), 0, 0, 1e9));
    // totalCoins: v3/v4 langsung; v1/v2 = treasure-coin lama + shard lama.
    var legacyCoins = Math.floor(saveNum(o.totalCoins, 0, 0, 1e9));
    var legacyShards = Math.floor(saveNum(o.totalShards, 0, 0, 1e9));
    if (o.version === 3 || o.version === 4 || o.version === 5) {
      d.totalCoins = legacyCoins;
    } else {
      d.totalCoins = Math.min(1e9, legacyCoins + legacyShards);
    }
    d.totalGoldShards = Math.floor(saveNum(o.totalGoldShards, 0, 0, 1e9));
    d.totalDeaths = Math.floor(saveNum(o.totalDeaths, 0, 0, 1e9));
    d.level1Completed = !!o.level1Completed;
    d.level2Completed = !!o.level2Completed;
    d.level3Completed = !!o.level3Completed;
    d.level4Completed = !!o.level4Completed;
    d.level5Completed = !!o.level5Completed;
    d.gameCompleted = !!o.gameCompleted;
    d.level2Unlocked = !!o.level2Unlocked;
    d.level3Unlocked = !!o.level3Unlocked;
    d.level4Unlocked = !!o.level4Unlocked;
    d.level5Unlocked = !!o.level5Unlocked;
    // Konsistensi turunan: completed mengimplikasikan unlock berikutnya.
    if (d.level1Completed) d.level2Unlocked = true;
    if (d.level2Completed) d.level3Unlocked = true;
    if (d.level3Completed) d.level4Unlocked = true;
    if (d.level4Completed) d.level5Unlocked = true;
    // M5: migrasi audio aman — field hilang berarti ON (bukan mute).
    // "false" hanya jika explicitly saved false (pola !== false).
    d.sfxEnabled = (o.sfxEnabled !== false);
    d.sfxVolume = Math.round(saveNum(o.sfxVolume, 100, 0, 100));
    d.musicEnabled = (o.musicEnabled !== false);
    d.musicVolume = Math.round(saveNum(o.musicVolume, 70, 0, 100));
    d.inputPreference = (o.inputPreference === 'keyboard' || o.inputPreference === 'touch')
      ? o.inputPreference : 'auto';
    // Shop v4: validasi id terhadap SHOP_ITEMS (unknown -> default starter).
    // v1/v2/v3 tidak punya shop -> default starter (progres lain utuh).
    d.owned = { rusty: true, buckler: true, makeshift: true };
    if ((o.version === 4 || o.version === 5) && o.owned && typeof o.owned === 'object') {
      for (var _ok = 0; _ok < SHOP_ITEMS.length; _ok++) {
        var _it = SHOP_ITEMS[_ok];
        if (o.owned[_it.id]) d.owned[_it.id] = true;
      }
    }
    d.eqSword = ((o.version === 4 || o.version === 5) && shopItemById(o.eqSword) && shopItemById(o.eqSword).category === 'sword' && d.owned[o.eqSword])
      ? o.eqSword : 'rusty';
    d.eqShield = ((o.version === 4 || o.version === 5) && shopItemById(o.eqShield) && shopItemById(o.eqShield).category === 'shield' && d.owned[o.eqShield])
      ? o.eqShield : 'buckler';
    d.eqBow = ((o.version === 4 || o.version === 5) && shopItemById(o.eqBow) && shopItemById(o.eqBow).category === 'bow' && d.owned[o.eqBow])
      ? o.eqBow : 'makeshift';
    d.mode = ((o.version === 4 || o.version === 5) && (o.mode === 'GUARDIAN' || o.mode === 'ARCHER' || o.mode === 'SWORD'))
      ? o.mode : 'SWORD';
    // Konsistensi mode: ARCHER butuh bow owned; GUARDIAN butuh sword+shield.
    if (d.mode === 'ARCHER' && !d.owned[d.eqBow]) d.mode = 'SWORD';
    if (d.mode === 'GUARDIAN' && (!d.owned[d.eqSword] || !d.owned[d.eqShield])) d.mode = 'SWORD';
    // Migrasi v4 -> v5 (achievements + difficulty + hard progress)
    if (o.version !== 5) {
      d.achievements = (o.achievements && typeof o.achievements === 'object') ? o.achievements : {
        first_blood: false, first_clear: false, boss_slayer: false, king_slayer: false,
        collector: false, no_death_clear: false, speed_runner: false,
        master_of_sword: false, master_of_guardian: false, master_of_archer: false,
        hard_clear: false, campaign_complete: false
      };
      // If old save had achievements partially missing, fill defaults
      var achDefs = d.achievements;
      var defAch = {
        first_blood: false, first_clear: false, boss_slayer: false, king_slayer: false,
        collector: false, no_death_clear: false, speed_runner: false,
        master_of_sword: false, master_of_guardian: false, master_of_archer: false,
        hard_clear: false, campaign_complete: false
      };
      for (var ak in defAch) {
        if (achDefs[ak] === undefined) achDefs[ak] = defAch[ak];
      }
      d.difficulty = (o.difficulty === 'hard') ? 'hard' : 'normal';
    d.skills = (o.skills && typeof o.skills === 'object') ? o.skills : {
      unlocked: { dashSlash: false, shieldBash: false, multiShot: false, sharpEdge: false, comboMaster: false, fortifiedGuard: false, sturdy: false, quickDraw: false, piercingArrow: false },
      active: null, passives: []
    };
      d.hardProgress = (o.hardProgress && typeof o.hardProgress === 'object') ? o.hardProgress : {
        level1Completed: false, level2Completed: false, level3Completed: false, level4Completed: false, level5Completed: false,
        gameCompleted: false, level2Unlocked: false, level3Unlocked: false, level4Unlocked: false, level5Unlocked: false,
        bestTime: null, bestL1: null, bestL2: null, bestL3: null, bestL4: null, bestL5: null, bestCoins: 0
      };
      // Derive hard unlock from normal completion (safe rule)
      if (d.gameCompleted || d.level5Completed) {
        d.hardProgress.level2Unlocked = true; d.hardProgress.level3Unlocked = true; d.hardProgress.level4Unlocked = true; d.hardProgress.level5Unlocked = true;
      } else if (d.level4Completed) { d.hardProgress.level5Unlocked = true; }
      else if (d.level3Completed) { d.hardProgress.level4Unlocked = true; }
      else if (d.level2Completed) { d.hardProgress.level3Unlocked = true; }
      else if (d.level1Completed) { d.hardProgress.level2Unlocked = true; }
    }
    // Set version to 5
    d.version = 5;
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
    refreshShopUI();
  }



  /* ===== Achievement System ===== */
  var ACHIEVEMENT_DEFS = {
    first_blood: { name: 'First Blood', desc: 'Defeat your first enemy', progress: null },
    first_clear: { name: 'First Clear', desc: 'Complete the first level', progress: null },
    boss_slayer: { name: 'Boss Slayer', desc: 'Defeat the first boss', progress: null },
    king_slayer: { name: 'King Slayer', desc: 'Defeat the final king boss', progress: null },
    collector: { name: 'Collector', desc: 'Collect 5 Gold Shards (treasures)', progress: function () { return save.totalGoldShards; }, target: 5 },
    no_death_clear: { name: 'No Death Clear', desc: 'Complete a level without dying', progress: null },
    speed_runner: { name: 'Speed Runner', desc: 'Complete Level 1 under 45 seconds', progress: function () { return save.bestL1; }, target: 45 },
    master_of_sword: { name: 'Sword Master', desc: 'Complete campaign in Sword mode', progress: null },
    master_of_guardian: { name: 'Guardian Master', desc: 'Complete campaign in Guardian mode', progress: null },
    master_of_archer: { name: 'Archer Master', desc: 'Complete campaign in Archer mode', progress: null },
    hard_clear: { name: 'Hard Clear', desc: 'Complete a stage in Hard Mode', progress: null },
    campaign_complete: { name: 'Campaign Complete', desc: 'Complete entire Normal campaign', progress: null },
    skill_apprentice: { name: 'Skill Apprentice', desc: 'Unlock your first skill', progress: null },
    skill_master: { name: 'Skill Master', desc: 'Unlock all active skills', progress: null },
    ability_expert: { name: 'Ability Expert', desc: 'Unlock a complete skill setup for one mode', progress: null },
    triple_master: { name: 'Triple Master', desc: 'Unlock skill progression for Sword, Guardian, Archer', progress: null }
  };

  function unlockAchievement(id) {
    if (!id || !save || !save.achievements) return false;
    if (save.achievements[id] === true) return false; // already unlocked
    save.achievements[id] = true;
    persistSave();
    triggerAchieveToast(id);
    try { AudioManager.play('achievement'); } catch (e) { /* abaikan */ }
    return true;
  }

  var _achToastTimer = null;
  function triggerAchieveToast(id) {
    var def = ACHIEVEMENT_DEFS[id];
    if (!def) return;
    var toast = document.getElementById('achieve-toast');
    var text = document.getElementById('achieve-toast-text');
    if (toast && text) {
      text.textContent = def.name;
      toast.classList.remove('hidden');
      if (_achToastTimer) clearTimeout(_achToastTimer);
      _achToastTimer = setTimeout(function () { try { toast.classList.add('hidden'); } catch (e) {} }, 3200);
    }
  }

  function getUnlockedCount() {
    var c = 0;
    if (!save || !save.achievements) return 0;
    for (var k in save.achievements) { if (save.achievements[k] === true) c++; }
    return c;
  }

  function refreshAchievementsUI() {
    var list = document.getElementById('achieve-list');
    var counter = document.getElementById('achieve-counter');
    if (!list) { console.log('missing achieve-list'); return; }
    list.innerHTML = '';
    var total = 0, unlocked = 0;
    if (typeof ACHIEVEMENT_DEFS === 'undefined') { console.log('ACHIEVEMENT_DEFS missing'); }
    for (var k in ACHIEVEMENT_DEFS) total++;
    try {
      for (var k2 in (save && save.achievements ? save.achievements : {})) if (save.achievements[k2] === true) unlocked++;
    } catch (e) {}
    if (counter) counter.textContent = 'Unlocked: ' + unlocked + ' / ' + total;
    for (var key in ACHIEVEMENT_DEFS) {
      try {
        var def = ACHIEVEMENT_DEFS[key];
        var unlockedFlag = !!(save && save.achievements && save.achievements[key]);
        var item = document.createElement('div');
        item.className = 'achieve-item ' + (unlockedFlag ? 'unlocked' : 'locked');
        var prog = '';
        if (def.progress) {
          try { var val = def.progress(); if (val != null && def.target && val < def.target) prog = ' (' + val + ' / ' + def.target + ')'; } catch (e2) {}
        }
        item.innerHTML = '<h4>' + (unlockedFlag ? '✓ ' : '☐ ') + (def.name || key) + '</h4><p>' + (def.desc || '') + (prog ? '<br><small>Progress: ' + prog + '</small>' : '') + '</p>';
        list.appendChild(item);
      } catch (e3) { /* abaikan item error */ }
    }
    if (list.children.length === 0) {
      list.innerHTML = '<div style="color:#aaa;font-size:13px">Achievement list empty — save may need refresh or reload.</div>';
    }
  }

  /* Check achievements after relevant events */
  function checkAchievements(levelComplete, levelN, died, timeTaken, bossKilled, kingKilled) {
    if (!save) return;
    // First Blood: killed first enemy (global kill count during level)
    if (!save.achievements.first_blood && (save.totalDeaths !== undefined || levelStats && levelStats.kills > 0)) {
      // We approximate by checking if levelStats.kills > 0 and not yet unlocked; triggered elsewhere more precisely
    }
    // First Clear
    if (levelN === 1 && levelComplete && !save.achievements.first_clear) unlockAchievement('first_clear');
    // Boss Slayer: first boss killed (approx: level 2 completed or boss event)
    if (levelComplete && levelN >= 2 && !save.achievements.boss_slayer) unlockAchievement('boss_slayer');
    // King Slayer: level 5 complete
    if (levelComplete && levelN === 5 && !save.achievements.king_slayer) unlockAchievement('king_slayer');
    // No Death Clear: completed level without death increment since start
    if (levelComplete && !died && !save.achievements.no_death_clear) unlockAchievement('no_death_clear');
    // Speed Runner: bestL1 <= 45
    if (!save.achievements.speed_runner && save.bestL1 != null && save.bestL1 <= 45) unlockAchievement('speed_runner');
    // Collector: totalGoldShards >= 5
    if (!save.achievements.collector && save.totalGoldShards >= 5) unlockAchievement('collector');
    // Hard Clear: hard progress completed any level
    if (save.difficulty === 'hard' && levelComplete && !save.achievements.hard_clear) unlockAchievement('hard_clear');
    // Campaign Complete: normal gameCompleted
    if (save.gameCompleted && !save.achievements.campaign_complete) unlockAchievement('campaign_complete');
    // Master mode achievements: when gameCompleted and mode matches
    if (save.gameCompleted && !save.achievements.master_of_sword && save.mode === 'SWORD') unlockAchievement('master_of_sword');
    if (save.gameCompleted && !save.achievements.master_of_guardian && save.mode === 'GUARDIAN') unlockAchievement('master_of_guardian');
    if (save.gameCompleted && !save.achievements.master_of_archer && save.mode === 'ARCHER') unlockAchievement('master_of_archer');
  }


  /* Skill Activation */
  function activateActiveSkill() {
    if (!save || !save.skills) return false;
    var mode = save.mode || 'SWORD';
    var skillId = save.skills.active;
    if (!skillId) return false;
    var def = SKILLS[skillId];
    if (!def || def.mode !== mode || def.type !== 'active') return false;
    if (def.unlocked === false) return false;
    // Check save unlocked state
    var unlocked = (save.skills.unlocked && save.skills.unlocked[skillId] === true);
    if (!unlocked) return false;
    // Energy check
    var cost = def.energyCost || 0;
    if (skillEnergy < cost) return false;
    // Cooldown check
    var nowT = Date.now ? Date.now() : 0; // use time-based or loop-based; simple loop-based below
    // Use simple cooldown tracking via global skillCooldowns
    var cd = skillCooldowns[skillId] || 0;
    if (cd > 0) return false;
    // Consume energy
    skillEnergy = Math.max(0, skillEnergy - cost);
    // Apply cooldown
    skillCooldowns[skillId] = def.cooldown || 5;
    // Activation effect (simple)
    if (skillId === 'dashSlash') {
      // Brief dash + damage boost (simulated via player velocity and state)
      try { player.vx = (player.dir || 1) * 300; player.state = 'run'; } catch (e) {}
    } else if (skillId === 'shieldBash') {
      try { applySwordEffect(null, null, miniboss || boss); } catch (e) {}
    } else if (skillId === 'multiShot') {
      // Fire extra projectile (simulated via existing playerShots)
      try { playerShots.push({ x: player.x + 40, y: player.y + 20, vx: 400, vy: 0, kind: 'arrow' }); } catch (e) {}
    }
    return true;
  }

  function updateSkillCooldowns(dt) {
    for (var k in skillCooldowns) {
      if (skillCooldowns[k] > 0) skillCooldowns[k] = Math.max(0, skillCooldowns[k] - dt);
    }
    // Energy recovery
    skillEnergy = Math.min(100, skillEnergy + 8 * dt);
  }

  function unlockSkill(id) {
    if (!save || !save.skills || !save.skills.unlocked) return false;
    if (save.skills.unlocked[id] === true) return false;
    save.skills.unlocked[id] = true;
    persistSave();
    try { AudioManager.play('click'); } catch (e) {}
    if (save.achievements && !save.achievements.skill_apprentice) unlockAchievement('skill_apprentice');
    return true;
  }

  function applyAudioSettings() {
    try {
      AudioManager.setSfx(save.sfxEnabled, save.sfxVolume);
      AudioManager.setMusic(save.musicEnabled, save.musicVolume);
    } catch (e) { /* abaikan */ }
  }

  // Campaign L1->L2->L3->L4->L5->COMPLETE (gate per level).
  function canPlayLevel(n) {
    n = Math.floor(Number(n));
    if (!(n >= 1)) return false;
    if (n <= 1) return true;
    if (n === 2) return !!save.level2Unlocked;
    if (n === 3) return !!save.level3Unlocked;
    if (n === 4) return !!save.level4Unlocked;
    if (n === 5) return !!save.level5Unlocked;
    return false;
  }

  // Kompatibilitas baca best lama (bentuk {time, coins} seperti dulu).
  function loadBest() {
    return { time: save.bestTime, coins: save.bestCoins };
  }

  /* ---- SHOP LOGIC (atomic, data-driven, event-persist) ----
   * buy: cek owned -> cek saldo -> kurangi sekali -> tandai owned -> save.
   * Tidak pernah Coin negatif; duplicate purchase tidak mengurangi lagi. */
  function isOwned(id) {
    try { return !!(save.owned && save.owned[id]); }
    catch (e) { return false; }
  }
  function shopBalance() {
    var n = Math.floor(Number(save.totalCoins));
    return (isFinite(n) && n > 0) ? n : 0;
  }
  function buyItem(id) {
    var it = shopItemById(id);
    if (!it) return { ok: false, reason: 'unknown' };
    if (isOwned(id)) return { ok: false, reason: 'owned' };
    var bal = shopBalance();
    if (bal < it.price) return { ok: false, reason: 'coins' };
    save.totalCoins = bal - it.price; // atomik: satu kali, clamp >= 0
    if (!save.owned || typeof save.owned !== 'object') save.owned = {};
    save.owned[id] = true;
    persistSave();
    refreshShopUI();
    return { ok: true };
  }
  function equipItem(id) {
    var it = shopItemById(id);
    if (!it || !isOwned(id)) return false;
    if (it.category === 'sword') {
      save.eqSword = id;
      save.mode = 'SWORD';
    } else if (it.category === 'shield') {
      save.eqShield = id;
      if (save.mode !== 'ARCHER') save.mode = 'GUARDIAN';
    } else if (it.category === 'bow') {
      save.eqBow = id;
      save.mode = 'ARCHER';
    } else return false;
    persistSave();
    refreshShopUI();
    refreshBlockBtn();
    return true;
  }
  // Mode eksplisit (tombol USE): validasi agar tak ada state mustahil.
  // ARCHER butuh bow owned; GUARDIAN butuh sword+shield; SWORD butuh sword.
  function setMode(m) {
    if (m === 'ARCHER') {
      if (!isOwned(save.eqBow)) return false;
      save.mode = 'ARCHER';
    } else if (m === 'GUARDIAN') {
      if (!isOwned(save.eqSword) || !isOwned(save.eqShield)) return false;
      save.mode = 'GUARDIAN';
    } else if (m === 'SWORD') {
      if (!isOwned(save.eqSword)) return false;
      save.mode = 'SWORD';
    } else return false;
    persistSave();
    refreshShopUI();
    refreshBlockBtn();
    return true;
  }
  function getEquipment() {
    return { sword: save.eqSword, shield: save.eqShield, bow: save.eqBow, mode: playerMode() };
  }

  /* ---- Overlay & panel ---- */
  function hideAllOverlays() {
    var els = [overlayEl, winOverlayEl, menuEl, lvlclearEl, gameclearEl,
               settingsEl, resetEl, campaignEl, pauseEl, shopEl, achievementsEl,
               document.getElementById('skills')];
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
    Input.blockHeld = false;
  }

  function resetTotals() {
    deaths = 0;
    timeElapsed = 0;
    runStats = { kills: 0, coins: 0, goldShards: 0 };
  }

  // Muat level n (1-based): tukar pointer + reset total per-level.
  // Tanpa reload browser; partikel/FX tidak bocor antar-level.
  // Reset level TIDAK menyentuh save persistent (total/rekor aman).
  // Boss dibuat sesuai bossKind: 'lich' -> RAJA LICH, selainnya RAJA SLIME.
  function spawnLevelBoss() {
    if (!Level.bossSpawn || !Level.bossArena) return null;
    if (Level.bossKind === 'lich') return createLich(Level.bossSpawn, Level.bossArena, Level.bossMods);
    return createBoss(Level.bossSpawn, Level.bossArena, Level.bossMods);
  }
  function loadLevelInternal(n) {
    if (!(n >= 1 && n <= Levels.length)) return;
    currentLevel = n;
    Level = Levels[n - 1];
    for (var i = 0; i < Level.checkpoints.length; i++) {
      Level.checkpoints[i].activated = false;
    }
    respawnPoint = { x: Level.playerSpawn.x, y: Level.playerSpawn.y };
    toast.t = 0;
    clearParticles();
    clearBonePiles(); // pile lama tak terbawa ke level baru
    clearGooPiles(); // genangan lama tak terbawa ke level baru
    pitDead.length = 0; // level baru = semua musuh hidup lagi
    resetShake();
    hitStopT = 0; // tanpa freeze basi antar level
    gateTarget = 0; gateAnim = 0; gateBounds = null; // gerbang terbuka
    player = createPlayer();
    player.x = respawnPoint.x;
    player.y = respawnPoint.y;
    player.blockStam = blockMax(); // stamina penuh tiap level
    enemies = Level.enemySpawns.map(function (sp) { return createSlime(sp); });
    boss = spawnLevelBoss();
    miniboss = Level.miniSpawn ? createMiniboss(Level.miniSpawn, Level.miniArena) : null;
    shocks = [];
    shots = [];
    playerShots = [];
    resetCoins();
    resetChests(); // level baru: semua chest tertutup
    levelStats = { kills: 0, coins: 0, time: 0 };
    victoryArmed = false;
    victoryT = 0;
    finalPhase = 'slime';
    finalT = 0;
    musicSetIdx = Level.musicSet || 0; // BGM ikut mood level, tanpa restart
    try { AudioManager.setMood(musicSetIdx); } catch (e) { /* abaikan */ }
    clearInput();
    snapCamera();
    // Copy misi sesuai level aktual (pendek, ramah HP).
    try {
      var me = document.getElementById('mission');
      if (me) me.innerHTML = (MISSION_COPY[n] || MISSION_COPY[1]) + ' • ' + ((save.difficulty === 'hard') ? 'HARD' : 'NORMAL');
    } catch (e) { /* abaikan */ }
  }

  // M4: production entry menghormati unlock. Level terkunci ditolak
  // (toast + return false) agar progression tidak bisa di-bypass.
  // Test/debug yang butuh bypass eksplisit memakai forceStartLevel().
  function startLevel(n) {
    if (!canPlayLevel(n)) {
      try { showToast('Selesaikan level sebelumnya dulu!'); } catch (e) { /* abaikan */ }
      debugLog('[game] start level ditolak (locked)', n);
      return false;
    }
    loadLevelInternal(n);
    trans.active = false; // start langsung membatalkan transisi yang jalan
    trans.phase = '';
    gameState = 'playing';
    hideAllOverlays();
    refreshBlockBtn();
    setPaused(false);
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    AudioManager.updateMusicState(); // BGM gameplay tanpa overlap
    debugLog('[game] start level', n);
    return true;
  }

  // Test-only bypass eksplisit (tidak dipakai production UI path).
  function forceStartLevel(n) {
    loadLevelInternal(n);
    trans.active = false;
    trans.phase = '';
    gameState = 'playing';
    hideAllOverlays();
    refreshBlockBtn();
    setPaused(false);
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    AudioManager.updateMusicState();
    debugLog('[game] force start level', n);
    return true;
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
    refreshBlockBtn();
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

  /* ---- 11e. CAMPAIGN SELECT (Stage 10): replay level terbuka ----
   * Panel di dalam menu (bukan state baru): L1 selalu terbuka, L2-L5 ikut
   * save unlock. Locked tidak dapat dimainkan. PLAY existing tak berubah
   * (selalu campaign dari L1). Start via select = fresh run dari level itu
   * (resetTotals) agar best-time tidak tercemar run parsial. */
  var campaignEl = null, campStatusEl = null;
  var achievementsEl = null;
  var btnCampaign = null, btnCampBack = null;
  var campBtns = [null, null, null, null, null];
  var campStats = [null, null, null, null, null];
  var LEVEL_NAMES = {
    1: 'Slime Grounds', 2: 'Slime Dominion', 3: 'Skeleton Fortress',
    4: 'Lich Domain', 5: 'Final Convergence'
  };
  var LEVEL_BEST = { 1: 'bestL1', 2: 'bestL2', 3: 'bestL3', 4: 'bestL4', 5: 'bestL5' };
  var LEVEL_DONE = { 1: 'level1Completed', 2: 'level2Completed', 3: 'level3Completed',
                     4: 'level4Completed', 5: 'level5Completed' };

  function campBestText(n) {
    var v = save[LEVEL_BEST[n]];
    return (v == null || !isFinite(v)) ? '-/-' : Number(v).toFixed(1) + 's';
  }

  function refreshCampaignUI() {
    try {
      var doneCount = 0;
      for (var n = 1; n <= 5; n++) {
        var open = canPlayLevel(n);
        var done = !!save[LEVEL_DONE[n]];
        if (done) doneCount++;
        var b = campBtns[n - 1], st = campStats[n - 1];
        if (b) b.textContent = (open ? '' : '🔒 ') + 'LEVEL ' + n + ' — ' + LEVEL_NAMES[n];
        if (st) {
          st.textContent = done ? '✓ CLEAR ' + campBestText(n)
                         : (open ? 'OPEN ' + campBestText(n) : 'LOCKED');
          st.className = 'camp-status' + (done ? ' clear' : (open ? '' : ' locked'));
        }
      }
      if (campStatusEl) campStatusEl.textContent = 'Pilihan mode: Normal / Hard • Kesulitan: ' + (save.difficulty || 'normal');
    } catch (e) { /* abaikan */ }
  }

  function openSkills() {
    try {
      hideAllOverlays();
      if (menuEl) menuEl.classList.remove('hidden');
      showMenuPanel('main');
      var sEl = document.getElementById('skills');
      if (sEl) sEl.classList.remove('hidden');
      clearInput();
      refreshSkillsUI();
    } catch (e) { /* abaikan */ }
  }
  function skillsBack() {
    toMenu();
    try { if (document.getElementById('btn-skills')) document.getElementById('btn-skills').focus({ preventScroll: true }); } catch (e) {}
  }
  function refreshSkillsUI() {
    var list = document.getElementById('skills-list');
    if (!list) return;
    list.innerHTML = '';
    var mode = (save && save.mode) ? save.mode : 'SWORD';
    for (var sid in SKILLS) {
      var s = SKILLS[sid];
      if (s.mode !== mode) continue;
      var unlocked = !!(save && save.skills && save.skills.unlocked && save.skills.unlocked[sid]);
      var equippedActive = (save && save.skills && save.skills.active === sid);
      var item = document.createElement('div');
      item.className = 'achieve-item ' + (unlocked ? 'unlocked' : 'locked');
      item.innerHTML = '<h4>' + (equippedActive ? '▶ ' : '') + s.name + '</h4><p>' + s.desc + (unlocked ? ' • Cost: ' + (s.energyCost || 0) + ' • CD: ' + (s.cooldown || 0) + 's' : ' [LOCKED]') + '</p>';
      list.appendChild(item);
    }
  }

  function openAchievements() {
    try {
      hideAllOverlays();
      if (menuEl) menuEl.classList.remove('hidden');
      showMenuPanel('main');
      var achEl = document.getElementById('achievements');
      if (achEl) achEl.classList.remove('hidden');
      clearInput();
      refreshAchievementsUI();
    } catch (e) { /* abaikan */ }
  }

  function achievementsBack() {
    toMenu();
    try { if (document.getElementById('btn-achievements')) document.getElementById('btn-achievements').focus({ preventScroll: true }); } catch (e) {}
  }

  function openCampaign() {
    if (gameState !== 'menu') return;
    hideAllOverlays();
    if (menuEl) menuEl.classList.remove('hidden');
    showMenuPanel('main');
    if (campaignEl) campaignEl.classList.remove('hidden');
    clearInput();
    refreshCampaignUI();
    // Difficulty selection state
    var hardLocked = !(save.gameCompleted || save.level5Completed);
    var hardBtn = document.getElementById('btn-diff-hard');
    var hardCard = document.getElementById('diff-hard-card');
    var hardLabel = document.getElementById('hard-lock-label');
    if (hardCard) { hardCard.classList.add('locked'); hardCard.classList.remove('locked'); hardCard.classList.add('locked'); }
    if (hardBtn) { hardBtn.classList.add('hidden'); hardBtn.disabled = true; }
    if (hardLabel) hardLabel.style.display = 'block';
    if (!hardLocked) {
      if (hardCard) { hardCard.classList.remove('locked'); }
      if (hardBtn) { hardBtn.classList.remove('hidden'); hardBtn.disabled = false; }
      if (hardLabel) hardLabel.style.display = 'none';
    }
    // Focus first available difficulty option
    var firstBtn = document.getElementById('btn-diff-normal');
    if (firstBtn && firstBtn.focus) {
      try { firstBtn.focus({ preventScroll: true }); } catch (e) {}
    }
    debugLog('[game] campaign dibuka');
  }

  function campaignBack() {
    toMenu();
    if (btnCampaign && btnCampaign.focus) {
      try { btnCampaign.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
  }

  function isCampaignOpen() {
    try { return !!(campaignEl && !campaignEl.classList.contains('hidden')); }
    catch (e) { return false; }
  }

  function playCampaignLevel(n) {
    n = Math.floor(Number(n));
    if (!(n >= 1 && n <= Levels.length)) return false;
    if (!canPlayLevel(n)) {
      showToast('Selesaikan level sebelumnya dulu!');
      AudioManager.play('click');
      return false;
    }
    // Set difficulty from menu selection if not already set; if playing from campaign menu, difficulty already set by button
    if (!save.difficulty) save.difficulty = 'normal';
    resetTotals();
    startTrans(n);
    return true;
  }

  function playCampaignLevel(n) {
    n = Math.floor(Number(n));
    if (!(n >= 1 && n <= Levels.length)) return false;
    if (!canPlayLevel(n)) {
      showToast('Selesaikan level sebelumnya dulu!');
      AudioManager.play('click');
      return false;
    }
    // Set difficulty from menu selection if not already set; if playing from campaign menu, difficulty already set by button
    if (!save.difficulty) save.difficulty = 'normal';
    resetTotals();
    startTrans(n);
    return true;
  }

  /* ---- SHOP UI (state 'shop', DOM-driven, data dari SHOP_ITEMS) ----
   * Tab kategori + item cards + tier badge (warna + label + simbol, tak
   * bergantung warna saja) + harga + deskripsi + preview karakter +
   * stat bar dari data + BUY/EQUIP/EQUIPPED + mode USE. Coin jelas.
   * NOT ENOUGH COINS tanpa pembelian. Keyboard + touch + pointer, Esc back.
   * Headless-safe: bila DOM mock tanpa appendChild, render data disimpan
   * di shopRender untuk QA tanpa crash. */
  var shopEl = null, shopCoinEl = null, shopListEl = null, shopMsgEl = null;
  var shopTabBtns = { sword: null, shield: null, bow: null };
  var shopPrevImg = null, shopPrevWeapon = null, shopPrevName = null, shopPrevTier = null;  var shopPrevPrice = null, shopPrevDesc = null, shopPrevStats = null;
  var shopPrevSpecial = null, shopPrevAction = null;
  var shopModeBtns = { SWORD: null, GUARDIAN: null, ARCHER: null };
  var btnShop = null, shopBackBtn = null;
  var shopTab = 'sword';
  var shopSel = 'rusty';
  var shopRender = { tab: 'sword', sel: 'rusty', cards: [], preview: null, balance: 0, mode: 'SWORD' };
  var SHOP_CLASS_IMG = { sword: 'assets/sprites/knight-attack.png',
    shield: 'assets/sprites/guardian-block.png', bow: 'assets/sprites/archer-aim.png' };

  function openShop() {
    if (gameState !== 'menu') return;
    gameState = 'shop';
    hideAllOverlays();
    if (shopEl) shopEl.classList.remove('hidden');
    clearInput();
    // Default tab mengikuti mode aktif (archer->bow, guardian->shield).
    try {
      var m = playerMode();
      shopTab = (m === 'ARCHER') ? 'bow' : (m === 'GUARDIAN' ? 'shield' : 'sword');
      var cur = getEquipment();
      shopSel = (shopTab === 'bow') ? cur.bow : (shopTab === 'shield' ? cur.shield : cur.sword);
    } catch (e) { /* abaikan */ }
    refreshShopUI();
    AudioManager.play('shopOpen');
    var f = shopTabBtns[shopTab] || shopBackBtn;
    if (f && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }
    debugLog('[game] shop dibuka');
  }

  function shopBack() {
    toMenu();
    if (btnShop && btnShop.focus) {
      try { btnShop.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
  }

  // Ganti tab: scroll kembali ke awal (posisi kategori sebelumnya tak terbawa).
  // Buka ulang Shop: posisi dipertahankan (tak diubah di sini).
  function shopSetTab(t) {
    if (t !== 'sword' && t !== 'shield' && t !== 'bow') return false;
    shopTab = t;
    try { if (shopListEl) shopListEl.scrollTop = 0; } catch (e) { /* abaikan */ }
    refreshShopUI();
    return true;
  }

  function isShopOpen() {
    try { return gameState === 'shop' && !!(shopEl && !shopEl.classList.contains('hidden')); }
    catch (e) { return false; }
  }

  function shopCardAction(id) {
    var it = shopItemById(id);
    if (!it) return false;
    shopSel = id;
    if (!isOwned(id)) {
      var r = buyItem(id);
      if (!r.ok) {
        if (shopMsgEl) shopMsgEl.textContent = (r.reason === 'coins') ? 'NOT ENOUGH COINS' : 'LOCKED';
        AudioManager.play('buyFail');
        refreshShopUI();
        return false;
      }
      if (shopMsgEl) shopMsgEl.textContent = 'OWNED';
      AudioManager.play('buy');
      refreshShopUI();
      return true;
    }
    // Owned -> equip (atau sudah equipped).
    var eq = getEquipment();
    var cur = it.category === 'sword' ? eq.sword : (it.category === 'shield' ? eq.shield : eq.bow);
    if (cur === id) {
      if (shopMsgEl) shopMsgEl.textContent = 'EQUIPPED';
      refreshShopUI();
      return true;
    }
    if (equipItem(id)) {
      if (shopMsgEl) shopMsgEl.textContent = 'EQUIPPED';
      AudioManager.play('equip');
    }
    refreshShopUI();
    return true;
  }

  function shopStatBars(it) {
    // Semua indikator dari data item (bukan palsu). Normalisasi per kategori.
    var bars = [];
    if (it.category === 'sword') {
      bars.push(['Damage', it.damage, 22]);
      bars.push(['Attack Speed', Math.round(it.attackSpeed * 100) / 100, 1.3]);
      bars.push(['Range', it.range, 12]);
      bars.push(['Defense', 0, 1]);
    } else if (it.category === 'shield') {
      bars.push(['Damage', 0, 22]);
      bars.push(['Defense', Math.round(it.defense * 100) / 100, 0.9]);
      bars.push(['Attack Speed', 1, 1.3]);
      bars.push(['Range', 0, 12]);
    } else {
      bars.push(['Damage', it.damage, 22]);
      bars.push(['Defense', 0, 1]);
      bars.push(['Attack Speed', Math.round(it.attackSpeed * 100) / 100, 1.3]);
      bars.push(['Range', it.range, 540]);
    }
    return bars;
  }

  function refreshShopUI() {
    var items = shopItemsByCategory(shopTab);
    if (!shopItemById(shopSel) || shopItemById(shopSel).category !== shopTab) {
      var eq0 = null;
      try { eq0 = getEquipment(); } catch (e) { eq0 = null; }
      if (eq0) shopSel = shopTab === 'bow' ? eq0.bow : (shopTab === 'shield' ? eq0.shield : eq0.sword);
      else shopSel = items.length ? items[0].id : null;
    }
    var bal = 0;
    try { bal = shopBalance(); } catch (e) { bal = 0; }
    var mode = 'SWORD';
    try { mode = playerMode(); } catch (e) { mode = 'SWORD'; }
    // Snapshot headless (tanpa DOM) untuk QA/tests.
    try {
      shopRender = {
        tab: shopTab, sel: shopSel, balance: bal, mode: mode,
        cards: items.map(function (it) {
          var eq1 = null;
          try { eq1 = getEquipment(); } catch (e2) { eq1 = { sword: 'rusty', shield: 'buckler', bow: 'makeshift' }; }
          var cur1 = it.category === 'sword' ? eq1.sword : (it.category === 'shield' ? eq1.shield : eq1.bow);
          return { id: it.id, owned: isOwned(it.id),
            action: !isOwned(it.id) ? 'BUY' : ((cur1 === it.id) ? 'EQUIPPED' : 'EQUIP') };
        }),
        preview: (function () {
          var p = shopItemById(shopSel);
          return p ? { id: p.id, stats: shopStatBars(p), special: p.special,
                       weapon: weaponFile(p.id), klass: SHOP_CLASS_IMG[p.category] } : null;
        })()
      };
    } catch (e) { /* abaikan */ }
    try {
      if (shopCoinEl) shopCoinEl.textContent = 'Coin: ' + bal;
      var t;
      for (t in shopTabBtns) {
        if (shopTabBtns[t]) {
          var on = (t === shopTab);
          try {
            if (on) shopTabBtns[t].classList.add('active');
            else shopTabBtns[t].classList.remove('active');
          } catch (e2) { /* abaikan */ }
        }
      }
      // Mode USE buttons: label + disabled saat syarat tak terpenuhi.
      try {
        if (shopModeBtns.SWORD) {
          shopModeBtns.SWORD.textContent = 'USE SWORD' + (mode === 'SWORD' ? ' ✓' : '');
          shopModeBtns.SWORD.disabled = (mode === 'SWORD');
        }
        if (shopModeBtns.GUARDIAN) {
          shopModeBtns.GUARDIAN.textContent = 'USE GUARDIAN' + (mode === 'GUARDIAN' ? ' ✓' : '');
          shopModeBtns.GUARDIAN.disabled = (mode === 'GUARDIAN');
        }
        if (shopModeBtns.ARCHER) {
          shopModeBtns.ARCHER.textContent = 'USE ARCHER' + (mode === 'ARCHER' ? ' ✓' : '');
          shopModeBtns.ARCHER.disabled = (mode === 'ARCHER');
        }
      } catch (e3) { /* abaikan */ }
      var prev = shopItemById(shopSel);
      if (prev) {
        var tm = TIER_META[prev.tier] || TIER_META.Common;
        if (shopPrevImg) { try { shopPrevImg.src = SHOP_CLASS_IMG[prev.category]; } catch (e4) { /* abaikan */ } }
        // Preview senjata per item.id (bukan gambar karakter generik saja).
        if (shopPrevWeapon) { try { shopPrevWeapon.src = weaponFile(prev.id); } catch (e42) { /* abaikan */ } }
        if (shopPrevName) shopPrevName.textContent = prev.name;
        if (shopPrevTier) {
          shopPrevTier.textContent = tm.symbol + ' ' + tm.label;
          try { shopPrevTier.style.color = tm.color; } catch (e5) { /* abaikan */ }
        }
        if (shopPrevPrice) shopPrevPrice.textContent = prev.price + ' Coin';
        if (shopPrevDesc) shopPrevDesc.textContent = prev.desc;
        if (shopPrevStats) {
          var bars = shopStatBars(prev);
          var html = '';
          for (var bi = 0; bi < bars.length; bi++) {
            var pct = bars[bi][2] > 0 ? Math.round(clamp(bars[bi][1] / bars[bi][2], 0, 1) * 100) : 0;
            html += bars[bi][0] + ' ' + bars[bi][1] + ' [' + pct + '%]; ';
          }
          shopPrevStats.textContent = html;
        }
        if (shopPrevSpecial) {
          shopPrevSpecial.textContent = 'SPECIAL: ' + (prev.special ? prev.special.kind : '-');
        }
        if (shopPrevAction) {
          var eq2 = getEquipment();
          var cur2 = prev.category === 'sword' ? eq2.sword : (prev.category === 'shield' ? eq2.shield : eq2.bow);
          shopPrevAction.textContent = !isOwned(prev.id) ? 'BUY' : ((cur2 === prev.id) ? 'EQUIPPED' : 'EQUIP');
        }
      }
      // Cards: rebuild hanya bila DOM nyata mendukung.
      if (shopListEl && typeof shopListEl.appendChild === 'function' && typeof document !== 'undefined' && document.createElement) {
        try {
          while (shopListEl.firstChild) shopListEl.removeChild(shopListEl.firstChild);
        } catch (e6) {
          try { shopListEl.innerHTML = ''; } catch (e7) { /* abaikan */ }
        }
        for (var ci = 0; ci < items.length; ci++) {
          (function (it) {
            var card = null;
            try { card = document.createElement('div'); } catch (e8) { return; }
            if (!card) return;
            try { card.className = 'shop-card tier-' + it.tier; } catch (e9) { /* abaikan */ }
            var eq3 = getEquipment();
            var cur3 = it.category === 'sword' ? eq3.sword : (it.category === 'shield' ? eq3.shield : eq3.bow);
            var act = !isOwned(it.id) ? 'BUY' : ((cur3 === it.id) ? 'EQUIPPED' : 'EQUIP');
            var tmm = TIER_META[it.tier] || TIER_META.Common;
            var btn = null;
            try {
              btn = document.createElement('button');
              btn.className = 'btn-small';
              btn.textContent = act + ' • ' + it.price + 'c';
              btn.setAttribute('aria-label', act + ' ' + it.name);
              btn.addEventListener('click', function () { shopCardAction(it.id); });
            } catch (e10) { btn = null; }
            try {
              var nm = document.createElement('div');
              nm.className = 'shop-name';
              nm.textContent = (isOwned(it.id) ? '[OWNED] ' : '[LOCKED] ') + it.name;
              card.appendChild(nm);
              var tb = document.createElement('div');
              tb.className = 'shop-tier';
              tb.textContent = tmm.symbol + ' ' + tmm.label;
              card.appendChild(tb);
              // Hierarchy mobile: deskripsi wrap + harga jelas per card.
              var ds = document.createElement('div');
              ds.className = 'shop-desc';
              ds.textContent = it.desc;
              card.appendChild(ds);
              var pr = document.createElement('div');
              pr.className = 'shop-price';
              pr.textContent = it.price + ' Coin';
              card.appendChild(pr);
              if (btn) card.appendChild(btn);
              var self = this;
              card.addEventListener('click', function () { shopSel = it.id; refreshShopUI(); });
              shopListEl.appendChild(card);
            } catch (e11) { /* abaikan (mock DOM minimal) */ }
          })(items[ci]);
        }
      }
    } catch (e) { /* abaikan: headless tanpa DOM penuh */ }
  }

  /* ---- 11f. EXPLICIT PAUSE (Stage 10): P / Esc / tombol DOM ----
   * Pause membekukan simulasi (frame return dini), men-suspend audio,
   * membersihkan input agar tidak bocor saat resume. Satu rAF tetap. */
  var pauseEl = null, btnPause = null;
  var btnResume = null, btnPauseRespawn = null, btnPauseMenu = null;
  var btnBlockEl = null;

  /* Tombol block (SHIELD): hanya Guardian saat playing. Jika tidak muncul,
     pastikan buy + equip + setMode('GUARDIAN') sudah dilakukan sebelum main.
     Refresh terus di loop agar tidak hilang saat switch mode. */
  function refreshBlockBtn() {
    try {
      if (!btnBlockEl) {
        btnBlockEl = document.getElementById('btn-block');
      }
      if (!btnBlockEl) return;
      var show = false;
      try { show = (gameState === 'playing' && playerMode() === 'GUARDIAN'); } catch (e) { show = false; }
      btnBlockEl.style.display = show ? '' : 'none';
      btnBlockEl.style.visibility = show ? 'visible' : 'hidden';
      btnBlockEl.style.opacity = show ? '1' : '0';
      if (!show) Input.blockHeld = false;
    } catch (e) { /* abaikan */ }
  }

  function refreshPauseBtn() {
    try {
      if (!btnPause) return;
      if (gameState === 'playing') {
        btnPause.classList.remove('hidden');
        btnPause.textContent = paused ? '▶' : '⏸';
        btnPause.setAttribute('aria-label', paused ? 'Lanjutkan game' : 'Pause game');
      } else {
        btnPause.classList.add('hidden');
      }
    } catch (e) { /* abaikan */ }
  }

  function isPauseOpen() {
    try { return !!(pauseEl && !pauseEl.classList.contains('hidden')); }
    catch (e) { return false; }
  }

  function pauseGame() {
    if (gameState !== 'playing' || paused) return;
    clearInput();
    setPaused(true);
    hideAllOverlays();
    if (pauseEl) pauseEl.classList.remove('hidden');
    refreshPauseBtn();
    if (btnResume && btnResume.focus) {
      try { btnResume.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
    debugLog('[game] pause eksplisit');
  }

  function resumeGame() {
    if (gameState !== 'playing' || !paused) return;
    clearInput();
    if (pauseEl) pauseEl.classList.add('hidden');
    setPaused(false);
    try { last = nowPerf(); } catch (e) { /* abaikan */ }
    try { AudioManager.unlock(); } catch (e) { /* abaikan */ }
    refreshPauseBtn();
    if (btnPause && btnPause.focus) {
      try { btnPause.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
    debugLog('[game] resume eksplisit');
  }

  function togglePause() {
    if (gameState !== 'playing') return;
    if (paused) resumeGame();
    else pauseGame();
  }

  /* ---- 11g. REDUCED MOTION (Stage 10): hormati preferensi OS ----
   * Saat aktif: screen shake dinonaktifkan (visual-only, gameplay utuh). */
  var reducedMotion = false;
  function applyReducedMotionPref() {
    try {
      var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotion = !!(mq && mq.matches);
    } catch (e) { reducedMotion = false; }
  }
  function setReducedMotion(v) { reducedMotion = !!v; }

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
      var done = (save.level1Completed ? 1 : 0) + (save.level2Completed ? 1 : 0) +
        (save.level3Completed ? 1 : 0) + (save.level4Completed ? 1 : 0) +
        (save.level5Completed ? 1 : 0);
      aboutRecords.textContent =
        'Best L1: ' + fmtTime(save.bestL1) + ' • Best L2: ' + fmtTime(save.bestL2) +
        ' • Best L3: ' + fmtTime(save.bestL3) + ' • Best L4: ' + fmtTime(save.bestL4) +
        ' • Best L5: ' + fmtTime(save.bestL5) +
        ' • Best: ' + fmtTime(save.bestTime) + ' • Coin: ' + save.bestCoins +
        ' • Mati: ' + save.totalDeaths + ' • Selesai: ' + done + '/5';
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
  // M4: target terkunci ditolak (anti bypass progression).
  function startTrans(n) {
    // Guard: level di luar daftar ditolak diam-diam (anti crash console).
    if (trans.active || !(n >= 1 && n <= Levels.length)) return false;
    if (!canPlayLevel(n)) {
      try { showToast('Selesaikan level sebelumnya dulu!'); } catch (e) { /* abaikan */ }
      debugLog('[game] start trans ditolak (locked)', n);
      return false;
    }
    hideAllOverlays();
    try { AudioManager.unlock(); } catch (e) { /* abaikan */ }
    trans.active = true;
    trans.phase = 'out';
    trans.t = 0;
    trans.target = n;
    return true;
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

  // Minor C: completeCurrentLevel() adalah authority final.
  // showLevelComplete() tidak boleh meninggalkan half-complete jika
  // dipanggil di L5 dari jalur sah — delegasikan ke game complete.
  function showLevelComplete() {
    if (gameState !== 'playing') return;
    if (currentLevel >= 5) { showGameComplete(); return; }
    gameState = 'levelcomplete';
    // Persistent per level: unlock berikutnya + best per level.
    if (currentLevel === 1) {
      save.level1Completed = true;
      save.level2Unlocked = true;
      if (save.bestL1 == null || levelStats.time < save.bestL1) save.bestL1 = levelStats.time;
    } else if (currentLevel === 2) {
      save.level2Completed = true;
      save.level3Unlocked = true;
      if (save.bestL2 == null || levelStats.time < save.bestL2) save.bestL2 = levelStats.time;
    } else if (currentLevel === 3) {
      save.level3Completed = true;
      save.level4Unlocked = true;
      if (save.bestL3 == null || levelStats.time < save.bestL3) save.bestL3 = levelStats.time;
    } else if (currentLevel === 4) {
      save.level4Completed = true;
      save.level5Unlocked = true;
      if (save.bestL4 == null || levelStats.time < save.bestL4) save.bestL4 = levelStats.time;
    } else {
      // Unreachable via completeCurrentLevel (L5 -> showGameComplete),
      // dipertahankan sebagai fallback aman bila dipanggil langsung.
      save.level5Completed = true;
      if (save.bestL5 == null || levelStats.time < save.bestL5) save.bestL5 = levelStats.time;
    }
    persistSave();
    refreshRecordsUI();
    if (lvlclearEl) {
      if (lvlclearStats) {
        lvlclearStats.textContent = 'Level ' + currentLevel + ' • Waktu: ' +
          levelStats.time.toFixed(1) + ' dtk • Musuh: ' +
          levelStats.kills + ' • Coin: ' + coinGot() + '/' + coins.length;
      }
      lvlclearEl.classList.remove('hidden');
    }
    if (btnNext && btnNext.focus) {
      try { btnNext.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
    AudioManager.play('win');
    AudioManager.updateMusicState(); // BGM gameplay berhenti
    checkAchievements(true, currentLevel, deaths > 0, levelStats.time, false, false);
  }

  function showGameComplete() {
    if (gameState !== 'playing') return;
    gameState = 'gamecomplete';
    // Persistent final: L5 selesai + game complete + best.
    save.level5Completed = true;
    save.gameCompleted = true;
    if (save.difficulty === 'hard') {
      save.hardProgress = save.hardProgress || {};
      save.hardProgress.gameCompleted = true;
      save.hardProgress.level5Completed = true;
      save.hardProgress.level4Unlocked = true;
      save.hardProgress.level3Unlocked = true;
      save.hardProgress.level2Unlocked = true;
      save.hardProgress.level5Unlocked = true;
    }
    if (save.bestTime == null || timeElapsed < save.bestTime) save.bestTime = timeElapsed;
    if (save.bestL5 == null || levelStats.time < save.bestL5) save.bestL5 = levelStats.time;
    if (runStats.coins > save.bestCoins) save.bestCoins = runStats.coins;
    persistSave();
    refreshRecordsUI();
    if (gameclearEl) {
      // Stage 11: hierarchy — Coin, Gold Shard, Musuh, Mati, Waktu, Best.
      // Tanpa statistik palsu: semua dari run aktual + best tersimpan.
      var txt = 'Coin: ' + runStats.coins + ' • Gold Shard: ' + (runStats.goldShards || 0) +
        ' • Musuh: ' + runStats.kills + ' • Mati: ' + deaths +
        ' • Waktu: ' + timeElapsed.toFixed(1) + ' dtk';
      if (save.bestTime != null) txt += ' • Terbaik: ' + Number(save.bestTime).toFixed(1) + ' dtk';
      if (gameclearStats) gameclearStats.textContent = txt;
      gameclearEl.classList.remove('hidden');
    }
    if (btnAgain2 && btnAgain2.focus) {
      try { btnAgain2.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
    AudioManager.play('win');
    AudioManager.updateMusicState(); // BGM gameplay berhenti
    checkAchievements(true, 5, deaths > 0, timeElapsed, true, true);
  }

  // Lanjut ke level berikutnya dengan gate unlock (L1->L2->L3->L4->L5).
  function nextLevel() {
    var nx = currentLevel + 1;
    if (nx > Levels.length) return;
    if (!canPlayLevel(nx)) {
      showToast('Selesaikan Level ' + currentLevel + ' dulu!');
      AudioManager.play('click');
      return;
    }
    startTrans(nx);
  }

  function foesLeft() {
    var n = aliveEnemies();
    if (boss && !boss.dead) n++;
    if (miniboss && !miniboss.dead) n++;
    return n;
  }

  /* Stage 9: kemenangan boss dirutekan per level. Level 5 memakai
   * final berurutan: slime king dulu, lalu jeda, lalu lich. */
  var finalPhase = 'slime', finalT = 0; // khusus Level 5

  function onBossDefeated() {
    runStats.kills++;
    levelStats.kills++;
    if (!save.achievements.first_blood) unlockAchievement('first_blood');
    // Final L5: slime tumbang -> interlude -> lich (bukan victory dulu).
    // Intro lich hanya sekali via dormant (tanpa toast/suara ganda di sini).
    if (currentLevel === 5 && finalPhase === 'slime') {
      finalPhase = 'inter';
      finalT = 0;
      shocks = [];
      shots = [];
      playerShots = [];
      // Bersihkan sisa enemy/summon tanpa kill-count agar fase lich steril.
      enemies.length = 0;
      triggerScreenShake(SHAKE_HURT, 0.35);
      return;
    }
    victoryArmed = true;
    victoryT = 0;
    // C2: boss tumbang -> sterilkan hazard agar victory race tidak terjadi.
    // Player tidak boleh mati oleh sisa projectile/shock setelah kemenangan.
    shocks = [];
    shots = [];
    playerShots = [];
  }

  // Level terakhir (5) -> Game Complete; selainnya -> Level Complete.
  function completeCurrentLevel() {
    if (currentLevel >= 5) showGameComplete();
    else showLevelComplete();
  }

  // Respawn di checkpoint terakhir (atau spawn): HP pulih, musuh + boss
  // reset, checkpoint TETAP aktif, timer & deaths lanjut. Coin yang sudah
  // diambil tetap diambil (retry ramah). Efek sementara dibersihkan.
  // Tahap 4: selalu unpause + reset timer agar "restart setelah pause" aman.
  function respawn() {
    // Chest yang sudah dibuka TETAP dibuka (retry ramah, anti duplikat reward).
    var keptOpened = [];
    for (var ki = 0; ki < chests.length; ki++) {
      if (chests[ki].state === 'opened') keptOpened.push(chests[ki].x);
    }
    player = createPlayer();
    player.x = respawnPoint.x;
    player.y = respawnPoint.y;
    player.blockStam = blockMax(); // stamina penuh tiap respawn
    // Korban jurang (pitDead) TIDAK dibangun ulang — sisanya kembali
    // seperti biasa (desain retry). Boss/miniboss selalu kembali.
    enemies = Level.enemySpawns.filter(function (sp) {
      return pitDead.indexOf(sp.x + ':' + sp.y) < 0;
    }).map(function (sp) { return createSlime(sp); });
    boss = spawnLevelBoss();
    miniboss = Level.miniSpawn ? createMiniboss(Level.miniSpawn, Level.miniArena) : null;
    shocks = [];
    shots = [];
    playerShots = [];
    resetChests();
    for (var ri = 0; ri < chests.length; ri++) {
      if (keptOpened.indexOf(chests[ri].x) >= 0) {
        chests[ri].state = 'opened';
        chests[ri].iconT = 99; // popup reward tidak diulang
      }
    }
    victoryArmed = false;
    victoryT = 0;
    finalPhase = 'slime'; // L5 respawn = ulangi gauntlet dari slime
    finalT = 0;
    clearParticles();
    clearBonePiles(); // retry fresh: pile ikut reset dengan musuh
    clearGooPiles(); // genangan ikut reset dengan musuh
    resetShake();
    hitStopT = 0; // tanpa freeze basi setelah respawn
    gateTarget = 0; gateAnim = 0; gateBounds = null; // boss fresh = terbuka
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
    refreshPauseBtn();
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
      if (hidden) clearInput(); // pointer-up bisa hilang saat tab hidden
      else last = nowPerf(); // cegah delta melonjak saat kembali
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
  var skyGrads = [null, null, null, null, null];

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
    // Animasi mati: kedip awal 0.3 dtk (impak), lalu ambruk + fade.
    // Timing game-over (deathT > 1.0) tidak berubah.
    var dying = player.state === 'death';
    if (dying && player.deathT < 0.3) {
      if (Math.floor(player.animTime * 14) % 2 === 0) return;
    }
    // Stage 11: pose victory heroik di layar menang (tanpa ubah FSM).
    // Shop: victory mengikuti class aktif (guardian/archer/knight).
    var _vm = 'knight';
    try { _vm = playerMode() === 'GUARDIAN' ? 'guardian' : (playerMode() === 'ARCHER' ? 'archer' : 'knight'); } catch (e) { _vm = 'knight'; }
    var _vlist = sprites[_vm + 'Victory'] || sprites.knightVictory;
    var victoryPose = (gameState === 'levelcomplete' || gameState === 'gamecomplete') &&
      player.state !== 'death' && _vlist && _vlist[0];
    var img = victoryPose ? _vlist[0] : playerCurrentSprite();
    if (!img) return;
    // Squash pendaratan + napas idle (polish: offset piksel bulat, murah).
    var squashing = player.landT > 0;
    var dw = PLAYER_DRAW, dh = PLAYER_DRAW;
    if (squashing) { dw = PLAYER_DRAW + 8; dh = PLAYER_DRAW - 8; }
    var dx = Math.round(player.x + player.w / 2 - dw / 2);
    // Kaki menapak tanah: baris opaque terbawah sprite (baris 26 dari 32,
    // tepi bawah = 81px dari atas sprite 96px) harus tepat di hitbox bawah:
    // dy + 81 = y + 78  ->  offset KNIGHT_FEET_DY (h-dh = -18). Saat squash,
    // bawah dipin di tanah agar gepeng melebar, bukan tenggelam.
    var dy = Math.round(player.y + player.h - dh + (squashing ? 0 : KNIGHT_FEET_DY));
    if (player.state === 'idle') dy += Math.round(Math.sin(player.animTime * 9));
    // Ambruk: badan tenggelam perlahan selama death (maks 10px).
    if (dying) dy += Math.min(10, Math.round(player.deathT * 12));
    var cx = dx + dw / 2;
    // Fade akhir death (0.7 -> 1.0 dtk), seimbang save/restore.
    var dFade = 1;
    if (dying && player.deathT > 0.7) {
      dFade = clamp((1.0 - player.deathT) / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = dFade;
    }
    drawFacing(function () {
      ctx.drawImage(img, dx, dy, dw, dh);
      // WEAPON OVERLAY (CHARACTER BASE + WEAPON OVERLAY + FX):
      // perisai di bawah pedang; overlay memakai rect/offset sama sehingga
      // flip arah hadap otomatis selaras. Tanpa alokasi (scratch + drawImage).
      var sc = dw / 32, sc2 = dh / 32;
      var sho = pickWeaponOverlay('shield', victoryPose);
      if (sho.key && sprites[sho.key] && sprites[sho.key][0]) {
        ctx.drawImage(sprites[sho.key][0], dx + sho.ox * sc, dy + sho.oy * sc2, dw, dh);
      }
      var swo = pickWeaponOverlay('sword', victoryPose);
      if (swo.key && sprites[swo.key] && sprites[swo.key][0]) {
        ctx.drawImage(sprites[swo.key][0], dx + swo.ox * sc, dy + swo.oy * sc2, dw, dh);
      }
      var bwo = pickWeaponOverlay('bow', victoryPose);
      if (bwo.key && sprites[bwo.key] && sprites[bwo.key][0]) {
        ctx.drawImage(sprites[bwo.key][0], dx + bwo.ox * sc, dy + bwo.oy * sc2, dw, dh);
      }
      // Epic Bastion: aura ringan saat passive aktif (visual saja).
      try {
        if (player.bastionOn > 0) {
          ctx.fillStyle = 'rgba(192,123,255,0.18)';
          ctx.fillRect(dx - 6, dy + 6, dw + 12, dh - 12);
        }
      } catch (e) { /* abaikan */ }
      // Hit flash singkat saat hurt.
      if (player.state === 'hurt') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(dx, dy, dw, dh);
      }
      // Epic Aegis: flash magis saat block (visual saja).
      if (player.state === 'block') {
        var shb = null;
        try { shb = shieldStats(); } catch (e2) { shb = null; }
        var bcol = 'rgba(207,227,255,0.35)';
        if (shb && shb.special && shb.special.kind === 'magicGuard') bcol = 'rgba(125,249,255,0.4)';
        else if (shb && shb.id === 'bastion') bcol = 'rgba(192,123,255,0.4)';
        ctx.fillStyle = bcol;
        ctx.fillRect(dx, dy, dw, dh);
      }
    }, dx, cx, player.facing);
    if (dFade < 1) ctx.restore();
  }

  // Efek tebasan: busur slash + 3 garis energi mengikuti arah serangan,
  // hanya fase strike. Tanpa state tambahan — murni turunan dari attackBox
  // dan attackT yang sudah ada (fade mengikuti progres fase).
  function drawSlash() {
    if (!player.attackBox) return;
    var ab = player.attackBox;
    var fx = player.facing;
    // Epic sword tint (data-driven dari special.kind; visual saja).
    var arcCol = '160,200,255', dotCol = 'rgba(255,210,63,0.9)';
    try {
      var _ss = swordStats();
      if (_ss && _ss.special && _ss.special.kind === 'poison') { arcCol = '150,110,230'; dotCol = 'rgba(150,100,220,0.9)'; }
      else if (_ss && _ss.special && _ss.special.kind === 'burn') { arcCol = '255,170,80'; dotCol = 'rgba(255,150,60,0.95)'; }
    } catch (e) { /* abaikan */ }
    // Busur ayunan: bara lebar memudar seiring attackT (anticipation->strike).
    var prog = clamp(player.attackT / (ATTACK_WINDUP + ATTACK_STRIKE), 0, 1);
    var arcA = 0.30 * (1 - prog) + 0.10;
    ctx.fillStyle = 'rgba(' + arcCol + ',' + arcA.toFixed(2) + ')';
    var aw = Math.round(ab.w * (0.6 + 0.4 * prog));
    var ax = fx === 1 ? ab.x + ab.w - aw : ab.x;
    ctx.fillRect(Math.round(ax), Math.round(ab.y + 4), aw, Math.round(ab.h - 8));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var i = 0; i < 3; i++) {
      var off = i * 12;
      var h = ab.h - 20 - i * 6;
      if (h < 4) h = 4;
      var x0 = fx === 1 ? ab.x + 6 + off : ab.x + ab.w - 11 - off;
      ctx.fillRect(Math.round(x0), Math.round(ab.y + 8 + i * 6), 5, h);
    }
    // Titik impact kuning di ujung ayunan.
    ctx.fillStyle = dotCol;
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
      var e = enemies[i];
      if (e.dead) continue;
      if (e.kind === 'skeletonArcher') drawArcher(e);
      else if (e.kind === 'skeletonSword' || e.kind === 'skeletonDefender') drawSkeleton(e);
      else drawSlime(e);
    }
  }

  /* Undead sprite set — PNG lokal dengan fallback prosedural.
   * Sprite digambar bottom-anchored (kaki napak tanah) + flip arah hadap.
   * Jika gambar belum siap/gagal, fallback rect lama dipakai sehingga
   * game tidak pernah crash dan hitbox/AI tidak berubah. */
  function foeImg(list, i) {
    try { return (list && list[i]) || null; } catch (e) { return null; }
  }
  function drawFoeSprite(img, dx, dy, dw, dh, facing, blink) {
    var cx = dx + dw / 2;
    drawFacing(function () {
      ctx.drawImage(img, dx, dy, dw, dh);
      if (blink) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(dx, dy, dw, dh);
      }
    }, dx, cx, facing);
  }

  /* Frame animasi serangan — satu sumber kebenaran (dipakai draw + test).
   * o: {atkT, windup, strike, guardFlash, relT, moving, t}. */
  function foeFrameFor(kind, state, o) {
    o = o || {};
    if (kind === 'skeletonDefender') {
      if (state === 'attack') {
        if (o.atkT < o.windup) return ['skelDef', 0];
        if (o.atkT < o.windup + o.strike) return ['skelDef', 2];
        return ['skelDef', 0];
      }
      return ['skelDef', o.guardFlash > 0 ? 1 : 0];
    }
    if (kind === 'skeletonSword') {
      if (state === 'attack') {
        if (o.atkT < o.windup) return ['skelSword', 2];
        if (o.atkT < o.windup + o.strike) return ['skelSword', 3];
        return ['skelSword', 0];
      }
      // Jalan realistis: frekuensi langkah ikut kecepatan gerak
      // (patrol lambat, chase cepat). Default 6 = perilaku lama.
      return ['skelSword', o.moving ? (Math.floor((o.t || 0) * (o.rate || 6)) % 2) : 0];
    }
    if (kind === 'skeletonArcher') {
      if (state === 'shoot') return ['skelArch', 1];
      if (o.relT > 0) return ['skelArch', 2];
      return ['skelArch', 0];
    }
    return [null, 0];
  }

  function bossFrameFor(kind, state) {
    if (kind === 'miniboss') {
      if (currentLevel === 1) {
        if (state === 'slash' || state === 'attack') return ['lightningSlime', 1];
        if (state === 'dash') return ['lightningSlime', 2];
        return ['lightningSlime', 0];
      }
      if (state === 'slash') return ['skelKnight', 1];
      if (state === 'dash') return ['skelKnight', 2];
      return ['skelKnight', 0];
    }
    if (kind === 'lich') {
      if (state === 'strike') return ['lich', 2];
      if (state === 'telegraph' || state === 'bolt' || state === 'summon') return ['lich', 1];
      return ['lich', 0];
    }
    return [null, 0];
  }

  /* Stage 9: skeleton prosedural — siluet khas tiap archetype.
   * Sword: pedang + pose melee. Defender: perisai depan + guard flash.
   * Archer: busur + quiver, glow kuning saat telegraph 'shoot'. */
  function drawSkeleton(s) {
    var t = s.animTime;
    // Jalan realistis: stride ikut state (patrol 5 amble, chase 9 march),
    // 2 pose kaki per siklus + badan naik-turun sinkron (tanpa sliding).
    var stepping = (s.state === 'patrol' || s.state === 'chase');
    var stride = s.state === 'chase' ? 9 : 5;
    var phase = stepping ? (Math.floor(t * stride) % 2) : 0;
    var bob = stepping ? Math.round(-Math.abs(Math.sin(t * stride * Math.PI)) * 2) : 0;
    var dw = s.w + 6, dh = s.h + 6;
    // Runtuh realistis: fase A tegak-topple, fase B ambruk (melebar) + fade.
    var topple = 0, dFade = 1, crumbled = false;
    if (s.state === 'death') {
      var k = clamp(1 - s.deathT / SLIME_DEATH_DURATION, 0, 1);
      dh = Math.round(dh * (0.3 + 0.7 * k));
      topple = Math.round(Math.min(10, s.deathT * 60)) * (s.dir === 1 ? 1 : -1);
      if (k < 0.55) { crumbled = true; dw += 8; } // tulang menyebar
      if (s.deathT > SLIME_DEATH_DURATION - 0.15) {
        dFade = clamp((SLIME_DEATH_DURATION - s.deathT) / 0.15, 0, 1);
      }
    }
    var dx = Math.round(s.x + s.w / 2 - dw / 2) + topple;
    var dy = Math.round(s.y + s.h - dh) + bob;
    var blink = s.iframes > 0 && Math.floor(t * 16) % 2 === 0;
    var windup = s.state === 'attack' && s.atkT < s.st.windup;

    if (dFade < 1) { ctx.save(); ctx.globalAlpha = dFade; }

    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(Math.round(s.x + 4), Math.round(s.y + s.h - 3), s.w - 8, 4);

    // Sprite PNG bila siap (idle/walk/guard/windup/strike), fallback rect bila belum.
    var simg = null, striking = false;
    var fr = foeFrameFor(s.kind, s.state, {
      atkT: s.atkT, windup: s.st.windup, strike: s.st.strike,
      guardFlash: s.guardFlash,
      moving: (s.state === 'patrol' || s.state === 'chase'), t: t, rate: stride
    });
    if (s.state === 'attack') {
      striking = s.atkT >= s.st.windup && s.atkT < s.st.windup + s.st.strike;
    }
    if (fr[0]) simg = foeImg(sprites[fr[0]], fr[1]);
    if (simg) {
      drawFoeSprite(simg, dx, dy, dw, dh, s.dir, blink);
      // Swoosh kilat saat fase strike aktif (feedback tebasan).
      if (striking) {
        var wx = s.dir === 1 ? dx + dw - 16 : dx + 8;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(wx, Math.round(dy + dh / 2 - 10), 8, 20);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(s.dir === 1 ? wx - 10 : wx + 8, Math.round(dy + dh / 2 - 6), 6, 12);
      }
      // Guard flash: kilau putih di tepi perisai agar block terbaca jelas.
      if (s.kind === 'skeletonDefender' && s.guardFlash > 0 && Math.floor(t * 14) % 2 === 0) {
        var shx = s.dir === 1 ? dx + dw - 8 : dx;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(shx, dy + 10, 8, dh - 18);
      }
    } else {
    ctx.fillStyle = blink ? '#ffffff' : s.st.body;
    ctx.fillRect(dx + 5, dy + 12, dw - 10, dh - 12);   // torso ramping
    ctx.fillRect(dx + 9, dy + 4, dw - 18, 10);         // tengkorak
    ctx.fillStyle = s.st.dark;
    // Kaki melangkah bergantian mengikuti fase stride (bukan blok statis):
    // satu kaki maju+angkat, satunya mundur — sinkron dengan bob badan.
    var legW = Math.max(4, Math.round((dw - 10) / 2));
    var swing = stepping ? (phase === 0 ? 2 : -2) : 0;
    var fwdL = s.dir === 1 ? 1 : -1;
    ctx.fillRect(dx + 5 + fwdL * swing, dy + dh - 8, legW,
      8 - ((phase === 0 && stepping) ? 2 : 0));
    ctx.fillRect(dx + 5 + legW - fwdL * swing, dy + dh - 8, legW,
      8 - ((phase !== 0 && stepping) ? 2 : 0));
    // Mata merah berongga (ikut arah).
    var ex = s.dir === 1 ? dx + dw - 18 : dx + 6;
    ctx.fillStyle = '#e05252';
    ctx.fillRect(ex, dy + 6, 5, 5);
    ctx.fillRect(ex + 7, dy + 6, 5, 5);

    if (s.kind === 'skeletonDefender') {
      // Perisai di sisi hadap; kilat saat block.
      var shx = s.dir === 1 ? dx + dw - 8 : dx;
      ctx.fillStyle = (s.guardFlash > 0 && Math.floor(t * 14) % 2 === 0) ? '#ffffff' : '#5a6c8a';
      ctx.fillRect(shx, dy + 10, 8, dh - 18);
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(shx + 2, dy + 14, 4, 6);
    } else {
      // Pedang di sisi hadap (terangkat saat windup, sway ikut langkah).
      var swx = s.dir === 1 ? dx + dw - 6 : dx - 8;
      var swy = (windup ? dy - 6 : dy + 8) + (stepping ? (phase === 0 ? -1 : 1) : 0);
      ctx.fillStyle = '#d6deea';
      ctx.fillRect(swx, swy, 5, 22);
      ctx.fillStyle = '#8a6d3b';
      ctx.fillRect(swx - 2, swy + 20, 9, 4);
    }
    } // end fallback prosedural (sprite path memakai overlay sendiri)
    // Tumpukan tulang saat ambruk (fallback; sprite path memakai fade saja).
    if (crumbled) {
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(dx + 6, dy + dh - 6, dw - 12, 5);
      ctx.fillRect(dx + dw / 2 - 6, dy + dh - 11, 12, 5);
      ctx.fillStyle = '#8f9bb0';
      ctx.fillRect(dx + 4, dy + dh - 3, dw - 8, 3);
    }
    // Telegraph windup: tanda seru (konsisten dengan slime, semua path).
    if (windup) {
      ctx.fillStyle = '#ffd23f';
      var qx = Math.round(s.x + s.w / 2 - 2);
      ctx.fillRect(qx, dy - 18, 5, 10);
      ctx.fillRect(qx, dy - 5, 5, 5);
    }
    if (dFade < 1) ctx.restore();
  }

  function drawArcher(s) {
    var t = s.animTime;
    // Archer ikut melangkah realistis (sebelumnya statis): stride sama
    // seperti skeleton melee, bob + kaki bergantian saat patrol/chase.
    var aStepping = (s.state === 'patrol' || s.state === 'chase');
    var aStride = s.state === 'chase' ? 9 : 5;
    var aPhase = aStepping ? (Math.floor(t * aStride) % 2) : 0;
    var aBob = aStepping ? Math.round(-Math.abs(Math.sin(t * aStride * Math.PI)) * 2) : 0;
    var dw = s.w + 6, dh = s.h + 6;
    // Runtuh realistis seperti skeleton melee (topple + crumble + fade).
    var topple = 0, dFade = 1, crumbled = false;
    if (s.state === 'death') {
      var k = clamp(1 - s.deathT / SLIME_DEATH_DURATION, 0, 1);
      dh = Math.round(dh * (0.3 + 0.7 * k));
      topple = Math.round(Math.min(10, s.deathT * 60)) * (s.dir === 1 ? 1 : -1);
      if (k < 0.55) { crumbled = true; dw += 8; }
      if (s.deathT > SLIME_DEATH_DURATION - 0.15) {
        dFade = clamp((SLIME_DEATH_DURATION - s.deathT) / 0.15, 0, 1);
      }
    }
    var dx = Math.round(s.x + s.w / 2 - dw / 2) + topple;
    var dy = Math.round(s.y + s.h - dh) + aBob;
    var blink = s.iframes > 0 && Math.floor(t * 16) % 2 === 0;
    var tele = s.state === 'shoot';

    if (dFade < 1) { ctx.save(); ctx.globalAlpha = dFade; }

    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(Math.round(s.x + 4), Math.round(s.y + s.h - 3), s.w - 8, 4);

    // Sprite PNG (aim saat telegraph shoot, release sesaat setelah lepas).
    var afr = foeFrameFor('skeletonArcher', s.state, { relT: s.relT });
    var aimg = afr[0] ? foeImg(sprites[afr[0]], afr[1]) : null;
    if (aimg) {
      drawFoeSprite(aimg, dx, dy, dw, dh, s.dir, blink);
      // Busur glow saat telegraph agar tembakan terbaca.
      if (tele && Math.floor(t * 10) % 2 === 0) {
        var bwx = s.dir === 1 ? dx + dw - 5 : dx + 1;
        ctx.fillStyle = 'rgba(255,210,99,0.9)';
        ctx.fillRect(bwx, dy + 6, 4, 26);
      }
    } else {
    ctx.fillStyle = blink ? '#ffffff' : s.st.body;
    ctx.fillRect(dx + 6, dy + 12, dw - 12, dh - 12);   // torso ramping
    ctx.fillRect(dx + 10, dy + 4, dw - 20, 10);        // tengkorak
    ctx.fillStyle = s.st.dark;
    // Kaki melangkah bergantian (sinkron bob), bukan blok statis.
    var aLegW = Math.max(4, Math.round((dw - 12) / 2));
    var aSwing = aStepping ? (aPhase === 0 ? 2 : -2) : 0;
    var aFwd = s.dir === 1 ? 1 : -1;
    ctx.fillRect(dx + 6 + aFwd * aSwing, dy + dh - 8, aLegW,
      8 - ((aPhase === 0 && aStepping) ? 2 : 0));
    ctx.fillRect(dx + 6 + aLegW - aFwd * aSwing, dy + dh - 8, aLegW,
      8 - ((aPhase !== 0 && aStepping) ? 2 : 0));
    var ex = s.dir === 1 ? dx + dw - 19 : dx + 7;
    ctx.fillStyle = '#e05252';
    ctx.fillRect(ex, dy + 6, 5, 5);
    ctx.fillRect(ex + 7, dy + 6, 5, 5);
    // Quiver di punggung.
    ctx.fillStyle = '#6b5a3a';
    var qvx = s.dir === 1 ? dx + 2 : dx + dw - 8;
    ctx.fillRect(qvx, dy + 8, 6, 16);
    // Busur di sisi hadap; glow saat telegraph melepas panah.
    var bwx = s.dir === 1 ? dx + dw - 5 : dx - 1;
    ctx.fillStyle = (tele && Math.floor(t * 10) % 2 === 0) ? '#ffd23f' : '#8a6d3b';
    ctx.fillRect(bwx, dy + 6, 4, 26);
    } // end fallback prosedural
    // Tumpukan tulang saat ambruk (fallback; sprite path memakai fade saja).
    if (crumbled) {
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(dx + 6, dy + dh - 6, dw - 12, 5);
      ctx.fillRect(dx + dw / 2 - 6, dy + dh - 11, 12, 5);
      ctx.fillStyle = '#6b6350';
      ctx.fillRect(dx + 4, dy + dh - 3, dw - 8, 3);
    }
    if (tele) {
      ctx.fillStyle = '#ffd23f';
      var qx = Math.round(s.x + s.w / 2 - 2);
      ctx.fillRect(qx, dy - 18, 5, 10);
      ctx.fillRect(qx, dy - 5, 5, 5);
    }
    if (dFade < 1) ctx.restore();
  }

  /* Stage 5: RAJA SLIME — blob besar + mahkota emas + alis marah.
   * Enraged: semburat merah. Telegraph: kedip putih + tanda seru besar. */
  // Dispatcher gambar boss aktif (slime king / lich) + miniboss.
  function drawBoss() {
    if (!boss || boss.dead) return;
    if (boss.kind === 'lich') drawLich();
    else drawSlimeKing();
  }

  function drawSlimeKing() {
    if (!boss || boss.dead) return;
    var b = boss, t = b.animTime;
    var squash = 1 + 0.06 * Math.sin(t * 6);
    var dw = Math.round(72 / squash), dh = Math.round(64 * squash);
    // Gugur bertahap: topple + ambruk + fade akhir (durasi 1.0 dtk utuh).
    var topple = 0, dFade = 1;
    if (b.state === 'death') {
      var k = clamp(1 - b.deathT / 1.0, 0, 1);
      dh = Math.round(dh * (0.3 + 0.7 * k));
      topple = Math.round(Math.min(8, b.deathT * 20)) * (b.dir === 1 ? 1 : -1);
      if (b.deathT > 0.7) dFade = clamp((1.0 - b.deathT) / 0.3, 0, 1);
    }
    var dx = Math.round(b.x + b.w / 2 - dw / 2) + topple;
    var dy = Math.round(b.y + b.h - dh);
    var tele = b.state === 'telegraph';
    var blink = (b.iframes > 0 && Math.floor(t * 16) % 2 === 0) || (tele && Math.floor(t * 10) % 2 === 0);

    if (dFade < 1) { ctx.save(); ctx.globalAlpha = dFade; }

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
    if (dFade < 1) ctx.restore();
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

  // Coin level: sprite coin.png + animasi bob. Fallback kotak emas bila
  // sprite belum siap/gagal (game tak pernah crash, hitbox tak berubah).
  function drawCoins() {
    var cimg = foeImg(sprites.coin, 0);
    for (var i = 0; i < coins.length; i++) {
      var s = coins[i];
      if (s.taken) continue;
      var bobY = Math.round(s.y + Math.sin(s.bob * 4) * 3);
      if (cimg) {
        ctx.drawImage(cimg, Math.round(s.x - 10), bobY - 10, 20, 20);
      } else {
        var tw = Math.floor(s.bob * 6) % 2 === 0;
        ctx.fillStyle = tw ? '#ffd23f' : '#e8b62a';
        ctx.fillRect(s.x - 7, bobY - 7, 14, 14);
        ctx.fillStyle = '#fff2c9';
        ctx.fillRect(s.x - 3, bobY - 3, 6, 6);
      }
      // Kilau kecil agar kolektibel terbaca di semua tema level.
      if (Math.floor(s.bob * 6) % 4 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(s.x) - 1, bobY - 14, 2, 2);
      }
    }
  }

  /* Stage 11: Treasure Chest visual — closed (sparkle idle + highlight
   * saat player dekat) / opening (bob+glow) / opened (lid + reward icon
   * pop dengan bounce). Sprite PNG bila siap. Reward tetap Gold Shard /
   * Health / Poison — tanpa Coin. */
  function drawChests() {
    var pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    for (var i = 0; i < chests.length; i++) {
      var c = chests[i];
      var bobY = (c.state === 'opening')
        ? Math.round(Math.sin(c.openT * 25) * 2)
        : Math.round(Math.sin(c.bob * 3) * 2);
      var open = c.state === 'opened';
      var cimg = open ? foeImg(sprites.chest, 1) : foeImg(sprites.chest, 0);
      if (cimg) {
        ctx.drawImage(cimg, Math.round(c.x), Math.round(c.y) + bobY, c.w, c.h);
      } else {
        // Fallback: peti kaku (tak pernah placeholder kosong).
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(c.x, c.y + bobY + 10, c.w, c.h - 10);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(c.x + c.w / 2 - 4, c.y + bobY + 16, 8, 8);
      }
      if (!open) {
        // Sparkle idle subtil tiap ~2 dtk.
        if (Math.floor(c.bob * 2) % 4 === 0) {
          ctx.fillStyle = '#fff2c9';
          ctx.fillRect(Math.round(c.x + c.w / 2 - 1), Math.round(c.y) + bobY - 8, 3, 3);
        }
        // Highlight saat player dekat (radius ~110px): bingkai emas tipis.
        var ccx = c.x + c.w / 2, ccy = c.y + c.h / 2;
        var near = Math.abs(pcx - ccx) < 110 && Math.abs(pcy - ccy) < 110;
        if (near && c.state === 'closed') {
          var pulse = 0.35;
          try { pulse = reducedMotion ? 0.35 : 0.30 + 0.15 * Math.sin(nowPerf() / 300); } catch (e) { pulse = 0.35; }
          ctx.fillStyle = 'rgba(255,210,99,' + pulse.toFixed(2) + ')';
          ctx.fillRect(Math.round(c.x) - 2, Math.round(c.y) + bobY - 2, c.w + 4, 2);
          ctx.fillRect(Math.round(c.x) - 2, Math.round(c.y) + bobY + c.h, c.w + 4, 2);
        }
        if (c.state === 'opening') {
          ctx.fillStyle = 'rgba(255,210,99,' + (0.25 + 0.35 * (c.openT / TREASURE_OPEN_T)).toFixed(2) + ')';
          ctx.fillRect(Math.round(c.x) - 3, Math.round(c.y) + bobY - 3, c.w + 6, c.h + 6);
        }
      } else if (c.reward && c.iconT < 1.2) {
        // Reward icon pop: naik + bounce + fade (tanpa alokasi).
        var bounce = 0;
        try { bounce = reducedMotion ? 0 : Math.round(Math.abs(Math.sin(c.iconT * 10)) * -4); } catch (e) { bounce = 0; }
        var iy = Math.round(c.y - 14 - c.iconT * 34) + bounce;
        var a = c.iconT < 0.8 ? 1 : Math.max(0, 1 - (c.iconT - 0.8) / 0.4);
        var rimg = foeImg(sprites.reward, c.reward.visual);
        ctx.save();
        ctx.globalAlpha = a;
        if (rimg) ctx.drawImage(rimg, Math.round(c.x + c.w / 2 - 10), iy, 20, 20);
        else {
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(Math.round(c.x + c.w / 2 - 6), iy, 12, 12);
        }
        ctx.restore();
        if (Math.floor(c.iconT * 12) % 2 === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(c.x + c.w / 2 - 1), iy - 6, 2, 2);
        }
      }
    }
  }

  // Gerbang arena boss: jeruji besi turun dari atas (animasi gateAnim
  // 0 = terbuka/hilang, 1 = tertutup penuh). Tanpa alokasi per-frame.
  function drawGates() {
    if (!gateBounds || gateAnim <= 0.01) return;
    var g = GROUND_TOP;
    var drop = Math.round((1 - gateAnim) * GATE_H);
    for (var i = 0; i < 2; i++) {
      var x = Math.round(i === 0 ? gateBounds.minX - GATE_W : gateBounds.maxX);
      var top = g - GATE_H + drop;
      var hgt = GATE_H - drop;
      if (hgt <= 0) continue;
      // Batang vertikal + 2 sabuk + ujung runcing emas.
      ctx.fillStyle = '#2c3145';
      for (var b = 0; b < 4; b++) ctx.fillRect(x + 1 + b * 4, top, 3, hgt);
      ctx.fillStyle = '#4a5578';
      ctx.fillRect(x, top + 10, GATE_W, 6);
      ctx.fillRect(x, g - 16, GATE_W, 6);
      ctx.fillStyle = '#c9a227';
      for (var s = 0; s < 4; s++) ctx.fillRect(x + 1 + s * 4, top - 6, 3, 6);
      // Rune kunci saat tertutup penuh.
      if (gateAnim >= 1) {
        ctx.fillStyle = '#b46ae0';
        ctx.fillRect(x + GATE_W / 2 - 2, g - 60, 4, 8);
      }
    }
  }
  // Dekorasi subtil arena boss (L2/L4/L5): pilar + panji + obor.
  // Warna mengikuti mood level; miniboss arena (L4) dapat penanda tulang.
  function drawArenaDecor() {
    var arena = Level.bossArena || Level.lichArena;
    if (!arena || (currentLevel !== 2 && currentLevel !== 4 && currentLevel !== 5)) return;
    var g = GROUND_TOP;
    var lich = (Level.bossKind === 'lich') || currentLevel === 4;
    ctx.fillStyle = lich ? '#241a38' : '#2c2140';
    ctx.fillRect(arena.minX - 14, g - 120, 14, 120);
    ctx.fillRect(arena.maxX, g - 120, 14, 120);
    ctx.fillStyle = lich ? '#b46ae0' : '#c9a227';
    ctx.fillRect(arena.minX - 14, g - 120, 14, 8);
    ctx.fillRect(arena.maxX, g - 120, 14, 8);
    ctx.fillStyle = lich ? '#4a3670' : '#a03a3a';
    var fx = Math.round((arena.minX + arena.maxX) / 2 - 20);
    ctx.fillRect(fx, g - 150, 40, 26);
    ctx.fillStyle = lich ? '#e8c9ff' : '#ffd23f';
    ctx.fillRect(fx + 8, g - 144, 24, 6);
    // Obor arena: api 2-frame tanpa alokasi (flicker waktu, murah).
    var fl = Math.floor(nowPerf() / 180) % 2;
    var fh = fl ? 14 : 10;
    ctx.fillStyle = '#e0682a';
    ctx.fillRect(arena.minX - 11, g - 120 - fh, 8, fh);
    ctx.fillRect(arena.maxX + 3, g - 120 - fh, 8, fh);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(arena.minX - 9, g - 120 - fh, 4, fh - 4);
    ctx.fillRect(arena.maxX + 5, g - 120 - fh, 4, fh - 4);
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
    // Shop: mode + equipment aktif (teks, bukan warna saja).
    // Guardian: bar stamina block (batas anti-turtle, regen saat lepas).
    try {
      var _eqm = getEquipment();
      var _mlabel = _eqm.mode === 'GUARDIAN' ? 'GUARDIAN' : (_eqm.mode === 'ARCHER' ? 'ARCHER' : 'SWORD');
      var _wlabel = _eqm.mode === 'ARCHER' ? shopItemById(_eqm.bow).name : shopItemById(_eqm.sword).name;
      ctx.fillStyle = '#c6ccea';
      ctx.font = '11px monospace';
      ctx.fillText(_mlabel + ' • ' + _wlabel, bx, by + bh + 12);
      if (_eqm.mode === 'GUARDIAN') {
        var _bmax = blockMax(), _bpct = _bmax > 0 ? clamp(player.blockStam / _bmax, 0, 1) : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx - 4, by + bh + 16, 120, 10);
        ctx.fillStyle = '#20264d';
        ctx.fillRect(bx, by + bh + 18, 112, 6);
        ctx.fillStyle = _bpct > 0.5 ? '#5aa9ff' : (_bpct > 0.25 ? '#ffd23f' : '#e05252');
        ctx.fillRect(bx, by + bh + 18, Math.round(112 * _bpct), 6);
        ctx.fillStyle = '#c6ccea';
        ctx.fillText('BLOCK', bx, by + bh + 34);
      }
    } catch (e) { /* abaikan */ }

    // --- Progress level (tengah atas): player, checkpoint, goal/boss ---
    var px = 330, pw = 300, py = 16, ph = 12;
    var prog = getProgress();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px - 6, py - 8, pw + 12, ph + 26);
    ctx.fillStyle = '#20264d';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#5a68b0';
    ctx.fillRect(px, py, Math.round(pw * prog), ph);
    // Ujung kanan: goal fisik (L1/L3) atau arena boss/lich (L2/L4/L5).
    var endX = Level.goal ? (Level.goal.x + Level.goal.w / 2)
                          : ((Level.bossSpawn || Level.lichSpawn) ?
                             (Level.bossSpawn || Level.lichSpawn).x :
                             Level.playerSpawn.x + 1);
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

    // --- Coin level + Gold Shard treasure (kanan; kecil agar tak tutup game) ---
    // Baris 1: progres collectible COIN "got/total LVn" (completion = ini).
    // Baris 2: resource GOLD SHARD dari treasure (terpisah, bukan completion).
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VIEW_W - 150, 44, 138, 44);
    var coinImg = foeImg(sprites.coin, 0);
    if (coinImg) ctx.drawImage(coinImg, VIEW_W - 140, 48, 14, 14);
    else {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(VIEW_W - 140, 48, 14, 14);
    }
    ctx.fillStyle = '#fff2c9';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('COIN ' + coinGot() + '/' + coins.length + ' LV' + currentLevel, VIEW_W - 124, 57);
    // Gold Shard terpisah dari coin level (sistem treasure sendiri).
    var gimg = foeImg(sprites.reward, 0);
    if (gimg) ctx.drawImage(gimg, VIEW_W - 140, 70, 14, 14);
    else {
      ctx.fillStyle = '#ffe98a';
      ctx.fillRect(VIEW_W - 140, 70, 14, 14);
    }
    ctx.fillStyle = '#fff2c9';
    ctx.fillText('GOLD x' + (runStats.goldShards || 0), VIEW_W - 124, 78);

    // --- Bar HP foe besar (boss / miniboss aktif; boss diprioritaskan) ---
    var foeBar = (boss && !boss.dead) ? boss : ((miniboss && !miniboss.dead) ? miniboss : null);
    if (foeBar) {
      var foeName = foeBar.name || (foeBar.kind === 'lich' ? 'RAJA LICH' : 'RAJA SLIME');
      var bbw = 300, bbx = VIEW_W / 2 - bbw / 2, bby = 52;
      var bpct = clamp(foeBar.hp / foeBar.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bbx - 4, bby - 18, bbw + 8, 40);
      ctx.fillStyle = '#c6ccea';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(foeBar.enraged ? foeName + ' — MURKA!' : foeName, VIEW_W / 2, bby - 8);
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
    ctx.fillRect(12, 92, 360, 160);
    ctx.fillStyle = '#8fff9f';
    ctx.font = '12px monospace';
    var label = player.state.toUpperCase();
    ctx.fillText('STATE:' + label + ' FACE:' + (player.facing === 1 ? 'R' : 'L'), 20, 106);
    ctx.fillText('FPS:' + fps.toFixed(0) + ' (' + msShown.toFixed(1) + 'ms)', 20, 122);
    ctx.fillText('FT avg:' + ftAvg.toFixed(1) + 'ms peak:' + ftPeak.toFixed(1) +
      'ms p95:' + ftP95.toFixed(1) + 'ms', 20, 138);
    ctx.fillText('POS:' + Math.round(player.x) + ',' + Math.round(player.y) +
      ' VY:' + Math.round(player.vy) + (player.onGround ? ' GND' : ' AIR'), 20, 154);
    ctx.fillText('CAM:' + Math.round(camera.x) + ' PROG:' + Math.round(getProgress() * 100) +
      '% CP:' + Level.checkpoints.map(function (c) { return c.activated ? 1 : 0; }).join('') +
      ' GS:' + gameState, 20, 170);
    ctx.fillText('PART:' + particleCount + '/' + MAX_PARTICLES +
      ' EN:' + enemies.length + ' SHOT:' + shots.length +
      ' SHAKE:' + shake.mag.toFixed(1), 20, 186);
    var dprTxt = '1';
    try { dprTxt = String(window.devicePixelRatio || 1); } catch (e) { /* abaikan */ }
    ctx.fillText('DSP:' + canvas.width + 'x' + canvas.height +
      ' DPR:' + dprTxt + ' x' + renderScale.toFixed(2), 20, 202);
    ctx.fillText('ATK box:' + (player.attackBox ? 'ON' : 'off') +
      ' EN0 hp:' + (enemies[0] ? enemies[0].hp : '-') +
      ' st:' + (enemies[0] ? enemies[0].state : '-') +
      ' LV:' + currentLevel +
      (boss ? ' BOSS:' + boss.hp + '/' + boss.state : ''), 20, 218);
    ctx.fillText('RM:' + (reducedMotion ? 'ON' : 'off') +
      ' PAUSE:' + (paused ? 'ON' : 'off') +
      ' MOOD:' + musicSetIdx, 20, 234);
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
  var lastPauseBtnState = '';
  // Stage 10: ring histori frame-time untuk avg/peak/p95 (DEBUG saja).
  // Preallocated sekali (bukan per-frame) agar tidak menambah GC.
  var FT_N = 120, ftRing = new Float64Array(120), ftIdx = 0, ftCount = 0;
  var ftAvg = 16.7, ftPeak = 16.7, ftP95 = 16.7;

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

  /* Boss arena gates: saat raja (slime king / lich) diperkenalkan,
   * gerbang menutup (animasi turun) dan mengunci player + raja di arena.
   * Terbuka lagi saat raja gugur. L5 tetap terkunci selama interlude.
   * Miniboss tidak dikunci (hanya raja). Kunci = clamp-x logis (visual
   * jeruji menyusul); boss sudah di-clamp arena oleh AI-nya sendiri. */
  var GATE_H = 150, GATE_W = 16, GATE_T = 0.6;
  var gateTarget = 0, gateAnim = 0, gateBounds = null;

  // Arena raja aktif (null = terbuka). Hanya boss + introduced.
  function arenaLock() {
    if (gameState !== 'playing' || !Level.bossArena) return null;
    if (boss && !boss.dead && boss.introduced) return Level.bossArena;
    // L5 gauntlet: tetap terkunci saat jeda antar raja.
    if (currentLevel === 5 && finalPhase === 'inter') return Level.bossArena;
    return null;
  }

  function updateGates(dt) {
    var lock = arenaLock();
    if ((lock && !gateTarget) || (!lock && gateTarget)) {
      gateTarget = lock ? 1 : 0;
      if (lock) {
        gateBounds = { minX: lock.minX, maxX: lock.maxX };
        // Snap masuk bila player di luar (tak ada jebakan di luar gerbang).
        var pcx = player.x + player.w / 2;
        if (pcx < lock.minX) player.x = lock.minX + 2;
        else if (pcx > lock.maxX) player.x = lock.maxX - player.w - 2;
        player.vx = 0;
        // FX bantingan: debu + denting metal + shake (cap existing).
        // Tanpa toast agar judul nama raja tetap terbaca.
        burst(lock.minX, GROUND_TOP - 40, 8, '#8a8fa8', 140, 0.5, 3, 250);
        burst(lock.maxX, GROUND_TOP - 40, 8, '#8a8fa8', 140, 0.5, 3, 250);
        AudioManager.play('shieldBlock');
        triggerScreenShake(SHAKE_HURT, 0.3);
      }
    }
    // Animasi menuju target (reduced-motion: snap instan).
    if (reducedMotion) gateAnim = gateTarget;
    else if (gateAnim < gateTarget) gateAnim = Math.min(gateTarget, gateAnim + dt / GATE_T);
    else if (gateAnim > gateTarget) gateAnim = Math.max(gateTarget, gateAnim - dt / GATE_T);
    // Kunci logis: player tak bisa keluar selagi terkunci (walau animasi jalan).
    if (lock) {
      if (player.x < lock.minX) { player.x = lock.minX; if (player.vx < 0) player.vx = 0; }
      if (player.x + player.w > lock.maxX) { player.x = lock.maxX - player.w; if (player.vx > 0) player.vx = 0; }
    }
  }

  /* Stage 5: satu langkah simulasi gameplay. Dipakai frame() dan
   * diekspos sebagai step() untuk testing deterministik headless. */
  function updatePlaying(dt) {
    // Stage 11: hit-stop micro-freeze — dunia diam sangat singkat saat
    // impact (bukan victory/death/pause). Timer saja yang jalan.
    if (hitStopT > 0) {
      hitStopT -= dt;
      if (hitStopT < 0) hitStopT = 0;
      return;
    }
    // M3: R/Enter saat PLAYING -> respawn checkpoint (ekspektasi HUD).
    // Jangan reset campaign/progression; pakai respawn() existing.
    // Abaikan saat victory armed atau player death (hindari batal victory/death flow).
    if (Input.restartPressed) {
      Input.restartPressed = false;
      if (!victoryArmed && player.state !== 'death') {
        respawn();
        return;
      }
    }
    timeElapsed += dt;
    levelStats.time += dt;
    if (toast.t > 0) toast.t -= dt;
    updatePlayer(dt);
    updateSkillCooldowns(dt);
    Combat.resolvePlayerAttack();
    for (var i = 0; i < enemies.length; i++) {
      if (enemies[i].kind === 'skeletonArcher') updateArcher(enemies[i], dt);
      else updateSlime(enemies[i], dt);
    }
    // Hapus slime yang selesai death (in-place, tanpa alokasi filter).
    for (var r = enemies.length - 1; r >= 0; r--) {
      if (enemies[r].dead) {
        runStats.kills++;
        levelStats.kills++;
        if (!save.achievements.first_blood) unlockAchievement('first_blood');
        enemies[r] = enemies[enemies.length - 1];
        enemies.pop();
      }
    }
    if (boss && !boss.dead) {
      if (boss.kind === 'lich') updateLich(boss, dt);
      else updateBoss(boss, dt);
    }
    if (miniboss && !miniboss.dead) updateMiniboss(miniboss, dt);
    refreshBlockBtn(); // SHIELD button hanya Guardian saat playing
    updateGates(dt);
    updateShocks(dt);
    updateShots(dt);
    updatePlayerShots(dt);
    tickDots(dt);
    Combat.resolveEnemyAttacks();
    checkCheckpoints();
    checkGoal();
    updateCoins(dt);
    updateChests(dt);
    updateShake(dt);
    updateParticles(dt);

    // Kemenangan boss -> Complete sesuai level (jeda agar FX terbaca).
    if (victoryArmed) {
      victoryT += dt;
      if (victoryT >= VICTORY_DELAY) {
        victoryArmed = false;
        completeCurrentLevel();
      }
    }
    // Final L5: interlude 2 dtk lalu lich kedua masuk arena.
    if (currentLevel === 5 && finalPhase === 'inter') {
      finalT += dt;
      if (finalT >= 2.0 && Level.lichSpawn) {
        boss = createLich(Level.lichSpawn, Level.lichArena, { hpMul: 0.85 });
        finalPhase = 'lich';
        AudioManager.play('lichSummon');
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
    drawLevelDecor();
    drawCheckpoints();
    drawGoal();
    drawCoins();
    drawChests();
    drawBonePiles();
    drawGooPiles();
    drawEnemies();
    drawBoss();
    drawMiniboss();
    drawPlayer();
    drawSlash();
    drawShocks();
    drawShots();
    drawPlayerShots();
    drawParticles();
    drawGates(); // jeruji di depan semua (tak bisa dilewati visual)
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
    drawLevelDecor();
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
      // Histori frame-time (ms) untuk avg/peak/p95.
      ftRing[ftIdx] = dt * 1000;
      ftIdx = (ftIdx + 1) % FT_N;
      if (ftCount < FT_N) ftCount++;
      if (fpsN >= 20) {
        fpsShown = fpsAcc / fpsN;
        msShown = 1000 / (fpsShown > 0 ? fpsShown : 60);
        fpsAcc = 0; fpsN = 0;
        // Snapshot avg/peak/p95 dari ring (DEBUG saja, tiap 20 frame).
        var sum = 0, peak = 0, k;
        for (k = 0; k < ftCount; k++) {
          var vv = ftRing[k];
          sum += vv;
          if (vv > peak) peak = vv;
        }
        ftAvg = ftCount ? sum / ftCount : 0;
        ftPeak = peak;
        var cp = [];
        for (k = 0; k < ftCount; k++) cp.push(ftRing[k]);
        cp.sort(function (a, b) { return a - b; });
        ftP95 = ftCount ? cp[Math.min(ftCount - 1, Math.floor(ftCount * 0.95))] : 0;
      }
    }

    ctx.imageSmoothingEnabled = false;

    // Transisi level berjalan di semua state non-pause.
    updateTrans(dt);
    // Scheduler BGM (lookahead via Web Audio clock; no-op bila diam).
    AudioManager.musicTick();
    // Sinkron tombol pause DOM hanya saat state berubah (tanpa DOM per-frame).
    var pkState = gameState + (paused ? 'P' : '');
    if (pkState !== lastPauseBtnState) {
      lastPauseBtnState = pkState;
      refreshPauseBtn();
    }

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
      // R / Enter = lanjut ke level berikutnya (gate unlock).
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
  btnGameCampaign = document.getElementById('btn-gamecampaign');
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
  // Stage 10: campaign select + explicit pause.
  btnCampaign = document.getElementById('btn-campaign');
  campaignEl = document.getElementById('campaign');
  achievementsEl = document.getElementById('achievements');
  campStatusEl = document.getElementById('campaign-status');
  for (var cni = 1; cni <= 5; cni++) {
    campBtns[cni - 1] = document.getElementById('btn-camp-' + cni);
    campStats[cni - 1] = document.getElementById('camp-status-' + cni);
  }
  btnCampBack = document.getElementById('btn-camp-back');
  // Weapon Shop.
  btnShop = document.getElementById('btn-shop');
  shopEl = document.getElementById('shop');
  shopCoinEl = document.getElementById('shop-coin');
  shopListEl = document.getElementById('shop-list');
  shopMsgEl = document.getElementById('shop-msg');
  shopTabBtns.sword = document.getElementById('shop-tab-sword');
  shopTabBtns.shield = document.getElementById('shop-tab-shield');
  shopTabBtns.bow = document.getElementById('shop-tab-bow');
  shopPrevImg = document.getElementById('shop-prev-img');
  shopPrevWeapon = document.getElementById('shop-prev-weapon');
  shopPrevName = document.getElementById('shop-prev-name');
  shopPrevTier = document.getElementById('shop-prev-tier');
  shopPrevPrice = document.getElementById('shop-prev-price');
  shopPrevDesc = document.getElementById('shop-prev-desc');
  shopPrevStats = document.getElementById('shop-prev-stats');
  shopPrevSpecial = document.getElementById('shop-prev-special');
  shopPrevAction = document.getElementById('shop-prev-action');
  shopModeBtns.SWORD = document.getElementById('shop-mode-sword');
  shopModeBtns.GUARDIAN = document.getElementById('shop-mode-guardian');
  shopModeBtns.ARCHER = document.getElementById('shop-mode-archer');
  shopBackBtn = document.getElementById('shop-back');
  pauseEl = document.getElementById('pause');
  btnPause = document.getElementById('btn-pause');
  btnResume = document.getElementById('btn-resume');
  btnPauseRespawn = document.getElementById('btn-pause-respawn');
  btnPauseMenu = document.getElementById('btn-pause-menu');
  btnBlockEl = document.getElementById('btn-block');
  applyReducedMotionPref();
  try {
    var rmq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (rmq && rmq.addEventListener) {
      rmq.addEventListener('change', function (e) { reducedMotion = !!e.matches; });
    }
  } catch (e) { /* abaikan */ }

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
  if (btnBlockEl) {
    btnBlockEl.style.display = '';
    btnBlockEl.style.visibility = 'visible';
    btnBlockEl.style.opacity = '1';
  }
  bindHoldButton('btn-block',
    function () { Input.blockHeld = true; },
    function () { Input.blockHeld = false; });

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
  onClick(btnCampaign, function () { openCampaign(); });
  var btnAchievements = document.getElementById('btn-achievements');
  if (btnAchievements) onClick(btnAchievements, function () { openAchievements(); });
  var btnDiffNormal = document.getElementById('btn-diff-normal');
  if (btnDiffNormal) onClick(btnDiffNormal, function () { save.difficulty = 'normal'; persistSave(); playCampaignLevel(1); });
  var btnDiffHard = document.getElementById('btn-diff-hard');
  if (btnDiffHard)   onClick(btnDiffHard, function () { if (btnDiffHard.disabled) return; save.difficulty = 'hard'; persistSave(); playCampaignLevel(1); });
  var btnSkills = document.getElementById('btn-skills');
  if (btnSkills) onClick(btnSkills, function () { openSkills(); });
  onClick(btnShop, function () { openShop(); });
  onClick(shopBackBtn, function () { shopBack(); });
  onClick(shopTabBtns.sword, function () { shopSetTab('sword'); });
  onClick(shopTabBtns.shield, function () { shopSetTab('shield'); });
  onClick(shopTabBtns.bow, function () { shopSetTab('bow'); });
  onClick(shopPrevAction, function () { if (shopSel) shopCardAction(shopSel); });
  onClick(shopModeBtns.SWORD, function () { setMode('SWORD'); });
  onClick(shopModeBtns.GUARDIAN, function () { setMode('GUARDIAN'); });
  onClick(shopModeBtns.ARCHER, function () { setMode('ARCHER'); });
  onClick(btnCampBack, function () { campaignBack(); });
  var btnAchieveBack = document.getElementById('btn-achieve-back');
  if (btnAchieveBack) onClick(btnAchieveBack, function () { achievementsBack(); });
  var btnSkillsBack = document.getElementById('btn-skills-back');
  if (btnSkillsBack) onClick(btnSkillsBack, function () { skillsBack(); });
  for (var cpi = 1; cpi <= 5; cpi++) {
    (function (n) {
      onClick(campBtns[n - 1], function () { playCampaignLevel(n); });
    })(cpi);
  }
  onClick(btnControls, function () { showMenuPanel('controls'); });
  onClick(btnAbout, function () { showMenuPanel('about'); });
  onClick(btnBackC, function () { showMenuPanel('main'); });
  onClick(btnBackA, function () { showMenuPanel('main'); });
  onClick(btnNext, function () { nextLevel(); });
  onClick(btnReplay, function () { startTrans(currentLevel); });
  onClick(btnLvlMenu, function () { toMenu(); });
  onClick(btnAgain2, function () { playFresh(); });
  onClick(btnGameMenu, function () { toMenu(); });
  // Stage 11: CAMPAIGN dari victory -> menu dulu (openCampaign parent-nya
  // Main Menu), lalu buka panel campaign. Keyboard + touch friendly.
  onClick(btnGameCampaign, function () { toMenu(); openCampaign(); });
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
  // Stage 10: explicit pause (null-guard, touch-friendly).
  // NOTE: tombol pause memakai click mentah (tanpa bunyi 'click' onClick)
  // agar tidak ada SFX baru saat pause; resume via tombol tetap hening.
  if (btnPause) btnPause.addEventListener('click', function () {
    if (gameState !== 'playing') return;
    togglePause();
  });
  onClick(btnResume, function () { resumeGame(); });
  onClick(btnPauseRespawn, function () {
    if (pauseEl) pauseEl.classList.add('hidden');
    setPaused(false);
    respawn();
  });
  onClick(btnPauseMenu, function () { toMenu(); });

  // Navigasi keyboard: menu (panel utama/kontrol/about/campaign), settings,
  // dialog reset, dan explicit pause. Atas/Bawah pindah tombol, Escape kembali.
  // Tidak menyentuh input gameplay. P/Esc saat playing = pause/resume.
  var menuNavIds = ['btn-play', 'btn-campaign', 'btn-shop', 'btn-controls', 'btn-settings', 'btn-about'];
  var campNavIds = ['btn-camp-1', 'btn-camp-2', 'btn-camp-3', 'btn-camp-4',
    'btn-camp-5', 'btn-camp-back'];
  // Navigasi settings: Atas/Bawah antar kontrol, Escape kembali ke menu.
  var settingsNavIds = ['set-sfx', 'set-sfx-vol-down', 'set-sfx-vol-up',
    'set-music', 'set-music-vol-down', 'set-music-vol-up',
    'set-input', 'btn-reset-progress', 'btn-settings-back'];
  var resetNavIds = ['btn-reset-cancel', 'btn-reset-confirm'];
  // Navigasi shop: Kiri/Kanan ganti tab, Atas/Bawah ganti item,
  // Enter = BUY/EQUIP item terpilih, Esc kembali ke menu.
  var shopNavIds = ['shop-tab-sword', 'shop-tab-shield', 'shop-tab-bow',
    'shop-prev-action', 'shop-mode-sword', 'shop-mode-guardian',
    'shop-mode-archer', 'shop-back'];

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
    if (gameState === 'playing') {
      // Explicit pause: P toggle, Esc toggle (valid: pause <-> resume).
      if (e.code === 'KeyP') {
        togglePause();
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.code === 'Escape') {
        togglePause();
        if (e.preventDefault) e.preventDefault();
        return;
      }
      return; // sisa input playing diurus listener gameplay
    }
    // Shop: state sendiri (bukan menu) — Esc kembali, panah navigasi.
    if (gameState === 'shop') {
      if (e.code === 'Escape') {
        shopBack();
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        var order = ['sword', 'shield', 'bow'];
        var ix = 0;
        for (var ti = 0; ti < order.length; ti++) { if (order[ti] === shopTab) ix = ti; }
        ix = (ix + (e.code === 'ArrowRight' ? 1 : order.length - 1)) % order.length;
        shopSetTab(order[ix]);
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        var list = shopItemsByCategory(shopTab);
        var ci2 = 0;
        for (var cj = 0; cj < list.length; cj++) { if (list[cj].id === shopSel) ci2 = cj; }
        if (list.length) {
          ci2 = (ci2 + (e.code === 'ArrowDown' ? 1 : list.length - 1)) % list.length;
          shopSel = list[ci2].id;
          refreshShopUI();
        }
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.code === 'Enter') {
        if (shopSel) shopCardAction(shopSel);
        if (e.preventDefault) e.preventDefault();
        return;
      }
      return;
    }
    if (gameState !== 'menu') return;
    // Campaign overlay di atas menu: Esc kembali, panah navigasi level.
    if (isCampaignOpen()) {
      if (e.code === 'Escape') {
        campaignBack();
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown' && e.code !== 'Enter') return;
      if (e.code === 'Enter') return; // aktivasi native via fokus tombol
      if (e.preventDefault) e.preventDefault();
      focusNavId(campNavIds, e.code === 'ArrowDown');
      return;
    }
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
  window.addEventListener('blur', function () { setPaused(true); clearInput(); });
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
  } catch (e) { skyGrad = null; skyGrads = [null, null, null, null, null]; }

  // Audio unlock saat interaksi pertama (autoplay policy). Sekali saja.
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { AudioManager.unlock(); }, { once: true });
  });

  // Cegah scroll/zoom halaman saat sentuh area game (Android).
  // Pengecualian: area scroll Shop (#shop-body) harus bisa swipe satu jari —
  // jangan preventDefault di sana agar touch scroll + mouse wheel normal.
  var container = document.getElementById('canvas-container');
  if (container) {
    container.addEventListener('touchmove', function (e) {
      try {
        var t = e.target;
        if (t && t.closest && t.closest('#shop-body')) return;
      } catch (err) { /* abaikan, fallback preventDefault */ }
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
    version: GAME_VERSION,
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
    hurtPlayer: function (n, x, t) { playerTakeDamage(n, x, t); },
    respawn: respawn,
    restart: restart,
    // Test-only: paksa state akhir agar "resume setelah Game Over / Win"
    // bisa diverifikasi headless tanpa menjalankan loop penuh.
    forceGameOver: showGameOver,
    forceWin: showWin,
    // Stage 5: level, menu, boss, coin, stats, transisi, stepping.
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
    // Level collectible = COIN (progres got/total/at). Completion = ini.
    getCoins: function () {
      var first = null;
      for (var i = 0; i < coins.length; i++) {
        if (!coins[i].taken) { first = { x: coins[i].x, y: coins[i].y }; break; }
      }
      return { got: coinGot(), total: coins.length, at: first };
    },
    // Treasure Gold Shard = resource terpisah (run total, bukan completion).
    getGoldShards: function () { return runStats.goldShards || 0; },
    getStats: function () {
      return { runKills: runStats.kills, runCoins: runStats.coins,
               runGoldShards: runStats.goldShards || 0,
               levelKills: levelStats.kills, levelCoins: levelStats.coins,
               levelTime: levelStats.time, deaths: deaths };
    },
    getBest: loadBest,
    // Stage 9: skeleton campaign + lich + final (untuk regression tests).
    getLevelCount: function () { return Levels.length; },
    forceStartLevel: forceStartLevel,
    getMiniboss: function () { return miniboss; },
    hurtMiniboss: function (n, x) { return hurtMiniboss(n, x); },
    getShots: function () { return shots; },
    getFinalPhase: function () { return finalPhase; },
    getLichPhase: function (b) { return lichPhase(b || boss); },
    spawnShot: spawnShot,
    fireArrow: fireArrow,
    // Treasure (behavior tests).
    getChests: function () { return chests; },
    getBonePiles: function () { return bonePiles; },
    getGooPiles: function () { return gooPiles; },
    getPitDead: function () { return pitDead.slice(); },
    // Stage boss gate (test): kunci logis + progres animasi + bounds.
    getGate: function () {
      return { locked: !!arenaLock(), anim: gateAnim,
        bounds: gateBounds ? { minX: gateBounds.minX, maxX: gateBounds.maxX } : null };
    },
    pickReward: pickTreasureReward,
    getRewards: function () { return TREASURE_REWARDS; },
    debugReward: function (type) {
      var rw = TREASURE_REWARDS[type];
      if (!rw) return false;
      applyTreasureReward({ reward: rw, x: player.x, y: player.y, w: 0, h: 0 });
      return true;
    },
    getSprites: function () { return sprites; },
    drawOnce: function () { drawWorld(); drawHUD(); return true; },
    // Weapon Shop (test hooks, tidak memengaruhi gameplay).
    shopItems: SHOP_ITEMS,
    tierMeta: TIER_META,
    shopItemById: shopItemById,
    shopItemsByCategory: shopItemsByCategory,
    isOwned: isOwned,
    shopBalance: shopBalance,
    buyItem: buyItem,
    equipItem: equipItem,
    setMode: setMode,
    getMode: playerMode,
    getEquipment: getEquipment,
    openShop: openShop,
    shopBack: shopBack,
    isShopOpen: isShopOpen,
    refreshShopUI: refreshShopUI,
    shopCardAction: shopCardAction,
    shopStatBars: shopStatBars,
    getShopRender: function () { return JSON.parse(JSON.stringify(shopRender)); },
    getShopTab: function () { return shopTab; },
    setShopTab: function (t) { return shopSetTab(t); },
    getShopSel: function () { return shopSel; },
    setShopSel: function (id) { if (shopItemById(id)) { shopSel = id; refreshShopUI(); return true; } return false; },
    getPlayerShots: function () { return playerShots; },
    firePlayerArrow: firePlayerArrow,
    blockMax: blockMax,
    isBlockVisible: function () {
      try { return !!(btnBlockEl && btnBlockEl.style.display !== 'none'); }
      catch (e) { return false; }
    },
    // Weapon overlay (test hooks).
    weaponKey: wKey,
    weaponVariants: WEAPON_VARIANT,
    weaponFile: weaponFile,
    getWeaponOverlay: function (cat, forceUp) {
      var o = pickWeaponOverlay(cat, forceUp);
      return { key: o.key, ox: o.ox, oy: o.oy };
    },
    swordStats: function () { return JSON.parse(JSON.stringify(swordStats())); },
    shieldStats: function () { return JSON.parse(JSON.stringify(shieldStats())); },
    bowStats: function () { return JSON.parse(JSON.stringify(bowStats())); },
    // Stage 11: sprite player per state (test mapping animasi).
    playerSprite: playerCurrentSprite,
    foeFrameFor: foeFrameFor,
    bossFrameFor: bossFrameFor,
    // Hardening hooks (behavior tests, tidak memengaruhi gameplay).
    getVictoryArmed: function () { return victoryArmed; },
    getShocks: function () { return shocks; },
    // Stage 11: hit-stop hooks (tanpa memengaruhi gameplay).
    getHitStop: function () { return hitStopT; },
    hitStop: triggerHitStop,
    getShakeMag: function () { return shake.mag; },
    // Stage 10: campaign select + explicit pause + reduced motion.
    openCampaign: openCampaign,
    campaignBack: campaignBack,
    isCampaignOpen: isCampaignOpen,
    refreshCampaignUI: refreshCampaignUI,
    playCampaignLevel: playCampaignLevel,
    pauseGame: pauseGame,
    resumeGame: resumeGame,
    togglePause: togglePause,
    isPauseOpen: isPauseOpen,
    getReducedMotion: function () { return reducedMotion; },
    setReducedMotion: setReducedMotion,
    // Stage 6: save/settings/state untuk UI + testing.
    getSave: function () {
      return JSON.parse(JSON.stringify(save));
    },
    _achieveDefs: function () { return ACHIEVEMENT_DEFS; },
    _skillsDefs: function () { return SKILLS; },
    _refreshAchievementsUI: refreshAchievementsUI,
    _refreshSkillsUI: refreshSkillsUI,
    _openAchievements: openAchievements,
    _openSkills: openSkills,
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
