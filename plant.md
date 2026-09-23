Saya ingin mengembangkan prototype "/root/project/knight_game/" menjadi professional-quality 2D side-view platformer vertical slice.

Jangan membuat project baru. Audit dan kembangkan project yang sudah ada. Pertahankan fitur yang sudah bekerja, lalu tingkatkan kualitas kode, gameplay, visual presentation, dan pengalaman pengguna.

1. Audit dan arsitektur

Periksa terlebih dahulu:

- "index.html"
- "game.js"
- "style.css"
- "assets/knight/"

Pastikan tidak ada kode yang rusak, duplikasi yang tidak perlu, atau logika yang sulit dirawat.

Gunakan arsitektur modular yang jelas di dalam JavaScript, minimal pisahkan tanggung jawab:

- Game loop
- Input manager
- Player
- Physics
- Collision
- Animation
- Enemy
- Combat
- Camera
- UI/HUD
- Level data

Tetap gunakan HTML5 Canvas + JavaScript vanilla, tanpa framework besar dan tanpa dependency yang tidak diperlukan.

Gunakan "requestAnimationFrame()" dan delta time agar gameplay konsisten pada FPS berbeda.

2. Player

Pertahankan sprite yang sudah ada dari:

"assets/knight/"

Gunakan:

- Idle: "idle_0.png" - "idle_3.png"
- Run: "run_0.png" - "run_5.png"
- Jump: "jump_0.png"
- Fall: "fall_0.png"
- Attack: "attack_0.png" - "attack_2.png"
- Hurt: "hurt_0.png"
- Death: "death_0.png" - "death_1.png"

Tambahkan state player:

"idle"
"run"
"jump"
"fall"
"attack"
"hurt"
"death"

Aturan:

- Player menghadap arah gerakan.
- Tidak dapat menyerang saat death.
- Saat attack, movement dikurangi atau dikunci secara singkat agar terasa seperti serangan nyata.
- Setelah attack selesai, kembali ke state yang sesuai.
- Gunakan hitbox dan hurtbox terpisah dari ukuran sprite.
- Jangan menggunakan ukuran gambar sebagai collision hitbox secara langsung.

3. Combat system

Tambahkan combat melee menggunakan pedang.

Kontrol:

- Keyboard: "J" atau "X" = attack
- Mobile: tambahkan tombol ATTACK yang jelas dan nyaman disentuh.

Attack memiliki 3 fase:

1. Windup
2. Strike
3. Recovery

Gunakan:
"attack_0.png"
"attack_1.png"
"attack_2.png"

Tambahkan:

- attack cooldown
- hit detection
- damage
- knockback sederhana
- invulnerability frame singkat setelah terkena damage
- satu serangan tidak boleh memberikan damage berkali-kali pada target yang sama dalam frame attack yang sama

Buat hitbox serangan berbentuk rectangle di depan player.

4. Enemy

Tambahkan enemy pertama berupa slime monster sederhana.

Karena belum ada sprite slime, buat enemy dengan Canvas procedural pixel art sederhana sehingga project tidak membutuhkan asset eksternal.

Enemy memiliki:

- idle animation sederhana
- patrol
- detection range
- mengejar player saat player berada dalam range
- berhenti pada jarak tertentu
- attack sederhana
- HP
- damage
- knockback
- hurt state
- death state
- collision dengan platform

Jangan membuat AI rumit. Prioritaskan stabilitas dan gameplay yang responsif.

Spawn minimal 3 slime di level.

5. Player HP dan damage

Tambahkan:

- HP maksimal: 100
- damage enemy
- player hurt state
- knockback
- invulnerability sekitar 0.5–1 detik
- death saat HP mencapai 0

Saat death:

- mainkan "death_0.png"
- kemudian "death_1.png"
- hentikan input movement
- tampilkan UI Game Over

Tambahkan tombol:
"Restart"

Restart harus mengembalikan:

- HP player
- posisi player
- posisi enemy
- state game
- kamera
- level

6. Level design

Pertahankan level platform yang sudah ada tetapi buat lebih menarik.

Buat satu level vertical slice dengan:

- starting area
- platform rendah
- platform tinggi
- beberapa celah
- area combat
- checkpoint sederhana
- area finish

Gunakan data level dalam struktur JavaScript yang mudah diedit, jangan hard-code collision di banyak tempat.

Contoh konsep:

platforms = [...]
enemies = [...]
checkpoints = [...]
goal = {...}

7. Camera

Tambahkan kamera side-scrolling yang mengikuti player.

Karakter tidak selalu berada tepat di tengah layar.

Camera harus:

- smooth
- memiliki batas level
- tidak menunjukkan area di luar level
- tetap nyaman di layar mobile

8. UI / HUD

Buat UI modern tetapi tetap cocok dengan pixel-art.

Tampilkan:

- HP bar
- angka HP
- status atau indikator sederhana
- kontrol mobile
- Game Over screen
- Restart button
- level completion message

Hapus HUD debugging lama atau ubah menjadi mode debug yang dapat diaktifkan melalui flag:

