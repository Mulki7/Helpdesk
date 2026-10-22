/**
 * services/auth.service.js
 * All authentication business logic lives here.
 * Controllers must not call Prisma directly.
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;
const BCRYPT_ROUNDS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

async function generateRefreshToken(userId) {
  const raw = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });

  return raw; // return raw token to be sent to client; only hash is in DB
}

// Strip sensitive fields before returning user data
function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * Login with email + password.
 * @returns {{ accessToken: string, refreshToken: string, user: object }}
 */
export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw httpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');
  }
  if (!user.isActive) {
    throw httpError(401, 'ACCOUNT_INACTIVE', 'Akun Anda telah dinonaktifkan.');
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw httpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return { accessToken, refreshToken, user: sanitizeUser(user) };
}

/**
 * Rotate refresh token — revoke old, issue new pair.
 * @returns {{ accessToken: string, refreshToken: string, user: object }}
 */
export async function refresh(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) {
    throw httpError(401, 'INVALID_TOKEN', 'Refresh token tidak valid.');
  }
  if (record.revokedAt) {
    throw httpError(401, 'TOKEN_REVOKED', 'Refresh token sudah dicabut.');
  }
  if (record.expiresAt < new Date()) {
    throw httpError(401, 'TOKEN_EXPIRED', 'Refresh token sudah kedaluwarsa.');
  }
  if (!record.user.isActive) {
    throw httpError(401, 'ACCOUNT_INACTIVE', 'Akun Anda telah dinonaktifkan.');
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const accessToken = generateAccessToken(record.user);
  const newRefreshToken = await generateRefreshToken(record.user.id);

  return { accessToken, refreshToken: newRefreshToken, user: sanitizeUser(record.user) };
}

/**
 * Logout — revoke the provided refresh token.
 */
export async function logout(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);

  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record || record.revokedAt) return; // idempotent — already gone

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
}

/**
 * Get the currently authenticated user by id.
 */
export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw httpError(404, 'NOT_FOUND', 'User tidak ditemukan.');
  return sanitizeUser(user);
}

export { BCRYPT_ROUNDS };
