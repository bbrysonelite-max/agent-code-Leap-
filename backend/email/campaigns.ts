import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { emailDB } from "./db";
import type { EmailCampaign, CampaignStatus } from "../agent/types";
import { validateField, Rules } from "../shared/validation";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";

export interface ListCampaignsRequest {
  prospect_id?: Query<number>;
  status?: Query<CampaignStatus>;
  limit?: Query<number>;
  offset?: Query<number>;
}

export interface CampaignWithProspect extends EmailCampaign {
  prospect_name: string;
  prospect_email: string;
  prospect_company: string | null;
}

export interface ListCampaignsResponse {
  campaigns: CampaignWithProspect[];
  total: number;
}

const validCampaignStatuses: CampaignStatus[] = ['draft', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced'];

// Retrieves email campaigns with prospect information.
export const listCampaigns = api<ListCampaignsRequest, ListCampaignsResponse>(
  { expose: true, method: "GET", path: "/email/campaigns" },
  wrapAsync(async (req) => {
    // Validate input
    if (req.prospect_id !== undefined) {
      validateField(req.prospect_id, "prospect_id", [Rules.positive(), Rules.integer()]);
    }
    
    if (req.status) {
      validateField(req.status, "status", [Rules.oneOf(validCampaignStatuses)]);
    }
    
    if (req.limit !== undefined) {
      validateField(req.limit, "limit", [Rules.positive(), Rules.integer(), Rules.max(1000)]);
    }
    
    if (req.offset !== undefined) {
      validateField(req.offset, "offset", [Rules.min(0), Rules.integer()]);
    }
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

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

    const limit = req.limit || 50;
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
    
    return { campaigns, total };
  })
);
