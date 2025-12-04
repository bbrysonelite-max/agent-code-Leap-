/**
 * AI Lead OS - Sequences Service Tests
 * Tests for email/SMS sequence management, enrollment, and processing
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// TYPES
// ============================================

interface SequenceSettings {
  send_window_start: string;
  send_window_end: string;
  send_days: number[];
  timezone: string;
  stop_on_reply: boolean;
  stop_on_meeting_booked: boolean;
  daily_send_limit: number;
}

interface SequenceStats {
  total_enrolled: number;
  active: number;
  completed: number;
  replied: number;
  emails_sent: number;
  sms_sent: number;
}

interface Sequence {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  settings: SequenceSettings;
  stats: SequenceStats;
  steps?: SequenceStep[];
  created_at: Date;
  updated_at: Date;
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  channel: 'email' | 'sms';
  delay_days: number;
  delay_hours: number;
  subject?: string;
  content: string;
  is_active: boolean;
  created_at: Date;
}

interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  lead_id: string;
  status: 'active' | 'paused' | 'completed' | 'replied' | 'unsubscribed';
  current_step: number;
  enrolled_at: Date;
  completed_at?: Date;
  last_activity_at?: Date;
}

interface ScheduledSend {
  id: string;
  enrollment_id: string;
  step_id: string;
  lead_id: string;
  channel: 'email' | 'sms';
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
  scheduled_for: Date;
  sent_at?: Date;
  attempts: number;
  last_error?: string;
}

interface CreateSequenceRequest {
  name: string;
  description?: string;
  settings?: Partial<SequenceSettings>;
  steps: Array<{
    channel: 'email' | 'sms';
    delay_days: number;
    delay_hours?: number;
    subject?: string;
    content: string;
  }>;
}

// ============================================
// MOCK DATABASE
// ============================================

interface MockDB {
  sequences: Sequence[];
  steps: SequenceStep[];
  enrollments: SequenceEnrollment[];
  scheduledSends: ScheduledSend[];
}

let mockDB: MockDB;
let nextSequenceId = 1;
let nextStepId = 1;
let nextEnrollmentId = 1;
let nextSendId = 1;

const DEFAULT_SETTINGS: SequenceSettings = {
  send_window_start: '09:00',
  send_window_end: '17:00',
  send_days: [1, 2, 3, 4, 5],
  timezone: 'America/New_York',
  stop_on_reply: true,
  stop_on_meeting_booked: true,
  daily_send_limit: 100,
};

const DEFAULT_STATS: SequenceStats = {
  total_enrolled: 0,
  active: 0,
  completed: 0,
  replied: 0,
  emails_sent: 0,
  sms_sent: 0,
};

function resetMockDB() {
  mockDB = {
    sequences: [],
    steps: [],
    enrollments: [],
    scheduledSends: [],
  };
  nextSequenceId = 1;
  nextStepId = 1;
  nextEnrollmentId = 1;
  nextSendId = 1;
}

// ============================================
// MOCK SEQUENCE FUNCTIONS
// ============================================

function createSequence(req: CreateSequenceRequest): Sequence {
  const settings = { ...DEFAULT_SETTINGS, ...req.settings };

  const sequence: Sequence = {
    id: `seq_${nextSequenceId++}`,
    name: req.name,
    description: req.description,
    status: 'draft',
    settings,
    stats: { ...DEFAULT_STATS },
    steps: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  mockDB.sequences.push(sequence);

  // Create steps
  req.steps.forEach((stepReq, index) => {
    const step: SequenceStep = {
      id: `step_${nextStepId++}`,
      sequence_id: sequence.id,
      step_order: index + 1,
      channel: stepReq.channel,
      delay_days: stepReq.delay_days,
      delay_hours: stepReq.delay_hours || 0,
      subject: stepReq.subject,
      content: stepReq.content,
      is_active: true,
      created_at: new Date(),
    };
    mockDB.steps.push(step);
    sequence.steps!.push(step);
  });

  return sequence;
}

function getSequenceById(id: string): Sequence | undefined {
  const sequence = mockDB.sequences.find(s => s.id === id);
  if (sequence) {
    sequence.steps = mockDB.steps.filter(s => s.sequence_id === id).sort((a, b) => a.step_order - b.step_order);
  }
  return sequence;
}

function activateSequence(id: string): boolean {
  const sequence = getSequenceById(id);
  if (!sequence) return false;
  sequence.status = 'active';
  sequence.updated_at = new Date();
  return true;
}

function pauseSequence(id: string): boolean {
  const sequence = getSequenceById(id);
  if (!sequence) return false;
  sequence.status = 'paused';
  sequence.updated_at = new Date();
  return true;
}

function enrollLead(sequenceId: string, leadId: string, startImmediately: boolean = true): SequenceEnrollment {
  // Check for existing enrollment
  const existing = mockDB.enrollments.find(e => e.sequence_id === sequenceId && e.lead_id === leadId);
  if (existing) {
    throw new Error('Lead is already enrolled in this sequence');
  }

  const enrollment: SequenceEnrollment = {
    id: `enroll_${nextEnrollmentId++}`,
    sequence_id: sequenceId,
    lead_id: leadId,
    status: 'active',
    current_step: 0,
    enrolled_at: new Date(),
  };

  mockDB.enrollments.push(enrollment);

  // Update sequence stats
  const sequence = getSequenceById(sequenceId);
  if (sequence) {
    sequence.stats.total_enrolled++;
    sequence.stats.active++;
  }

  // Schedule first step if immediate
  if (startImmediately) {
    scheduleNextStep(enrollment.id);
  }

  return enrollment;
}

function scheduleNextStep(enrollmentId: string): ScheduledSend | null {
  const enrollment = mockDB.enrollments.find(e => e.id === enrollmentId);
  if (!enrollment || enrollment.status !== 'active') return null;

  const sequence = getSequenceById(enrollment.sequence_id);
  if (!sequence || !sequence.steps) return null;

  const nextStep = sequence.steps.find(s => s.step_order === enrollment.current_step + 1 && s.is_active);
  if (!nextStep) {
    // Complete enrollment
    enrollment.status = 'completed';
    enrollment.completed_at = new Date();
    if (sequence) {
      sequence.stats.active--;
      sequence.stats.completed++;
    }
    return null;
  }

  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + nextStep.delay_days);
  scheduledFor.setHours(scheduledFor.getHours() + nextStep.delay_hours);

  const send: ScheduledSend = {
    id: `send_${nextSendId++}`,
    enrollment_id: enrollment.id,
    step_id: nextStep.id,
    lead_id: enrollment.lead_id,
    channel: nextStep.channel,
    status: 'scheduled',
    scheduled_for: scheduledFor,
    attempts: 0,
  };

  mockDB.scheduledSends.push(send);
  return send;
}

function processSend(sendId: string, success: boolean = true): boolean {
  const send = mockDB.scheduledSends.find(s => s.id === sendId);
  if (!send || send.status !== 'scheduled') return false;

  const enrollment = mockDB.enrollments.find(e => e.id === send.enrollment_id);
  if (!enrollment) return false;

  const sequence = getSequenceById(enrollment.sequence_id);

  if (success) {
    send.status = 'sent';
    send.sent_at = new Date();
    enrollment.current_step++;
    enrollment.last_activity_at = new Date();

    if (sequence) {
      if (send.channel === 'email') {
        sequence.stats.emails_sent++;
      } else {
        sequence.stats.sms_sent++;
      }
    }

    scheduleNextStep(enrollment.id);
  } else {
    send.status = 'failed';
    send.attempts++;
    send.last_error = 'Send failed';
  }

  return true;
}

function handleReply(leadId: string): boolean {
  const enrollment = mockDB.enrollments.find(e => e.lead_id === leadId && e.status === 'active');
  if (!enrollment) return false;

  // Cancel pending sends
  mockDB.scheduledSends
    .filter(s => s.enrollment_id === enrollment.id && s.status === 'scheduled')
    .forEach(s => { s.status = 'cancelled'; });

  enrollment.status = 'replied';

  const sequence = getSequenceById(enrollment.sequence_id);
  if (sequence) {
    sequence.stats.active--;
    sequence.stats.replied++;
  }

  return true;
}

function unenrollLead(enrollmentId: string): boolean {
  const enrollment = mockDB.enrollments.find(e => e.id === enrollmentId);
  if (!enrollment) return false;

  // Cancel pending sends
  mockDB.scheduledSends
    .filter(s => s.enrollment_id === enrollmentId && s.status === 'scheduled')
    .forEach(s => { s.status = 'cancelled'; });

  enrollment.status = 'completed';
  enrollment.completed_at = new Date();

  const sequence = getSequenceById(enrollment.sequence_id);
  if (sequence) {
    sequence.stats.active--;
  }

  return true;
}

// ============================================
// SEQUENCE TESTS
// ============================================

describe('Sequence Management', () => {
  beforeEach(() => {
    resetMockDB();
  });

  afterEach(() => {
    resetMockDB();
  });

  describe('Sequence Creation', () => {
    it('should create a sequence with steps', () => {
      const sequence = createSequence({
        name: 'Welcome Sequence',
        description: 'Onboarding sequence for new leads',
        steps: [
          { channel: 'email', delay_days: 0, subject: 'Welcome!', content: 'Hello {{firstName}}' },
          { channel: 'email', delay_days: 2, subject: 'Follow up', content: 'Just checking in...' },
          { channel: 'sms', delay_days: 5, content: 'Hi {{firstName}}, any questions?' },
        ],
      });

      expect(sequence.id).toBeDefined();
      expect(sequence.name).toBe('Welcome Sequence');
      expect(sequence.status).toBe('draft');
      expect(sequence.steps).toHaveLength(3);
    });

    it('should apply default settings', () => {
      const sequence = createSequence({
        name: 'Test Sequence',
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.send_window_start).toBe('09:00');
      expect(sequence.settings.send_window_end).toBe('17:00');
      expect(sequence.settings.send_days).toEqual([1, 2, 3, 4, 5]);
      expect(sequence.settings.stop_on_reply).toBe(true);
    });

    it('should override default settings', () => {
      const sequence = createSequence({
        name: 'Custom Sequence',
        settings: {
          send_window_start: '08:00',
          send_window_end: '20:00',
          send_days: [1, 2, 3, 4, 5, 6],
          daily_send_limit: 200,
        },
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.send_window_start).toBe('08:00');
      expect(sequence.settings.send_window_end).toBe('20:00');
      expect(sequence.settings.send_days).toHaveLength(6);
      expect(sequence.settings.daily_send_limit).toBe(200);
    });

    it('should initialize stats to zero', () => {
      const sequence = createSequence({
        name: 'Test',
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.stats.total_enrolled).toBe(0);
      expect(sequence.stats.active).toBe(0);
      expect(sequence.stats.completed).toBe(0);
      expect(sequence.stats.replied).toBe(0);
      expect(sequence.stats.emails_sent).toBe(0);
      expect(sequence.stats.sms_sent).toBe(0);
    });

    it('should order steps correctly', () => {
      const sequence = createSequence({
        name: 'Multi-step',
        steps: [
          { channel: 'email', delay_days: 0, content: 'Step 1' },
          { channel: 'email', delay_days: 2, content: 'Step 2' },
          { channel: 'sms', delay_days: 4, content: 'Step 3' },
          { channel: 'email', delay_days: 7, content: 'Step 4' },
        ],
      });

      expect(sequence.steps![0].step_order).toBe(1);
      expect(sequence.steps![1].step_order).toBe(2);
      expect(sequence.steps![2].step_order).toBe(3);
      expect(sequence.steps![3].step_order).toBe(4);
    });
  });

  describe('Sequence Lifecycle', () => {
    it('should activate a draft sequence', () => {
      const sequence = createSequence({
        name: 'Test',
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.status).toBe('draft');

      const result = activateSequence(sequence.id);

      expect(result).toBe(true);
      expect(sequence.status).toBe('active');
    });

    it('should pause an active sequence', () => {
      const sequence = createSequence({
        name: 'Test',
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      activateSequence(sequence.id);
      const result = pauseSequence(sequence.id);

      expect(result).toBe(true);
      expect(sequence.status).toBe('paused');
    });

    it('should list sequences by status', () => {
      createSequence({ name: 'Draft 1', steps: [{ channel: 'email', delay_days: 0, content: 'Test' }] });
      createSequence({ name: 'Draft 2', steps: [{ channel: 'email', delay_days: 0, content: 'Test' }] });

      const seq3 = createSequence({ name: 'Active 1', steps: [{ channel: 'email', delay_days: 0, content: 'Test' }] });
      activateSequence(seq3.id);

      const drafts = mockDB.sequences.filter(s => s.status === 'draft');
      const active = mockDB.sequences.filter(s => s.status === 'active');

      expect(drafts).toHaveLength(2);
      expect(active).toHaveLength(1);
    });
  });
});

// ============================================
// ENROLLMENT TESTS
// ============================================

describe('Sequence Enrollment', () => {
  let testSequence: Sequence;

  beforeEach(() => {
    resetMockDB();
    testSequence = createSequence({
      name: 'Test Sequence',
      steps: [
        { channel: 'email', delay_days: 0, subject: 'Welcome', content: 'Hello!' },
        { channel: 'email', delay_days: 3, subject: 'Follow up', content: 'Checking in' },
        { channel: 'sms', delay_days: 7, content: 'Any questions?' },
      ],
    });
    activateSequence(testSequence.id);
  });

  describe('Lead Enrollment', () => {
    it('should enroll a lead in a sequence', () => {
      const enrollment = enrollLead(testSequence.id, 'lead_1');

      expect(enrollment.id).toBeDefined();
      expect(enrollment.sequence_id).toBe(testSequence.id);
      expect(enrollment.lead_id).toBe('lead_1');
      expect(enrollment.status).toBe('active');
      expect(enrollment.current_step).toBe(0);
    });

    it('should update sequence stats on enrollment', () => {
      enrollLead(testSequence.id, 'lead_1');
      enrollLead(testSequence.id, 'lead_2');

      const sequence = getSequenceById(testSequence.id);
      expect(sequence?.stats.total_enrolled).toBe(2);
      expect(sequence?.stats.active).toBe(2);
    });

    it('should prevent duplicate enrollment', () => {
      enrollLead(testSequence.id, 'lead_1');

      expect(() => enrollLead(testSequence.id, 'lead_1')).toThrow('Lead is already enrolled');
    });

    it('should schedule first step on enrollment', () => {
      enrollLead(testSequence.id, 'lead_1');

      const sends = mockDB.scheduledSends.filter(s => s.lead_id === 'lead_1');
      expect(sends).toHaveLength(1);
      expect(sends[0].status).toBe('scheduled');
    });

    it('should not schedule if start_immediately is false', () => {
      enrollLead(testSequence.id, 'lead_1', false);

      const sends = mockDB.scheduledSends.filter(s => s.lead_id === 'lead_1');
      expect(sends).toHaveLength(0);
    });
  });

  describe('Bulk Enrollment', () => {
    it('should enroll multiple leads', () => {
      const leadIds = ['lead_1', 'lead_2', 'lead_3', 'lead_4', 'lead_5'];

      leadIds.forEach(id => enrollLead(testSequence.id, id));

      expect(mockDB.enrollments).toHaveLength(5);
      expect(testSequence.stats.total_enrolled).toBe(5);
    });

    it('should skip already enrolled leads', () => {
      enrollLead(testSequence.id, 'lead_1');

      let enrolled = 0;
      let skipped = 0;

      ['lead_1', 'lead_2', 'lead_3'].forEach(id => {
        try {
          enrollLead(testSequence.id, id);
          enrolled++;
        } catch {
          skipped++;
        }
      });

      expect(enrolled).toBe(2);
      expect(skipped).toBe(1);
    });
  });

  describe('Unenrollment', () => {
    it('should unenroll a lead', () => {
      const enrollment = enrollLead(testSequence.id, 'lead_1');

      const result = unenrollLead(enrollment.id);

      expect(result).toBe(true);
      expect(enrollment.status).toBe('completed');
      expect(enrollment.completed_at).toBeDefined();
    });

    it('should cancel pending sends on unenrollment', () => {
      const enrollment = enrollLead(testSequence.id, 'lead_1');

      unenrollLead(enrollment.id);

      const sends = mockDB.scheduledSends.filter(s => s.enrollment_id === enrollment.id);
      expect(sends.every(s => s.status === 'cancelled')).toBe(true);
    });

    it('should update sequence stats on unenrollment', () => {
      const enrollment = enrollLead(testSequence.id, 'lead_1');
      expect(testSequence.stats.active).toBe(1);

      unenrollLead(enrollment.id);
      expect(testSequence.stats.active).toBe(0);
    });
  });
});

// ============================================
// SEND PROCESSING TESTS
// ============================================

describe('Send Processing', () => {
  let testSequence: Sequence;

  beforeEach(() => {
    resetMockDB();
    testSequence = createSequence({
      name: 'Test Sequence',
      steps: [
        { channel: 'email', delay_days: 0, subject: 'Step 1', content: 'Content 1' },
        { channel: 'email', delay_days: 2, subject: 'Step 2', content: 'Content 2' },
        { channel: 'sms', delay_days: 4, content: 'SMS content' },
      ],
    });
    activateSequence(testSequence.id);
  });

  describe('Successful Send', () => {
    it('should mark send as sent', () => {
      enrollLead(testSequence.id, 'lead_1');
      const send = mockDB.scheduledSends[0];

      processSend(send.id, true);

      expect(send.status).toBe('sent');
      expect(send.sent_at).toBeDefined();
    });

    it('should advance enrollment current_step', () => {
      const enrollment = enrollLead(testSequence.id, 'lead_1');
      const send = mockDB.scheduledSends[0];

      expect(enrollment.current_step).toBe(0);

      processSend(send.id, true);

      expect(enrollment.current_step).toBe(1);
    });

    it('should schedule next step after send', () => {
      enrollLead(testSequence.id, 'lead_1');
      const send = mockDB.scheduledSends[0];

      processSend(send.id, true);

      const pendingSends = mockDB.scheduledSends.filter(s => s.status === 'scheduled');
      expect(pendingSends).toHaveLength(1);
    });

    it('should update email stats', () => {
      enrollLead(testSequence.id, 'lead_1');
      const send = mockDB.scheduledSends[0];

      processSend(send.id, true);

      expect(testSequence.stats.emails_sent).toBe(1);
    });

    it('should update SMS stats', () => {
      enrollLead(testSequence.id, 'lead_1');

      // Process first two emails
      processSend(mockDB.scheduledSends[0].id, true);
      processSend(mockDB.scheduledSends[1].id, true);

      // Process SMS
      const smsSend = mockDB.scheduledSends.find(s => s.channel === 'sms' && s.status === 'scheduled');
      processSend(smsSend!.id, true);

      expect(testSequence.stats.sms_sent).toBe(1);
    });
  });

  describe('Failed Send', () => {
    it('should mark send as failed', () => {
      enrollLead(testSequence.id, 'lead_1');
      const send = mockDB.scheduledSends[0];

      processSend(send.id, false);

      expect(send.status).toBe('failed');
      expect(send.attempts).toBe(1);
      expect(send.last_error).toBeDefined();
    });

    it('should not advance step on failure', () => {
      const enrollment = enrollLead(testSequence.id, 'lead_1');
      const send = mockDB.scheduledSends[0];

      processSend(send.id, false);

      expect(enrollment.current_step).toBe(0);
    });
  });

  describe('Sequence Completion', () => {
    it('should complete enrollment after all steps', () => {
      const enrollment = enrollLead(testSequence.id, 'lead_1');

      // Process all three steps
      processSend(mockDB.scheduledSends[0].id, true);
      processSend(mockDB.scheduledSends[1].id, true);
      processSend(mockDB.scheduledSends[2].id, true);

      expect(enrollment.status).toBe('completed');
      expect(enrollment.completed_at).toBeDefined();
    });

    it('should update stats on completion', () => {
      enrollLead(testSequence.id, 'lead_1');

      processSend(mockDB.scheduledSends[0].id, true);
      processSend(mockDB.scheduledSends[1].id, true);
      processSend(mockDB.scheduledSends[2].id, true);

      expect(testSequence.stats.completed).toBe(1);
      expect(testSequence.stats.active).toBe(0);
    });
  });
});

// ============================================
// REPLY HANDLING TESTS
// ============================================

describe('Reply Handling', () => {
  let testSequence: Sequence;

  beforeEach(() => {
    resetMockDB();
    testSequence = createSequence({
      name: 'Test Sequence',
      steps: [
        { channel: 'email', delay_days: 0, content: 'Step 1' },
        { channel: 'email', delay_days: 2, content: 'Step 2' },
        { channel: 'email', delay_days: 4, content: 'Step 3' },
      ],
    });
    activateSequence(testSequence.id);
  });

  it('should mark enrollment as replied', () => {
    const enrollment = enrollLead(testSequence.id, 'lead_1');
    processSend(mockDB.scheduledSends[0].id, true);

    handleReply('lead_1');

    expect(enrollment.status).toBe('replied');
  });

  it('should cancel pending sends on reply', () => {
    enrollLead(testSequence.id, 'lead_1');
    processSend(mockDB.scheduledSends[0].id, true);

    handleReply('lead_1');

    const pendingSends = mockDB.scheduledSends.filter(s => s.status === 'scheduled');
    expect(pendingSends).toHaveLength(0);
  });

  it('should update sequence stats on reply', () => {
    enrollLead(testSequence.id, 'lead_1');

    handleReply('lead_1');

    expect(testSequence.stats.replied).toBe(1);
    expect(testSequence.stats.active).toBe(0);
  });

  it('should return false for non-enrolled lead', () => {
    const result = handleReply('lead_not_enrolled');
    expect(result).toBe(false);
  });
});

// ============================================
// STEP CONFIGURATION TESTS
// ============================================

describe('Step Configuration', () => {
  beforeEach(() => {
    resetMockDB();
  });

  describe('Channel Types', () => {
    it('should support email channel', () => {
      const sequence = createSequence({
        name: 'Email Only',
        steps: [
          { channel: 'email', delay_days: 0, subject: 'Subject', content: 'Body' },
        ],
      });

      expect(sequence.steps![0].channel).toBe('email');
      expect(sequence.steps![0].subject).toBe('Subject');
    });

    it('should support SMS channel', () => {
      const sequence = createSequence({
        name: 'SMS Only',
        steps: [
          { channel: 'sms', delay_days: 0, content: 'SMS message' },
        ],
      });

      expect(sequence.steps![0].channel).toBe('sms');
      expect(sequence.steps![0].subject).toBeUndefined();
    });

    it('should support mixed channels', () => {
      const sequence = createSequence({
        name: 'Mixed',
        steps: [
          { channel: 'email', delay_days: 0, content: 'Email' },
          { channel: 'sms', delay_days: 1, content: 'SMS' },
          { channel: 'email', delay_days: 2, content: 'Email 2' },
        ],
      });

      expect(sequence.steps![0].channel).toBe('email');
      expect(sequence.steps![1].channel).toBe('sms');
      expect(sequence.steps![2].channel).toBe('email');
    });
  });

  describe('Delay Configuration', () => {
    it('should handle zero delay (immediate)', () => {
      const sequence = createSequence({
        name: 'Immediate',
        steps: [{ channel: 'email', delay_days: 0, content: 'Now!' }],
      });

      expect(sequence.steps![0].delay_days).toBe(0);
    });

    it('should handle multi-day delays', () => {
      const sequence = createSequence({
        name: 'Long Delays',
        steps: [
          { channel: 'email', delay_days: 0, content: 'Day 0' },
          { channel: 'email', delay_days: 7, content: 'Day 7' },
          { channel: 'email', delay_days: 14, content: 'Day 14' },
        ],
      });

      expect(sequence.steps![1].delay_days).toBe(7);
      expect(sequence.steps![2].delay_days).toBe(14);
    });

    it('should handle hour delays', () => {
      const sequence = createSequence({
        name: 'Hour Delays',
        steps: [
          { channel: 'email', delay_days: 0, delay_hours: 2, content: '2 hours later' },
        ],
      });

      expect(sequence.steps![0].delay_hours).toBe(2);
    });
  });

  describe('Content Personalization', () => {
    it('should preserve template variables', () => {
      const sequence = createSequence({
        name: 'Personalized',
        steps: [
          {
            channel: 'email',
            delay_days: 0,
            subject: 'Hi {{firstName}}!',
            content: 'Hello {{firstName}}, I noticed you work at {{company}}...',
          },
        ],
      });

      expect(sequence.steps![0].content).toContain('{{firstName}}');
      expect(sequence.steps![0].content).toContain('{{company}}');
    });
  });
});

// ============================================
// SETTINGS TESTS
// ============================================

describe('Sequence Settings', () => {
  beforeEach(() => {
    resetMockDB();
  });

  describe('Send Window', () => {
    it('should configure send window times', () => {
      const sequence = createSequence({
        name: 'Custom Window',
        settings: {
          send_window_start: '07:00',
          send_window_end: '21:00',
        },
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.send_window_start).toBe('07:00');
      expect(sequence.settings.send_window_end).toBe('21:00');
    });
  });

  describe('Send Days', () => {
    it('should configure weekday-only sending', () => {
      const sequence = createSequence({
        name: 'Weekdays',
        settings: { send_days: [1, 2, 3, 4, 5] },
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.send_days).not.toContain(0); // Sunday
      expect(sequence.settings.send_days).not.toContain(6); // Saturday
    });

    it('should configure weekend sending', () => {
      const sequence = createSequence({
        name: 'All Days',
        settings: { send_days: [0, 1, 2, 3, 4, 5, 6] },
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.send_days).toHaveLength(7);
    });
  });

  describe('Stop Conditions', () => {
    it('should configure stop on reply', () => {
      const sequence = createSequence({
        name: 'Stop on Reply',
        settings: { stop_on_reply: true },
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.stop_on_reply).toBe(true);
    });

    it('should configure continue on reply', () => {
      const sequence = createSequence({
        name: 'Continue on Reply',
        settings: { stop_on_reply: false },
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.stop_on_reply).toBe(false);
    });

    it('should configure stop on meeting booked', () => {
      const sequence = createSequence({
        name: 'Stop on Meeting',
        settings: { stop_on_meeting_booked: true },
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.stop_on_meeting_booked).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should configure daily send limit', () => {
      const sequence = createSequence({
        name: 'Limited',
        settings: { daily_send_limit: 50 },
        steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
      });

      expect(sequence.settings.daily_send_limit).toBe(50);
    });
  });
});

// ============================================
// STATS & ANALYTICS TESTS
// ============================================

describe('Sequence Statistics', () => {
  let testSequence: Sequence;

  beforeEach(() => {
    resetMockDB();
    testSequence = createSequence({
      name: 'Stats Test',
      steps: [
        { channel: 'email', delay_days: 0, content: 'Step 1' },
        { channel: 'email', delay_days: 2, content: 'Step 2' },
      ],
    });
    activateSequence(testSequence.id);
  });

  it('should track total enrolled', () => {
    enrollLead(testSequence.id, 'lead_1');
    enrollLead(testSequence.id, 'lead_2');
    enrollLead(testSequence.id, 'lead_3');

    expect(testSequence.stats.total_enrolled).toBe(3);
  });

  it('should track active enrollments', () => {
    enrollLead(testSequence.id, 'lead_1');
    enrollLead(testSequence.id, 'lead_2');
    const e3 = enrollLead(testSequence.id, 'lead_3');

    unenrollLead(e3.id);

    expect(testSequence.stats.active).toBe(2);
  });

  it('should track completed enrollments', () => {
    enrollLead(testSequence.id, 'lead_1');

    // Complete sequence
    processSend(mockDB.scheduledSends[0].id, true);
    processSend(mockDB.scheduledSends[1].id, true);

    expect(testSequence.stats.completed).toBe(1);
  });

  it('should track replied count', () => {
    enrollLead(testSequence.id, 'lead_1');
    enrollLead(testSequence.id, 'lead_2');

    handleReply('lead_1');

    expect(testSequence.stats.replied).toBe(1);
  });

  it('should track emails sent', () => {
    enrollLead(testSequence.id, 'lead_1');

    processSend(mockDB.scheduledSends[0].id, true);

    expect(testSequence.stats.emails_sent).toBe(1);
  });

  it('should calculate response rate', () => {
    enrollLead(testSequence.id, 'lead_1');
    enrollLead(testSequence.id, 'lead_2');
    enrollLead(testSequence.id, 'lead_3');
    enrollLead(testSequence.id, 'lead_4');

    handleReply('lead_1');

    const responseRate = testSequence.stats.replied / testSequence.stats.total_enrolled;
    expect(responseRate).toBe(0.25);
  });
});

// ============================================
// EDGE CASES
// ============================================

describe('Edge Cases', () => {
  beforeEach(() => {
    resetMockDB();
  });

  it('should handle sequence with single step', () => {
    const sequence = createSequence({
      name: 'Single Step',
      steps: [{ channel: 'email', delay_days: 0, content: 'Only step' }],
    });

    activateSequence(sequence.id);
    const enrollment = enrollLead(sequence.id, 'lead_1');

    processSend(mockDB.scheduledSends[0].id, true);

    expect(enrollment.status).toBe('completed');
  });

  it('should handle rapid enrollment', () => {
    const sequence = createSequence({
      name: 'Rapid',
      steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
    });
    activateSequence(sequence.id);

    for (let i = 0; i < 100; i++) {
      enrollLead(sequence.id, `lead_${i}`);
    }

    expect(mockDB.enrollments).toHaveLength(100);
    expect(sequence.stats.total_enrolled).toBe(100);
  });

  it('should handle empty step content gracefully', () => {
    const sequence = createSequence({
      name: 'Empty Content',
      steps: [{ channel: 'email', delay_days: 0, content: '' }],
    });

    expect(sequence.steps![0].content).toBe('');
  });

  it('should handle very long delays', () => {
    const sequence = createSequence({
      name: 'Long Delay',
      steps: [{ channel: 'email', delay_days: 365, content: 'Year later' }],
    });

    expect(sequence.steps![0].delay_days).toBe(365);
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  beforeEach(() => {
    resetMockDB();
  });

  it('should handle 1000 enrollments efficiently', () => {
    const sequence = createSequence({
      name: 'Bulk Test',
      steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
    });
    activateSequence(sequence.id);

    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      enrollLead(sequence.id, `lead_${i}`);
    }

    const duration = Date.now() - start;

    expect(mockDB.enrollments).toHaveLength(1000);
    expect(duration).toBeLessThan(1000);
  });

  it('should process many sends efficiently', () => {
    const sequence = createSequence({
      name: 'Process Test',
      steps: [{ channel: 'email', delay_days: 0, content: 'Test' }],
    });
    activateSequence(sequence.id);

    for (let i = 0; i < 100; i++) {
      enrollLead(sequence.id, `lead_${i}`);
    }

    const start = Date.now();

    mockDB.scheduledSends.forEach(send => {
      processSend(send.id, true);
    });

    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
  });
});
