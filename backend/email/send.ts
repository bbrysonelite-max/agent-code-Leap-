import { api } from "encore.dev/api";
import { emailDB } from "./db";
import type { EmailCampaign, Prospect, EmailTemplate } from "../agent/types";
import { validateField, Rules } from "../shared/validation";
import { requireRow, executeQuery, insertRow } from "../shared/database";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { validateEmailContent, sanitizeHtml, logSecurityEvent } from "../shared/security";
import { checkAdvancedRateLimit } from "../shared/advanced-rate-limiting";
import { broadcastMessage } from "../realtime/websocket";
import type { EmailProgressData } from "../realtime/types";

export interface SendEmailRequest {
  prospect_id: number;
  template_id: number;
  agent_name?: string;
  userTier?: string;
  agentId?: string;
}

export interface SendEmailResponse {
  campaign: EmailCampaign;
  message: string;
}

// Sends a personalized Nu Skin outreach email to a prospect.
export const sendEmail = api<SendEmailRequest, SendEmailResponse>(
  { expose: true, method: "POST", path: "/email/send" },
  wrapAsync(async (req) => {
    // Rate limiting check
    const identifier = req.agentId || "anonymous";
    await checkAdvancedRateLimit(identifier, "/email/send", "POST", req.userTier || "basic");
    
    // Validate input
    validateField(req.prospect_id, "prospect_id", [Rules.required(), Rules.positive(), Rules.integer()]);
    validateField(req.template_id, "template_id", [Rules.required(), Rules.positive(), Rules.integer()]);
    if (req.agent_name) {
      validateField(req.agent_name, "agent_name", [Rules.maxLength(100)]);
    }
    // Get prospect details
    const prospect = await requireRow(
      () => emailDB.queryRow<Prospect>`
        SELECT * FROM prospects WHERE id = ${req.prospect_id}
      `,
      "prospect",
      req.prospect_id
    );

    // Get email template
    const template = await requireRow(
      () => emailDB.queryRow<EmailTemplate>`
        SELECT * FROM email_templates WHERE id = ${req.template_id} AND is_active = true
      `,
      "email template",
      req.template_id
    );

    // Personalize the email content with security validation
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
    
    // Validate and sanitize email content
    try {
      validateEmailContent(personalizedBody);
    } catch (error) {
      logSecurityEvent("email_content_validation_failed", {
        prospect_id: req.prospect_id,
        template_id: req.template_id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
    
    const sanitizedBody = sanitizeHtml(personalizedBody);

    // Broadcast email queued
    await broadcastMessage({
      type: "email_progress",
      data: {
        campaignId: `temp_${Date.now()}`,
        emailId: `email_${Date.now()}`,
        status: "queued",
        recipientEmail: prospect.email,
        progress: { sent: 0, total: 1, failed: 0 }
      } as EmailProgressData,
      timestamp: new Date().toISOString()
    }, "email_progress");

    // Simulate sending delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Broadcast email sending
    await broadcastMessage({
      type: "email_progress",
      data: {
        campaignId: `temp_${Date.now()}`,
        emailId: `email_${Date.now()}`,
        status: "sending",
        recipientEmail: prospect.email,
        progress: { sent: 0, total: 1, failed: 0 }
      } as EmailProgressData,
      timestamp: new Date().toISOString()
    }, "email_progress");

    // Create email campaign record
    const campaign = await insertRow(
      () => emailDB.queryRow<EmailCampaign>`
        INSERT INTO email_campaigns (
          prospect_id, template_id, subject, body, sent_at, status
        ) VALUES (
          ${req.prospect_id}, ${req.template_id}, ${personalizedSubject}, 
          ${sanitizedBody}, NOW(), 'sent'
        )
        RETURNING *
      `,
      "email campaign"
    );

    // Broadcast email sent
    await broadcastMessage({
      type: "email_progress",
      data: {
        campaignId: campaign.id.toString(),
        emailId: campaign.id.toString(),
        status: "sent",
        recipientEmail: prospect.email,
        progress: { sent: 1, total: 1, failed: 0 }
      } as EmailProgressData,
      timestamp: new Date().toISOString()
    }, "email_progress");

    // Update prospect status and agent stats
    await executeQuery(
      () => emailDB.exec`
        UPDATE prospects 
        SET status = 'contacted', updated_at = NOW()
        WHERE id = ${req.prospect_id} AND status = 'new'
      `,
      "update prospect status"
    );

    await executeQuery(
      () => emailDB.exec`
        UPDATE agents 
        SET emails_sent_today = emails_sent_today + 1,
            last_activity_at = NOW()
        WHERE id = ${prospect.agent_id}
      `,
      "update agent email count"
    );

    return {
      campaign,
      message: `Email sent successfully to ${prospect.name}`,
    };
  })
);
