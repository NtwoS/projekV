# Photo Selector — Aplikasi Seleksi Foto dengan Controller

## Tujuan

Membuat aplikasi desktop **ringan** untuk menyeleksi foto secara cepat. User membuka folder foto, lalu review satu-per-satu dan menandai setiap foto sebagai **Pick**, **Reject**, atau **Maybe**. Navigasi dan seleksi bisa dilakukan sepenuhnya via **joystick/gamepad controller** maupun **keyboard**.

---

## Tech Stack

- **Electron** — desktop app, akses filesystem langsung
- **HTML + Vanilla JS + Vanilla CSS** — tanpa framework berat
- **Web Gamepad API** — built-in di Chromium, tidak perlu library tambahan
- **JSON file** — untuk simpan progress seleksi (tidak perlu database)

---

## Alur Kerja User

1. Buka app → pilih folder foto
2. Foto pertama tampil full-screen
3. User tekan tombol controller untuk menandai:
   - **A** → Pick ✅ (hijau)
   - **B** → Reject ❌ (merah)
   - **Y** → Maybe 🤔 (kuning)
   - **X** → Reset/hapus status
4. Setelah menandai, otomatis lanjut ke foto berikutnya
5. **RB/LB** untuk next/prev tanpa menandai
6. Progress auto-save ke `selection-data.json` di folder foto
7. Setelah selesai review, user bisa **export** — copy/move foto ke subfolder berdasarkan kategori (`/picks`, `/rejects`, `/maybes`)

---

## Fitur yang Harus Ada (MVP)

- [x] **Buka folder** — dialog pilih folder, scan semua file gambar (jpg, png, webp)
- [x] **Full-screen preview** — tampilkan 1 foto besar, preload foto berikutnya agar transisi smooth
- [x] **3 kategori seleksi** — Pick, Reject, Maybe dengan visual feedback (border warna + animasi singkat)
- [x] **Controller support** — mapping tombol A/B/Y/X + bumpers, indicator "controller connected"
- [x] **Keyboard fallback** — arrow keys / shortcut sebagai alternatif tanpa controller
- [x] **Progress counter** — "Foto 23/150 — ✅10 ❌5 🤔8"
- [x] **Auto-save & resume** — simpan ke JSON, bisa lanjut dari terakhir kali berhenti
- [x] **Filmstrip** — strip thumbnail kecil di bawah dengan warna sesuai status
- [x] **Export** — pindahkan/copy foto ke subfolder berdasarkan kategori
- [x] **Dark theme** — UI gelap agar fokus ke foto
- [x] **Undo** — batalkan status terakhir (L3 atau Ctrl+Z)
- [x] **Zoom & Pan** — cek ketajaman foto

---

## Controller Mapping

| Tombol | Aksi |
|--------|------|
| A / ✕ | Pick ✅ |
| B / ○ | Reject ❌ |
| Y / △ | Maybe 🤔 |
| X / □ | Reset status |
| RB / R1 | Next foto |
| LB / L1 | Prev foto |
| D-Pad Up/Down | Zoom in/out |
| Right Stick | Pan saat zoom |
| Left Stick | Scroll filmstrip |
| Start | Buka panel Export |
| L3 (click stick) | Undo |

---

## Keyboard Mapping

| Tombol | Aksi |
|--------|------|
| → / 1 / D | Pick ✅ |
| ← / 2 / A | Reject ❌ |
| ↑ / 3 / W | Maybe 🤔 |
| ↓ / 0 / S | Reset status |
| Space / E | Next foto |
| Q | Prev foto |
| Ctrl + Z | Undo |
| + / - / Wheel | Zoom in / out |
| R | Reset zoom |
| Ctrl + O | Buka folder |
| P | Export |
| H / ? | Bantuan |

---

## Data Format (`selection-data.json`)

```json
{
  "version": 1,
  "folderPath": "D:/Photos/Vacation",
  "lastIndex": 22,
  "photos": [
    { "filename": "IMG_001.jpg", "status": "pick" },
    { "filename": "IMG_002.jpg", "status": "reject" },
    { "filename": "IMG_003.jpg", "status": "maybe" },
    { "filename": "IMG_004.jpg", "status": null }
  ]
}
```

---

## Catatan Tambahan
- Aplikasi ini sepenuhnya mendukung penggunaan tanpa joystick (menggunakan keyboard & mouse).
