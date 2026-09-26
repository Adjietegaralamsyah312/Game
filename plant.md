Kerjakan langsung di repository game ini. Jangan hanya menjelaskan rencana. Audit source code yang ada, implementasikan Skill / Ability System yang terintegrasi penuh dengan gameplay, combat, 3 mode player, save system, difficulty, achievement, UI, mobile controls, dan testing. Setelah selesai jalankan seluruh test dan perbaiki semua regresi.

TUJUAN

Tambahkan sistem Skill / Ability yang membuat progression karakter lebih dalam tanpa mengubah identitas gameplay existing.

Game saat ini memiliki 3 mode combat:

- Sword
- Guardian
- Archer

Skill system harus memanfaatkan ketiga mode tersebut.

Jangan membuat skill system sebagai dependency/plugin/framework baru. Gunakan JavaScript architecture yang sudah dipakai project.

---

1. AUDIT TERLEBIH DAHULU

Sebelum coding:

Baca dan pahami minimal:

- "game.js"
- "test.js"
- "index.html"
- "style.css"
- file asset yang relevan
- save/migration code
- campaign/level system
- combat system
- player state
- weapon/equipment system
- Normal/Hard difficulty
- achievement system yang sudah dibuat sebelumnya

Cari apakah sudah ada:

- stamina
- cooldown
- mana/energy
- special attack
- ability
- weapon effect
- status effect
- player progression
- unlock state

Jangan membuat duplicate system.

Gunakan architecture existing sebisa mungkin.

---

2. KONSEP SKILL SYSTEM

Tambahkan skill aktif dan passive.

Gunakan 2 kategori:

ACTIVE SKILLS

Skill yang dipicu oleh player.

Contoh:

Sword

Dash Slash

- Player melakukan dash ke depan sambil menyerang.
- Memberikan damage lebih tinggi dari basic attack.
- Memiliki cooldown.

Guardian

Shield Bash

- Serangan menggunakan shield.
- Memberikan damage.
- Knockback enemy.
- Memiliki cooldown.

Archer

Multi Shot

- Menembakkan beberapa projectile sekaligus.
- Damage per projectile lebih rendah agar tetap balance.
- Memiliki cooldown.

---

3. PASSIVE SKILLS

Tambahkan passive skill yang meningkatkan gameplay secara moderat.

Contoh:

Sword

Sharp Edge

- meningkatkan melee damage sedikit.

Combo Master

- combo tertentu memberikan bonus damage.

Guardian

Fortified Guard

- mengurangi damage saat blocking.

Sturdy

- meningkatkan survivability secara kecil.

Archer

Quick Draw

- mengurangi attack cooldown ranged.

Piercing Arrow

- projectile dapat menembus enemy tertentu.

Jangan membuat modifier terlalu besar.

Semua nilai harus data-driven dan mudah diseimbangkan.

---

4. JANGAN BUAT PLAYER OVERPOWERED

Skill harus memperluas gameplay, bukan menghancurkan balance.

Gunakan:

- cooldown
- resource/stamina jika game sudah memilikinya
- limited use jika memang lebih cocok
- damage multiplier yang moderat

Jangan membuat:

- infinite spam
- one-shot boss
- permanent invincibility
- infinite projectile
- infinite dash

Boss tetap harus memiliki challenge pada Normal dan Hard.

---

5. SISTEM RESOURCE

Audit apakah game sudah memiliki stamina/energy.

Bila stamina sudah ada:

Gunakan stamina existing.

Bila belum ada:

Buat Ability Energy sederhana.

Contoh:

abilityEnergy: 100

Skill menggunakan sejumlah energy.

Contoh:

Dash Slash     25
Shield Bash    30
Multi Shot     35

Energy dapat dipulihkan secara perlahan atau melalui gameplay sesuai architecture game.

Jangan membuat UI resource kedua jika stamina existing sudah cocok dipakai.

---

6. COOLDOWN

Setiap active skill wajib memiliki cooldown.

Contoh:

cooldown: 5

Cooldown harus:

