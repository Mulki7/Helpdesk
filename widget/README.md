# Helpdesk Live Chat Widget

Live chat widget mandiri (standalone) yang dapat disematkan pada website apa pun hanya dengan satu tag `<script>`.
Dibangun dengan Vanilla JavaScript (ES Modules), dibundel menjadi file tunggal `dist/widget.js` menggunakan esbuild, dan dirender di dalam Shadow DOM untuk isolasi CSS penuh.

---

## 🚀 Penggunaan Langsung (Production / Demo)

Widget sudah di-bundle dan di-commit di `widget/dist/widget.js`. Ketika backend dijalankan (`npm run dev` di folder `backend`), file bundle langsung disajikan di:

- URL script widget: `http://localhost:3000/widget.js`
- Halaman demo: `http://localhost:3000/demo`

### Pemasangan pada Halaman Web

Tambahkan satu tag `<script>` berikut sebelum tag penutup `</body>`:

```html
<script 
  src="http://localhost:3000/widget.js"
  data-server="http://localhost:3000"
  data-title="Hubungi Kami"
  data-color="#2563eb">
</script>
```

### Konfigurasi Data Attributes

| Attribute | Default | Keterangan |
|---|---|---|
| `data-server` | Origin script / current origin | Alamat backend Helpdesk |
| `data-title` | `"Hubungi Kami"` | Judul pada header panel chat |
| `data-color` | `"#2563eb"` | Warna aksen utama (bubble, header, tombol) |

*Catatan:* Konfigurasi dibaca secara sinkron dari `document.currentScript` saat script dievaluasi pertama kali sebelum operasi asinkron apa pun.

---

## 🛠️ Membangun Ulang Widget (`build:widget`)

Jika Anda mengubah kode sumber di dalam `widget/src/`:

### Dari folder `backend/`:
```bash
npm run build:widget
```

### Atau dari folder `widget/`:
```bash
npm install   # jika dependencies esbuild/socket.io-client belum terpasang
npm run build
```

Untuk mode watch saat pengembangan aktif:
```bash
cd widget
npm run build:watch
```

---

## 📁 Struktur Kode `widget/src/`

- **`config.js`**: Membaca atribut `data-server`, `data-title`, dan `data-color` dari `document.currentScript` secara sinkron.
- **`api.js`**: REST client untuk endpoint `/api/widget/session` dan `/api/widget/conversation`.
- **`store.js`**: Manajemen state in-memory dan persistensi antrean pending serta sesi di `localStorage`. Deduplikasi pesan berdasarkan `id` dan `clientMessageId`.
- **`socket.js`**: Koneksi Socket.IO, rekoneksi otomatis, sinkronisasi pesan (`sync:request`), flush antrean dengan pengunci mutex, timer pengiriman ulang berkala (7s), dan penanganan ack.
- **`ui.js`**: Seluruh rendering tampilan di dalam Shadow DOM, isolasi style, proteksi XSS dengan `textContent`, notifikasi offline/reconnecting, badge pesan belum dibaca, dan opsi hapus untuk pesan gagal.
- **`index.js`**: Entry point dan boot sequence widget.
