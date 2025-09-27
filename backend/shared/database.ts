import { DatabaseError, ResourceNotFoundError } from "./errors";

export function handleDatabaseError(error: unknown, operation: string): never {
  if (error instanceof Error) {
    // Check for common database error patterns
    if (error.message.includes("duplicate key") || error.message.includes("UNIQUE constraint")) {
      throw new DatabaseError(`Duplicate entry detected during ${operation}`, operation, {
        originalError: error.message
      });
    }
    
    if (error.message.includes("foreign key constraint")) {
      throw new DatabaseError(`Foreign key constraint violation during ${operation}`, operation, {
        originalError: error.message
      });
    }
    
    if (error.message.includes("not null constraint")) {
      throw new DatabaseError(`Required field missing during ${operation}`, operation, {
        originalError: error.message
      });
    }
    
    // Generic database error
    throw new DatabaseError(`Database operation failed: ${operation}`, operation, {
      originalError: error.message
    });
  }
  
  throw new DatabaseError(`Unknown database error during ${operation}`, operation);
}

export async function executeQuery<T>(
  queryFn: () => Promise<T>,
  operation: string
): Promise<T> {
  try {
    return await queryFn();
  } catch (error) {
    handleDatabaseError(error, operation);
  }
}

export async function requireRow<T>(
  queryFn: () => Promise<T | null>,
  resourceName: string,
  identifier?: string | number
): Promise<T> {
  try {
    const result = await queryFn();
    if (!result) {
      throw new ResourceNotFoundError(resourceName, identifier);
    }
    return result;
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    handleDatabaseError(error, `fetch ${resourceName}`);
  }
}

export async function insertRow<T>(
  queryFn: () => Promise<T | null>,
  resourceName: string
): Promise<T> {
  try {
    const result = await queryFn();
    if (!result) {
      throw new DatabaseError(`Failed to create ${resourceName}`, `insert ${resourceName}`);
    }
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    handleDatabaseError(error, `insert ${resourceName}`);
  }
}