/**
 * middleware/requireRole.js
 * Role-based access control middleware.
 *
 * Usage:
 *   router.get('/users', authenticate, requireRole('ADMIN'), userController.list);
 *   router.get('/tickets', authenticate, requireRole('AGENT', 'ADMIN'), ...);
 */

import { httpError } from '../utils/httpError.js';

/**
 * @param {...string} roles  Allowed roles (e.g. 'ADMIN', 'AGENT')
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(httpError(401, 'UNAUTHORIZED', 'Belum terautentikasi.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(httpError(403, 'FORBIDDEN', 'Anda tidak memiliki hak akses untuk tindakan ini.'));
    }
    return next();
  };
}
