import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ProspectClassification, ProspectStatus } from "../agent/types";
import { validateField, Rules } from "../shared/validation";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";

export interface ListProspectsRequest {
  agent_id?: Query<number>;
  classification?: Query<ProspectClassification>;
  status?: Query<ProspectStatus>;
  search?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

export interface ListProspectsResponse {
  prospects: Prospect[];
  total: number;
}

const validClassifications: ProspectClassification[] = ['business_builder', 'product_customer', 'unqualified'];
const validStatuses: ProspectStatus[] = ['new', 'contacted', 'responded', 'qualified', 'converted'];

// Retrieves prospects with optional filtering and search.
export const list = api<ListProspectsRequest, ListProspectsResponse>(
  { expose: true, method: "GET", path: "/prospects" },
  wrapAsync(async (req) => {
    // Validate input
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

    const limit = req.limit || 50;
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
    
    return { prospects, total };
  })
);
