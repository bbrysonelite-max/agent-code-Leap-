import { api } from "encore.dev/api";
import { CRM } from "./db";
import type { Activity, CreateActivityRequest } from "./types";

export const createActivity = api(
  { method: "POST", path: "/ai-crm/activities", expose: true },
  async (req: CreateActivityRequest): Promise<Activity> => {
    const activity = await CRM.queryRow`
      INSERT INTO activities (
        contact_id, deal_id, lead_id, type, subject, 
        description, outcome, scheduled_at, completed_at, created_by
      ) VALUES (
        ${req.contact_id || null}, ${req.deal_id || null}, ${req.lead_id || null},
        ${req.type}, ${req.subject}, ${req.description || null},
        ${req.outcome || null}, ${req.scheduled_at || null}, 
        ${req.completed_at || null}, ${req.created_by || null}
      )
      RETURNING *
    `;

    const newActivity = activity as Activity;

    if (req.description && req.description.length > 50) {
      try {
        await fetch(`${process.env.ENCORE_APP_URL}/ai-crm/conversations/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_id: newActivity.id,
            transcript: req.description
          })
        });
      } catch (error) {
        console.warn('Failed to auto-analyze conversation:', error);
      }
    }

    return newActivity;
  }
);

export const listActivities = api(
  { method: "GET", path: "/ai-crm/activities", expose: true },
  async ({ 
    contact_id,
    deal_id,
    lead_id,
    type,
    limit = 50,
    offset = 0,
    sentiment
  }: { 
    contact_id?: string;
    deal_id?: string;
    lead_id?: string;
    type?: string;
    limit?: number;
    offset?: number;
    sentiment?: string;
  }) => {
    let query = `
      SELECT * FROM activities 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (contact_id) {
      query += ` AND contact_id = $${paramIndex}`;
      params.push(contact_id);
      paramIndex++;
    }

    if (deal_id) {
      query += ` AND deal_id = $${paramIndex}`;
      params.push(deal_id);
      paramIndex++;
    }

    if (lead_id) {
      query += ` AND lead_id = $${paramIndex}`;
      params.push(lead_id);
      paramIndex++;
    }

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (sentiment) {
      query += ` AND ai_sentiment = $${paramIndex}`;
      params.push(sentiment);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const activities = await CRM.rawQueryAll(query, ...params);
    return activities as Activity[];
  }
);

export const getActivity = api(
  { method: "GET", path: "/ai-crm/activities/:id", expose: true },
  async ({ id }: { id: string }): Promise<Activity> => {
    const activity = await CRM.queryRow`
      SELECT * FROM activities WHERE id = ${id}
    `;

    if (!activity) {
      throw new Error("Activity not found");
    }

    return activity as Activity;
  }
);

export const updateActivity = api(
  { method: "PUT", path: "/ai-crm/activities/:id", expose: true },
  async ({ id, ...updates }: { id: string } & Partial<CreateActivityRequest>): Promise<Activity> => {
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
      UPDATE activities 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    params.push(id);

    const activity = await CRM.rawQueryRow(query, ...params);

    if (!activity) {
      throw new Error("Activity not found");
    }

    return activity as Activity;
  }
);

export const deleteActivity = api(
  { method: "DELETE", path: "/ai-crm/activities/:id", expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    await CRM.exec`
      DELETE FROM activities WHERE id = ${id}
    `;

    return { success: true };
  }
);

export const getUpcomingActivities = api(
  { method: "GET", path: "/ai-crm/activities/upcoming", expose: true },
  async ({ days = 7, limit = 20 }: { days?: number; limit?: number }) => {
    const activities = await CRM.queryAll`
      SELECT a.*, 
             c.name as contact_name, 
             l.name as lead_name,
             d.name as deal_name
      FROM activities a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN leads l ON a.lead_id = l.id
      LEFT JOIN deals d ON a.deal_id = d.id
      WHERE a.scheduled_at IS NOT NULL 
        AND a.scheduled_at >= NOW()
        AND a.scheduled_at <= NOW() + INTERVAL '${days} days'
        AND a.completed_at IS NULL
      ORDER BY a.scheduled_at ASC
      LIMIT ${limit}
    `;

    return activities;
  }
);

export const getOverdueActivities = api(
  { method: "GET", path: "/ai-crm/activities/overdue", expose: true },
  async ({ limit = 20 }: { limit?: number }) => {
    const activities = await CRM.queryAll`
      SELECT a.*, 
             c.name as contact_name, 
             l.name as lead_name,
             d.name as deal_name
      FROM activities a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN leads l ON a.lead_id = l.id
      LEFT JOIN deals d ON a.deal_id = d.id
      WHERE a.scheduled_at IS NOT NULL 
        AND a.scheduled_at < NOW()
        AND a.completed_at IS NULL
      ORDER BY a.scheduled_at ASC
      LIMIT ${limit}
    `;

    return activities;
  }
);