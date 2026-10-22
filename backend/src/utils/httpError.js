/**
 * utils/httpError.js
 * Creates a standardised Error object used throughout the application.
 *
 * Usage:
 *   throw httpError(404, 'NOT_FOUND', 'Tiket tidak ditemukan');
 *   throw httpError(400, 'VALIDATION_ERROR', 'Input tidak valid', details);
 */

/**
 * @param {number} status   HTTP status code
 * @param {string} code     Machine-readable constant (UPPER_SNAKE_CASE)
 * @param {string} message  Human-readable message
 * @param {*}      [details] Optional extra info (validation errors, etc.)
 * @returns {Error}
 */
export function httpError(status, code, message, details) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}
