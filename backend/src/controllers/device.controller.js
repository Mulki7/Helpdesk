/**
 * controllers/device.controller.js
 * Controller for managing FCM device tokens for push notifications.
 */

import { prisma } from '../config/prisma.js';

/**
 * POST /api/devices
 * Register or update FCM device token for authenticated user.
 */
export async function registerDevice(req, res, next) {
  try {
    const userId = Number(req.user.sub || req.user.id);
    const { token, platform } = req.body;

    const device = await prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform: platform || 'android',
      },
      update: {
        userId,
        platform: platform || 'android',
      },
    });

    res.status(200).json({ data: device });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/devices
 * Remove FCM device token for authenticated user (e.g. on logout).
 */
export async function unregisterDevice(req, res, next) {
  try {
    const userId = Number(req.user.sub || req.user.id);
    const { token } = req.body;

    await prisma.deviceToken.deleteMany({
      where: {
        token,
        userId,
      },
    });

    res.status(200).json({ data: { message: 'Perangkat berhasil dihapus.' } });
  } catch (err) {
    next(err);
  }
}
