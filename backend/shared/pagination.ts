import { validateField, Rules } from "./validation";

export interface CursorPaginationRequest {
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}

export interface CursorPaginationResponse<T> {
  data: T[];
  next_cursor?: string;
  prev_cursor?: string;
  has_next: boolean;
  has_prev: boolean;
  total_count?: number;
}

export interface CursorInfo {
  id: number;
  created_at: Date;
}

// Default pagination settings
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 1000;

// Validates pagination parameters
export function validatePaginationParams(params: CursorPaginationRequest): void {
  if (params.limit !== undefined) {
    validateField(params.limit, "limit", [
      Rules.positive(), 
      Rules.integer(), 
      Rules.max(MAX_LIMIT)
    ]);
  }
  
  if (params.cursor !== undefined) {
    validateField(params.cursor, "cursor", [Rules.minLength(1)]);
  }
  
  if (params.direction !== undefined) {
    validateField(params.direction, "direction", [Rules.oneOf(['next', 'prev'])]);
  }
}

// Encodes cursor information
export function encodeCursor(cursorInfo: CursorInfo): string {
  const encoded = Buffer.from(JSON.stringify({
    id: cursorInfo.id,
    created_at: cursorInfo.created_at.toISOString()
  })).toString('base64');
  return encoded;
}

// Decodes cursor information
export function decodeCursor(cursor: string): CursorInfo {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    return {
      id: decoded.id,
      created_at: new Date(decoded.created_at)
    };
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

// Builds cursor-based WHERE clause for pagination
export function buildCursorWhereClause(
  cursor?: string, 
  direction: 'next' | 'prev' = 'next',
  tableAlias?: string
): { clause: string; params: any[] } {
  if (!cursor) {
    return { clause: '', params: [] };
  }

  const cursorInfo = decodeCursor(cursor);
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  if (direction === 'next') {
    return {
      clause: ` AND (${prefix}created_at < $CURSOR_PARAM OR (${prefix}created_at = $CURSOR_PARAM AND ${prefix}id < $CURSOR_ID_PARAM))`,
      params: [cursorInfo.created_at, cursorInfo.id]
    };
  } else {
    return {
      clause: ` AND (${prefix}created_at > $CURSOR_PARAM OR (${prefix}created_at = $CURSOR_PARAM AND ${prefix}id > $CURSOR_ID_PARAM))`,
      params: [cursorInfo.created_at, cursorInfo.id]
    };
  }
}

// Creates pagination response with cursor information
export function createPaginationResponse<T extends { id: number; created_at: Date }>(
  data: T[],
  limit: number,
  requestedDirection: 'next' | 'prev' = 'next',
  totalCount?: number
): CursorPaginationResponse<T> {
  const hasNext = data.length === limit + 1;
  const hasPrev = requestedDirection === 'prev' && data.length > 0;
  
  // Remove extra item if we fetched limit + 1
  const resultData = hasNext ? data.slice(0, -1) : data;
  
  let nextCursor: string | undefined;
  let prevCursor: string | undefined;
  
  if (resultData.length > 0) {
    if (hasNext) {
      const lastItem = resultData[resultData.length - 1];
      nextCursor = encodeCursor({ id: lastItem.id, created_at: lastItem.created_at });
    }
    
    const firstItem = resultData[0];
    prevCursor = encodeCursor({ id: firstItem.id, created_at: firstItem.created_at });
  }
  
  return {
    data: resultData,
    next_cursor: nextCursor,
    prev_cursor: prevCursor,
    has_next: hasNext,
    has_prev: hasPrev,
    total_count: totalCount
  };
}