/**
 * middleware/auth.middleware.js
 * Verifies the Bearer access token on every protected route.
 * Attaches the decoded payload to req.user.
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { httpError } from '../utils/httpError.js';

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(httpError(401, 'UNAUTHORIZED', 'Token autentikasi tidak ditemukan.'));
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(httpError(401, 'TOKEN_EXPIRED', 'Token sudah kedaluwarsa.'));
    }
    return next(httpError(401, 'INVALID_TOKEN', 'Token tidak valid.'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return next(httpError(401, 'ACCOUNT_INACTIVE', 'Akun Anda tidak aktif atau tidak ditemukan.'));
    }

    req.user = payload; // { sub, email, role }
    return next();
  } catch (err) {
    return next(err);
  }
}
