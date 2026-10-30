export class AppError extends Error {
  public statusCode: number;
  public errors?: unknown[];

  constructor(message: string, statusCode = 500, errors?: unknown[]) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

