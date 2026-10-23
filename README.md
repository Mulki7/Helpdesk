# Helpdesk Real-Time Support Platform

Sistem helpdesk layanan pelanggan berbasis percakapan real-time omnichannel. Proyek ini menghubungkan pelanggan pada website toko/landing page melalui **Live Chat Widget** (Shadow DOM), staf agen/admin melalui **Web App** (React), dan agen lapangan melalui **Mobile App** (Flutter).

---

## 1. Fitur Utama

- **Live Chat Widget Ringan**: Dimuat dengan satu tag `<script>` mandiri tanpa dependensi CSS eksternal; terisolasi aman di dalam **Shadow DOM**.
- **Protokol "Selalu Terkoneksi"**: Menjamin keandalan pesan saat jaringan offline/flapping melalui UUID idempotensi `clientMessageId`, antrean lokal (Local Storage & sqflite), sinkronisasi delta via `sync:request`, dan watchdog auto-reconnect.
- **Inbox & Klaim Tiket Real-Time**: Daftar tiket sinkron seketika saat ada tiket baru, pesan masuk, atau perubahan status. Pencegahan klaim ganda (*race condition*) dicegah secara atomik di sisi database.
- **Audit Trail & Siklus Tiket Lengkap**: Pencatatan aktivitas (`ticket_events`) dari status `OPEN` &rarr; `IN_PROGRESS` &rarr; `RESOLVED` &rarr; `CLOSED`, dilengkapi auto-close otomatis untuk tiket yang telah diselesaikan.
- **Multi-Role & Manajemen Agen**: Pemisahan hak akses `AGENT` dan `ADMIN` (kelola agen, reset password, dan reassignment tiket).
- **Mobile Agent On-the-Go**: Aplikasi Android Flutter dengan Material 3, konfigurasi Server URL dinamis tanpa build ulang, serta cache offline lokal dengan `sqflite`.

---

## 2. Diagram Arsitektur

```mermaid
flowchart TB
    subgraph Klien ["Klien Antarmuka (Clients)"]
        W["Live Chat Widget\n(Shadow DOM / Vanilla JS)"]
        A["Web App Agen & Admin\n(React + Vite + Tailwind)"]
        M["Mobile App Agen\n(Flutter + sqflite)"]
    end

    subgraph BackendGateway ["Backend Gateway & API (Node.js LTS)"]
        S["Express.js Server\n(Port: 3000)"]
        IO["Socket.IO Server\n(/socket.io)"]
        REST["REST API\n(/api & /widget)"]
        CRON["Auto-Close Job\n(node-cron / setInterval)"]
    end

    subgraph Storage ["Basis Data (Primary Database)"]
        DB[("PostgreSQL\n(Prisma ORM)")]
    end

    %% Koneksi Pelanggan
    W -->|REST Session & Conversation| REST
    W <-->|Socket.IO: message:send / message:new| IO

    %% Koneksi Web App
    A -->|REST: Auth & Manajemen Tiket/Agen| REST
    A <-->|Socket.IO: Bidirectional Events, Presence, Sync| IO

    %% Koneksi Mobile App
    M -->|REST: Auth & Tiket| REST
    M <-->|Socket.IO: Aggressive Reconnect, Sync| IO

    %% Server Internal
    REST --> DB
    IO --> DB
    CRON -->|Cek tiket resolved kadaluarsa| DB
```

---

## 3. Tech Stack

- **Backend**: Node.js (LTS), Express 4, Socket.IO 4, Prisma ORM 5, Zod (validasi skema), bcrypt, jsonwebtoken, Helmet.
- **Basis Data Utama**: PostgreSQL (Relational Database dengan koneksi connection pooling via Prisma).
- **Web App**: React 18, Vite, Tailwind CSS, Lucide React, Socket.IO Client.
- **Widget**: Vanilla JavaScript (ESBuild bundle ke satu file ~28 KB), Shadow DOM.
- **Mobile App**: Flutter (Dart), Provider (State Management), Dio (HTTP), Socket.IO Client, **sqflite (cache lokal di HP)**, `flutter_secure_storage`.

---

## 4. Prasyarat Sistem

Sebelum menjalankan aplikasi, pastikan perangkat telah terpasang:
- **Node.js**: Versi LTS (v18 atau v20+) dan `npm`.
- **PostgreSQL**: Versi 14, 15, atau 16 aktif lokal.
- **Flutter SDK**: (Opsional, hanya jika ingin menjalankan/mengembangkan mobile app dari source code).

---

## 5. Langkah Menjalankan dari Nol

