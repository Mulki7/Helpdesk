# PRD - Aplikasi Helpdesk (Live Chat + Ticketing)

> Dokumen ini adalah spesifikasi lengkap untuk AI coding agent. Ikuti dokumen ini apa adanya. Jangan menambah fitur di luar scope, dan jangan mengganti keputusan teknologi yang sudah ditetapkan. Jika ada hal yang ambigu, pilih opsi paling sederhana yang konsisten dengan dokumen ini, lalu catat asumsinya di README.

## 1. Ringkasan

Helpdesk adalah aplikasi untuk melacak kendala pelanggan. Pelanggan (customer) mengobrol lewat **live chat widget** yang tertempel di sebuah website. Setiap percakapan menjadi **tiket**. Agen Customer Support (CS) menangani tiket lewat **web app** dan **mobile app**. Admin mengawasi semua tiket dan mengelola akun agen.

Ini adalah take-home programming test Software Engineer (Ciheul Technologies). Hal yang dinilai: kemampuan analisis, kerapian source code, penentuan database schema, dan debugging.

### Syarat dari soal (wajib dipenuhi)

| Komponen | Syarat |
|---|---|
| Live Chat Widget | Di kanan bawah (seperti Intercom). **Wajib JavaScript.** |
| Mobile App | **Wajib Flutter.** APK wajib dikirim. |
| Web App | Python atau JavaScript. Database SQLite atau PostgreSQL. |
| Fitur wajib | Widget <-> Web App <-> Mobile App harus **selalu terkoneksi dalam kondisi apapun**. |
| Fitur opsional (nilai plus) | Push notification di mobile app. |
| Pengiriman | **Satu** repository GitHub berisi semua source code. |

## 2. Keputusan teknologi (final, jangan diubah)

| Bagian | Teknologi |
|---|---|
| Bahasa | **JavaScript biasa (ES modules)**. Bukan TypeScript. |
| Backend | Node.js (LTS) + Express + Socket.IO |
| Database | **PostgreSQL** + Prisma ORM |
| Validasi | Zod |
| Auth | JWT (access + refresh token), bcrypt untuk password |
| Web app | React + Vite + Tailwind CSS + React Router + `socket.io-client` |
| Widget | JavaScript murni (vanilla), Shadow DOM, bundle dengan esbuild menjadi satu file `widget.js`, `socket.io-client` di-bundle ke dalamnya |
| Mobile | Flutter + Provider + `dio` + `socket_io_client` + `flutter_secure_storage` + `sqflite` + `firebase_messaging` |
| Push | Firebase Cloud Messaging (FCM) lewat `firebase-admin` di backend |

**Dilarang:** Docker/docker-compose, TypeScript, fitur AI auto-reply, framework tambahan di luar daftar di atas tanpa alasan kuat.

## 3. Scope

### Termasuk

1. Autentikasi agen/admin (JWT) dan manajemen akun agen oleh admin.
2. Manajemen tiket: pembuatan otomatis, status, prioritas, claim/release, assign ulang, auto-close, audit trail.
3. Real-time chat dengan ketahanan koneksi (reconnect, antrean offline, sinkronisasi, anti-duplikat).
4. Live chat widget + halaman demo.
5. Web app agen/admin.
6. Mobile app Flutter untuk agen + APK.
7. Push notification (dikerjakan paling akhir).
8. Seed data, `.env.example`, README.

### Tidak termasuk (jangan dibuat)

AI auto-reply, kategori tiket, lampiran file/gambar, indikator "sedang mengetik", SLA/eskalasi, rating kepuasan (CSAT), dashboard statistik/laporan, knowledge base, canned response, Docker.

## 4. Peran pengguna

| Peran | Login? | Memakai | Kemampuan |
|---|---|---|---|
| **Customer** | Tidak | Widget | Mengirim dan menerima pesan di tiketnya sendiri. Dikenali lewat `visitorToken` anonim. |
| **Agent** (CS) | Ya | Web app, mobile app | Melihat semua tiket (read-only untuk tiket milik agen lain). Claim/release tiket, membalas tiket yang ditugaskan padanya, ubah status dan prioritas tiket miliknya. |
| **Admin** | Ya | Web app (mobile boleh login tapi tanpa fitur admin) | Semua kemampuan agent pada semua tiket, ditambah assign ulang tiket dan kelola akun agen. |

