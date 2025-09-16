import { api } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ProspectClassification } from "../agent/types";
import { validateField, Rules } from "../shared/validation";
import { insertRow } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateProspectData, logSecurityEvent } from "../shared/security";
import { checkAdvancedRateLimit } from "../shared/advanced-rate-limiting";
import { auditDataChange, auditSecurityEvent } from "../audit/logger";

export interface CreateProspectRequest {
  agent_id: number;
  name: string;
  email: string;
  linkedin_profile?: string;
  company?: string;
  position?: string;
  classification: ProspectClassification;
  notes?: string;
  userTier?: string;
  userId?: string;
}

const validClassifications: ProspectClassification[] = ['business_builder', 'product_customer', 'unqualified'];

// Creates a new prospect for Nu Skin outreach.
export const create = api<CreateProspectRequest, Prospect>(
  { expose: true, method: "POST", path: "/prospects" },
  wrapAsync(async (req) => {
    // Advanced rate limiting
    const identifier = req.userId || `agent_${req.agent_id}`;
    await checkAdvancedRateLimit(identifier, "/prospects", "POST", req.userTier || "basic");
    
    // Validate input
    validateField(req.agent_id, "agent_id", [Rules.required(), Rules.positive(), Rules.integer()]);
    validateField(req.name, "name", [Rules.required(), Rules.minLength(2), Rules.maxLength(100)]);
    validateField(req.email, "email", [Rules.required(), Rules.email(), Rules.maxLength(255)]);
    if (req.linkedin_profile) {
      validateField(req.linkedin_profile, "linkedin_profile", [Rules.url(), Rules.maxLength(500)]);
    }
    if (req.company) {
      validateField(req.company, "company", [Rules.maxLength(100)]);
    }
    if (req.position) {
      validateField(req.position, "position", [Rules.maxLength(100)]);
    }
    validateField(req.classification, "classification", [Rules.required(), Rules.oneOf(validClassifications)]);
    if (req.notes) {
      validateField(req.notes, "notes", [Rules.maxLength(1000)]);
    }
    
    // Security validation
    try {
      validateProspectData({
        name: req.name,
        email: req.email,
        linkedin_profile: req.linkedin_profile,
        notes: req.notes
      });
    } catch (error) {
      logSecurityEvent("prospect_validation_failed", {
        agent_id: req.agent_id,
        email: req.email,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      
      await auditSecurityEvent(
        'data_validation_failed',
        false,
        req.userId,
        'prospect',
        'WARN',
        {
          resource_type: 'prospect',
          validation_error: error instanceof Error ? error.message : "Unknown error",
          attempted_data: { name: req.name, email: req.email }
        },
        'Prospect data validation failed'
      );
      
      throw error;
    }
    const result = await insertRow(
      () => prospectDB.queryRow<Prospect>`
        INSERT INTO prospects (
          agent_id, name, email, linkedin_profile, company, position, classification, notes
        ) VALUES (
          ${req.agent_id}, ${req.name}, ${req.email}, ${req.linkedin_profile || null}, 
          ${req.company || null}, ${req.position || null}, ${req.classification}, ${req.notes || null}
        )
        RETURNING *
      `,
      "prospect"
    );
    
    // Audit the prospect creation
    await auditDataChange(
      'create',
      'prospect',
      result.id.toString(),
      null,
      {
        agent_id: req.agent_id,
        name: req.name,
        email: req.email,
        company: req.company,
        position: req.position,
        classification: req.classification
      },
      req.userId,
      'prospect',
      true // Prospect data is compliance relevant
    );
    
    return result;
  })
);
