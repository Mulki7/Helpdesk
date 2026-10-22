/**
 * services/widget.service.js
 * Implements customer widget session and conversation retrieval (PRD section 9).
 */

import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { httpError } from '../utils/httpError.js';
import { formatTicketNumber } from '../utils/ticketNumber.js';

/**
 * Create a new customer session or update an existing customer's info.
 * @param {object} params { name, email, visitorToken }
 */
export async function getOrCreateSession({ name, email, visitorToken }) {
  if (visitorToken) {
    const existing = await prisma.customer.findUnique({
      where: { visitorToken },
    });

    if (existing) {
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          email: email !== undefined ? email : existing.email,
          lastSeenAt: new Date(),
        },
      });

      return {
        visitorToken: updated.visitorToken,
        customer: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          createdAt: updated.createdAt,
          lastSeenAt: updated.lastSeenAt,
        },
      };
    }
  }

  // Create new customer with a new or provided visitor token
  const token = visitorToken || crypto.randomUUID();

  const customer = await prisma.customer.create({
    data: {
      visitorToken: token,
      name,
      email: email || null,
      lastSeenAt: new Date(),
    },
  });

  return {
    visitorToken: customer.visitorToken,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      createdAt: customer.createdAt,
      lastSeenAt: customer.lastSeenAt,
    },
  };
}

/**
 * Retrieve customer conversation and latest ticket messages.
 * Updates customer's lastSeenAt.
 * @param {string} visitorToken
 * @param {object} params { after }
 */
export async function getConversation(visitorToken, { after }) {
  if (!visitorToken) {
    throw httpError(401, 'UNAUTHORIZED', 'Header X-Visitor-Token diperlukan.');
  }

  const customer = await prisma.customer.findUnique({
    where: { visitorToken },
  });

  if (!customer) {
    throw httpError(404, 'CUSTOMER_NOT_FOUND', 'Customer tidak ditemukan.');
  }

  // Update lastSeenAt
  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastSeenAt: new Date() },
  });

  // Find customer's latest ticket
  const latestTicket = await prisma.ticket.findFirst({
    where: { customerId: customer.id },
    orderBy: { id: 'desc' },
    include: {
      assignedAgent: { select: { id: true, name: true } },
    },
  });

  let ticketData = null;
  let messages = [];

  if (latestTicket) {
    ticketData = {
      ...latestTicket,
      number: formatTicketNumber(latestTicket.id),
    };

    if (after) {
      messages = await prisma.message.findMany({
        where: {
          ticketId: latestTicket.id,
          id: { gt: Number(after) },
        },
        take: 100,
        orderBy: { id: 'asc' },
        include: {
          senderUser: { select: { id: true, name: true } },
        },
      });
    } else {
      const messagesDesc = await prisma.message.findMany({
        where: { ticketId: latestTicket.id },
        take: 100,
        orderBy: { id: 'desc' },
        include: {
          senderUser: { select: { id: true, name: true } },
        },
      });
      messages = messagesDesc.reverse();
    }
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      createdAt: customer.createdAt,
      lastSeenAt: customer.lastSeenAt,
    },
    ticket: ticketData,
    messages,
  };
}
