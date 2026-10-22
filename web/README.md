# Helpdesk Web App (Agen & Admin)

Web application untuk Agen Customer Support dan Administrator Helpdesk.
Dibangun menggunakan **React**, **Vite**, **Tailwind CSS**, **React Router DOM**, dan **Socket.IO Client**.
Aplikasi ini melayani pengelolaan tiket, live chat dengan customer secara real-time, dan manajemen pengguna (admin).

---

## 🚀 Menjalankan Aplikasi

Web app disajikan oleh server backend di path:
**`http://localhost:3000/app`**

Hasil build produksi sudah dibundel dan di-commit di folder `web/dist/`, sehingga setelah menjalankan backend (`npm run dev`), web app langsung dapat digunakan tanpa langkah build tambahan.

### Akun Demo:
- **Admin**: `admin@helpdesk.test` / `Admin123!`
- **Agen 1**: `agent1@helpdesk.test` / `Agent123!`
- **Agen 2**: `agent2@helpdesk.test` / `Agent123!`

---

## 🛠️ Pengembangan & Pembangunan Ulang

### 1. Menjalankan Vite Dev Server (Pengembangan Cepat)
Saat pengembangan antarmuka, Anda dapat menjalankan dev server independen di port 5173 dengan proxy otomatis ke backend:

```bash
cd web
npm install
npm run dev
```
Buka browser di `http://localhost:5173/app/`.

### 2. Membangun Bundle Produksi (`build:web`)
Jika ada perubahan kode di folder `web/src/`:

- **Dari folder root `backend/`:**
  ```bash
  npm run build:web
  ```

- **Atau dari folder `web/`:**
  ```bash
  npm run build
  ```

Output akan otomatis ditempatkan di `web/dist/` dengan base path `/app/`.

---

## 📁 Struktur Kode `web/src/`

- **`api/`**:
  - `client.js`: HTTP client berbasis `fetch` dengan manajemen `accessToken` in-memory dan automatic token refresh interceptor (HTTP 401).
  - `auth.js`: Endpoint login, logout, getMe.
  - `tickets.js`: Endpoint tiket (list, detail, messages, claim, release, assign, update).
  - `users.js`: Endpoint manajemen user agen & admin.
- **`socket/`**:
  - `index.js`: Socket.IO client, auto-refresh token saat handshake ditolak, listener broadcast event, reconnect sync recovery, dan pengiriman pesan berurutan dengan mutex lock.
- **`context/`**:
  - `AuthContext.jsx`: State sesi user, login, logout, role check (`isAdmin`).
  - `ConnectionContext.jsx`: Indikator status koneksi real-time (`connected`, `reconnecting`, `offline`).
  - `TicketsContext.jsx`: Manajemen state filter tab, counts, search debounced, daftar tiket, riwayat chat aktif, dan antrean pending.
- **`components/`**:
  - `layout/`: `Sidebar.jsx`, `Navbar.jsx`, `AppLayout.jsx`.
  - `tickets/`: `TicketList.jsx`, `TicketCard.jsx`, `TicketFilters.jsx`, `TicketHeader.jsx`, `TicketChat.jsx`, `TicketEvents.jsx`, `AssignModal.jsx`.
  - `agents/`: `UserModal.jsx`.
  - `common/`: `Badge.jsx`, `Modal.jsx`, `EmptyState.jsx`.
- **`pages/`**:
  - `LoginPage.jsx`: Form autentikasi agen/admin.
  - `TicketsPage.jsx`: Split view inbox tiket & chat percakapan.
  - `AgentsPage.jsx`: Tabel dan CRUD akun agen/admin (khusus role Admin).
- **`utils/`**:
  - `formatters.js`: Formatting nomor tiket (`HD-xxxx`), waktu relatif bahasa Indonesia, label & warna status/prioritas.
