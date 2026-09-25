Saya ingin kamu memperbaiki UI Weapon Shop pada project ini secara profesional, tanpa mengubah fitur/gameplay yang sudah berjalan.

Gunakan screenshot yang saya lampirkan sebagai referensi visual utama.

TUJUAN:
Buat halaman Weapon Shop menjadi rapi, responsif, dan nyaman digunakan terutama pada layar mobile Android dengan width sekitar 360–430px.

MASALAH YANG HARUS DIPERBAIKI:

1. OVERLAPPING / CARD BERTABRAKAN
- Card item weapon saat ini saling menimpa.
- Deskripsi item terlihat masuk/tertutup oleh card di bawahnya.
- Pastikan setiap item memiliki tinggi yang benar dan tidak overlap.
- Gunakan layout normal flow seperti flex/grid dengan gap yang konsisten.
- Jangan menggunakan fixed height yang menyebabkan text overflow.
- Jika tinggi card dinamis, biarkan card mengikuti isi.

2. DETAIL WEAPON PANEL
- Panel detail weapon saat ini terlalu besar dan menutupi daftar weapon.
- Perbaiki struktur layout agar detail panel tidak menyebabkan daftar weapon berantakan.
- Pada desktop, gunakan layout yang nyaman, misalnya:
  daftar item di kiri dan detail item di kanan.
- Pada mobile:
  daftar item berada di atas,
  detail item berada di bawah item list.
- Detail panel tidak boleh menutupi atau overlap dengan item list.

3. RESPONSIVE MOBILE
Optimalkan khusus untuk:
- 320px
- 360px
- 375px
- 390px
- 412px
- 430px
- 768px
- desktop.

Jangan hanya mengecilkan ukuran font.
Atur ulang layout berdasarkan breakpoint.

4. HEADER WEAPON SHOP
Screenshot menunjukkan title "WEAPON SHOP" terlalu dekat/bertabrakan dengan elemen di belakangnya.

Perbaiki:
- spacing header
- line-height
- margin/padding
- z-index
- posisi title
- posisi informasi Coin

Struktur yang diinginkan:

WEAPON SHOP
Coin: 336
[ SWORD ] [ SHIELD ] [ BOW ]

Pastikan seluruh elemen tetap berada dalam container dan tidak keluar viewport.

5. TAB SWORD / SHIELD / BOW
- Buat tab lebih konsisten.
- Ukuran button responsif.
- Tidak boleh overflow horizontal pada mobile.
- Gunakan flex yang dapat menyesuaikan lebar.
- Jika layar terlalu sempit, button boleh mengecil secara proporsional tetapi text tetap terbaca.
- State active harus tetap jelas.
- Jangan merusak event click/tab switching yang sudah ada.

6. WEAPON LIST
Buat setiap weapon item mempunyai struktur konsisten:

[STATUS] Weapon Name
Rarity
Description

Contoh:

[OWNED] Rusty Iron Sword
● COMMON
Pedang besi berkarat standar yang biasa dipakai pemula.

[LOCKED] Sharpened Steel Blade
◆ UNCOMMON
Pedang baja yang sudah diasah tajam...

Setiap item:
- padding konsisten
- border-radius konsisten
- min-height sesuai isi
- text tidak terpotong
- description boleh wrap ke beberapa baris
- tidak boleh keluar card
- tidak boleh menabrak item lain.

7. WEAPON DETAIL
Buat panel detail lebih terstruktur:

Weapon Name

[ IMAGE ]

RARITY
PRICE

Description

Damage ...
Attack Speed ...
Range ...
Defense ...

SPECIAL
...

[ EQUIPPED ]

[ USE SWORD ] [ USE GUARDIAN ]
        [ USE ARCHER ]

Atur agar tombol tidak saling bertabrakan.

Pada mobile:
- button gunakan flex-wrap/grid
- width menyesuaikan layar
- jangan sampai button keluar viewport.

8. IMAGE
Weapon image harus memiliki container yang konsisten.
Jangan membuat gambar meregang/distorsi.

Gunakan:
object-fit: contain;

Pertahankan aspect ratio gambar.

9. TYPOGRAPHY
Perbaiki:
- font-size
- line-height
- font-weight
- letter-spacing

Jangan membuat semua text terlalu besar.

Prioritas:
Weapon Name > Rarity > Description > Stats.