- berkurang saat waktu berjalan
- tidak negatif
- tidak reset ketika animasi biasa dimainkan
- tetap konsisten setelah respawn
- tidak hilang karena pergantian frame

Tampilkan cooldown pada UI.

---

7. SKILL DEFINITIONS DATA-DRIVEN

Buat registry/config yang terstruktur.

Contoh konsep:

const SKILLS = {
  dashSlash: {
    id: 'dashSlash',
    mode: 'sword',
    type: 'active',
    energyCost: 25,
    cooldown: 5,
    unlocked: false
  }
};

Jangan menyebarkan seluruh angka skill ke banyak fungsi.

Gunakan satu sumber data untuk:

- damage
- cooldown
- energy cost
- unlock
- description
- icon
- mode

Nama properti boleh disesuaikan dengan architecture existing.

---

8. SKILL UNLOCK SYSTEM

Skill tidak semuanya terbuka sejak awal.

Gunakan progression yang cocok dengan campaign existing.

Contoh:

Sword

Dash Slash → unlock setelah level tertentu.

Guardian

Shield Bash → unlock setelah level tertentu.

Archer

Multi Shot → unlock setelah level tertentu.

Passive skill dapat unlock melalui progression atau achievement.

Gunakan progression yang sudah ada.

Jangan membuat player harus grinding berlebihan.

Jangan membuat skill penting terkunci terlalu lama sehingga early game terasa kosong.

---

9. SKILL LOADOUT

Player dapat memilih skill yang aktif digunakan.

Buat loadout sederhana.

Contoh:

ACTIVE SKILL
[ Dash Slash ]

PASSIVE 1
[ Sharp Edge ]

PASSIVE 2
[ Combo Master ]

Untuk Guardian:

ACTIVE SKILL
[ Shield Bash ]

PASSIVE 1
[ Fortified Guard ]

PASSIVE 2
[ Sturdy ]

Untuk Archer:

ACTIVE SKILL
[ Multi Shot ]

PASSIVE 1
[ Quick Draw ]

PASSIVE 2
[ Piercing Arrow ]

Gunakan mode player sebagai dasar.

Jangan membuat loadout terlalu kompleks.

---

10. SKILL MENU

Tambahkan menu:

SKILLS

Menu harus dapat dibuka dari main menu atau campaign preparation sesuai struktur UI yang paling cocok dengan game.

Tampilkan:

SKILLS

SWORD

[✓] Dash Slash
    Powerful forward slash

[✓] Sharp Edge
    Increase melee damage

[ ] Combo Master
    Improve combo damage

Locked:

[LOCKED]
Unlock by progressing through the campaign

Tampilkan:

- Name
- Type
- Description
- Cost
- Cooldown
- Unlock state
- Equipped state

---

11. SKILL ACTIVATION

Gunakan input yang sesuai dengan platform.

Desktop:

- keyboard key khusus

Mobile:

- tombol skill pada touch HUD

Jangan mengganti kontrol existing.

Tambahkan tombol baru dengan ukuran touch yang nyaman.

Contoh:

ATTACK     JUMP     SKILL

Tetapi sesuaikan layout dengan UI existing.

Pastikan tidak menutupi:

- movement
- attack
- jump
- HUD
- pause

Pada portrait, UI harus tetap usable.

---

12. INPUT KEY

Jangan hardcode key secara sembarangan.

Gunakan sistem input existing.

Contoh:

Q = Skill

Jika Q sudah dipakai, pilih key yang belum digunakan.

Keyboard dan mobile harus menggunakan fungsi skill activation yang sama.

Jangan membuat dua implementasi skill berbeda untuk desktop dan mobile.

---

13. ANIMATION & FEEDBACK

Skill harus mempunyai feedback visual.

Minimal:

- player animation/state
- effect sederhana
- hit effect
- screen feedback ringan bila sesuai
- cooldown UI
- sound effect

Jangan membutuhkan asset kompleks baru jika belum diperlukan.

Gunakan CSS/canvas effects atau asset existing bila memungkinkan.

---

14. INVULNERABILITY RULE

Skill yang memang membutuhkan movement agresif boleh memiliki window invulnerability sangat singkat.

Namun:

- jangan membuat invulnerability permanen
- jangan membuat semua skill kebal
- jangan merusak boss fight

Contoh Dash Slash:

Start dash
→ brief invulnerability
→ attack
→ end dash
→ normal state

Gunakan timing yang realistis.

---

15. ENEMY INTERACTION

Skill harus terintegrasi dengan collision/combat existing.

Pastikan:

- damage masuk ke enemy
- knockback bekerja bila applicable
- hitbox mengikuti player
- tidak menghasilkan double-hit tidak sengaja
- tidak menembus batas map
- projectile tetap memakai sistem projectile existing jika ada

---

16. BOSS INTERACTION

Pastikan skill bisa digunakan pada boss tetapi tetap balanced.

Boss harus:

- menerima damage normal sesuai modifier
- tidak terkena infinite stun
- tidak bisa di-lock oleh spam skill
- tetap berfungsi pada Hard Mode

Tambahkan protection/debounce bila diperlukan.

---

17. NORMAL DAN HARD MODE

Skill harus kompatibel dengan dua difficulty.

Normal:

- standard skill damage/effect

Hard:

- jangan otomatis membuat skill tidak berguna
- scaling enemy/boss tetap berlaku
- skill tetap menggunakan cooldown/resource normal kecuali balancing memang membutuhkan perubahan

Jangan membypass Hard Mode melalui skill.

---

18. WEAPON SYSTEM

Skill harus bekerja bersama weapon/equipment existing.

Contoh:

Sword skill memakai sword yang sedang equipped.

Guardian skill memakai shield equipped.

Archer skill memakai bow equipped.

Jangan mengganti equipment secara otomatis ketika skill dipakai.

Weapon upgrade boleh meningkatkan skill damage sedikit bila architecture game memang mendukungnya.

Jika tidak aman, skill damage harus tetap terpisah dari weapon upgrade.

Pilih pendekatan yang paling kompatibel dengan code existing.

---

19. SAVE SYSTEM

Skill system wajib persistent.

Tambahkan ke save data:

skills: {
  unlocked: [],
  equippedActive: null,
  equippedPassives: []
}

Gunakan struktur yang kompatibel dengan save system existing.

JANGAN merusak save lama.

Migration harus:

- mendeteksi save lama
- menambahkan default skill state
- mempertahankan semua progress existing
- tidak mereset weapon/equipment
- tidak mereset campaign
- tidak mereset achievement
- tidak mereset difficulty progress

Setelah migration, save harus tetap valid.

---

20. ACHIEVEMENT INTEGRATION

Integrasikan dengan Achievement System yang sudah ada.

Tambahkan achievement yang relevan.

Minimal:

Skill Apprentice

Unlock your first skill.

Skill Master

Unlock all active skills.

Ability Expert

Unlock a complete skill setup for one mode.

Triple Master

Unlock the skill progression for Sword, Guardian, and Archer.

Achievement harus unlock berdasarkan event gameplay/progression nyata.

Jangan unlock hanya karena membuka menu Skills.

---

21. CAMPAIGN INTEGRATION

Pada Campaign flow:

MAIN MENU
   ↓
CAMPAIGN
   ↓
NORMAL / HARD
   ↓
LEVEL SELECT
   ↓
LOADOUT / SKILLS
   ↓
START

Player harus dapat memastikan loadout sebelum level dimulai.

Jangan memaksa player masuk ke menu skill setiap kali start level.

Loadout terakhir harus tersimpan.

---

22. DEATH / CHECKPOINT / RETRY

Pastikan:

- skill unlocked tetap ada setelah mati
- skill loadout tetap ada setelah respawn
- cooldown direset secara wajar setelah death
- energy direset/recover sesuai desain
- checkpoint tidak menghapus skill
- retry tidak menghapus skill

Jangan menyimpan cooldown secara persistent ke save.

---

23. UI POLISH

Gunakan visual language yang sudah ada.

Tambahkan:

- card skill
- locked state
- equipped state
- cooldown indicator
- energy bar jika diperlukan
- skill unlock notification

Jangan membuat UI terlihat seperti aplikasi terpisah dari game.

