# 📸 Photo Selector

Aplikasi desktop **super ringan** dan responsif untuk menyeleksi (culling) foto secara cepat menggunakan **Joystick / Gamepad Controller** maupun **Keyboard & Mouse**.

---

## ✨ Fitur Utama

- 🎮 **Dukungan Penuh Controller / Joystick**: Menggunakan Web Gamepad API bawaan untuk kontrol tanpa latensi (Xbox, PlayStation, Logitech, atau generic gamepad).
- ⌨️ **Dukungan Keyboard Penuh**: Tetap nyaman dan cepat digunakan tanpa gamepad (menggunakan tombol panah atau tombol angka 1/2/3).
- 🏷️ **3 Kategori Keputusan Culling**:
  - ✅ **Pick** (Hijau) — Foto pilihan terbaik
  - ❌ **Reject** (Merah) — Foto ditolak/dihapus
  - 🤔 **Maybe** (Kuning) — Ragu-ragu, untuk ditinjau kembali
  - ⚪ **Reset** — Menghapus status penandaan
- 📋 **Sidebar Panel Kanan (Daftar Seleksi)**: Panel samping kanan untuk melihat secara langsung ringkasan foto yang telah dipilih (Pick), ditolak (Reject), maupun ragu-ragu (Maybe) lengkap dengan filter kategori, thumbnail, dan aksi cepat.
- 🎞️ **Filmstrip Interaktif**: Strip thumbnail horizontal di bagian bawah layar dengan kode warna status dan navigasi klik langsung.
- ⚡ **Zero-Latency Preloading**: Preload otomatis untuk foto berikutnya dan sebelumnya agar perpindahan foto instan tanpa jeda.
- 🔍 **Zoom & Pan Detail**: Perbesar foto hingga 500% via analog stick, D-Pad, atau mouse wheel untuk memeriksa fokus dan ketajaman.
- 💾 **Auto-Save & Resume**: Setiap perubahan status otomatis disimpan ke `selection-data.json` di dalam folder foto. Saat folder dibuka kembali, proses culling langsung melanjutkan dari foto terakhir.
- ↩️ **Undo**: Batalkan keputusan terakhir secara instan.
- 📦 **Export Cerdas**: Pindahkan (*Move*) atau salin (*Copy*) foto yang terseleksi ke subfolder (`/picks`, `/maybes`, `/rejects`).

---

## 🎮 Kontrol & Shortcut

### Gamepad / Joystick (Xbox / PS)
| Tombol | Aksi |
|---|---|
| **A** / **✕** | ✅ **Pick** foto (lanjut otomatis ke foto berikutnya) |
| **B** / **○** | ❌ **Reject** foto (lanjut otomatis ke foto berikutnya) |
| **Y** / **△** | 🤔 **Maybe** / Ragu-ragu |
| **X** / **□** | ⚪ **Reset** status penandaan |
| **RB** / **R1** | ➡️ Foto berikutnya tanpa mengubah status |
| **LB** / **L1** | ⬅️ Foto sebelumnya tanpa mengubah status |
| **D-Pad Up / Down** | 🔍 Zoom in / out foto |
| **Right Stick** | 🖐️ Pan / geser foto saat di-zoom |
| **Left Stick** | 📜 Scroll filmstrip thumbnail |
| **L3** (Tekan Stick) | ↩️ Undo aksi terakhir |
| **Start** | 📦 Buka panel Export |
| **Back / Select** | ❓ Buka panduan tombol |

### Keyboard & Mouse (Tanpa Joystick)
| Tombol | Aksi |
|---|---|
| `→` atau `1` atau `D` | ✅ **Pick** foto |
| `←` atau `2` atau `A` | ❌ **Reject** foto |
| `↑` atau `3` atau `W` | 🤔 **Maybe** / Ragu-ragu |
| `↓` atau `0` atau `S` | ⚪ **Reset** status penandaan |
| `Space` atau `E` atau `PageDown` | ➡️ Foto berikutnya |
| `Q` atau `PageUp` | ⬅️ Foto sebelumnya |
| `Tab` atau `L` | 📋 Buka / tutup Panel Daftar Seleksi (Sidebar Kanan) |
| `Ctrl + Z` | ↩️ Undo aksi terakhir |
| `+` / `-` / `Mouse Wheel` | 🔍 Zoom in / out |
| `R` | Reset zoom ke 100% |
| `Ctrl + O` atau `O` | 📁 Buka folder foto |
| `P` | 📦 Buka panel Export |
| `H` atau `?` | ❓ Buka panduan bantuan |
| `Escape` | Tutup modal dialog / reset zoom |

---

## 🚀 Cara Menjalankan

### Persyaratan
- [Node.js](https://nodejs.org/) (v18+)

### Langkah Menjalankan
1. Clone repositori:
   ```bash
   git clone https://github.com/NtwoS/projekV.git
   cd projekV
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Jalankan aplikasi:
   ```bash
   npm start
   ```

Tersedia folder contoh foto di [sample_photos/](file:///d:/Ahmad/Dev/projek/projekV/sample_photos/) yang bisa langsung Anda coba buka melalui tombol **Buka Folder**.

---

## 📂 Struktur Proyek

```
projekV/
├── package.json
├── main.js                  # Electron main process (IPC, protocol, file ops)
├── preload.js               # Secure bridge Electron <-> Renderer
├── src/
│   ├── index.html           # Layout utama aplikasi
│   ├── styles/
│   │   └── main.css         # Styling dark theme & animations
│   └── js/
│       ├── app.js           # Entry point & coordinator
│       ├── photos.js        # File scanning, display, preloading & zoom
│       ├── gamepad.js       # Gamepad API handler & polling loop
│       ├── keyboard.js      # Keyboard shortcuts & mouse events
│       ├── selection.js     # Pick/Reject/Maybe logic, stats & undo
│       ├── filmstrip.js     # Thumbnail strip rendering & scroll
│       ├── export.js        # File copy/move export manager
│       └── storage.js       # Save & load selection-data.json
└── sample_photos/           # Foto sampel untuk testing
```

---

## 📄 Lisensi
MIT License
