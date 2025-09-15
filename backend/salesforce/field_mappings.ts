import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { salesforceDB } from "./db";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";
import { SalesforceClient } from "./client";
import { generateFieldMappings } from "./ai_mapping";
import type { 
  SalesforceConnection,
  SalesforceFieldMapping,
  SalesforceObjectType,
  LocalFieldSchema,
  AIFieldMappingSuggestion
} from "./types";

export interface CreateFieldMappingRequest {
  connection_id: number;
  object_type: SalesforceObjectType;
  local_field: string;
  salesforce_field: string;
  transformation_rule?: any;
}

export interface GetFieldMappingsRequest {
  connection_id: number;
  object_type?: Query<SalesforceObjectType>;
}

export interface UpdateFieldMappingRequest {
  mapping_id: number;
  salesforce_field?: string;
  transformation_rule?: any;
  is_active?: boolean;
}

export interface DeleteFieldMappingRequest {
  mapping_id: number;
}

export interface GetSalesforceSchemaRequest {
  connection_id: number;
  object_type: string;
}

export interface GenerateAIMappingsRequest {
  connection_id: number;
  object_type: SalesforceObjectType;
  auto_apply?: boolean;
}

export interface FieldMappingResponse {
  mappings: SalesforceFieldMapping[];
}

// Get field mappings for a connection and object type
export const getFieldMappings = api<GetFieldMappingsRequest, FieldMappingResponse>(
  { expose: true, method: "GET", path: "/salesforce/connections/:connection_id/mappings" },
  wrapAsync(async (req: GetFieldMappingsRequest): Promise<FieldMappingResponse> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);
    
    let query = `SELECT * FROM salesforce_field_mappings WHERE connection_id = $1`;
    const params: any[] = [req.connection_id];
    
    if (req.object_type) {
      query += ` AND object_type = $2`;
      params.push(req.object_type);
    }
    
    query += ` ORDER BY object_type, local_field`;

    const mappings = await executeQuery(
      () => salesforceDB.rawQueryAll<SalesforceFieldMapping>(query, ...params),
      "get field mappings"
    );

    return { mappings };
  })
);

// Create a field mapping
export const createFieldMapping = api(
  { expose: true, method: "POST", path: "/salesforce/mappings" },
  wrapAsync(async (req: CreateFieldMappingRequest): Promise<{ mapping: SalesforceFieldMapping }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);
    validateField(req.object_type, "object_type", [Rules.oneOf(['Lead', 'Contact', 'Account', 'Opportunity'])]);
    validateField(req.local_field, "local_field", [Rules.minLength(1)]);
    validateField(req.salesforce_field, "salesforce_field", [Rules.minLength(1)]);

    // Determine field type from Salesforce schema
    const connection = await getConnection(req.connection_id);
    const client = new SalesforceClient(connection);
    const objectDescription = await client.describe(req.object_type);
    
    const sfField = objectDescription.fields.find(f => f.name === req.salesforce_field);
    if (!sfField) {
      throw new Error(`Salesforce field '${req.salesforce_field}' not found in ${req.object_type}`);
    }

    const mapping = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceFieldMapping>(
        `INSERT INTO salesforce_field_mappings 
         (connection_id, object_type, local_field, salesforce_field, field_type, transformation_rule, is_ai_mapped)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING *`,
        req.connection_id, req.object_type, req.local_field, req.salesforce_field,
        mapSalesforceTypeToLocal(sfField.type), req.transformation_rule
      ),
      "create field mapping"
    );

    if (!mapping) {
      throw new Error("Failed to create field mapping");
    }

    return { mapping };
  })
);

