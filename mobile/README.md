# Helpdesk Agent – Mobile App (Flutter)

Aplikasi mobile untuk agen dan admin Helpdesk berbasis Flutter (Material 3), Provider, Dio, Socket.IO Client, Flutter Secure Storage, dan SQLite (sqflite).

---

## Fitur Utama

- **Autentikasi Aman**: Login staf/admin, token JWT disimpan di Android Keystore via `flutter_secure_storage`, auto-refresh token (401 interceptor).
- **Dukungan Server URL Dinamis**: Server URL dapat diubah dari layar Login maupun Pengaturan tanpa build ulang.
- **Daftar Tiket Real-time & Tab Filter**:
  - Tab **Antrean**: Tiket berstatus `OPEN` yang belum diambil agen.
  - Tab **Tiket Saya**: Tiket yang ditugaskan ke agen yang sedang login.
  - Tab **Semua**: Seluruh tiket.
  - Badge jumlah tiket realtime, pull-to-refresh, dan banner status koneksi.
- **Chat Real-time & Ketahanan Koneksi**:
  - Socket.IO dengan transport WebSocket & polling + reconnect backoff.
  - Real-time updates: `ticket:created`, `ticket:updated`, `message:new`.
  - Offline-first sending: Pesan keluar memiliki UUID `clientMessageId`, langsung tampil sebagai pending (ikon jam), disimpan di tabel SQLite `pending_messages`.
  - Ack timeout 10 detik. Jika offline atau timeout, pesan tetap pending dan diulang otomatis tiap 7 detik saat terhubung (dengan mutex serial agar tidak paralel).
  - Penanganan error validasi / hak akses langsung ditandai merah (*Gagal terkirim*) dengan opsi hapus.
  - Deteksi resume foreground (`WidgetsBindingObserver`): otomatis menyambung ulang socket dan sinkronisasi pesan tiket aktif.
- **Aksi Tiket**:
  - Ambil Tiket (`POST /tickets/:id/claim`), Lepas Tiket (`POST /tickets/:id/release`).
  - Tandai Resolved, Buka Kembali, Ubah Prioritas (Rendah/Sedang/Tinggi).
  - Validasi izin aksi dan penanganan konflik `409 Conflict` (*"Tiket sudah diambil agen lain"*).
- **Cache Offline SQLite**:
  - Tiket dan riwayat pesan tersimpan di database lokal SQLite (`helpdesk.db`).
  - Saat offline, data tetap dapat dilihat dan banner "Offline" ditampilkan.
  - Cache otomatis dibersihkan saat logout atau saat Server URL diganti.

---

## Prasyarat Lingkungan

- **Flutter SDK**: >= 3.29.0 (Dart SDK >= 3.7.0)
- **Android SDK**: API level 21 minimum (Android 5.0 Lollipop atau lebih baru)
- **Node.js Backend**: Backend Helpdesk berjalan di port 3000

---

## Konfigurasi Server URL

### 1. Emulator Android
Emulator Android menggunakan alias IP khusus untuk mengakses `localhost` mesin host laptop/PC:
```
http://10.0.2.2:3000
```
Ini adalah nilai bawaan (default) aplikasi.

### 2. Perangkat Fisik (HP Asli)
Jika menjalankan di HP fisik yang terhubung ke jaringan Wi-Fi yang sama dengan laptop:
1. Temukan alamat IP lokal laptop Anda di Command Prompt / PowerShell:
   ```cmd
   ipconfig
   ```
   Cari baris `IPv4 Address`, contoh: `192.168.1.50`.
2. Gunakan Server URL:
   ```
   http://192.168.1.50:3000
   ```
3. **Catatan Firewall Windows**:
   Pastikan Windows Defender Firewall mengizinkan koneksi masuk pada port 3000 Node.js:
   - Buka *Windows Defender Firewall with Advanced Security* -> *Inbound Rules*.
   - Tambahkan *New Rule* -> *Port* -> *TCP* -> Port `3000` -> *Allow the connection*.
   - Atau pastikan prompt firewall Windows saat menjalankan `npm run dev` di backend telah dicentang untuk *Private networks*.

---

## Cara Menjalankan

### 1. Di Android Emulator
1. Pastikan backend Helpdesk sudah berjalan:
   ```bash
   cd backend
   npm run dev
   ```
2. Pastikan emulator Android sedang aktif (`flutter devices`).
3. Jalankan aplikasi:
   ```bash
   cd mobile
   flutter run
   ```
4. Di layar login, gunakan Server URL bawaan `http://10.0.2.2:3000`.

### 2. Di HP Android Asli (Debug Mode)
1. Aktifkan **Developer Options** dan **USB Debugging** di HP Android Anda.
2. Sambungkan HP ke laptop via kabel USB (atau Wi-Fi pairing).
3. Jalankan aplikasi:
   ```bash
   cd mobile
   flutter run -d <device_id>
   ```
4. Di layar login, ubah Server URL ke IP laptop Anda (misal `http://192.168.1.50:3000`).

---

## Akun Uji Coba Bawaan

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin123` |
| Agen 1 | `agent1@example.com` | `agent123` |
| Agen 2 | `agent2@example.com` | `agent123` |

---

## Cara Build Ulang APK

Untuk membangun file instalasi APK rilis:

```bash
cd mobile
flutter pub get
flutter build apk --release
```

Hasil build APK akan berada di:
```
mobile/build/app/outputs/flutter-apk/app-release.apk
```

Untuk kemudahan instalasi, salinan rilis siap pakai juga disediakan di root repositori:
```
release/helpdesk-agent.apk
```
