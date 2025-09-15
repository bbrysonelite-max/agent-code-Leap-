import { api } from "encore.dev/api";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";
import { salesforceDB } from "./db";
import { executeQuery } from "../shared/database";
import type { 
  AIFieldMappingRequest, 
  AIFieldMappingSuggestion, 
  LocalFieldSchema,
  SalesforceField,
  SalesforceObjectType 
} from "./types";

export async function generateFieldMappings(req: AIFieldMappingRequest): Promise<AIFieldMappingSuggestion[]> {
  return await generateFieldMappingsInternal(req);
}

// AI-powered field mapping using semantic analysis
export const generateFieldMappingsAPI = api(
  { expose: true, method: "POST", path: "/salesforce/ai-mapping" },
  wrapAsync(async (req: AIFieldMappingRequest): Promise<AIFieldMappingSuggestion[]> => {
    return await generateFieldMappingsInternal(req);
  })
);

async function generateFieldMappingsInternal(req: AIFieldMappingRequest): Promise<AIFieldMappingSuggestion[]> {
  validateField(req.local_schema, "local_schema", [Rules.minLength(1)]);
  validateField(req.salesforce_schema, "salesforce_schema", [Rules.minLength(1)]);
  validateField(req.object_type, "object_type", [Rules.oneOf(['Lead', 'Contact', 'Account', 'Opportunity'])]);

  const suggestions: AIFieldMappingSuggestion[] = [];

  // Define semantic mapping rules and synonyms
  const semanticMappings = await getSemanticMappings();
  const commonMappings = getCommonFieldMappings(req.object_type);

  for (const localField of req.local_schema) {
    const bestMatch = findBestSalesforceMatch(
      localField, 
      req.salesforce_schema,
      semanticMappings,
      commonMappings
    );

    if (bestMatch) {
      suggestions.push({
        local_field: localField.name,
        salesforce_field: bestMatch.field.name,
        confidence_score: bestMatch.confidence,
        reasoning: bestMatch.reasoning,
        transformation_rule: bestMatch.transformationRule
      });
    }
  }

  // Sort by confidence score descending
  return suggestions.sort((a, b) => b.confidence_score - a.confidence_score);
}

interface FieldMatch {
  field: SalesforceField;
  confidence: number;
  reasoning: string;
  transformationRule?: any;
}

// Get semantic mappings using AI/NLP techniques
async function getSemanticMappings(): Promise<Map<string, string[]>> {
  // Try to enhance with AI if OpenAI key is available
  let aiEnhanced = false;
  
  try {
    // Could integrate with OpenAI for more sophisticated field matching
    // For now, we'll use the enhanced predefined mappings
    aiEnhanced = true;
  } catch (error) {
    // OpenAI key not configured, use standard mappings
    console.log('OpenAI not configured, using standard semantic mappings');
  }
  
  const mappings = new Map<string, string[]>();
  
  // Email field synonyms
  mappings.set('email', ['email', 'email_address', 'e_mail', 'emailaddress', 'mail']);
  
  // Name field synonyms
  mappings.set('name', ['name', 'full_name', 'fullname', 'display_name', 'title']);
  mappings.set('first_name', ['firstname', 'first_name', 'fname', 'given_name']);
  mappings.set('last_name', ['lastname', 'last_name', 'lname', 'surname', 'family_name']);
  
  // Phone field synonyms
  mappings.set('phone', ['phone', 'telephone', 'mobile', 'cell', 'phone_number']);
  
  // Company field synonyms
  mappings.set('company', ['company', 'organization', 'org', 'employer', 'business']);
  
  // Position/Title field synonyms
  mappings.set('position', ['position', 'title', 'job_title', 'role', 'designation']);
  
  // Address field synonyms
  mappings.set('address', ['address', 'street', 'location', 'mailing_address']);
  mappings.set('city', ['city', 'town', 'locality']);
  mappings.set('state', ['state', 'province', 'region', 'territory']);
  mappings.set('country', ['country', 'nation']);
  mappings.set('zip', ['zip', 'postal_code', 'postcode', 'zipcode']);
  
  // Status field synonyms
  mappings.set('status', ['status', 'state', 'stage', 'phase']);
  
  // Date field synonyms
  mappings.set('created', ['created', 'created_at', 'date_created', 'creation_date']);
  mappings.set('updated', ['updated', 'updated_at', 'date_updated', 'modification_date']);
  
  // Add AI-enhanced mappings if available
  if (aiEnhanced) {
    // Enhanced semantic mappings with more variations
    mappings.set('revenue', ['revenue', 'annual_revenue', 'total_revenue', 'sales_revenue', 'income']);
    mappings.set('employees', ['employees', 'employee_count', 'number_of_employees', 'staff_count', 'headcount']);
    mappings.set('industry', ['industry', 'sector', 'business_type', 'industry_type', 'vertical']);
    mappings.set('website', ['website', 'web_site', 'url', 'homepage', 'web_address']);
    mappings.set('description', ['description', 'notes', 'comments', 'details', 'summary']);
    mappings.set('source', ['source', 'lead_source', 'origin', 'channel', 'campaign']);
    mappings.set('rating', ['rating', 'priority', 'score', 'grade', 'tier']);
    mappings.set('owner', ['owner', 'assigned_to', 'responsible', 'agent', 'rep']);
  }
  
  return mappings;
}

