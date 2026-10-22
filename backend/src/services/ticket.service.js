/**
 * services/ticket.service.js
 * Implements all business rules for tickets according to PRD section 8 & 9.
 */

import { prisma } from '../config/prisma.js';
import { eventBus } from '../events/eventBus.js';
import { httpError } from '../utils/httpError.js';
import { formatTicketNumber } from '../utils/ticketNumber.js';

/**
 * Format ticket entity with computed HD-XXXX ticket number.
 */
function serializeTicket(ticket) {
  if (!ticket) return null;
  return {
    ...ticket,
    number: formatTicketNumber(ticket.id),
  };
}

/**
 * List tickets with filters, pagination, status counts, and last message.
 * @param {object} params
 */
export async function getTickets({ status, assigned, q, page = 1, limit = 20, user }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const take = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * take;

  const where = {};

  if (status) {
    where.status = status;
  }

  if (assigned) {
    if (assigned === 'me') {
      where.assignedAgentId = Number(user.sub || user.id);
    } else if (assigned === 'none') {
      where.assignedAgentId = null;
    } else if (!isNaN(Number(assigned))) {
      where.assignedAgentId = Number(assigned);
    }
  }

  if (q && q.trim()) {
    const searchTerm = q.trim();
    where.OR = [
      { subject: { contains: searchTerm, mode: 'insensitive' } },
      { customer: { name: { contains: searchTerm, mode: 'insensitive' } } },
      { messages: { some: { body: { contains: searchTerm, mode: 'insensitive' } } } },
    ];
  }

  // Get status counts for badges (all statuses regardless of the `status` filter)
  const countWhere = { ...where };
  delete countWhere.status;

  const [statusGroups, total, tickets] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['status'],
      where: countWhere,
      _count: { _all: true },
    }),
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      skip,
      take,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true } },
        messages: {
          take: 1,
          orderBy: { id: 'desc' },
          select: { body: true, senderType: true, createdAt: true },
        },
      },
    }),
  ]);

  const counts = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0, ALL: 0 };
  for (const group of statusGroups) {
    counts[group.status] = group._count._all;
    counts.ALL += group._count._all;
  }

  const items = tickets.map((t) => {
    const lastMsg = t.messages?.[0] ?? null;
    const { messages, ...ticketFields } = t;
    return {
      ...serializeTicket(ticketFields),
      lastMessage: lastMsg
        ? {
            body: lastMsg.body,
            senderType: lastMsg.senderType,
            createdAt: lastMsg.createdAt,
          }
        : null,
    };
  });

  return {
    items,
    pagination: {
      page: pageNum,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
    counts,
  };
}

/**
 * Get ticket detail by ID including full audit trail events.
 * @param {number} ticketId
 */
export async function getTicketById(ticketId) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      assignedAgent: { select: { id: true, name: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        include: {
          actorUser: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw httpError(404, 'TICKET_NOT_FOUND', 'Tiket tidak ditemukan.');
  }

  return serializeTicket(ticket);
}

/**
 * Get ticket messages ascending by ID.
 * When `after` is omitted, fetches the latest `limit` (default 100) messages, returned ascending.
 * @param {number} ticketId
 * @param {object} params
 */
export async function getTicketMessages(ticketId, { after, limit = 100 }) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!ticket) {
    throw httpError(404, 'TICKET_NOT_FOUND', 'Tiket tidak ditemukan.');
  }

  const take = Math.min(200, Math.max(1, Number(limit) || 100));

  if (after) {
    const messages = await prisma.message.findMany({
      where: {
        ticketId,
        id: { gt: Number(after) },
      },
      take,
      orderBy: { id: 'asc' },
      include: {
        senderUser: { select: { id: true, name: true } },
      },
    });
    return messages;
  }

  // Without `after`: fetch latest `take` messages and return ascending by id
  const messagesDesc = await prisma.message.findMany({
    where: { ticketId },
    take,
    orderBy: { id: 'desc' },
    include: {
      senderUser: { select: { id: true, name: true } },
    },
  });

  return messagesDesc.reverse();
}

/**
 * Atomic claim ticket (first-claim-wins).
 * @param {number} ticketId
 * @param {object} user
 */
export async function claimTicket(ticketId, user) {
  const userId = Number(user.sub || user.id);

  const result = await prisma.ticket.updateMany({
    where: {
      id: ticketId,
      status: 'OPEN',
      assignedAgentId: null,
    },
    data: {
      status: 'IN_PROGRESS',
      assignedAgentId: userId,
    },
  });

  if (result.count === 0) {
    const existing = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, assignedAgentId: true },
    });

    if (!existing) {
      throw httpError(404, 'TICKET_NOT_FOUND', 'Tiket tidak ditemukan.');
    }

    throw httpError(
      409,
      'TICKET_ALREADY_CLAIMED',
      'Tiket sudah diambil oleh agen lain atau tidak dalam status OPEN.'
    );
  }

  await prisma.ticketEvent.create({
    data: {
      ticketId,
      actorUserId: userId,
      type: 'ASSIGNED',
      oldValue: null,
      newValue: String(userId),
    },
  });

  const updatedTicket = await getTicketById(ticketId);
  eventBus.emit('ticket:updated', { ticket: updatedTicket, customerId: updatedTicket.customerId });
  return updatedTicket;
}

/**
 * Release an IN_PROGRESS ticket back to OPEN.
 * Accessible by assignee or admin.
 * @param {number} ticketId
 * @param {object} user
 */
