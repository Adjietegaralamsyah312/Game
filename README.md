# Knight Platformer — Release Candidate

![Ksatria](assets/knight/idle_0.png)

Game platformer 2D side-view: ksatria pixel-art 32x32 menjelajahi level
2400px side-scrolling — lewati 2 celah, kalahkan 3 slime dengan combat melee,
sentuh checkpoint, dan capai gapura **FINISH**.

**Status: Release Candidate** — gameplay dibekukan; polish tersisa hanya pada
presentasi/metadata. Playable: https://adjietegaralamsyah312.github.io/Game/

## Fitur utama

- Gerak + lompat variabel (coyote time, jump buffer), 7 state player
- Combat melee 3 fase (windup → strike → recovery) + kombo beruntun, i-frames
- 3 slime prosedural (patrol/chase/attack/hurt/death), leash anti bunuh diri
- Checkpoint, respawn, restart total, progress map, HUD HP + slime tersisa
- Kamera smooth side-scrolling dengan batas level
- Polish ringan: partikel pool, screen shake, slash, landing dust, parallax
- Audio Web Audio API prosedural (tanpa file), pause aman saat tab hidden
- Debug overlay (`DEBUG=true`): FPS rolling-average, frame ms, particle,
  enemy, resolusi kanvas, DPR

## Kontrol desktop

| Tombol | Aksi |
|---|---|
| `A` / `D` atau `←` / `→` | Bergerak kiri / kanan |
| `Space` / `W` / `↑` | Lompat (tahan = lebih tinggi) |
| `J` / `X` | Serang pedang |
| `R` / `Enter` | Respawn (Game Over) / main lagi (menang) |

## Kontrol mobile (Android)

Tombol sentuh di bawah kanvas: **◀ ▶** gerak, **⤒** lompat, **❖** serang.
Multi-touch didukung (mis. tahan ◀ + ketuk ⤒). Ketuk kanvas untuk lanjut
saat pause. Guard 500 ms mencegah double-trigger touch + mouse emulasi.

## Tech stack

HTML5 Canvas + JavaScript vanilla + CSS — tanpa framework, tanpa dependency,
tanpa CDN. Satu file `game.js` agar tetap jalan via `file://` dan kompatibel
dengan GitHub Pages subpath `/Game/` (semua path relatif).

## Struktur project

```
knight_game/
├── index.html          # kanvas + overlay + tombol sentuh + metadata
├── game.js             # seluruh game (~1760 baris, modular dalam 1 file)
├── style.css           # tema + responsif + safe-area Android
├── test.js             # 65 automated test headless (node test.js)
├── README.md           # file ini
├── plant.md            # rencana/petunjuk pengembangan
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
```

65 test (57 dasar + 8 Tahap 4: pause, visibility, dt-clamp, DPR fallback,
anti double-fire, restart-setelah-pause, resume Game Over/Win) — target
semua PASS, 0 error.

## Spesifikasi minimum yang disarankan

- Android kelas menengah (Chrome modern), RAM 3 GB+, layar 360px ke atas
- Backing store kanvas dibatasi maks 2x DPR; pool partikel 120; 3 musuh

## Catatan pengujian

- **FPS nyata di Android perlu physical testing** (aktifkan `DEBUG=true` dan
  baca overlay FPS/frame-time di perangkat). Dokumen ini tidak mengklaim
  angka performa apa pun.
- Yang masih butuh uji fisik: FPS di HP lemah, rasa tombol multi-touch,
  pause saat telepon/notifikasi, rotasi portrait/landscape, audio unlock
  di Chrome Android.

## Project status & future improvements

- Status: Release Candidate, live di GitHub Pages.
- Repository: https://github.com/Adjietegaralamsyah312/Game.git
- Ide lanjutan (di luar RC, belum dikerjakan): level tambahan, musuh baru,
  musik latar, penyimpanan progres lokal, pengujian FPS terdokumentasi
  di perangkat fisik.
