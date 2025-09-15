import { api } from "encore.dev/api";
import { emailDB } from "./db";
import type { EmailTemplate, EmailTemplateType } from "../agent/types";

export interface ListTemplatesRequest {
  template_type?: EmailTemplateType;
  active_only?: boolean;
}

export interface ListTemplatesResponse {
  templates: EmailTemplate[];
}

// Retrieves email templates for Nu Skin outreach campaigns.
export const listTemplates = api<ListTemplatesRequest, ListTemplatesResponse>(
  { expose: true, method: "GET", path: "/email/templates" },
  async (req) => {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (req.template_type) {
      whereClause += ` AND template_type = $${paramIndex}`;
      params.push(req.template_type);
      paramIndex++;
    }

    if (req.active_only) {
      whereClause += ` AND is_active = true`;
    }

    const query = `
      SELECT * FROM email_templates 
      ${whereClause} 
      ORDER BY template_type, name
    `;

    const templates = await emailDB.rawQueryAll<EmailTemplate>(query, ...params);
    
    return { templates };
  }
);
