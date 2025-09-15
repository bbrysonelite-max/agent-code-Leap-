import { api, APIError } from "encore.dev/api";
import { emailDB } from "./db";
import type { EmailCampaign, Prospect, EmailTemplate } from "../agent/types";

export interface SendEmailRequest {
  prospect_id: number;
  template_id: number;
  agent_name?: string;
}

export interface SendEmailResponse {
  campaign: EmailCampaign;
  message: string;
}

// Sends a personalized Nu Skin outreach email to a prospect.
export const sendEmail = api<SendEmailRequest, SendEmailResponse>(
  { expose: true, method: "POST", path: "/email/send" },
  async (req) => {
    // Get prospect details
    const prospect = await emailDB.queryRow<Prospect>`
      SELECT * FROM prospects WHERE id = ${req.prospect_id}
    `;
    
    if (!prospect) {
      throw APIError.notFound("Prospect not found");
    }

    // Get email template
    const template = await emailDB.queryRow<EmailTemplate>`
      SELECT * FROM email_templates WHERE id = ${req.template_id} AND is_active = true
    `;
    
    if (!template) {
      throw APIError.notFound("Email template not found");
    }

    // Personalize the email content
    const agentName = req.agent_name || "Your Nu Skin Partner";
    const personalizedSubject = template.subject
      .replace(/\{\{name\}\}/g, prospect.name)
      .replace(/\{\{agent_name\}\}/g, agentName);
    
    const personalizedBody = template.body
      .replace(/\{\{name\}\}/g, prospect.name)
      .replace(/\{\{position\}\}/g, prospect.position || "professional")
      .replace(/\{\{company\}\}/g, prospect.company || "your company")
      .replace(/\{\{agent_name\}\}/g, agentName)
      .replace(/\{\{topic\}\}/g, template.template_type === 'business_builder' ? 'the Nu Skin business opportunity' : 'our premium skincare products');

    // Create email campaign record
    const campaign = await emailDB.queryRow<EmailCampaign>`
      INSERT INTO email_campaigns (
        prospect_id, template_id, subject, body, sent_at, status
      ) VALUES (
        ${req.prospect_id}, ${req.template_id}, ${personalizedSubject}, 
        ${personalizedBody}, NOW(), 'sent'
      )
      RETURNING *
    `;

    if (!campaign) {
      throw new Error("Failed to create email campaign");
    }

    // Update prospect status
    await emailDB.exec`
      UPDATE prospects 
      SET status = 'contacted', updated_at = NOW()
      WHERE id = ${req.prospect_id} AND status = 'new'
    `;

    // Update agent's daily email count
    await emailDB.exec`
      UPDATE agents 
      SET emails_sent_today = emails_sent_today + 1,
          last_activity_at = NOW()
      WHERE id = ${prospect.agent_id}
    `;

    return {
      campaign,
      message: `Email sent successfully to ${prospect.name}`,
    };
  }
);
