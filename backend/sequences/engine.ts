// Sequence Engine - Core Logic
// Part of AI Lead OS - TRANSMIT MODULE
import { api } from "encore.dev/api";
import { sequenceDB } from "./db";
import { CRM } from "../ai_crm/db";
import { brevoClient, personalizeContent, generateUnsubscribeLink } from "../integrations/brevo/client";
import { twilioClient, personalizeSMS, appendOptOut, TwilioClient } from "../integrations/twilio/client";
import type {
  Sequence,
  SequenceStep,
  SequenceEnrollment,
  ScheduledSend,
  CreateSequenceRequest,
  EnrollLeadRequest,
  BulkEnrollRequest,
  SequenceSettings,
  SequenceStats,
} from "./types";

const DEFAULT_SETTINGS: SequenceSettings = {
  send_window_start: "09:00",
  send_window_end: "17:00",
  send_days: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: "America/New_York",
  stop_on_reply: true,
  stop_on_meeting_booked: true,
  daily_send_limit: 100,
};

// ============================================
// SEQUENCE CRUD
// ============================================

export const createSequence = api<CreateSequenceRequest, { sequence: Sequence }>(
  { method: "POST", path: "/sequences", expose: true },
  async (req) => {
    const settings = { ...DEFAULT_SETTINGS, ...req.settings };
    
    // Create sequence
    const sequence = await sequenceDB.queryRow<Sequence>`
      INSERT INTO sequences (name, description, settings, status)
      VALUES (${req.name}, ${req.description || null}, ${JSON.stringify(settings)}, 'draft')
      RETURNING *
    `;

    if (!sequence) throw new Error("Failed to create sequence");

    // Create steps
    for (let i = 0; i < req.steps.length; i++) {
      const step = req.steps[i];
      await sequenceDB.exec`
        INSERT INTO sequence_steps (sequence_id, step_order, channel, delay_days, delay_hours, subject, content)
        VALUES (${sequence.id}, ${i + 1}, ${step.channel}, ${step.delay_days}, ${step.delay_hours || 0}, ${step.subject || null}, ${step.content})
      `;
    }

    // Fetch complete sequence with steps
    const fullSequence = await getSequenceById(sequence.id);
    return { sequence: fullSequence };
  }
);

export const listSequences = api<{ status?: string }, { sequences: Sequence[] }>(
  { method: "GET", path: "/sequences", expose: true },
  async (req) => {
    let sequences: Sequence[];
    
    if (req.status) {
      sequences = await sequenceDB.queryAll<Sequence>`
        SELECT * FROM sequences WHERE status = ${req.status} ORDER BY created_at DESC
      `;
    } else {
      sequences = await sequenceDB.queryAll<Sequence>`
        SELECT * FROM sequences ORDER BY created_at DESC
      `;
    }

    return { sequences };
  }
);

export const getSequence = api<{ id: string }, { sequence: Sequence }>(
  { method: "GET", path: "/sequences/:id", expose: true },
  async (req) => {
    const sequence = await getSequenceById(req.id);
    return { sequence };
  }
);

export const activateSequence = api<{ id: string }, { success: boolean }>(
  { method: "POST", path: "/sequences/:id/activate", expose: true },
  async (req) => {
    await sequenceDB.exec`
      UPDATE sequences SET status = 'active', updated_at = NOW() WHERE id = ${req.id}
    `;
    return { success: true };
  }
);

export const pauseSequence = api<{ id: string }, { success: boolean }>(
  { method: "POST", path: "/sequences/:id/pause", expose: true },
  async (req) => {
    await sequenceDB.exec`
      UPDATE sequences SET status = 'paused', updated_at = NOW() WHERE id = ${req.id}
    `;
    return { success: true };
  }
);

// ============================================
// ENROLLMENT
// ============================================

export const enrollLead = api<EnrollLeadRequest, { enrollment: SequenceEnrollment }>(
  { method: "POST", path: "/sequences/enroll", expose: true },
  async (req) => {
    // Check if already enrolled
    const existing = await sequenceDB.queryRow<SequenceEnrollment>`
      SELECT * FROM sequence_enrollments 
      WHERE sequence_id = ${req.sequence_id} AND lead_id = ${req.lead_id}
    `;

    if (existing) {
      throw new Error("Lead is already enrolled in this sequence");
    }

    // Create enrollment
    const enrollment = await sequenceDB.queryRow<SequenceEnrollment>`
      INSERT INTO sequence_enrollments (sequence_id, lead_id, current_step)
      VALUES (${req.sequence_id}, ${req.lead_id}, 0)
      RETURNING *
    `;

    if (!enrollment) throw new Error("Failed to enroll lead");

    // Update sequence stats
    await sequenceDB.exec`
      UPDATE sequences 
      SET stats = jsonb_set(
        jsonb_set(stats, '{total_enrolled}', (COALESCE((stats->>'total_enrolled')::int, 0) + 1)::text::jsonb),
        '{active}', (COALESCE((stats->>'active')::int, 0) + 1)::text::jsonb
      ),
      updated_at = NOW()
      WHERE id = ${req.sequence_id}
    `;

    // Schedule first step if start_immediately
    if (req.start_immediately !== false) {
      await scheduleNextStep(enrollment.id);
    }

    return { enrollment };
  }
);

