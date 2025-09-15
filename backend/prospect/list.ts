import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ProspectClassification, ProspectStatus } from "../agent/types";

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

// Retrieves prospects with optional filtering and search.
export const list = api<ListProspectsRequest, ListProspectsResponse>(
  { expose: true, method: "GET", path: "/prospects" },
  async (req) => {
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
    const totalRow = await prospectDB.rawQueryRow<{ total: number }>(countQuery, ...params);
    const total = totalRow?.total || 0;

    const dataQuery = `
      SELECT * FROM prospects 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const prospects = await prospectDB.rawQueryAll<Prospect>(dataQuery, ...params);
    
    return { prospects, total };
  }
);