export async function releaseTicket(ticketId, user) {
  const userId = Number(user.sub || user.id);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, assignedAgentId: true },
  });

  if (!ticket) {
    throw httpError(404, 'TICKET_NOT_FOUND', 'Tiket tidak ditemukan.');
  }

  const isAssignee = ticket.assignedAgentId === userId;
  const isAdmin = user.role === 'ADMIN';

  if (!isAssignee && !isAdmin) {
    throw httpError(403, 'FORBIDDEN', 'Hanya assignee atau admin yang dapat melepas tiket ini.');
  }

  if (ticket.status !== 'IN_PROGRESS') {
    throw httpError(
      400,
      'INVALID_STATUS_TRANSITION',
      'Hanya tiket berstatus IN_PROGRESS yang dapat dilepas.'
    );
  }

  const prevAssignee = ticket.assignedAgentId;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'OPEN',
        assignedAgentId: null,
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId,
        actorUserId: userId,
        type: 'RELEASED',
        oldValue: prevAssignee ? String(prevAssignee) : null,
        newValue: null,
      },
    });
  });

  const updatedTicket = await getTicketById(ticketId);
  eventBus.emit('ticket:updated', { ticket: updatedTicket, customerId: updatedTicket.customerId });
  return updatedTicket;
}

/**
 * Reassign ticket to another active agent or admin (Admin only).
 * @param {number} ticketId
 * @param {number} targetAgentId
 * @param {object} user
 */
export async function assignTicket(ticketId, targetAgentId, user) {
  const userId = Number(user.sub || user.id);

  if (user.role !== 'ADMIN') {
    throw httpError(403, 'FORBIDDEN', 'Hanya admin yang dapat meng-assign ulang tiket.');
  }

  const targetAgent = await prisma.user.findUnique({
    where: { id: targetAgentId },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!targetAgent || !targetAgent.isActive) {
    throw httpError(400, 'INVALID_AGENT', 'Agen tujuan tidak ditemukan atau tidak aktif.');
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, assignedAgentId: true },
  });

  if (!ticket) {
    throw httpError(404, 'TICKET_NOT_FOUND', 'Tiket tidak ditemukan.');
  }

  if (ticket.status === 'CLOSED') {
    throw httpError(400, 'TICKET_CLOSED', 'Tiket sudah ditutup dan tidak dapat di-assign.');
  }

  const prevAssignee = ticket.assignedAgentId;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'IN_PROGRESS',
        assignedAgentId: targetAgentId,
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId,
        actorUserId: userId,
        type: 'ASSIGNED',
        oldValue: prevAssignee ? String(prevAssignee) : null,
        newValue: String(targetAgentId),
      },
    });
  });

  const updatedTicket = await getTicketById(ticketId);
  eventBus.emit('ticket:updated', { ticket: updatedTicket, customerId: updatedTicket.customerId });
  return updatedTicket;
}

/**
 * Update ticket status and/or priority.
 * Accessible by assignee or admin.
 * Enforces valid status transitions and locks CLOSED tickets.
 * @param {number} ticketId
 * @param {object} updateData { status?, priority? }
 * @param {object} user
 */
export async function updateTicket(ticketId, { status, priority }, user) {
  const userId = Number(user.sub || user.id);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, priority: true, assignedAgentId: true },
  });

  if (!ticket) {
    throw httpError(404, 'TICKET_NOT_FOUND', 'Tiket tidak ditemukan.');
  }

  if (ticket.status === 'CLOSED') {
    throw httpError(400, 'TICKET_CLOSED', 'Tiket sudah berstatus CLOSED dan tidak dapat diubah.');
  }

  const isAssignee = ticket.assignedAgentId === userId;
  const isAdmin = user.role === 'ADMIN';

  if (!isAssignee && !isAdmin) {
    throw httpError(403, 'FORBIDDEN', 'Hanya assignee atau admin yang dapat mengubah tiket ini.');
  }

  const dbUpdates = {};
  const events = [];

  // Validate status transition if changing status
  if (status && status !== ticket.status) {
    const isValidTransition =
      (ticket.status === 'IN_PROGRESS' && status === 'RESOLVED') ||
      (ticket.status === 'RESOLVED' && status === 'IN_PROGRESS') ||
      (ticket.status === 'RESOLVED' && status === 'CLOSED');

    if (!isValidTransition) {
      throw httpError(
        400,
        'INVALID_STATUS_TRANSITION',
        `Transisi status dari ${ticket.status} ke ${status} tidak valid.`
      );
    }

    dbUpdates.status = status;

    if (status === 'RESOLVED') {
      dbUpdates.resolvedAt = new Date();
    } else if (status === 'IN_PROGRESS') {
      dbUpdates.resolvedAt = null;
    } else if (status === 'CLOSED') {
      dbUpdates.closedAt = new Date();
    }

    events.push({
      ticketId,
      actorUserId: userId,
      type: 'STATUS_CHANGED',
      oldValue: ticket.status,
      newValue: status,
    });
  }

  // Validate priority update
  if (priority && priority !== ticket.priority) {
    dbUpdates.priority = priority;
    events.push({
      ticketId,
      actorUserId: userId,
      type: 'PRIORITY_CHANGED',
      oldValue: ticket.priority,
      newValue: priority,
    });
  }

  // If no changes, simply return ticket
  if (Object.keys(dbUpdates).length === 0) {
    return getTicketById(ticketId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      data: dbUpdates,
    });

    for (const ev of events) {
      await tx.ticketEvent.create({ data: ev });
    }
  });

  const updatedTicket = await getTicketById(ticketId);
  eventBus.emit('ticket:updated', { ticket: updatedTicket, customerId: updatedTicket.customerId });
  return updatedTicket;
}
