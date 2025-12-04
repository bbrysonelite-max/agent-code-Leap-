import { api } from "encore.dev/api";
import { CRM } from "./db";
import type { Lead, Contact, CreateLeadRequest, CreateContactRequest } from "./types";

export const syncProspectToLead = api(
  { method: "POST", path: "/ai-crm/integrations/prospect-to-lead", expose: true },
  async ({ prospectId }: { prospectId: number }): Promise<Lead> => {
    const prospectQuery = `
      SELECT * FROM prospects WHERE id = $1
    `;
    
    // This would typically use the shared database or make a service call
    // For now, we'll create a placeholder implementation
    const prospect = await CRM.rawQueryRow(prospectQuery, prospectId);
    
    if (!prospect) {
      throw new Error("Prospect not found");
    }

    const leadData: CreateLeadRequest = {
      name: prospect.name,
      email: prospect.email,
      phone: prospect.phone || undefined,
      company: prospect.company || undefined,
      position: prospect.position || undefined,
      source: 'import',
      linkedin_profile: prospect.linkedin_profile || undefined,
      notes: prospect.notes || undefined
    };

    const lead = await CRM.queryRow`
      INSERT INTO leads (
        name, email, phone, company, position, source, 
        linkedin_profile, notes
      ) VALUES (
        ${leadData.name}, ${leadData.email}, ${leadData.phone || null}, 
        ${leadData.company || null}, ${leadData.position || null}, ${leadData.source},
        ${leadData.linkedin_profile || null}, ${leadData.notes || null}
      )
      RETURNING *
    `;

    // Note: Auto-scoring disabled - should be handled via background job
    // TODO: Implement proper background job for lead scoring

    return lead as Lead;
  }
);

export const convertLeadToContact = api(
  { method: "POST", path: "/ai-crm/integrations/lead-to-contact", expose: true },
  async ({ leadId }: { leadId: string }): Promise<Contact> => {
    const lead = await CRM.queryRow`
      SELECT * FROM leads WHERE id = ${leadId}
    ` as Lead;

    if (!lead) {
      throw new Error("Lead not found");
    }

    const contactData: CreateContactRequest = {
      lead_id: leadId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone || undefined,
      company: lead.company || undefined,
      position: lead.position || undefined,
      type: 'prospect',
      linkedin_profile: lead.linkedin_profile || undefined,
      website: lead.website || undefined
    };

    const contact = await CRM.queryRow`
      INSERT INTO contacts (
        lead_id, name, email, phone, company, position, type,
        linkedin_profile, website
      ) VALUES (
        ${contactData.lead_id}, ${contactData.name}, ${contactData.email}, 
        ${contactData.phone || null}, ${contactData.company || null}, 
        ${contactData.position || null}, ${contactData.type},
        ${contactData.linkedin_profile || null}, ${contactData.website || null}
      )
      RETURNING *
    `;

    // Update lead status to converted
    await CRM.exec`
      UPDATE leads 
      SET status = 'converted', updated_at = NOW()
      WHERE id = ${leadId}
    `;

    return contact as Contact;
  }
);

export const syncEmailCampaignActivity = api(
  { method: "POST", path: "/ai-crm/integrations/email-campaign-activity", expose: true },
  async ({ 
    campaignId, 
    prospectId, 
    leadId, 
    contactId,
    activityType, 
    subject, 
    body,
    sentAt,
    openedAt,
    clickedAt,
    repliedAt 
  }: {
    campaignId: number;
    prospectId?: number;
    leadId?: string;
    contactId?: string;
    activityType: 'email';
    subject: string;
    body: string;
    sentAt?: Date;
    openedAt?: Date;
    clickedAt?: Date;
    repliedAt?: Date;
  }) => {
    // Create activity record for email campaign
    const activity = await CRM.queryRow`
      INSERT INTO activities (
        contact_id, lead_id, type, subject, description,
        completed_at, created_at
      ) VALUES (
        ${contactId || null}, ${leadId || null}, ${activityType}, 
        ${subject}, ${body}, ${sentAt || new Date()}, ${sentAt || new Date()}
      )
      RETURNING *
    `;

    // Track engagement activities
    if (openedAt) {
      await CRM.queryRow`
        INSERT INTO activities (
          contact_id, lead_id, type, subject, description, completed_at
        ) VALUES (
          ${contactId || null}, ${leadId || null}, 'email', 
          'Email Opened: ${subject}', 'Email was opened by recipient', ${openedAt}
        )
      `;
    }

    if (clickedAt) {
      await CRM.queryRow`
        INSERT INTO activities (
          contact_id, lead_id, type, subject, description, completed_at
        ) VALUES (
          ${contactId || null}, ${leadId || null}, 'email', 
          'Email Clicked: ${subject}', 'Email links were clicked by recipient', ${clickedAt}
        )
      `;
    }

    if (repliedAt) {
      await CRM.queryRow`
        INSERT INTO activities (
          contact_id, lead_id, type, subject, description, completed_at
        ) VALUES (
          ${contactId || null}, ${leadId || null}, 'email', 
          'Email Reply: ${subject}', 'Recipient replied to email', ${repliedAt}
        )
      `;
    }

    // Update lead/contact last activity
    if (leadId) {
      await CRM.exec`
        UPDATE leads 
        SET last_activity_at = ${repliedAt || clickedAt || openedAt || sentAt || new Date()},
            updated_at = NOW()
        WHERE id = ${leadId}
      `;
    }

    if (contactId) {
      await CRM.exec`
        UPDATE contacts 
        SET last_interaction_at = ${repliedAt || clickedAt || openedAt || sentAt || new Date()},
            updated_at = NOW()
        WHERE id = ${contactId}
      `;
    }

    return activity;
  }
);