## 5. Struktur repository (monorepo)

```
helpdesk/
├── backend/
│   ├── prisma/             schema.prisma, migrations, seed.js
│   ├── src/
│   │   ├── config/         env.js, logger
│   │   ├── routes/         definisi endpoint per resource
│   │   ├── controllers/    baca request, validasi, panggil service, kirim response
│   │   ├── services/       SEMUA logika bisnis (auth, user, ticket, chat, presence, notification)
│   │   ├── sockets/        setup Socket.IO, auth handshake, handler event
│   │   ├── middleware/     auth, requireRole, errorHandler, rateLimit, validate
│   │   ├── jobs/           autoCloseTickets.js
│   │   ├── utils/          helper kecil (ticketNumber, httpError)
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── web/                    React + Vite + Tailwind (base path /app/)
├── widget/                 src/, build script esbuild, demo.html
├── mobile/                 proyek Flutter
├── docs/                   BPMN (PDF), WBS (xlsx), ERD
└── README.md
```

Aturan kerapian:
- Controller **tidak** boleh berisi logika bisnis atau query Prisma langsung. Semua lewat service.
- Satu file satu tanggung jawab. Nama file dan fungsi konsisten (camelCase untuk variabel/fungsi, PascalCase untuk komponen/kelas).
- Validasi semua input dengan Zod. Error ditangani terpusat (lihat bagian 9).
- Kode dan komentar dalam bahasa Inggris. Teks antarmuka dan README dalam bahasa Indonesia.
- Tidak ada secret di repo. Sediakan `.env.example`.

## 6. Backend menyajikan

| Path | Isi |
|---|---|
| `/api/...` | REST API |
| `/socket.io` | Socket.IO |
| `/app` | Hasil build web app React (SPA, fallback ke `index.html`) |
| `/widget.js` | Hasil build widget |
| `/demo` | Halaman demo website "Toko Contoh" yang memasang widget |

Saat pengembangan, web app boleh dijalankan dengan Vite dev server (port 5173) dengan proxy ke backend.

## 7. Database schema (PostgreSQL via Prisma)

Gunakan enum dan foreign key. Semua timestamp `timestamptz`.

### Enum

