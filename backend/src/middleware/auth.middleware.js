/**
 * middleware/auth.middleware.js
 * Verifies the Bearer access token on every protected route.
 * Attaches the decoded payload to req.user.
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(httpError(401, 'UNAUTHORIZED', 'Token autentikasi tidak ditemukan.'));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = payload; // { sub, email, role }
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(httpError(401, 'TOKEN_EXPIRED', 'Token sudah kedaluwarsa.'));
    }
    return next(httpError(401, 'INVALID_TOKEN', 'Token tidak valid.'));
  }
}