Mobile:

- tombol cukup besar
- tidak overlap
- dapat disentuh dengan satu jari
- portrait tetap usable

---

24. AUDIO

Untuk setiap active skill:

- tambahkan SFX khusus jika sound system existing mendukung
- jangan membuat sound spam
- volume mengikuti SFX setting existing

Skill unlock notification boleh memakai audio cue singkat.

---

25. TESTING

Tambahkan automated test untuk:

Skill data

- registry valid
- unique ID
- valid mode
- valid cooldown
- valid cost

Unlock

- default locked
- unlock condition
- unlock persistence
- migration

Loadout

- active skill equip
- passive equip
- invalid skill rejected
- wrong mode skill rejected

Activation

- skill activation
- energy consumption
- cooldown
- cooldown cannot go below zero
- repeated spam prevented
- skill cannot activate while locked
- skill cannot activate without enough energy

Combat

- skill damage
- enemy collision
- boss collision
- knockback
- projectile behaviour
- no duplicate damage

Difficulty

- skill works in Normal
- skill works in Hard
- Hard scaling still applies

Save

- save skill state
- load skill state
- migration old save
- preserve existing progress

Mobile

- skill touch button exists
- touch triggers same activation method
- no duplicate activation from touch events

Achievement

- Skill Apprentice
- Skill Master
- Ability Expert
- Triple Master

JANGAN menghapus test existing.

---

26. REGRESSION TEST

Setelah implementasi jalankan semua test existing.

Wajib memastikan tidak merusak:

- movement
- jump
- combat
- combo
- Sword
- Guardian
- Archer
- enemy
- miniboss
- boss
- checkpoint
- coins
- chest
- shop
- equipment
- save
- campaign
- Normal
- Hard
- achievements
- BGM
- SFX
- pause
- victory
- game over
- mobile touch

---

27. PERFORMANCE

Skill system harus ringan.

Hindari:

- allocation object setiap frame
- interval/timer yang tidak dibersihkan
- event listener duplicate
- projectile/entity leak
- particle leak

Pastikan cooldown/resource update memakai game loop existing.

Jika menggunakan temporary effect, pastikan cleanup benar.

---

28. DOKUMENTASI

Update:

- README
- CHANGELOG
- version metadata bila memang release baru
- feature list
- controls
- save schema

Jangan meninggalkan dokumentasi versi lama.

---

29. FINAL VALIDATION

Setelah semuanya selesai:

1. Jalankan test.
2. Jalankan build/validation.
3. Periksa console error.
4. Periksa menu Skills.
5. Unlock skill pertama.
6. Equip skill.
7. Jalankan Normal.
8. Jalankan Hard.
9. Gunakan skill pada enemy.
10. Gunakan skill pada boss.
11. Mati lalu respawn.
12. Retry level.
13. Save/load.
14. Cek achievement.
15. Cek mobile touch.
16. Cek portrait.
17. Pastikan tidak ada regresi.

Jika ada test gagal, perbaiki sampai seluruh suite PASS.

HASIL AKHIR YANG DIHARAPKAN

Gameplay flow:

MAIN MENU
    ↓
CAMPAIGN
    ↓
NORMAL / HARD
    ↓
LEVEL SELECT
    ↓
SKILLS / LOADOUT
    ↓
PLAY
    ↓
COMBAT + SKILLS

Skill tersedia berdasarkan mode:

SWORD
├── Dash Slash
├── Sharp Edge
└── Combo Master

GUARDIAN
├── Shield Bash
├── Fortified Guard
└── Sturdy

ARCHER
├── Multi Shot
├── Quick Draw
└── Piercing Arrow

Di akhir tampilkan:

SKILL SYSTEM COMPLETE

Active Skills: X
Passive Skills: X
Achievements Added: X

Normal: PASS
Hard: PASS
Save Migration: PASS
Mobile Input: PASS

Tests:
X / X PASS

Build:
PASS

Files Changed:
...

Version:
...

Jangan berhenti setelah UI selesai. Skill harus benar-benar playable, persistent, balanced, dan terhubung ke seluruh sistem game yang sudah ada.
