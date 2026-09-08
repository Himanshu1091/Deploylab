/**
 * An error that is safe to show a client.
 *
 * Anything thrown that is NOT an ApiError is treated by the error handler as an
 * unexpected fault: logged in full, reported to the client as a generic 500.
 */
export class ApiError extends Error {
  constructor(status, message, code = 'ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'VALIDATION_ERROR') {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = 'Not authenticated.', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'You do not have permission to perform this action.', code = 'FORBIDDEN') {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Resource not found.', code = 'NOT_FOUND') {
    return new ApiError(404, message, code);
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, message, code);
  }
}
