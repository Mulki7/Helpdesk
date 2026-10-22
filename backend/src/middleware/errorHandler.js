/**
 * middleware/errorHandler.js
 * Centralised error handler for Express.
 *
 * Catches errors thrown anywhere in the app and sends a consistent JSON body:
 *   { "error": { "code": "...", "message": "...", "details": ... } }
 */

import { env } from '../config/env.js';

/**
 * @param {Error} err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Data sudah ada (duplikat).',
        details: err.meta?.target,
      },
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan.' },
    });
  }

  // httpError objects created by our helper
  const status = err.status ?? 500;
  const code = err.code ?? 'INTERNAL_SERVER_ERROR';
  const message =
    status >= 500 && env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan pada server.'
      : err.message;

  if (status >= 500) {
    console.error('[ERROR]', err);
  }

  const body = { error: { code, message } };
  if (err.details !== undefined) body.error.details = err.details;

  return res.status(status).json(body);
}
