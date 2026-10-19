# Issue: Pengaturan Tombol Kustom (Key Binding Settings)

## Ringkasan

Tambahkan halaman **Settings** di dalam aplikasi yang memungkinkan user mengubah mapping tombol keyboard dan joystick sesuai kenyamanan mereka. Pengaturan disimpan ke file JSON lokal dan dimuat otomatis saat aplikasi dibuka.

---

## Kenapa Fitur Ini Dibutuhkan

Saat ini semua tombol di-hardcode di kode. User tidak bisa mengganti mapping tanpa mengedit source code. Fitur ini memungkinkan:

- User kidal bisa pakai layout tombol yang berbeda
- User dengan controller non-standar bisa menyesuaikan mapping
- User bisa mengatur ulang tombol sesuai kebiasaan mereka

---

## Konsep Utama

### 1. File Konfigurasi: `keybindings.json`

Buat file JSON di folder aplikasi yang menyimpan semua mapping tombol. Formatnya:

```json
{
  "keyboard": {
    "pick": ["ArrowRight", "1", "d"],
    "reject": ["ArrowLeft", "2", "a"],
    "maybe": ["ArrowUp", "3", "w"],
    "reset": ["ArrowDown", "0", "s"],
    "next": [" ", "e"],
    "prev": ["q"],
    "undo": ["ctrl+z"],
    "zoomIn": ["+", "="],
    "zoomOut": ["-"],
    "resetZoom": ["r"],
    "openFolder": ["ctrl+o", "o"],
    "export": ["ctrl+e", "p"],
    "help": ["h", "?"],
    "toggleSidebar": ["Tab", "l"]
  },
  "gamepad": {
    "pick": 0,
    "reject": 1,
    "reset": 2,
    "maybe": 3,
    "prev": 4,
    "next": 5,
    "undo": 10,
    "resetZoom": 11,
    "help": 8,
    "export": 9,
    "zoomIn": 12,
    "zoomOut": 13,
    "dpadLeft": 14,
    "dpadRight": 15
  }
}
```

### 2. Modul `keybindings.js`

Buat file baru `src/js/keybindings.js` yang bertanggung jawab untuk:

- **Memuat** konfigurasi dari `keybindings.json` saat app startup
- **Menyimpan** konfigurasi ketika user mengubah mapping dari UI Settings
- **Menyediakan default** jika file belum ada (sama seperti mapping saat ini)
- **Mengekspos** fungsi `getKeyboardMap()` dan `getGamepadMap()` yang bisa dipakai oleh `keyboard.js` dan `gamepad.js`

### 3. Ubah `keyboard.js` dan `gamepad.js`

Saat ini kedua file ini memakai hardcoded `switch-case`. Ubah agar:

- Saat startup, ambil mapping dari `keybindings.js`
- Bangun sebuah lookup object (misalnya `{ "ArrowRight": "pick", "1": "pick", ... }`) dari konfigurasi
- Gunakan lookup object tersebut di `handleKeyDown()` dan `handleButtonPress()` sebagai pengganti switch-case

### 4. UI Settings Modal

Buat modal baru (seperti Export Modal dan Help Modal yang sudah ada) berisi:

- **Daftar semua aksi** (Pick, Reject, Maybe, Reset, Next, Prev, Undo, dll)
- Di setiap baris aksi, tampilkan **tombol keyboard saat ini** dan **tombol gamepad saat ini**
- Tombol **"Ubah"** di setiap baris — ketika diklik, UI masuk mode "menunggu input": user cukup tekan tombol keyboard atau gamepad yang diinginkan, lalu mapping otomatis terupdate
- Tombol **"Reset ke Default"** untuk mengembalikan semua mapping ke bawaan

### 5. Buka Settings dari Menu

- Tambahkan tombol **Settings (⚙)** di header bar (sebelah tombol Help `?`)
- Tambahkan shortcut keyboard baru (misalnya `,` koma) untuk membuka Settings
- Tambahkan item **"Pengaturan Tombol..."** di menu native `Edit`

---

## Langkah Implementasi

### Tahap 1 — Data Layer

1. Buat `src/js/keybindings.js` dengan default mapping dan fungsi load/save
2. Tambahkan IPC handler baru di `main.js` untuk baca/tulis `keybindings.json` dari folder app data
3. Tambahkan API di `preload.js` untuk `loadKeybindings()` dan `saveKeybindings()`

### Tahap 2 — Integrasi ke Input Handler

4. Ubah `keyboard.js` — ganti switch-case dengan lookup dari `keybindings.js`
5. Ubah `gamepad.js` — ganti switch-case dengan lookup dari `keybindings.js`
6. Pastikan semua shortcut yang sudah ada tetap berfungsi sama persis

### Tahap 3 — UI Settings

7. Tambahkan HTML modal Settings di `index.html` (ikuti pola Export Modal)
8. Tambahkan CSS untuk modal Settings di `main.css` (ikuti style monochrome yang ada)
9. Buat `src/js/settings.js` — logic untuk menampilkan mapping, mode "menunggu input", dan simpan perubahan
10. Tambahkan tombol Settings di header bar dan item menu di `main.js`

### Tahap 4 — Polish

11. Update Help Modal agar menampilkan mapping aktual (bukan hardcoded)
12. Tampilkan key badge di toolbar bawah sesuai mapping aktual
13. Test dengan berbagai controller dan layout keyboard

---

## File yang Perlu Diubah / Dibuat

| File | Aksi |
|------|------|
| `src/js/keybindings.js` | **BARU** — modul konfigurasi tombol |
| `src/js/settings.js` | **BARU** — logic UI modal settings |
| `keybindings.json` | **BARU** — file konfigurasi (auto-generated) |
| `src/js/keyboard.js` | UBAH — pakai lookup dari keybindings |
| `src/js/gamepad.js` | UBAH — pakai lookup dari keybindings |
| `src/index.html` | UBAH — tambah modal settings + tombol settings |
| `src/styles/main.css` | UBAH — tambah style modal settings |
| `main.js` | UBAH — tambah IPC handler + menu item settings |
| `preload.js` | UBAH — expose API keybindings |

---

## Aturan Penting

- **Jangan hapus mapping default** — jika `keybindings.json` belum ada atau rusak, gunakan default yang sama seperti sekarang
- **Cegah duplikasi** — satu tombol tidak boleh dipasang ke dua aksi berbeda. Tampilkan peringatan jika user mencoba
- **Simpan otomatis** — setiap kali mapping berubah, langsung simpan ke file
- **Style konsisten** — gunakan monochrome B&W yang sama seperti seluruh UI, tanpa animasi
- **Tetap ringan** — tidak boleh mempengaruhi kecepatan aplikasi saat menyeleksi foto
