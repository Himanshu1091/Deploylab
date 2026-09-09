import { ApiError } from '../utils/ApiError.js';

const SOURCES = ['body', 'params', 'query'];

/**
 * Validates request input against Zod schemas and replaces it with the parsed
 * result, so downstream code works with coerced, trimmed, typed values rather
 * than raw strings.
 *
 *   router.post('/login', validate(loginSchema), controller.login)
 *
 * Only the first issue is surfaced. Clients render one message at a time, and
 * a wall of validation errors is harder to act on than the first thing wrong.
 */
export function validate(schemas) {
  return function validateRequest(req, _res, next) {
    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);

      if (!result.success) {
        const issue = result.error.issues[0];
        return next(ApiError.badRequest(issue.message, 'VALIDATION_ERROR'));
      }

      // Express 5 made req.query a getter with no setter, so assigning to it
      // throws. Parsed query params go to a separate property instead.
      if (source === 'query') {
        req.validatedQuery = result.data;
      } else {
        req[source] = result.data;
      }
    }

    return next();
  };
}
