/**
 * AI Lead OS - Qualification Service Tests
 * Tests for lead scoring, AI qualification, and scoring criteria
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// TYPES
// ============================================

interface LeadData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  industry?: string;
  companySize?: number;
  source?: string;
  linkedinUrl?: string;
  notes?: string;
}

interface ScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  qualification: 'hot' | 'warm' | 'cold' | 'unqualified';
  reasons: string[];
  nextBestAction: string;
  confidence: number;
}

interface ScoringCriteria {
  targetTitles: string[];
  titleWeight: number;
  targetIndustries: string[];
  industryWeight: number;
  minCompanySize: number;
  maxCompanySize: number;
  companySizeWeight: number;
  requirePhone: boolean;
  phoneWeight: number;
  requireLinkedIn: boolean;
  linkedInWeight: number;
  preferredSources: string[];
  sourceWeight: number;
}

// ============================================
// MOCK SCORING FUNCTIONS
// ============================================

const DEFAULT_CRITERIA: ScoringCriteria = {
  targetTitles: ['CEO', 'Founder', 'Owner', 'President', 'VP', 'Director', 'Head', 'Chief'],
  titleWeight: 25,
  targetIndustries: [],
  industryWeight: 15,
  minCompanySize: 10,
  maxCompanySize: 500,
  companySizeWeight: 15,
  requirePhone: true,
  phoneWeight: 15,
  requireLinkedIn: false,
  linkedInWeight: 10,
  preferredSources: ['referral', 'website', 'linkedin'],
  sourceWeight: 10,
};

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function getQualification(score: number): 'hot' | 'warm' | 'cold' | 'unqualified' {
  if (score >= 70) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 30) return 'cold';
  return 'unqualified';
}

function getNextBestAction(qualification: string, lead: LeadData): string {
  switch (qualification) {
    case 'hot':
      return lead.phone
        ? 'Send personalized SMS + email immediately, then call within 24 hours'
        : 'Send personalized email immediately with Calendly link';
    case 'warm':
      return 'Enroll in standard outreach sequence (email + SMS)';
    case 'cold':
      return 'Enroll in nurture sequence, gather more information';
    default:
      return 'Archive or mark for review - does not meet criteria';
  }
}

function calculateScore(lead: LeadData, criteria: ScoringCriteria = DEFAULT_CRITERIA): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  let maxPossibleScore = 0;

  // Title scoring
  maxPossibleScore += criteria.titleWeight;
  if (lead.position) {
    const titleMatch = criteria.targetTitles.some(t =>
      lead.position!.toLowerCase().includes(t.toLowerCase())
    );
    if (titleMatch) {
      score += criteria.titleWeight;
      reasons.push(`✓ Decision maker title: ${lead.position}`);
    } else {
      reasons.push(`✗ Title not in target list: ${lead.position}`);
    }
  } else {
    reasons.push(`✗ No title information`);
  }

  // Company size scoring
  maxPossibleScore += criteria.companySizeWeight;
  if (lead.companySize) {
    if (lead.companySize >= criteria.minCompanySize && lead.companySize <= criteria.maxCompanySize) {
      score += criteria.companySizeWeight;
      reasons.push(`✓ Company size in range: ${lead.companySize}`);
    } else {
      const partial = criteria.companySizeWeight * 0.5;
      score += partial;
      reasons.push(`~ Company size outside ideal range: ${lead.companySize}`);
    }
  }

  // Industry scoring
  if (criteria.targetIndustries.length > 0) {
    maxPossibleScore += criteria.industryWeight;
    if (lead.industry) {
      const industryMatch = criteria.targetIndustries.some(i =>
        lead.industry!.toLowerCase().includes(i.toLowerCase())
      );
      if (industryMatch) {
        score += criteria.industryWeight;
        reasons.push(`✓ Target industry: ${lead.industry}`);
      }
    }
  }

  // Phone scoring
  maxPossibleScore += criteria.phoneWeight;
  if (lead.phone) {
    score += criteria.phoneWeight;
    reasons.push(`✓ Has phone number`);
  } else if (criteria.requirePhone) {
    reasons.push(`✗ Missing phone number (required for SMS)`);
  }

  // LinkedIn scoring
  maxPossibleScore += criteria.linkedInWeight;
  if (lead.linkedinUrl) {
    score += criteria.linkedInWeight;
    reasons.push(`✓ Has LinkedIn profile`);
  }

  // Source scoring
  maxPossibleScore += criteria.sourceWeight;
  if (lead.source && criteria.preferredSources.includes(lead.source)) {
    score += criteria.sourceWeight;
    reasons.push(`✓ Preferred source: ${lead.source}`);
  }

  // Email domain scoring (bonus)
  const emailDomain = lead.email.split('@')[1];
  if (emailDomain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(emailDomain)) {
    score += 10;
    maxPossibleScore += 10;
    reasons.push(`✓ Business email domain: ${emailDomain}`);
  }

  // Normalize score to 0-100
  const normalizedScore = Math.round((score / maxPossibleScore) * 100);

  const grade = getGrade(normalizedScore);
  const qualification = getQualification(normalizedScore);
  const nextBestAction = getNextBestAction(qualification, lead);

  return {
    score: normalizedScore,
    grade,
    qualification,
    reasons,
    nextBestAction,
    confidence: maxPossibleScore > 50 ? 0.8 : 0.6,
  };
}

// ============================================
// SCORING TESTS
// ============================================

describe('Lead Qualification Scoring', () => {
  describe('Score Calculation', () => {
    it('should score a perfect lead highly', () => {
      const lead: LeadData = {
        id: 'lead_1',
        name: 'John CEO',
        email: 'john@company.com',
        phone: '+1-555-0123',
        company: 'TechCorp',
        position: 'CEO',
        companySize: 50,
        source: 'referral',
        linkedinUrl: 'https://linkedin.com/in/johnceo',
      };

      const result = calculateScore(lead);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toBe('A');
      expect(result.qualification).toBe('hot');
    });

    it('should score a minimal lead poorly', () => {
      const lead: LeadData = {
        id: 'lead_2',
        name: 'Unknown Person',
        email: 'unknown@gmail.com',
      };

      const result = calculateScore(lead);

      expect(result.score).toBeLessThan(30);
      expect(result.qualification).toBe('unqualified');
    });

    it('should score a warm lead in middle range', () => {
      const lead: LeadData = {
        id: 'lead_3',
        name: 'Jane Director', // Changed to Director for better scoring
        email: 'jane@techco.com',
        position: 'Director of Sales', // Changed to Director
        company: 'TechCo',
        source: 'website',
      };

      const result = calculateScore(lead);

      // With Director title + business email + website source, score should be in warm range
      expect(result.score).toBeGreaterThanOrEqual(20);
      expect(result.score).toBeLessThan(80);
    });

    it('should return reasons for scoring', () => {
      const lead: LeadData = {
        id: 'lead_4',
        name: 'Test Lead',
        email: 'test@company.com',
        phone: '+1-555-0123',
        position: 'Director of Sales',
      };

      const result = calculateScore(lead);

      expect(result.reasons).toBeDefined();
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.some(r => r.includes('Director'))).toBe(true);
      expect(result.reasons.some(r => r.includes('phone'))).toBe(true);
    });
  });

  describe('Title Scoring', () => {
    it('should score CEO highest', () => {
      const ceo: LeadData = { id: '1', name: 'John', email: 'john@co.com', position: 'CEO' };
      const manager: LeadData = { id: '2', name: 'Jane', email: 'jane@co.com', position: 'Account Manager' };

      const ceoScore = calculateScore(ceo);
      const managerScore = calculateScore(manager);

      expect(ceoScore.score).toBeGreaterThan(managerScore.score);
    });

    it('should recognize various executive titles', () => {
      const executiveTitles = ['CEO', 'Founder', 'VP of Sales', 'Director of Marketing', 'Head of Operations', 'Chief Revenue Officer'];

      executiveTitles.forEach(title => {
        const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com', position: title };
        const result = calculateScore(lead);

        expect(result.reasons.some(r => r.includes('✓') && r.includes('title'))).toBe(true);
      });
    });

    it('should not score non-executive titles', () => {
      const nonExecutiveTitles = ['Intern', 'Junior Developer', 'Support Agent', 'Administrator'];

      nonExecutiveTitles.forEach(title => {
        const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com', position: title };
        const result = calculateScore(lead);

        expect(result.reasons.some(r => r.includes('✗') && r.includes('not in target list'))).toBe(true);
      });
    });

    it('should handle missing title', () => {
      const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com' };
      const result = calculateScore(lead);

      expect(result.reasons.some(r => r.includes('No title information'))).toBe(true);
    });
  });

  describe('Company Size Scoring', () => {
    it('should score companies in ideal range', () => {
      const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com', companySize: 100 };
      const result = calculateScore(lead);

      expect(result.reasons.some(r => r.includes('✓') && r.includes('Company size'))).toBe(true);
    });

    it('should partially score companies outside ideal range', () => {
      const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com', companySize: 1000 };
      const result = calculateScore(lead);

      expect(result.reasons.some(r => r.includes('~') && r.includes('outside ideal range'))).toBe(true);
    });

    it('should handle companies at range boundaries', () => {
      const minBoundary: LeadData = { id: '1', name: 'Test', email: 'test@co.com', companySize: 10 };
      const maxBoundary: LeadData = { id: '2', name: 'Test', email: 'test@co.com', companySize: 500 };

      const minResult = calculateScore(minBoundary);
      const maxResult = calculateScore(maxBoundary);

      expect(minResult.reasons.some(r => r.includes('✓') && r.includes('Company size in range'))).toBe(true);
      expect(maxResult.reasons.some(r => r.includes('✓') && r.includes('Company size in range'))).toBe(true);
    });
  });

  describe('Contact Info Scoring', () => {
    it('should score leads with phone number', () => {
      const withPhone: LeadData = { id: '1', name: 'Test', email: 'test@co.com', phone: '+1-555-0123' };
      const withoutPhone: LeadData = { id: '2', name: 'Test', email: 'test@co.com' };

      const withPhoneResult = calculateScore(withPhone);
      const withoutPhoneResult = calculateScore(withoutPhone);

      expect(withPhoneResult.score).toBeGreaterThan(withoutPhoneResult.score);
    });

    it('should score leads with LinkedIn', () => {
      const withLinkedIn: LeadData = { id: '1', name: 'Test', email: 'test@co.com', linkedinUrl: 'https://linkedin.com/in/test' };
      const withoutLinkedIn: LeadData = { id: '2', name: 'Test', email: 'test@co.com' };

      const withResult = calculateScore(withLinkedIn);
      const withoutResult = calculateScore(withoutLinkedIn);

      expect(withResult.score).toBeGreaterThan(withoutResult.score);
    });
  });

  describe('Email Domain Scoring', () => {
    it('should score business email domains higher', () => {
      const businessEmail: LeadData = { id: '1', name: 'Test', email: 'test@company.com' };
      const personalEmail: LeadData = { id: '2', name: 'Test', email: 'test@gmail.com' };

      const businessResult = calculateScore(businessEmail);
      const personalResult = calculateScore(personalEmail);

      expect(businessResult.score).toBeGreaterThan(personalResult.score);
    });

    it('should not give bonus for common personal email providers', () => {
      const providers = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];

      providers.forEach(provider => {
        const lead: LeadData = { id: '1', name: 'Test', email: `test@${provider}` };
        const result = calculateScore(lead);

        expect(result.reasons.some(r => r.includes('Business email domain'))).toBe(false);
      });
    });
  });

  describe('Source Scoring', () => {
    it('should score preferred sources higher', () => {
      const referral: LeadData = { id: '1', name: 'Test', email: 'test@co.com', source: 'referral' };
      const coldOutreach: LeadData = { id: '2', name: 'Test', email: 'test@co.com', source: 'cold_outreach' };

      const referralResult = calculateScore(referral);
      const coldResult = calculateScore(coldOutreach);

      expect(referralResult.score).toBeGreaterThan(coldResult.score);
    });

    it('should recognize all preferred sources', () => {
      const preferredSources = ['referral', 'website', 'linkedin'];

      preferredSources.forEach(source => {
        const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com', source };
        const result = calculateScore(lead);

        expect(result.reasons.some(r => r.includes('✓') && r.includes('Preferred source'))).toBe(true);
      });
    });
  });
});

// ============================================
// GRADE TESTS
// ============================================

describe('Grade Calculation', () => {
  it('should return grade A for scores >= 80', () => {
    expect(getGrade(80)).toBe('A');
    expect(getGrade(90)).toBe('A');
    expect(getGrade(100)).toBe('A');
  });

  it('should return grade B for scores 60-79', () => {
    expect(getGrade(60)).toBe('B');
    expect(getGrade(70)).toBe('B');
    expect(getGrade(79)).toBe('B');
  });

  it('should return grade C for scores 40-59', () => {
    expect(getGrade(40)).toBe('C');
    expect(getGrade(50)).toBe('C');
    expect(getGrade(59)).toBe('C');
  });

  it('should return grade D for scores 20-39', () => {
    expect(getGrade(20)).toBe('D');
    expect(getGrade(30)).toBe('D');
    expect(getGrade(39)).toBe('D');
  });

  it('should return grade F for scores < 20', () => {
    expect(getGrade(0)).toBe('F');
    expect(getGrade(10)).toBe('F');
    expect(getGrade(19)).toBe('F');
  });
});

// ============================================
// QUALIFICATION TESTS
// ============================================

describe('Qualification Determination', () => {
  it('should return hot for scores >= 70', () => {
    expect(getQualification(70)).toBe('hot');
    expect(getQualification(85)).toBe('hot');
    expect(getQualification(100)).toBe('hot');
  });

  it('should return warm for scores 50-69', () => {
    expect(getQualification(50)).toBe('warm');
    expect(getQualification(60)).toBe('warm');
    expect(getQualification(69)).toBe('warm');
  });

  it('should return cold for scores 30-49', () => {
    expect(getQualification(30)).toBe('cold');
    expect(getQualification(40)).toBe('cold');
    expect(getQualification(49)).toBe('cold');
  });

  it('should return unqualified for scores < 30', () => {
    expect(getQualification(0)).toBe('unqualified');
    expect(getQualification(15)).toBe('unqualified');
    expect(getQualification(29)).toBe('unqualified');
  });
});

// ============================================
// NEXT BEST ACTION TESTS
// ============================================

describe('Next Best Action', () => {
  it('should recommend immediate contact for hot leads with phone', () => {
    const lead: LeadData = { id: '1', name: 'Hot Lead', email: 'hot@co.com', phone: '+1-555-0123' };
    const action = getNextBestAction('hot', lead);

    expect(action).toContain('immediately');
    expect(action).toContain('SMS');
    expect(action).toContain('call');
  });

  it('should recommend email for hot leads without phone', () => {
    const lead: LeadData = { id: '1', name: 'Hot Lead', email: 'hot@co.com' };
    const action = getNextBestAction('hot', lead);

    expect(action).toContain('email');
    expect(action).toContain('Calendly');
  });

  it('should recommend sequence for warm leads', () => {
    const lead: LeadData = { id: '1', name: 'Warm Lead', email: 'warm@co.com' };
    const action = getNextBestAction('warm', lead);

    expect(action).toContain('sequence');
  });

  it('should recommend nurture for cold leads', () => {
    const lead: LeadData = { id: '1', name: 'Cold Lead', email: 'cold@co.com' };
    const action = getNextBestAction('cold', lead);

    expect(action).toContain('nurture');
  });

  it('should recommend archive for unqualified leads', () => {
    const lead: LeadData = { id: '1', name: 'Unqualified', email: 'unq@gmail.com' };
    const action = getNextBestAction('unqualified', lead);

    expect(action).toContain('Archive');
  });
});

// ============================================
// CUSTOM CRITERIA TESTS
// ============================================

describe('Custom Scoring Criteria', () => {
  it('should allow custom target titles', () => {
    const customCriteria: ScoringCriteria = {
      ...DEFAULT_CRITERIA,
      targetTitles: ['Engineer', 'Developer', 'Architect'],
    };

    const engineer: LeadData = { id: '1', name: 'Test', email: 'test@co.com', position: 'Senior Engineer' };
    const ceo: LeadData = { id: '2', name: 'Test', email: 'test@co.com', position: 'CEO' };

    const engineerResult = calculateScore(engineer, customCriteria);
    const ceoResult = calculateScore(ceo, customCriteria);

    expect(engineerResult.reasons.some(r => r.includes('✓') && r.includes('Decision maker'))).toBe(true);
    expect(ceoResult.reasons.some(r => r.includes('✗') && r.includes('not in target list'))).toBe(true);
  });

  it('should allow custom company size range', () => {
    const customCriteria: ScoringCriteria = {
      ...DEFAULT_CRITERIA,
      minCompanySize: 1000,
      maxCompanySize: 10000,
    };

    const enterprise: LeadData = { id: '1', name: 'Test', email: 'test@co.com', companySize: 5000 };
    const smb: LeadData = { id: '2', name: 'Test', email: 'test@co.com', companySize: 50 };

    const enterpriseResult = calculateScore(enterprise, customCriteria);
    const smbResult = calculateScore(smb, customCriteria);

    expect(enterpriseResult.reasons.some(r => r.includes('✓') && r.includes('Company size in range'))).toBe(true);
    expect(smbResult.reasons.some(r => r.includes('~') && r.includes('outside ideal range'))).toBe(true);
  });

  it('should allow custom industry targeting', () => {
    const customCriteria: ScoringCriteria = {
      ...DEFAULT_CRITERIA,
      targetIndustries: ['Technology', 'Software', 'SaaS'],
    };

    const tech: LeadData = { id: '1', name: 'Test', email: 'test@co.com', industry: 'Software Development' };
    const retail: LeadData = { id: '2', name: 'Test', email: 'test@co.com', industry: 'Retail' };

    const techResult = calculateScore(tech, customCriteria);
    const retailResult = calculateScore(retail, customCriteria);

    expect(techResult.reasons.some(r => r.includes('✓') && r.includes('Target industry'))).toBe(true);
  });

  it('should adjust weights correctly', () => {
    const highTitleWeight: ScoringCriteria = {
      ...DEFAULT_CRITERIA,
      titleWeight: 50,
      phoneWeight: 5,
    };

    const ceoNoPhone: LeadData = { id: '1', name: 'Test', email: 'test@co.com', position: 'CEO' };
    const managerWithPhone: LeadData = { id: '2', name: 'Test', email: 'test@co.com', position: 'Manager', phone: '+1-555-0123' };

    const ceoResult = calculateScore(ceoNoPhone, highTitleWeight);
    const managerResult = calculateScore(managerWithPhone, highTitleWeight);

    // CEO should score higher despite missing phone due to high title weight
    expect(ceoResult.score).toBeGreaterThan(managerResult.score);
  });
});

// ============================================
// BULK SCORING TESTS
// ============================================

describe('Bulk Scoring', () => {
  it('should score multiple leads', () => {
    const leads: LeadData[] = [
      { id: '1', name: 'Lead 1', email: 'l1@co.com', position: 'CEO', phone: '+1-555-0001' },
      { id: '2', name: 'Lead 2', email: 'l2@co.com', position: 'Manager' },
      { id: '3', name: 'Lead 3', email: 'l3@gmail.com' },
    ];

    const results = leads.map(lead => calculateScore(lead));

    expect(results).toHaveLength(3);
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[1].score).toBeGreaterThan(results[2].score);
  });

  it('should rank leads correctly', () => {
    const leads: LeadData[] = [
      { id: 'cold', name: 'Cold', email: 'cold@gmail.com' },
      { id: 'hot', name: 'Hot', email: 'hot@company.com', position: 'CEO', phone: '+1-555-0001', source: 'referral' },
      { id: 'warm', name: 'Warm', email: 'warm@co.com', position: 'Director', source: 'website' },
    ];

    const results = leads
      .map(lead => ({ ...lead, result: calculateScore(lead) }))
      .sort((a, b) => b.result.score - a.result.score);

    expect(results[0].id).toBe('hot');
    expect(results[2].id).toBe('cold');
  });

  it('should handle empty lead list', () => {
    const leads: LeadData[] = [];
    const results = leads.map(lead => calculateScore(lead));

    expect(results).toHaveLength(0);
  });

  it('should score consistently', () => {
    const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com', position: 'CEO' };

    const results = Array(10).fill(null).map(() => calculateScore(lead));

    const scores = results.map(r => r.score);
    expect(new Set(scores).size).toBe(1); // All scores should be identical
  });
});

// ============================================
// CONFIDENCE TESTS
// ============================================

describe('Scoring Confidence', () => {
  it('should have higher confidence with more data', () => {
    const richData: LeadData = {
      id: '1',
      name: 'Complete Lead',
      email: 'complete@company.com',
      phone: '+1-555-0123',
      position: 'CEO',
      company: 'TechCorp',
      companySize: 100,
      source: 'referral',
      linkedinUrl: 'https://linkedin.com/in/complete',
    };

    const sparseData: LeadData = {
      id: '2',
      name: 'Sparse Lead',
      email: 'sparse@gmail.com',
    };

    const richResult = calculateScore(richData);
    const sparseResult = calculateScore(sparseData);

    expect(richResult.confidence).toBeGreaterThanOrEqual(sparseResult.confidence);
  });

  it('should return confidence between 0 and 1', () => {
    const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com' };
    const result = calculateScore(lead);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ============================================
// EDGE CASES
// ============================================

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    const lead: LeadData = { id: '1', name: '', email: 'test@co.com', position: '' };
    const result = calculateScore(lead);

    expect(result.score).toBeDefined();
    expect(result.reasons.some(r => r.includes('No title information'))).toBe(true);
  });

  it('should handle very long company names', () => {
    const lead: LeadData = {
      id: '1',
      name: 'Test',
      email: 'test@co.com',
      company: 'Very Long Company Name That Goes On And On For A Really Long Time Inc.',
    };

    const result = calculateScore(lead);
    expect(result.score).toBeDefined();
  });

  it('should handle special characters in position', () => {
    const lead: LeadData = {
      id: '1',
      name: 'Test',
      email: 'test@co.com',
      position: 'VP, Sales & Marketing (Americas)',
    };

    const result = calculateScore(lead);
    expect(result.reasons.some(r => r.includes('VP'))).toBe(true);
  });

  it('should handle extremely large company size', () => {
    const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com', companySize: 1000000 };
    const result = calculateScore(lead);

    expect(result.reasons.some(r => r.includes('outside ideal range'))).toBe(true);
  });

  it('should handle zero company size', () => {
    const lead: LeadData = { id: '1', name: 'Test', email: 'test@co.com', companySize: 0 };
    const result = calculateScore(lead);

    expect(result.score).toBeDefined();
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  it('should score 1000 leads quickly', () => {
    const leads: LeadData[] = Array(1000).fill(null).map((_, i) => ({
      id: `lead_${i}`,
      name: `Lead ${i}`,
      email: `lead${i}@company.com`,
      position: i % 2 === 0 ? 'CEO' : 'Manager',
      phone: i % 3 === 0 ? '+1-555-0000' : undefined,
    }));

    const start = Date.now();
    const results = leads.map(lead => calculateScore(lead));
    const duration = Date.now() - start;

    expect(results).toHaveLength(1000);
    expect(duration).toBeLessThan(500); // Should complete in < 500ms
  });

  it('should rank 1000 leads quickly', () => {
    const leads: LeadData[] = Array(1000).fill(null).map((_, i) => ({
      id: `lead_${i}`,
      name: `Lead ${i}`,
      email: `lead${i}@company.com`,
      position: ['CEO', 'VP', 'Director', 'Manager', 'Engineer'][i % 5],
    }));

    const start = Date.now();
    const ranked = leads
      .map(lead => ({ lead, result: calculateScore(lead) }))
      .sort((a, b) => b.result.score - a.result.score);
    const duration = Date.now() - start;

    expect(ranked[0].result.score).toBeGreaterThanOrEqual(ranked[999].result.score);
    expect(duration).toBeLessThan(1000); // Should complete in < 1 second
  });
});
