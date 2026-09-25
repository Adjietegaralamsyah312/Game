# Changelog — Knight Platformer

## [1.2.0] — Weapon Visuals + Scrollable Shop

- 40 weapon overlay PNG 32x32: pedang (down/horiz/up/back) × 5,
  perisai (side/front) × 5, bow (side/drawn) × 5 — equipped item terlihat beda
- Render: CHARACTER BASE + WEAPON OVERLAY + FX, attachment per-(mode,state),
  draw order base → shield → sword/bow → FX, tanpa alokasi per-frame
- Epic FX visual: slash tint Shadowfang/Sunfire, block flash Aegis/Bastion,
  aura Bastion (stats/mekanik tak berubah)
- Shop scrollable: overflow-y auto + momentum, touch-action pan-y,
  guard touchmove, wheel desktop, keyboard utuh, reset scroll per tab,
  layout kolom layar kecil, safe-area
- Preview [karakter + senjata] per item.id via weaponFile()
- Save tetap v4; 302 automated test PASS

## [1.1.0] — Weapon Shop

- Weapon Shop di Main Menu: PEDANG / PERISAI / PEMANAH, 15 item data-driven
  (Common/Uncommon/Rare/Epic), BUY/EQUIP/EQUIPPED, NOT ENOUGH COINS guard,
  pembelian atomik, preview karakter + stat bar dari data
- 3 class: SWORD KNIGHT, GUARDIAN KNIGHT (block), ARCHER (aim/shoot ranged);
  18 sprite PNG lokal 32x32 (guardian + archer, baseline 26)
- Mekanik: sword damage/speed/reach + Shadow Poison + Sunfire burn (terkontrol);
  shield block frontal + Tower/Aegis/Bastion (aura berbatas); bow projectile
  pool bounded 8 (wind trail, lightning chain, dragon pierce)
- Save schema v4 (migrasi v1/v2/v3 → v4, starter default, progres lestari)
- SFX baru: shopOpen/buy/buyFail/equip/bowShot/block (hormat SFX setting)
- Kontrol: `K`/`Shift`/🛡 block; 282 automated test PASS

## [1.0.0] — Final Release

- 5-level campaign: Slime Grounds, Slime Dominion, Skeleton Fortress,
  Lich Domain, Final Convergence
- Skeleton faction: Skeleton Sword, Skeleton Defender (frontal guard),
  Skeleton Archer (ranged + pooled projectiles)
- Miniboss PANGLIMA TULANG (2 pola + enrage + HP bar)
- Boss RAJA SLIME (L2) dan RAJA LICH 3-phase + summon (L4, final L5)
- Final gauntlet L5: RAJA SLIME → interlude → RAJA LICH → GAME COMPLETE
  (death mengulang gauntlet dari awal, by design)
- Campaign Select (replay level terbuka, tanpa bypass progression)
- Explicit pause (tombol ⏸, P/Esc; freeze + BGM suspend + tanpa input bocor)
- Input Pointer Events (multi-touch, anti double by-design, pointercancel aman)
- Settings (SFX/music/input/reset) + persistence save v2 (migrasi aman dari v1)
- BGM/SFX prosedural Web Audio (mood per level, single scheduler)
- Mobile support: touch controls, responsif portrait/landscape, safe-area
- Accessibility: dialog roles/fokus/Esc, pinch zoom diizinkan, reduced-motion
- Hardening: ghost-attack fix, victory-race sterilization, double-gravity fix,
  attack-input isolation, unlock gate, defender iframe fairness,
  archer retreat/leash stability, projectile/platform collision
- Debug overlay: FPS, avg/peak/p95 frame time, enemy/projectile/particle
- OG social preview lokal 1200x630
