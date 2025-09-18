import { api } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect } from "../client/types";
import type { ProspectType } from "../client/types";
import { validateField, Rules } from "../shared/validation";
import { insertRow, executeQuery } from "../shared/database";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { validateProspectData, logSecurityEvent } from "../shared/security";
import { withEnhancedRateLimit } from "../shared/simple-rate-limiting";
import { auditDataChange, auditSecurityEvent } from "../audit/logger";
import { retryWithAdaptiveBackoff } from "../shared/intelligent-backoff";
import { Header } from "encore.dev/api";

export interface CreateProspectRequest {
  agent_id: number;
  name: string;
  email: string;
  linkedin_profile?: string;
  company?: string;
  position?: string;
  prospect_type: ProspectType;
  custom_prospect_type?: string;
  notes?: string;
  userTier?: string;
  userId?: string;
}

const validProspectTypes: ProspectType[] = [
  'customer', 'distributor', 'business_builder', 'recruits', 
  'leads', 'referrals', 'partners', 'clients', 'custom'
];

// Creates a new prospect for outreach.
export const create = api(
  { expose: true, method: "POST", path: "/prospects" },
  wrapAsync(async (
    req: CreateProspectRequest,
    userAgent?: Header<"user-agent">,
    forwardedFor?: Header<"x-forwarded-for">
  ) => {
    // Enhanced rate limiting with intelligent backoff
    await withEnhancedRateLimit({
      identifier: req.userId || `agent_${req.agent_id}`,
      endpoint: "/prospects",
      method: "POST",
      userTier: req.userTier || "basic",
      userId: req.userId
    }, userAgent, forwardedFor);
    
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
    validateField(req.prospect_type, "prospect_type", [Rules.required(), Rules.oneOf(validProspectTypes)]);
    if (req.custom_prospect_type) {
      validateField(req.custom_prospect_type, "custom_prospect_type", [Rules.maxLength(100)]);
    }
    if (req.notes) {
      validateField(req.notes, "notes", [Rules.maxLength(1000)]);
    }
    
    // Get agent and client information
    const agent = await executeQuery(
      () => prospectDB.queryRow<{ client_id: number }>`
        SELECT client_id FROM agents WHERE id = ${req.agent_id}
      `,
      "get agent client"
    );
    
    if (!agent) {
      throw new BusinessLogicError("Agent not found");
    }
    
    // Verify the prospect type is allowed for this client
    const clientConfig = await executeQuery(
      () => prospectDB.queryRow<{ enabled_prospect_types: string[] }>`
        SELECT enabled_prospect_types FROM client_configurations 
        WHERE id = ${agent.client_id} AND is_active = true
      `,
      "get client config"
    );
    
    if (!clientConfig) {
      throw new BusinessLogicError("Client configuration not found or inactive");
    }
    
    // Check if prospect type is enabled for this client
    const enabledTypes = clientConfig.enabled_prospect_types;
    if (!enabledTypes.includes(req.prospect_type)) {
      throw new BusinessLogicError(`Prospect type '${req.prospect_type}' is not enabled for this client`);
    }
    
    // If using custom type, verify it's allowed
    if (req.prospect_type === 'custom' && !req.custom_prospect_type) {
      throw new BusinessLogicError("Custom prospect type name is required when using 'custom' type");
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
    const result = await retryWithAdaptiveBackoff(
      () => insertRow(
        () => prospectDB.queryRow<Prospect>`
          INSERT INTO prospects (
            agent_id, client_id, name, email, linkedin_profile, company, position, 
            prospect_type, custom_prospect_type, notes
          ) VALUES (
            ${req.agent_id}, ${agent.client_id}, ${req.name}, ${req.email}, 
            ${req.linkedin_profile || null}, ${req.company || null}, ${req.position || null}, 
            ${req.prospect_type}, ${req.custom_prospect_type || null}, ${req.notes || null}
          )
          RETURNING *
        `,
        "prospect"
      ),
      "/prospects",
      "POST",
      { userId: req.userId, requestId: `prospect_${Date.now()}` }
    );
    
    // Audit the prospect creation
    await auditDataChange(
      'create',
      'prospect',
      result.id.toString(),
      null,
      {
        agent_id: req.agent_id,
        client_id: agent.client_id,
        name: req.name,
        email: req.email,
        company: req.company,
        position: req.position,
        prospect_type: req.prospect_type,
        custom_prospect_type: req.custom_prospect_type
      },
      req.userId,
      'prospect',
      true // Prospect data is compliance relevant
    );
    
    return result;
  })
);
