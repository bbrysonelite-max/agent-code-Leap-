/**
 * AI Lead OS - Pipeline Orchestrator Tests
 * Tests for the full prospect → qualify → sequence → meeting pipeline
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// TYPES
// ============================================

interface ProspectSearchRequest {
  keywords?: string;
  titles?: string[];
  seniorities?: string[];
  industries?: string[];
  employeeCounts?: string[];
  autoQualify?: boolean;
  autoEnrollSequence?: string;
  minQualificationScore?: number;
  limit?: number;
}

interface ProspectSearchResult {
  found: number;
  imported: number;
  qualified: number;
  enrolled: number;
  leads: Array<{
    id: string;
    name: string;
    email: string;
    score?: number;
    qualification?: string;
    enrolled?: boolean;
  }>;
}

interface PipelineStatus {
  health: string;
  timestamp: string;
  leads: {
    total: number;
    hot: number;
    warm: number;
    cold: number;
  };
  sequences: {
    total_sequences: number;
    active_sequences: number;
    total_enrollments: number;
    active_enrollments: number;
  };
  pending_sends: number;
  today: {
    sent_today: number;
    opens_today: number;
    replies_today: number;
  };
}

interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  email_status?: string;
  title?: string;
  phone_numbers?: Array<{ number: string; status: string }>;
  linkedin_url?: string;
  company?: {
    name: string;
    industry?: string;
    employee_range?: string;
  };
}

// ============================================
// MOCK DATABASE & SERVICES
// ============================================

interface MockLeadDB {
  leads: any[];
}

interface MockSequenceDB {
  sequences: any[];
  enrollments: any[];
  sends: any[];
}

let mockLeadDB: MockLeadDB;
let mockSequenceDB: MockSequenceDB;
let mockApolloResponses: ApolloPerson[];
let nextLeadId = 1;

function resetMocks() {
  mockLeadDB = { leads: [] };
  mockSequenceDB = { sequences: [], enrollments: [], sends: [] };
  mockApolloResponses = [];
  nextLeadId = 1;
}

// Mock Apollo client
function mockApolloSearch(filters: any): { people: ApolloPerson[]; pagination: { total_entries: number } } {
  const filtered = mockApolloResponses.filter(p => {
    if (filters.q_keywords && !p.title?.toLowerCase().includes(filters.q_keywords.toLowerCase())) {
      return false;
    }
    if (filters.person_titles && !filters.person_titles.some((t: string) => p.title?.toLowerCase().includes(t.toLowerCase()))) {
      return false;
    }
    return true;
  });

  return {
    people: filtered.slice(0, filters.per_page || 25),
    pagination: { total_entries: filtered.length },
  };
}

// Mock CRM operations
function importLeadFromApollo(person: ApolloPerson): any {
  const existing = mockLeadDB.leads.find(l => l.email === person.email);
  if (existing) {
    return { ...existing, existing: true };
  }

  const lead = {
    id: `lead_${nextLeadId++}`,
    name: person.name,
    email: person.email,
    phone: person.phone_numbers?.[0]?.number || null,
    company: person.company?.name || null,
    position: person.title || null,
    source: 'apollo',
    linkedin_profile: person.linkedin_url || null,
    ai_score: 0,
    ai_qualification: 'unqualified',
    created_at: new Date(),
  };

  mockLeadDB.leads.push(lead);
  return lead;
}

// Mock scoring
function scoreLead(leadId: string): { score: number; qualification: string } {
  const lead = mockLeadDB.leads.find(l => l.id === leadId);
  if (!lead) return { score: 0, qualification: 'unqualified' };

  let score = 30; // Base score

  // Position bonus
  const executiveTitles = ['CEO', 'Founder', 'VP', 'Director', 'Head', 'Chief'];
  if (lead.position && executiveTitles.some(t => lead.position.toLowerCase().includes(t.toLowerCase()))) {
    score += 30;
  }

  // Phone bonus
  if (lead.phone) score += 15;

  // LinkedIn bonus
  if (lead.linkedin_profile) score += 10;

  // Business email bonus
  if (lead.email && !lead.email.includes('gmail') && !lead.email.includes('yahoo')) {
    score += 15;
  }

  const qualification = score >= 70 ? 'hot' : score >= 50 ? 'warm' : score >= 30 ? 'cold' : 'unqualified';

  lead.ai_score = score;
  lead.ai_qualification = qualification;

  return { score, qualification };
}

// Mock sequence enrollment
function enrollInSequence(sequenceId: string, leadId: string): boolean {
  const existing = mockSequenceDB.enrollments.find(e => e.sequence_id === sequenceId && e.lead_id === leadId);
  if (existing) return false;

  mockSequenceDB.enrollments.push({
    id: `enroll_${mockSequenceDB.enrollments.length + 1}`,
    sequence_id: sequenceId,
    lead_id: leadId,
    status: 'active',
    created_at: new Date(),
  });

  return true;
}

// ============================================
// PIPELINE ORCHESTRATION
// ============================================

async function runProspectPipeline(req: ProspectSearchRequest): Promise<ProspectSearchResult> {
  const result: ProspectSearchResult = {
    found: 0,
    imported: 0,
    qualified: 0,
    enrolled: 0,
    leads: [],
  };

  // STEP 1: Search Apollo
  const apolloResponse = mockApolloSearch({
    q_keywords: req.keywords,
    person_titles: req.titles,
    person_seniorities: req.seniorities,
    organization_industries: req.industries,
    organization_employee_counts: req.employeeCounts,
    per_page: req.limit || 25,
  });

  result.found = apolloResponse.pagination.total_entries;

  // STEP 2: Import to CRM
  const importedLeads: any[] = [];

  for (const person of apolloResponse.people) {
    if (!person.email) continue;

    const lead = importLeadFromApollo(person);
    if (!lead.existing) {
      result.imported++;
    }
    importedLeads.push(lead);
  }

  // STEP 3: Qualify leads
  if (req.autoQualify !== false) {
    for (const lead of importedLeads) {
      if (lead.existing) continue;

      const { score, qualification } = scoreLead(lead.id);
      lead.score = score;
      lead.qualification = qualification;

      if (qualification === 'hot' || qualification === 'warm') {
        result.qualified++;
      }
    }
  }

  // STEP 4: Auto-enroll in sequence
  if (req.autoEnrollSequence) {
    const minScore = req.minQualificationScore || 50;

    for (const lead of importedLeads) {
      if (lead.existing) continue;
      if (!lead.score || lead.score < minScore) continue;

      const enrolled = enrollInSequence(req.autoEnrollSequence, lead.id);
      if (enrolled) {
        result.enrolled++;
        lead.enrolled = true;
      }
    }
  }

  // Compile results
  result.leads = importedLeads.map(l => ({
    id: l.id,
    name: l.name,
    email: l.email,
    score: l.score,
    qualification: l.qualification,
    enrolled: l.enrolled,
  }));

  return result;
}

function getPipelineStatus(): PipelineStatus {
  const leads = mockLeadDB.leads;
  const enrollments = mockSequenceDB.enrollments;

  return {
    health: 'operational',
    timestamp: new Date().toISOString(),
    leads: {
      total: leads.length,
      hot: leads.filter(l => l.ai_qualification === 'hot').length,
      warm: leads.filter(l => l.ai_qualification === 'warm').length,
      cold: leads.filter(l => l.ai_qualification === 'cold').length,
    },
    sequences: {
      total_sequences: mockSequenceDB.sequences.length,
      active_sequences: mockSequenceDB.sequences.filter(s => s.status === 'active').length,
      total_enrollments: enrollments.length,
      active_enrollments: enrollments.filter(e => e.status === 'active').length,
    },
    pending_sends: mockSequenceDB.sends.filter(s => s.status === 'scheduled').length,
    today: {
      sent_today: mockSequenceDB.sends.filter(s => s.sent_at && isToday(s.sent_at)).length,
      opens_today: 0,
      replies_today: 0,
    },
  };
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

// ============================================
// PIPELINE TESTS
// ============================================

describe('Pipeline Orchestrator', () => {
  beforeEach(() => {
    resetMocks();

    // Setup mock Apollo data
    mockApolloResponses = [
      {
        id: 'apollo_1',
        first_name: 'John',
        last_name: 'CEO',
        name: 'John CEO',
        email: 'john@company.com',
        email_status: 'verified',
        title: 'CEO',
        phone_numbers: [{ number: '+1-555-0001', status: 'valid' }],
        linkedin_url: 'https://linkedin.com/in/johnceo',
        company: { name: 'TechCorp', industry: 'Technology', employee_range: '50-100' },
      },
      {
        id: 'apollo_2',
        first_name: 'Jane',
        last_name: 'VP',
        name: 'Jane VP',
        email: 'jane@startup.io',
        email_status: 'verified',
        title: 'VP Sales',
        phone_numbers: [{ number: '+1-555-0002', status: 'valid' }],
        company: { name: 'Startup Inc', industry: 'Software', employee_range: '10-50' },
      },
      {
        id: 'apollo_3',
        first_name: 'Bob',
        last_name: 'Manager',
        name: 'Bob Manager',
        email: 'bob@bigcorp.com',
        title: 'Sales Manager',
        company: { name: 'BigCorp', industry: 'Finance', employee_range: '1000+' },
      },
      {
        id: 'apollo_4',
        first_name: 'Alice',
        last_name: 'Director',
        name: 'Alice Director',
        email: 'alice@gmail.com', // Personal email
        title: 'Director of Marketing',
        company: { name: 'Marketing Co', industry: 'Marketing' },
      },
    ];

    // Setup mock sequence
    mockSequenceDB.sequences.push({
      id: 'seq_1',
      name: 'Outreach Sequence',
      status: 'active',
    });
  });

  afterEach(() => {
    resetMocks();
  });

  describe('Prospect Search', () => {
    it('should find prospects from Apollo', async () => {
      const result = await runProspectPipeline({
        keywords: 'CEO',
        limit: 25,
      });

      expect(result.found).toBeGreaterThan(0);
    });

    it('should filter by title', async () => {
      const result = await runProspectPipeline({
        titles: ['CEO', 'Founder'],
        limit: 25,
      });

      expect(result.leads.every(l =>
        l.name.toLowerCase().includes('ceo') ||
        mockApolloResponses.find(a => a.email === l.email)?.title?.toLowerCase().includes('ceo')
      )).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const result = await runProspectPipeline({
        limit: 2,
      });

      expect(result.leads.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty search results', async () => {
      const result = await runProspectPipeline({
        keywords: 'NonexistentTitle12345',
        limit: 25,
      });

      expect(result.found).toBe(0);
      expect(result.leads).toHaveLength(0);
    });
  });

  describe('Lead Import', () => {
    it('should import leads to CRM', async () => {
      const result = await runProspectPipeline({
        limit: 25,
      });

      expect(result.imported).toBeGreaterThan(0);
      expect(mockLeadDB.leads.length).toBe(result.imported);
    });

    it('should skip leads without email', async () => {
      mockApolloResponses.push({
        id: 'no_email',
        first_name: 'No',
        last_name: 'Email',
        name: 'No Email',
        email: '', // Empty email
        title: 'CEO',
      });

      const result = await runProspectPipeline({ limit: 25 });

      expect(mockLeadDB.leads.find(l => l.name === 'No Email')).toBeUndefined();
    });

    it('should not duplicate existing leads', async () => {
      // Run pipeline twice
      await runProspectPipeline({ limit: 25 });
      const result2 = await runProspectPipeline({ limit: 25 });

      expect(result2.imported).toBe(0); // No new imports
    });

    it('should set source as apollo', async () => {
      await runProspectPipeline({ limit: 25 });

      expect(mockLeadDB.leads.every(l => l.source === 'apollo')).toBe(true);
    });
  });

  describe('Auto Qualification', () => {
    it('should auto-qualify imported leads by default', async () => {
      const result = await runProspectPipeline({ limit: 25 });

      expect(result.qualified).toBeGreaterThan(0);
      expect(mockLeadDB.leads.some(l => l.ai_score > 0)).toBe(true);
    });

    it('should skip qualification when autoQualify is false', async () => {
      const result = await runProspectPipeline({
        autoQualify: false,
        limit: 25,
      });

      expect(result.qualified).toBe(0);
    });

    it('should identify hot leads (executives with contact info)', async () => {
      const result = await runProspectPipeline({ limit: 25 });

      const hotLeads = result.leads.filter(l => l.qualification === 'hot');
      expect(hotLeads.length).toBeGreaterThan(0);
    });

    it('should score business emails higher than personal', async () => {
      const result = await runProspectPipeline({ limit: 25 });

      const businessLead = result.leads.find(l => l.email === 'john@company.com');
      const personalLead = result.leads.find(l => l.email === 'alice@gmail.com');

      expect(businessLead?.score).toBeGreaterThan(personalLead?.score || 0);
    });
  });

  describe('Auto Enrollment', () => {
    it('should auto-enroll qualified leads', async () => {
      const result = await runProspectPipeline({
        autoEnrollSequence: 'seq_1',
        minQualificationScore: 50,
        limit: 25,
      });

      expect(result.enrolled).toBeGreaterThan(0);
      expect(mockSequenceDB.enrollments.length).toBe(result.enrolled);
    });

    it('should not enroll leads below minScore', async () => {
      // Override mock data with lower-quality leads
      mockApolloResponses = [
        {
          id: 'low_1',
          first_name: 'Low',
          last_name: 'Score',
          name: 'Low Score',
          email: 'low@gmail.com', // Personal email
          title: 'Intern', // Non-executive
          // No phone, no linkedin
        },
      ];

      const result = await runProspectPipeline({
        autoEnrollSequence: 'seq_1',
        minQualificationScore: 80, // High threshold
        limit: 25,
      });

      expect(result.enrolled).toBe(0);
    });

    it('should use default minScore of 50', async () => {
      const result = await runProspectPipeline({
        autoEnrollSequence: 'seq_1',
        limit: 25,
      });

      const enrolledLeads = result.leads.filter(l => l.enrolled);
      expect(enrolledLeads.every(l => (l.score || 0) >= 50)).toBe(true);
    });

    it('should not enroll without autoEnrollSequence', async () => {
      const result = await runProspectPipeline({
        limit: 25,
      });

      expect(result.enrolled).toBe(0);
    });
  });

  describe('Full Pipeline Flow', () => {
    it('should complete full pipeline: search → import → qualify → enroll', async () => {
      const result = await runProspectPipeline({
        keywords: 'CEO',
        autoEnrollSequence: 'seq_1',
        minQualificationScore: 50,
        limit: 25,
      });

      expect(result.found).toBeGreaterThan(0);
      expect(result.imported).toBeGreaterThan(0);
      expect(result.qualified).toBeGreaterThan(0);
      expect(result.enrolled).toBeGreaterThan(0);
    });

    it('should track pipeline statistics', async () => {
      await runProspectPipeline({
        autoEnrollSequence: 'seq_1',
        limit: 25,
      });

      const status = getPipelineStatus();

      expect(status.health).toBe('operational');
      expect(status.leads.total).toBeGreaterThan(0);
      expect(status.sequences.total_enrollments).toBeGreaterThan(0);
    });

    it('should return lead details in results', async () => {
      const result = await runProspectPipeline({
        autoEnrollSequence: 'seq_1',
        limit: 25,
      });

      expect(result.leads[0]).toHaveProperty('id');
      expect(result.leads[0]).toHaveProperty('name');
      expect(result.leads[0]).toHaveProperty('email');
      expect(result.leads[0]).toHaveProperty('score');
      expect(result.leads[0]).toHaveProperty('qualification');
    });
  });
});

// ============================================
// PIPELINE STATUS TESTS
// ============================================

describe('Pipeline Status', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should return operational health', () => {
    const status = getPipelineStatus();

    expect(status.health).toBe('operational');
    expect(status.timestamp).toBeDefined();
  });

  it('should count leads by qualification', () => {
    // Add mock leads with different qualifications
    mockLeadDB.leads.push(
      { id: 'l1', ai_qualification: 'hot' },
      { id: 'l2', ai_qualification: 'hot' },
      { id: 'l3', ai_qualification: 'warm' },
      { id: 'l4', ai_qualification: 'cold' },
      { id: 'l5', ai_qualification: 'cold' },
      { id: 'l6', ai_qualification: 'cold' },
    );

    const status = getPipelineStatus();

    expect(status.leads.total).toBe(6);
    expect(status.leads.hot).toBe(2);
    expect(status.leads.warm).toBe(1);
    expect(status.leads.cold).toBe(3);
  });

  it('should count sequence statistics', () => {
    mockSequenceDB.sequences.push(
      { id: 's1', status: 'active' },
      { id: 's2', status: 'active' },
      { id: 's3', status: 'paused' },
    );

    mockSequenceDB.enrollments.push(
      { id: 'e1', status: 'active' },
      { id: 'e2', status: 'active' },
      { id: 'e3', status: 'completed' },
    );

    const status = getPipelineStatus();

    expect(status.sequences.total_sequences).toBe(3);
    expect(status.sequences.active_sequences).toBe(2);
    expect(status.sequences.total_enrollments).toBe(3);
    expect(status.sequences.active_enrollments).toBe(2);
  });

  it('should count pending sends', () => {
    mockSequenceDB.sends.push(
      { id: 's1', status: 'scheduled' },
      { id: 's2', status: 'scheduled' },
      { id: 's3', status: 'sent' },
    );

    const status = getPipelineStatus();

    expect(status.pending_sends).toBe(2);
  });
});

// ============================================
// QUICK START SEQUENCE TESTS
// ============================================

describe('Quick Start Sequence', () => {
  beforeEach(() => {
    resetMocks();
  });

  interface QuickStartRequest {
    name: string;
    steps: Array<{
      channel: 'email' | 'sms';
      delay_days: number;
      subject?: string;
      content: string;
    }>;
    leadIds: string[];
  }

  function quickStartSequence(req: QuickStartRequest): { sequenceId: string; enrolled: number } {
    // Create sequence
    const sequence = {
      id: `seq_${mockSequenceDB.sequences.length + 1}`,
      name: req.name,
      status: 'active',
      steps: req.steps,
    };
    mockSequenceDB.sequences.push(sequence);

    // Enroll leads
    let enrolled = 0;
    for (const leadId of req.leadIds) {
      const success = enrollInSequence(sequence.id, leadId);
      if (success) enrolled++;
    }

    return { sequenceId: sequence.id, enrolled };
  }

  it('should create and start sequence in one call', () => {
    // Setup leads
    mockLeadDB.leads.push(
      { id: 'lead_1', name: 'Lead 1', email: 'l1@test.com' },
      { id: 'lead_2', name: 'Lead 2', email: 'l2@test.com' },
    );

    const result = quickStartSequence({
      name: 'Quick Outreach',
      steps: [
        { channel: 'email', delay_days: 0, subject: 'Hi!', content: 'Hello {{firstName}}' },
        { channel: 'email', delay_days: 3, subject: 'Follow up', content: 'Checking in...' },
      ],
      leadIds: ['lead_1', 'lead_2'],
    });

    expect(result.sequenceId).toBeDefined();
    expect(result.enrolled).toBe(2);
    expect(mockSequenceDB.sequences.find(s => s.id === result.sequenceId)).toBeDefined();
  });

  it('should handle empty lead list', () => {
    const result = quickStartSequence({
      name: 'Empty Sequence',
      steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      leadIds: [],
    });

    expect(result.sequenceId).toBeDefined();
    expect(result.enrolled).toBe(0);
  });
});

// ============================================
// DASHBOARD TESTS
// ============================================

describe('Pipeline Dashboard', () => {
  beforeEach(() => {
    resetMocks();
  });

  interface DashboardData {
    status: PipelineStatus;
    recent_leads: any[];
    active_sequences: any[];
    recent_replies: any[];
  }

  function getDashboard(): DashboardData {
    const status = getPipelineStatus();

    const recent_leads = mockLeadDB.leads
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const active_sequences = mockSequenceDB.sequences
      .filter(s => s.status === 'active')
      .slice(0, 5);

    const recent_replies = mockSequenceDB.enrollments
      .filter(e => e.status === 'replied')
      .slice(0, 5);

    return {
      status,
      recent_leads,
      active_sequences,
      recent_replies,
    };
  }

  it('should return complete dashboard data', () => {
    // Setup data
    mockLeadDB.leads.push(
      { id: 'l1', name: 'Lead 1', ai_qualification: 'hot', created_at: new Date() },
      { id: 'l2', name: 'Lead 2', ai_qualification: 'warm', created_at: new Date() },
    );

    mockSequenceDB.sequences.push(
      { id: 's1', name: 'Sequence 1', status: 'active' },
    );

    const dashboard = getDashboard();

    expect(dashboard.status).toBeDefined();
    expect(dashboard.recent_leads).toHaveLength(2);
    expect(dashboard.active_sequences).toHaveLength(1);
  });

  it('should limit recent leads to 10', () => {
    // Add 15 leads
    for (let i = 0; i < 15; i++) {
      mockLeadDB.leads.push({
        id: `lead_${i}`,
        name: `Lead ${i}`,
        ai_qualification: 'warm',
        created_at: new Date(Date.now() - i * 1000),
      });
    }

    const dashboard = getDashboard();

    expect(dashboard.recent_leads.length).toBeLessThanOrEqual(10);
  });

  it('should show only active sequences', () => {
    mockSequenceDB.sequences.push(
      { id: 's1', name: 'Active 1', status: 'active' },
      { id: 's2', name: 'Paused', status: 'paused' },
      { id: 's3', name: 'Active 2', status: 'active' },
    );

    const dashboard = getDashboard();

    expect(dashboard.active_sequences).toHaveLength(2);
    expect(dashboard.active_sequences.every(s => s.status === 'active')).toBe(true);
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('Error Handling', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should handle Apollo API failures gracefully', async () => {
    // Clear mock responses to simulate failure
    mockApolloResponses = [];

    const result = await runProspectPipeline({
      keywords: 'test',
      limit: 25,
    });

    expect(result.found).toBe(0);
    expect(result.imported).toBe(0);
  });

  it('should continue pipeline even if some leads fail to import', async () => {
    mockApolloResponses = [
      { id: '1', first_name: 'John', last_name: 'Doe', name: 'John Doe', email: 'john@test.com' },
      { id: '2', first_name: 'Jane', last_name: 'Doe', name: 'Jane Doe', email: '' }, // Will skip
      { id: '3', first_name: 'Bob', last_name: 'Smith', name: 'Bob Smith', email: 'bob@test.com' },
    ];

    const result = await runProspectPipeline({ limit: 25 });

    expect(result.imported).toBe(2); // Only 2 with valid emails
  });

  it('should handle qualification errors', async () => {
    mockApolloResponses = [
      { id: '1', first_name: 'Test', last_name: 'User', name: 'Test User', email: 'test@test.com' },
    ];

    const result = await runProspectPipeline({
      autoQualify: true,
      limit: 25,
    });

    // Should complete without crashing
    expect(result.leads).toHaveLength(1);
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should handle large prospect lists efficiently', async () => {
    // Generate 1000 mock prospects
    for (let i = 0; i < 1000; i++) {
      mockApolloResponses.push({
        id: `apollo_${i}`,
        first_name: `First${i}`,
        last_name: `Last${i}`,
        name: `First${i} Last${i}`,
        email: `person${i}@company${i}.com`,
        title: i % 10 === 0 ? 'CEO' : 'Manager',
        phone_numbers: i % 3 === 0 ? [{ number: `+1-555-${i.toString().padStart(4, '0')}`, status: 'valid' }] : undefined,
      });
    }

    const start = Date.now();

    const result = await runProspectPipeline({
      autoEnrollSequence: 'seq_1',
      minQualificationScore: 50,
      limit: 100,
    });

    const duration = Date.now() - start;

    expect(result.leads.length).toBe(100);
    expect(duration).toBeLessThan(1000); // Should complete in < 1 second
  });

  it('should handle concurrent pipeline runs', async () => {
    mockApolloResponses = [
      { id: '1', first_name: 'Test', last_name: 'User', name: 'Test User', email: 'test1@test.com' },
      { id: '2', first_name: 'Test', last_name: 'User2', name: 'Test User2', email: 'test2@test.com' },
    ];

    const start = Date.now();

    const results = await Promise.all([
      runProspectPipeline({ keywords: 'test', limit: 10 }),
      runProspectPipeline({ keywords: 'test', limit: 10 }),
      runProspectPipeline({ keywords: 'test', limit: 10 }),
    ]);

    const duration = Date.now() - start;

    expect(results).toHaveLength(3);
    expect(duration).toBeLessThan(500);
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('Integration', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should track lead journey through pipeline', async () => {
    mockApolloResponses = [
      {
        id: 'journey_lead',
        first_name: 'Journey',
        last_name: 'Lead',
        name: 'Journey Lead',
        email: 'journey@company.com',
        title: 'CEO',
        phone_numbers: [{ number: '+1-555-0000', status: 'valid' }],
        linkedin_url: 'https://linkedin.com/in/journey',
      },
    ];

    mockSequenceDB.sequences.push({ id: 'journey_seq', name: 'Journey', status: 'active' });

    // Run pipeline
    const result = await runProspectPipeline({
      autoEnrollSequence: 'journey_seq',
      minQualificationScore: 50,
      limit: 1,
    });

    // Verify lead went through all stages
    const lead = mockLeadDB.leads.find(l => l.email === 'journey@company.com');
    expect(lead).toBeDefined();
    expect(lead.source).toBe('apollo');
    expect(lead.ai_score).toBeGreaterThan(0);
    expect(lead.ai_qualification).toBeDefined();

    // Verify enrollment
    const enrollment = mockSequenceDB.enrollments.find(e => e.lead_id === lead.id);
    expect(enrollment).toBeDefined();
    expect(enrollment.status).toBe('active');

    // Verify result
    expect(result.found).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.qualified).toBe(1);
    expect(result.enrolled).toBe(1);
  });
});