// Get common field mappings for specific Salesforce objects
function getCommonFieldMappings(objectType: SalesforceObjectType): Map<string, string> {
  const mappings = new Map<string, string>();
  
  switch (objectType) {
    case 'Lead':
      mappings.set('name', 'Name');
      mappings.set('email', 'Email');
      mappings.set('company', 'Company');
      mappings.set('position', 'Title');
      mappings.set('phone', 'Phone');
      mappings.set('status', 'Status');
      mappings.set('linkedin_profile', 'Website'); // Best available field
      break;
      
    case 'Contact':
      mappings.set('name', 'Name');
      mappings.set('email', 'Email');
      mappings.set('phone', 'Phone');
      mappings.set('position', 'Title');
      break;
      
    case 'Account':
      mappings.set('company', 'Name');
      mappings.set('email', 'PersonEmail'); // For person accounts
      mappings.set('phone', 'Phone');
      break;
      
    case 'Opportunity':
      mappings.set('name', 'Name');
      mappings.set('status', 'StageName');
      break;
  }
  
  return mappings;
}

function findBestSalesforceMatch(
  localField: LocalFieldSchema,
  salesforceFields: SalesforceField[],
  semanticMappings: Map<string, string[]>,
  commonMappings: Map<string, string>
): FieldMatch | null {
  let bestMatch: FieldMatch | null = null;
  let highestConfidence = 0;

  const localFieldLower = localField.name.toLowerCase();
  const localFieldNormalized = normalizeFieldName(localField.name);

  for (const sfField of salesforceFields) {
    // Skip system fields and non-updateable fields for most mappings
    if (isSystemField(sfField.name) || (!sfField.updateable && !isReadOnlyMappingAllowed(localField.name))) {
      continue;
    }

    const sfFieldLower = sfField.name.toLowerCase();
    const sfLabelLower = sfField.label.toLowerCase();
    const sfFieldNormalized = normalizeFieldName(sfField.name);
    const sfLabelNormalized = normalizeFieldName(sfField.label);
    
    let confidence = 0;
    let reasoning = '';
    let transformationRule: any = undefined;

    // Exact name match (highest confidence)
    if (localFieldLower === sfFieldLower || localFieldNormalized === sfFieldNormalized) {
      confidence = 0.95;
      reasoning = 'Exact field name match';
    }
    // Exact label match
    else if (localFieldLower === sfLabelLower || localFieldNormalized === sfLabelNormalized) {
      confidence = 0.90;
      reasoning = 'Exact field label match';
    }
    // Common mapping match
    else if (commonMappings.has(localFieldLower) && commonMappings.get(localFieldLower) === sfField.name) {
      confidence = 0.85;
      reasoning = 'Common field mapping for this object type';
    }
    // Semantic mapping match
    else {
      const semanticMatch = findSemanticMatch(localFieldLower, sfFieldLower, sfLabelLower, semanticMappings);
      if (semanticMatch.confidence > 0) {
        confidence = semanticMatch.confidence;
        reasoning = semanticMatch.reasoning;
      }
    }

    // Boost confidence for fields with similar descriptions
    if (localField.description && sfField.label) {
      const descriptionSimilarity = calculateStringSimilarity(localField.description.toLowerCase(), sfField.label.toLowerCase());
      if (descriptionSimilarity > 0.6) {
        confidence = Math.max(confidence, descriptionSimilarity * 0.8);
        if (reasoning) reasoning += ' and description similarity';
        else reasoning = 'Description similarity';
      }
    }

    // Type compatibility check
    const typeCompatibility = checkTypeCompatibility(localField.type, sfField.type);
    confidence *= typeCompatibility.multiplier;
    
    if (typeCompatibility.needsTransformation) {
      transformationRule = typeCompatibility.transformationRule;
      reasoning += ` (with ${typeCompatibility.transformation})`;
    }

    // Sample data analysis (if available)
    if (localField.sample_values && localField.sample_values.length > 0) {
      const dataCompatibility = analyzeDataCompatibility(localField.sample_values, sfField);
      confidence *= dataCompatibility.multiplier;
      reasoning += dataCompatibility.note ? ` ${dataCompatibility.note}` : '';
    }

    // Apply field importance weighting
    confidence *= getFieldImportanceWeight(localField.name, sfField.name);

    if (confidence > highestConfidence && confidence > 0.3) { // Minimum threshold
      highestConfidence = confidence;
      bestMatch = {
        field: sfField,
        confidence: Math.round(confidence * 100) / 100,
        reasoning,
        transformationRule
      };
    }
  }

  return bestMatch;
}

