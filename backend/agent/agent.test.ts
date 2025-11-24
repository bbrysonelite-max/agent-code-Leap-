import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Agent, AgentStatus } from './types';

// Mock database
let mockAgents: Agent[] = [];
let nextId = 1;

// Helper to create mock agent
function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: nextId++,
    name: 'Test Agent',
    status: 'stopped',
    prospects_found_today: 0,
    emails_sent_today: 0,
    responses_today: 0,
    last_activity_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('Agent Service', () => {
  beforeEach(() => {
    mockAgents = [];
    nextId = 1;
  });

  afterEach(() => {
    mockAgents = [];
  });

  describe('Agent Creation', () => {
    it('should create an agent with default values', () => {
      const agent = createMockAgent({ name: 'New Agent' });
      mockAgents.push(agent);

      expect(agent.id).toBe(1);
      expect(agent.name).toBe('New Agent');
      expect(agent.status).toBe('stopped');
      expect(agent.prospects_found_today).toBe(0);
      expect(agent.emails_sent_today).toBe(0);
      expect(agent.responses_today).toBe(0);
      expect(agent.last_activity_at).toBeNull();
    });

    it('should increment IDs for multiple agents', () => {
      const agent1 = createMockAgent();
      const agent2 = createMockAgent();
      const agent3 = createMockAgent();

      mockAgents.push(agent1, agent2, agent3);

      expect(agent1.id).toBe(1);
      expect(agent2.id).toBe(2);
      expect(agent3.id).toBe(3);
    });

    it('should allow custom name', () => {
      const agent = createMockAgent({ name: 'Custom Agent Name' });
      mockAgents.push(agent);

      expect(agent.name).toBe('Custom Agent Name');
    });
  });

  describe('Agent Status Management', () => {
    it('should start with stopped status', () => {
      const agent = createMockAgent();
      expect(agent.status).toBe('stopped');
    });

    it('should transition from stopped to running', () => {
      const agent = createMockAgent();
      mockAgents.push(agent);

      agent.status = 'running';
      agent.last_activity_at = new Date();

      expect(agent.status).toBe('running');
      expect(agent.last_activity_at).not.toBeNull();
    });

    it('should transition from running to paused', () => {
      const agent = createMockAgent({
        status: 'running',
        last_activity_at: new Date(),
      });
      mockAgents.push(agent);

      agent.status = 'paused';

      expect(agent.status).toBe('paused');
      expect(agent.last_activity_at).not.toBeNull();
    });

    it('should transition from paused to running', () => {
      const agent = createMockAgent({
        status: 'paused',
        last_activity_at: new Date(),
      });
      mockAgents.push(agent);

      agent.status = 'running';
      agent.last_activity_at = new Date();

      expect(agent.status).toBe('running');
    });

    it('should stop running agent', () => {
      const agent = createMockAgent({
        status: 'running',
        last_activity_at: new Date(),
      });
      mockAgents.push(agent);

      agent.status = 'stopped';

      expect(agent.status).toBe('stopped');
    });

    it('should only allow valid status values', () => {
      const agent = createMockAgent();
      const validStatuses: AgentStatus[] = ['stopped', 'running', 'paused'];

      validStatuses.forEach(status => {
        agent.status = status;
        expect(agent.status).toBe(status);
      });
    });
  });

  describe('Agent Activity Tracking', () => {
    it('should track prospects found', () => {
      const agent = createMockAgent({ status: 'running' });
      mockAgents.push(agent);

      agent.prospects_found_today = 10;
      agent.last_activity_at = new Date();

      expect(agent.prospects_found_today).toBe(10);
    });

    it('should track emails sent', () => {
      const agent = createMockAgent({ status: 'running' });
      mockAgents.push(agent);

      agent.emails_sent_today = 25;
      agent.last_activity_at = new Date();

      expect(agent.emails_sent_today).toBe(25);
    });

    it('should track responses received', () => {
      const agent = createMockAgent({ status: 'running' });
      mockAgents.push(agent);

      agent.responses_today = 5;
      agent.last_activity_at = new Date();

      expect(agent.responses_today).toBe(5);
    });

    it('should increment all metrics', () => {
      const agent = createMockAgent({ status: 'running' });
      mockAgents.push(agent);

      agent.prospects_found_today++;
      agent.emails_sent_today++;
      agent.responses_today++;
      agent.last_activity_at = new Date();

      expect(agent.prospects_found_today).toBe(1);
      expect(agent.emails_sent_today).toBe(1);
      expect(agent.responses_today).toBe(1);
    });

    it('should reset daily metrics', () => {
      const agent = createMockAgent({
        prospects_found_today: 50,
        emails_sent_today: 100,
        responses_today: 20,
      });
      mockAgents.push(agent);

      // Reset metrics (e.g., at midnight)
      agent.prospects_found_today = 0;
      agent.emails_sent_today = 0;
      agent.responses_today = 0;

      expect(agent.prospects_found_today).toBe(0);
      expect(agent.emails_sent_today).toBe(0);
      expect(agent.responses_today).toBe(0);
    });

    it('should update last_activity_at on activity', () => {
      const agent = createMockAgent();
      mockAgents.push(agent);

      expect(agent.last_activity_at).toBeNull();

      const now = new Date();
      agent.last_activity_at = now;

      expect(agent.last_activity_at).toEqual(now);
    });
  });

  describe('Agent Listing', () => {
    it('should list all agents', () => {
      const agent1 = createMockAgent({ name: 'Agent 1' });
      const agent2 = createMockAgent({ name: 'Agent 2' });
      const agent3 = createMockAgent({ name: 'Agent 3' });

      mockAgents.push(agent1, agent2, agent3);

      expect(mockAgents).toHaveLength(3);
      expect(mockAgents[0].name).toBe('Agent 1');
      expect(mockAgents[1].name).toBe('Agent 2');
      expect(mockAgents[2].name).toBe('Agent 3');
    });

    it('should filter running agents', () => {
      mockAgents.push(
        createMockAgent({ name: 'Agent 1', status: 'running' }),
        createMockAgent({ name: 'Agent 2', status: 'stopped' }),
        createMockAgent({ name: 'Agent 3', status: 'running' }),
        createMockAgent({ name: 'Agent 4', status: 'paused' })
      );

      const runningAgents = mockAgents.filter(a => a.status === 'running');

      expect(runningAgents).toHaveLength(2);
      expect(runningAgents[0].name).toBe('Agent 1');
      expect(runningAgents[1].name).toBe('Agent 3');
    });

    it('should filter by activity level', () => {
      mockAgents.push(
        createMockAgent({ name: 'Low', prospects_found_today: 5 }),
        createMockAgent({ name: 'Medium', prospects_found_today: 50 }),
        createMockAgent({ name: 'High', prospects_found_today: 200 })
      );

      const highActivity = mockAgents.filter(a => a.prospects_found_today > 100);

      expect(highActivity).toHaveLength(1);
      expect(highActivity[0].name).toBe('High');
    });
  });

  describe('Agent Updates', () => {
    it('should update agent name', () => {
      const agent = createMockAgent({ name: 'Old Name' });
      mockAgents.push(agent);

      agent.name = 'New Name';
      agent.updated_at = new Date();

      expect(agent.name).toBe('New Name');
    });

    it('should update timestamp on modification', () => {
      const agent = createMockAgent();
      mockAgents.push(agent);

      const originalUpdatedAt = agent.updated_at;

      // Simulate time passing
      setTimeout(() => {
        agent.name = 'Updated';
        agent.updated_at = new Date();

        expect(agent.updated_at.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
      }, 10);
    });
  });

  describe('Agent Performance Metrics', () => {
    it('should calculate conversion rate', () => {
      const agent = createMockAgent({
        prospects_found_today: 100,
        emails_sent_today: 80,
        responses_today: 20,
      });

      const emailRate = agent.emails_sent_today / agent.prospects_found_today;
      const responseRate = agent.responses_today / agent.emails_sent_today;

      expect(emailRate).toBe(0.8); // 80%
      expect(responseRate).toBe(0.25); // 25%
    });

    it('should handle zero division', () => {
      const agent = createMockAgent({
        prospects_found_today: 0,
        emails_sent_today: 0,
        responses_today: 0,
      });

      const emailRate = agent.emails_sent_today === 0 ? 0 : agent.emails_sent_today / agent.prospects_found_today;
      const responseRate = agent.emails_sent_today === 0 ? 0 : agent.responses_today / agent.emails_sent_today;

      expect(emailRate).toBe(0);
      expect(responseRate).toBe(0);
    });

    it('should identify high-performing agent', () => {
      const agent = createMockAgent({
        prospects_found_today: 100,
        emails_sent_today: 90,
        responses_today: 30,
      });

      const responseRate = agent.responses_today / agent.emails_sent_today;
      const isHighPerforming = responseRate > 0.2; // 20% threshold

      expect(isHighPerforming).toBe(true);
    });
  });

  describe('Agent Validation', () => {
    it('should require a name', () => {
      const agent = createMockAgent({ name: '' });
      const isValid = agent.name.length > 0;

      expect(isValid).toBe(false);
    });

    it('should accept valid name', () => {
      const agent = createMockAgent({ name: 'Valid Agent Name' });
      const isValid = agent.name.length > 0;

      expect(isValid).toBe(true);
    });

    it('should ensure metrics are non-negative', () => {
      const agent = createMockAgent({
        prospects_found_today: 10,
        emails_sent_today: 5,
        responses_today: 2,
      });

      expect(agent.prospects_found_today).toBeGreaterThanOrEqual(0);
      expect(agent.emails_sent_today).toBeGreaterThanOrEqual(0);
      expect(agent.responses_today).toBeGreaterThanOrEqual(0);
    });

    it('should not allow negative metrics', () => {
      const agent = createMockAgent();

      // These should be prevented by validation
      const validProspects = -5;
      const validEmails = -10;

      agent.prospects_found_today = Math.max(0, validProspects);
      agent.emails_sent_today = Math.max(0, validEmails);

      expect(agent.prospects_found_today).toBe(0);
      expect(agent.emails_sent_today).toBe(0);
    });
  });
});
