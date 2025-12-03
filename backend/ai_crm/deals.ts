import { api } from "encore.dev/api";
import { CRM } from "./db";
import type { Deal, CreateDealRequest } from "./types";

export const createDeal = api(
  { method: "POST", path: "/ai-crm/deals", expose: true },
  async (req: CreateDealRequest): Promise<Deal> => {
    const deal = await CRM.queryRow`
      INSERT INTO deals (
        contact_id, name, value, currency, stage, probability,
        expected_close_date, assigned_to, source, notes
      ) VALUES (
        ${req.contact_id}, ${req.name}, ${req.value}, ${req.currency || 'USD'},
        ${req.stage}, ${req.probability || 50}, ${req.expected_close_date || null},
        ${req.assigned_to || null}, ${req.source}, ${req.notes || null}
      )
      RETURNING *
    `;

    const newDeal = deal as Deal;

    // Note: Recommendation generation disabled - should be handled via background job
    // TODO: Implement proper background job for deal recommendations

    return newDeal;
  }
);

export const listDeals = api(
  { method: "GET", path: "/ai-crm/deals", expose: true },
  async ({ 
    stage,
    assigned_to,
    min_value,
    max_value,
    limit = 50,
    offset = 0 
  }: { 
    stage?: string;
    assigned_to?: string;
    min_value?: number;
    max_value?: number;
    limit?: number;
    offset?: number;
  }) => {
    let query = `
      SELECT d.*, c.name as contact_name, c.company as contact_company
      FROM deals d
      JOIN contacts c ON d.contact_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (stage) {
      query += ` AND d.stage = $${paramIndex}`;
      params.push(stage);
      paramIndex++;
    }

    if (assigned_to) {
      query += ` AND d.assigned_to = $${paramIndex}`;
      params.push(assigned_to);
      paramIndex++;
    }

    if (min_value !== undefined) {
      query += ` AND d.value >= $${paramIndex}`;
      params.push(min_value);
      paramIndex++;
    }

    if (max_value !== undefined) {
      query += ` AND d.value <= $${paramIndex}`;
      params.push(max_value);
      paramIndex++;
    }

    query += ` ORDER BY d.value DESC, d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const deals = await CRM.rawQueryAll(query, ...params);
    return deals;
  }
);

export const getDeal = api(
  { method: "GET", path: "/ai-crm/deals/:id", expose: true },
  async ({ id }: { id: string }): Promise<Deal> => {
    const deal = await CRM.queryRow`
      SELECT * FROM deals WHERE id = ${id}
    `;

    if (!deal) {
      throw new Error("Deal not found");
    }

    return deal as Deal;
  }
);

export const updateDeal = api(
  { method: "PUT", path: "/ai-crm/deals/:id", expose: true },
  async ({ id, ...updates }: { id: string } & Partial<CreateDealRequest>): Promise<Deal> => {
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
      UPDATE deals 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    params.push(id);

    const deal = await CRM.rawQueryRow(query, ...params);

    if (!deal) {
      throw new Error("Deal not found");
    }

    return deal as Deal;
  }
);

export const deleteDeal = api(
  { method: "DELETE", path: "/ai-crm/deals/:id", expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    await CRM.exec`
      DELETE FROM deals WHERE id = ${id}
    `;

    return { success: true };
  }
);

export const getDealsPipeline = api(
  { method: "GET", path: "/ai-crm/deals/pipeline", expose: true },
  async () => {
    const pipeline = await CRM.queryAll`
      SELECT 
        stage,
        COUNT(*) as deal_count,
        SUM(value) as total_value,
        AVG(value) as avg_value,
        AVG(ai_win_probability) as avg_win_probability
      FROM deals
      WHERE stage NOT IN ('closed_won', 'closed_lost')
      GROUP BY stage
      ORDER BY 
        CASE stage
          WHEN 'prospecting' THEN 1
          WHEN 'qualification' THEN 2
          WHEN 'proposal' THEN 3
          WHEN 'negotiation' THEN 4
        END
    `;

    return pipeline;
  }
);

export const getDealsAnalytics = api(
  { method: "GET", path: "/ai-crm/deals/analytics", expose: true },
  async ({ days = 30 }: { days?: number }) => {
    const analytics = await CRM.queryRow`
      SELECT 
        COUNT(*) as total_deals,
        COUNT(*) FILTER (WHERE stage = 'closed_won') as won_deals,
        COUNT(*) FILTER (WHERE stage = 'closed_lost') as lost_deals,
        SUM(value) FILTER (WHERE stage = 'closed_won') as won_value,
        SUM(value) FILTER (WHERE stage = 'closed_lost') as lost_value,
        AVG(value) as avg_deal_size,
        AVG(ai_win_probability) as avg_win_probability
      FROM deals
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;

    const winRate = analytics?.won_deals && analytics?.total_deals 
      ? (analytics.won_deals / (analytics.won_deals + analytics.lost_deals)) * 100 
      : 0;

    return {
      ...analytics,
      win_rate: winRate
    };
  }
);