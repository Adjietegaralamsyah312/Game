Kerjakan langsung di repository game ini. Jangan hanya memberi penjelasan: audit source code yang ada, implementasikan perubahan, jalankan seluruh test, perbaiki regresi, lalu commit perubahan jika semua valid.

TUJUAN UTAMA

Tambahkan 2 fitur besar:

1. Achievement System
2. Difficulty Mode: Normal dan Hard

Campaign Menu harus diubah menjadi pilihan mode yang terlihat jelas:

[ NORMAL ]    [ HARD ]

Normal adalah mode biasa yang sekarang sudah ada.
Hard adalah mode dengan difficulty lebih tinggi, tetapi tetap memakai campaign/level yang sama.

Jangan membuat sistem baru yang bertabrakan dengan arsitektur game saat ini. Pertahankan style, UI, naming convention, save system, combat, shop, equipment, checkpoint, boss, audio, mobile controls, dan struktur code yang sudah ada.

---

BAGIAN 1 — AUDIT SEBELUM MODIFIKASI

Sebelum menulis kode:

1. Baca "game.js", "test.js", "index.html", "style.css", "README.md", "CHANGELOG.md", dan file lain yang relevan.
2. Identifikasi:
   - save schema/current version
   - campaign state
   - level unlock
   - level completion
   - boss completion
   - coins
   - death count
   - best time
   - weapon/equipment
   - game mode
   - settings
   - existing menu/navigation
3. Cari sistem achievement/challenge/difficulty yang mungkin sudah ada agar tidak membuat duplikasi.
4. Pertahankan kompatibilitas save lama.
5. Jangan menghapus fitur yang sudah ada.

Setelah audit, langsung implementasikan.

---

BAGIAN 2 — ACHIEVEMENT SYSTEM

Buat sistem achievement yang persistent di save data.

Struktur

Tambahkan data achievement dengan pola yang mudah diperluas, misalnya:

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
}

Nama internal boleh disesuaikan dengan arsitektur existing, tetapi gunakan ID yang stabil.

Jangan hanya memakai array sementara. Achievement harus tersimpan permanen ke save.

Achievement minimum

Implementasikan minimal achievement berikut:

1. First Blood

Unlock setelah player pertama kali mengalahkan enemy.

2. First Clear

Unlock setelah menyelesaikan level pertama.

3. Boss Slayer

Unlock setelah mengalahkan boss pertama.

4. King Slayer

Unlock setelah mengalahkan final/king boss yang sesuai dengan campaign saat ini.

5. Collector

Unlock setelah memenuhi target collectible campaign yang masuk akal berdasarkan collectible yang memang ada di game.

Jangan membuat syarat collectible yang tidak didukung oleh game.

6. No Death Clear

Unlock setelah menyelesaikan satu level tanpa mati.

7. Speed Runner

Unlock setelah menyelesaikan level/campaign di bawah threshold waktu yang realistis berdasarkan mekanik game saat ini.
Jangan menggunakan angka absurd. Audit data level terlebih dahulu.

8. Sword Master

Unlock setelah menyelesaikan campaign atau target progression yang valid menggunakan mode Sword.

9. Guardian Master

Unlock setelah menyelesaikan campaign atau target progression yang valid menggunakan mode Guardian.

10. Archer Master

Unlock setelah menyelesaikan campaign atau target progression yang valid menggunakan mode Archer.

11. Hard Clear

Unlock setelah menyelesaikan satu campaign/level dalam Hard Mode sesuai sistem Hard yang baru.

12. Campaign Complete

Unlock setelah seluruh campaign Normal selesai.

Bila jumlah achievement akhir menjadi lebih banyak karena fitur tambahan yang sudah cocok dengan game, boleh ditambahkan, tetapi jangan membuat achievement yang tidak memiliki dasar mekanik di source.

---

BAGIAN 3 — ACHIEVEMENT UI

Tambahkan menu ACHIEVEMENTS yang bisa dibuka dari main menu.

UI harus memperlihatkan:

- Nama achievement
- Icon sederhana atau placeholder berbasis CSS/UI yang sesuai style game
- Status Unlock / Locked
- Deskripsi
- Progress jika achievement memiliki progress
- Counter seperti "8 / 12 Unlocked"

Achievement yang belum terbuka tetap ditampilkan, tetapi statusnya terkunci.

Contoh:

ACHIEVEMENTS

[✓] First Blood
    Defeat your first enemy

[✓] First Clear
    Complete the first level

[ ] Speed Runner
    Complete the required stage under the target time

[ ] Hard Clear
    Complete a stage in Hard Mode

Unlocked: 4 / 12

Tambahkan feedback ketika achievement berhasil:

ACHIEVEMENT UNLOCKED
Hard Clear

Gunakan notification/toast yang tidak mengganggu gameplay.

Achievement unlock harus hanya terjadi sekali.

