/**
 * seed.js — idempotent seed script
 *
 * Run with: npm run seed
 *
 * Creates:
 *  - 1 admin + 2 agents
 *  - 3 customers
 *  - 6 tickets covering all statuses (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
 *  - Messages and ticket_events per ticket
 *
 * Idempotent: uses upsert on unique keys so it is safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function main() {
  console.log('🌱 Starting seed...');

  // ── Users ─────────────────────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash('Admin123!', BCRYPT_ROUNDS);
  const agentPassword = await bcrypt.hash('Agent123!', BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@helpdesk.test' },
    update: {},
    create: {
      name: 'Admin Utama',
      email: 'admin@helpdesk.test',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  const agent1 = await prisma.user.upsert({
    where: { email: 'agent1@helpdesk.test' },
    update: {},
    create: {
      name: 'Agen Satu',
      email: 'agent1@helpdesk.test',
      passwordHash: agentPassword,
      role: 'AGENT',
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: 'agent2@helpdesk.test' },
    update: {},
    create: {
      name: 'Agen Dua',
      email: 'agent2@helpdesk.test',
      passwordHash: agentPassword,
      role: 'AGENT',
    },
  });

  console.log(`  ✔ Users: admin, agent1, agent2`);

  // ── Customers ─────────────────────────────────────────────────────────────

  const customer1 = await prisma.customer.upsert({
    where: { visitorToken: 'aaaaaaaa-0001-4000-a000-000000000001' },
    update: {},
    create: {
      visitorToken: 'aaaaaaaa-0001-4000-a000-000000000001',
      name: 'Budi Santoso',
      email: 'budi@example.com',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { visitorToken: 'aaaaaaaa-0002-4000-a000-000000000002' },
    update: {},
    create: {
      visitorToken: 'aaaaaaaa-0002-4000-a000-000000000002',
      name: 'Siti Rahayu',
      email: null,
    },
  });

  const customer3 = await prisma.customer.upsert({
    where: { visitorToken: 'aaaaaaaa-0003-4000-a000-000000000003' },
    update: {},
    create: {
      visitorToken: 'aaaaaaaa-0003-4000-a000-000000000003',
      name: 'Agus Prayitno',
      email: 'agus@example.com',
    },
  });

  console.log(`  ✔ Customers: Budi, Siti, Agus`);

  // ── Tickets ───────────────────────────────────────────────────────────────
  // Helper to skip if ticket already seeded (check by subject + customerId)
  async function upsertTicket(data, messages, events) {
    const existing = await prisma.ticket.findFirst({
      where: { customerId: data.customerId, subject: data.subject },
    });
    if (existing) return existing;

    const ticket = await prisma.ticket.create({ data });

    for (const msg of messages) {
      await prisma.message.create({ data: { ...msg, ticketId: ticket.id } });
    }
    for (const evt of events) {
      await prisma.ticketEvent.create({ data: { ...evt, ticketId: ticket.id } });
    }
    return ticket;
  }

  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);

  // Ticket 1 — OPEN (no assignee)
  await upsertTicket(
    {
      customerId: customer1.id,
      assignedAgentId: null,
      subject: 'Pesanan saya belum sampai setelah 5 hari',
      status: 'OPEN',
      priority: 'HIGH',
      createdAt: hoursAgo(3),
      lastMessageAt: hoursAgo(3),
    },
    [
      {
        senderType: 'CUSTOMER',
        senderUserId: null,
        body: 'Pesanan saya belum sampai setelah 5 hari, mohon bantuannya.',
        createdAt: hoursAgo(3),
      },
      {
        senderType: 'SYSTEM',
        senderUserId: null,
        body: 'Terima kasih, pesan Anda sudah kami terima. Agen kami akan membalas secepatnya.',
        createdAt: hoursAgo(3),
      },
    ],
    [{ actorUserId: null, type: 'CREATED', oldValue: null, newValue: 'OPEN', createdAt: hoursAgo(3) }],
  );

  // Ticket 2 — IN_PROGRESS (agent1)
  await upsertTicket(
    {
      customerId: customer1.id,
      assignedAgentId: agent1.id,
      subject: 'Produk yang diterima rusak',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      createdAt: hoursAgo(10),
      lastMessageAt: hoursAgo(1),
    },
    [
      {
        senderType: 'CUSTOMER',
        senderUserId: null,
        body: 'Produk yang diterima rusak, layar retak padahal packing aman.',
        createdAt: hoursAgo(10),
      },
      {
        senderType: 'SYSTEM',
        senderUserId: null,
        body: 'Terima kasih, pesan Anda sudah kami terima. Agen kami akan membalas secepatnya.',
        createdAt: hoursAgo(10),
      },
      {
        senderType: 'AGENT',
        senderUserId: agent1.id,
        body: 'Halo Budi, kami mohon maaf atas ketidaknyamanan ini. Bisakah Anda mengirimkan foto kerusakan?',
        createdAt: hoursAgo(1),
      },
    ],
    [
      { actorUserId: null, type: 'CREATED', oldValue: null, newValue: 'OPEN', createdAt: hoursAgo(10) },
      {
        actorUserId: agent1.id,
        type: 'ASSIGNED',
        oldValue: null,
        newValue: String(agent1.id),
        createdAt: hoursAgo(9),
      },
      {
        actorUserId: agent1.id,
        type: 'STATUS_CHANGED',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
        createdAt: hoursAgo(9),
      },
    ],
  );

  // Ticket 3 — IN_PROGRESS (agent2)
  await upsertTicket(
    {
      customerId: customer2.id,
      assignedAgentId: agent2.id,
      subject: 'Tidak bisa login ke akun saya',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      createdAt: hoursAgo(5),
      lastMessageAt: hoursAgo(2),
    },
    [
      {
        senderType: 'CUSTOMER',
        senderUserId: null,
        body: 'Tidak bisa login ke akun saya, lupa password dan email reset tidak masuk.',
        createdAt: hoursAgo(5),
      },
      {
        senderType: 'AGENT',
        senderUserId: agent2.id,
        body: 'Halo Siti, kami akan bantu reset akun Anda. Mohon konfirmasi nomor telepon yang terdaftar.',
        createdAt: hoursAgo(2),
      },
    ],
    [
      { actorUserId: null, type: 'CREATED', oldValue: null, newValue: 'OPEN', createdAt: hoursAgo(5) },
      {
        actorUserId: agent2.id,
        type: 'ASSIGNED',
        oldValue: null,
        newValue: String(agent2.id),
        createdAt: hoursAgo(4),
      },
      {
        actorUserId: agent2.id,
        type: 'STATUS_CHANGED',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
        createdAt: hoursAgo(4),
      },
    ],
  );

  // Ticket 4 — RESOLVED (agent1)
  const resolvedAt4 = hoursAgo(2);
  await upsertTicket(
    {
      customerId: customer2.id,
      assignedAgentId: agent1.id,
      subject: 'Voucher diskon tidak bisa digunakan',
      status: 'RESOLVED',
      priority: 'LOW',
      createdAt: hoursAgo(48),
      lastMessageAt: hoursAgo(2),
      resolvedAt: resolvedAt4,
    },
    [
      {
        senderType: 'CUSTOMER',
        senderUserId: null,
        body: 'Voucher diskon 20% tidak bisa digunakan saat checkout.',
        createdAt: hoursAgo(48),
      },
      {
        senderType: 'AGENT',
        senderUserId: agent1.id,
        body: 'Halo Siti, voucher tersebut memiliki minimum pembelian Rp 200.000. Apakah total belanja Anda sudah memenuhi syarat?',
        createdAt: hoursAgo(46),
      },
      {
        senderType: 'CUSTOMER',
        senderUserId: null,
        body: 'Oh iya, ternyata kurang sedikit. Sudah berhasil sekarang, terima kasih!',
        createdAt: hoursAgo(3),
      },
      {
        senderType: 'AGENT',
        senderUserId: agent1.id,
        body: 'Senang bisa membantu! Silakan hubungi kami lagi jika ada pertanyaan.',
        createdAt: hoursAgo(2),
      },
    ],
    [
      { actorUserId: null, type: 'CREATED', oldValue: null, newValue: 'OPEN', createdAt: hoursAgo(48) },
      {
        actorUserId: agent1.id,
        type: 'ASSIGNED',
        oldValue: null,
        newValue: String(agent1.id),
        createdAt: hoursAgo(47),
      },
      {
        actorUserId: agent1.id,
        type: 'STATUS_CHANGED',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
        createdAt: hoursAgo(47),
      },
      {
        actorUserId: agent1.id,
        type: 'STATUS_CHANGED',
        oldValue: 'IN_PROGRESS',
        newValue: 'RESOLVED',
        createdAt: resolvedAt4,
      },
    ],
  );

  // Ticket 5 — CLOSED (agent2, admin menutup)
  const resolvedAt5 = hoursAgo(30);
  const closedAt5 = hoursAgo(6);
  await upsertTicket(
    {
      customerId: customer3.id,
      assignedAgentId: agent2.id,
      subject: 'Pertanyaan tentang garansi produk',
      status: 'CLOSED',
      priority: 'LOW',
      createdAt: hoursAgo(72),
      lastMessageAt: hoursAgo(30),
      resolvedAt: resolvedAt5,
      closedAt: closedAt5,
    },
    [
      {
        senderType: 'CUSTOMER',
        senderUserId: null,
        body: 'Berapa lama garansi untuk produk elektronik yang saya beli?',
        createdAt: hoursAgo(72),
      },
      {
        senderType: 'AGENT',
        senderUserId: agent2.id,
        body: 'Halo Agus, produk elektronik kami memiliki garansi resmi 1 tahun dari produsen.',
        createdAt: hoursAgo(70),
      },
      {
        senderType: 'CUSTOMER',
        senderUserId: null,
        body: 'Oke, terima kasih informasinya.',
        createdAt: hoursAgo(30),
      },
    ],
    [
      { actorUserId: null, type: 'CREATED', oldValue: null, newValue: 'OPEN', createdAt: hoursAgo(72) },
      {
        actorUserId: agent2.id,
        type: 'ASSIGNED',
        oldValue: null,
        newValue: String(agent2.id),
        createdAt: hoursAgo(71),
      },
      {
        actorUserId: agent2.id,
        type: 'STATUS_CHANGED',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
        createdAt: hoursAgo(71),
      },
      {
        actorUserId: agent2.id,
        type: 'STATUS_CHANGED',
        oldValue: 'IN_PROGRESS',
        newValue: 'RESOLVED',
        createdAt: resolvedAt5,
      },
      {
        actorUserId: admin.id,
        type: 'STATUS_CHANGED',
        oldValue: 'RESOLVED',
        newValue: 'CLOSED',
        createdAt: closedAt5,
      },
    ],
  );

  // Ticket 6 — OPEN (no assignee, customer3)
  await upsertTicket(
    {
      customerId: customer3.id,
      assignedAgentId: null,
      subject: 'Cara mengubah alamat pengiriman',
      status: 'OPEN',
      priority: 'MEDIUM',
      createdAt: hoursAgo(1),
      lastMessageAt: hoursAgo(1),
    },
    [
      {
        senderType: 'CUSTOMER',
        senderUserId: null,
        body: 'Cara mengubah alamat pengiriman setelah pesanan dikonfirmasi bagaimana ya?',
        createdAt: hoursAgo(1),
      },
      {
        senderType: 'SYSTEM',
        senderUserId: null,
        body: 'Terima kasih, pesan Anda sudah kami terima. Agen kami akan membalas secepatnya.',
        createdAt: hoursAgo(1),
      },
    ],
    [{ actorUserId: null, type: 'CREATED', oldValue: null, newValue: 'OPEN', createdAt: hoursAgo(1) }],
  );

  console.log(`  ✔ Tickets: 2×OPEN, 2×IN_PROGRESS, 1×RESOLVED, 1×CLOSED`);
  console.log('✅ Seed selesai.');
}

main()
  .catch((err) => {
    console.error('❌ Seed gagal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
