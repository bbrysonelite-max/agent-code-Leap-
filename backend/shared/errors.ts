import { APIError } from "encore.dev/api";

export interface ErrorDetails {
  field?: string;
  code?: string;
  [key: string]: any;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;

  constructor(message: string, code: string, statusCode: number, details?: ErrorDetails) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toAPIError(): APIError {
    const addDetails = (apiError: APIError) => {
      return this.details ? apiError.withDetails(this.details) : apiError;
    };

    switch (this.statusCode) {
      case 400:
        return addDetails(APIError.invalidArgument(this.message));
      case 401:
        return addDetails(APIError.unauthenticated(this.message));
      case 403:
        return addDetails(APIError.permissionDenied(this.message));
      case 404:
        return addDetails(APIError.notFound(this.message));
      case 409:
        return addDetails(APIError.alreadyExists(this.message));
      case 412:
        return addDetails(APIError.failedPrecondition(this.message));
      case 429:
        return addDetails(APIError.resourceExhausted(this.message));
      case 500:
        return addDetails(APIError.internal(this.message));
      case 501:
        return addDetails(APIError.unimplemented(this.message));
      case 503:
        return addDetails(APIError.unavailable(this.message));
      case 504:
        return addDetails(APIError.deadlineExceeded(this.message));
      default:
        return addDetails(APIError.unknown(this.message));
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, details?: ErrorDetails) {
    super(message, "VALIDATION_ERROR", 400, { field, ...details });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, operation?: string, details?: ErrorDetails) {
    super(message, "DATABASE_ERROR", 500, { operation, ...details });
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string, code: string, statusCode: number = 400, details?: ErrorDetails) {
    super(message, code, statusCode, details);
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    super(
      `${resource} not found${identifier ? ` with id: ${identifier}` : ""}`,
      "RESOURCE_NOT_FOUND",
      404,
      { resource, identifier }
    );
  }
}

export class DuplicateResourceError extends AppError {
  constructor(resource: string, field: string, value: string) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      "DUPLICATE_RESOURCE",
      409,
      { resource, field, value }
    );
  }
}

export class RateLimitError extends AppError {
  constructor(limit: number, window: string, retryAfter?: number) {
    super(
      `Rate limit exceeded: ${limit} requests per ${window}`,
      "RATE_LIMIT_EXCEEDED",
      429,
      { limit, window, retryAfter }
    );
  }
}

export function handleError(error: unknown): APIError {
  if (error instanceof AppError) {
    return error.toAPIError();
  }
  
  if (error instanceof Error) {
    // Log the original error for debugging
    console.error("Unhandled error:", error);
    return APIError.internal(`Internal server error: ${error.message}`);
  }
  
  console.error("Unknown error:", error);
  return APIError.internal("An unexpected error occurred");
}

export function wrapAsync<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error);
    }
  };
}