export const bulkEnroll = api<BulkEnrollRequest, { enrolled: number; skipped: number }>(
  { method: "POST", path: "/sequences/bulk-enroll", expose: true },
  async (req) => {
    let enrolled = 0;
    let skipped = 0;

    for (const leadId of req.lead_ids) {
      try {
        await enrollLead({
          sequence_id: req.sequence_id,
          lead_id: leadId,
          start_immediately: req.start_immediately,
        });
        enrolled++;
      } catch (error) {
        skipped++;
      }
    }

    return { enrolled, skipped };
  }
);

export const unenrollLead = api<{ enrollment_id: string }, { success: boolean }>(
  { method: "POST", path: "/sequences/unenroll/:enrollment_id", expose: true },
  async (req) => {
    // Cancel pending sends
    await sequenceDB.exec`
      UPDATE scheduled_sends SET status = 'cancelled', updated_at = NOW()
      WHERE enrollment_id = ${req.enrollment_id} AND status = 'scheduled'
    `;

    // Update enrollment
    await sequenceDB.exec`
      UPDATE sequence_enrollments 
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${req.enrollment_id}
    `;

    return { success: true };
  }
);

// ============================================
// PROCESSING ENGINE
// ============================================

export const processScheduledSends = api<{}, { processed: number; sent: number; failed: number }>(
  { method: "POST", path: "/sequences/process", expose: true },
  async () => {
    // Get pending sends that are due
    const pendingSends = await sequenceDB.queryAll<ScheduledSend & { step_channel: string }>`
      SELECT ss.*, st.channel as step_channel, st.subject, st.content
      FROM scheduled_sends ss
      JOIN sequence_steps st ON ss.step_id = st.id
      WHERE ss.status = 'scheduled' 
        AND ss.scheduled_for <= NOW()
      ORDER BY ss.scheduled_for ASC
      LIMIT 50
    `;

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const send of pendingSends) {
      processed++;
      
      try {
        // Mark as processing
        await sequenceDB.exec`
          UPDATE scheduled_sends SET status = 'processing', updated_at = NOW()
          WHERE id = ${send.id}
        `;

        // Get lead data
        const lead = await CRM.queryRow<{
          id: string;
          name: string;
          email: string;
          phone: string;
          company: string;
          position: string;
        }>`SELECT id, name, email, phone, company, position FROM leads WHERE id = ${send.lead_id}`;

        if (!lead) {
          throw new Error("Lead not found");
        }

        // Check enrollment is still active
        const enrollment = await sequenceDB.queryRow<SequenceEnrollment>`
          SELECT * FROM sequence_enrollments WHERE id = ${send.enrollment_id}
        `;

        if (!enrollment || enrollment.status !== "active") {
          await sequenceDB.exec`
            UPDATE scheduled_sends SET status = 'cancelled', updated_at = NOW()
            WHERE id = ${send.id}
          `;
          continue;
        }

        // Get step details
        const step = await sequenceDB.queryRow<SequenceStep>`
          SELECT * FROM sequence_steps WHERE id = ${send.step_id}
        `;

        if (!step) throw new Error("Step not found");

        // Personalize content
        const variables = {
          firstName: lead.name.split(" ")[0],
          name: lead.name,
          company: lead.company || "your company",
          position: lead.position || "",
          email: lead.email,
        };

        // Send based on channel
        let messageId: string;
        
        if (step.channel === "email") {
          const personalizedSubject = personalizeContent(step.subject || "Hello {{firstName}}", variables);
          const personalizedContent = personalizeContent(step.content, variables);
          
          const result = await brevoClient.sendEmail({
            to: [{ email: lead.email, name: lead.name }],
            subject: personalizedSubject,
            htmlContent: personalizedContent,
          });
          messageId = result.messageId;
        } else {
          // SMS
          const personalizedContent = personalizeSMS(step.content, variables);
          const finalContent = appendOptOut(personalizedContent);
          
          if (!lead.phone || !TwilioClient.isValidPhoneNumber(lead.phone)) {
            throw new Error("Invalid or missing phone number");
          }
          
          const result = await twilioClient.sendSMS({
            to: lead.phone,
            body: finalContent,
          });
          messageId = result.sid;
        }

        // Log success
        await sequenceDB.exec`
          INSERT INTO send_history (enrollment_id, step_id, lead_id, channel, status, message_id, recipient, subject, content, sent_at)
          VALUES (${send.enrollment_id}, ${send.step_id}, ${send.lead_id}, ${step.channel}, 'sent', ${messageId}, ${step.channel === 'email' ? lead.email : lead.phone}, ${step.subject || null}, ${step.content}, NOW())
        `;

        // Update scheduled send
        await sequenceDB.exec`
          UPDATE scheduled_sends SET status = 'sent', sent_at = NOW(), updated_at = NOW()
          WHERE id = ${send.id}
        `;

        // Update enrollment
        await sequenceDB.exec`
          UPDATE sequence_enrollments 
          SET current_step = current_step + 1, last_activity_at = NOW()
          WHERE id = ${send.enrollment_id}
        `;

        // Schedule next step
        await scheduleNextStep(send.enrollment_id);

        // Update sequence stats
        const statField = step.channel === "email" ? "emails_sent" : "sms_sent";
        await sequenceDB.exec`
          UPDATE sequences 
          SET stats = jsonb_set(stats, ${`{${statField}}`}, (COALESCE((stats->>${statField})::int, 0) + 1)::text::jsonb),
              updated_at = NOW()
          WHERE id = ${enrollment.sequence_id}
        `;

        sent++;
      } catch (error) {
        failed++;
        
        // Log failure
        await sequenceDB.exec`
          UPDATE scheduled_sends 
          SET status = 'failed', last_error = ${(error as Error).message}, attempts = attempts + 1, updated_at = NOW()
          WHERE id = ${send.id}
        `;
      }
    }

    return { processed, sent, failed };
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getSequenceById(id: string): Promise<Sequence> {
  const sequence = await sequenceDB.queryRow<Sequence>`
    SELECT * FROM sequences WHERE id = ${id}
  `;

  if (!sequence) throw new Error("Sequence not found");

  const steps = await sequenceDB.queryAll<SequenceStep>`
    SELECT * FROM sequence_steps WHERE sequence_id = ${id} ORDER BY step_order ASC
  `;

  return {
    ...sequence,
    steps,
    settings: typeof sequence.settings === 'string' ? JSON.parse(sequence.settings) : sequence.settings,
    stats: typeof sequence.stats === 'string' ? JSON.parse(sequence.stats) : sequence.stats,
  };
}

async function scheduleNextStep(enrollmentId: string): Promise<void> {
  const enrollment = await sequenceDB.queryRow<SequenceEnrollment>`
    SELECT * FROM sequence_enrollments WHERE id = ${enrollmentId}
  `;

  if (!enrollment || enrollment.status !== "active") return;

  // Get next step
  const nextStep = await sequenceDB.queryRow<SequenceStep>`
    SELECT * FROM sequence_steps 
    WHERE sequence_id = ${enrollment.sequence_id} 
      AND step_order = ${enrollment.current_step + 1}
      AND is_active = true
  `;

  if (!nextStep) {
    // No more steps - complete the enrollment
    await sequenceDB.exec`
      UPDATE sequence_enrollments 
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${enrollmentId}
    `;
    
    // Update sequence stats
    await sequenceDB.exec`
      UPDATE sequences 
      SET stats = jsonb_set(
        jsonb_set(stats, '{completed}', (COALESCE((stats->>'completed')::int, 0) + 1)::text::jsonb),
        '{active}', (GREATEST(COALESCE((stats->>'active')::int, 0) - 1, 0))::text::jsonb
      )
      WHERE id = ${enrollment.sequence_id}
    `;
    return;
  }

  // Calculate scheduled time
  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + nextStep.delay_days);
  scheduledFor.setHours(scheduledFor.getHours() + nextStep.delay_hours);

  // Create scheduled send
  await sequenceDB.exec`
    INSERT INTO scheduled_sends (enrollment_id, step_id, lead_id, channel, scheduled_for)
    VALUES (${enrollmentId}, ${nextStep.id}, ${enrollment.lead_id}, ${nextStep.channel}, ${scheduledFor})
  `;
}