const DEBUG = false;

Jika "DEBUG = true", tampilkan hitbox, FPS, state player, dan informasi collision.

9. Mobile UX

Mobile adalah target penting.

Pastikan:

- tombol touch besar
- tombol tidak menyebabkan halaman scroll
- touch tidak menghasilkan zoom
- input responsif
- tombol attack mudah dijangkau
- layout UI tidak menutupi gameplay
- aman untuk portrait/landscape sebisa mungkin

Tambahkan dukungan:

- keyboard
- touch
- mouse

10. Pixel-art rendering

Pertahankan:

- "imageSmoothingEnabled = false"
- nearest-neighbor rendering
- "image-rendering: pixelated"

Jangan membuat sprite terlihat blur.

Sprite karakter 32x32 harus tetap terlihat tajam ketika diperbesar.

11. Visual polish

Tambahkan polish ringan tanpa asset eksternal:

- background ber-layer sederhana
- parallax ringan
- efek slash saat attack
- hit flash
- particle kecil saat enemy terkena hit
- particle kecil saat enemy mati
- screen shake sangat ringan saat serangan berhasil
- efek landing kecil
- transisi sederhana saat Game Over

Semua efek harus ringan dan tidak menurunkan performa mobile.

12. Audio architecture

Jangan download asset audio eksternal.

Buat abstraction sederhana untuk audio sehingga nanti sound effect dapat ditambahkan dengan mudah.

Contoh:

AudioManager.play("attack");
AudioManager.play("hit");
AudioManager.play("jump");

Untuk sementara boleh menggunakan placeholder/no-op jika audio belum tersedia.

13. Performance

Target:

- smooth pada Android kelas menengah
- tidak membuat terlalu banyak object setiap frame
- hindari memory leak
- hindari event listener yang terduplikasi
- gunakan object pooling bila benar-benar diperlukan

Jangan melakukan operasi berat setiap frame tanpa alasan.

14. Accessibility dan usability

Tambahkan:

- tombol dengan label yang jelas
- focus yang masuk akal untuk keyboard
- warna UI tetap mudah dibaca
- jangan bergantung hanya pada warna untuk status penting

15. Error handling

Tambahkan penanganan asset loading.

Jika satu sprite gagal dimuat:

- jangan membuat seluruh game crash
- tampilkan fallback yang aman
- log error yang jelas hanya saat "DEBUG = true"

16. Kualitas kode

Gunakan:

- nama variabel yang jelas
- konstanta untuk balancing
- fungsi kecil dan terarah
- komentar hanya pada logika yang memang tidak obvious
- hindari magic numbers sebanyak mungkin

Contoh:

const PLAYER_SPEED = ...;
const JUMP_FORCE = ...;
const PLAYER_MAX_HP = 100;
const PLAYER_ATTACK_DAMAGE = ...;

Semua balancing dasar sebaiknya mudah ditemukan dan diubah.

17. Testing dan verification

Setelah implementasi:

1. Jalankan syntax check.
2. Jalankan server lokal.
3. Pastikan semua asset URL valid.
4. Pastikan game dapat dimulai ulang.
5. Pastikan player dapat bergerak dan melompat.
6. Pastikan attack dapat mengenai enemy.
7. Pastikan enemy dapat memberikan damage.
8. Pastikan enemy mati setelah HP habis.
9. Pastikan player mati saat HP 0.
10. Pastikan Restart mengembalikan kondisi level.
11. Pastikan kontrol touch tetap berfungsi.
12. Pastikan tidak ada error JavaScript di console.

Gunakan server:

cd /root/project/knight_game
python3 -m http.server 8000

18. Hasil akhir

Project tetap berada di:

"/root/project/knight_game/"

Struktur akhir yang diharapkan:

knight_game/
├── index.html
├── game.js
├── style.css
└── assets/
    └── knight/
        ├── idle_0.png
        ├── idle_1.png
        ├── idle_2.png
        ├── idle_3.png
        ├── run_0.png
        ├── run_1.png
        ├── run_2.png
        ├── run_3.png
        ├── run_4.png
        ├── run_5.png
        ├── jump_0.png
        ├── fall_0.png
        ├── attack_0.png
        ├── attack_1.png
        ├── attack_2.png
        ├── hurt_0.png
        ├── death_0.png
        └── death_1.png

Jangan menambahkan library besar kecuali benar-benar diperlukan.

Prioritas implementasi:

1. stabilitas
2. gameplay
3. collision
4. combat
5. enemy
6. UI
7. visual polish
8. mobile UX
9. performance

Sebelum mengubah file, baca project yang ada terlebih dahulu dan pertahankan fitur yang sudah berfungsi.

Setelah selesai, berikan:

- ringkasan perubahan
- file yang diubah
- kontrol game
- cara menjalankan
- hasil verification/testing
- masalah yang masih tersisa, jika ada

Jangan hanya membuat mockup. Semua fitur yang disebutkan harus benar-benar berfungsi.

