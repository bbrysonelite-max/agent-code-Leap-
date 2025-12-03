// Brevo Webhook Handlers
// Part of AI Lead OS - INTERCEPT MODULE
import { api } from "encore.dev/api";
import { sequenceDB } from "../../sequences/db";
import { CRM } from "../../ai_crm/db";
import { classifyIntent } from "./intent";

export interface BrevoWebhookEvent {
  event: "delivered" | "opened" | "click" | "hard_bounce" | "soft_bounce" | "spam" | "unsubscribed" | "reply";
  email: string;
  date: string;
  "message-id": string;
  subject?: string;
  link?: string;
  reason?: string;
}

/**
 * Handle Brevo webhook events
 */
export const handleBrevoWebhook = api<BrevoWebhookEvent, { success: boolean }>(
  { method: "POST", path: "/webhooks/brevo", expose: true },
  async (event) => {
    console.log(`Brevo webhook received: ${event.event} for ${event.email}`);

    // Find lead by email
    const lead = await CRM.queryRow<{ id: string }>`
      SELECT id FROM leads WHERE email = ${event.email}
    `;

    if (!lead) {
      console.warn(`Lead not found for email: ${event.email}`);
      return { success: false };
    }

    // Find send history record
    const sendRecord = await sequenceDB.queryRow<{ id: string; enrollment_id: string; step_id: string }>`
      SELECT id, enrollment_id, step_id FROM send_history 
      WHERE message_id = ${event["message-id"]} OR recipient = ${event.email}
      ORDER BY sent_at DESC LIMIT 1
    `;

    switch (event.event) {
      case "delivered":
        if (sendRecord) {
          await sequenceDB.exec`
            UPDATE send_history SET delivered_at = ${event.date} WHERE id = ${sendRecord.id}
          `;
        }
        break;

      case "opened":
        if (sendRecord) {
          await sequenceDB.exec`
            UPDATE send_history SET opened_at = ${event.date} WHERE id = ${sendRecord.id}
          `;
          // Update sequence stats
          await updateSequenceStats(sendRecord.enrollment_id, "emails_opened");
        }
        // Update lead last activity
        await CRM.exec`
          UPDATE leads SET last_activity_at = NOW() WHERE id = ${lead.id}
        `;
        break;

      case "click":
        if (sendRecord) {
          await sequenceDB.exec`
            UPDATE send_history SET clicked_at = ${event.date} WHERE id = ${sendRecord.id}
          `;
        }
        // Check if it's a Calendly link click
        if (event.link?.includes("calendly.com")) {
          await handlePotentialMeetingBooked(lead.id);
        }
        break;

      case "hard_bounce":
      case "soft_bounce":
        await handleBounce(lead.id, event.reason);
        if (sendRecord) {
          await pauseEnrollment(sendRecord.enrollment_id, "bounced");
        }
        break;

      case "spam":
        await handleSpamComplaint(lead.id);
        if (sendRecord) {
          await pauseEnrollment(sendRecord.enrollment_id, "unsubscribed");
        }
        break;

      case "unsubscribed":
        await handleUnsubscribe(lead.id);
        if (sendRecord) {
          await pauseEnrollment(sendRecord.enrollment_id, "unsubscribed");
        }
        break;

      case "reply":
        await handleReply(lead.id, "email");
        break;
    }

    return { success: true };
  }
);

/**
 * Handle inbound email replies (via Brevo inbound parsing)
 */
export const handleInboundEmail = api<{ from: string; subject: string; text: string; html?: string }, { success: boolean; intent?: string }>(
  { method: "POST", path: "/webhooks/brevo/inbound", expose: true },
  async (req) => {
    console.log(`Inbound email from: ${req.from}`);

    // Find lead
    const lead = await CRM.queryRow<{ id: string; name: string }>`
      SELECT id, name FROM leads WHERE email = ${req.from}
    `;

    if (!lead) {
      console.warn(`Lead not found for inbound email: ${req.from}`);
      return { success: false };
    }

    // Classify intent
    const intent = await classifyIntent(req.text);

    // Handle based on intent
    await handleReply(lead.id, "email", req.text, intent);

    // Log the interaction
    await CRM.exec`
      INSERT INTO activities (lead_id, type, subject, description, outcome, completed_at)
      VALUES (${lead.id}, 'email', ${req.subject}, ${req.text}, ${intent}, NOW())
    `;

    return { success: true, intent };
  }
);

