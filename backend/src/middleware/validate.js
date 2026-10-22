/**
 * middleware/validate.js
 * Factory that returns an Express middleware which validates req.body (or
 * req.query / req.params) against a Zod schema.
 *
 * Usage:
 *   import { validateBody } from '../middleware/validate.js';
 *   router.post('/login', validateBody(loginSchema), authController.login);
 */

import { httpError } from '../utils/httpError.js';

/**
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        httpError(400, 'VALIDATION_ERROR', 'Input tidak valid.', result.error.flatten().fieldErrors),
      );
    }
    req.body = result.data; // replace with parsed/coerced data
    return next();
  };
}

/**
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        httpError(400, 'VALIDATION_ERROR', 'Query tidak valid.', result.error.flatten().fieldErrors),
      );
    }
    req.query = result.data;
    return next();
  };
}
