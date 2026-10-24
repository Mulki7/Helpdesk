# Helpdesk Real-Time Support Platform

Sistem helpdesk berbasis chat real-time. Pelanggan mengobrol lewat **Live Chat Widget** yang terpasang di sebuah website, agen dan admin menangani percakapan lewat **Web App** (React), dan agen juga dapat bekerja lewat **Mobile App** (Flutter). Setiap percakapan menjadi **tiket** yang dilacak dari status `OPEN` sampai `CLOSED`.

Proyek ini dibuat sebagai Take Home Programming Test Software Engineer (pilihan: Aplikasi Helpdesk).

---

## 1. Fitur Utama

- **Live Chat Widget**: dimuat dengan satu tag `<script>` tanpa dependensi CSS eksternal, dan terisolasi di dalam **Shadow DOM** agar tidak bentrok dengan website yang memasangnya.
- **Protokol "Selalu Terkoneksi"**: pesan tidak hilang dan tidak ganda saat jaringan putus atau tidak stabil, lewat UUID `clientMessageId` untuk idempotensi, konfirmasi (ack) dari server, antrean pesan lokal (Local Storage di widget, sqflite di mobile), pengiriman ulang otomatis, dan sinkronisasi pesan yang terlewat lewat `sync:request`. Aplikasi mobile juga memakai timer watchdog untuk memulihkan koneksi.
- **Inbox dan Klaim Tiket Real-Time**: daftar tiket ter-update seketika saat ada tiket baru, pesan masuk, atau perubahan status. Klaim ganda dicegah secara atomik di database.
- **Siklus Tiket dan Audit Trail**: `OPEN` &rarr; `IN_PROGRESS` &rarr; `RESOLVED` &rarr; `CLOSED`, setiap perubahan tercatat di `ticket_events`, dan tiket `RESOLVED` otomatis ditutup setelah batas waktu tertentu.
- **Multi-Role**: hak akses `AGENT` dan `ADMIN` (admin dapat mengelola akun agen dan memindahkan tiket).
- **Mobile App Agen**: Flutter (Material 3), Server URL dapat diubah tanpa build ulang, dan cache offline lokal dengan sqflite.
- **Push Notification (FCM)**: agen menerima notifikasi untuk tiket baru, pesan pelanggan, dan penugasan tiket saat aplikasi berada di background atau tertutup. Fitur ini opsional (lihat bagian 13).

---

## 2. Tampilan Aplikasi

| Login Web | Login Mobile |
|---|---|
| ![Login web](docs/screenshots/login%20helpdesk.png) | ![Login mobile](docs/screenshots/login%20mobile%20helpdesk.jpeg) |

| Web App Agen/Admin | Widget di Halaman Demo |
|---|---|
| ![Web inbox](docs/screenshots/web%20helpdesk.png) | ![Widget di halaman demo](docs/screenshots/widget%20helpdesk.png) |

| Daftar Tiket (Mobile) | Chat Tiket (Mobile) | Push Notification |
|---|---|---|
| ![Daftar tiket mobile](docs/screenshots/mobile%20helpdesk.jpeg) | ![Chat tiket mobile](docs/screenshots/room%20massage%20helpdesk.jpeg) | ![Push notification](docs/screenshots/notification%20mobile.jpeg) |

---

## 3. Diagram Arsitektur

```mermaid
flowchart TB
    subgraph Klien ["Klien"]
        W["Live Chat Widget<br/>(JavaScript murni, Shadow DOM)"]
        A["Web App Agen dan Admin<br/>(React, Vite, Tailwind)"]
        M["Mobile App Agen<br/>(Flutter, sqflite)"]
    end

    subgraph Backend ["Backend (Node.js, Express)"]
        REST["REST API<br/>(/api dan /widget)"]
        IO["Socket.IO Server<br/>(/socket.io)"]
        JOB["Job Auto-Close Tiket"]
    end

    DB[("PostgreSQL<br/>(Prisma ORM)")]
    FCM["Firebase Cloud Messaging"]

    W -->|REST: sesi dan riwayat| REST
    W <-->|Socket.IO: chat real-time| IO
    A -->|REST: auth, tiket, agen| REST
    A <-->|Socket.IO: event tiket dan chat| IO
    M -->|REST: auth dan tiket| REST
    M <-->|Socket.IO: event tiket dan chat| IO

    REST --> DB
    IO --> DB
    JOB -->|tutup tiket resolved yang kedaluwarsa| DB
    IO -.->|push untuk staf offline| FCM
    FCM -.->|notifikasi| M
```

