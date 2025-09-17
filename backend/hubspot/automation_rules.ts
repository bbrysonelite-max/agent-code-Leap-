import { api } from "encore.dev/api";
import { hubspotDB } from "./db";
import { AutomationRule, CreateAutomationRuleRequest } from "./types";

export const createAutomationRule = api(
  { method: "POST", path: "/automation-rules", expose: true },
  async (req: CreateAutomationRuleRequest) => {
    const rule = await hubspotDB.queryRow`
      INSERT INTO automation_rules (name, trigger, conditions, ai_prompt)
      VALUES (${req.name}, ${req.trigger}, ${JSON.stringify(req.conditions)}, ${req.ai_prompt})
      RETURNING *
    `;

    return rule;
  }
);

export const listAutomationRules = api(
  { method: "GET", path: "/automation-rules", expose: true },
  async () => {
    return await hubspotDB.query`
      SELECT * FROM automation_rules 
      ORDER BY created_at DESC
    `;
  }
);

export const getAutomationRule = api(
  { method: "GET", path: "/automation-rules/:id", expose: true },
  async ({ id }: { id: string }) => {
    const rule = await hubspotDB.queryRow`
      SELECT * FROM automation_rules WHERE id = ${id}
    `;

    if (!rule) {
      throw new Error("Automation rule not found");
    }

    return rule;
  }
);

export const updateAutomationRule = api(
  { method: "PUT", path: "/automation-rules/:id", expose: true },
  async ({ id, ...req }: { id: string } & Partial<CreateAutomationRuleRequest & { is_active: boolean }>) => {
    const updates: string[] = [];
    const values: any[] = [];

    if (req.name !== undefined) {
      updates.push(`name = $${values.length + 1}`);
      values.push(req.name);
    }
    if (req.trigger !== undefined) {
      updates.push(`trigger = $${values.length + 1}`);
      values.push(req.trigger);
    }
    if (req.conditions !== undefined) {
      updates.push(`conditions = $${values.length + 1}`);
      values.push(JSON.stringify(req.conditions));
    }
    if (req.ai_prompt !== undefined) {
      updates.push(`ai_prompt = $${values.length + 1}`);
      values.push(req.ai_prompt);
    }
    if (req.is_active !== undefined) {
      updates.push(`is_active = $${values.length + 1}`);
      values.push(req.is_active);
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE automation_rules 
      SET ${updates.join(', ')} 
      WHERE id = $${values.length}
      RETURNING *
    `;

    const rule = await hubspotDB.queryRow(query as any, ...values);

    if (!rule) {
      throw new Error("Automation rule not found");
    }

    return rule;
  }
);

export const deleteAutomationRule = api(
  { method: "DELETE", path: "/automation-rules/:id", expose: true },
  async ({ id }: { id: string }) => {
    await hubspotDB.exec`
      DELETE FROM automation_rules WHERE id = ${id}
    `;
  }
);

export const createDefaultAutomationRules = api(
  { method: "POST", path: "/automation-rules/defaults", expose: true },
  async () => {
    const defaultRules = [
      {
        name: "Auto-Create Contact from Email",
        trigger: "contact_created" as const,
        conditions: { email_exists: true, contact_exists: false },
        ai_prompt: "When a new email is detected without an existing contact, create a new contact with all available information. Enrich the contact data by inferring company information from email domain and set appropriate lifecycle stage."
      },
      {
        name: "High-Value Lead to Deal Conversion",
        trigger: "contact_updated" as const,
        conditions: { lead_score_min: 80, has_company: true },
        ai_prompt: "When a contact reaches a lead score above 80 and has company information, automatically create a deal. Estimate deal value based on company size, industry, and engagement level. Set deal stage to 'qualified to buy'."
      },
      {
        name: "Email Engagement Deal Progression",
        trigger: "email_opened" as const,
        conditions: { has_deal: true, engagement_level: "high" },
        ai_prompt: "When a contact with an existing deal opens emails multiple times or clicks links, move the deal to the next stage. Consider the timing and frequency of engagement to determine confidence level."
      },
      {
        name: "Re-engagement for Cold Leads",
        trigger: "contact_updated" as const,
        conditions: { days_since_activity: 30, lifecycle_stage: "lead" },
        ai_prompt: "When a lead has no activity for 30+ days, send a personalized re-engagement email. Use company information and previous interactions to craft a relevant message."
      },
      {
        name: "Deal Stage Progression by Activity",
        trigger: "deal_updated" as const,
        conditions: { has_recent_activity: true, stage_duration_days: 7 },
        ai_prompt: "When a deal has recent activity and has been in the current stage for 7+ days, evaluate if it should progress. Consider activity type, contact engagement, and deal value to make progression decision."
      },
      {
        name: "Automatic Lead Scoring Update",
        trigger: "contact_updated" as const,
        conditions: { has_new_data: true },
        ai_prompt: "When new contact data is available, recalculate lead score based on company size, title, engagement history, and other factors. Update the contact properties with new score and reasoning."
      }
    ];

    const createdRules: any[] = [];

    for (const rule of defaultRules) {
      const created = await hubspotDB.queryRow`
        INSERT INTO automation_rules (name, trigger, conditions, ai_prompt)
        VALUES (${rule.name}, ${rule.trigger}, ${JSON.stringify(rule.conditions)}, ${rule.ai_prompt})
        RETURNING *
      `;
      createdRules.push(created);
    }

    return createdRules;
  }
);