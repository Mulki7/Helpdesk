/**
 * services/chat.service.js
 * Implements business rules for real-time messaging by customers and staff
 * according to PRD section 8 and section 10.
 *
 * Concurrency handling:
 * - Uses PostgreSQL row-level locking (`SELECT FOR UPDATE` on customers row within a transaction)
 *   to ensure concurrent messages from the same customer are strictly serialized, preventing
 *   race conditions where multiple OPEN tickets could otherwise be created.
 * - Checks for duplicate clientMessageId belonging to this customer FIRST, before any ticket decisions.
 * - Catches Prisma P2002 unique constraint violations on (ticketId, clientMessageId) outside the
 *   transaction and fetches the existing message gracefully to ensure duplicate sends always succeed with ok: true.
 */

import { prisma } from '../config/prisma.js';
import { formatTicketNumber } from '../utils/ticketNumber.js';
import { hasStaffOnline } from './presence.service.js';

function serializeTicket(ticket) {
  if (!ticket) return null;
  return {
    ...ticket,
    number: formatTicketNumber(ticket.id),
  };
}

/**
 * Handle a message sent by a customer.
 * - Customer cannot choose ticketId; server determines from latest ticket.
 * - Concurrency safe: locks customer row with SELECT FOR UPDATE in a transaction.
 * - DUPLICATE CHECK IS FIRST: if message with same clientMessageId exists for this customer,
 *   returns immediately without creating or reopening any ticket or recording events.
 * - If no ticket or CLOSED -> create new ticket (OPEN, subject = first 50 chars).
 * - If RESOLVED -> reopen to IN_PROGRESS.
 * - Send SYSTEM message only if newly created or reopened AND no staff online.
 * @param {object} params { customer, body, clientMessageId }
 */
export async function sendCustomerMessage({ customer, body, clientMessageId }) {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Acquire row lock on customer to serialize concurrent incoming requests from the same customer
      await tx.$executeRaw`SELECT 1 FROM "customers" WHERE id = ${customer.id} FOR UPDATE`;

      // 2. CHECK DUPLICATE FIRST (before any ticket creation or reopening decisions)
      if (clientMessageId) {
        const existing = await tx.message.findFirst({
          where: {
            clientMessageId,
            ticket: { customerId: customer.id },
          },
          include: { ticket: true },
        });

        if (existing) {
          return {
            ok: true,
            message: existing,
            ticket: serializeTicket(existing.ticket),
            isDuplicate: true,
          };
        }
      }

      // 3. Find customer's latest ticket under the lock
      const latestTicket = await tx.ticket.findFirst({
        where: { customerId: customer.id },
        orderBy: { id: 'desc' },
      });

      let ticket = null;
      let isNewTicket = false;
      let isReopened = false;

      if (!latestTicket || latestTicket.status === 'CLOSED') {
        // Create new ticket
        const subject = body.slice(0, 50);
        ticket = await tx.ticket.create({
          data: {
            customerId: customer.id,
            subject,
            status: 'OPEN',
            priority: 'MEDIUM',
            lastMessageAt: new Date(),
          },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorUserId: null,
            type: 'CREATED',
          },
        });

        isNewTicket = true;
      } else if (latestTicket.status === 'RESOLVED') {
        // Reopen ticket
        ticket = await tx.ticket.update({
          where: { id: latestTicket.id },
          data: {
            status: 'IN_PROGRESS',
            resolvedAt: null,
            lastMessageAt: new Date(),
          },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorUserId: null,
            type: 'REOPENED',
            oldValue: 'RESOLVED',
            newValue: 'IN_PROGRESS',
          },
        });

        isReopened = true;
      } else {
        // Keep using current OPEN or IN_PROGRESS ticket
        ticket = latestTicket;
      }

      // 4. Create customer message
      const message = await tx.message.create({
        data: {
          ticketId: ticket.id,
          senderType: 'CUSTOMER',
          senderUserId: null,
          body,
          clientMessageId: clientMessageId || null,
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          lastMessageAt: message.createdAt,
          updatedAt: new Date(),
        },
      });

      // 5. Automatic SYSTEM message if offline and ticket was new/reopened
      let systemMessage = null;
      if ((isNewTicket || isReopened) && !hasStaffOnline()) {
        systemMessage = await tx.message.create({
          data: {
            ticketId: ticket.id,
            senderType: 'SYSTEM',
            senderUserId: null,
            body: 'Terima kasih, pesan Anda sudah kami terima. Agen kami akan membalas secepatnya.',
            clientMessageId: null,
          },
        });

        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            lastMessageAt: systemMessage.createdAt,
            updatedAt: new Date(),
          },
        });
      }

      return {
        ok: true,
        message,
        systemMessage,
        ticket: serializeTicket(ticket),
        isNewTicket,
        isReopened,
        isDuplicate: false,
      };
    });
  } catch (err) {
    // If unique constraint violation occurred on (ticketId, clientMessageId),
    // query OUTSIDE the aborted transaction using the clean Prisma client,
    // scoped to this customer's tickets:
    if (err.code === 'P2002' && clientMessageId) {
      const existing = await prisma.message.findFirst({
        where: {
          clientMessageId,
          ticket: { customerId: customer.id },
        },
        include: { ticket: true },
      });
      if (existing) {
        return {
          ok: true,
          message: existing,
          ticket: serializeTicket(existing.ticket),
          isDuplicate: true,
        };
      }
    }
    throw err;
  }
}