Satu server Express menyajikan semuanya: REST API, Socket.IO, web app di `/app`, file widget di `/widget.js`, dan halaman demo di `/demo`.

---

## 4. Tech Stack

- **Backend**: Node.js (LTS), Express, Socket.IO, Prisma ORM, Zod (validasi), bcrypt, jsonwebtoken, Helmet, firebase-admin.
- **Database**: PostgreSQL.
- **Web App**: React, Vite, Tailwind CSS, socket.io-client.
- **Widget**: JavaScript murni, Shadow DOM, di-bundle dengan esbuild menjadi satu file `widget.js`.
- **Mobile App**: Flutter (Dart), Provider, Dio, socket_io_client, **sqflite (cache lokal di HP)**, flutter_secure_storage, firebase_messaging, flutter_local_notifications.

Struktur repository:

```
helpdesk/
├── backend/     API, Socket.IO, Prisma (schema, migration, seed), skrip uji
├── web/         Web app agen dan admin (hasil build ada di web/dist)
├── widget/      Live chat widget dan halaman demo (hasil build ada di widget/dist)
├── mobile/      Aplikasi Flutter
├── release/     APK siap pasang
├── docs/        BPMN, WBS, ERD, tangkapan layar
├── PRD_Helpdesk.md
└── README.md
```

---

## 5. Menjalankan dari Nol

### 5.0 Prasyarat

- **Node.js** versi LTS dan `npm`.
- **PostgreSQL** (versi 14 atau lebih baru) yang sedang berjalan.
- **Flutter SDK** (opsional, hanya jika ingin menjalankan mobile app dari source code).

### 5.1 Mengambil kode

```bash
git clone https://github.com/Mulki7/Helpdesk.git
cd Helpdesk
```

### 5.2 Membuat database PostgreSQL

Sediakan database kosong bernama `helpdesk`. Pilih salah satu cara:

**Cara A: lewat CLI**

```bash
createdb -U postgres helpdesk
```

**Cara B: lewat `psql` atau GUI (pgAdmin / Navicat / DBeaver)**, jika `createdb` tidak ada di `PATH` Windows:

```sql
CREATE DATABASE helpdesk;
```

### 5.3 Konfigurasi environment

Salin file contoh:

```bash
# Linux / macOS
cp backend/.env.example backend/.env

# Windows PowerShell
copy backend\.env.example backend\.env
```

Buka `backend/.env` dan sesuaikan isinya:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:password_anda@localhost:5432/helpdesk?schema=public"
JWT_ACCESS_SECRET="isi-dengan-teks-acak-minimal-16-karakter"
JWT_REFRESH_SECRET="isi-dengan-teks-acak-lain-minimal-16-karakter"
CORS_ORIGINS="http://localhost:5173"
AUTO_CLOSE_HOURS=24
FCM_SERVICE_ACCOUNT_PATH=
```

> **Password dengan karakter khusus**: jika password PostgreSQL mengandung karakter seperti `@`, `#`, `:`, `/`, `%`, atau `&`, karakter itu harus di-URL encode di `DATABASE_URL`. Contoh: password `p@ss#123` ditulis `p%40ss%23123`, sehingga menjadi `postgresql://postgres:p%40ss%23123@localhost:5432/helpdesk`.

`AUTO_CLOSE_HOURS` menentukan berapa jam tiket `RESOLVED` dibiarkan sebelum ditutup otomatis (boleh desimal untuk pengujian, misalnya `0.01`). Push notification bersifat opsional; lihat bagian 13.

