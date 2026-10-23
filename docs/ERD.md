# Entity Relationship Diagram (ERD) — Helpdesk System

Dokumen ini memuat Entity Relationship Diagram (ERD) yang diturunkan **langsung** dari skema Prisma (`backend/prisma/schema.prisma`) tanpa modifikasi atau penambahan kolom fiktif.

---

## 1. Diagram ERD (Mermaid)

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "has many (1:N)"
    users ||--o{ tickets : "assigned to (1:N, optional)"
    users ||--o{ messages : "sends (1:N, optional)"
    users ||--o{ ticket_events : "triggers (1:N, optional)"
    users ||--o{ device_tokens : "registers (1:N)"
    customers ||--o{ tickets : "opens (1:N)"
    tickets ||--|{ messages : "contains (1:N, cascade delete)"
    tickets ||--|{ ticket_events : "records (1:N, cascade delete)"

    users {
        int id PK "autoincrement"
        string name
        string email UK "unique"
        string passwordHash
        Role role "enum: AGENT, ADMIN"
        boolean isActive "default: true"
        timestamptz createdAt "default: now()"
        timestamptz updatedAt
    }

    refresh_tokens {
        int id PK "autoincrement"
        int userId FK "references users(id) on delete cascade"
        string tokenHash UK "unique"
        timestamptz expiresAt
        timestamptz revokedAt "nullable"
        timestamptz createdAt "default: now()"
    }

    customers {
        int id PK "autoincrement"
        string visitorToken UK "unique (UUID v4)"
        string name
        string email "nullable"
        timestamptz createdAt "default: now()"
        timestamptz lastSeenAt "default: now()"
    }

    tickets {
        int id PK "autoincrement"
        int customerId FK "references customers(id)"
        int assignedAgentId FK "references users(id), nullable"
        string subject
        TicketStatus status "enum: OPEN, IN_PROGRESS, RESOLVED, CLOSED, default: OPEN"
        TicketPriority priority "enum: LOW, MEDIUM, HIGH, default: MEDIUM"
        timestamptz createdAt "default: now()"
        timestamptz updatedAt
        timestamptz lastMessageAt "default: now()"
        timestamptz resolvedAt "nullable"
        timestamptz closedAt "nullable"
    }

    messages {
        int id PK "autoincrement"
        int ticketId FK "references tickets(id) on delete cascade"
        SenderType senderType "enum: CUSTOMER, AGENT, SYSTEM"
        int senderUserId FK "references users(id), nullable"
        string body
        string clientMessageId "nullable (UUID v4 dari klien)"
        timestamptz createdAt "default: now()"
    }

    ticket_events {
        int id PK "autoincrement"
        int ticketId FK "references tickets(id) on delete cascade"
        int actorUserId FK "references users(id), nullable"
        TicketEventType type "enum: CREATED, ASSIGNED, RELEASED, STATUS_CHANGED, PRIORITY_CHANGED, REOPENED"
        string oldValue "nullable"
        string newValue "nullable"
        timestamptz createdAt "default: now()"
    }

    device_tokens {
        int id PK "autoincrement"
        int userId FK "references users(id) on delete cascade"
        string token UK "unique (FCM device registration token)"
        string platform "android / ios / web"
        timestamptz createdAt "default: now()"
        timestamptz updatedAt
    }
```

---

## 2. Keterangan Enum

| Enum | Nilai yang Diizinkan | Deskripsi Singkat |
|---|---|---|
| `Role` | `AGENT`, `ADMIN` | Otorisasi hak akses internal (Admin mengelola user dan assign tiket). |
| `TicketStatus` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` | Siklus hidup tiket layanan pelanggan. |
| `TicketPriority` | `LOW`, `MEDIUM`, `HIGH` | Prioritas penanganan keluhan. Default: `MEDIUM`. |
| `SenderType` | `CUSTOMER`, `AGENT`, `SYSTEM` | Identifikasi asal pengirim pesan dalam thread tiket. |
| `TicketEventType` | `CREATED`, `ASSIGNED`, `RELEASED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `REOPENED` | Jenis riwayat audit trail tiket. |

---

## 3. Indeks & Batasan Unik Kunci (Indexes & Constraints)

1. **Idempotensi Pesan**:
   - `@@unique([ticketId, clientMessageId])` pada tabel `messages`.
   - Menjamin bahwa pesan yang dikirim ulang akibat timeout socket / retry koneksi tidak akan pernah terduplikasi di database.
   - Kolom `clientMessageId` bernilai `NULL` untuk pesan `SYSTEM` (PostgreSQL mengizinkan multiple `NULL` pada unique index).
2. **Performa Filter & Antrean**:
   - `@@index([status, assignedAgentId])` pada tabel `tickets`: Mengoptimalkan filter tab antrean (`OPEN` tanpa agen) dan "Tiket Saya" (`assignedAgentId = currentUserId`).
   - `@@index([customerId, createdAt])` pada tabel `tickets`: Pencarian tiket aktif milik visitor/customer.
   - `@@index([lastMessageAt])` pada tabel `tickets`: Pengurutan inbox secara real-time berdasarkan aktivitas pesan terbaru.
   - `@@index([ticketId, id])` pada tabel `messages`: Query riwayat pesan dan sinkronisasi delta pesan setelah ID tertentu (`after` / sync request).
   - `@@index([ticketId, createdAt])` pada tabel `ticket_events`: Audit trail berurutan kronologis.
