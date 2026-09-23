# Changelog — Knight Platformer

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
