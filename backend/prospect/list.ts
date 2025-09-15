import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ProspectClassification, ProspectStatus } from "../agent/types";
import { validateField, Rules } from "../shared/validation";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { sanitizeSearchInput } from "../shared/security";
import { 
  CursorPaginationRequest,
  CursorPaginationResponse,
  validatePaginationParams,
  buildCursorWhereClause,
  createPaginationResponse,
  DEFAULT_LIMIT
} from "../shared/pagination";

export interface ListProspectsRequest extends CursorPaginationRequest {
  agent_id?: Query<number>;
  classification?: Query<ProspectClassification>;
  status?: Query<ProspectStatus>;
  search?: Query<string>;
  // Keep legacy pagination for backward compatibility
  offset?: Query<number>;
}

export interface ListProspectsResponse extends CursorPaginationResponse<Prospect> {
  // Keep legacy response for backward compatibility
  prospects?: Prospect[];
  total?: number;
}

const validClassifications: ProspectClassification[] = ['business_builder', 'product_customer', 'unqualified'];
const validStatuses: ProspectStatus[] = ['new', 'contacted', 'responded', 'qualified', 'converted'];

// Retrieves prospects with optional filtering and search using cursor-based pagination.
export const list = api<ListProspectsRequest, ListProspectsResponse>(
  { expose: true, method: "GET", path: "/prospects" },
  wrapAsync(async (req) => {
    // Validate input
    validatePaginationParams(req);
    
    if (req.agent_id !== undefined) {
      validateField(req.agent_id, "agent_id", [Rules.positive(), Rules.integer()]);
    }
    
    if (req.classification) {
      validateField(req.classification, "classification", [Rules.oneOf(validClassifications)]);
    }
    
    if (req.status) {
      validateField(req.status, "status", [Rules.oneOf(validStatuses)]);
    }
    
    if (req.search) {
      validateField(req.search, "search", [Rules.minLength(1), Rules.maxLength(100)]);
      req.search = sanitizeSearchInput(req.search);
    }
    
    if (req.offset !== undefined) {
      validateField(req.offset, "offset", [Rules.min(0), Rules.integer()]);
    }

    // Support both cursor-based and legacy offset-based pagination
    const useCursorPagination = req.cursor !== undefined || req.offset === undefined;
    const limit = req.limit || DEFAULT_LIMIT;
    const direction = req.direction || 'next';

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    // Build filter conditions
    if (req.agent_id) {
      whereClause += ` AND agent_id = $${paramIndex}`;
      params.push(req.agent_id);
      paramIndex++;
    }

    if (req.classification) {
      whereClause += ` AND classification = $${paramIndex}`;
      params.push(req.classification);
      paramIndex++;
    }

    if (req.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(req.status);
      paramIndex++;
    }

    if (req.search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR company ILIKE $${paramIndex})`;
      params.push(`%${req.search}%`);
      paramIndex++;
    }

    if (useCursorPagination) {
      // Cursor-based pagination
      const cursorWhere = buildCursorWhereClause(req.cursor, direction);
      if (cursorWhere.clause) {
        whereClause += cursorWhere.clause.replace('$CURSOR_PARAM', `$${paramIndex}`).replace('$CURSOR_ID_PARAM', `$${paramIndex + 1}`);
        params.push(...cursorWhere.params);
        paramIndex += 2;
      }

      // Fetch one extra item to determine if there are more pages
      const orderDirection = direction === 'next' ? 'DESC' : 'ASC';
      const dataQuery = `
        SELECT * FROM prospects 
        ${whereClause} 
        ORDER BY created_at ${orderDirection}, id ${orderDirection}
        LIMIT $${paramIndex}
      `;
      params.push(limit + 1);

      const prospects = await executeQuery(
        () => prospectDB.rawQueryAll<Prospect>(dataQuery, ...params),
        "list prospects"
      );

      // If direction is 'prev', reverse the results to maintain chronological order
      if (direction === 'prev') {
        prospects.reverse();
      }

      // Get total count for metadata (optional, can be expensive)
      const countQuery = `SELECT COUNT(*) as total FROM prospects ${whereClause.split(' AND (created_at')[0]}`;
      const countParams = params.slice(0, paramIndex - 1);
      const totalRow = await executeQuery(
        () => prospectDB.rawQueryRow<{ total: number }>(countQuery, ...countParams),
        "count prospects"
      );
      const total = totalRow?.total || 0;

      const response = createPaginationResponse(prospects, limit, direction, total);
      
      // Include legacy fields for backward compatibility
      return {
        ...response,
        prospects: response.data,
        total: response.total_count
      };
    } else {
      // Legacy offset-based pagination
      const offset = req.offset || 0;

      const countQuery = `SELECT COUNT(*) as total FROM prospects ${whereClause}`;
      const totalRow = await executeQuery(
        () => prospectDB.rawQueryRow<{ total: number }>(countQuery, ...params),
        "count prospects"
      );
      const total = totalRow?.total || 0;

      const dataQuery = `
        SELECT * FROM prospects 
        ${whereClause} 
        ORDER BY created_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const prospects = await executeQuery(
        () => prospectDB.rawQueryAll<Prospect>(dataQuery, ...params),
        "list prospects"
      );
      
      return {
        data: prospects,
        prospects,
        total,
        total_count: total,
        has_next: offset + prospects.length < total,
        has_prev: offset > 0
      };
    }
  })
);