10. SCROLL
Pastikan halaman dapat discroll dengan normal pada mobile.

Jangan membuat beberapa container memiliki:
overflow: hidden;
yang menyebabkan konten hilang.

Periksa juga:
- overflow-y
- max-height
- position
- z-index

Jangan menggunakan position: absolute untuk elemen yang seharusnya mengikuti flow layout.

11. Z-INDEX
Audit seluruh z-index.

Pastikan:
- header tidak tertutup
- tab tidak tertutup
- weapon list tidak tertutup secara tidak sengaja
- detail panel berada pada layer yang benar.

Jangan menyelesaikan masalah overlap hanya dengan menaikkan z-index. Perbaiki akar masalah layout terlebih dahulu.

12. BACK BUTTON
Tombol BACK harus memiliki margin yang cukup dari detail panel dan tidak terlalu dekat dengan navigation/browser bottom area.

13. KEYBOARD / CONTROLLER NAVIGATION
Screenshot menunjukkan petunjuk:

←/→ tab
↑/↓ item
Enter beli/pasang
Esc kembali

Pertahankan fitur keyboard/controller yang sudah ada.

Jika ada perubahan DOM, pastikan selector/event handler yang digunakan oleh JavaScript tetap kompatibel.

14. FUNCTIONALITY
JANGAN menghapus atau merusak:
- purchase weapon
- equip weapon
- locked weapon
- owned state
- coin calculation
- tab switching
- weapon selection
- role/class selection
- keyboard navigation
- back navigation
- localStorage/state management jika ada.

Fokus utama adalah memperbaiki UI/layout.

15. CODE QUALITY
Sebelum mengubah kode:
- baca seluruh HTML
- baca seluruh CSS
- baca seluruh JavaScript
- pahami struktur state dan event handler
- cari CSS yang menyebabkan overflow/overlap.

Jangan melakukan rewrite besar tanpa alasan.

Gunakan CSS yang maintainable.
Hindari !important kecuali benar-benar diperlukan.

Jika terdapat duplicate CSS selector, conflicting rules, fixed heights yang bermasalah, negative margin, absolute positioning, atau media query yang saling bertentangan, rapikan.

16. RESPONSIVE CSS
Gunakan pendekatan mobile-first.

Contoh konsep:

.shop-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
}

@media (min-width: 768px) {
    .shop-layout {
        grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);
    }
}

Namun jangan copy contoh tersebut secara mentah.
Sesuaikan dengan struktur DOM project.

17. VALIDASI
Setelah selesai:
- cek horizontal overflow
- cek vertical overflow
- cek text clipping
- cek card overlap
- cek button overflow
- cek mobile 320px
- cek mobile 360px
- cek mobile 390px
- cek 430px
- cek tablet
- cek desktop.

Gunakan browser/devtools jika tersedia.

HASIL YANG DIHARAPKAN:

Mobile:

┌──────────────────────────┐
│       WEAPON SHOP        │
│        Coin: 336         │
│ [SWORD][SHIELD][BOW]     │
├──────────────────────────┤
│ [OWNED] Rusty Iron Sword │
│ ● COMMON                 │
│ Description...           │
├──────────────────────────┤
│ [LOCKED] Sharpened...    │
│ ◆ UNCOMMON               │
│ Description...           │
├──────────────────────────┤
│ [LOCKED] Silver Knight.. │
│ ★ RARE                   │
│ Description...           │
├──────────────────────────┤
│      WEAPON DETAIL       │
│        [IMAGE]           │
│       ● COMMON           │
│         50 Coin          │
│ Description...           │
│ Stats...                 │
│      [EQUIPPED]          │
│ [USE SWORD] [GUARDIAN]   │
│       [ARCHER]           │
├──────────────────────────┤
│          ← BACK          │
└──────────────────────────┘

Tidak boleh ada card yang saling menimpa.

PENTING:
- Jangan hanya membuat screenshot terlihat bagus pada satu ukuran.
- Implementasikan solusi layout yang benar secara struktural.
- Jangan mengubah data weapon kecuali diperlukan.
- Jangan menghapus functionality.
- Pertahankan style/theme fantasy game yang sudah ada.
- Pertahankan warna utama, tetapi tingkatkan konsistensi spacing, border, typography, dan responsiveness.
- Setelah selesai, tampilkan file yang diubah dan jelaskan perubahan penting yang dilakukan.
