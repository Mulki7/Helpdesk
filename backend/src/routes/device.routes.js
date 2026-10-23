/**
 * routes/device.routes.js
 * Device token endpoints: /api/devices
 */

import { Router } from 'express';
import { z } from 'zod';
import * as deviceController from '../controllers/device.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const registerDeviceSchema = z.object({
  token: z.string().min(1, 'Token perangkat wajib diisi.'),
  platform: z.string().optional().default('android'),
});

const unregisterDeviceSchema = z.object({
  token: z.string().min(1, 'Token perangkat wajib diisi.'),
});

router.use(authenticate);

router.post('/', validateBody(registerDeviceSchema), deviceController.registerDevice);
router.delete('/', validateBody(unregisterDeviceSchema), deviceController.unregisterDevice);

export default router;