Anda dapat menjalankan perintah dari **Root Direktori** workspace ataupun masuk langsung ke folder `backend/`.

### 5.1 Membuat Database PostgreSQL

Sediakan database kosong bernama `helpdesk`. Pilih salah satu dari dua cara berikut:

#### Cara A: Menggunakan CLI `createdb`
```bash
createdb -U postgres helpdesk
```

#### Cara B: Menggunakan SQL Shell (`psql`) atau GUI (pgAdmin / Navicat / DBeaver)
Jika perintah `createdb` tidak ada dalam `PATH` Windows Anda:
1. Buka `psql` atau query tool di GUI PostgreSQL favorit Anda.
2. Jalankan perintah SQL berikut:
```sql
CREATE DATABASE helpdesk;
```

---

### 5.2 Konfigurasi Environment (`.env`)

Salin file contoh konfigurasi pada folder `backend/`:

```bash
# Dari root direktori:
cp backend/.env.example backend/.env
```
*(Di Windows PowerShell dapat menggunakan: `copy backend\.env.example backend\.env`)*

Buka `backend/.env` dan sesuaikan koneksi database Anda:
```env
PORT=3000
DATABASE_URL="postgresql://postgres:password_anda@localhost:5432/helpdesk?schema=public"
JWT_ACCESS_SECRET="rahasia-akses-jwt-minimal-16-karakter"
JWT_REFRESH_SECRET="rahasia-refresh-jwt-minimal-16-karakter"
CORS_ORIGINS="http://localhost:5173"
AUTO_CLOSE_HOURS=24
FCM_SERVICE_ACCOUNT_PATH=
```

> **Catatan Karakter Khusus pada Password Database**:
> Jika password PostgreSQL Anda mengandung karakter khusus (seperti `@`, `#`, `:`, `/`, `%`, `&`), karakter tersebut **wajib di-URL encode** pada `DATABASE_URL`.
> *Contoh*: Jika password adalah `p@ss#123`, tuliskan menjadi: `postgresql://postgres:p%40ss%23123@localhost:5432/helpdesk`.

---

### 5.3 Instalasi Dependensi & Migrasi Database

Jalankan perintah berikut secara berurutan:

#### Opsi 1: Dari Root Direktori (Praktis)

> **Catatan**: Root `package.json` hanya menyediakan skrip proxy ke `backend/`. Dependensi backend tetap harus diinstal di folder `backend/`:

```bash
# 1. Install dependensi backend
npm --prefix backend install

# 2. Jalankan migrasi Prisma (otomatis menjalankan prisma generate)
npm run migrate

# 3. Masukkan data awal (seed akun admin, agen, dan tiket contoh)
npm run seed

# 4. Jalankan backend server
npm run dev
```

#### Opsi 2: Dari Folder `backend/` Langsung
```bash
cd backend
npm install
npm run migrate
npm run seed
npm run dev
```

Server backend akan aktif di `http://localhost:3000`.

---

## 6. URL Penting

Setelah backend menyala (`npm run dev`), semua layanan terintegrasi dapat diakses pada satu port utama:

| Endpoint | Kegunaan | Deskripsi |
|---|---|---|
| [`http://localhost:3000/demo`](http://localhost:3000/demo) | **Halaman Demo Toko** | Halaman website klien yang memuat Live Chat Widget secara langsung. |
| [`http://localhost:3000/app`](http://localhost:3000/app) | **Web App Agen & Admin** | Dashboard inbox agen dan manajemen staf oleh admin. |
| [`http://localhost:3000/widget.js`](http://localhost:3000/widget.js) | **File Script Widget** | Bundle JavaScript widget siap pasang untuk website mana pun. |
| [`http://localhost:3000/api`](http://localhost:3000/api) | **REST API Root** | Titik masuk endpoint API backend. |

---

## 7. Akun Demo (Hasil Seed)

Setelah menjalankan `npm run seed`, akun default berikut siap digunakan:

| Role | Email | Password | Hak Akses |
|---|---|---|---|
| **ADMIN** | `admin@helpdesk.test` | `Admin123!` | Akses semua tiket, kelola pengguna/agen, reset password, assign tiket. |
| **AGENT** | `agent1@helpdesk.test` | `Agent123!` | Klaim tiket antrean, chat pelanggan, ubah status, lepas tiket. |
| **AGENT** | `agent2@helpdesk.test` | `Agent123!` | Agen pendamping untuk simulasi perebutan/kolaborasi tiket. |

---

## 8. Cara Memasang Widget di Website Lain

Widget dirancang sangat portabel. Cukup sisipkan satu baris tag `<script>` sebelum tag penutup `</body>` pada halaman web Anda:

```html
<!-- Pemasangan standar (otomatis terhubung ke origin script) -->
<script src="http://localhost:3000/widget.js"></script>

<!-- Pemasangan dengan kustomisasi atribut data-* -->
<script 
  src="http://localhost:3000/widget.js"
  data-server="http://localhost:3000"
  data-title="Bantuan Pelanggan"
  data-color="#2563eb">
</script>
```

### Opsi Atribut `data-*`:
- `data-server`: URL server backend Helpdesk (default: host pembuat script).
- `data-title`: Judul panel chat (default: `Bantuan CS`).
- `data-color`: Warna aksen hex untuk bubble dan header chat (default: `#2563eb`).

---

## 9. Membangun Ulang Aset (Rebuild Assets)

Aset build widget dan web app telah disertakan secara siap pakai di git repository. Jika Anda melakukan perubahan kode sumber:

```bash
# Membangun ulang Live Chat Widget (output: widget/dist/widget.js)
npm run build:widget

# Membangun ulang Web App React (output: web/dist/)
npm run build:web
```
*(Kedua skrip dapat dipanggil langsung dari root repository maupun dari dalam folder `backend/`).*

---

## 10. Mobile App (Flutter Agen)

### 10.1 Lokasi File APK
Berkas APK rilis siap instal telah dikompilasi dan disimpan di repositori:
- **Path**: `release/helpdesk-agent.apk`
- **Ukuran**: ~49.01 MB
- **Target ABI**: Universal (arm64-v8a, x86_64)

### 10.2 Cara Menjalankan dari Source Code
```bash
cd mobile
flutter pub get
flutter run
```

### 10.3 Pengaturan Server URL (Tanpa Build Ulang)
Aplikasi mobile dilengkapi fitur pemilihan Server URL dinamis pada layar **Login** (ikon gear di pojok kanan atas) dan menu **Pengaturan**:
- **Android Emulator**: Gunakan `http://10.0.2.2:3000` (alamat loopback host dari emulator Android).
- **HP Fisik (Kabel USB / Wi-Fi)**: Gunakan IP lokal laptop Anda dalam satu jaringan Wi-Fi, misalnya: `http://192.168.1.15:3000`.

> **Catatan Firewall Windows**:
> Jika HP fisik tidak dapat tersambung ke backend laptop, pastikan Windows Firewall mengizinkan koneksi masuk (*Inbound Rules*) untuk port `3000`, atau ubah tipe koneksi Wi-Fi laptop menjadi **Private Network**.

---

## 11. Pengujian Skenario & Ketahanan Koneksi

### 11.1 Pengujian Otomatis (Smoke Realtime Test)
Backend menyediakan skrip pengujian komprehensif yang memvalidasi 8 skenario real-time (otentikasi socket, pembuatan tiket, chat 2 arah, idempotensi pesan duplikat, sync delta pesan, penanganan user nonaktif, dan claim concurrency):

```bash
# Dari root:
npm run test:realtime

# Atau langsung dari backend:
node backend/scripts/smoke-realtime.js
```

### 11.2 Skenario Pengujian Manual Ketahanan Jaringan

1. **Uji Matikan Wi-Fi (Offline Client Buffer)**:
   - Buka aplikasi Mobile atau Web Agen.
   - Putuskan koneksi Wi-Fi / data seluler.
   - Banner merah *"Menyambungkan..."* akan muncul.
   - Ketik dan kirim pesan. Pesan akan masuk ke antrean lokal bertanda ikon jam / *pending*.
   - Nyalakan kembali koneksi Wi-Fi.
   - Socket akan langsung pulih seketika dan pesan pending otomatis terkirim tanpa duplikasi.
2. **Uji Restart Server (Graceful Recovery)**:
   - Jalankan Web App dan Widget secara bersamaan.
   - Hentikan proses backend (`Ctrl + C` di terminal `npm run dev`).
   - Klien menampilkan indikator terputus.
   - Jalankan kembali `npm run dev`.
   - Semua klien akan melakukan auto-reconnect dan menyinkronkan pesan tertinggal melalui event `sync:request`.

---

## 12. Keputusan Desain & Arsitektur

Semua keputusan desain di bawah ini telah diimplementasikan secara konkret pada basis kode:

1. **Idempotensi & Anti Duplikasi Pesan**:
   - Skema database menerapkan constraint `@@unique([ticketId, clientMessageId])` pada tabel `messages` (`backend/prisma/schema.prisma`).
   - Setiap pesan dari klien memiliki UUID v4 acak (`clientMessageId`).
   - Jika terjadi retry jaringan atau disconnect, `backend/src/services/chat.service.js` menangani konflik *unique constraint* (kode Prisma `P2002`) dengan mengembalikan pesan yang sudah ada tanpa menduplikasi data.
2. **Pencegahan Race Condition Pembuatan Tiket (Row-Level Locking)**:
   - Pada `backend/src/services/chat.service.js` fungsi `sendMessage()`, pembuatan tiket pertama kali oleh pelanggan diamankan menggunakan transaksi database dan row lock:
     ```sql
     SELECT 1 FROM "customers" WHERE id = ${customer.id} FOR UPDATE;
     ```
   - Ini mencegah terjadinya pembuatan dua tiket berbeda ketika pelanggan mengirim dua pesan berturut-turut dengan sangat cepat.
3. **Klaim Tiket Atomik (Atomic Ticket Claim)**:
   - Pada `backend/src/services/ticket.service.js` fungsi `claimTicket()`, pengecekan status tiket `OPEN` dan ketiadaan `assignedAgentId` dilakukan dalam query atomic update dengan klausa `where: { id, status: 'OPEN', assignedAgentId: null }`.
   - Jika dua agen mengklik klaim secara bersamaan, hanya satu transaksi yang berhasil mengubah row; agen kedua otomatis menerima galat bahwa tiket telah diambil.
4. **Strategi "Selalu Terkoneksi" (Resilience Protocol)**:
   - **Client Acknowledgement & Timeout**: Pengiriman socket menggunakan mekanisme callback ACK dengan batas waktu 5000 ms (`widget/src/socket.js`, `web/src/socket/index.js`, `mobile/lib/data/socket/socket_service.dart`).
   - **Antrean Offline**: Pesan pending disimpan pada antrean memori / storage lokal (`sqflite` di mobile melalui `mobile/lib/data/db/queue_dao.dart`) dan di-flush otomatis saat event `connect` terpicu.
   - **Aggressive Reconnection & Watchdog**: Socket service pada mobile (`mobile/lib/data/socket/socket_service.dart`) menerapkan interval reconnect agresif (200 ms - 1000 ms) dipadukan dengan timer `_startWatchdog()` periodik setiap 2 detik untuk memastikan koneksi pulih instan begitu jaringan HP kembali online.
   - **Delta Sync**: Saat tersambung kembali, klien memancarkan event `sync:request` membawa ID pesan terakhir untuk mengambil seluruh pesan yang terlewat selama terputus (`backend/src/sockets/chat.handler.js`).
5. **Otorisasi Ketat Multi-Role**:
   - Middleware `requireRole(['ADMIN'])` (`backend/src/middleware/requireRole.js`) melindungi seluruh endpoint sensitif di sisi server. Menyembunyikan menu di antarmuka tidak dijadikan satu-satunya lapisan keamanan.

---

## 13. Batasan yang Diketahui & Pengembangan Lanjutan

Fitur-fitur berikut berada di luar cakupan rilis saat ini dan dapat ditambahkan pada pengembangan berikutnya:
- **Push Notification (FCM)**: Pengiriman push notification ke aplikasi mobile saat tertutup (tahap persiapan arsitektur token perangkat telah tersedia pada tabel `device_tokens`, integrasi FCM ditunda).
- **Lampiran Berkas (File Attachments)**: Pengiriman gambar, PDF, atau dokumen pendukung komplain pelanggan.
- **Kategori Tiket & SLA Management**: Pengelompokan tiket berdasarkan departemen (Billing, Teknis, Sales) dan batas waktu tanggapan (SLA).
- **Customer Satisfaction (CSAT)**: Survei kepuasan bintang 1-5 setelah tiket berstatus `CLOSED`.
- **Dashboard Laporan & Analitik**: Grafik waktu respon pertama (FRT) dan durasi penyelesaian tiket agen.

---

## 14. Dokumentasi Proyek

Dokumen analisis sistem dan diagram arsitektur tersimpan pada folder `docs/`:
- **Diagram Alur Proses**: [docs/BPMN_Helpdesk.pdf](file:///c:/Users/Hype/helpdesk/docs/BPMN_Helpdesk.pdf) *(BPMN proses bisnis layanan)*
- **Struktur Rincian Kerja**: [docs/WBS_Helpdesk.xlsx](file:///c:/Users/Hype/helpdesk/docs/WBS_Helpdesk.xlsx) *(Work Breakdown Structure)*
- **Entity Relationship Diagram**: [docs/ERD.md](file:///c:/Users/Hype/helpdesk/docs/ERD.md) *(ERD Mermaid lengkap sesuai Prisma schema)*
