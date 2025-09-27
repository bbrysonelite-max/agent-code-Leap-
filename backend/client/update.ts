import { api } from "encore.dev/api";
import { clientDB } from "./db";
import type { ClientConfiguration, UpdateClientRequest } from "./types";
import { validateField, Rules } from "../shared/validation";
import { wrapDatabaseQuery } from "../shared/database";
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
    
    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];
    
    if (req.client_name !== undefined) {
      validateField(req.client_name, "client_name", [
        Rules.required(), 
        Rules.minLength(2), 
        Rules.maxLength(255)
      ]);
      updates.push(`client_name = $${params.length + 1}`);
      params.push(req.client_name);
    }
    
    if (req.business_type !== undefined) {
      validateField(req.business_type, "business_type", [
        Rules.required(), 
        Rules.oneOf(validBusinessTypes)
      ]);
      updates.push(`business_type = $${params.length + 1}`);
      params.push(req.business_type);
    }
    
    if (req.business_description !== undefined) {
      if (req.business_description) {
        validateField(req.business_description, "business_description", [
          Rules.maxLength(1000)
        ]);
      }
      updates.push(`business_description = $${params.length + 1}`);
      params.push(req.business_description || null);
    }
    
    if (req.enabled_prospect_types !== undefined) {
      validateField(req.enabled_prospect_types, "enabled_prospect_types", [
        Rules.required(),
        Rules.minLength(1)
      ]);
      
      for (const type of req.enabled_prospect_types) {
        validateField(type, "prospect_type", [Rules.oneOf(validProspectTypes)]);
      }
      
      updates.push(`enabled_prospect_types = $${params.length + 1}`);
      params.push(JSON.stringify(req.enabled_prospect_types));
    }
    
    if (req.custom_prospect_types !== undefined) {
      if (req.custom_prospect_types) {
        for (const customType of req.custom_prospect_types) {
          validateField(customType.type_name, "custom_type_name", [
            Rules.required(),
            Rules.maxLength(100)
          ]);
          validateField(customType.description, "custom_type_description", [
            Rules.required(),
            Rules.maxLength(500)
          ]);
          validateField(customType.priority, "custom_type_priority", [
            Rules.required(),
            Rules.oneOf(['high', 'medium', 'low'])
          ]);
        }
      }
      updates.push(`custom_prospect_types = $${params.length + 1}`);
      params.push(req.custom_prospect_types ? JSON.stringify(req.custom_prospect_types) : null);
    }
    
    if (req.search_config !== undefined) {
      updates.push(`search_config = $${params.length + 1}`);
      params.push(JSON.stringify(req.search_config));
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
      
      updates.push(`messaging_config = $${params.length + 1}`);
      params.push(JSON.stringify(req.messaging_config));
    }
    
    if (req.daily_limits !== undefined) {
      updates.push(`daily_limits = $${params.length + 1}`);
      params.push(JSON.stringify(req.daily_limits));
    }
    
    if (req.is_active !== undefined) {
      updates.push(`is_active = $${params.length + 1}`);
      params.push(req.is_active);
    }
    
    if (updates.length === 0) {
      throw new NotFoundError("No fields to update");
    }
    
    // Add the ID parameter for WHERE clause
    params.push(req.id);
    
    const result = await wrapDatabaseQuery(
      () => clientDB.rawQueryRow<ClientConfiguration>(
        `UPDATE client_configurations 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${params.length}
        RETURNING *`,
        ...params
      ),
      "update client"
    );
    
    if (!result) {
      throw new NotFoundError("Client configuration not found");
    }
    
    return result;
  })
);