# 🎨 Design System & UI/UX Guidelines — Ciheul Helpdesk

Dokumen ini adalah acuan resmi desain dan antarmuka (*design system*) untuk seluruh ekosistem **Ciheul Helpdesk**, meliputi:
1. **Halaman Demo & Widget Live Chat** (`widget/`)
2. **Aplikasi Web Admin / CS** (`web/`)
3. **Aplikasi Mobile Flutter Admin / CS** (`mobile/`)

Semua perombakan tampilan di masa mendatang **wajib merujuk dan konsisten** dengan panduan desain ini.

---

## 1. Filosofi & Karakter Desain
- **Karakter**: *Enterprise Modern, Clean, Minimalist, Precision & High Reliability*.
- **Nuansa Visual**: Kombinasi **Dark Charcoal / Slate (#111111 – #191c21)** yang elegan dengan aksen segar **Emerald Green (#10b981)** serta sentuhan *soft glassmorphism*.
- **Whitespace & Kerapihan**: Layout lega (*clean padding*), tipografi tajam tanpa dekorasi berlebihan, sudut membulat proporsional (*pill & rounded 8px–16px*).

---

## 2. Palet Warna (Color Palette)

### A. Warna Utama (Primary & Dark Shades)
| Token / Nama | Hex Code | Penggunaan |
| :--- | :--- | :--- |
| **Dark Void / Obsidian** | `#111111` | Header navbar, tombol utama, teks judul besar, background gelap pekat |
| **Dark Charcoal** | `#191c21` | Background bubble CS, header popup widget, balon chat pengunjung, card hover |
| **Charcoal Surface** | `#1e2229` | Permukaan panel gelap, card secondary, border halus pada tema gelap |
| **Charcoal Hover** | `#252a32` | State `:hover` tombol gelap dan bubble trigger |

### B. Warna Aksen & Status (Emerald & Functional)
| Token / Nama | Hex Code | Penggunaan |
| :--- | :--- | :--- |
| **Emerald Accent** | `#10b981` | Tombol kirim pesan, indikator status online, checkmark terkirim (✓), link aktif |
| **Emerald Hover** | `#059669` | State `:hover` tombol kirim dan tombol aksen hijau |
| **Emerald Deep (Badge BG)** | `#064e3b` | Background avatar inisial (misal: "CS"), badge online gelap |
| **Emerald Mint (Text)** | `#34d399` | Teks inisial avatar CS, teks badge online |
| **Status Offline / Neutral** | `#94a3b8` | Dot status offline, ikon lampiran, teks waktu / timestamp |
| **Status Danger / Error** | `#ef4444` | Pesan gagal kirim, notifikasi unread badge merah, required asterisk `*` |
| **Accent Blue (Stats/Card)** | `#2f6fd0` | Ikon statistik korporasi, highlight dokumen/link |

### C. Warna Background & Permukaan Terang (Light Surfaces)
| Token / Nama | Hex Code | Penggunaan |
| :--- | :--- | :--- |
| **Pure White** | `#ffffff` | Background panel chat, balon chat agen/CS, input focus |
| **Slate Light 50** | `#f8fafc` | Background input textarea, background input form, card ringan |
| **Slate Light 100** | `#f1f5f9` | Background pill tanggal (*"Hari Ini"*), divider halus, border panel |
| **Slate Border** | `#e2e8f0` | Garis tepi input form, border card |

### D. Warna Tipografi (Text)
| Token / Nama | Hex Code | Penggunaan |
| :--- | :--- | :--- |
| **Text Primary (Dark)** | `#111111` / `#1e293b` | Judul, isi pesan chat, label form utama |
| **Text Secondary / Muted** | `#64748b` / `#94a3b8` | Timestamp jam, placeholder input, footer copyright, label pendukung |
| **Text On Dark** | `#ffffff` | Teks di atas tombol gelap, teks balon chat pengunjung |

---

## 3. Tipografi (Typography)
- **Font Family**: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Tingkat Ketebalan (*Font Weights*)**:
  - `400 (Regular)`: Teks pesan chat, subtitle deskripsi, placeholder.
  - `500 (Medium)`: Badge tanggal, navigasi menu sekunder, label status.
  - `600 (Semi-Bold)`: Label input form, tombol CTA, nama pengguna.
  - `700 (Bold)`: Judul header widget ("Ciheul Support"), heading panel.
  - `800 / 900 (Extra-Bold)`: Heading hero demo ("The Journey To Digital Excellence.").

---

## 4. Komponen & Detail UI

### A. Tombol Melayang CS (Floating Bubble)
- **Bentuk**: Lingkaran sempurna `56px × 56px`.
- **Warna**: Background Dark Charcoal `#191c21` dengan border `2px solid rgba(255, 255, 255, 0.14)`.
- **Shadow**: `0 8px 24px rgba(0, 0, 0, 0.35)`.
- **Ikon**: Outline speech bubble warna putih `26px × 26px` dengan 3 titik horizontal (`...`).
- **Indikator Online**: Lingkaran hijau `#10b981` ukuran `12px × 12px` di pojok kanan atas bubble dengan border putih `2px solid #fff`.
- **Posisi di Web Demo**: `bottom: clamp(26px, 3.4vh + 10px, 46px); right: clamp(24px, 4vw, 56px);` (sejajar dengan bilah kartu statistik di bawah).

### B. Panel Pop-up Widget Live Chat
- **Dimensi**: Lebar `min(330px, 100vw - 32px)`, Tinggi `min(440px, 100vh - 120px)`.
- **Border Radius**: `16px`.
- **Shadow**: `0 16px 40px -4px rgba(15, 23, 42, 0.22), 0 4px 16px -2px rgba(15, 23, 42, 0.08)`.
- **Header**:
  - Background `#191c21`, tinggi ~`52px`.
  - Avatar bulat `34px × 34px` warna `#064e3b` bertuliskan inisial `"CS"` warna `#34d399`, dilengkapi status dot `9px` `#10b981`.
  - Judul: `"Ciheul Support"` (Putih, 14px, Bold) + Pill badge `"Online"` (`rgba(16,185,129,0.18)` + teks `#34d399`).
  - Action buttons di kanan: Ikon Minimize (`—`) dan Close (`✕`) warna `#94a3b8` dengan efek hover `#ffffff`.

### C. Balon Chat (Message Bubbles)
- **Pesan Pengunjung (Customer)**:
  - Rata kanan (*Right-aligned*).
  - Background: Dark Charcoal `#191c21`, teks putih `#ffffff`.
  - Radius: `14px` (dengan sudut kanan-bawah `4px`).
  - Meta: Waktu `10px` `#94a3b8` + icon centang hijau `✓` `#10b981`.
- **Pesan Agen / CS**:
  - Rata kiri (*Left-aligned*), diawali avatar bulat agen `26px` di sisi kiri.
  - Background: Putih `#ffffff`, border `1px solid #edf2f7`, soft shadow `0 1px 3px rgba(0,0,0,0.04)`, teks gelap `#1e293b`.
  - Radius: `14px` (dengan sudut kiri-atas `4px`).
  - Meta: Waktu `10px` `#94a3b8` di bawah balon chat.
- **Pemisah Tanggal**: Pill kecil terpusat warna `#f1f5f9` teks `#64748b` font `10.5px` bertuliskan *"Hari Ini"*.

### D. Input Bar Percakapan
- Background putih `#ffffff` dengan border atas `1px solid #f1f5f9`.
- Tombol lampiran klip kertas (`📎`) di sisi kiri `#94a3b8`.
- Textarea melengkung (*pill radius 18px*), background `#f8fafc`, placeholder `"Tulis pesan Anda..."`.
- Tombol kirim bulat hijau `#10b981` ukuran `32px × 32px` berisi ikon panah putih ke kanan (`→`).
- Footer branding kecil di bawah input: `"Diberdayakan oleh Ciheul Support"`.

### E. Form Pendaftaran Tamu (Pre-Chat)
- Input field rapi dengan ikon dalam kotak (Ikon User 👤 untuk nama, Ikon Surat ✉️ untuk email).
- Border input `1.5px solid #e2e8f0`, focus ring hijau `3px rgba(16,185,129,0.12)`.
- Tombol submit gelap: `#191c21` dengan teks *"Mulai Percakapan →"*, font 13.5px, border-radius `9px`.
- Catatan privasi: Ikon gembok hijau `🔒` + *"Privasi & data Anda terenkripsi aman"*.

---

## 5. Panduan Rombak Desain untuk Web App Admin/CS (`web/`)

Saat merombak aplikasi React SPA di `web/`:
1. **Sidebar / Navigasi Utama**:
   - Gunakan latar gelap elegan `#191c21` / `#111111` dengan logo Ciheul Technologies di atas.
   - Menu aktif menggunakan pill background `rgba(255,255,255,0.1)` atau aksen hijau `#10b981`.
2. **Daftar Tiket (Inbox / Queue)**:
   - Card tiket dengan latar putih bersih `#ffffff`, border halus `#e2e8f0`, hover `#f8fafc`.
   - Badge status tiket:
     - `OPEN`: Badge hijau muda (`#dcfce7` teks `#15803d`).
     - `ASSIGNED` / `PENDING`: Badge kuning/amber (`#fef3c7` teks `#b45309`).
     - `CLOSED`: Badge abu-abu netral (`#f1f5f9` teks `#64748b`).
3. **Ruang Percakapan CS (Chat View)**:
   - Gunakan skema balon chat yang seragam dengan widget:
     - Balon pesan CS: Latar Dark Charcoal `#191c21` dengan teks putih.
     - Balon pesan customer: Latar putih `#ffffff` dengan border `#e2e8f0` dan teks `#1e293b`.
   - Input bar dengan tombol kirim bulat hijau `#10b981`.

---

## 6. Panduan Rombak Desain untuk Mobile App Flutter (`mobile/`)

Saat merombak aplikasi Flutter di `mobile/`:
1. **Theme Data (`ThemeData` / `ColorScheme`)**:
   ```dart
   static const Color primaryDark = Color(0xFF191C21);
   static const Color primaryObsidian = Color(0xFF111111);
   static const Color accentGreen = Color(0xFF10B981);
   static const Color surfaceLight = Color(0xFFFFFFFF);
   static const Color backgroundLight = Color(0xFFF8FAFC);
   static const Color borderSubtle = Color(0xFFE2E8F0);
   static const Color textMuted = Color(0xFF94A3B8);
   ```
2. **AppBar**:
   - AppBar berwarna `primaryDark` (`#191C21`) dengan judul putih, badge status online hijau, dan action icon ramping.
3. **Tampilan Chat**:
   - Customer bubble di sisi kiri: Putih `#FFFFFF` dengan shadow lembut.
   - Staff/CS bubble di sisi kanan: Dark Charcoal `#191C21` dengan teks putih.
   - Action button kirim: Lingkaran hijau `accentGreen` (`#10B981`) dengan icon panah `Icons.arrow_forward`.
4. **Bottom Navigation Bar**:
   - Latar belakang gelap atau putih bersih dengan item aktif berwarna `#10B981`.

---

> **Catatan Konsistensi**: Setiap komponen baru yang dibuat di masa mendatang harus menggunakan nilai token hex dan aturan radius di atas agar seluruh aplikasi terlihat sebagai satu kesatuan produk yang terpadu dan profesional.
