# Knight Platformer — Vertical Slice (Release Candidate)

Game 2D side-view platformer memakai **HTML5 Canvas + JavaScript vanilla**,
tanpa framework dan tanpa dependency. Menampilkan ksatria pixel-art 32x32,
3 slime musuh, combat melee, checkpoint, dan garis finish dalam satu level
selebar 2400px dengan kamera side-scrolling.

## Kontrol keyboard (desktop)

| Tombol | Aksi |
|---|---|
| `A` / `D` atau `←` / `→` | Bergerak kiri / kanan |
| `Space` / `W` / `↑` | Lompat (tahan = lebih tinggi) |
| `J` / `X` | Serang pedang (bisa kombo beruntun) |
| `R` / `Enter` | Respawn di checkpoint (saat Game Over) / main lagi (saat menang) |

## Kontrol mobile (Android)

Tombol sentuh di bawah kanvas: **◀ ▶** gerak, **⤒** lompat, **❖** serang.
Mendukung multi-touch (mis. tahan ◀ + ketuk ⤒). Ketuk kanvas untuk lanjut
saat pause.

## Misi

Lewati 2 celah, kalahkan 3 slime di arena, sentuh checkpoint (bendera jadi
hijau), capai gapura **FINISH**. Jatuh ke celah atau HP habis = respawn di
checkpoint terakhir.

## Cara menjalankan

Paling mudah — buka langsung:

```
knight_game/index.html
```

Disarankan via server lokal (path aset selalu konsisten):

```bash
cd /root/project/knight_game
python3 -m http.server 8000
# buka http://localhost:8000
```

Audio (Web Audio API prosedural, tanpa file) aktif setelah interaksi
pertama (aturan autoplay browser).

## Struktur project

```
knight_game/
├── index.html          # kanvas + overlay + tombol sentuh
├── game.js             # seluruh game (modular dalam 1 file, ~1700 baris)
├── style.css           # tema + responsif + safe-area Android
├── README.md           # file ini
├── plant.md            # rencana pengembangan (acuan tahap 1–3)
└── assets/knight/      # 18 sprite PNG ksatria (idle/run/jump/fall/
                        # attack/hurt/death), dimuat sekali saat boot
```

`game.js` tetap satu file agar bisa dibuka via `file://` tanpa build step.

## Cara mengaktifkan DEBUG

Ubah di `game.js` (bagian CONFIG):

```js
const DEBUG = false;  // -> true
```

Saat `DEBUG=true`, tampil overlay: FPS aktual (rolling average), frame
time ms, player state, camera X, hitbox/hurtbox (player, serangan, slime,
checkpoint, goal), jumlah particle, jumlah enemy, resolusi kanvas, dan
devicePixelRatio. Saat `false`, semua overlay hilang.

## Spesifikasi minimum yang disarankan

- Android kelas menengah (Chrome modern), RAM 3 GB+
- Layar 360px ke atas, portrait maupun landscape
- Backing store kanvas dibatasi maks 2x DPR agar HP lemah tidak terbebani
- Pool partikel dibatasi 120; musuh hanya 3

## Catatan pengujian

- Logika terverifikasi headless: 65 automated test (57 dasar + 8 Tahap 4:
  pause/resume, visibilitychange, delta-time clamp, DPR fallback,
  touch+mouse anti double-fire, restart setelah pause, resume setelah
  Game Over, resume setelah Level Complete) — target semua PASS, 0 error.
  Jalankan via `node test.js`, cek sintaks via `node --check game.js`.
- **FPS di Android harus diuji pada perangkat nyata** (aktifkan DEBUG dan
  baca overlay FPS/frame-time). Angka di dokumen ini bukan klaim performa —
  belum ada pengukuran di hardware fisik.
- Rotasi layar dihitung ulang otomatis (debounce); jika tombol terasa kecil,
  gunakan landscape.

## Audit mobile Tahap 4 (ringkas)

- Debug monitor hanya aktif saat `DEBUG=true`: FPS (rolling average 20 frame),
  frame time ms, particle, enemy, resolusi kanvas, devicePixelRatio.
- Kanvas: DPR dipakai terkontrol (`RENDER_SCALE_MAX=2`), backing store maks
  1920x1080, `imageSmoothingEnabled=false` + `image-rendering: pixelated`,
  collision tetap world-space.
- Pause aman: `visibilitychange` + `blur` pause, `focus`/ketuk kanvas resume,
  delta-time di-clamp 0.05 dtk, audio di-suspend saat pause dan resume hanya
  via user-gesture.
- Touch: guard 500 ms cegah double-trigger touch+mouse, `touch-action: none`
  + `preventDefault` cegah scroll/zoom, tombol attack/jump edge-trigger,
  multi-touch aman (flag kiri/kanan independen).
- Aset: 18 PNG dimuat sekali (`Promise.all`), ada loading state, 1 aset gagal
  tidak crash (fallback magenta + log saat DEBUG).

## Yang masih butuh pengujian fisik di Android

- FPS aktual + frame time di HP lemah/menengah (overlay DEBUG).
- Rasa tombol (ukuran, multi-touch tahan-jalan + lompat/serang bersamaan).
- Pause saat telepon/notifikasi/pindah aplikasi dan kembali.
- Rotasi portrait/landscape dan safe-area di berbagai ukuran layar.
- Audio unlock setelah gesture pertama di Chrome Android.
