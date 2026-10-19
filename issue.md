# Issue: Fitur Culling Lanjutan (Progress Bar, Auto-Advance Toggle, & Filter/Sort di Viewer)

## Ringkasan

Menambahkan 3 fitur peningkatan alur kerja (*workflow*) penyeleksian foto agar proses culling ribuan foto menjadi jauh lebih cepat, fleksibel, dan terukur:

1. **Progress Bar Culling**: Bar visual yang menampilkan persentase & jumlah foto yang sudah ditinjau dibanding total foto.
2. **Auto-Advance Toggle**: Opsi untuk mengaktifkan atau mematikan perpindahan otomatis ke foto berikutnya setelah foto ditandai (Pick/Reject/Maybe).
3. **Filter & Sort di Viewer**: Bilah (*toolbar*) di bawah header yang dapat diaktifkan/dinonaktifkan untuk menyaring foto (All, Unmarked, Pick, Reject, Maybe) dan mengurutkan foto (Nama, Tanggal, Ukuran, Status) langsung di viewer utama dan filmstrip.

---

## Kenapa Fitur-Fitur Ini Dibutuhkan

- **Visibilitas Progres**: Fotografer yang menyeleksi 500–2.000 foto butuh melihat sejauh mana progres culling mereka tanpa harus menghitung angka satu per satu.
- **Fleksibilitas Seleksi Detail**: Saat babak pertama (*first pass culling*), auto-advance sangat cepat. Namun pada babak kedua (*second pass / fine review*), fotografer sering ingin menandai foto sambil tetap berada di foto tersebut untuk memeriksa ketajaman zoom 100%.
- **Review Bertarget**: Setelah selesai satu putaran, fotografer sering ingin meninjau hanya foto-foto **Pick** untuk eliminasi akhir, atau hanya foto yang **Belum Ditinjau (Unmarked)** yang terlewat. Toolbar ini bisa dibuka saat dibutuhkan dan ditutup saat ingin tampilan minimalis.

---

## Konsep & Spesifikasi Teknis

### 1. Progress Bar Culling

#### Tampilan & Penempatan
- Ditempatkan tepat di bawah baris header atau menyatu rapi dengan `statsBar`.
- Terdiri dari:
  - **Progress Bar Track**: Bar tipis (tinggi ~3px–4px) dengan warna kontras modern monochrome.
  - **Indikator Persentase**: Menampilkan `XX% Ditinjau (N / Total)`.
  - **Segmen Warna** (opsional/ringkas): Proporsi Pick (putih terang), Maybe (abu-abu sedang), Reject (abu-abu gelap), dan Unmarked (transparan/track gelap).

#### Logika Perhitungan
```javascript
const total = photos.length;
const reviewed = pickCount + rejectCount + maybeCount;
const percent = total > 0 ? Math.round((reviewed / total) * 100) : 0;
```
- Berjalan instan dengan efisiensi O(1) di `SelectionManager.updateStats()`.

---

### 2. Auto-Advance Toggle (Dapat Diaktifkan / Dimatikan)

#### Tampilan & Kontrol
- **Tombol Cepat di Top Bar / Controls Bar**:
  - Tombol toggle: `⏭ Auto-Advance: [ON / OFF]`.
  - State aktif: background terang/putih teks hitam (`ON`).
  - State nonaktif: background redup teks abu-abu (`OFF`).
- **Pengaturan di Settings Modal (`⚙️`)**:
  - Checkbox / Switch: *"Pindah otomatis ke foto berikutnya setelah menandai (Auto-advance)"*.
- **Shortcut Keyboard**:
  - Shortcut cepat (misalnya `Shift + A`) untuk toggle on/off tanpa membuka modal.

#### State & Logika
- Disimpan di `localStorage` (`photoSelector_autoAdvance`) dengan nilai default `true`.
- Pada `SelectionManager.mark(status)`:
```javascript
if (status && this.autoAdvanceEnabled) {
  window.photoManager.nextPhoto();
}
```
- Jika `autoAdvanceEnabled === false`: status foto diperbarui, border & filmstrip terupdate, namun posisi viewer tetap di foto saat ini.

---

### 3. Filter & Sort di Viewer (Dapat Diaktifkan / Dimatikan)

#### Penempatan & Desain UI
- **Toolbar Rapi di Bawah Header**: Diletakkan tepat di bawah `.top-bar` dan di atas `.viewer-area` (tidak menutupi preview foto).
- **Tombol Toggle di Header**:
  - Tombol `🔍 Filter & Sort` di `.top-bar-right`.
  - Mengklik tombol akan menampilkan atau menyembunyikan toolbar filter & sort.
  - Saat dinonaktifkan: toolbar tersembunyi, viewer kembali menampilkan seluruh foto dengan urutan folder bawaan.

#### Pilihan Filter
- **Semua (All)** — Menampilkan semua foto dalam folder.
- **Belum Ditinjau (Unmarked)** — Hanya foto yang belum memiliki status (Pick/Reject/Maybe).
- **Pick (✓)** — Hanya foto yang ditandai Pick.
- **Reject (✕)** — Hanya foto yang ditandai Reject.
- **Maybe (?)** — Hanya foto yang ditandai Maybe.

#### Pilihan Pengurutan (Sort)
- **Nama File**:
  - `A → Z` (Alfabetis natural)
  - `Z → A`
- **Waktu / Tanggal**:
  - `Terbaru → Terlama`
  - `Terlama → Terbaru`
- **Ukuran File**:
  - `Terbesar → Terkecil`
  - `Terkecil → Terbesar`
