export type AppErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("VALIDATION_ERROR", message, 400, details);
}

export function notFoundError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("NOT_FOUND", message, 404, details);
}
