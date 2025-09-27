import { api } from "encore.dev/api";
import { clientDB } from "./db";
import type { ClientConfiguration, CreateClientRequest } from "./types";
import { validateField, Rules } from "../shared/validation";
import { insertRow } from "../shared/database";
import { wrapAsync } from "../shared/errors";

const validBusinessTypes = [
  'network_marketing', 'direct_sales', 'real_estate', 'insurance', 
  'consulting', 'coaching', 'ecommerce', 'saas', 'recruitment', 'custom'
];

const validProspectTypes = [
  'customer', 'distributor', 'business_builder', 'recruits', 
  'leads', 'referrals', 'partners', 'clients', 'custom'
];

const validTones = ['professional', 'casual', 'friendly', 'formal'];

export const create = api<CreateClientRequest, ClientConfiguration>(
  { expose: true, method: "POST", path: "/clients" },
  wrapAsync(async (req) => {
    // Validate input
    validateField(req.client_name, "client_name", [
      Rules.required(), 
      Rules.minLength(2), 
      Rules.maxLength(255)
    ]);
    
    validateField(req.business_type, "business_type", [
      Rules.required(), 
      Rules.oneOf(validBusinessTypes)
    ]);
    
    if (req.business_description) {
      validateField(req.business_description, "business_description", [
        Rules.maxLength(1000)
      ]);
    }
    
    validateField(req.enabled_prospect_types, "enabled_prospect_types", [
      Rules.required(),
      Rules.minLength(1)
    ]);
    
    // Validate each prospect type
    for (const type of req.enabled_prospect_types) {
      validateField(type, "prospect_type", [Rules.oneOf(validProspectTypes)]);
    }
    
    // Validate custom prospect types if provided
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
    
    // Validate messaging config
    validateField(req.messaging_config.brand_name, "brand_name", [
      Rules.required(),
      Rules.maxLength(100)
    ]);
    validateField(req.messaging_config.value_proposition, "value_proposition", [
      Rules.required(),
      Rules.maxLength(500)
    ]);
    validateField(req.messaging_config.tone, "tone", [
      Rules.required(),
      Rules.oneOf(validTones)
    ]);
    validateField(req.messaging_config.primary_goal, "primary_goal", [
      Rules.required(),
      Rules.maxLength(200)
    ]);
    
    // Set default daily limits if not provided
    const dailyLimits = {
      max_prospects_per_day: req.daily_limits?.max_prospects_per_day || 50,
      max_emails_per_day: req.daily_limits?.max_emails_per_day || 100
    };
    
    const result = await insertRow(
      () => clientDB.queryRow<ClientConfiguration>`
        INSERT INTO client_configurations (
          client_name, business_type, business_description, 
          enabled_prospect_types, custom_prospect_types, 
          search_config, messaging_config, daily_limits
        ) VALUES (
          ${req.client_name}, 
          ${req.business_type}, 
          ${req.business_description || null},
          ${JSON.stringify(req.enabled_prospect_types)},
          ${req.custom_prospect_types ? JSON.stringify(req.custom_prospect_types) : null},
          ${JSON.stringify(req.search_config)},
          ${JSON.stringify(req.messaging_config)},
          ${JSON.stringify(dailyLimits)}
        )
        RETURNING *
      `,
      "client configuration"
    );
    
    return result;
  })
);