- **Status Seleksi**:
  - Urutan status: `Pick` → `Maybe` → `Reject` → `Belum Ditinjau`

#### Mekanisme Sinkronisasi
1. `PhotoManager` menyimpan:
   - `this.allPhotos`: Daftar lengkap semua file dari folder (master list).
   - `this.photos`: Daftar foto aktif yang sedang ditampilkan (hasil filter & sort).
2. Ketika filter atau sort aktif:
   - Navigasi Next/Prev (`RB/LB`, `Space/Q`, tombol) hanya menelusuri foto dalam daftar aktif.
   - `Filmstrip` hanya menampilkan thumbnail foto dalam daftar aktif.
   - Foto yang sedang aktif di viewer dipertahankan (jika masih memenuhi kriteria filter) atau berpindah ke foto terdekat.
3. Ketika dinonaktifkan:
   - `this.photos` dikembalikan ke salinan `this.allPhotos` urutan asli.
   - `Filmstrip` di-render ulang dengan urutan penuh.

---

## Rencana Perubahan Kode

| File | Komponen / Perubahan yang Ditambahkan |
|------|---------------------------------------|
| `src/index.html` | - Elemen progress bar culling di header/stats.<br>- Tombol toggle `Auto-Advance` di top bar.<br>- Tombol toggle `Filter & Sort` di top bar.<br>- Kontainer toolbar Filter & Sort di bawah top-bar.<br>- Opsi Auto-advance di Settings modal. |
| `src/styles/main.css` | - Styling progress bar culling (track & fill bar).<br>- Styling toolbar filter & sort di bawah header.<br>- Styling tombol toggle state ON/OFF. |
| `src/js/selection.js` | - State `autoAdvance` (load & save ke `localStorage`).<br>- Method `toggleAutoAdvance()`.<br>- Kalkulasi & update progress bar culling di `updateStats()`. |
| `src/js/photos.js` | - `allPhotos` (master list) vs `photos` (filtered/sorted view).<br>- Method `applyFilter(filterType)`.<br>- Method `applySort(sortBy, sortDirection)`.<br>- Method `resetFilterAndSort()`. |
| `src/js/filmstrip.js` | - Memastikan render dan jump index sinkron dengan daftar foto aktif `photoManager.photos`. |
| `src/js/settings.js` | - Menambahkan kontrol Auto-Advance di modal Pengaturan. |
| `src/js/keyboard.js` | - Shortcut `Shift + A` untuk toggle Auto-Advance cepat.<br>- Shortcut `F` atau `Shift + F` untuk toggle bar Filter & Sort. |
| `src/js/app.js` | - Event listeners untuk tombol Auto-Advance dan Filter & Sort.<br>- Sinkronisasi antar komponen saat filter/sort diterapkan. |

---

## Alur Implementasi Bertahap

### Tahap 1: Culling Progress Bar
1. Tambahkan markup `<div class="culling-progress">` di `src/index.html`.
2. Tambahkan CSS progress bar di `src/styles/main.css`.
3. Tambahkan fungsi update persentase dan lebar bar di `src/js/selection.js`.

### Tahap 2: Auto-Advance Toggle
1. Tambahkan state `autoAdvanceEnabled` di `SelectionManager` dengan persistensi ke `localStorage`.
2. Tambahkan tombol toggle di `src/index.html` dan styling di `src/styles/main.css`.
3. Perbarui `SelectionManager.mark()` agar memeriksa nilai `autoAdvanceEnabled`.
4. Tambahkan toggle switch di modal Pengaturan (`settings.js`).

### Tahap 3: Toolbar Filter & Sort di Viewer
1. Tambahkan markup toolbar di `src/index.html` tepat di bawah header (lengkap dengan tombol filter pills dan dropdown/tombol sort).
2. Tambahkan CSS transisi visibilitas toolbar di `src/styles/main.css`.
3. Implementasikan fungsi `applyFilterAndSort()` di `src/js/photos.js`.
4. Sinkronkan dengan `FilmstripManager` dan `SelectionManager`.
5. Tambahkan tombol toggle untuk mengaktifkan / menonaktifkan toolbar.

---

## Checklist Pengujian (Testing)

- [x] **Progress Bar**:
  - [x] Persentase dan panjang bar bertambah saat foto di-mark (Pick/Reject/Maybe).
  - [x] Persentase berkurang jika status foto di-reset atau di-undo.
  - [x] Mencapai 100% jika semua foto telah ditinjau.
- [x] **Auto-Advance**:
  - [x] Saat ON: Menekan tombol Pick/Reject/Maybe otomatis berpindah ke foto berikutnya.
  - [x] Saat OFF: Menekan tombol Pick/Reject/Maybe hanya mengubah status foto aktif tanpa berpindah.
  - [x] Status ON/OFF tersimpan dan tetap sama saat aplikasi ditutup lalu dibuka lagi.
- [x] **Filter & Sort**:
  - [x] Toolbar dapat dibuka dan ditutup dengan tombol toggle di header.
  - [x] Filter "Unmarked" hanya menampilkan foto yang belum memiliki status.
  - [x] Filter "Pick" hanya menampilkan foto Pick di viewer & filmstrip.
  - [x] Sort berdasarkan Nama, Tanggal, Ukuran, dan Status berjalan sesuai urutan.
  - [x] Saat toolbar dinonaktifkan, seluruh foto kembali tampil seperti semula tanpa reload folder.
  - [x] Navigasi keyboard dan joystick tetap responsif dan bebas lag.
