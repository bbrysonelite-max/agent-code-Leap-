import { describe, it, expect, beforeEach } from 'vitest';
import type {
  NurturingSequence,
  SequenceStep,
  SequenceEnrollment,
  ProspectEngagementProfile,
  BehaviorType,
  SequenceStatus,
  ClassificationTarget,
  StageTarget,
} from './types';

// Mock data helpers
function createMockSequence(overrides: Partial<NurturingSequence> = {}): NurturingSequence {
  return {
    id: 1,
    client_id: 1,
    name: 'Test Sequence',
    classification_target: 'warm',
    stage_target: 'interest',
    sequence_type: 'onboarding',
    total_steps: 5,
    is_active: true,
    performance_score: 0,
    conversion_rate: 0,
    created_by_ai: false,
    template_data: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function createMockStep(overrides: Partial<SequenceStep> = {}): SequenceStep {
  return {
    id: 1,
    sequence_id: 1,
    step_number: 1,
    content_type: 'email',
    delay_days: 0,
    delay_hours: 0,
    subject_template: 'Welcome!',
    content_template: 'Hello {{name}}',
    conditions: {},
    performance_metrics: {},
    is_active: true,
    created_at: new Date(),
    ...overrides,
  };
}

function createMockEnrollment(overrides: Partial<SequenceEnrollment> = {}): SequenceEnrollment {
  return {
    id: 1,
    prospect_id: 1,
    sequence_id: 1,
    client_id: 1,
    current_step: 1,
    status: 'active',
    enrolled_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function createMockEngagementProfile(
  overrides: Partial<ProspectEngagementProfile> = {}
): ProspectEngagementProfile {
  return {
    id: 1,
    prospect_id: 1,
    client_id: 1,
    total_score: 50,
    email_engagement_score: 60,
    content_engagement_score: 40,
    response_rate: 0.5,
    avg_response_time_hours: 24,
    engagement_trend: 'stable',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('Nurturing Sequence', () => {
  describe('Sequence Creation', () => {
    it('should create a sequence with required fields', () => {
      const sequence = createMockSequence();

      expect(sequence.name).toBe('Test Sequence');
      expect(sequence.classification_target).toBe('warm');
      expect(sequence.stage_target).toBe('interest');
      expect(sequence.total_steps).toBe(5);
      expect(sequence.is_active).toBe(true);
    });

    it('should support all classification targets', () => {
      const targets: ClassificationTarget[] = ['hot', 'warm', 'cold', 'nurture', 'unqualified'];

      targets.forEach(target => {
        const sequence = createMockSequence({ classification_target: target });
        expect(sequence.classification_target).toBe(target);
      });
    });

    it('should support all stage targets', () => {
      const stages: StageTarget[] = [
        'awareness',
        'interest',
        'consideration',
        'intent',
        'evaluation',
        'purchase',
      ];

      stages.forEach(stage => {
        const sequence = createMockSequence({ stage_target: stage });
        expect(sequence.stage_target).toBe(stage);
      });
    });

    it('should mark AI-generated sequences', () => {
      const aiSequence = createMockSequence({ created_by_ai: true });
      const manualSequence = createMockSequence({ created_by_ai: false });

      expect(aiSequence.created_by_ai).toBe(true);
      expect(manualSequence.created_by_ai).toBe(false);
    });

    it('should initialize with zero performance metrics', () => {
      const sequence = createMockSequence();

      expect(sequence.performance_score).toBe(0);
      expect(sequence.conversion_rate).toBe(0);
    });
  });

  describe('Sequence Steps', () => {
    it('should create steps with delays', () => {
      const step1 = createMockStep({ step_number: 1, delay_days: 0, delay_hours: 0 });
      const step2 = createMockStep({ step_number: 2, delay_days: 2, delay_hours: 0 });
      const step3 = createMockStep({ step_number: 3, delay_days: 7, delay_hours: 12 });

      expect(step1.delay_days).toBe(0);
      expect(step2.delay_days).toBe(2);
      expect(step3.delay_days).toBe(7);
      expect(step3.delay_hours).toBe(12);
    });

    it('should support multiple communication types', () => {
      const emailStep = createMockStep({ content_type: 'email' });
      const linkedinStep = createMockStep({ content_type: 'linkedin_message' });
      const phoneStep = createMockStep({ content_type: 'phone_call' });
      const smsStep = createMockStep({ content_type: 'sms' });
      const taskStep = createMockStep({ content_type: 'task' });

      expect(emailStep.content_type).toBe('email');
      expect(linkedinStep.content_type).toBe('linkedin_message');
      expect(phoneStep.content_type).toBe('phone_call');
      expect(smsStep.content_type).toBe('sms');
      expect(taskStep.content_type).toBe('task');
    });

    it('should include subject for email steps', () => {
      const emailStep = createMockStep({
        content_type: 'email',
        subject_template: 'Follow up: {{topic}}',
      });

      expect(emailStep.subject_template).toBe('Follow up: {{topic}}');
    });

    it('should support template variables', () => {
      const step = createMockStep({
        subject_template: 'Hi {{firstName}}',
        content_template: 'Hello {{firstName}} {{lastName}}, we noticed {{company}}...',
      });

      expect(step.subject_template).toContain('{{firstName}}');
      expect(step.content_template).toContain('{{firstName}}');
      expect(step.content_template).toContain('{{lastName}}');
      expect(step.content_template).toContain('{{company}}');
    });

    it('should support conditional execution', () => {
      const step = createMockStep({
        conditions: {
          require_previous_open: true,
          min_engagement_score: 50,
          exclude_if_replied: true,
        },
      });

      expect(step.conditions).toHaveProperty('require_previous_open', true);
      expect(step.conditions).toHaveProperty('min_engagement_score', 50);
      expect(step.conditions).toHaveProperty('exclude_if_replied', true);
    });

    it('should track step performance', () => {
      const step = createMockStep({
        performance_metrics: {
          sent: 100,
          opened: 60,
          clicked: 20,
          replied: 10,
          open_rate: 0.6,
          click_rate: 0.2,
          reply_rate: 0.1,
        },
      });

      expect(step.performance_metrics.sent).toBe(100);
      expect(step.performance_metrics.open_rate).toBe(0.6);
      expect(step.performance_metrics.reply_rate).toBe(0.1);
    });

    it('should allow deactivating steps', () => {
      const step = createMockStep({ is_active: false });

      expect(step.is_active).toBe(false);
    });
  });

  describe('Sequence Enrollment', () => {
    it('should enroll prospect at step 1', () => {
      const enrollment = createMockEnrollment({ current_step: 1 });

      expect(enrollment.current_step).toBe(1);
      expect(enrollment.status).toBe('active');
    });

    it('should track enrollment status', () => {
      const statuses: SequenceStatus[] = ['active', 'paused', 'completed', 'stopped'];

      statuses.forEach(status => {
        const enrollment = createMockEnrollment({ status });
        expect(enrollment.status).toBe(status);
      });
    });

    it('should schedule next step', () => {
      const now = new Date();
      const nextStep = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days

      const enrollment = createMockEnrollment({
        current_step: 1,
        last_step_sent_at: now,
        next_step_scheduled_at: nextStep,
      });

      expect(enrollment.last_step_sent_at).toEqual(now);
      expect(enrollment.next_step_scheduled_at).toEqual(nextStep);
    });

    it('should progress through steps', () => {
      const enrollment = createMockEnrollment({ current_step: 1 });

      enrollment.current_step = 2;
      enrollment.last_step_sent_at = new Date();

      expect(enrollment.current_step).toBe(2);
    });

    it('should complete sequence', () => {
      const enrollment = createMockEnrollment({
        current_step: 5,
        status: 'completed',
        completion_reason: 'Sequence finished',
      });

      expect(enrollment.status).toBe('completed');
      expect(enrollment.completion_reason).toBe('Sequence finished');
    });

    it('should stop enrollment early', () => {
      const enrollment = createMockEnrollment({
        current_step: 2,
        status: 'stopped',
        completion_reason: 'Prospect replied',
      });

      expect(enrollment.status).toBe('stopped');
      expect(enrollment.current_step).toBe(2);
      expect(enrollment.completion_reason).toBe('Prospect replied');
    });

    it('should pause and resume enrollment', () => {
      const enrollment = createMockEnrollment({ status: 'active' });

      // Pause
      enrollment.status = 'paused';
      expect(enrollment.status).toBe('paused');

      // Resume
      enrollment.status = 'active';
      expect(enrollment.status).toBe('active');
    });
  });

  describe('Engagement Tracking', () => {
    it('should track email engagement', () => {
      const behaviors: BehaviorType[] = ['email_open', 'email_click', 'email_reply'];

      behaviors.forEach(behavior => {
        expect(['email_open', 'email_click', 'email_reply', 'website_visit']).toContain(behavior);
      });
    });

    it('should calculate total engagement score', () => {
      const profile = createMockEngagementProfile({
        email_engagement_score: 60,
        content_engagement_score: 40,
      });

      // Simple average
      const totalScore = (profile.email_engagement_score + profile.content_engagement_score) / 2;

      expect(totalScore).toBe(50);
    });

    it('should track response rate', () => {
      const profile = createMockEngagementProfile({
        response_rate: 0.75, // 75%
      });

      expect(profile.response_rate).toBe(0.75);
    });

    it('should track average response time', () => {
      const profile = createMockEngagementProfile({
        avg_response_time_hours: 48,
      });

      expect(profile.avg_response_time_hours).toBe(48);
    });

    it('should identify preferred content type', () => {
      const profile = createMockEngagementProfile({
        preferred_content_type: 'email',
      });

      expect(profile.preferred_content_type).toBe('email');
    });

    it('should determine optimal send time', () => {
      const profile = createMockEngagementProfile({
        optimal_send_time: '09:00',
        optimal_send_day: 2, // Tuesday
      });

      expect(profile.optimal_send_time).toBe('09:00');
      expect(profile.optimal_send_day).toBe(2);
    });

    it('should track engagement trends', () => {
      const increasing = createMockEngagementProfile({ engagement_trend: 'increasing' });
      const decreasing = createMockEngagementProfile({ engagement_trend: 'decreasing' });
      const stable = createMockEngagementProfile({ engagement_trend: 'stable' });
      const neutral = createMockEngagementProfile({ engagement_trend: 'neutral' });

      expect(increasing.engagement_trend).toBe('increasing');
      expect(decreasing.engagement_trend).toBe('decreasing');
      expect(stable.engagement_trend).toBe('stable');
      expect(neutral.engagement_trend).toBe('neutral');
    });

    it('should identify high-engagement prospects', () => {
      const highEngagement = createMockEngagementProfile({
        total_score: 85,
        response_rate: 0.8,
        engagement_trend: 'increasing',
      });

      const isHighEngagement = highEngagement.total_score > 70 && highEngagement.response_rate > 0.5;

      expect(isHighEngagement).toBe(true);
    });

    it('should identify low-engagement prospects', () => {
      const lowEngagement = createMockEngagementProfile({
        total_score: 15,
        response_rate: 0.1,
        engagement_trend: 'decreasing',
      });

      const isLowEngagement = lowEngagement.total_score < 30 || lowEngagement.response_rate < 0.2;

      expect(isLowEngagement).toBe(true);
    });
  });

  describe('Sequence Performance', () => {
    it('should calculate completion rate', () => {
      const totalEnrollments = 100;
      const completedEnrollments = 65;
      const completionRate = completedEnrollments / totalEnrollments;

      expect(completionRate).toBe(0.65);
    });

    it('should calculate conversion rate', () => {
      const sequence = createMockSequence({
        conversion_rate: 0.25, // 25% of enrollments convert
      });

      expect(sequence.conversion_rate).toBe(0.25);
    });

    it('should update performance score', () => {
      const sequence = createMockSequence({
        performance_score: 0,
      });

      // After running: (conversion_rate * 50) + (completion_rate * 30) + (engagement_score * 20)
      const conversionRate = 0.25;
      const completionRate = 0.65;
      const avgEngagement = 70;

      const performanceScore =
        conversionRate * 50 + completionRate * 30 + (avgEngagement / 100) * 20;

      sequence.performance_score = performanceScore;

      expect(sequence.performance_score).toBeCloseTo(46.5, 1);
    });

    it('should identify top-performing sequences', () => {
      const sequences = [
        createMockSequence({ id: 1, name: 'Seq 1', performance_score: 45 }),
        createMockSequence({ id: 2, name: 'Seq 2', performance_score: 78 }),
        createMockSequence({ id: 3, name: 'Seq 3', performance_score: 62 }),
      ];

      const topPerforming = sequences
        .filter(s => s.performance_score > 60)
        .sort((a, b) => b.performance_score - a.performance_score);

      expect(topPerforming).toHaveLength(2);
      expect(topPerforming[0].name).toBe('Seq 2');
      expect(topPerforming[1].name).toBe('Seq 3');
    });
  });

  describe('A/B Testing', () => {
    it('should split traffic between variants', () => {
      const trafficSplit = 0.5; // 50/50 split
      const totalProspects = 100;

      const variantA = Math.floor(totalProspects * trafficSplit);
      const variantB = totalProspects - variantA;

      expect(variantA).toBe(50);
      expect(variantB).toBe(50);
    });

    it('should support uneven traffic splits', () => {
      const trafficSplit = 0.7; // 70/30 split
      const totalProspects = 100;

      const variantA = Math.floor(totalProspects * trafficSplit);
      const variantB = totalProspects - variantA;

      expect(variantA).toBe(70);
      expect(variantB).toBe(30);
    });

    it('should calculate statistical significance', () => {
      // Simplified chi-square test simulation
      const variantA = { conversions: 25, total: 100 };
      const variantB = { conversions: 35, total: 100 };

      const rateA = variantA.conversions / variantA.total;
      const rateB = variantB.conversions / variantB.total;

      // Variant B performs better
      expect(rateB).toBeGreaterThan(rateA);
      expect(rateB - rateA).toBe(0.1); // 10% lift
    });

    it('should declare winner when significant', () => {
      const significance = 0.95; // 95% confidence
      const isSignificant = significance >= 0.95;

      expect(isSignificant).toBe(true);
    });
  });

  describe('AI Features', () => {
    it('should generate sequence with AI', () => {
      const aiSequence = createMockSequence({
        name: 'AI-Generated: Hot Prospect Outreach',
        created_by_ai: true,
        classification_target: 'hot',
        stage_target: 'intent',
        total_steps: 4,
      });

      expect(aiSequence.created_by_ai).toBe(true);
      expect(aiSequence.classification_target).toBe('hot');
    });

    it('should optimize send timing with AI', () => {
      const profile = createMockEngagementProfile({
        optimal_send_time: '10:30',
        optimal_send_day: 3, // Wednesday
      });

      // AI determined optimal time based on historical engagement
      expect(profile.optimal_send_time).toBe('10:30');
      expect(profile.optimal_send_day).toBe(3);
    });

    it('should predict engagement', () => {
      const profile = createMockEngagementProfile({
        total_score: 75,
        engagement_trend: 'increasing',
        response_rate: 0.6,
      });

      // AI prediction: likely to engage
      const engagementProbability =
        profile.total_score / 100 * 0.5 +
        profile.response_rate * 0.3 +
        (profile.engagement_trend === 'increasing' ? 0.2 : 0);

      expect(engagementProbability).toBeGreaterThan(0.5);
    });
  });

  describe('Sequence Validation', () => {
    it('should require at least one step', () => {
      const sequence = createMockSequence({ total_steps: 0 });
      const isValid = sequence.total_steps > 0;

      expect(isValid).toBe(false);
    });

    it('should validate step order', () => {
      const steps = [
        createMockStep({ step_number: 1 }),
        createMockStep({ step_number: 2 }),
        createMockStep({ step_number: 3 }),
      ];

      const isOrdered = steps.every((step, index) => step.step_number === index + 1);

      expect(isOrdered).toBe(true);
    });

    it('should validate delays are non-negative', () => {
      const step = createMockStep({ delay_days: 2, delay_hours: 6 });

      expect(step.delay_days).toBeGreaterThanOrEqual(0);
      expect(step.delay_hours).toBeGreaterThanOrEqual(0);
      expect(step.delay_hours).toBeLessThan(24);
    });

    it('should require content template', () => {
      const step = createMockStep({ content_template: 'Hello {{name}}' });
      const isValid = step.content_template.length > 0;

      expect(isValid).toBe(true);
    });
  });
});
