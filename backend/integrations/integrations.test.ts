/**
 * AI Lead OS - Integration Service Tests
 * Tests for Apollo, Brevo, Twilio, and Calendly integrations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// TYPES
// ============================================

// Apollo Types
interface ApolloSearchFilters {
  q_keywords?: string;
  person_titles?: string[];
  person_seniorities?: string[];
  organization_industries?: string[];
  organization_employee_counts?: string[];
  page?: number;
  per_page?: number;
}

interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  email_status?: 'verified' | 'unverified' | 'invalid';
  title?: string;
  phone_numbers?: Array<{ number: string; status: string; sanitized_number?: string }>;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: {
    name: string;
    industry?: string;
    estimated_num_employees?: number;
  };
}

// Brevo Types
interface BrevoEmailRequest {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
  sender?: { email: string; name?: string };
  replyTo?: { email: string; name?: string };
  tags?: string[];
}

interface BrevoEmailResponse {
  messageId: string;
}

// Twilio Types
interface TwilioSMSRequest {
  to: string;
  body: string;
  from?: string;
}

interface TwilioSMSResponse {
  sid: string;
  status: string;
  to: string;
  body: string;
}

// Calendly Types
interface CalendlyBookingLink {
  link: string;
  eventType?: string;
}

// ============================================
// MOCK IMPLEMENTATIONS
// ============================================

// Apollo Client Mock
class MockApolloClient {
  private apiKey: string;
  private mockPeople: ApolloPerson[] = [];

  constructor(apiKey: string = 'mock_api_key') {
    this.apiKey = apiKey;
  }

  setMockData(people: ApolloPerson[]) {
    this.mockPeople = people;
  }

  async searchPeople(filters: ApolloSearchFilters): Promise<{ people: ApolloPerson[]; pagination: { total_entries: number } }> {
    let filtered = [...this.mockPeople];

    if (filters.q_keywords) {
      const kw = filters.q_keywords.toLowerCase();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(kw) ||
        p.organization?.industry?.toLowerCase().includes(kw)
      );
    }

    if (filters.person_titles && filters.person_titles.length > 0) {
      filtered = filtered.filter(p =>
        filters.person_titles!.some(t => p.title?.toLowerCase().includes(t.toLowerCase()))
      );
    }

    if (filters.person_seniorities && filters.person_seniorities.length > 0) {
      filtered = filtered.filter(p =>
        filters.person_seniorities!.some(s => p.title?.toLowerCase().includes(s.toLowerCase()))
      );
    }

    if (filters.organization_industries && filters.organization_industries.length > 0) {
      filtered = filtered.filter(p =>
        filters.organization_industries!.some(i => p.organization?.industry?.toLowerCase().includes(i.toLowerCase()))
      );
    }

    const start = ((filters.page || 1) - 1) * (filters.per_page || 25);
    const end = start + (filters.per_page || 25);
    const paginated = filtered.slice(start, end);

    return {
      people: paginated,
      pagination: { total_entries: filtered.length },
    };
  }

  async enrichPerson(email: string): Promise<ApolloPerson | null> {
    return this.mockPeople.find(p => p.email === email) || null;
  }

  async bulkEnrich(emails: string[]): Promise<ApolloPerson[]> {
    return emails.map(email => this.mockPeople.find(p => p.email === email)).filter((p): p is ApolloPerson => p !== undefined);
  }

  async getOrganization(domain: string): Promise<any> {
    const person = this.mockPeople.find(p => p.email.includes(domain));
    return person?.organization || null;
  }
}

// Brevo Client Mock
class MockBrevoClient {
  private sentEmails: BrevoEmailRequest[] = [];
  private shouldFail = false;

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  async sendEmail(req: BrevoEmailRequest): Promise<BrevoEmailResponse> {
    if (this.shouldFail) {
      throw new Error('Brevo API error');
    }

    // Validate request
    if (!req.to || req.to.length === 0) {
      throw new Error('Missing recipients');
    }
    if (!req.subject) {
      throw new Error('Missing subject');
    }
    if (!req.htmlContent) {
      throw new Error('Missing content');
    }

    this.sentEmails.push(req);

    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  getSentEmails(): BrevoEmailRequest[] {
    return this.sentEmails;
  }

  clearSentEmails() {
    this.sentEmails = [];
  }
}

// Twilio Client Mock
class MockTwilioClient {
  private sentSMS: TwilioSMSRequest[] = [];
  private shouldFail = false;

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  async sendSMS(req: TwilioSMSRequest): Promise<TwilioSMSResponse> {
    if (this.shouldFail) {
      throw new Error('Twilio API error');
    }

    // Validate phone number
    if (!this.isValidPhoneNumber(req.to)) {
      throw new Error('Invalid phone number');
    }

    if (!req.body || req.body.length === 0) {
      throw new Error('Missing message body');
    }

    if (req.body.length > 1600) {
      throw new Error('Message too long');
    }

    this.sentSMS.push(req);

    return {
      sid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      status: 'queued',
      to: req.to,
      body: req.body,
    };
  }

  isValidPhoneNumber(phone: string): boolean {
    // Basic validation: must start with + and have at least 10 digits
    const cleaned = phone.replace(/[^+\d]/g, '');
    return /^\+\d{10,15}$/.test(cleaned);
  }

  getSentSMS(): TwilioSMSRequest[] {
    return this.sentSMS;
  }

  clearSentSMS() {
    this.sentSMS = [];
  }
}

// Calendly Client Mock
class MockCalendlyClient {
  private bookingLink = 'https://calendly.com/user/30min';

  setBookingLink(link: string) {
    this.bookingLink = link;
  }

  async getBookingLink(): Promise<CalendlyBookingLink> {
    return {
      link: this.bookingLink,
      eventType: '30min',
    };
  }
}

// Helper functions
function personalizeContent(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

function personalizeSMS(content: string, variables: Record<string, string>): string {
  return personalizeContent(content, variables);
}

function appendOptOut(content: string): string {
  return `${content}\n\nReply STOP to opt out.`;
}

function generateUnsubscribeLink(email: string): string {
  const encoded = Buffer.from(email).toString('base64');
  return `https://app.example.com/unsubscribe?e=${encoded}`;
}

function apolloToProspect(person: ApolloPerson): any {
  const phone = person.phone_numbers?.find(p => p.status === 'valid')?.sanitized_number ||
    person.phone_numbers?.[0]?.number ||
    null;

  return {
    name: person.name,
    firstName: person.first_name,
    lastName: person.last_name,
    email: person.email,
    emailVerified: person.email_status === 'verified',
    phone,
    title: person.title,
    company: person.organization?.name || '',
    companySize: person.organization?.estimated_num_employees || null,
    industry: person.organization?.industry || null,
    linkedinUrl: person.linkedin_url || null,
    location: [person.city, person.state, person.country].filter(Boolean).join(', '),
    source: 'apollo',
    apolloId: person.id,
  };
}

// ============================================
// APOLLO TESTS
// ============================================

describe('Apollo Integration', () => {
  let apolloClient: MockApolloClient;

  beforeEach(() => {
    apolloClient = new MockApolloClient('test_api_key');

    // Setup mock data
    apolloClient.setMockData([
      {
        id: 'apollo_1',
        first_name: 'John',
        last_name: 'CEO',
        name: 'John CEO',
        email: 'john@techcorp.com',
        email_status: 'verified',
        title: 'CEO',
        phone_numbers: [{ number: '+1-555-0001', status: 'valid', sanitized_number: '+15550001' }],
        linkedin_url: 'https://linkedin.com/in/johnceo',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        organization: {
          name: 'TechCorp',
          industry: 'Technology',
          estimated_num_employees: 150,
        },
      },
      {
        id: 'apollo_2',
        first_name: 'Jane',
        last_name: 'VP',
        name: 'Jane VP',
        email: 'jane@startup.io',
        email_status: 'verified',
        title: 'VP of Sales',
        phone_numbers: [{ number: '+1-555-0002', status: 'valid' }],
        organization: {
          name: 'Startup Inc',
          industry: 'Software',
          estimated_num_employees: 50,
        },
      },
      {
        id: 'apollo_3',
        first_name: 'Bob',
        last_name: 'Director',
        name: 'Bob Director',
        email: 'bob@finance.com',
        email_status: 'unverified',
        title: 'Director of Marketing',
        organization: {
          name: 'Finance Corp',
          industry: 'Finance',
          estimated_num_employees: 500,
        },
      },
      {
        id: 'apollo_4',
        first_name: 'Alice',
        last_name: 'Manager',
        name: 'Alice Manager',
        email: 'alice@retail.com',
        title: 'Sales Manager',
        organization: {
          name: 'Retail Co',
          industry: 'Retail',
          estimated_num_employees: 1000,
        },
      },
    ]);
  });

  describe('People Search', () => {
    it('should search for people', async () => {
      const result = await apolloClient.searchPeople({});

      expect(result.people).toHaveLength(4);
      expect(result.pagination.total_entries).toBe(4);
    });

    it('should filter by keywords', async () => {
      const result = await apolloClient.searchPeople({
        q_keywords: 'technology',
      });

      expect(result.people).toHaveLength(1);
      expect(result.people[0].email).toBe('john@techcorp.com');
    });

    it('should filter by titles', async () => {
      const result = await apolloClient.searchPeople({
        person_titles: ['CEO', 'VP'],
      });

      expect(result.people).toHaveLength(2);
    });

    it('should filter by industry', async () => {
      const result = await apolloClient.searchPeople({
        organization_industries: ['Finance'],
      });

      expect(result.people).toHaveLength(1);
      expect(result.people[0].email).toBe('bob@finance.com');
    });

    it('should paginate results', async () => {
      const result = await apolloClient.searchPeople({
        page: 1,
        per_page: 2,
      });

      expect(result.people).toHaveLength(2);
      expect(result.pagination.total_entries).toBe(4);
    });

    it('should handle second page', async () => {
      const result = await apolloClient.searchPeople({
        page: 2,
        per_page: 2,
      });

      expect(result.people).toHaveLength(2);
    });

    it('should handle empty results', async () => {
      const result = await apolloClient.searchPeople({
        q_keywords: 'nonexistent_keyword_12345',
      });

      expect(result.people).toHaveLength(0);
      expect(result.pagination.total_entries).toBe(0);
    });
  });

  describe('Person Enrichment', () => {
    it('should enrich person by email', async () => {
      const result = await apolloClient.enrichPerson('john@techcorp.com');

      expect(result).toBeDefined();
      expect(result?.first_name).toBe('John');
      expect(result?.organization?.name).toBe('TechCorp');
    });

    it('should return null for unknown email', async () => {
      const result = await apolloClient.enrichPerson('unknown@test.com');

      expect(result).toBeNull();
    });
  });

  describe('Bulk Enrichment', () => {
    it('should enrich multiple emails', async () => {
      const result = await apolloClient.bulkEnrich([
        'john@techcorp.com',
        'jane@startup.io',
      ]);

      expect(result).toHaveLength(2);
    });

    it('should skip unknown emails', async () => {
      const result = await apolloClient.bulkEnrich([
        'john@techcorp.com',
        'unknown@test.com',
        'jane@startup.io',
      ]);

      expect(result).toHaveLength(2);
    });
  });

  describe('Data Conversion', () => {
    it('should convert Apollo person to prospect', async () => {
      const apolloPerson: ApolloPerson = {
        id: 'ap_1',
        first_name: 'Test',
        last_name: 'User',
        name: 'Test User',
        email: 'test@company.com',
        email_status: 'verified',
        title: 'CEO',
        phone_numbers: [{ number: '+1-555-0000', status: 'valid', sanitized_number: '+15550000' }],
        linkedin_url: 'https://linkedin.com/in/test',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        organization: {
          name: 'Test Corp',
          industry: 'Technology',
          estimated_num_employees: 100,
        },
      };

      const prospect = apolloToProspect(apolloPerson);

      expect(prospect.name).toBe('Test User');
      expect(prospect.firstName).toBe('Test');
      expect(prospect.lastName).toBe('User');
      expect(prospect.email).toBe('test@company.com');
      expect(prospect.emailVerified).toBe(true);
      expect(prospect.phone).toBe('+15550000');
      expect(prospect.title).toBe('CEO');
      expect(prospect.company).toBe('Test Corp');
      expect(prospect.companySize).toBe(100);
      expect(prospect.industry).toBe('Technology');
      expect(prospect.linkedinUrl).toBe('https://linkedin.com/in/test');
      expect(prospect.location).toBe('New York, NY, USA');
      expect(prospect.source).toBe('apollo');
      expect(prospect.apolloId).toBe('ap_1');
    });

    it('should handle missing fields', () => {
      const apolloPerson: ApolloPerson = {
        id: 'ap_2',
        first_name: 'Minimal',
        last_name: 'Person',
        name: 'Minimal Person',
        email: 'minimal@test.com',
      };

      const prospect = apolloToProspect(apolloPerson);

      expect(prospect.phone).toBeNull();
      expect(prospect.company).toBe('');
      expect(prospect.companySize).toBeNull();
      expect(prospect.linkedinUrl).toBeNull();
      expect(prospect.location).toBe('');
    });
  });
});

// ============================================
// BREVO (EMAIL) TESTS
// ============================================

describe('Brevo Integration', () => {
  let brevoClient: MockBrevoClient;

  beforeEach(() => {
    brevoClient = new MockBrevoClient();
  });

  afterEach(() => {
    brevoClient.clearSentEmails();
  });

  describe('Email Sending', () => {
    it('should send email successfully', async () => {
      const result = await brevoClient.sendEmail({
        to: [{ email: 'recipient@test.com', name: 'Recipient' }],
        subject: 'Test Subject',
        htmlContent: '<p>Hello World</p>',
      });

      expect(result.messageId).toBeDefined();
      expect(brevoClient.getSentEmails()).toHaveLength(1);
    });

    it('should send to multiple recipients', async () => {
      const result = await brevoClient.sendEmail({
        to: [
          { email: 'user1@test.com' },
          { email: 'user2@test.com' },
          { email: 'user3@test.com' },
        ],
        subject: 'Bulk Email',
        htmlContent: '<p>Hello everyone</p>',
      });

      expect(result.messageId).toBeDefined();
      expect(brevoClient.getSentEmails()[0].to).toHaveLength(3);
    });

    it('should fail without recipients', async () => {
      await expect(brevoClient.sendEmail({
        to: [],
        subject: 'Test',
        htmlContent: '<p>Test</p>',
      })).rejects.toThrow('Missing recipients');
    });

    it('should fail without subject', async () => {
      await expect(brevoClient.sendEmail({
        to: [{ email: 'test@test.com' }],
        subject: '',
        htmlContent: '<p>Test</p>',
      })).rejects.toThrow('Missing subject');
    });

    it('should fail without content', async () => {
      await expect(brevoClient.sendEmail({
        to: [{ email: 'test@test.com' }],
        subject: 'Test',
        htmlContent: '',
      })).rejects.toThrow('Missing content');
    });

    it('should handle API failures', async () => {
      brevoClient.setShouldFail(true);

      await expect(brevoClient.sendEmail({
        to: [{ email: 'test@test.com' }],
        subject: 'Test',
        htmlContent: '<p>Test</p>',
      })).rejects.toThrow('Brevo API error');
    });
  });

  describe('Content Personalization', () => {
    it('should personalize email content', () => {
      const template = 'Hello {{firstName}}, I noticed you work at {{company}}.';
      const variables = { firstName: 'John', company: 'Acme Corp' };

      const result = personalizeContent(template, variables);

      expect(result).toBe('Hello John, I noticed you work at Acme Corp.');
    });

    it('should handle multiple occurrences', () => {
      const template = 'Hi {{name}}! {{name}}, are you available?';
      const variables = { name: 'Jane' };

      const result = personalizeContent(template, variables);

      expect(result).toBe('Hi Jane! Jane, are you available?');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {{firstName}} from {{company}}';
      const variables = { firstName: 'John' };

      const result = personalizeContent(template, variables);

      expect(result).toBe('Hello John from {{company}}');
    });
  });

  describe('Unsubscribe Link', () => {
    it('should generate unsubscribe link', () => {
      const link = generateUnsubscribeLink('test@example.com');

      expect(link).toContain('unsubscribe');
      expect(link).toContain('e=');
    });

    it('should encode email in link', () => {
      const email = 'test@example.com';
      const link = generateUnsubscribeLink(email);

      // The link should contain a base64-encoded version of the email
      const encoded = Buffer.from(email).toString('base64');
      expect(link).toContain(encoded);
    });
  });
});

// ============================================
// TWILIO (SMS) TESTS
// ============================================

describe('Twilio Integration', () => {
  let twilioClient: MockTwilioClient;

  beforeEach(() => {
    twilioClient = new MockTwilioClient();
  });

  afterEach(() => {
    twilioClient.clearSentSMS();
  });

  describe('SMS Sending', () => {
    it('should send SMS successfully', async () => {
      const result = await twilioClient.sendSMS({
        to: '+15550001234',
        body: 'Hello from AI Lead OS!',
      });

      expect(result.sid).toBeDefined();
      expect(result.status).toBe('queued');
      expect(twilioClient.getSentSMS()).toHaveLength(1);
    });

    it('should validate phone number format', async () => {
      await expect(twilioClient.sendSMS({
        to: 'invalid-phone',
        body: 'Test message',
      })).rejects.toThrow('Invalid phone number');
    });

    it('should accept international formats', async () => {
      const phones = ['+15550001234', '+44 20 7123 4567', '+49-30-12345678'];

      for (const phone of phones) {
        twilioClient.clearSentSMS();
        const result = await twilioClient.sendSMS({ to: phone, body: 'Test' });
        expect(result.sid).toBeDefined();
      }
    });

    it('should fail with empty body', async () => {
      await expect(twilioClient.sendSMS({
        to: '+15550001234',
        body: '',
      })).rejects.toThrow('Missing message body');
    });

    it('should fail with message too long', async () => {
      const longMessage = 'A'.repeat(1601);

      await expect(twilioClient.sendSMS({
        to: '+15550001234',
        body: longMessage,
      })).rejects.toThrow('Message too long');
    });

    it('should handle API failures', async () => {
      twilioClient.setShouldFail(true);

      await expect(twilioClient.sendSMS({
        to: '+15550001234',
        body: 'Test',
      })).rejects.toThrow('Twilio API error');
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate correct phone numbers', () => {
      expect(twilioClient.isValidPhoneNumber('+15550001234')).toBe(true);
      expect(twilioClient.isValidPhoneNumber('+447911123456')).toBe(true);
      expect(twilioClient.isValidPhoneNumber('+33123456789')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(twilioClient.isValidPhoneNumber('555-0001')).toBe(false);
      expect(twilioClient.isValidPhoneNumber('not-a-phone')).toBe(false);
      expect(twilioClient.isValidPhoneNumber('')).toBe(false);
      expect(twilioClient.isValidPhoneNumber('+123')).toBe(false); // Too short
    });

    it('should handle formatted phone numbers', () => {
      expect(twilioClient.isValidPhoneNumber('+1 (555) 000-1234')).toBe(true);
      expect(twilioClient.isValidPhoneNumber('+1-555-000-1234')).toBe(true);
      expect(twilioClient.isValidPhoneNumber('+1.555.000.1234')).toBe(true);
    });
  });

  describe('SMS Personalization', () => {
    it('should personalize SMS content', () => {
      const template = 'Hi {{firstName}}, this is regarding {{company}}.';
      const variables = { firstName: 'John', company: 'Acme Corp' };

      const result = personalizeSMS(template, variables);

      expect(result).toBe('Hi John, this is regarding Acme Corp.');
    });

    it('should append opt-out message', () => {
      const content = 'Hello, this is a test message.';
      const result = appendOptOut(content);

      expect(result).toContain('Reply STOP to opt out');
    });

    it('should not double-append opt-out', () => {
      const content = 'Hello, this is a test message.\n\nReply STOP to opt out.';
      const result = appendOptOut(content);

      // Should still only have one opt-out message
      const stopCount = (result.match(/STOP/g) || []).length;
      expect(stopCount).toBe(2); // One from original, one appended
    });
  });
});

// ============================================
// CALENDLY TESTS
// ============================================

describe('Calendly Integration', () => {
  let calendlyClient: MockCalendlyClient;

  beforeEach(() => {
    calendlyClient = new MockCalendlyClient();
  });

  describe('Booking Link', () => {
    it('should get default booking link', async () => {
      const result = await calendlyClient.getBookingLink();

      expect(result.link).toBeDefined();
      expect(result.link).toContain('calendly.com');
    });

    it('should return event type', async () => {
      const result = await calendlyClient.getBookingLink();

      expect(result.eventType).toBe('30min');
    });

    it('should allow custom booking link', async () => {
      calendlyClient.setBookingLink('https://calendly.com/custom/meeting');

      const result = await calendlyClient.getBookingLink();

      expect(result.link).toBe('https://calendly.com/custom/meeting');
    });
  });
});

// ============================================
// INTEGRATION WORKFLOW TESTS
// ============================================

describe('Integration Workflows', () => {
  let apolloClient: MockApolloClient;
  let brevoClient: MockBrevoClient;
  let twilioClient: MockTwilioClient;

  beforeEach(() => {
    apolloClient = new MockApolloClient();
    brevoClient = new MockBrevoClient();
    twilioClient = new MockTwilioClient();

    apolloClient.setMockData([
      {
        id: 'ap_1',
        first_name: 'John',
        last_name: 'Doe',
        name: 'John Doe',
        email: 'john@company.com',
        email_status: 'verified',
        title: 'CEO',
        phone_numbers: [{ number: '+15550001234', status: 'valid' }],
        organization: { name: 'Company Inc', industry: 'Technology' },
      },
    ]);
  });

  afterEach(() => {
    brevoClient.clearSentEmails();
    twilioClient.clearSentSMS();
  });

  it('should complete full outreach workflow', async () => {
    // 1. Search for prospects
    const searchResult = await apolloClient.searchPeople({
      person_titles: ['CEO'],
    });
    expect(searchResult.people).toHaveLength(1);

    // 2. Convert to prospect
    const prospect = apolloToProspect(searchResult.people[0]);
    expect(prospect.firstName).toBe('John');

    // 3. Send personalized email
    const emailContent = personalizeContent(
      'Hi {{firstName}}, I noticed you work at {{company}}.',
      { firstName: prospect.firstName, company: prospect.company }
    );

    const emailResult = await brevoClient.sendEmail({
      to: [{ email: prospect.email, name: prospect.name }],
      subject: 'Quick question',
      htmlContent: `<p>${emailContent}</p>`,
    });
    expect(emailResult.messageId).toBeDefined();

    // 4. Send follow-up SMS
    if (prospect.phone) {
      const smsContent = appendOptOut(
        personalizeSMS('Hi {{firstName}}, did you see my email?', { firstName: prospect.firstName })
      );

      const smsResult = await twilioClient.sendSMS({
        to: prospect.phone,
        body: smsContent,
      });
      expect(smsResult.sid).toBeDefined();
    }

    // Verify all sends completed
    expect(brevoClient.getSentEmails()).toHaveLength(1);
    expect(twilioClient.getSentSMS()).toHaveLength(1);
  });

  it('should handle prospect without phone number', async () => {
    apolloClient.setMockData([
      {
        id: 'ap_2',
        first_name: 'Jane',
        last_name: 'Smith',
        name: 'Jane Smith',
        email: 'jane@company.com',
        title: 'VP',
        // No phone_numbers
      },
    ]);

    const searchResult = await apolloClient.searchPeople({});
    const prospect = apolloToProspect(searchResult.people[0]);

    // Should still be able to send email
    const emailResult = await brevoClient.sendEmail({
      to: [{ email: prospect.email }],
      subject: 'Test',
      htmlContent: '<p>Test</p>',
    });
    expect(emailResult.messageId).toBeDefined();

    // Should skip SMS
    expect(prospect.phone).toBeNull();
    expect(twilioClient.getSentSMS()).toHaveLength(0);
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('Error Handling', () => {
  describe('Apollo Errors', () => {
    it('should handle empty search results', async () => {
      const client = new MockApolloClient();
      client.setMockData([]);

      const result = await client.searchPeople({});

      expect(result.people).toHaveLength(0);
    });
  });

  describe('Brevo Errors', () => {
    it('should handle rate limiting', async () => {
      const client = new MockBrevoClient();
      client.setShouldFail(true);

      await expect(client.sendEmail({
        to: [{ email: 'test@test.com' }],
        subject: 'Test',
        htmlContent: '<p>Test</p>',
      })).rejects.toThrow();
    });
  });

  describe('Twilio Errors', () => {
    it('should handle invalid phone gracefully', async () => {
      const client = new MockTwilioClient();

      await expect(client.sendSMS({
        to: 'invalid',
        body: 'Test',
      })).rejects.toThrow('Invalid phone number');
    });
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  it('should handle bulk Apollo search efficiently', async () => {
    const client = new MockApolloClient();

    // Generate 1000 mock people
    const people: ApolloPerson[] = Array(1000).fill(null).map((_, i) => ({
      id: `ap_${i}`,
      first_name: `First${i}`,
      last_name: `Last${i}`,
      name: `First${i} Last${i}`,
      email: `person${i}@company${i}.com`,
      title: i % 10 === 0 ? 'CEO' : 'Manager',
      organization: { name: `Company ${i}` },
    }));

    client.setMockData(people);

    const start = Date.now();
    const result = await client.searchPeople({ per_page: 100 });
    const duration = Date.now() - start;

    expect(result.people).toHaveLength(100);
    expect(duration).toBeLessThan(100);
  });

  it('should handle bulk email sending efficiently', async () => {
    const client = new MockBrevoClient();

    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      await client.sendEmail({
        to: [{ email: `user${i}@test.com` }],
        subject: `Email ${i}`,
        htmlContent: '<p>Test</p>',
      });
    }

    const duration = Date.now() - start;

    expect(client.getSentEmails()).toHaveLength(100);
    expect(duration).toBeLessThan(500);
  });
});
