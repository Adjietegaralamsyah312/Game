# Knight Platformer — Content Expansion Build

![Ksatria](assets/knight/idle_0.png)

Game platformer 2D side-view: ksatria pixel-art 32x32. Dari menu utama,
mainkan **Level 1** (kumpulkan shard, kalahkan slime, aktifkan checkpoint,
capai FINISH), lanjut ke **Level 2** (lewati obstacle/gap, kumpulkan shard,
gunakan checkpoint, kalahkan **RAJA SLIME**).

**Status: Content Expansion Build** — playable: https://adjietegaralamsyah312.github.io/Game/

## Fitur utama (Stage 5)

- Menu utama (PLAY / CONTROLS / SETTINGS / ABOUT, navigasi keyboard + sentuh)
- 2 level + transisi fade, reset level tanpa reload browser
- Level 1: layout original cerah (onboarding) + 6 Gold Shard tier
  mudah/menengah/sulit (satu di atas celah = risk/reward)
- Level 2: tema gelap + blood moon, traversal baru, 3 celah, checkpoint,
  encounter Fast solo / Heavy solo / kombo Fast+Heavy, arena boss berobor
- Varian musuh reusable: Fast Slime (cepat, HP rendah), Heavy Slime
  (kuat, tahan knockback, telegraph jelas); slime klasik tak berubah
- Boss RAJA SLIME: intro arena, HP bar, 3 pola (strike, charge, shockwave),
  telegraph, enrage (visual + debu charge), death FX + kemenangan
- Collectible Gold Shard (counter `got/total` di HUD) + suara pickup
- Stats per-level & total (musuh, shard, waktu, mati) + best lokal
- Layar Level Complete (NEXT/REPLAY/MENU) & Game Complete (PLAY AGAIN/MENU)
- Kamera smooth, parallax, partikel pool, screen shake, pause aman,
  debug overlay (`DEBUG=true`)

## Settings (Stage 6)

Dari Main Menu → **SETTINGS** (atau `↑`/`↓` + `Enter`, `Esc` kembali):

- **SFX ON/OFF** + volume 0–100% (berlaku langsung, tanpa reload)
- **Music ON/OFF** + volume 0–100% (BGM prosedural Web Audio,
  berlaku langsung)
- **Input favorit**: AUTO / KEYBOARD / TOUCH (preferensi tampilan;
  keyboard + touch selalu aktif)
- **RESET**: hapus progres + settings via dialog konfirmasi (CANCEL/RESET)

## Persistence (Stage 6)

Satu key terversi **`knightSaveV1`** di localStorage: best total/L1/L2,
best shard, total shard/mati, completion L1/L2/game, unlock L2, dan
semua settings. Guarded: JSON rusak → default; localStorage hilang →
fallback memori; game tetap jalan. Irit: tulis hanya saat settings
berubah, checkpoint/progress, complete, mati, dan reset — bukan per-frame.

- Level 1 selalu terbuka; Level 2 terbuka setelah Level 1 selesai
- Best time hanya membaik; reload tak menghapus progres
- PLAY baru tak menghapus save; hanya RESET yang menghapus

## Kontrol desktop

| Tombol | Aksi |
|---|---|
| `A` / `D` atau `←` / `→` | Bergerak kiri / kanan |
| `Space` / `W` / `↑` | Lompat (tahan = lebih tinggi) |
| `J` / `X` | Serang pedang |
| `R` / `Enter` | Respawn / next / main lagi (kontekstual) |
| `↑` / `↓` + `Enter`, `Esc` | Navigasi menu/settings / kembali |

## Kontrol mobile (Android)

Tombol sentuh di bawah kanvas: **◀ ▶** gerak, **⤒** lompat, **❖** serang.
Multi-touch didukung. Semua tombol menu/settings/clear touch-friendly.
Guard 500 ms mencegah double-trigger touch + mouse emulasi. Layout
portrait + landscape pendek (dialog fullscreen, canvas tetap 16:9).

## Tech stack

HTML5 Canvas + JavaScript vanilla + CSS — tanpa framework, tanpa dependency,
tanpa CDN. Satu file `game.js` agar tetap jalan via `file://` dan kompatibel
dengan GitHub Pages subpath `/Game/` (semua path relatif). Grafis musuh
baru & boss prosedural (Canvas pixel-style).

## Struktur project

## Audio

- **BGM prosedural Web Audio**: loop dark-fantasy ~100 BPM (bass, pad,
  arpeggio, motif + variasi), dijadwalkan dari Web Audio clock
  (tanpa `setInterval`), satu AudioContext, tanpa node bocor/duplikat
- **SFX prosedural**: lompat, serang, hit, checkpoint, menang, boss, pickup
- **Volume independen**: SFX 0–100% dan Music 0–100% via jalur gain
  terpisah; OFF/volume-0 = diam total; perubahan live tanpa reload
- **Autoplay/unlock**: audio (termasuk BGM) mulai setelah tap/klik/keydown
  pertama; pause men-suspend aman; BGM mengikuti state (menu/main,
  berhenti saat Game Over/Complete, resume tanpa overlap)

```
knight_game/
├── index.html          # kanvas + overlay (menu/settings/clear) + metadata
├── game.js             # seluruh game (menu, 2 level, varian, boss, save, BGM)
├── style.css           # tema + responsif + safe-area Android
├── test.js             # 129 automated test headless (node test.js)
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

129 automated test (123 dasar/responsif/settings/BGM/menu/audit + 6 Stage 8) —
target semua PASS, 0 FAIL.

## Spesifikasi minimum yang disarankan

- Android kelas menengah (Chrome modern), RAM 3 GB+, layar 360px ke atas
- Backing store kanvas dibatasi maks 2x DPR; pool partikel 120

## Catatan pengujian

- **FPS nyata di Android perlu physical testing** (aktifkan `DEBUG=true` dan
  baca overlay FPS/frame-time di perangkat). Dokumen ini tidak mengklaim
  angka performa, dukungan perangkat, atau benchmark apa pun.
- Yang masih butuh uji fisik: FPS di HP lemah, rasa tombol multi-touch +
  menu/settings di layar kecil, pause saat telepon/notifikasi, rotasi
  portrait/landscape, audio unlock di Chrome Android.

## Project status & future improvements

- Status: Content Expansion Build + Settings & Persistence, live di GitHub Pages.
- Repository: https://github.com/Adjietegaralamsyah312/Game
- Ide lanjutan (belum dikerjakan): level tambahan, pola boss baru,
  variasi trek BGM, pengujian FPS terdokumentasi di perangkat fisik.