export const bulkImportProspects = api(
  { method: "POST", path: "/ai-crm/integrations/bulk-import-prospects", expose: true },
  async ({ prospects }: { prospects: any[] }): Promise<{ imported: number; errors: number; leads: Lead[] }> => {
    let imported = 0;
    let errors = 0;
    const leads: Lead[] = [];

    for (const prospect of prospects) {
      try {
        const leadData: CreateLeadRequest = {
          name: prospect.name,
          email: prospect.email,
          phone: prospect.phone || undefined,
          company: prospect.company || undefined,
          position: prospect.position || undefined,
          source: 'import',
          linkedin_profile: prospect.linkedin_profile || undefined,
          notes: prospect.notes || undefined
        };

        const lead = await CRM.queryRow`
          INSERT INTO leads (
            name, email, phone, company, position, source, 
            linkedin_profile, notes
          ) VALUES (
            ${leadData.name}, ${leadData.email}, ${leadData.phone || null}, 
            ${leadData.company || null}, ${leadData.position || null}, ${leadData.source},
            ${leadData.linkedin_profile || null}, ${leadData.notes || null}
          )
          RETURNING *
        `;

        leads.push(lead as Lead);
        imported++;
      } catch (error) {
        console.error(`Error importing prospect ${prospect.email}:`, error);
        errors++;
      }
    }

    // Note: Bulk scoring disabled - should be handled via background job
    // TODO: Implement proper background job for bulk lead scoring

    return { imported, errors, leads };
  }
);

export const getProspectLeadMapping = api(
  { method: "GET", path: "/ai-crm/integrations/prospect-lead-mapping", expose: true },
  async ({ prospectId }: { prospectId?: number }) => {
    let query = `
      SELECT 
        l.*,
        'prospect' as source_type,
        NULL as prospect_id
      FROM leads l
      WHERE l.source = 'import'
    `;

    const params: any[] = [];
    
    if (prospectId) {
      // This would be a more complex query joining with the prospects table
      query += ` AND l.notes LIKE '%prospect_id:${prospectId}%'`;
    }

    query += ` ORDER BY l.created_at DESC`;

    const mappings = await CRM.rawQueryAll(query, ...params);
    return mappings;
  }
);

export const syncLeadScore = api(
  { method: "POST", path: "/ai-crm/integrations/sync-lead-score", expose: true },
  async ({ leadId, externalScore, scoreSource }: { 
    leadId: string; 
    externalScore: number; 
    scoreSource: string; 
  }) => {
    // Get current AI score
    const lead = await CRM.queryRow`
      SELECT ai_score FROM leads WHERE id = ${leadId}
    ` as { ai_score: number };

    if (!lead) {
      throw new Error("Lead not found");
    }

    // Create a weighted average between AI score and external score
    const weightedScore = Math.round((lead.ai_score * 0.7) + (externalScore * 0.3));

    await CRM.exec`
      UPDATE leads 
      SET 
        ai_score = ${weightedScore},
        notes = COALESCE(notes, '') || E'\n\nExternal Score (${scoreSource}): ${externalScore}',
        updated_at = NOW()
      WHERE id = ${leadId}
    `;

    return { 
      previous_score: lead.ai_score, 
      external_score: externalScore, 
      new_score: weightedScore 
    };
  }
);

export const getIntegrationStats = api(
  { method: "GET", path: "/ai-crm/integrations/stats", expose: true },
  async ({ days = 30 }: { days?: number }) => {
    const [leadsFromProspects, contactsFromLeads, emailActivities] = await Promise.all([
      CRM.queryRow`
        SELECT COUNT(*) as count 
        FROM leads 
        WHERE source = 'import' 
          AND created_at >= NOW() - INTERVAL '${days} days'
      `,
      CRM.queryRow`
        SELECT COUNT(*) as count 
        FROM contacts 
        WHERE lead_id IS NOT NULL 
          AND created_at >= NOW() - INTERVAL '${days} days'
      `,
      CRM.queryRow`
        SELECT COUNT(*) as count 
        FROM activities 
        WHERE type = 'email' 
          AND created_at >= NOW() - INTERVAL '${days} days'
      `
    ]);

    return {
      leads_from_prospects: leadsFromProspects?.count || 0,
      contacts_from_leads: contactsFromLeads?.count || 0,
      email_activities: emailActivities?.count || 0,
      period_days: days
    };
  }
);