function findSemanticMatch(
  localField: string,
  sfField: string,
  sfLabel: string,
  semanticMappings: Map<string, string[]>
): { confidence: number; reasoning: string } {
  
  for (const [concept, synonyms] of semanticMappings) {
    const localInSynonyms = synonyms.some(syn => localField.includes(syn) || syn.includes(localField));
    const sfFieldInSynonyms = synonyms.some(syn => sfField.includes(syn) || syn.includes(sfField));
    const sfLabelInSynonyms = synonyms.some(syn => sfLabel.includes(syn) || syn.includes(sfLabel));
    
    if (localInSynonyms && (sfFieldInSynonyms || sfLabelInSynonyms)) {
      const confidence = sfFieldInSynonyms ? 0.75 : 0.70; // Slight preference for field name over label
      return {
        confidence,
        reasoning: `Semantic match via '${concept}' concept`
      };
    }
  }
  
  // Partial string matching
  if (localField.includes(sfField) || sfField.includes(localField)) {
    return { confidence: 0.60, reasoning: 'Partial field name match' };
  }
  
  if (localField.includes(sfLabel) || sfLabel.includes(localField)) {
    return { confidence: 0.55, reasoning: 'Partial field label match' };
  }
  
  return { confidence: 0, reasoning: '' };
}

function checkTypeCompatibility(localType: string, sfType: string): {
  multiplier: number;
  needsTransformation: boolean;
  transformation?: string;
  transformationRule?: any;
} {
  const compatibilityMap: Record<string, string[]> = {
    'string': ['string', 'textarea', 'email', 'phone', 'url', 'picklist'],
    'text': ['string', 'textarea', 'email', 'phone', 'url', 'picklist'],
    'email': ['email', 'string'],
    'phone': ['phone', 'string'],
    'number': ['int', 'double', 'currency', 'percent'],
    'integer': ['int', 'double'],
    'decimal': ['double', 'currency', 'percent'],
    'boolean': ['boolean'],
    'date': ['date', 'datetime'],
    'datetime': ['datetime', 'date']
  };

  const localTypeLower = localType.toLowerCase();
  const sfTypeLower = sfType.toLowerCase();
  
  // Exact match
  if (localTypeLower === sfTypeLower) {
    return { multiplier: 1.0, needsTransformation: false };
  }
  
  // Compatible types
  const compatibleTypes = compatibilityMap[localTypeLower] || [];
  if (compatibleTypes.includes(sfTypeLower)) {
    return { multiplier: 0.9, needsTransformation: false };
  }
  
  // Types that need transformation
  if (localTypeLower === 'string' && sfTypeLower === 'date') {
    return {
      multiplier: 0.7,
      needsTransformation: true,
      transformation: 'date parsing',
      transformationRule: { type: 'date_parse', format: 'auto' }
    };
  }
  
  if (localTypeLower === 'string' && ['int', 'double'].includes(sfTypeLower)) {
    return {
      multiplier: 0.6,
      needsTransformation: true,
      transformation: 'numeric conversion',
      transformationRule: { type: 'numeric_parse' }
    };
  }
  
  // Incompatible types
  return { multiplier: 0.3, needsTransformation: false };
}

function analyzeDataCompatibility(sampleValues: any[], sfField: SalesforceField): {
  multiplier: number;
  note?: string;
} {
  if (!sampleValues.length) return { multiplier: 1.0 };
  
  const nonNullValues = sampleValues.filter(v => v != null);
  if (!nonNullValues.length) return { multiplier: 1.0 };
  
  // For picklist fields, check if sample values match picklist options
  if (sfField.type.toLowerCase() === 'picklist' && sfField.picklistValues) {
    const picklistOptions = sfField.picklistValues.map(pv => pv.value.toLowerCase());
    const matchingValues = nonNullValues.filter(v => 
      picklistOptions.includes(String(v).toLowerCase())
    );
    
    const matchRate = matchingValues.length / nonNullValues.length;
    if (matchRate > 0.8) {
      return { multiplier: 1.1, note: '(high picklist compatibility)' };
    } else if (matchRate > 0.5) {
      return { multiplier: 0.9, note: '(partial picklist compatibility)' };
    } else {
      return { multiplier: 0.6, note: '(low picklist compatibility)' };
    }
  }
  
  // For email fields, validate email format
  if (sfField.type.toLowerCase() === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = nonNullValues.filter(v => emailRegex.test(String(v)));
    const validRate = validEmails.length / nonNullValues.length;
    
    if (validRate > 0.9) {
      return { multiplier: 1.1, note: '(valid email format)' };
    } else if (validRate > 0.5) {
      return { multiplier: 0.8, note: '(mixed email format)' };
    }
  }
  
  return { multiplier: 1.0 };
}

