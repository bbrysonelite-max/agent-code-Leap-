import log from "encore.dev/log";

export interface SecurityConfig {
  maxEmailContentLength: number;
  maxProspectNotesLength: number;
  allowedEmailDomains?: string[];
  blockedDomains?: string[];
}

const securityConfig: SecurityConfig = {
  maxEmailContentLength: 50000, // 50KB max email content
  maxProspectNotesLength: 5000,  // 5KB max notes
  blockedDomains: [
    'tempmail.org',
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com'
  ]
};

export function sanitizeHtml(input: string): string {
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<iframe/gi, '')
    .replace(/<object/gi, '')
    .replace(/<embed/gi, '');
}

export function validateEmailContent(content: string): void {
  if (content.length > securityConfig.maxEmailContentLength) {
    throw new Error(`Email content exceeds maximum length of ${securityConfig.maxEmailContentLength} characters`);
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /data:text\/html/i,
    /javascript:/i,
    /<script/i,
    /eval\(/i,
    /document\.write/i
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      log.warn("Suspicious content detected in email", { content: content.substring(0, 100) });
      throw new Error("Email content contains potentially dangerous elements");
    }
  }
}

export function validateEmailDomain(email: string): void {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) {
    throw new Error("Invalid email format");
  }
  
  // Check against blocked domains
  if (securityConfig.blockedDomains?.includes(domain)) {
    throw new Error(`Email domain ${domain} is not allowed`);
  }
  
  // Additional domain validation
  if (domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) {
    throw new Error("Invalid email domain format");
  }
}

export function sanitizeSearchInput(input: string): string {
  // Prevent SQL injection in search terms
  return input
    .replace(/['"\\;]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove SQL block comments
    .replace(/\*\//g, '')
    .trim()
    .substring(0, 100); // Limit length
}

export function validateProspectData(data: {
  name: string;
  email: string;
  linkedin_profile?: string;
  notes?: string;
}): void {
  // Validate email domain
  validateEmailDomain(data.email);
  
  // Validate LinkedIn profile URL
  if (data.linkedin_profile) {
    const linkedinPattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;
    if (!linkedinPattern.test(data.linkedin_profile)) {
      throw new Error("Invalid LinkedIn profile URL format");
    }
  }
  
  // Validate notes length and content
  if (data.notes) {
    if (data.notes.length > securityConfig.maxProspectNotesLength) {
      throw new Error(`Notes exceed maximum length of ${securityConfig.maxProspectNotesLength} characters`);
    }
    
    // Check for suspicious content in notes
    const suspiciousPatterns = [/<script/i, /javascript:/i, /data:/i];
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(data.notes)) {
        throw new Error("Notes contain potentially dangerous content");
      }
    }
  }
}

export function logSecurityEvent(event: string, details: Record<string, any>): void {
  log.warn("Security event", { event, ...details, timestamp: new Date().toISOString() });
}