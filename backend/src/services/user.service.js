/**
 * services/user.service.js
 * Business logic for admin user management.
 * Controllers must not call Prisma directly.
 */

import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import { eventBus } from '../events/eventBus.js';
import { httpError } from '../utils/httpError.js';
import { BCRYPT_ROUNDS } from './auth.service.js';

// Strip passwordHash from any user object
function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * List all users.
 */
export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return users;
}

/**
 * Create a new user.
 * @param {{ name: string, email: string, password: string, role: string }} data
 */
export async function createUser(data) {
  const { name, email, password, role } = data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw httpError(409, 'EMAIL_TAKEN', 'Email sudah digunakan.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  return sanitizeUser(user);
}

/**
 * Update a user. Admin cannot deactivate themselves.
 * Deactivating revokes all refresh tokens for that user.
 * @param {number} targetId
 * @param {number} actorId         The id of the admin performing the action
 * @param {{ name?, role?, isActive?, password? }} data
 */
export async function updateUser(targetId, actorId, data) {
  const { name, role, isActive, password } = data;

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    throw httpError(404, 'NOT_FOUND', 'User tidak ditemukan.');
  }

  // Admin cannot deactivate themselves
  if (isActive === false && targetId === actorId) {
    throw httpError(400, 'CANNOT_DEACTIVATE_SELF', 'Admin tidak dapat menonaktifkan dirinya sendiri.');
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (role !== undefined) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password !== undefined) {
    updateData.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: updateData,
  });

  // If deactivated, revoke all active refresh tokens and disconnect sockets
  if (isActive === false) {
    await prisma.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    eventBus.emit('user:deactivated', targetId);
  }

  return sanitizeUser(updated);
}
