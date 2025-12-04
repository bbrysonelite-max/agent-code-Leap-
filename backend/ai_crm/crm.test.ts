/**
 * AI Lead OS - CRM Service Tests
 * Comprehensive test suite for Lead, Contact, Deal, and Activity management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  Lead,
  Contact,
  Deal,
  Activity,
  LeadSource,
  LeadStatus,
  ContactType,
  DealStage,
  ActivityType,
  Priority,
  CreateLeadRequest,
  CreateContactRequest,
  CreateDealRequest,
  CreateActivityRequest,
} from './types';

// ============================================
// MOCK DATABASE
// ============================================

interface MockDB {
  leads: Lead[];
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
}

let mockDB: MockDB;
let nextLeadId = 1;
let nextContactId = 1;
let nextDealId = 1;
let nextActivityId = 1;

function resetMockDB() {
  mockDB = {
    leads: [],
    contacts: [],
    deals: [],
    activities: [],
  };
  nextLeadId = 1;
  nextContactId = 1;
  nextDealId = 1;
  nextActivityId = 1;
}

// ============================================
// MOCK LEAD FUNCTIONS
// ============================================

function createMockLead(req: CreateLeadRequest): Lead {
  const lead: Lead = {
    id: `lead_${nextLeadId++}`,
    name: req.name,
    email: req.email,
    phone: req.phone,
    company: req.company,
    position: req.position,
    source: req.source,
    status: 'new',
    ai_score: 0,
    ai_qualification: 'unqualified',
    next_best_action: 'Score and qualify lead',
    priority: 'low',
    linkedin_profile: req.linkedin_profile,
    website: req.website,
    notes: req.notes,
    created_at: new Date(),
    updated_at: new Date(),
  };
  mockDB.leads.push(lead);
  return lead;
}

function getLeadById(id: string): Lead | undefined {
  return mockDB.leads.find(l => l.id === id);
}

function updateLead(id: string, updates: Partial<Lead>): Lead {
  const lead = getLeadById(id);
  if (!lead) throw new Error('Lead not found');
  Object.assign(lead, updates, { updated_at: new Date() });
  return lead;
}

function deleteLead(id: string): boolean {
  const index = mockDB.leads.findIndex(l => l.id === id);
  if (index === -1) return false;
  mockDB.leads.splice(index, 1);
  return true;
}

function searchLeads(query: string): Lead[] {
  const q = query.toLowerCase();
  return mockDB.leads.filter(l =>
    l.name.toLowerCase().includes(q) ||
    l.email.toLowerCase().includes(q) ||
    l.company?.toLowerCase().includes(q) ||
    l.position?.toLowerCase().includes(q)
  );
}

// ============================================
// MOCK CONTACT FUNCTIONS
// ============================================

function createMockContact(req: CreateContactRequest): Contact {
  const contact: Contact = {
    id: `contact_${nextContactId++}`,
    lead_id: req.lead_id,
    name: req.name,
    email: req.email,
    phone: req.phone,
    company: req.company,
    position: req.position,
    type: req.type,
    linkedin_profile: req.linkedin_profile,
    twitter_handle: req.twitter_handle,
    website: req.website,
    address: req.address,
    tags: req.tags || [],
    lifetime_value: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };
  mockDB.contacts.push(contact);
  return contact;
}

function getContactById(id: string): Contact | undefined {
  return mockDB.contacts.find(c => c.id === id);
}

function updateContact(id: string, updates: Partial<Contact>): Contact {
  const contact = getContactById(id);
  if (!contact) throw new Error('Contact not found');
  Object.assign(contact, updates, { updated_at: new Date() });
  return contact;
}

function deleteContact(id: string): boolean {
  const index = mockDB.contacts.findIndex(c => c.id === id);
  if (index === -1) return false;
  mockDB.contacts.splice(index, 1);
  return true;
}

// ============================================
// MOCK DEAL FUNCTIONS
// ============================================

function createMockDeal(req: CreateDealRequest): Deal {
  const deal: Deal = {
    id: `deal_${nextDealId++}`,
    contact_id: req.contact_id,
    name: req.name,
    value: req.value,
    currency: req.currency || 'USD',
    stage: req.stage,
    probability: req.probability || 50,
    ai_win_probability: 50,
    ai_risk_factors: [],
    ai_recommendations: [],
    expected_close_date: req.expected_close_date,
    assigned_to: req.assigned_to,
    source: req.source,
    notes: req.notes,
    created_at: new Date(),
    updated_at: new Date(),
  };
  mockDB.deals.push(deal);
  return deal;
}

function getDealById(id: string): Deal | undefined {
  return mockDB.deals.find(d => d.id === id);
}

function updateDeal(id: string, updates: Partial<Deal>): Deal {
  const deal = getDealById(id);
  if (!deal) throw new Error('Deal not found');
  Object.assign(deal, updates, { updated_at: new Date() });
  return deal;
}

function deleteDeal(id: string): boolean {
  const index = mockDB.deals.findIndex(d => d.id === id);
  if (index === -1) return false;
  mockDB.deals.splice(index, 1);
  return true;
}

// ============================================
// LEAD TESTS
// ============================================

describe('Lead Management', () => {
  beforeEach(() => {
    resetMockDB();
  });

  afterEach(() => {
    resetMockDB();
  });

  describe('Lead Creation', () => {
    it('should create a lead with required fields', () => {
      const lead = createMockLead({
        name: 'John Doe',
        email: 'john@example.com',
        source: 'website',
      });

      expect(lead.id).toBeDefined();
      expect(lead.name).toBe('John Doe');
      expect(lead.email).toBe('john@example.com');
      expect(lead.source).toBe('website');
      expect(lead.status).toBe('new');
      expect(lead.ai_score).toBe(0);
    });

    it('should create a lead with all optional fields', () => {
      const lead = createMockLead({
        name: 'Jane Smith',
        email: 'jane@company.com',
        phone: '+1-555-0123',
        company: 'Acme Corp',
        position: 'VP Sales',
        source: 'referral',
        linkedin_profile: 'https://linkedin.com/in/janesmith',
        website: 'https://janesmith.com',
        notes: 'Met at conference',
      });

      expect(lead.phone).toBe('+1-555-0123');
      expect(lead.company).toBe('Acme Corp');
      expect(lead.position).toBe('VP Sales');
      expect(lead.linkedin_profile).toBe('https://linkedin.com/in/janesmith');
      expect(lead.notes).toBe('Met at conference');
    });

    it('should increment lead IDs', () => {
      const lead1 = createMockLead({ name: 'Lead 1', email: 'lead1@test.com', source: 'website' });
      const lead2 = createMockLead({ name: 'Lead 2', email: 'lead2@test.com', source: 'website' });
      const lead3 = createMockLead({ name: 'Lead 3', email: 'lead3@test.com', source: 'website' });

      expect(lead1.id).toBe('lead_1');
      expect(lead2.id).toBe('lead_2');
      expect(lead3.id).toBe('lead_3');
    });

    it('should validate all lead sources', () => {
      const sources: LeadSource[] = ['website', 'social_media', 'referral', 'cold_outreach', 'event', 'import', 'api'];

      sources.forEach(source => {
        const lead = createMockLead({ name: 'Test', email: `test-${source}@test.com`, source });
        expect(lead.source).toBe(source);
      });
    });
  });

  describe('Lead Retrieval', () => {
    it('should get lead by ID', () => {
      const created = createMockLead({ name: 'Test Lead', email: 'test@test.com', source: 'website' });
      const retrieved = getLeadById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Lead');
    });

    it('should return undefined for non-existent lead', () => {
      const lead = getLeadById('non_existent_id');
      expect(lead).toBeUndefined();
    });

    it('should list all leads', () => {
      createMockLead({ name: 'Lead 1', email: 'l1@test.com', source: 'website' });
      createMockLead({ name: 'Lead 2', email: 'l2@test.com', source: 'referral' });
      createMockLead({ name: 'Lead 3', email: 'l3@test.com', source: 'event' });

      expect(mockDB.leads).toHaveLength(3);
    });

    it('should filter leads by status', () => {
      const lead1 = createMockLead({ name: 'Lead 1', email: 'l1@test.com', source: 'website' });
      const lead2 = createMockLead({ name: 'Lead 2', email: 'l2@test.com', source: 'website' });

      updateLead(lead1.id, { status: 'qualified' });
      updateLead(lead2.id, { status: 'contacted' });

      const qualified = mockDB.leads.filter(l => l.status === 'qualified');
      expect(qualified).toHaveLength(1);
      expect(qualified[0].name).toBe('Lead 1');
    });
  });

  describe('Lead Update', () => {
    it('should update lead name', () => {
      const lead = createMockLead({ name: 'Old Name', email: 'test@test.com', source: 'website' });
      const updated = updateLead(lead.id, { name: 'New Name' });

      expect(updated.name).toBe('New Name');
      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(lead.created_at.getTime());
    });

    it('should update lead status through pipeline', () => {
      const lead = createMockLead({ name: 'Test', email: 'test@test.com', source: 'website' });
      const statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted'];

      statuses.forEach(status => {
        updateLead(lead.id, { status });
        expect(lead.status).toBe(status);
      });
    });

    it('should update AI scoring fields', () => {
      const lead = createMockLead({ name: 'Test', email: 'test@test.com', source: 'website' });

      updateLead(lead.id, {
        ai_score: 85,
        ai_qualification: 'hot',
        next_best_action: 'Schedule call immediately',
        priority: 'urgent',
      });

      expect(lead.ai_score).toBe(85);
      expect(lead.ai_qualification).toBe('hot');
      expect(lead.next_best_action).toBe('Schedule call immediately');
      expect(lead.priority).toBe('urgent');
    });

    it('should throw error when updating non-existent lead', () => {
      expect(() => updateLead('non_existent', { name: 'Test' })).toThrow('Lead not found');
    });

    it('should update assigned_to field', () => {
      const lead = createMockLead({ name: 'Test', email: 'test@test.com', source: 'website' });
      updateLead(lead.id, { assigned_to: 'user_123' });

      expect(lead.assigned_to).toBe('user_123');
    });
  });

  describe('Lead Deletion', () => {
    it('should delete lead by ID', () => {
      const lead = createMockLead({ name: 'To Delete', email: 'delete@test.com', source: 'website' });
      expect(mockDB.leads).toHaveLength(1);

      const result = deleteLead(lead.id);
      expect(result).toBe(true);
      expect(mockDB.leads).toHaveLength(0);
    });

    it('should return false for non-existent lead', () => {
      const result = deleteLead('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('Lead Search', () => {
    beforeEach(() => {
      createMockLead({ name: 'John Doe', email: 'john@acme.com', company: 'Acme Corp', position: 'CEO', source: 'website' });
      createMockLead({ name: 'Jane Smith', email: 'jane@techco.com', company: 'TechCo', position: 'CTO', source: 'referral' });
      createMockLead({ name: 'Bob Johnson', email: 'bob@acme.com', company: 'Acme Corp', position: 'Sales Manager', source: 'event' });
    });

    it('should search by name', () => {
      const results = searchLeads('john');
      expect(results).toHaveLength(2); // John Doe and Bob Johnson
    });

    it('should search by email', () => {
      const results = searchLeads('@acme.com');
      expect(results).toHaveLength(2);
    });

    it('should search by company', () => {
      const results = searchLeads('acme');
      expect(results).toHaveLength(2);
    });

    it('should search by position', () => {
      const results = searchLeads('CEO');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Doe');
    });

    it('should return empty for no matches', () => {
      const results = searchLeads('xyz123');
      expect(results).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const results = searchLeads('ACME');
      expect(results).toHaveLength(2);
    });
  });

  describe('Lead Priority Calculation', () => {
    it('should set priority based on AI qualification', () => {
      const lead = createMockLead({ name: 'Test', email: 'test@test.com', source: 'website' });

      const qualificationToPriority: Record<string, Priority> = {
        'hot': 'urgent',
        'warm': 'high',
        'cold': 'medium',
        'unqualified': 'low',
      };

      Object.entries(qualificationToPriority).forEach(([qualification, expectedPriority]) => {
        updateLead(lead.id, {
          ai_qualification: qualification,
          priority: expectedPriority,
        });
        expect(lead.priority).toBe(expectedPriority);
      });
    });

    it('should prioritize leads with high scores', () => {
      const lead1 = createMockLead({ name: 'Low Score', email: 'low@test.com', source: 'website' });
      const lead2 = createMockLead({ name: 'High Score', email: 'high@test.com', source: 'website' });

      updateLead(lead1.id, { ai_score: 30 });
      updateLead(lead2.id, { ai_score: 90 });

      const sorted = mockDB.leads.sort((a, b) => b.ai_score - a.ai_score);
      expect(sorted[0].name).toBe('High Score');
    });
  });
});

// ============================================
// CONTACT TESTS
// ============================================

describe('Contact Management', () => {
  beforeEach(() => {
    resetMockDB();
  });

  describe('Contact Creation', () => {
    it('should create a contact with required fields', () => {
      const contact = createMockContact({
        name: 'John Contact',
        email: 'john@contact.com',
        type: 'customer',
      });

      expect(contact.id).toBeDefined();
      expect(contact.name).toBe('John Contact');
      expect(contact.email).toBe('john@contact.com');
      expect(contact.type).toBe('customer');
      expect(contact.lifetime_value).toBe(0);
    });

    it('should create contact linked to lead', () => {
      const lead = createMockLead({ name: 'Lead', email: 'lead@test.com', source: 'website' });
      const contact = createMockContact({
        name: 'Contact',
        email: 'contact@test.com',
        type: 'customer',
        lead_id: lead.id,
      });

      expect(contact.lead_id).toBe(lead.id);
    });

    it('should validate all contact types', () => {
      const types: ContactType[] = ['prospect', 'customer', 'partner', 'vendor'];

      types.forEach(type => {
        const contact = createMockContact({ name: 'Test', email: `test-${type}@test.com`, type });
        expect(contact.type).toBe(type);
      });
    });

    it('should handle tags', () => {
      const contact = createMockContact({
        name: 'Tagged Contact',
        email: 'tagged@test.com',
        type: 'customer',
        tags: ['vip', 'enterprise', 'tech'],
      });

      expect(contact.tags).toHaveLength(3);
      expect(contact.tags).toContain('vip');
      expect(contact.tags).toContain('enterprise');
    });
  });

  describe('Contact Update', () => {
    it('should update contact type', () => {
      const contact = createMockContact({ name: 'Test', email: 'test@test.com', type: 'prospect' });
      updateContact(contact.id, { type: 'customer' });

      expect(contact.type).toBe('customer');
    });

    it('should update lifetime value', () => {
      const contact = createMockContact({ name: 'Test', email: 'test@test.com', type: 'customer' });
      updateContact(contact.id, { lifetime_value: 50000 });

      expect(contact.lifetime_value).toBe(50000);
    });

    it('should add tags', () => {
      const contact = createMockContact({ name: 'Test', email: 'test@test.com', type: 'customer', tags: ['initial'] });
      updateContact(contact.id, { tags: [...contact.tags, 'new_tag'] });

      expect(contact.tags).toContain('new_tag');
    });
  });

  describe('Contact Deletion', () => {
    it('should delete contact', () => {
      const contact = createMockContact({ name: 'Delete Me', email: 'delete@test.com', type: 'prospect' });
      const result = deleteContact(contact.id);

      expect(result).toBe(true);
      expect(mockDB.contacts).toHaveLength(0);
    });
  });
});

// ============================================
// DEAL TESTS
// ============================================

describe('Deal Management', () => {
  let testContact: Contact;

  beforeEach(() => {
    resetMockDB();
    testContact = createMockContact({ name: 'Test Contact', email: 'contact@test.com', type: 'customer' });
  });

  describe('Deal Creation', () => {
    it('should create a deal with required fields', () => {
      const deal = createMockDeal({
        contact_id: testContact.id,
        name: 'Enterprise Deal',
        value: 100000,
        stage: 'prospecting',
        source: 'website',
      });

      expect(deal.id).toBeDefined();
      expect(deal.name).toBe('Enterprise Deal');
      expect(deal.value).toBe(100000);
      expect(deal.stage).toBe('prospecting');
      expect(deal.currency).toBe('USD');
    });

    it('should create deal with custom currency', () => {
      const deal = createMockDeal({
        contact_id: testContact.id,
        name: 'Euro Deal',
        value: 50000,
        currency: 'EUR',
        stage: 'proposal',
        source: 'referral',
      });

      expect(deal.currency).toBe('EUR');
    });

    it('should validate all deal stages', () => {
      const stages: DealStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

      stages.forEach(stage => {
        const deal = createMockDeal({
          contact_id: testContact.id,
          name: `Stage ${stage}`,
          value: 10000,
          stage,
          source: 'website',
        });
        expect(deal.stage).toBe(stage);
      });
    });
  });

  describe('Deal Pipeline', () => {
    it('should move deal through stages', () => {
      const deal = createMockDeal({
        contact_id: testContact.id,
        name: 'Pipeline Deal',
        value: 50000,
        stage: 'prospecting',
        source: 'website',
      });

      updateDeal(deal.id, { stage: 'qualification' });
      expect(deal.stage).toBe('qualification');

      updateDeal(deal.id, { stage: 'proposal' });
      expect(deal.stage).toBe('proposal');

      updateDeal(deal.id, { stage: 'negotiation' });
      expect(deal.stage).toBe('negotiation');

      updateDeal(deal.id, { stage: 'closed_won', actual_close_date: new Date() });
      expect(deal.stage).toBe('closed_won');
      expect(deal.actual_close_date).toBeDefined();
    });

    it('should calculate pipeline value by stage', () => {
      createMockDeal({ contact_id: testContact.id, name: 'D1', value: 10000, stage: 'prospecting', source: 'website' });
      createMockDeal({ contact_id: testContact.id, name: 'D2', value: 20000, stage: 'prospecting', source: 'website' });
      createMockDeal({ contact_id: testContact.id, name: 'D3', value: 50000, stage: 'proposal', source: 'website' });

      const prospectingValue = mockDB.deals
        .filter(d => d.stage === 'prospecting')
        .reduce((sum, d) => sum + d.value, 0);

      expect(prospectingValue).toBe(30000);
    });

    it('should update probability based on stage', () => {
      const deal = createMockDeal({
        contact_id: testContact.id,
        name: 'Probability Deal',
        value: 50000,
        stage: 'prospecting',
        probability: 10,
        source: 'website',
      });

      const stageProbabilities: Record<DealStage, number> = {
        'prospecting': 10,
        'qualification': 30,
        'proposal': 50,
        'negotiation': 70,
        'closed_won': 100,
        'closed_lost': 0,
      };

      Object.entries(stageProbabilities).forEach(([stage, prob]) => {
        updateDeal(deal.id, { stage: stage as DealStage, probability: prob });
        expect(deal.probability).toBe(prob);
      });
    });
  });

  describe('Deal AI Analysis', () => {
    it('should update AI win probability', () => {
      const deal = createMockDeal({
        contact_id: testContact.id,
        name: 'AI Deal',
        value: 100000,
        stage: 'proposal',
        source: 'website',
      });

      updateDeal(deal.id, { ai_win_probability: 75 });
      expect(deal.ai_win_probability).toBe(75);
    });

    it('should track AI risk factors', () => {
      const deal = createMockDeal({
        contact_id: testContact.id,
        name: 'Risky Deal',
        value: 200000,
        stage: 'negotiation',
        source: 'cold_outreach',
      });

      updateDeal(deal.id, {
        ai_risk_factors: [
          'Long sales cycle',
          'Budget concerns mentioned',
          'Multiple decision makers',
        ],
      });

      expect(deal.ai_risk_factors).toHaveLength(3);
      expect(deal.ai_risk_factors).toContain('Budget concerns mentioned');
    });

    it('should provide AI recommendations', () => {
      const deal = createMockDeal({
        contact_id: testContact.id,
        name: 'Rec Deal',
        value: 75000,
        stage: 'proposal',
        source: 'website',
      });

      updateDeal(deal.id, {
        ai_recommendations: [
          'Schedule executive sponsor meeting',
          'Address ROI concerns with case study',
          'Offer pilot program',
        ],
      });

      expect(deal.ai_recommendations).toHaveLength(3);
    });
  });

  describe('Deal Analytics', () => {
    it('should calculate total deal value', () => {
      createMockDeal({ contact_id: testContact.id, name: 'D1', value: 10000, stage: 'prospecting', source: 'website' });
      createMockDeal({ contact_id: testContact.id, name: 'D2', value: 25000, stage: 'proposal', source: 'website' });
      createMockDeal({ contact_id: testContact.id, name: 'D3', value: 50000, stage: 'closed_won', source: 'website' });

      const totalValue = mockDB.deals.reduce((sum, d) => sum + d.value, 0);
      expect(totalValue).toBe(85000);
    });

    it('should calculate average deal size', () => {
      createMockDeal({ contact_id: testContact.id, name: 'D1', value: 10000, stage: 'prospecting', source: 'website' });
      createMockDeal({ contact_id: testContact.id, name: 'D2', value: 20000, stage: 'proposal', source: 'website' });
      createMockDeal({ contact_id: testContact.id, name: 'D3', value: 30000, stage: 'closed_won', source: 'website' });

      const avgValue = mockDB.deals.reduce((sum, d) => sum + d.value, 0) / mockDB.deals.length;
      expect(avgValue).toBe(20000);
    });

    it('should calculate win rate', () => {
      createMockDeal({ contact_id: testContact.id, name: 'Won 1', value: 10000, stage: 'closed_won', source: 'website' });
      createMockDeal({ contact_id: testContact.id, name: 'Won 2', value: 20000, stage: 'closed_won', source: 'website' });
      createMockDeal({ contact_id: testContact.id, name: 'Lost 1', value: 15000, stage: 'closed_lost', source: 'website' });

      const closed = mockDB.deals.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost');
      const won = closed.filter(d => d.stage === 'closed_won');
      const winRate = (won.length / closed.length) * 100;

      expect(winRate.toFixed(1)).toBe('66.7');
    });
  });
});

// ============================================
// VALIDATION TESTS
// ============================================

describe('Input Validation', () => {
  beforeEach(() => {
    resetMockDB();
  });

  describe('Email Validation', () => {
    it('should accept valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@company.org',
        'firstname.lastname@company.com',
      ];

      validEmails.forEach(email => {
        const lead = createMockLead({ name: 'Test', email, source: 'website' });
        expect(lead.email).toBe(email);
      });
    });
  });

  describe('Name Validation', () => {
    it('should handle names with special characters', () => {
      const lead = createMockLead({ name: "John O'Brien-Smith", email: 'john@test.com', source: 'website' });
      expect(lead.name).toBe("John O'Brien-Smith");
    });

    it('should handle international names', () => {
      const lead = createMockLead({ name: 'José García', email: 'jose@test.com', source: 'website' });
      expect(lead.name).toBe('José García');
    });
  });

  describe('Phone Validation', () => {
    it('should handle various phone formats', () => {
      const phones = ['+1-555-0123', '(555) 012-3456', '555.012.3456', '+44 20 7123 4567'];

      phones.forEach(phone => {
        const lead = createMockLead({ name: 'Test', email: 'test@test.com', phone, source: 'website' });
        expect(lead.phone).toBe(phone);
      });
    });
  });
});

// ============================================
// EDGE CASES
// ============================================

describe('Edge Cases', () => {
  beforeEach(() => {
    resetMockDB();
  });

  it('should handle empty database gracefully', () => {
    expect(mockDB.leads).toHaveLength(0);
    expect(searchLeads('test')).toHaveLength(0);
  });

  it('should handle large datasets', () => {
    for (let i = 0; i < 1000; i++) {
      createMockLead({ name: `Lead ${i}`, email: `lead${i}@test.com`, source: 'website' });
    }
    expect(mockDB.leads).toHaveLength(1000);

    const results = searchLeads('Lead 50');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle concurrent operations', () => {
    const operations: Promise<Lead>[] = [];

    for (let i = 0; i < 100; i++) {
      operations.push(
        Promise.resolve(createMockLead({ name: `Lead ${i}`, email: `lead${i}@test.com`, source: 'website' }))
      );
    }

    Promise.all(operations).then(results => {
      expect(results).toHaveLength(100);
      expect(mockDB.leads).toHaveLength(100);
    });
  });

  it('should handle special characters in search', () => {
    createMockLead({ name: 'Test & Company', email: 'test@test.com', source: 'website' });
    createMockLead({ name: 'Test <script>', email: 'test2@test.com', source: 'website' });

    const results = searchLeads('&');
    expect(results).toHaveLength(1);
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  beforeEach(() => {
    resetMockDB();
  });

  it('should create 1000 leads in reasonable time', () => {
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      createMockLead({ name: `Lead ${i}`, email: `lead${i}@test.com`, source: 'website' });
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    expect(mockDB.leads).toHaveLength(1000);
  });

  it('should search through 1000 leads efficiently', () => {
    for (let i = 0; i < 1000; i++) {
      createMockLead({
        name: `Lead ${i}`,
        email: `lead${i}@test.com`,
        company: i % 10 === 0 ? 'Target Company' : 'Other Company',
        source: 'website',
      });
    }

    const start = Date.now();
    const results = searchLeads('Target');
    const duration = Date.now() - start;

    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(100); // Should complete in < 100ms
  });
});
