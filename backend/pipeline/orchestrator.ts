// AI Lead OS Pipeline Orchestrator
// THE MASTER CONTROL - Ties everything together
import { api } from "encore.dev/api";
import { CRM } from "../ai_crm/db";
import { sequenceDB } from "../sequences/db";
import { apolloClient } from "../integrations/apollo/client";
import { scoreLead, bulkScoreLeads } from "../qualification/scorer";
import { enrollLead, bulkEnroll, processScheduledSends } from "../sequences/engine";
import { getBookingLink } from "../integrations/calendly/client";
import log from "encore.dev/log";

// ============================================
// PIPELINE: PROSPECT → QUALIFY → SEQUENCE → MEETING
// ============================================

export interface ProspectSearchRequest {
  // Apollo search criteria
  keywords?: string;
  titles?: string[];
  seniorities?: string[];
  industries?: string[];
  employeeCounts?: string[];
  
  // AI Lead OS settings
  autoQualify?: boolean;
  autoEnrollSequence?: string; // Sequence ID to auto-enroll qualified leads
  minQualificationScore?: number; // Auto-enroll only if score >= this
  limit?: number;
}

export interface ProspectSearchResult {
  found: number;
  imported: number;
  qualified: number;
  enrolled: number;
  leads: Array<{
    id: string;
    name: string;
    email: string;
    score?: number;
    qualification?: string;
    enrolled?: boolean;
  }>;
}

/**
 * FULL PIPELINE: Search → Import → Qualify → Enroll
 * This is the main entry point for the AI Lead OS
 */
export const runProspectPipeline = api<ProspectSearchRequest, ProspectSearchResult>(
  { method: "POST", path: "/pipeline/prospect", expose: true },
  async (req) => {
    log.info("🚀 Starting AI Lead OS Pipeline", { criteria: req });
    
    const result: ProspectSearchResult = {
      found: 0,
      imported: 0,
      qualified: 0,
      enrolled: 0,
      leads: [],
    };

    // STEP 1: PROBE - Search Apollo for prospects
    log.info("📡 PROBE: Searching Apollo.io...");
    
    let apolloPeople: any[] = [];
    try {
      const apolloResponse = await apolloClient.searchPeople({
        q_keywords: req.keywords,
        person_titles: req.titles,
        person_seniorities: req.seniorities,
        organization_industries: req.industries,
        organization_employee_counts: req.employeeCounts,
        per_page: req.limit || 25,
      });
      
      apolloPeople = apolloResponse.people || [];
      result.found = apolloResponse.pagination?.total_entries || apolloPeople.length;
      log.info(`Found ${result.found} prospects`);
    } catch (error) {
      log.warn("Apollo search failed, continuing with empty results:", error);
    }

    // STEP 2: ABSORB - Import to CRM
    log.info("💾 ABSORB: Importing to CRM...");
    
    const importedLeads: any[] = [];
    
    for (const person of apolloPeople) {
      if (!person.email) continue; // Skip without email
      
      try {
        // Check if lead already exists
        const existing = await CRM.queryRow<{ id: string }>`
          SELECT id FROM leads WHERE email = ${person.email}
        `;
        
        if (existing) {
          importedLeads.push({ id: existing.id, existing: true });
          continue;
        }

        // Create new lead
        const lead = await CRM.queryRow<{ id: string; name: string; email: string }>`
          INSERT INTO leads (name, email, phone, company, position, source, linkedin_profile, notes)
          VALUES (
            ${`${person.first_name} ${person.last_name}`},
            ${person.email},
            ${person.phone_numbers?.[0]?.number || null},
            ${person.company?.name || null},
            ${person.title || null},
            'apollo',
            ${person.linkedin_url || null},
            ${`Industry: ${person.company?.industry || 'N/A'}, Size: ${person.company?.employee_range || 'N/A'}`}
          )
          RETURNING id, name, email
        `;
        
        if (lead) {
          importedLeads.push({ ...lead, existing: false });
          result.imported++;
        }
      } catch (error) {
        log.warn(`Failed to import ${person.email}:`, error);
      }
    }

    // STEP 3: BRAIN - Qualify leads
    if (req.autoQualify !== false) {
      log.info("🧠 BRAIN: Qualifying leads...");
      
      const newLeadIds = importedLeads
        .filter(l => !l.existing)
        .map(l => l.id);
      
      if (newLeadIds.length > 0) {
        try {
          const { results } = await bulkScoreLeads({ leadIds: newLeadIds });
          
          for (const leadId of newLeadIds) {
            const score = results[leadId];
            if (score) {
              const lead = importedLeads.find(l => l.id === leadId);
              if (lead) {
                lead.score = score.score;
                lead.qualification = score.qualification;
              }
              
              if (score.qualification === 'hot' || score.qualification === 'warm') {
                result.qualified++;
              }
            }
          }
        } catch (error) {
          log.warn("Qualification failed:", error);
        }
      }
    }

    // STEP 4: TRANSMIT - Auto-enroll in sequence
    if (req.autoEnrollSequence) {
      log.info("📤 TRANSMIT: Enrolling qualified leads in sequence...");
      
      const minScore = req.minQualificationScore || 50;
      const leadsToEnroll = importedLeads
        .filter(l => !l.existing && l.score && l.score >= minScore)
        .map(l => l.id);
      
      if (leadsToEnroll.length > 0) {
        try {
          const { enrolled } = await bulkEnroll({
            sequence_id: req.autoEnrollSequence,
            lead_ids: leadsToEnroll,
            start_immediately: true,
          });
          
          result.enrolled = enrolled;
          
          // Mark enrolled leads
          for (const leadId of leadsToEnroll) {
            const lead = importedLeads.find(l => l.id === leadId);
            if (lead) lead.enrolled = true;
          }
        } catch (error) {
          log.warn("Enrollment failed:", error);
        }
      }
    }

    // Compile results
    result.leads = importedLeads.map(l => ({
      id: l.id,
      name: l.name,
      email: l.email,
      score: l.score,
      qualification: l.qualification,
      enrolled: l.enrolled,
    }));

    log.info("✅ Pipeline complete!", {
      found: result.found,
      imported: result.imported,
      qualified: result.qualified,
      enrolled: result.enrolled,
    });

    return result;
  }
);

