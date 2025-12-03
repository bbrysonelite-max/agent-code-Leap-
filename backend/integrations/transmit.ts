// TRANSMIT Module - Unified Email + SMS Outreach
// Part of AI Lead OS

import { api } from "encore.dev/api";
import { BrevoClient } from "./brevo/client";
import { TwilioClient } from "./twilio/client";
import { CRM } from "../ai_crm/db";

// ============================================
// TYPES
// ============================================

export interface SendOutreachRequest {
  leadId: string;
  channel: "email" | "sms" | "both";
  
  // For email
  subject?: string;
  emailBody?: string;
  
  // For SMS
  smsBody?: string;
  
  // Personalization
  variables?: Record<string, string>;
  
  // Tracking
  sequenceId?: string;
  stepNumber?: number;
}

export interface SendOutreachResponse {
  success: boolean;
  emailSent?: boolean;
  smsSent?: boolean;
  emailMessageId?: string;
  smsMessageId?: string;
  errors?: string[];
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
}

// ============================================
// PERSONALIZATION
// ============================================

function personalizeContent(
  template: string,
  lead: Lead,
  customVars?: Record<string, string>
): string {
  let content = template;
  
  // Standard variables
  const firstName = lead.name.split(" ")[0];
  const lastName = lead.name.split(" ").slice(1).join(" ");
  
  content = content
    .replace(/\{\{name\}\}/g, lead.name)
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{lastName\}\}/g, lastName)
    .replace(/\{\{email\}\}/g, lead.email)
    .replace(/\{\{company\}\}/g, lead.company || "your company")
    .replace(/\{\{position\}\}/g, lead.position || "");
  
  // Custom variables
  if (customVars) {
    for (const [key, value] of Object.entries(customVars)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
  }
  
  return content;
}

// ============================================
// SEND OUTREACH
// ============================================