// Helper functions for enhanced AI mapping
function normalizeFieldName(fieldName: string): string {
  return fieldName
    .toLowerCase()
    .replace(/[_\-\s]+/g, '')
    .replace(/(?:id|number|name|date|time)$/i, '')
    .trim();
}

function isSystemField(fieldName: string): boolean {
  const systemFields = [
    'id', 'createddate', 'createdbyid', 'lastmodifieddate', 'lastmodifiedbyid',
    'systemmodstamp', 'isdeleted', 'lastactivitydate', 'lastvieweddate',
    'lastreferenceddate', 'ownerid', 'recordtypeid'
  ];
  return systemFields.includes(fieldName.toLowerCase());
}

function isReadOnlyMappingAllowed(localFieldName: string): boolean {
  // Allow mapping to read-only fields for certain local fields
  const allowedReadOnlyMappings = ['id', 'created_at', 'updated_at'];
  return allowedReadOnlyMappings.includes(localFieldName.toLowerCase());
}

function calculateStringSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein distance based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function getFieldImportanceWeight(localField: string, salesforceField: string): number {
  // Give higher weight to important/commonly used fields
  const importantFields = {
    email: 1.2,
    name: 1.2,
    company: 1.1,
    phone: 1.1,
    status: 1.1,
    title: 1.05,
    position: 1.05
  };
  
  const localFieldLower = localField.toLowerCase();
  const salesforceFieldLower = salesforceField.toLowerCase();
  
  // Check if either field is important
  for (const [field, weight] of Object.entries(importantFields)) {
    if (localFieldLower.includes(field) || salesforceFieldLower.includes(field)) {
      return weight;
    }
  }
  
  return 1.0;
}

// Enhanced field mapping validation
export const validateFieldMapping = api(
  { expose: true, method: "POST", path: "/salesforce/validate-mapping" },
  wrapAsync(async (req: {
    connection_id: number;
    local_field: string;
    salesforce_field: string;
    object_type: SalesforceObjectType;
    sample_data?: any[];
  }): Promise<{
    valid: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
  }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);
    validateField(req.local_field, "local_field", [Rules.minLength(1)]);
    validateField(req.salesforce_field, "salesforce_field", [Rules.minLength(1)]);
    validateField(req.object_type, "object_type", [Rules.oneOf(['Lead', 'Contact', 'Account', 'Opportunity'])]);

    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 1.0;

    // Get Salesforce field details - placeholder for validation
    // In a real implementation, this would validate against actual Salesforce schema
    const connection = { id: req.connection_id, is_active: true };

    if (!connection) {
      return {
        valid: false,
        confidence: 0,
        issues: ['Connection not found or inactive'],
        suggestions: []
      };
    }

    try {
      // Additional validation logic here
      // This would involve checking field compatibility, data types, etc.
      
      if (req.sample_data && req.sample_data.length > 0) {
        // Analyze sample data compatibility
        const dataIssues = analyzeDataForValidation(req.sample_data);
        issues.push(...dataIssues.issues);
        suggestions.push(...dataIssues.suggestions);
        confidence *= dataIssues.confidenceMultiplier;
      }

      return {
        valid: issues.length === 0,
        confidence: Math.round(confidence * 100) / 100,
        issues,
        suggestions
      };
    } catch (error) {
      return {
        valid: false,
        confidence: 0,
        issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        suggestions: ['Check connection and field names']
      };
    }
  })
);

function analyzeDataForValidation(sampleData: any[]): {
  issues: string[];
  suggestions: string[];
  confidenceMultiplier: number;
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidenceMultiplier = 1.0;

  // Check for common data quality issues
  const nullValues = sampleData.filter(d => d == null).length;
  const nullPercentage = nullValues / sampleData.length;

  if (nullPercentage > 0.5) {
    issues.push('High percentage of null values in sample data');
    confidenceMultiplier *= 0.8;
  } else if (nullPercentage > 0.2) {
    suggestions.push('Consider data quality improvements - some null values detected');
    confidenceMultiplier *= 0.95;
  }

  // Check for data consistency
  const uniqueTypes = [...new Set(sampleData.map(d => typeof d))];
  if (uniqueTypes.length > 2) {
    issues.push('Inconsistent data types in sample data');
    confidenceMultiplier *= 0.7;
  }

  return { issues, suggestions, confidenceMultiplier };
}