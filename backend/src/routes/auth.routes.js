/**
 * routes/auth.routes.js
 * Auth endpoints: /api/auth/...
 */

import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken wajib diisi.'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken wajib diisi.'),
});

// Routes
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/logout', validateBody(logoutSchema), authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
