# ERD - Database Helpdesk

Database: PostgreSQL (dikelola dengan Prisma). Diagram di bawah menggambarkan 7 tabel utama.

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "memiliki"
    users ||--o{ device_tokens : "memiliki"
    users |o--o{ tickets : "ditugaskan (assignedAgentId)"
    users |o--o{ messages : "pengirim agen (senderUserId)"
    users |o--o{ ticket_events : "pelaku (actorUserId)"
    customers ||--o{ tickets : "membuka"
    tickets ||--o{ messages : "berisi"
    tickets ||--o{ ticket_events : "tercatat"

    users {
        int id PK
        string name
        string email UK
        string passwordHash
        enum role "AGENT, ADMIN"
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    refresh_tokens {
        int id PK
        int userId FK
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt "nullable"
        datetime createdAt
    }

    customers {
        int id PK
        string visitorToken UK
        string name
        string email "nullable"
        datetime createdAt
        datetime lastSeenAt
    }

    tickets {
        int id PK
        int customerId FK
        int assignedAgentId FK "nullable"
        string subject
        enum status "OPEN, IN_PROGRESS, RESOLVED, CLOSED"
        enum priority "LOW, MEDIUM, HIGH"
        datetime createdAt
        datetime updatedAt
        datetime lastMessageAt
        datetime resolvedAt "nullable"
        datetime closedAt "nullable"
    }

    messages {
        int id PK
        int ticketId FK
        enum senderType "CUSTOMER, AGENT, SYSTEM"
        int senderUserId FK "nullable"
        string body
        string clientMessageId "nullable"
        datetime createdAt
    }

    ticket_events {
        int id PK
        int ticketId FK
        int actorUserId FK "nullable"
        enum type "CREATED, ASSIGNED, RELEASED, STATUS_CHANGED, PRIORITY_CHANGED, REOPENED"
        string oldValue "nullable"
        string newValue "nullable"
        datetime createdAt
    }

    device_tokens {
        int id PK
        int userId FK
        string token UK
        string platform
        datetime createdAt
        datetime updatedAt
    }
```

## Catatan desain

- **Nomor tiket** (`HD-0001`) tidak disimpan. Nomor ditampilkan dari `tickets.id` dengan padding 4 digit.
- **Idempotensi pesan:** pasangan `(ticketId, clientMessageId)` bersifat unik, sehingga pengiriman ulang pesan yang sama dari klien tidak membuat baris ganda. Pesan sistem memakai `clientMessageId` kosong (NULL), yang diizinkan berulang oleh PostgreSQL.
- **Assignee** bersifat opsional: tiket berstatus `OPEN` belum memiliki `assignedAgentId`.
- **Audit trail:** setiap perubahan penting tiket (pembuatan, assign, release, status, prioritas, buka kembali) dicatat di `ticket_events` beserta nilai lama dan baru.
- **Index utama:** `tickets(status, assignedAgentId)`, `tickets(customerId, createdAt)`, `tickets(lastMessageAt)`, `messages(ticketId, id)`, `ticket_events(ticketId, createdAt)`.
- **Hapus berantai (cascade):** `refresh_tokens` dan `device_tokens` ikut terhapus bersama user; `messages` dan `ticket_events` ikut terhapus bersama tiketnya.