- `Role`: `AGENT`, `ADMIN`
- `TicketStatus`: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
- `TicketPriority`: `LOW`, `MEDIUM`, `HIGH`
- `SenderType`: `CUSTOMER`, `AGENT`, `SYSTEM`
- `TicketEventType`: `CREATED`, `ASSIGNED`, `RELEASED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `REOPENED`

### Tabel

**users**
- `id` Int PK autoincrement
- `name` String
- `email` String unique
- `passwordHash` String
- `role` Role
- `isActive` Boolean default true
- `createdAt`, `updatedAt`

**refresh_tokens**
- `id` Int PK
- `userId` -> users (onDelete Cascade)
- `tokenHash` String unique
- `expiresAt` DateTime
- `revokedAt` DateTime nullable
- `createdAt`

**customers**
- `id` Int PK
- `visitorToken` String unique (UUID v4)
- `name` String
- `email` String nullable
- `createdAt`, `lastSeenAt`

**tickets**
- `id` Int PK
- `customerId` -> customers
- `assignedAgentId` -> users, **nullable**
- `subject` String (50 karakter pertama dari pesan pertama)
- `status` TicketStatus default OPEN
- `priority` TicketPriority default MEDIUM
- `createdAt`, `updatedAt`
- `lastMessageAt` DateTime (untuk pengurutan daftar)
- `resolvedAt` DateTime nullable, `closedAt` DateTime nullable
- Index: `(status, assignedAgentId)`, `(customerId, createdAt)`, `(lastMessageAt)`
- **Nomor tiket tidak disimpan.** Ditampilkan sebagai `HD-` + id dengan padding 4 digit (contoh `HD-0007`), dihitung di serializer.

**messages**
- `id` Int PK autoincrement (dipakai sebagai kursor sinkronisasi, urutan naik monoton)
- `ticketId` -> tickets (onDelete Cascade)
- `senderType` SenderType
- `senderUserId` -> users, nullable (terisi hanya jika senderType = AGENT)
- `body` String (maks 2000 karakter)
- `clientMessageId` String nullable (UUID dari klien)
- `createdAt`
- **Unique `(ticketId, clientMessageId)`** untuk idempotensi (Postgres mengizinkan banyak NULL, jadi pesan SYSTEM aman)
- Index: `(ticketId, id)`

**ticket_events** (audit trail)
- `id` Int PK
- `ticketId` -> tickets (Cascade)
- `actorUserId` -> users, nullable (kosong jika dilakukan sistem atau customer)
- `type` TicketEventType
- `oldValue` String nullable, `newValue` String nullable
- `createdAt`
- Index: `(ticketId, createdAt)`

**device_tokens**
- `id` Int PK
- `userId` -> users (Cascade)
- `token` String unique
- `platform` String (`android`)
- `createdAt`, `updatedAt`

## 8. Aturan bisnis tiket

Status: `OPEN` -> `IN_PROGRESS` -> `RESOLVED` -> `CLOSED`.

1. **Satu tiket per percakapan.** Tidak ada formulir panjang. Customer cukup mengisi nama (email opsional) sekali, lalu pesan pertama langsung membentuk tiket.
2. **Saat customer mengirim pesan**, server mencari tiket terbaru milik customer itu dan menerapkan:
   - Tidak ada tiket, atau tiket terakhir `CLOSED` -> **buat tiket baru** (`OPEN`), event `CREATED`.
   - Tiket `OPEN` atau `IN_PROGRESS` -> tambahkan pesan ke tiket itu.
   - Tiket `RESOLVED` -> **buka kembali**: status menjadi `IN_PROGRESS`, `resolvedAt` dikosongkan, event `REOPENED`, tambahkan pesan. Agen yang sama tetap menjadi assignee.
   - Customer **tidak boleh** menentukan `ticketId`. Server yang memutuskan.
3. **Pesan otomatis sistem** ("Terima kasih, pesan Anda sudah kami terima. Agen kami akan membalas secepatnya.", `senderType = SYSTEM`) dikirim ke customer **hanya saat tiket baru dibuat atau dibuka kembali dan tidak ada agen online**. Tiket tetap terbentuk dan tersimpan.
4. **Claim**: agen mengambil tiket `OPEN` yang belum punya assignee -> `IN_PROGRESS`, `assignedAgentId` = agen itu, event `ASSIGNED`. **Harus atomik** di database (first-claim-wins), contoh: `updateMany({ where: { id, status: 'OPEN', assignedAgentId: null }, data: {...} })`. Jika `count === 0` -> respons `409 TICKET_ALREADY_CLAIMED`.
5. **Release**: agen yang memegang tiket (atau admin) melepas tiket `IN_PROGRESS` -> kembali `OPEN`, `assignedAgentId = null`, event `RELEASED`.
6. **Assign ulang**: hanya admin, ke user aktif dengan role `AGENT` (atau `ADMIN`). Status menjadi `IN_PROGRESS`, event `ASSIGNED`. Agen baru diberi notifikasi.
7. **Ubah status** (oleh assignee atau admin): `IN_PROGRESS -> RESOLVED` (isi `resolvedAt`), `RESOLVED -> IN_PROGRESS`, `RESOLVED -> CLOSED` (isi `closedAt`). Tiket `CLOSED` final, tidak bisa diubah. Setiap perubahan mencatat event `STATUS_CHANGED` dengan `oldValue` dan `newValue`.
8. **Ubah prioritas**: assignee atau admin, selama tiket belum `CLOSED`. Event `PRIORITY_CHANGED`.
9. **Auto-close**: job berjalan tiap 1 menit. Tiket `RESOLVED` dengan `resolvedAt` lebih lama dari `AUTO_CLOSE_HOURS` (env, default 24) -> `CLOSED`, event `STATUS_CHANGED`. Karena customer yang chat lagi membuka kembali tiket (aturan 2), tiket yang tidak dibalas customer saja yang tertutup.
10. **Hak membalas**: hanya assignee tiket atau admin. Agen lain bisa melihat (read-only) dan mendapat 403 jika mencoba membalas. Tiket `OPEN` tanpa assignee: agen harus claim dulu. Tiket `CLOSED` tidak bisa dibalas.
11. **Agen online** = ada minimal satu socket staff (agent/admin) yang terhubung.

## 9. REST API

Prefix `/api`. Format sukses: `{ "data": ... }`. Format error: `{ "error": { "code": "STRING", "message": "teks", "details": optional } }`. Status HTTP: 400 validasi, 401 belum login, 403 tidak berhak, 404 tidak ada, 409 konflik, 429 rate limit.

Pesan error dan format respons konsisten lewat satu error handler terpusat dan helper `httpError(status, code, message)`.

### Auth (staff)
| Method | Path | Keterangan |
|---|---|---|
| POST | `/auth/login` | body `{email, password}` -> `{accessToken, refreshToken, user}`. Tolak user nonaktif. |
| POST | `/auth/refresh` | body `{refreshToken}` -> token baru (rotasi: token lama dicabut). |
| POST | `/auth/logout` | body `{refreshToken}` -> cabut token. |
| GET | `/auth/me` | profil user saat ini. |
| POST | `/devices` | `{token, platform}` -> simpan/upsert token FCM untuk user. |
| DELETE | `/devices` | `{token}` -> hapus (saat logout). |

Access token berlaku 15 menit, refresh token 7 hari. Simpan hash refresh token, bukan nilai aslinya.

### Tiket (staff; semua butuh login)
| Method | Path | Role | Keterangan |
|---|---|---|---|
| GET | `/tickets` | agent, admin | Query: `status`, `assigned` (`me` / `none` / userId), `q` (cari di subject, nama customer, isi pesan terakhir), `page`, `limit`. Urut `lastMessageAt` desc. Setiap item memuat: id, number, subject, status, priority, customer {id, name, email}, assignedAgent {id, name} atau null, lastMessage {body, senderType, createdAt}, createdAt, updatedAt. Sertakan `counts` per status dalam respons (untuk badge di tab filter). |
| GET | `/tickets/:id` | agent, admin | Detail + `events` (audit trail, urut naik). |
| GET | `/tickets/:id/messages?after=<id>&limit=<n>` | agent, admin | Pesan naik berdasarkan id. Tanpa `after` = riwayat awal (default 100 terbaru). Dipakai juga untuk sinkronisasi. |
| POST | `/tickets/:id/claim` | agent, admin | Aturan 4. |
| POST | `/tickets/:id/release` | assignee, admin | Aturan 5. |
| POST | `/tickets/:id/assign` | admin | body `{agentId}`. Aturan 6. |
| PATCH | `/tickets/:id` | assignee, admin | body `{status?, priority?}`. Aturan 7 dan 8. |

Pengiriman pesan staff **tidak lewat REST**, melainkan Socket.IO (bagian 10). Setiap aksi tiket yang mengubah data harus memancarkan event real-time `ticket:updated` (bagian 10).

### User (admin saja)
| Method | Path | Keterangan |
|---|---|---|
| GET | `/users` | Daftar user. |
| POST | `/users` | `{name, email, password, role}`. Email unik, password minimal 8 karakter. |
| PATCH | `/users/:id` | `{name?, role?, isActive?, password?}`. Nonaktifkan user -> cabut refresh token dan putuskan socket-nya. Admin tidak boleh menonaktifkan dirinya sendiri. |

### Widget (customer, tanpa login)
Header `X-Visitor-Token` dipakai untuk mengenali customer.

| Method | Path | Keterangan |
|---|---|---|
| POST | `/widget/session` | body `{name, email?, visitorToken?}`. Buat customer baru (generate `visitorToken` UUID) atau perbarui nama/email customer yang ada. Respons: `{visitorToken, customer}`. |
| GET | `/widget/conversation?after=<id>` | Header `X-Visitor-Token`. Respons: `{customer, ticket (terbaru atau null), messages}`. Untuk memulihkan percakapan saat reload dan sinkronisasi. Memperbarui `lastSeenAt`. |

Rate limit endpoint widget dengan `express-rate-limit`.

## 10. Real-time (Socket.IO)

### Koneksi dan autentikasi
- Transport: `['websocket', 'polling']` (polling sebagai fallback otomatis).
- Handshake `auth`: staff `{ token: <accessToken> }`, customer `{ visitorToken }`. Verifikasi di middleware Socket.IO. Tolak jika tidak valid.
- Room: staff otomatis masuk room `agents`. Customer masuk room `customer:<customerId>`.
- Server memelihara peta presence `userId -> jumlah socket`. Saat status "ada agen online" berubah, server memancarkan `presence:update` `{ agentsOnline: boolean }` ke semua socket customer. Customer yang baru terhubung juga langsung menerima status terkini.
- CORS socket dan endpoint `/widget/*` mengizinkan semua origin (widget bisa dipasang di website mana pun). Endpoint staff mengikuti `CORS_ORIGINS`.

### Event dari klien ke server
| Event | Payload | Respons (Socket.IO ack callback) |
|---|---|---|
| `message:send` | Customer: `{ body, clientMessageId }`. Staff: `{ ticketId, body, clientMessageId }`. | `{ ok: true, message, ticket? }` atau `{ ok: false, error: { code, message } }` |
| `sync:request` | Customer: `{ lastMessageId }`. Staff: `{ tickets: [{ ticketId, lastMessageId }] }` (hanya tiket yang sedang dibuka/di-cache). | `{ ok: true, messages: [...] }` (pesan dengan `id > lastMessageId`, urut naik) |

Aturan `message:send`:
1. Validasi dengan Zod (body 1-2000 karakter, `clientMessageId` UUID).
2. Customer: terapkan aturan bisnis nomor 2 dan 3. Staff: cek hak membalas (nomor 10).
3. **Idempotensi**: jika `(ticketId, clientMessageId)` sudah ada, **jangan buat pesan baru**; kembalikan pesan yang sudah ada dengan `ok: true`.
4. Simpan pesan, perbarui `tickets.lastMessageAt` dan `updatedAt`, lalu kembalikan ack.
5. Siarkan `message:new` ke pihak lain (exclude socket pengirim): ke room `agents` dan `customer:<customerId>`.
6. Jika tiket baru/dibuka kembali, siarkan juga `ticket:created` / `ticket:updated` ke room `agents`.
7. Rate limit per socket customer (misalnya 20 pesan per menit). Lewat batas -> `ok: false`, `code: RATE_LIMITED`.

### Event dari server ke klien
| Event | Payload | Penerima |
|---|---|---|
| `message:new` | `{ message, ticketId }` | `agents` + customer pemilik tiket |
| `ticket:created` | ringkasan tiket | `agents` |
| `ticket:updated` | ringkasan tiket terbaru (status, assignee, priority) | `agents` + customer pemilik tiket |
| `presence:update` | `{ agentsOnline }` | semua socket customer |

### Protokol ketahanan koneksi (syarat wajib "selalu terkoneksi")
Semua klien (widget, web, mobile) mengimplementasikan hal yang sama:
1. **Client message id**: setiap pesan keluar diberi UUID di klien. Pesan langsung tampil dengan status `pending` dan masuk **antrean lokal** (widget: `localStorage`; mobile: tabel `sqflite`; web: memori cukup).
2. Kirim dengan `emit('message:send', payload, ack)` dengan timeout ack (misalnya 10 detik). Ack sukses -> status `sent`, hapus dari antrean. Timeout/gagal -> tetap `pending`.
3. **Auto-reconnect** (bawaan Socket.IO, dengan backoff). Selama putus, pengguna tetap bisa mengetik; pesan masuk antrean.
4. Setiap kali `connect` (termasuk reconnect): (a) emit `sync:request` dengan id pesan terakhir yang dimiliki, gabungkan hasilnya tanpa duplikat (kunci: `message.id`), lalu (b) **kirim ulang seluruh antrean pending secara berurutan**. Duplikat aman karena idempotensi server.
5. Klien web dan mobile juga memuat ulang daftar tiket lewat REST setiap reconnect.
6. **Indikator koneksi** terlihat di semua klien: `Terhubung` / `Menyambungkan ulang...` / `Offline`.
7. Jika access token staff kedaluwarsa saat handshake gagal (`connect_error` bertipe auth), klien melakukan refresh token lalu menyambung ulang.
8. Server restart: semua klien harus tersambung kembali sendiri tanpa tindakan pengguna.

### Push notification (FCM)
- Pemicu: tiket baru dibuat, tiket dibuka kembali, pesan customer masuk, tiket di-assign ke seorang agen.
- Penerima: hanya user staff yang **tidak punya socket aktif** dan punya token di `device_tokens`. Tiket `OPEN`/baru -> semua staff offline. Pesan pada tiket yang sudah di-assign -> assignee jika offline. Assign ulang -> agen baru jika offline.
- Payload data: `{ type, ticketId }`. Tap notifikasi membuka layar chat tiket itu.
- Hapus token yang ditolak FCM (`unregistered`).
- Fitur ini opsional bila `FCM_SERVICE_ACCOUNT_PATH` tidak diisi: backend tetap berjalan dan melewati pengiriman push tanpa error.

## 11. Keamanan

- Password di-hash dengan bcrypt. Tidak pernah dikembalikan di respons.
- `requireRole` memeriksa role di server. Menyembunyikan menu di UI tidak cukup.
- Customer hanya bisa membaca dan menulis tiket miliknya (dicek di server pada setiap request dan event).
- Visitor token tidak ditebak (UUID v4) dan tidak dimasukkan ke URL.
- Helmet untuk header keamanan HTTP. Batas ukuran body JSON (misalnya 10 KB).
- Hindari XSS: teks pesan selalu di-render sebagai teks, bukan HTML (di widget gunakan `textContent`).

## 12. Antarmuka

Semua teks antarmuka berbahasa Indonesia.

### 12.1 Halaman demo (`/demo`)
Landing page sederhana toko fiktif "Toko Contoh": header, judul, beberapa paragraf/kartu produk statis, footer. Berfungsi sebagai website klien yang memasang widget dengan satu tag:
```html
<script src="/widget.js" data-server=""></script>
```
`data-server` opsional (default: origin tempat `widget.js` dimuat). Opsi lain: `data-title`, `data-color`.

### 12.2 Live chat widget
- **Tombol bubble** bulat di kanan bawah (24px dari tepi). Klik -> membuka panel (desktop 360x520, di layar kecil mengisi layar penuh). Semua di dalam **Shadow DOM** supaya CSS tidak bentrok dengan website induk.
- **Header** panel: judul ("Hubungi Kami"), titik status ("Agen online" / "Agen offline"), tombol tutup.
- **Form awal** (hanya jika belum ada `visitorToken`): nama (wajib), email (opsional), tombol "Mulai Chat". Memanggil `POST /widget/session`, menyimpan `visitorToken` di `localStorage`.
- **Layar chat**: daftar pesan (gelembung customer di kanan, agen di kiri dengan nama, sistem sebagai teks tengah berwarna lembut), input teks, tombol kirim (Enter untuk kirim, Shift+Enter baris baru), auto-scroll ke pesan terbaru.
- **Status pesan** milik customer: `pending` (ikon jam), `terkirim` (centang).
- **Banner koneksi** di dalam panel: "Menyambungkan ulang..." / "Anda sedang offline. Pesan akan terkirim saat tersambung."
- **Pemulihan percakapan** saat halaman dimuat ulang: ambil `GET /widget/conversation`, tampilkan riwayat, sambungkan socket.
- Jika tiket terakhir `CLOSED`: tampilkan catatan "Percakapan sebelumnya telah ditutup. Kirim pesan untuk memulai percakapan baru." Pesan berikutnya membuat tiket baru dan tampilan dimulai dari kosong.
- Bundle hanya satu file `widget.js`. Jangan membutuhkan CSS atau aset eksternal.

### 12.3 Web app agen/admin (`/app`)
Satu aplikasi React dengan **layout inbox** (bukan dashboard statistik), mirip Intercom/Zendesk.

- **Login**: email + password. Pesan error jelas.
- **Layout**: sidebar kiri (menu "Tiket", dan "Kelola Agen" hanya untuk admin), bar atas (indikator koneksi, nama user + role, tombol keluar).
- **Halaman Tiket** (split view):
  - **Kolom kiri**: tab filter dengan badge jumlah (`Antrean` = OPEN tanpa assignee, `Tiket Saya` = ditugaskan ke saya, `Semua`, `Resolved`, `Closed`), kolom pencarian, daftar tiket (nomor `HD-0001`, nama customer, cuplikan pesan terakhir, waktu relatif, badge status dan prioritas, nama assignee). Daftar ter-update real-time (tiket baru masuk di atas dengan penanda).
  - **Kolom kanan**: header tiket (nomor, subject, customer, status, prioritas, assignee) dengan **tombol aksi sesuai kondisi dan role**: `Ambil Tiket` (claim), `Lepas`, `Tandai Resolved`, `Buka Kembali`, `Tutup Tiket`, ubah prioritas (dropdown), `Pindahkan ke...` (assign, admin saja). Di bawahnya riwayat chat dan kotak input balasan. Input dinonaktifkan dengan keterangan jelas jika pengguna bukan assignee (dan bukan admin), atau tiket belum diambil, atau sudah closed.
  - **Panel/tab "Aktivitas"**: audit trail tiket dari `ticket_events` (siapa melakukan apa, kapan).
- **Halaman Kelola Agen** (admin): tabel user (nama, email, role, status aktif), tombol tambah, edit (nama, role, reset password), aktifkan/nonaktifkan.
- State koneksi dan pesan `pending` mengikuti protokol ketahanan koneksi.
- Responsif minimal untuk lebar laptop dan tablet.

### 12.4 Mobile app (Flutter, untuk agen)
Material 3. Layar:
1. **Login**: email, password, dan pengaturan **"Server URL"** (tombol gigi atau kolom yang dapat diubah) supaya alamat backend bisa diganti tanpa build ulang. Nilai bawaan dapat diatur lewat konfigurasi build (default `http://10.0.2.2:3000` untuk emulator). Simpan di penyimpanan lokal.
2. **Daftar Tiket**: tab `Antrean` / `Tiket Saya` / `Semua`, pull-to-refresh, item berisi nomor, nama customer, cuplikan, waktu, badge status/prioritas. Update real-time. Banner status koneksi di atas.
3. **Detail/Chat Tiket**: header (nomor, customer, status), daftar pesan, kotak input, dan menu aksi: Ambil, Lepas, Tandai Resolved, Buka Kembali, ubah prioritas. Input dinonaktifkan sesuai aturan hak membalas. Pesan `pending` ditandai jam.
4. **Pengaturan/Profil**: nama dan role, Server URL, status koneksi, tombol Keluar.
- Fitur admin (assign, kelola agen) **tidak** ada di mobile.
- **Offline**: cache pesan dan tiket terakhir di `sqflite` supaya layar tetap terisi saat offline. Antrean pending tersimpan di `sqflite` dan dikirim ulang saat tersambung.
- Token disimpan di `flutter_secure_storage`.
- Push notification (tahap akhir): minta izin, ambil token FCM, `POST /devices`, buka layar chat saat notifikasi diketuk.
- Hasil akhir: **APK rilis** (`flutter build apk --release`) disertakan di repo (folder `release/`) atau tautan unduh di README.

## 13. Seed data (`npm run seed`)

| Akun | Email | Password | Role |
|---|---|---|---|
| Admin | `admin@helpdesk.test` | `Admin123!` | ADMIN |
| Agen 1 | `agent1@helpdesk.test` | `Agent123!` | AGENT |
| Agen 2 | `agent2@helpdesk.test` | `Agent123!` | AGENT |

Tambahkan beberapa customer dan sekitar 6 tiket contoh yang mencakup semua status (OPEN, IN_PROGRESS, RESOLVED, CLOSED) dengan pesan dan event yang wajar. Seed harus idempoten (aman dijalankan ulang).

## 14. Konfigurasi (`.env.example`)

```
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/helpdesk
JWT_ACCESS_SECRET=ganti-ini
JWT_REFRESH_SECRET=ganti-ini
CORS_ORIGINS=http://localhost:5173
AUTO_CLOSE_HOURS=24
FCM_SERVICE_ACCOUNT_PATH=
```

Skrip npm di `backend`: `dev`, `start`, `migrate` (prisma migrate deploy), `migrate:dev`, `seed`. Skrip tambahan di root atau folder masing-masing: `build:widget`, `build:web`.

## 15. Kriteria penerimaan (uji manual wajib lulus)

1. **Alur dasar**: dari `/demo`, customer mengisi nama dan mengirim pesan -> tiket `OPEN` muncul di web dan mobile secara real-time tanpa refresh.
2. **Claim**: agen mengambil tiket -> status `IN_PROGRESS`, tampil atas nama agen itu. Agen lain melihat tiket read-only dan tidak bisa membalas.
3. **Claim bersamaan**: dua agen menekan claim hampir bersamaan -> hanya satu berhasil, yang lain mendapat pesan "tiket sudah diambil agen lain".
4. **Chat dua arah** widget <-> web <-> mobile tanpa duplikat.
5. **Offline klien**: matikan Wi-Fi HP agen, kirim pesan dari widget, nyalakan lagi -> pesan muncul sekali. Lakukan sebaliknya (agen mengirim saat offline).
6. **Server restart**: matikan lalu hidupkan backend -> semua klien tersambung sendiri dan pesan yang tertunda terkirim tanpa duplikat.
7. **Tidak ada agen online**: customer mengirim pesan -> tiket tetap terbentuk `OPEN` dan customer menerima pesan otomatis sistem.
8. **Resolved dan buka kembali**: tandai resolved, customer chat lagi -> tiket kembali `IN_PROGRESS` dengan agen yang sama.
9. **Closed dan tiket baru**: tutup tiket, customer chat lagi -> tiket baru terbentuk.
10. **Auto-close**: dengan `AUTO_CLOSE_HOURS` kecil (misalnya 0.01), tiket resolved menjadi closed otomatis.
11. **Role**: agen tidak bisa mengakses halaman/endpoint admin (UI dan API menolak). Admin dapat assign ulang tiket dan membuat/menonaktifkan agen. Agen nonaktif tidak bisa login.
12. **Reload widget**: muat ulang halaman demo -> riwayat percakapan pulih.
13. **Push notification** (jika dikerjakan): HP agen yang aplikasinya tertutup menerima notifikasi tiket baru.

## 16. Urutan pengerjaan (kerjakan berurutan, setiap fase harus bisa dijalankan)

1. **Fase 1 - Backend dasar**: struktur proyek, Prisma schema + migration, seed, auth + refresh token, CRUD user (admin), error handler, validasi.
2. **Fase 2 - Tiket dan chat**: service tiket (aturan bisnis), REST tiket, Socket.IO (auth, `message:send`, `sync:request`, presence, broadcast), `/widget/*`, auto-close job. Uji dengan skrip atau dua klien sederhana.
3. **Fase 3 - Widget + demo**: widget dengan protokol ketahanan koneksi, halaman `/demo`, serve `/widget.js`.
4. **Fase 4 - Web app**: login, inbox, chat, aksi tiket, kelola agen, indikator koneksi. Serve di `/app`.
5. **Fase 5 - Mobile**: layar-layar di bagian 12.4, cache offline, build APK.
6. **Fase 6 - Push notification**: FCM di backend dan mobile.
7. **Fase 7 - Penutup**: README, ERD ke `docs/`, jalankan seluruh checklist bagian 15, rapikan kode.

Setelah setiap fase: pastikan aplikasi berjalan, lalu buat **commit Git** dengan pesan jelas (format `feat: ...`, `fix: ...`, `chore: ...`).

## 17. README (wajib)

Isi minimal: deskripsi singkat, diagram arsitektur, tech stack, prasyarat (Node, PostgreSQL, Flutter), langkah menjalankan lokal (`npm install`, isi `.env`, `npm run migrate`, `npm run seed`, `npm run dev`), cara membuka `/demo` dan `/app`, akun demo, cara membangun widget dan web, cara menjalankan mobile app dan **cara mengubah Server URL di APK**, lokasi APK, ringkasan keputusan desain (schema, aturan tiket, strategi koneksi), batasan yang diketahui, dan (jika ada) alamat server online.

## 18. Di luar kewenangan agent

Jangan mengubah keputusan di bagian 2 dan 3, jangan menambah Docker, TypeScript, atau fitur yang tidak ada di dokumen ini. Jika sebuah fitur terasa kurang, tuliskan di README sebagai "pengembangan lanjutan", bukan diimplementasikan.