export const sendOutreach = api<SendOutreachRequest, SendOutreachResponse>(
  { method: "POST", path: "/transmit/send", expose: true },
  async (req) => {
    // Get lead details
    const lead = await CRM.queryRow<Lead>`
      SELECT id, name, email, phone, company, position
      FROM leads WHERE id = ${req.leadId}
    `;
    
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    const errors: string[] = [];
    let emailSent = false;
    let smsSent = false;
    let emailMessageId: string | undefined;
    let smsMessageId: string | undefined;
    
    // Send Email
    if (req.channel === "email" || req.channel === "both") {
      if (!req.subject || !req.emailBody) {
        errors.push("Email requires subject and body");
      } else {
        try {
          const brevo = new BrevoClient();
          const personalizedSubject = personalizeContent(req.subject, lead, req.variables);
          const personalizedBody = personalizeContent(req.emailBody, lead, req.variables);
          
          // Add unsubscribe footer for compliance
          const bodyWithFooter = `${personalizedBody}
          
<br/><br/>
<p style="font-size: 11px; color: #666;">
If you no longer wish to receive these emails, <a href="{{unsubscribe_link}}">unsubscribe here</a>.
</p>`;
          
          const result = await brevo.sendEmail({
            to: [{ email: lead.email, name: lead.name }],
            subject: personalizedSubject,
            htmlContent: bodyWithFooter,
            tags: ["ai-lead-os", req.sequenceId || "manual"].filter(Boolean),
          });
          
          emailSent = true;
          emailMessageId = result.messageId;
          
          // Log to database
          await logOutreach(lead.id, "email", personalizedSubject, personalizedBody, result.messageId, req.sequenceId, req.stepNumber);
          
        } catch (error) {
          errors.push(`Email failed: ${(error as Error).message}`);
        }
      }
    }
    
    // Send SMS
    if (req.channel === "sms" || req.channel === "both") {
      if (!lead.phone) {
        errors.push("Lead has no phone number");
      } else if (!req.smsBody) {
        errors.push("SMS requires body");
      } else {
        try {
          const twilio = new TwilioClient();
          
          if (!twilio.isValidPhoneNumber(lead.phone)) {
            errors.push("Invalid phone number format");
          } else {
            const personalizedSms = personalizeContent(req.smsBody, lead, req.variables);
            
            // SMS compliance: include opt-out
            const smsWithOptOut = `${personalizedSms}\n\nReply STOP to opt out.`;
            
            const result = await twilio.sendSms({
              to: lead.phone,
              body: smsWithOptOut,
            });
            
            smsSent = true;
            smsMessageId = result.sid;
            
            // Log to database
            await logOutreach(lead.id, "sms", null, personalizedSms, result.sid, req.sequenceId, req.stepNumber);
          }
        } catch (error) {
          errors.push(`SMS failed: ${(error as Error).message}`);
        }
      }
    }
    
    return {
      success: emailSent || smsSent,
      emailSent,
      smsSent,
      emailMessageId,
      smsMessageId,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

// ============================================
// LOG OUTREACH
// ============================================

async function logOutreach(
  leadId: string,
  channel: "email" | "sms",
  subject: string | null,
  body: string,
  externalId: string,
  sequenceId?: string,
  stepNumber?: number
): Promise<void> {
  await CRM.exec`
    INSERT INTO activities (
      lead_id, type, subject, description, outcome, created_by
    ) VALUES (
      ${leadId},
      ${channel},
      ${subject || `SMS to lead`},
      ${body},
      'sent',
      'ai-lead-os'
    )
  `;
  
  // Update lead last activity
  await CRM.exec`
    UPDATE leads SET 
      last_activity_at = NOW(),
      status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END,
      updated_at = NOW()
    WHERE id = ${leadId}
  `;
}

// ============================================
// QUICK SEND ENDPOINTS
// ============================================

export interface QuickEmailRequest {
  leadId: string;
  subject: string;
  body: string;
}

export const quickEmail = api<QuickEmailRequest, SendOutreachResponse>(
  { method: "POST", path: "/transmit/email", expose: true },
  async (req) => {
    return sendOutreach({
      leadId: req.leadId,
      channel: "email",
      subject: req.subject,
      emailBody: req.body,
    });
  }
);

export interface QuickSmsRequest {
  leadId: string;
  message: string;
}

export const quickSms = api<QuickSmsRequest, SendOutreachResponse>(
  { method: "POST", path: "/transmit/sms", expose: true },
  async (req) => {
    return sendOutreach({
      leadId: req.leadId,
      channel: "sms",
      smsBody: req.message,
    });
  }
);

// ============================================
// BULK SEND
// ============================================

export interface BulkOutreachRequest {
  leadIds: string[];
  channel: "email" | "sms" | "both";
  subject?: string;
  emailBody?: string;
  smsBody?: string;
  variables?: Record<string, string>;
  delayBetweenMs?: number; // Delay between sends to avoid rate limits
}

export interface BulkOutreachResponse {
  total: number;
  successful: number;
  failed: number;
  results: {
    leadId: string;
    success: boolean;
    error?: string;
  }[];
}

export const bulkOutreach = api<BulkOutreachRequest, BulkOutreachResponse>(
  { method: "POST", path: "/transmit/bulk", expose: true },
  async (req) => {
    const results: BulkOutreachResponse["results"] = [];
    const delay = req.delayBetweenMs || 1000; // Default 1 second between sends
    
    for (const leadId of req.leadIds) {
      try {
        const result = await sendOutreach({
          leadId,
          channel: req.channel,
          subject: req.subject,
          emailBody: req.emailBody,
          smsBody: req.smsBody,
          variables: req.variables,
        });
        
        results.push({
          leadId,
          success: result.success,
          error: result.errors?.join(", "),
        });
        
        // Rate limiting delay
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        results.push({
          leadId,
          success: false,
          error: (error as Error).message,
        });
      }
    }
    
    return {
      total: req.leadIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }
);

