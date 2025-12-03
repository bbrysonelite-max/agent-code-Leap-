// Calendly Webhook Handlers
// Part of AI Lead OS - DOCK MODULE
import { api } from "encore.dev/api";
import { CRM } from "../../ai_crm/db";
import { sequenceDB } from "../../sequences/db";

export interface CalendlyWebhookPayload {
  event: "invitee.created" | "invitee.canceled";
  payload: {
    event_type: {
      uuid: string;
      name: string;
    };
    event: {
      uuid: string;
      name: string;
      start_time: string;
      end_time: string;
      location?: {
        type: string;
        join_url?: string;
      };
    };
    invitee: {
      uuid: string;
      name: string;
      email: string;
      timezone: string;
      questions_and_answers?: Array<{
        question: string;
        answer: string;
      }>;
    };
    questions_and_answers?: Array<{
      question: string;
      answer: string;
    }>;
    tracking?: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };
  };
}

/**
 * Handle Calendly webhook events
 */
export const handleCalendlyWebhook = api<CalendlyWebhookPayload, { success: boolean }>(
  { method: "POST", path: "/webhooks/calendly", expose: true },
  async (data) => {
    console.log(`Calendly webhook: ${data.event} for ${data.payload.invitee.email}`);

    const inviteeEmail = data.payload.invitee.email;
    const inviteeName = data.payload.invitee.name;
    const meetingName = data.payload.event.name;
    const meetingStart = data.payload.event.start_time;
    const meetingEnd = data.payload.event.end_time;
    const meetingUrl = data.payload.event.location?.join_url;

    // Find lead by email
    const lead = await CRM.queryRow<{ id: string; name: string }>`
      SELECT id, name FROM leads WHERE email = ${inviteeEmail}
    `;

    if (data.event === "invitee.created") {
      // Meeting booked!
      console.log(`🎉 MEETING BOOKED! ${inviteeName} - ${meetingName}`);

      if (lead) {
        // Update lead status
        await CRM.exec`
          UPDATE leads SET 
            status = 'qualified',
            priority = 'urgent',
            notes = CONCAT(COALESCE(notes, ''), '\n[MEETING BOOKED] ', ${meetingName}, ' on ', ${meetingStart}),
            last_activity_at = NOW(),
            updated_at = NOW()
          WHERE id = ${lead.id}
        `;

        // Create activity
        await CRM.exec`
          INSERT INTO activities (lead_id, type, subject, description, scheduled_at)
          VALUES (${lead.id}, 'meeting', ${meetingName}, ${meetingUrl || 'Meeting scheduled via Calendly'}, ${meetingStart})
        `;

        // Pause any active sequences
        const enrollments = await sequenceDB.queryAll<{ id: string; sequence_id: string }>`
          SELECT id, sequence_id FROM sequence_enrollments WHERE lead_id = ${lead.id} AND status = 'active'
        `;

        for (const enrollment of enrollments) {
          // Cancel pending sends
          await sequenceDB.exec`
            UPDATE scheduled_sends SET status = 'cancelled' 
            WHERE enrollment_id = ${enrollment.id} AND status = 'scheduled'
          `;
          
          // Update enrollment
          await sequenceDB.exec`
            UPDATE sequence_enrollments SET status = 'completed', completed_at = NOW()
            WHERE id = ${enrollment.id}
          `;

          // Update sequence stats
          await sequenceDB.exec`
            UPDATE sequences SET 
              stats = jsonb_set(
                jsonb_set(stats, '{meetings_booked}', (COALESCE((stats->>'meetings_booked')::int, 0) + 1)::text::jsonb),
                '{active}', (GREATEST(COALESCE((stats->>'active')::int, 0) - 1, 0))::text::jsonb
              )
            WHERE id = ${enrollment.sequence_id}
          `;
        }

        // Create or update deal
        const existingDeal = await CRM.queryRow<{ id: string }>`
          SELECT id FROM deals WHERE lead_id = ${lead.id} AND stage != 'closed_won' AND stage != 'closed_lost'
        `;

        if (existingDeal) {
          // Update existing deal stage
          await CRM.exec`
            UPDATE deals SET stage = 'qualification', updated_at = NOW() WHERE id = ${existingDeal.id}
          `;
        } else {
          // Create new deal
          await CRM.exec`
            INSERT INTO deals (lead_id, name, stage, source, notes)
            VALUES (
              ${lead.id}, 
              ${`Deal - ${lead.name}`}, 
              'qualification', 
              'calendly',
              ${`Meeting scheduled: ${meetingName}`}
            )
          `;
        }
      } else {
        // Lead not in system - create new lead
        await CRM.exec`
          INSERT INTO leads (name, email, source, status, priority, notes)
          VALUES (
            ${inviteeName}, 
            ${inviteeEmail}, 
            'calendly', 
            'qualified', 
            'urgent',
            ${`Meeting booked via Calendly: ${meetingName} on ${meetingStart}`}
          )
        `;
        console.log(`Created new lead from Calendly booking: ${inviteeEmail}`);
      }
    } else if (data.event === "invitee.canceled") {
      // Meeting canceled
      console.log(`❌ Meeting canceled: ${inviteeName} - ${meetingName}`);

      if (lead) {
        await CRM.exec`
          UPDATE leads SET 
            notes = CONCAT(COALESCE(notes, ''), '\n[MEETING CANCELED] ', ${meetingName}),
            updated_at = NOW()
          WHERE id = ${lead.id}
        `;

        // Update activity
        await CRM.exec`
          UPDATE activities SET outcome = 'canceled'
          WHERE lead_id = ${lead.id} AND type = 'meeting' AND scheduled_at = ${meetingStart}
        `;

        // Could re-enroll in sequence here if desired
      }
    }

    return { success: true };
  }
);

/**
 * Generate personalized Calendly link with UTM tracking
 */
export const generateTrackingLink = api<{ leadId: string; baseLink: string }, { link: string }>(
  { method: "POST", path: "/calendly/tracking-link", expose: true },
  async (req) => {
    const lead = await CRM.queryRow<{ email: string; name: string }>`
      SELECT email, name FROM leads WHERE id = ${req.leadId}
    `;

    if (!lead) {
      throw new Error("Lead not found");
    }

    // Build URL with tracking params
    const url = new URL(req.baseLink);
    url.searchParams.set("email", lead.email);
    url.searchParams.set("name", lead.name);
    url.searchParams.set("utm_source", "ai_lead_os");
    url.searchParams.set("utm_medium", "outreach");
    url.searchParams.set("utm_campaign", req.leadId);

    return { link: url.toString() };
  }
);