// Helper functions
async function updateSequenceStats(enrollmentId: string, field: string): Promise<void> {
  const enrollment = await sequenceDB.queryRow<{ sequence_id: string }>`
    SELECT sequence_id FROM sequence_enrollments WHERE id = ${enrollmentId}
  `;
  
  if (enrollment) {
    await sequenceDB.exec`
      UPDATE sequences 
      SET stats = jsonb_set(stats, ${`{${field}}`}, (COALESCE((stats->>${field})::int, 0) + 1)::text::jsonb)
      WHERE id = ${enrollment.sequence_id}
    `;
  }
}

async function pauseEnrollment(enrollmentId: string, status: string): Promise<void> {
  await sequenceDB.exec`
    UPDATE scheduled_sends SET status = 'cancelled' WHERE enrollment_id = ${enrollmentId} AND status = 'scheduled'
  `;
  await sequenceDB.exec`
    UPDATE sequence_enrollments SET status = ${status} WHERE id = ${enrollmentId}
  `;
}

async function handleBounce(leadId: string, reason?: string): Promise<void> {
  await CRM.exec`
    UPDATE leads SET 
      status = 'unqualified',
      notes = CONCAT(COALESCE(notes, ''), '\n[BOUNCED] ', ${reason || 'Email bounced'}),
      updated_at = NOW()
    WHERE id = ${leadId}
  `;
}

async function handleSpamComplaint(leadId: string): Promise<void> {
  await CRM.exec`
    UPDATE leads SET 
      status = 'unqualified',
      notes = CONCAT(COALESCE(notes, ''), '\n[SPAM COMPLAINT] Do not contact'),
      updated_at = NOW()
    WHERE id = ${leadId}
  `;
}

async function handleUnsubscribe(leadId: string): Promise<void> {
  await CRM.exec`
    UPDATE leads SET 
      status = 'unqualified',
      notes = CONCAT(COALESCE(notes, ''), '\n[UNSUBSCRIBED] Opted out of communications'),
      updated_at = NOW()
    WHERE id = ${leadId}
  `;
}

async function handleReply(leadId: string, channel: string, content?: string, intent?: string): Promise<void> {
  // Update lead status
  await CRM.exec`
    UPDATE leads SET 
      status = 'contacted',
      last_activity_at = NOW(),
      notes = CONCAT(COALESCE(notes, ''), '\n[REPLIED via ${channel}] Intent: ', ${intent || 'unknown'}),
      updated_at = NOW()
    WHERE id = ${leadId}
  `;

  // Pause any active sequences
  const enrollments = await sequenceDB.queryAll<{ id: string }>`
    SELECT id FROM sequence_enrollments WHERE lead_id = ${leadId} AND status = 'active'
  `;

  for (const enrollment of enrollments) {
    await pauseEnrollment(enrollment.id, "replied");
  }

  // If interested, suggest booking
  if (intent === "interested" || intent === "question") {
    // Could trigger auto-response or notification here
    console.log(`Hot lead replied! Lead ID: ${leadId}, Intent: ${intent}`);
  }
}

async function handlePotentialMeetingBooked(leadId: string): Promise<void> {
  // Calendly click detected - might become a meeting
  await CRM.exec`
    UPDATE leads SET 
      notes = CONCAT(COALESCE(notes, ''), '\n[CALENDLY CLICKED] Potential meeting booking'),
      last_activity_at = NOW()
    WHERE id = ${leadId}
  `;
}

