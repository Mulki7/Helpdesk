/**
 * routes/ticket.routes.js
 * Protected endpoints for ticket management by staff (AGENT and ADMIN).
 */

import { Router } from 'express';
import { z } from 'zod';
import * as ticketController from '../controllers/ticket.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

const router = Router();

// Staff authentication required for all ticket routes
router.use(authenticate);

// ── Validation Schemas ────────────────────────────────────────────────────────

const listTicketsQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assigned: z.string().optional(), // 'me' | 'none' | userId
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});

const getMessagesQuerySchema = z.object({
  after: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100).optional(),
});

const assignTicketSchema = z.object({
  agentId: z.coerce.number().int().positive({ message: 'agentId harus bilangan bulat positif' }),
});

const updateTicketSchema = z
  .object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  })
  .refine(
    (data) => data.status !== undefined || data.priority !== undefined,
    { message: 'Setidaknya salah satu dari status atau priority harus diisi' }
  );

// ── Endpoints ─────────────────────────────────────────────────────────────────

// GET /api/tickets - List tickets with filters & counts
router.get(
  '/',
  requireRole('AGENT', 'ADMIN'),
  validateQuery(listTicketsQuerySchema),
  ticketController.listTickets
);

// GET /api/tickets/:id - Ticket detail with event audit trail
router.get(
  '/:id',
  requireRole('AGENT', 'ADMIN'),
  ticketController.getTicket
);

// GET /api/tickets/:id/messages - Ticket messages
router.get(
  '/:id/messages',
  requireRole('AGENT', 'ADMIN'),
  validateQuery(getMessagesQuerySchema),
  ticketController.getTicketMessages
);

// POST /api/tickets/:id/claim - Claim ticket (atomic first-claim-wins)
router.post(
  '/:id/claim',
  requireRole('AGENT', 'ADMIN'),
  ticketController.claimTicket
);

// POST /api/tickets/:id/release - Release ticket back to OPEN
router.post(
  '/:id/release',
  requireRole('AGENT', 'ADMIN'),
  ticketController.releaseTicket
);

// POST /api/tickets/:id/assign - Reassign ticket (Admin only)
router.post(
  '/:id/assign',
  requireRole('ADMIN'),
  validateBody(assignTicketSchema),
  ticketController.assignTicket
);

// PATCH /api/tickets/:id - Update status / priority
router.patch(
  '/:id',
  requireRole('AGENT', 'ADMIN'),
  validateBody(updateTicketSchema),
  ticketController.updateTicket
);

export default router;