### 5.4 Instal, migrasi, seed, dan jalankan

Perintah di bawah dapat dijalankan dari **root repository**. Root `package.json` hanya meneruskan skrip ke folder `backend/`, jadi dependensi backend tetap diinstal dengan `npm --prefix backend install`.

```bash
npm --prefix backend install   # instal dependensi backend
npm run migrate                # migrasi database (otomatis menjalankan prisma generate)
npm run seed                   # akun demo dan tiket contoh
npm run dev                    # menjalankan backend
```

Alternatif dari folder `backend/`:

```bash
cd backend
npm install
npm run migrate
npm run seed
npm run dev
```

Server aktif di `http://localhost:3000`.

---

## 6. URL Penting

| URL | Kegunaan |
|---|---|
| [`http://localhost:3000/demo`](http://localhost:3000/demo) | Halaman demo toko yang memasang Live Chat Widget (sisi customer) |
| [`http://localhost:3000/app`](http://localhost:3000/app) | Web app agen dan admin |
| [`http://localhost:3000/widget.js`](http://localhost:3000/widget.js) | File script widget |
| `http://localhost:3000/api` | REST API |

Cara mencoba alur dasar: buka `/demo` dan kirim pesan sebagai customer, lalu buka `/app` di tab lain, login sebagai agen, ambil tiket yang masuk, dan balas.

---

## 7. Akun Demo (Hasil Seed)

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@helpdesk.test` | `Admin123!` |
| AGENT | `agent1@helpdesk.test` | `Agent123!` |
| AGENT | `agent2@helpdesk.test` | `Agent123!` |

Customer tidak perlu login; cukup mengisi nama di widget.

---

## 8. Memasang Widget di Website Lain

Sisipkan satu tag `<script>` sebelum `</body>`:

```html
<!-- Pemasangan standar (terhubung ke server tempat widget.js dimuat) -->
<script src="http://localhost:3000/widget.js"></script>

<!-- Dengan opsi -->
<script
  src="http://localhost:3000/widget.js"
  data-server="http://localhost:3000"
  data-title="Bantuan Pelanggan"
  data-color="#2563eb">
</script>
```

Opsi atribut:

- `data-server`: alamat server Helpdesk (bawaan: server tempat `widget.js` dimuat).
- `data-title`: judul panel chat.
- `data-color`: warna aksen (hex) untuk bubble dan header.

---

## 9. Membangun Ulang Aset

Hasil build widget dan web app sudah disertakan di repository, jadi `/demo` dan `/app` langsung berfungsi setelah `npm run dev`. Jika Anda mengubah kode sumbernya:

```bash
npm run build:widget   # menghasilkan widget/dist/widget.js
npm run build:web      # menghasilkan web/dist/
```

---

## 10. Mobile App (Flutter)

### 10.1 APK siap pasang

File APK ada di `release/helpdesk-agent.apk`. Pasang di HP Android (izinkan instalasi dari sumber tidak dikenal).

### 10.2 Menjalankan dari source code

```bash
cd mobile
flutter pub get
flutter run
```

### 10.3 Menghubungkan aplikasi ke backend

Aplikasi tidak memakai alamat server tetap. Alamat dapat diubah dari layar **Login** (ikon gear di pojok kanan atas) dan dari menu **Pengaturan**, tanpa build ulang. Langkahnya:

1. Jalankan backend di laptop (`npm run dev`).
2. Tentukan alamat server:
   - **Emulator Android**: `http://10.0.2.2:3000`
   - **HP asli**: `http://<IP-laptop>:3000`, misalnya `http://192.168.1.15:3000`. Cari IP laptop dengan `ipconfig` (Windows) dan lihat IPv4 pada adapter Wi-Fi. Laptop dan HP harus berada di jaringan Wi-Fi yang sama.
3. Masukkan alamat itu di aplikasi, lalu login memakai akun demo (bagian 7).

> **Firewall Windows**: jika HP tidak dapat tersambung padahal alamatnya benar, izinkan koneksi masuk untuk port `3000` (Inbound Rule) atau ubah jaringan Wi-Fi laptop menjadi **Private Network**.

---

## 11. Pengujian

### 11.1 Skrip uji real-time otomatis

Skrip ini memerlukan backend yang sedang berjalan dan database yang sudah di-seed. Jalankan backend di satu terminal (`npm run dev`), lalu di terminal lain:

```bash
npm run test:realtime
```

Skrip memvalidasi belasan skenario real-time, antara lain: autentikasi socket, pembuatan tiket dari pesan pertama, chat dua arah, idempotensi pesan (termasuk pengiriman paralel dengan `clientMessageId` yang sama), pencegahan tiket ganda saat dua pesan pertama tiba bersamaan, pembukaan kembali tiket `RESOLVED`, pembuatan tiket baru setelah `CLOSED`, pesan sistem saat tidak ada agen online, sinkronisasi pesan yang terlewat, pemutusan socket user yang dinonaktifkan, dan klaim tiket bersamaan oleh dua agen. Data uji dibersihkan di akhir, jadi skrip dapat dijalankan berulang kali.

### 11.2 Skenario manual ketahanan koneksi

1. **Koneksi klien putus**: buka widget (`/demo`) atau aplikasi mobile, matikan Wi-Fi atau aktifkan mode offline di DevTools, lalu kirim pesan. Pesan tampil dengan ikon jam (pending). Nyalakan koneksi kembali; pesan terkirim satu kali, tanpa duplikat.
2. **Server restart**: buka `/demo`, `/app`, dan aplikasi mobile bersamaan, hentikan backend (`Ctrl + C`), lalu jalankan lagi dengan `npm run dev`. Semua klien menyambung kembali sendiri dan mengambil pesan yang terlewat.
3. **Klaim bersamaan**: buka `/app` di dua jendela dengan agen berbeda, tekan "Ambil Tiket" pada tiket yang sama hampir bersamaan. Hanya satu yang berhasil; yang lain mendapat pesan bahwa tiket sudah diambil.
4. **Tidak ada agen online**: kirim pesan dari `/demo` saat tidak ada agen yang login. Tiket tetap terbentuk, dan customer menerima pesan otomatis dari sistem.

---

## 12. Keputusan Desain

Ringkasan keputusan penting dan lokasinya di kode:

1. **Idempotensi pesan**: tabel `messages` memiliki constraint unik `(ticketId, clientMessageId)` (`backend/prisma/schema.prisma`). Jika klien mengirim ulang pesan yang sama, service chat (`backend/src/services/chat.service.js`) mengembalikan pesan yang sudah ada, termasuk saat dua pengiriman tiba bersamaan (konflik unique ditangani tanpa membuat pesan baru).
2. **Pencegahan tiket ganda**: pembuatan tiket oleh pelanggan berjalan di dalam transaksi dengan row lock pada baris customer (`SELECT ... FOR UPDATE`), sehingga dua pesan pertama yang tiba bersamaan tidak membuat dua tiket.
3. **Klaim tiket atomik**: klaim dilakukan dengan satu query update bersyarat (`status = OPEN` dan belum ada assignee) di `backend/src/services/ticket.service.js`. Jika dua agen menekan klaim bersamaan, hanya satu yang berhasil.
4. **Aturan tiket**: satu tiket per percakapan. Pesan customer pada tiket `RESOLVED` membuka kembali tiket; pada tiket `CLOSED` membuat tiket baru. Hanya agen yang memegang tiket (atau admin) yang dapat membalas.
5. **Strategi "selalu terkoneksi"**: setiap pesan memiliki `clientMessageId`; klien menunggu ack dari server dan menyimpan pesan yang belum terkonfirmasi di antrean lokal; setiap kali tersambung (termasuk reconnect), klien meminta sinkronisasi pesan yang terlewat lalu mengirim ulang antrean secara berurutan. Socket.IO memakai transport WebSocket dengan fallback polling.
6. **Otorisasi di server**: peran dicek di middleware backend (`backend/src/middleware/requireRole.js`); menyembunyikan menu di antarmuka bukan satu-satunya perlindungan. Akun yang dinonaktifkan ditolak pada setiap request dan socket-nya diputus.
7. **Database**: skema PostgreSQL dengan enum, foreign key, dan index; riwayat perubahan tiket dicatat di `ticket_events`. Lihat [docs/ERD.md](docs/ERD.md).

---

## 13. Push Notification (Firebase Cloud Messaging)

Push notification bersifat **opsional**. Tanpa konfigurasi di bawah, backend dan semua fitur chat tetap berjalan normal; hanya pengiriman push yang tidak aktif.

### 13.1 Menyiapkan Firebase

1. Buat proyek di [Firebase Console](https://console.firebase.google.com), lalu tambahkan aplikasi **Android** dengan nama paket yang sama dengan `applicationId` di `mobile/android/app/build.gradle` (atau `build.gradle.kts`).
2. Unduh `google-services.json` dan letakkan di `mobile/android/app/`.
3. Di Firebase: **Project settings > Service accounts > Generate new private key**. Simpan sebagai `backend/firebase-service-account.json`. File ini rahasia dan sudah diabaikan oleh `.gitignore`.
4. Isi `backend/.env`:

   ```env
   FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```

5. Jalankan ulang backend.

Jika `FCM_SERVICE_ACCOUNT_PATH` kosong atau file tidak ditemukan, fungsi pengiriman push tidak melakukan apa-apa tanpa menimbulkan error. Di sisi mobile, jika `google-services.json` tidak ada saat build, aplikasi tetap berjalan tanpa push.

### 13.2 Aturan pengiriman

Push hanya dikirim ke staf yang **tidak sedang terhubung lewat socket**. Saat aplikasi mobile masuk ke background, aplikasi memutus koneksi socket secara sengaja sehingga server menganggap agen offline; saat aplikasi dibuka kembali, socket tersambung dan data disinkronkan.

Pemicunya:

1. **Tiket baru**: dikirim ke semua staf yang offline.
2. **Tiket dibuka kembali**: dikirim ke assignee jika offline, atau ke semua staf offline jika belum ada assignee.
3. **Pesan pelanggan masuk**: dikirim ke agen yang menangani tiket jika offline.
4. **Tiket ditugaskan**: dikirim ke agen yang baru ditugaskan jika offline.

Mengetuk notifikasi membuka layar chat tiket yang bersangkutan.

---

## 14. Batasan dan Pengembangan Lanjutan

Belum dikerjakan pada versi ini:

- **Deployment backend online**: aplikasi dijalankan secara lokal. Agar APK dapat dicoba, backend harus dijalankan di laptop dan alamat servernya diisi di aplikasi (bagian 10.3).
- **Lampiran berkas**: pengiriman gambar, PDF, atau dokumen di dalam chat.
- **Kategori tiket dan SLA**: pengelompokan tiket per departemen dan batas waktu respon.
- **Rating kepuasan (CSAT)**: survei kepuasan setelah tiket ditutup.
- **Dashboard laporan**: statistik waktu respon dan penyelesaian tiket.
- **Jawaban otomatis dengan AI**: balasan otomatis untuk pertanyaan umum pelanggan.

---

## 15. Dokumentasi Proyek

Dokumen analisis dan perancangan ada di folder `docs/`:

- **Diagram alur proses (BPMN)**: [docs/BPMN_Helpdesk.drawio.pdf](docs/BPMN_Helpdesk.drawio.pdf)
- **Struktur rincian kerja (WBS)**: [docs/WBS_Helpdesk.xlsx](docs/WBS_Helpdesk.xlsx)
- **Entity Relationship Diagram (ERD)**: [docs/ERD.md](docs/ERD.md)
- **Spesifikasi produk (PRD)**: [PRD_Helpdesk.md](PRD_Helpdesk.md)