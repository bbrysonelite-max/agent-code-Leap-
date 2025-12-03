// Twilio Webhook Handlers
// Part of AI Lead OS - INTERCEPT MODULE
import { api } from "encore.dev/api";
import { sequenceDB } from "../../sequences/db";
import { CRM } from "../../ai_crm/db";
import { classifyIntent } from "../brevo/intent";

export interface TwilioStatusCallback {
  MessageSid: string;
  MessageStatus: "queued" | "sent" | "delivered" | "failed" | "undelivered";
  To: string;
  From: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

export interface TwilioInboundSMS {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
}

/**
 * Handle Twilio status callback
 */
export const handleTwilioStatus = api<TwilioStatusCallback, { success: boolean }>(
  { method: "POST", path: "/webhooks/twilio/status", expose: true },
  async (event) => {
    console.log(`Twilio status: ${event.MessageStatus} for ${event.To}`);

    // Find send record by message SID
    const sendRecord = await sequenceDB.queryRow<{ id: string; enrollment_id: string; lead_id: string }>`
      SELECT id, enrollment_id, lead_id FROM send_history 
      WHERE message_id = ${event.MessageSid}
    `;

    if (!sendRecord) {
      console.warn(`Send record not found for SID: ${event.MessageSid}`);
      return { success: false };
    }

    switch (event.MessageStatus) {
      case "delivered":
        await sequenceDB.exec`
          UPDATE send_history SET delivered_at = NOW() WHERE id = ${sendRecord.id}
        `;
        break;

      case "failed":
      case "undelivered":
        await sequenceDB.exec`
          UPDATE send_history SET 
            status = 'failed',
            error = ${event.ErrorMessage || event.ErrorCode || 'Delivery failed'}
          WHERE id = ${sendRecord.id}
        `;
        
        // Update lead with error
        await CRM.exec`
          UPDATE leads SET 
            notes = CONCAT(COALESCE(notes, ''), '\n[SMS FAILED] ', ${event.ErrorMessage || 'Delivery failed'}),
            updated_at = NOW()
          WHERE id = ${sendRecord.lead_id}
        `;
        break;
    }

    return { success: true };
  }
);

/**
 * Handle inbound SMS
 */
export const handleInboundSMS = api<TwilioInboundSMS, { success: boolean; response?: string }>(
  { method: "POST", path: "/webhooks/twilio/inbound", expose: true },
  async (event) => {
    console.log(`Inbound SMS from: ${event.From}`);

    // Normalize phone number for lookup
    const phone = event.From.replace(/^\+1/, "").replace(/\D/g, "");
    
    // Find lead by phone (try multiple formats)
    const lead = await CRM.queryRow<{ id: string; name: string; email: string }>`
      SELECT id, name, email FROM leads 
      WHERE phone LIKE ${'%' + phone} 
         OR phone LIKE ${'+1' + phone}
         OR phone LIKE ${phone}
      LIMIT 1
    `;

    if (!lead) {
      console.warn(`Lead not found for phone: ${event.From}`);
      return { success: false };
    }

    // Check for STOP/opt-out
    const upperBody = event.Body.toUpperCase().trim();
    if (["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(upperBody)) {
      await handleSMSOptOut(lead.id);
      return { success: true, response: "You have been unsubscribed. Reply START to resubscribe." };
    }

    // Classify intent
    const intent = await classifyIntent(event.Body);

    // Handle the reply
    await handleSMSReply(lead.id, event.Body, intent);

    // Log the interaction
    await CRM.exec`
      INSERT INTO activities (lead_id, type, subject, description, outcome, completed_at)
      VALUES (${lead.id}, 'sms', 'SMS Reply', ${event.Body}, ${intent}, NOW())
    `;

    // Return TwiML response if needed
    let response: string | undefined;
    if (intent === "interested") {
      response = `Thanks ${lead.name.split(" ")[0]}! I'll send you my calendar link to book a time. Talk soon!`;
    } else if (intent === "question") {
      response = `Great question! Let me get back to you on that shortly.`;
    }

    return { success: true, response };
  }
);

// Helper functions
async function handleSMSOptOut(leadId: string): Promise<void> {
  // Update lead
  await CRM.exec`
    UPDATE leads SET 
      status = 'unqualified',
      notes = CONCAT(COALESCE(notes, ''), '\n[SMS OPT-OUT] Replied STOP'),
      updated_at = NOW()
    WHERE id = ${leadId}
  `;

  // Pause all sequences
  const enrollments = await sequenceDB.queryAll<{ id: string }>`
    SELECT id FROM sequence_enrollments WHERE lead_id = ${leadId} AND status = 'active'
  `;

  for (const enrollment of enrollments) {
    await sequenceDB.exec`
      UPDATE scheduled_sends SET status = 'cancelled' 
      WHERE enrollment_id = ${enrollment.id} AND status = 'scheduled'
    `;
    await sequenceDB.exec`
      UPDATE sequence_enrollments SET status = 'unsubscribed' WHERE id = ${enrollment.id}
    `;
  }
}

async function handleSMSReply(leadId: string, content: string, intent: string): Promise<void> {
  // Update lead status
  await CRM.exec`
    UPDATE leads SET 
      status = 'contacted',
      last_activity_at = NOW(),
      notes = CONCAT(COALESCE(notes, ''), '\n[SMS REPLY] ', ${content}, ' | Intent: ', ${intent}),
      updated_at = NOW()
    WHERE id = ${leadId}
  `;

  // Pause sequences on reply
  const enrollments = await sequenceDB.queryAll<{ id: string; sequence_id: string }>`
    SELECT id, sequence_id FROM sequence_enrollments WHERE lead_id = ${leadId} AND status = 'active'
  `;

  for (const enrollment of enrollments) {
    await sequenceDB.exec`
      UPDATE scheduled_sends SET status = 'cancelled' 
      WHERE enrollment_id = ${enrollment.id} AND status = 'scheduled'
    `;
    await sequenceDB.exec`
      UPDATE sequence_enrollments SET status = 'replied', last_activity_at = NOW() WHERE id = ${enrollment.id}
    `;
    
    // Update sequence stats
    await sequenceDB.exec`
      UPDATE sequences 
      SET stats = jsonb_set(
        jsonb_set(stats, '{active}', (GREATEST(COALESCE((stats->>'active')::int, 0) - 1, 0))::text::jsonb),
        '{sms_replied}', (COALESCE((stats->>'sms_replied')::int, 0) + 1)::text::jsonb
      )
      WHERE id = ${enrollment.sequence_id}
    `;
  }

  // Special handling for hot intents
  if (intent === "interested") {
    console.log(`🔥 HOT LEAD SMS REPLY! Lead ID: ${leadId}`);
    // Could trigger notification, auto-response, etc.
  }
}