// Update a field mapping
export const updateFieldMapping = api<UpdateFieldMappingRequest, { mapping: SalesforceFieldMapping }>(
  { expose: true, method: "PUT", path: "/salesforce/mappings/:mapping_id" },
  wrapAsync(async (req: UpdateFieldMappingRequest): Promise<{ mapping: SalesforceFieldMapping }> => {
    validateField(req.mapping_id, "mapping_id", [Rules.positive(), Rules.integer()]);

    const updateFields: string[] = [];
    const updateValues: any[] = [req.mapping_id];
    let paramIndex = 2;

    if (req.salesforce_field !== undefined) {
      updateFields.push(`salesforce_field = $${paramIndex}`);
      updateValues.push(req.salesforce_field);
      paramIndex++;
    }

    if (req.transformation_rule !== undefined) {
      updateFields.push(`transformation_rule = $${paramIndex}`);
      updateValues.push(req.transformation_rule);
      paramIndex++;
    }

    if (req.is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(req.is_active);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    const mapping = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceFieldMapping>(
        `UPDATE salesforce_field_mappings 
         SET ${updateFields.join(', ')}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        ...updateValues
      ),
      "update field mapping"
    );

    if (!mapping) {
      throw new Error("Field mapping not found");
    }

    return { mapping };
  })
);

// Delete a field mapping
export const deleteFieldMapping = api<DeleteFieldMappingRequest, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/salesforce/mappings/:mapping_id" },
  wrapAsync(async (req: DeleteFieldMappingRequest): Promise<{ success: boolean }> => {
    validateField(req.mapping_id, "mapping_id", [Rules.positive(), Rules.integer()]);

    await executeQuery(
      () => salesforceDB.rawQueryRow(
        `DELETE FROM salesforce_field_mappings WHERE id = $1`,
        req.mapping_id
      ),
      "delete field mapping"
    );

    return { success: true };
  })
);

// Generate AI-powered field mappings
export const generateAIMappings = api(
  { expose: true, method: "POST", path: "/salesforce/ai-mappings" },
  wrapAsync(async (req: GenerateAIMappingsRequest): Promise<{ suggestions: AIFieldMappingSuggestion[]; applied?: SalesforceFieldMapping[] }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);
    validateField(req.object_type, "object_type", [Rules.oneOf(['Lead', 'Contact', 'Account', 'Opportunity'])]);

    const connection = await getConnection(req.connection_id);
    const client = new SalesforceClient(connection);

    // Get Salesforce object schema
    const objectDescription = await client.describe(req.object_type);

    // Get local schema based on object type
    const localSchema = getLocalSchema(req.object_type);

    // Generate AI suggestions
    const suggestions = await generateFieldMappings({
      local_schema: localSchema,
      salesforce_schema: objectDescription.fields,
      object_type: req.object_type
    });

    let appliedMappings: SalesforceFieldMapping[] = [];

    // Auto-apply mappings if requested and confidence is high
    if (req.auto_apply) {
      for (const suggestion of suggestions) {
        if (suggestion.confidence_score >= 0.8) {
          try {
            // Check if mapping already exists
            const existingMapping = await executeQuery(
              () => salesforceDB.rawQueryRow<SalesforceFieldMapping>(
                `SELECT * FROM salesforce_field_mappings 
                 WHERE connection_id = $1 AND object_type = $2 AND local_field = $3`,
                req.connection_id, req.object_type, suggestion.local_field
              ),
              "check existing mapping"
            );

            if (!existingMapping) {
              const sfField = objectDescription.fields.find(f => f.name === suggestion.salesforce_field);
              if (sfField) {
                const mapping = await executeQuery(
                  () => salesforceDB.rawQueryRow<SalesforceFieldMapping>(
                    `INSERT INTO salesforce_field_mappings 
                     (connection_id, object_type, local_field, salesforce_field, field_type, 
                      transformation_rule, is_ai_mapped, confidence_score)
                     VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                     RETURNING *`,
                    req.connection_id, req.object_type, suggestion.local_field,
                    suggestion.salesforce_field, mapSalesforceTypeToLocal(sfField.type),
                    suggestion.transformation_rule, suggestion.confidence_score
                  ),
                  "create ai field mapping"
                );

                if (mapping) {
                  appliedMappings.push(mapping);
                }
              }
            }
          } catch (error) {
            console.error(`Failed to auto-apply mapping for ${suggestion.local_field}:`, error);
          }
        }
      }
    }

    return {
      suggestions,
      applied: appliedMappings.length > 0 ? appliedMappings : undefined
    };
  })
);

// Get Salesforce object schema
export const getSalesforceSchema = api<GetSalesforceSchemaRequest, { fields: any[] }>(
  { expose: true, method: "GET", path: "/salesforce/connections/:connection_id/schema/:object_type" },
  wrapAsync(async (req: GetSalesforceSchemaRequest): Promise<{ fields: any[] }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);
    validateField(req.object_type, "object_type", [Rules.oneOf(['Lead', 'Contact', 'Account', 'Opportunity'])]);

    const connection = await getConnection(req.connection_id);
    const client = new SalesforceClient(connection);

    const objectDescription = await client.describe(req.object_type as SalesforceObjectType);

    return {
      fields: objectDescription.fields.map(field => ({
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        updateable: field.updateable,
        length: field.length,
        picklistValues: field.picklistValues
      }))
    };
  })
);

// Helper functions
async function getConnection(connectionId: number): Promise<SalesforceConnection> {
  const connection = await executeQuery(
    () => salesforceDB.rawQueryRow<SalesforceConnection>(
      `SELECT * FROM salesforce_connections WHERE id = $1 AND is_active = true`,
      connectionId
    ),
    "get salesforce connection"
  );

  if (!connection) {
    throw new Error("Active connection not found");
  }

  return connection;
}

function getLocalSchema(objectType: SalesforceObjectType): LocalFieldSchema[] {
  // Define local schema based on our prospect/campaign data structure
  const prospectSchema: LocalFieldSchema[] = [
    { name: 'id', type: 'number', description: 'Unique identifier' },
    { name: 'name', type: 'string', description: 'Full name of the prospect' },
    { name: 'email', type: 'email', description: 'Email address' },
    { name: 'company', type: 'string', description: 'Company name' },
    { name: 'position', type: 'string', description: 'Job title or position' },
    { name: 'linkedin_profile', type: 'string', description: 'LinkedIn profile URL' },
    { name: 'classification', type: 'string', description: 'Prospect classification' },
    { name: 'status', type: 'string', description: 'Current status' },
    { name: 'notes', type: 'text', description: 'Additional notes' },
    { name: 'created_at', type: 'datetime', description: 'Creation date' },
    { name: 'updated_at', type: 'datetime', description: 'Last update date' }
  ];

  const campaignSchema: LocalFieldSchema[] = [
    { name: 'id', type: 'number', description: 'Unique identifier' },
    { name: 'subject', type: 'string', description: 'Email subject' },
    { name: 'body', type: 'text', description: 'Email body content' },
    { name: 'status', type: 'string', description: 'Campaign status' },
    { name: 'sent_at', type: 'datetime', description: 'Send date' },
    { name: 'opened_at', type: 'datetime', description: 'Open date' },
    { name: 'clicked_at', type: 'datetime', description: 'Click date' },
    { name: 'replied_at', type: 'datetime', description: 'Reply date' }
  ];

  switch (objectType) {
    case 'Lead':
    case 'Contact':
      return prospectSchema;
    case 'Opportunity':
      return campaignSchema;
    case 'Account':
      return [
        { name: 'company', type: 'string', description: 'Company name' },
        { name: 'email', type: 'email', description: 'Primary email' },
        { name: 'phone', type: 'phone', description: 'Phone number' }
      ];
    default:
      return prospectSchema;
  }
}

function mapSalesforceTypeToLocal(sfType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'text',
    'textarea': 'text',
    'email': 'email',
    'phone': 'phone',
    'url': 'text',
    'picklist': 'text',
    'int': 'number',
    'double': 'number',
    'currency': 'number',
    'percent': 'number',
    'boolean': 'boolean',
    'date': 'date',
    'datetime': 'datetime'
  };

  return typeMap[sfType.toLowerCase()] || 'text';
}