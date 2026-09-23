# Knight Platformer — Content Expansion Build

![Ksatria](assets/knight/idle_0.png)

Game platformer 2D side-view: ksatria pixel-art 32x32. Dari menu utama,
mainkan **Level 1** (lewati 2 celah, kalahkan 3 slime, kumpulkan Gold Shard,
capai FINISH), lanjut ke **Level 2** (varian Fast & Heavy Slime, 3 celah,
8 shard), dan kalahkan **RAJA SLIME** di arena boss.

**Status: Content Expansion Build** — playable: https://adjietegaralamsyah312.github.io/Game/

## Fitur utama

- Menu utama (PLAY / CONTROLS / ABOUT, navigasi keyboard + sentuh)
- 2 level + transisi fade, reset level tanpa reload browser
- Level 1: layout original + rute 6 Gold Shard
- Level 2: traversal baru, 3 celah, checkpoint, arena boss
- Varian musuh reusable: Fast Slime (cepat, HP rendah), Heavy Slime
  (kuat, tahan knockback, telegraph jelas); slime klasik tak berubah
- Boss RAJA SLIME: HP bar, 3 pola (strike, charge, shockwave), telegraph,
  enrage di HP rendah, death FX + kemenangan
- Collectible Gold Shard (counter `got/total` di HUD) + suara pickup
- Stats per-level & total (musuh, shard, waktu, mati) + best lokal
- Layar Level Complete (NEXT/REPLAY/MENU) & Game Complete (PLAY AGAIN/MENU)
- Kamera smooth, parallax, partikel pool, screen shake, pause aman,
  debug overlay (`DEBUG=true`)

## Kontrol desktop

| Tombol | Aksi |
|---|---|
| `A` / `D` atau `←` / `→` | Bergerak kiri / kanan |
| `Space` / `W` / `↑` | Lompat (tahan = lebih tinggi) |
| `J` / `X` | Serang pedang |
| `R` / `Enter` | Respawn / next / main lagi (kontekstual) |
| `↑` / `↓` + `Enter`, `Esc` | Navigasi menu / kembali |

## Kontrol mobile (Android)

Tombol sentuh di bawah kanvas: **◀ ▶** gerak, **⤒** lompat, **❖** serang.
Multi-touch didukung (mis. tahan ◀ + ketuk ⤒). Semua tombol menu & layar
selesai touch-friendly (min 48px). Guard 500 ms mencegah double-trigger
touch + mouse emulasi.

## Tech stack

HTML5 Canvas + JavaScript vanilla + CSS — tanpa framework, tanpa dependency,
tanpa CDN. Satu file `game.js` agar tetap jalan via `file://` dan kompatibel
dengan GitHub Pages subpath `/Game/` (semua path relatif). Grafis musuh
baru & boss prosedural (Canvas pixel-style).

## Struktur project

```
knight_game/
├── index.html          # kanvas + overlay (menu/clear) + tombol + metadata
├── game.js             # seluruh game (menu, 2 level, varian, boss, ~2400 baris)
├── style.css           # tema + responsif + safe-area Android
├── test.js             # 77 automated test headless (node test.js)
├── README.md           # file ini
└── assets/knight/      # 18 sprite PNG (idle/run/jump/fall/attack/hurt/death)
```

## Cara menjalankan lokal

```bash
cd /root/project/knight_game
python3 -m http.server 8000
# buka http://localhost:8000
```

Atau buka `index.html` langsung. Audio aktif setelah interaksi pertama
(aturan autoplay browser).

## Cara menjalankan test

```bash
node --check game.js
node --check test.js
node test.js
git diff --check
```

77 test (65 dasar + 12 Stage 5: menu, level switching/reset, varian,
pickup, transisi boss, boss death, level/game complete, stats, transisi,
isolasi input) — target semua PASS, 0 FAIL.

## Spesifikasi minimum yang disarankan

- Android kelas menengah (Chrome modern), RAM 3 GB+, layar 360px ke atas
- Backing store kanvas dibatasi maks 2x DPR; pool partikel 120

## Catatan pengujian

- **FPS nyata di Android perlu physical testing** (aktifkan `DEBUG=true` dan
  baca overlay FPS/frame-time di perangkat). Dokumen ini tidak mengklaim
  angka performa, dukungan perangkat, atau benchmark apa pun.
- Yang masih butuh uji fisik: FPS di HP lemah, rasa tombol multi-touch +
  menu di layar kecil, pause saat telepon/notifikasi, rotasi
  portrait/landscape, audio unlock di Chrome Android.

## Project status & future improvements

- Status: Content Expansion Build, live di GitHub Pages.
- Repository: https://github.com/Adjietegaralamsyah312/Game
- Ide lanjutan (belum dikerjakan): level tambahan, pola boss baru,
  musik latar, penyimpanan progres antar-sesi, pengujian FPS
  terdokumentasi di perangkat fisik.
