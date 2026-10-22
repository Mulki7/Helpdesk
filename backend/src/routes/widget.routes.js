/**
 * routes/widget.routes.js
 * Public endpoints for customer widget session and conversation.
 * Rate limited and open CORS.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as widgetController from '../controllers/widget.controller.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

const router = Router();

// Rate limiter for widget endpoints
const widgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Terlalu banyak permintaan, silakan coba lagi beberapa saat lagi.',
    },
  },
});

router.use(widgetLimiter);

// ── Validation Schemas ────────────────────────────────────────────────────────

const sessionBodySchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  visitorToken: z
    .string()
    .uuid('visitorToken harus berformat UUID')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
});

const conversationQuerySchema = z.object({
  after: z.coerce.number().int().positive().optional(),
});

// ── Endpoints ─────────────────────────────────────────────────────────────────

// POST /widget/session (or /api/widget/session)
router.post('/session', validateBody(sessionBodySchema), widgetController.createSession);

// GET /widget/conversation (or /api/widget/conversation)
router.get(
  '/conversation',
  validateQuery(conversationQuerySchema),
  widgetController.getConversation
);

export default router;
