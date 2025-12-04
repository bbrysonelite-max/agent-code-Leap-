import { api } from "encore.dev/api";
import { CRM } from "./db";
import type { Lead, CreateLeadRequest, UpdateLeadRequest } from "./types";

export const createLead = api(
  { method: "POST", path: "/ai-crm/leads", expose: true },
  async (req: CreateLeadRequest): Promise<Lead> => {
    const lead = await CRM.queryRow`
      INSERT INTO leads (
        name, email, phone, company, position, source, 
        linkedin_profile, website, 
        industry, employee_count, revenue, city, state, country,
        notes
      ) VALUES (
        ${req.name}, 
        ${req.email}, 
        ${req.phone || null}, 
        ${req.company || null}, 
        ${req.position || null}, 
        ${req.source},
        ${req.linkedin_profile || null}, 
        ${req.website || null},
        ${req.industry || null},
        ${req.employee_count || null},
        ${req.revenue || null},
        ${req.city || null},
        ${req.state || null},
        ${req.country || 'United States'},
        ${req.notes || null}
      )
      RETURNING *
    `;

    const newLead = lead as Lead;
    
    // Note: Auto-scoring is disabled for now to avoid circular dependencies
    // In production, this should be handled via a background job/queue
    // or use the AI scoring service directly
    // TODO: Implement proper background job for lead scoring

    return newLead;
  }
);

interface ListLeadsRequest {
  limit?: number;
  offset?: number;
  status?: string;
  priority?: string;
  assigned_to?: string;
  min_score?: number;
}

interface ListLeadsResponse {
  leads: Lead[];
  total?: number;
}

export const listLeads = api<ListLeadsRequest, ListLeadsResponse>(
  { method: "GET", path: "/ai-crm/leads", expose: true },
  async ({ 
    limit = 50, 
    offset = 0, 
    status, 
    priority, 
    assigned_to,
    min_score 
  }: ListLeadsRequest): Promise<ListLeadsResponse> => {
    let query = `
      SELECT * FROM leads 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (assigned_to) {
      query += ` AND assigned_to = $${paramIndex}`;
      params.push(assigned_to);
      paramIndex++;
    }

    if (min_score !== undefined) {
      query += ` AND ai_score >= $${paramIndex}`;
      params.push(min_score);
      paramIndex++;
    }

    query += ` ORDER BY ai_score DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const leads = await CRM.rawQueryAll(query, ...params);
    return { leads: leads as Lead[] };
  }
);

export const getLead = api(
  { method: "GET", path: "/ai-crm/leads/:id", expose: true },
  async ({ id }: { id: string }): Promise<Lead> => {
    const lead = await CRM.queryRow`
      SELECT * FROM leads WHERE id = ${id}
    `;

    if (!lead) {
      throw new Error("Lead not found");
    }

    return lead as Lead;
  }
);

export const updateLead = api(
  { method: "PUT", path: "/ai-crm/leads/:id", expose: true },
  async ({ id, ...updates }: { id: string } & UpdateLeadRequest): Promise<Lead> => {
    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setParts.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (setParts.length === 0) {
      throw new Error("No updates provided");
    }

    setParts.push(`updated_at = NOW()`);

    const query = `
      UPDATE leads 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    params.push(id);

    const lead = await CRM.rawQueryRow(query, ...params);

    if (!lead) {
      throw new Error("Lead not found");
    }

    return lead as Lead;
  }
);

export const deleteLead = api(
  { method: "DELETE", path: "/ai-crm/leads/:id", expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    await CRM.exec`
      DELETE FROM leads WHERE id = ${id}
    `;

    return { success: true };
  }
);

export const searchLeads = api(
  { method: "GET", path: "/ai-crm/leads/search", expose: true },
  async ({ query, limit = 20 }: { query: string; limit?: number }) => {
    const leads = await CRM.queryAll`
      SELECT * FROM leads 
      WHERE 
        name ILIKE ${`%${query}%`} OR
        email ILIKE ${`%${query}%`} OR
        company ILIKE ${`%${query}%`} OR
        position ILIKE ${`%${query}%`} OR
        notes ILIKE ${`%${query}%`}
      ORDER BY ai_score DESC, created_at DESC
      LIMIT ${limit}
    `;

    return leads as Lead[];
  }
);