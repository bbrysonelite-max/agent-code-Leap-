// Apollo.io Search & Sync Service
import { api } from "encore.dev/api";
import { ApolloClient, apolloToProspect } from "./client";
import type { ApolloSearchFilters, ProspectFromApollo } from "./types";
import { CRM } from "../../ai_crm/db";

export interface SearchProspectsRequest {
  // Who to find
  titles?: string[];
  seniorities?: string[];
  
  // Company criteria
  industries?: string[];
  companySize?: {
    min?: number;
    max?: number;
  };
  locations?: string[];
  
  // Requirements
  requireEmail?: boolean;
  requirePhone?: boolean;
  
  // Pagination
  limit?: number;
  page?: number;
  
  // Auto-import to CRM
  autoImport?: boolean;
}

export interface SearchProspectsResponse {
  prospects: ProspectFromApollo[];
  total: number;
  page: number;
  totalPages: number;
  imported?: number;
}

/**
 * Search Apollo for prospects matching criteria
 */
export const searchProspects = api<SearchProspectsRequest, SearchProspectsResponse>(
  { method: "POST", path: "/apollo/search", expose: true },
  async (req) => {
    const client = new ApolloClient();
    
    // Build Apollo filters
    const filters: ApolloSearchFilters = {
      page: req.page || 1,
      per_page: req.limit || 25,
    };

    // Person filters
    if (req.titles?.length) {
      filters.person_titles = req.titles;
    }
    if (req.seniorities?.length) {
      filters.person_seniorities = req.seniorities;
    }

    // Company filters
    if (req.industries?.length) {
      filters.organization_industry_tag_ids = req.industries;
    }
    if (req.locations?.length) {
      filters.organization_locations = req.locations;
    }

    // Company size mapping
    if (req.companySize) {
      const sizeRanges: string[] = [];
      const min = req.companySize.min || 0;
      const max = req.companySize.max || 10000;
      
      if (min <= 10 && max >= 1) sizeRanges.push("1,10");
      if (min <= 50 && max >= 11) sizeRanges.push("11,50");
      if (min <= 200 && max >= 51) sizeRanges.push("51,200");
      if (min <= 500 && max >= 201) sizeRanges.push("201,500");
      if (min <= 1000 && max >= 501) sizeRanges.push("501,1000");
      if (max > 1000) sizeRanges.push("1001,5000");
      
      if (sizeRanges.length) {
        filters.organization_num_employees_ranges = sizeRanges;
      }
    }

    // Email/phone requirements
    if (req.requireEmail !== false) {
      filters.contact_email_status = ["verified", "guessed"];
    }
    if (req.requirePhone) {
      filters.has_phone = true;
    }

    // Execute search
    const response = await client.searchPeople(filters);
    
    // Convert to our format
    const prospects = response.people.map(apolloToProspect);

    // Auto-import if requested
    let imported = 0;
    if (req.autoImport && prospects.length > 0) {
      imported = await importProspectsToLeads(prospects);
    }

    return {
      prospects,
      total: response.pagination.total_entries,
      page: response.pagination.page,
      totalPages: response.pagination.total_pages,
      imported,
    };
  }
);

/**
 * Import Apollo prospects into our leads table
 */
async function importProspectsToLeads(prospects: ProspectFromApollo[]): Promise<number> {
  let imported = 0;

  for (const prospect of prospects) {
    try {
      // Check if already exists
      const existing = await CRM.queryRow`
        SELECT id FROM leads WHERE email = ${prospect.email}
      `;

      if (existing) {
        console.log(`Skipping duplicate: ${prospect.email}`);
        continue;
      }

      // Insert as lead
      await CRM.exec`
        INSERT INTO leads (
          name, email, phone, company, position, source,
          linkedin_profile, notes, priority
        ) VALUES (
          ${prospect.name},
          ${prospect.email},
          ${prospect.phone},
          ${prospect.company},
          ${prospect.title},
          'apollo',
          ${prospect.linkedinUrl},
          ${`Imported from Apollo. Industry: ${prospect.industry || 'N/A'}. Company Size: ${prospect.companySize || 'N/A'}`},
          'medium'
        )
      `;
      
      imported++;
    } catch (error) {
      console.error(`Error importing prospect ${prospect.email}:`, error);
    }
  }

  return imported;
}

/**
 * Quick search with common presets
 */
export interface QuickSearchRequest {
  preset: "decision_makers" | "founders" | "sales_leaders" | "marketing_leaders";
  industry?: string;
  location?: string;
  limit?: number;
  autoImport?: boolean;
}

export const quickSearch = api<QuickSearchRequest, SearchProspectsResponse>(
  { method: "POST", path: "/apollo/quick-search", expose: true },
  async (req) => {
    const presets: Record<string, Partial<SearchProspectsRequest>> = {
      decision_makers: {
        titles: ["CEO", "Founder", "Owner", "President", "Managing Director"],
        seniorities: ["owner", "founder", "c_suite"],
        companySize: { min: 10, max: 500 },
      },
      founders: {
        titles: ["Founder", "Co-Founder", "CEO", "Owner"],
        seniorities: ["owner", "founder"],
        companySize: { min: 1, max: 200 },
      },
      sales_leaders: {
        titles: ["VP Sales", "Head of Sales", "Sales Director", "CRO", "Chief Revenue Officer"],
        seniorities: ["vp", "director", "c_suite"],
        companySize: { min: 50, max: 1000 },
      },
      marketing_leaders: {
        titles: ["VP Marketing", "Head of Marketing", "CMO", "Marketing Director"],
        seniorities: ["vp", "director", "c_suite"],
        companySize: { min: 50, max: 1000 },
      },
    };

    const preset = presets[req.preset];
    if (!preset) {
      throw new Error(`Unknown preset: ${req.preset}`);
    }

    return searchProspects({
      ...preset,
      industries: req.industry ? [req.industry] : undefined,
      locations: req.location ? [req.location] : undefined,
      limit: req.limit || 25,
      requireEmail: true,
      requirePhone: true,
      autoImport: req.autoImport,
    });
  }
);

/**
 * Enrich existing lead with Apollo data
 */
export interface EnrichLeadRequest {
  leadId: string;
}

export interface EnrichLeadResponse {
  success: boolean;
  enriched: boolean;
  data?: ProspectFromApollo;
}

export const enrichLead = api<EnrichLeadRequest, EnrichLeadResponse>(
  { method: "POST", path: "/apollo/enrich/:leadId", expose: true },
  async (req) => {
    // Get lead email
    const lead = await CRM.queryRow<{ email: string; phone: string | null }>`
      SELECT email, phone FROM leads WHERE id = ${req.leadId}
    `;

    if (!lead) {
      throw new Error("Lead not found");
    }

    const client = new ApolloClient();
    const result = await client.enrichPerson(lead.email);

    if (!result?.person) {
      return { success: true, enriched: false };
    }

    const enrichedData = apolloToProspect(result.person);

    // Update lead with enriched data
    await CRM.exec`
      UPDATE leads SET
        phone = COALESCE(${enrichedData.phone}, phone),
        company = COALESCE(${enrichedData.company}, company),
        position = COALESCE(${enrichedData.title}, position),
        linkedin_profile = COALESCE(${enrichedData.linkedinUrl}, linkedin_profile),
        notes = CONCAT(COALESCE(notes, ''), '\n\nEnriched via Apollo: ', ${JSON.stringify(enrichedData)}),
        updated_at = NOW()
      WHERE id = ${req.leadId}
    `;

    return {
      success: true,
      enriched: true,
      data: enrichedData,
    };
  }
);