Jangan membuat notification muncul berulang setiap frame atau setiap kali save/load.

---

BAGIAN 4 — SAVE SYSTEM

Integrasikan Achievement ke save system yang sudah ada.

SANGAT PENTING:

- Jangan merusak save lama.
- Buat migration dari schema lama ke schema terbaru.
- Jika achievement belum ada pada save lama, otomatis buat object/default achievement.
- Jangan reset:
  - campaign progress
  - coins
  - equipment
  - weapon purchases
  - best time
  - death count
  - settings
  - level unlock
- Hard progress harus disimpan terpisah dari Normal progress.

Jangan menggunakan localStorage key baru yang menyebabkan save lama terisolasi kecuali memang arsitektur existing membutuhkan itu.

Gunakan mekanisme persistence existing.

---

BAGIAN 5 — DIFFICULTY MODE

Campaign Menu harus berubah menjadi pemilihan difficulty.

Layout desktop:

         CAMPAIGN

┌─────────────────┐   ┌─────────────────┐
│     NORMAL      │   │      HARD       │
│                 │   │                 │
│  Standard       │   │  Challenging    │
│  Difficulty     │   │  Difficulty     │
│                 │   │                 │
│  [PLAY]         │   │  [PLAY]         │
└─────────────────┘   └─────────────────┘

Untuk mobile:

- Tetap dua pilihan yang jelas.
- Jika layar terlalu sempit, boleh stack secara vertikal.
- Jangan membuat tombol terlalu kecil untuk touch.

Normal:

NORMAL
Standard difficulty

Hard:

HARD
Enemies are stronger and the campaign is more challenging

Gunakan UI style existing game. Jangan memperkenalkan framework UI baru.

---

BAGIAN 6 — HARD MODE GAMEPLAY

Normal harus mempertahankan gameplay sekarang sebisa mungkin.

Hard Mode harus benar-benar terasa lebih sulit.

Jangan hanya mengurangi HP player.

Gunakan modifier yang terkontrol.

Minimal:

Enemy

- HP lebih tinggi
- Damage lebih tinggi
- Movement/attack sedikit lebih agresif
- Recovery/attack cooldown dapat dibuat lebih ketat jika sesuai mekanik

Boss

- HP meningkat
- Damage meningkat
- attack pattern lebih menantang
- cooldown dapat sedikit dipercepat

Player

Jangan membuat player terasa rusak/unfun.
Jangan menghapus kemampuan inti player.

Reward

Hard Mode boleh memberikan reward tambahan yang masuk akal, misalnya:

- achievement
- bonus coin
- Hard Clear flag

Jangan menggandakan reward secara berlebihan.

---

BAGIAN 7 — HARD MODE HARUS TERISOLASI DARI NORMAL

Pastikan state Normal dan Hard dapat dibedakan.

Contoh:

difficulty: "normal"

atau nilai enum yang konsisten dengan architecture existing.

Progress berikut harus dapat dibedakan per difficulty jika memang persistent:

- completed levels
- best time
- best coins
- completion state

Jangan sampai:

«Menyelesaikan Level 3 Hard otomatis dianggap menyelesaikan Level 3 Normal.»

Dan jangan sampai completion Hard menghilangkan progress Normal.

Campaign unlock harus aman.

---

BAGIAN 8 — HARD UNLOCK RULE

Gunakan rule yang aman dan tidak mengganggu player baru:

Hard Mode boleh langsung terlihat di Campaign Menu, tetapi bila campaign saat ini belum memenuhi requirement unlock, tampilkan:

HARD
LOCKED
Complete the required Normal campaign first

Hard tetap terlihat berdampingan dengan Normal.

Setelah requirement terpenuhi:

HARD
UNLOCKED
[PLAY]

Tentukan requirement berdasarkan campaign structure yang benar-benar ada di repo.
Jangan mengarang jumlah level atau boss.

Jika project saat ini memang sudah memiliki completion flag global yang cocok, gunakan flag tersebut.

---

BAGIAN 9 — IDENTITAS DI DALAM GAME

Saat gameplay dimulai, simpan difficulty aktif.

HUD/menu/pause dapat menampilkan indikator kecil:

NORMAL

atau:

HARD

Hard Mode harus mudah dibedakan saat testing.

Jangan membuat indikator terlalu besar sehingga mengganggu gameplay.

---

BAGIAN 10 — ACHIEVEMENT TERKAIT HARD

Implementasikan minimal:

Hard Clear
Complete a stage in Hard Mode

Achievement harus membaca difficulty aktif dari game state, bukan sekadar dari menu selection.

Jangan bisa unlock achievement Hard hanya dengan memilih tombol Hard.

Achievement baru boleh unlock setelah kondisi gameplay benar-benar terpenuhi.

---

BAGIAN 11 — DEATH / RETRY / CHECKPOINT

Pastikan Hard Mode tetap kompatibel dengan:

- death
- respawn
- checkpoint
- retry
- level restart
- victory
- game over

Pastikan modifier Hard tidak hilang setelah respawn/checkpoint.

Pastikan difficulty tidak berubah setelah retry.

---

BAGIAN 12 — SHOP & EQUIPMENT

Normal dan Hard menggunakan shop/equipment yang sudah ada.

Jangan reset equipment ketika berpindah difficulty.

Jangan membuat Hard otomatis memberikan semua weapon.

Equipment player harus tetap berasal dari save/progression existing.

---

BAGIAN 13 — AUDIO / UI

Pastikan:

- BGM tetap berjalan normal
- SFX achievement unlock dimainkan hanya sekali ketika unlock
- tidak ada audio spam
- pause tetap bekerja
- menu navigation tetap bekerja
- keyboard tetap bekerja
- touch tetap bekerja

Untuk touch, semua tombol baru harus memiliki target yang nyaman untuk Android.

---

BAGIAN 14 — TESTING

Update "test.js" dan tambahkan test untuk:

Achievement

- default achievement state
- unlock achievement
- achievement tidak unlock dua kali
- save/load achievement
- migration save lama
- progress achievement
- achievement notification trigger
- campaign completion achievement
- Hard Clear achievement

Difficulty

- default difficulty = normal
- difficulty selection
- Hard unlock requirement
- Hard locked state
- Hard unlocked state
- Normal dan Hard tidak mencampur progress
- Hard enemy scaling
- Hard boss scaling
- retry mempertahankan difficulty
- checkpoint mempertahankan difficulty
- achievement Hard hanya unlock dari Hard
- save/load difficulty state

Regression

Semua existing test harus tetap PASS.

Jangan menghapus test lama hanya supaya test suite hijau.

---

BAGIAN 15 — QUALITY REQUIREMENTS

Wajib:

- Tidak menggunakan "eval()"
- Tidak menggunakan dependency baru kecuali benar-benar diperlukan
- Jangan mengubah stack/framework existing
- Jangan melakukan rewrite besar terhadap game engine
- Pertahankan API/fungsi existing sebisa mungkin
- Tidak merusak mobile layout
- Tidak menurunkan performa secara signifikan
- Hindari duplicate logic
- Gunakan helper function/data-driven configuration untuk difficulty modifier
- Achievement definition sebaiknya data-driven, bukan puluhan "if" yang tersebar

Gunakan pola seperti:

const DIFFICULTY_CONFIG = {
  normal: {
    enemyHp: 1,
    enemyDamage: 1,
    bossHp: 1,
    bossDamage: 1
  },
  hard: {
    enemyHp: ...,
    enemyDamage: ...,
    bossHp: ...,
    bossDamage: ...
  }
};

Sesuaikan nama dan struktur dengan kode existing.

---

BAGIAN 16 — MENU FLOW

Pastikan flow menjadi:

MAIN MENU
   ↓
CAMPAIGN
   ↓
┌───────────────┬───────────────┐
│    NORMAL     │     HARD      │
│   [PLAY]      │   [PLAY]      │
└───────────────┴───────────────┘

Dan:

MAIN MENU
   ↓
ACHIEVEMENTS
   ↓
Achievement list

Jangan menghapus menu existing seperti Settings/Controls jika masih ada.

---

BAGIAN 17 — DOKUMENTASI

Setelah implementasi:

1. Update version sesuai versioning project yang sebenarnya.
2. Update README agar jumlah test, save schema, dan fitur tidak lagi menggunakan informasi versi lama.
3. Update CHANGELOG dengan fitur:
   - Achievement System
   - Normal/Hard Difficulty
   - Campaign difficulty selection
   - Save migration
   - Mobile UI changes
4. Pastikan semua nomor versi konsisten di source dan documentation.

---

BAGIAN 18 — FINAL VALIDATION

Setelah selesai:

1. Jalankan semua test.
2. Jalankan build/validation yang tersedia.
3. Pastikan tidak ada syntax error.
4. Pastikan tidak ada JavaScript console error akibat perubahan.
5. Periksa semua menu flow.
6. Periksa Normal campaign.
7. Periksa Hard locked/unlocked flow.
8. Periksa save/load.
9. Periksa Achievement unlock.
10. Periksa mobile touch layout.
11. Periksa responsive portrait.

Jika ada test gagal, perbaiki sampai semuanya PASS.

Di akhir tampilkan ringkasan:

IMPLEMENTATION COMPLETE

Achievement:
- X achievements implemented
- X/X tests passed

Difficulty:
- Normal implemented
- Hard implemented
- Unlock rule implemented
- Hard scaling implemented

Save:
- Previous saves preserved
- Migration updated

Tests:
- X/X PASS

Files changed:
- ...

Version:
- ...

Jangan berhenti hanya setelah membuat UI. Pastikan fitur benar-benar terhubung ke gameplay, save system, campaign progression, dan automated tests.
