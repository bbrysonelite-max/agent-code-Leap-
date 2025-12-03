import { api } from "encore.dev/api";
import { clientDB } from "./db";
import type { ClientConfiguration, UpdateClientRequest } from "./types";
import { validateField, Rules } from "../shared/validation";
import { executeQuery } from "../shared/database";
import { wrapAsync, NotFoundError } from "../shared/errors";

const validBusinessTypes = [
  'network_marketing', 'direct_sales', 'real_estate', 'insurance', 
  'consulting', 'coaching', 'ecommerce', 'saas', 'recruitment', 'custom'
];

const validProspectTypes = [
  'customer', 'distributor', 'business_builder', 'recruits', 
  'leads', 'referrals', 'partners', 'clients', 'custom'
];

const validTones = ['professional', 'casual', 'friendly', 'formal'];

export const update = api<UpdateClientRequest, ClientConfiguration>(
  { expose: true, method: "PUT", path: "/clients/:id" },
  wrapAsync(async (req) => {
    validateField(req.id, "id", [Rules.required(), Rules.positive(), Rules.integer()]);
    
    // First, fetch the current record
    const current = await executeQuery(
      () => clientDB.queryRow<ClientConfiguration>`
        SELECT * FROM client_configurations WHERE id = ${req.id}
      `,
      "fetch client for update"
    );
    
    if (!current) {
      throw new NotFoundError("Client configuration not found");
    }
    
    // Validate and merge updates
    const client_name = req.client_name !== undefined ? req.client_name : current.client_name;
    const business_type = req.business_type !== undefined ? req.business_type : current.business_type;
    const business_description = req.business_description !== undefined ? req.business_description : current.business_description;
    const is_active = req.is_active !== undefined ? req.is_active : current.is_active;
    
    // Handle JSON fields
    const enabled_prospect_types = req.enabled_prospect_types !== undefined 
      ? JSON.stringify(req.enabled_prospect_types) 
      : (typeof current.enabled_prospect_types === 'string' ? current.enabled_prospect_types : JSON.stringify(current.enabled_prospect_types));
    
    const custom_prospect_types = req.custom_prospect_types !== undefined 
      ? (req.custom_prospect_types ? JSON.stringify(req.custom_prospect_types) : null)
      : (current.custom_prospect_types ? (typeof current.custom_prospect_types === 'string' ? current.custom_prospect_types : JSON.stringify(current.custom_prospect_types)) : null);
    
    const search_config = req.search_config !== undefined 
      ? JSON.stringify(req.search_config) 
      : (typeof current.search_config === 'string' ? current.search_config : JSON.stringify(current.search_config));
    
    const messaging_config = req.messaging_config !== undefined 
      ? JSON.stringify(req.messaging_config) 
      : (typeof current.messaging_config === 'string' ? current.messaging_config : JSON.stringify(current.messaging_config));
    
    const daily_limits = req.daily_limits !== undefined 
      ? JSON.stringify(req.daily_limits) 
      : (typeof current.daily_limits === 'string' ? current.daily_limits : JSON.stringify(current.daily_limits));
    
    // Validate provided fields
    if (req.client_name !== undefined) {
      validateField(req.client_name, "client_name", [
        Rules.required(), 
        Rules.minLength(2), 
        Rules.maxLength(255)
      ]);
    }
    
    if (req.business_type !== undefined) {
      validateField(req.business_type, "business_type", [
        Rules.required(), 
        Rules.oneOf(validBusinessTypes)
      ]);
    }
    
    if (req.business_description !== undefined && req.business_description) {
      validateField(req.business_description, "business_description", [
        Rules.maxLength(1000)
      ]);
    }
    
    if (req.enabled_prospect_types !== undefined) {
      validateField(req.enabled_prospect_types, "enabled_prospect_types", [
        Rules.required(),
        Rules.minLength(1)
      ]);
      for (const type of req.enabled_prospect_types) {
        validateField(type, "prospect_type", [Rules.oneOf(validProspectTypes)]);
      }
    }
    
    if (req.messaging_config !== undefined) {
      if (req.messaging_config.brand_name !== undefined) {
        validateField(req.messaging_config.brand_name, "brand_name", [
          Rules.required(),
          Rules.maxLength(100)
        ]);
      }
      if (req.messaging_config.value_proposition !== undefined) {
        validateField(req.messaging_config.value_proposition, "value_proposition", [
          Rules.required(),
          Rules.maxLength(500)
        ]);
      }
      if (req.messaging_config.tone !== undefined) {
        validateField(req.messaging_config.tone, "tone", [
          Rules.required(),
          Rules.oneOf(validTones)
        ]);
      }
      if (req.messaging_config.primary_goal !== undefined) {
        validateField(req.messaging_config.primary_goal, "primary_goal", [
          Rules.required(),
          Rules.maxLength(200)
        ]);
      }
    }
    
    // Update with all fields
    const result = await executeQuery(
      () => clientDB.queryRow<ClientConfiguration>`
        UPDATE client_configurations 
        SET client_name = ${client_name},
            business_type = ${business_type},
            business_description = ${business_description},
            enabled_prospect_types = ${enabled_prospect_types},
            custom_prospect_types = ${custom_prospect_types},
            search_config = ${search_config},
            messaging_config = ${messaging_config},
            daily_limits = ${daily_limits},
            is_active = ${is_active},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${req.id}
        RETURNING *
      `,
      "update client"
    );
    
    if (!result) {
      throw new NotFoundError("Client configuration not found");
    }
    
    return result;
  })
);
