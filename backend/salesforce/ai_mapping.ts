import { api } from "encore.dev/api";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";
import type { 
  AIFieldMappingRequest, 
  AIFieldMappingSuggestion, 
  LocalFieldSchema,
  SalesforceField,
  SalesforceObjectType 
} from "./types";

// AI-powered field mapping using semantic analysis
export const generateFieldMappings = api(
  { expose: true, method: "POST", path: "/salesforce/ai-mapping" },
  wrapAsync(async (req: AIFieldMappingRequest): Promise<AIFieldMappingSuggestion[]> => {
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
  })
);

interface FieldMatch {
  field: SalesforceField;
  confidence: number;
  reasoning: string;
  transformationRule?: any;
}

// Get semantic mappings using AI/NLP techniques
async function getSemanticMappings(): Promise<Map<string, string[]>> {
  // In a real implementation, this could use an AI service like OpenAI
  // For now, we'll use predefined semantic mappings
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

  for (const sfField of salesforceFields) {
    const sfFieldLower = sfField.name.toLowerCase();
    const sfLabelLower = sfField.label.toLowerCase();
    
    let confidence = 0;
    let reasoning = '';
    let transformationRule: any = undefined;

    // Exact name match (highest confidence)
    if (localFieldLower === sfFieldLower) {
      confidence = 0.95;
      reasoning = 'Exact field name match';
    }
    // Exact label match
    else if (localFieldLower === sfLabelLower) {
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