/**
 * Handle a message sent by a staff member.
 * - Only assignee or admin can reply.
 * - CLOSED ticket cannot be replied to.
 * - OPEN ticket without assignee must be claimed first.
 * - Idempotency by (ticketId, clientMessageId) with P2002 guard.
 * @param {object} params { ticketId, body, clientMessageId, user }
 */
export async function sendStaffMessage({ ticketId, body, clientMessageId, user }) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    return {
      ok: false,
      error: { code: 'TICKET_NOT_FOUND', message: 'Tiket tidak ditemukan.' },
    };
  }

  if (ticket.status === 'CLOSED') {
    return {
      ok: false,
      error: { code: 'TICKET_CLOSED', message: 'Tiket sudah ditutup dan tidak dapat dibalas.' },
    };
  }

  if (ticket.status === 'OPEN' && !ticket.assignedAgentId) {
    return {
      ok: false,
      error: {
        code: 'TICKET_NOT_CLAIMED',
        message: 'Tiket OPEN harus di-claim terlebih dahulu sebelum membalas.',
      },
    };
  }

  const isAssignee = ticket.assignedAgentId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isAssignee && !isAdmin) {
    return {
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Hanya assignee tiket atau admin yang dapat membalas pesan.',
      },
    };
  }

  // Idempotency check: (ticketId, clientMessageId)
  if (clientMessageId) {
    const existing = await prisma.message.findUnique({
      where: {
        ticketId_clientMessageId: {
          ticketId,
          clientMessageId,
        },
      },
      include: {
        senderUser: { select: { id: true, name: true } },
      },
    });

    if (existing) {
      return {
        ok: true,
        message: existing,
        ticket: serializeTicket(ticket),
        isDuplicate: true,
      };
    }
  }

  // Create staff message with P2002 guard against concurrent duplicates
  let message;
  try {
    message = await prisma.message.create({
      data: {
        ticketId,
        senderType: 'AGENT',
        senderUserId: user.id,
        body,
        clientMessageId: clientMessageId || null,
      },
      include: {
        senderUser: { select: { id: true, name: true } },
      },
    });
  } catch (err) {
    if (err.code === 'P2002' && clientMessageId) {
      const existing = await prisma.message.findUnique({
        where: {
          ticketId_clientMessageId: {
            ticketId,
            clientMessageId,
          },
        },
        include: {
          senderUser: { select: { id: true, name: true } },
        },
      });
      if (existing) {
        return {
          ok: true,
          message: existing,
          ticket: serializeTicket(ticket),
          isDuplicate: true,
        };
      }
    }
    throw err;
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      lastMessageAt: message.createdAt,
      updatedAt: new Date(),
    },
  });

  return {
    ok: true,
    message,
    ticket: serializeTicket(ticket),
    isDuplicate: false,
  };
}

/**
 * Sync messages for a customer since lastMessageId.
 * @param {number} customerId
 * @param {number} [lastMessageId]
 */
export async function syncCustomerMessages(customerId, lastMessageId) {
  const latestTicket = await prisma.ticket.findFirst({
    where: { customerId },
    orderBy: { id: 'desc' },
    select: { id: true },
  });

  if (!latestTicket) return [];

  const where = { ticketId: latestTicket.id };
  if (lastMessageId) {
    where.id = { gt: Number(lastMessageId) };
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { id: 'asc' },
    include: {
      senderUser: { select: { id: true, name: true } },
    },
  });

  return messages;
}

/**
 * Sync messages for staff across multiple tickets since lastMessageId per ticket.
 * @param {Array<{ ticketId: number, lastMessageId?: number }>} tickets
 */
export async function syncStaffMessages(tickets) {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];

  const results = await Promise.all(
    tickets.map(async ({ ticketId, lastMessageId }) => {
      const where = { ticketId: Number(ticketId) };
      if (lastMessageId) {
        where.id = { gt: Number(lastMessageId) };
      }
      return prisma.message.findMany({
        where,
        orderBy: { id: 'asc' },
        include: {
          senderUser: { select: { id: true, name: true } },
        },
      });
    })
  );

  return results.flat();
}
