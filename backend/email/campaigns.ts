import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { emailDB } from "./db";
import type { EmailCampaign, CampaignStatus } from "../agent/types";
import { validateField, Rules } from "../shared/validation";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { 
  CursorPaginationRequest,
  CursorPaginationResponse,
  validatePaginationParams,
  buildCursorWhereClause,
  createPaginationResponse,
  DEFAULT_LIMIT
} from "../shared/pagination";

export interface ListCampaignsRequest extends CursorPaginationRequest {
  prospect_id?: Query<number>;
  status?: Query<CampaignStatus>;
  // Keep legacy pagination for backward compatibility
  offset?: Query<number>;
}

export interface CampaignWithProspect extends EmailCampaign {
  prospect_name: string;
  prospect_email: string;
  prospect_company: string | null;
}

export interface ListCampaignsResponse extends CursorPaginationResponse<CampaignWithProspect> {
  // Keep legacy response for backward compatibility
  campaigns?: CampaignWithProspect[];
  total?: number;
}

const validCampaignStatuses: CampaignStatus[] = ['draft', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced'];

// Retrieves email campaigns with prospect information using cursor-based pagination.
export const listCampaigns = api<ListCampaignsRequest, ListCampaignsResponse>(
  { expose: true, method: "GET", path: "/email/campaigns" },
  wrapAsync(async (req) => {
    // Validate input
    validatePaginationParams(req);
    
    if (req.prospect_id !== undefined) {
      validateField(req.prospect_id, "prospect_id", [Rules.positive(), Rules.integer()]);
    }
    
    if (req.status) {
      validateField(req.status, "status", [Rules.oneOf(validCampaignStatuses)]);
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
    if (req.prospect_id) {
      whereClause += ` AND ec.prospect_id = $${paramIndex}`;
      params.push(req.prospect_id);
      paramIndex++;
    }

    if (req.status) {
      whereClause += ` AND ec.status = $${paramIndex}`;
      params.push(req.status);
      paramIndex++;
    }

    if (useCursorPagination) {
      // Cursor-based pagination
      const cursorWhere = buildCursorWhereClause(req.cursor, direction, 'ec');
      if (cursorWhere.clause) {
        whereClause += cursorWhere.clause.replace('$CURSOR_PARAM', `$${paramIndex}`).replace('$CURSOR_ID_PARAM', `$${paramIndex + 1}`);
        params.push(...cursorWhere.params);
        paramIndex += 2;
      }

      // Fetch one extra item to determine if there are more pages
      const orderDirection = direction === 'next' ? 'DESC' : 'ASC';
      const dataQuery = `
        SELECT 
          ec.*,
          p.name as prospect_name,
          p.email as prospect_email,
          p.company as prospect_company
        FROM email_campaigns ec
        JOIN prospects p ON ec.prospect_id = p.id
        ${whereClause}
        ORDER BY ec.created_at ${orderDirection}, ec.id ${orderDirection}
        LIMIT $${paramIndex}
      `;
      params.push(limit + 1);

      const campaigns = await executeQuery(
        () => emailDB.rawQueryAll<CampaignWithProspect>(dataQuery, ...params),
        "list email campaigns"
      );

      // If direction is 'prev', reverse the results to maintain chronological order
      if (direction === 'prev') {
        campaigns.reverse();
      }

      // Get total count for metadata (optional, can be expensive)
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM email_campaigns ec 
        ${whereClause.split(' AND (ec.created_at')[0]}
      `;
      const countParams = params.slice(0, paramIndex - 1);
      const totalRow = await executeQuery(
        () => emailDB.rawQueryRow<{ total: number }>(countQuery, ...countParams),
        "count email campaigns"
      );
      const total = totalRow?.total || 0;

      const response = createPaginationResponse(campaigns, limit, direction, total);
      
      // Include legacy fields for backward compatibility
      return {
        ...response,
        campaigns: response.data,
        total: response.total_count
      };
    } else {
      // Legacy offset-based pagination
      const offset = req.offset || 0;

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM email_campaigns ec 
        ${whereClause}
      `;
      const totalRow = await executeQuery(
        () => emailDB.rawQueryRow<{ total: number }>(countQuery, ...params),
        "count email campaigns"
      );
      const total = totalRow?.total || 0;

      const dataQuery = `
        SELECT 
          ec.*,
          p.name as prospect_name,
          p.email as prospect_email,
          p.company as prospect_company
        FROM email_campaigns ec
        JOIN prospects p ON ec.prospect_id = p.id
        ${whereClause}
        ORDER BY ec.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const campaigns = await executeQuery(
        () => emailDB.rawQueryAll<CampaignWithProspect>(dataQuery, ...params),
        "list email campaigns"
      );
      
      return {
        data: campaigns,
        campaigns,
        total,
        total_count: total,
        has_next: offset + campaigns.length < total,
        has_prev: offset > 0
      };
    }
  })
);