// ============================================
// RESPONSE HANDLING
// ============================================

export const handleReply = api<{ lead_id: string; channel: string; content?: string }, { success: boolean }>(
  { method: "POST", path: "/sequences/handle-reply", expose: true },
  async (req) => {
    // Find active enrollment for this lead
    const enrollment = await sequenceDB.queryRow<SequenceEnrollment>`
      SELECT * FROM sequence_enrollments 
      WHERE lead_id = ${req.lead_id} AND status = 'active'
      ORDER BY enrolled_at DESC
      LIMIT 1
    `;

    if (!enrollment) {
      return { success: false };
    }

    // Cancel pending sends
    await sequenceDB.exec`
      UPDATE scheduled_sends SET status = 'cancelled', updated_at = NOW()
      WHERE enrollment_id = ${enrollment.id} AND status = 'scheduled'
    `;

    // Update enrollment status
    await sequenceDB.exec`
      UPDATE sequence_enrollments 
      SET status = 'replied', last_activity_at = NOW()
      WHERE id = ${enrollment.id}
    `;

    // Update sequence stats
    const statField = req.channel === "email" ? "replied" : "sms_replied";
    await sequenceDB.exec`
      UPDATE sequences 
      SET stats = jsonb_set(
        jsonb_set(stats, '{active}', (GREATEST(COALESCE((stats->>'active')::int, 0) - 1, 0))::text::jsonb),
        ${`{${statField}}`}, (COALESCE((stats->>${statField})::int, 0) + 1)::text::jsonb
      )
      WHERE id = ${enrollment.sequence_id}
    `;

    // Update lead status
    await CRM.exec`
      UPDATE leads SET status = 'contacted', last_activity_at = NOW(), updated_at = NOW()
      WHERE id = ${req.lead_id}
    `;

    return { success: true };
  }
);
