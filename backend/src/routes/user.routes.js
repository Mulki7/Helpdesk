/**
 * routes/user.routes.js
 * User management endpoints (admin only): /api/users/...
 */

import { Router } from 'express';
import { z } from 'zod';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

// All user routes require admin authentication
router.use(authenticate, requireRole('ADMIN'));

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi.').max(100),
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(8, 'Password minimal 8 karakter.'),
  role: z.enum(['AGENT', 'ADMIN'], { errorMap: () => ({ message: 'Role harus AGENT atau ADMIN.' }) }),
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    role: z.enum(['AGENT', 'ADMIN']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8, 'Password minimal 8 karakter.').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal satu field harus diisi.',
  });

// Routes
router.get('/', userController.list);
router.post('/', validateBody(createUserSchema), userController.create);
router.patch('/:id', validateBody(updateUserSchema), userController.update);

export default router;