/**
 * Process all pending sends in sequences
 * Should be called on a schedule (e.g., every 5 minutes)
 */
export const runSendProcessor = api<{}, { processed: number; sent: number; failed: number }>(
  { method: "POST", path: "/pipeline/process-sends", expose: true },
  async () => {
    log.info("⏰ Running send processor...");
    return processScheduledSends({});
  }
);

/**
 * Get pipeline health/status
 */
export const getPipelineStatus = api<{}, { status: any }>(
  { method: "GET", path: "/pipeline/status", expose: true },
  async () => {
    // Get lead stats
    const leadStats = await CRM.queryRow<{
      total: number;
      hot: number;
      warm: number;
      cold: number;
    }>`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ai_qualification = 'hot') as hot,
        COUNT(*) FILTER (WHERE ai_qualification = 'warm') as warm,
        COUNT(*) FILTER (WHERE ai_qualification = 'cold') as cold
      FROM leads
    `;

    // Get sequence stats
    const sequenceStats = await sequenceDB.queryRow<{
      total_sequences: number;
      active_sequences: number;
      total_enrollments: number;
      active_enrollments: number;
    }>`
      SELECT 
        (SELECT COUNT(*) FROM sequences) as total_sequences,
        (SELECT COUNT(*) FROM sequences WHERE status = 'active') as active_sequences,
        (SELECT COUNT(*) FROM sequence_enrollments) as total_enrollments,
        (SELECT COUNT(*) FROM sequence_enrollments WHERE status = 'active') as active_enrollments
    `;

    // Get pending sends
    const pendingSends = await sequenceDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM scheduled_sends WHERE status = 'scheduled'
    `;

    // Get today's activity
    const todayStats = await sequenceDB.queryRow<{
      sent_today: number;
      opens_today: number;
      replies_today: number;
    }>`
      SELECT 
        COUNT(*) FILTER (WHERE sent_at > CURRENT_DATE) as sent_today,
        COUNT(*) FILTER (WHERE opened_at > CURRENT_DATE) as opens_today,
        COUNT(*) FILTER (WHERE replied_at > CURRENT_DATE) as replies_today
      FROM send_history
    `;

    let calendlyLink = "Not configured";
    try {
      const { link } = await getBookingLink({});
      calendlyLink = link;
    } catch {}

    return {
      status: {
        health: "operational",
        timestamp: new Date().toISOString(),
        leads: leadStats,
        sequences: sequenceStats,
        pending_sends: pendingSends?.count || 0,
        today: todayStats,
        calendly_link: calendlyLink,
      },
    };
  }
);

/**
 * Quick action: Create and start a sequence in one call
 */
export const quickStartSequence = api<{
  name: string;
  steps: Array<{
    channel: "email" | "sms";
    delay_days: number;
    subject?: string;
    content: string;
  }>;
  leadIds: string[];
}, { sequenceId: string; enrolled: number }>(
  { method: "POST", path: "/pipeline/quick-start", expose: true },
  async (req) => {
    // Create sequence
    const sequence = await sequenceDB.queryRow<{ id: string }>`
      INSERT INTO sequences (name, status, settings)
      VALUES (${req.name}, 'active', ${{
        send_window_start: "09:00",
        send_window_end: "17:00",
        send_days: [1, 2, 3, 4, 5],
        timezone: "America/New_York",
        stop_on_reply: true,
        stop_on_meeting_booked: true,
        daily_send_limit: 100,
      }})
      RETURNING id
    `;

    if (!sequence) throw new Error("Failed to create sequence");

    // Add steps
    for (let i = 0; i < req.steps.length; i++) {
      const step = req.steps[i];
      await sequenceDB.exec`
        INSERT INTO sequence_steps (sequence_id, step_order, channel, delay_days, subject, content)
        VALUES (${sequence.id}, ${i + 1}, ${step.channel}, ${step.delay_days}, ${step.subject || null}, ${step.content})
      `;
    }

    // Enroll leads
    const { enrolled } = await bulkEnroll({
      sequence_id: sequence.id,
      lead_ids: req.leadIds,
      start_immediately: true,
    });

    return { sequenceId: sequence.id, enrolled };
  }
);

/**
 * Dashboard: Get complete pipeline overview
 */
export const getPipelineDashboard = api<{}, { dashboard: any }>(
  { method: "GET", path: "/pipeline/dashboard", expose: true },
  async () => {
    // Recent leads
    const recentLeads = await CRM.queryAll<{
      id: string;
      name: string;
      email: string;
      company: string;
      ai_score: number;
      ai_qualification: string;
      status: string;
      created_at: Date;
    }>`
      SELECT id, name, email, company, ai_score, ai_qualification, status, created_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Active sequences
    const activeSequences = await sequenceDB.queryAll<{
      id: string;
      name: string;
      status: string;
      stats: any;
    }>`
      SELECT id, name, status, stats
      FROM sequences
      WHERE status = 'active'
      ORDER BY updated_at DESC
      LIMIT 5
    `;

    // Recent replies
    const recentReplies = await sequenceDB.queryAll<{
      lead_id: string;
      channel: string;
      replied_at: Date;
    }>`
      SELECT lead_id, channel, replied_at
      FROM send_history
      WHERE replied_at IS NOT NULL
      ORDER BY replied_at DESC
      LIMIT 5
    `;

    // Get pipeline status
    const { status } = await getPipelineStatus({});

    return {
      dashboard: {
        ...status,
        recent_leads: recentLeads,
        active_sequences: activeSequences,
        recent_replies: recentReplies,
      },
    };
  }
);

