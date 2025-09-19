import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { BehaviorType, TrackBehaviorRequest } from "./types";
import * as behaviorAnalysis from "./behavior_analysis";
import * as sequenceManager from "./sequence_manager";
import * as ai from "../ai/openai";

// Real-time behavior trigger processing
export const processBehaviorTrigger = api(
  { method: "POST", path: "/trigger/behavior", expose: true },
  async (req: TrackBehaviorRequest & { trigger_immediate?: boolean }) => {
    // Track the behavior first
    await behaviorAnalysis.trackBehavior(req);
    
    // Check for immediate triggers if requested
    if (req.trigger_immediate) {
      await checkAndExecuteTriggers(req.prospect_id, req.client_id, req.behavior_type);
    }
    
    return { success: true };
  }
);

// Email interaction tracking (opens, clicks, replies)
export const trackEmailInteraction = api(
  { method: "POST", path: "/trigger/email-interaction", expose: true },
  async (req: {
    prospect_id: number;
    client_id: number;
    communication_id: number;
    interaction_type: 'open' | 'click' | 'reply';
    interaction_data?: Record<string, any>;
  }) => {
    // Update the communication record
    const updateField = `${req.interaction_type}ed_at`;
    await nurturingDB.exec`
      UPDATE nurturing_communications 
      SET ${updateField} = CURRENT_TIMESTAMP,
          engagement_score = engagement_score + ${getInteractionScore(req.interaction_type)}
      WHERE id = ${req.communication_id}
    `;
    
    // Track as behavior
    await behaviorAnalysis.trackBehavior({
      prospect_id: req.prospect_id,
      client_id: req.client_id,
      behavior_type: `email_${req.interaction_type}` as BehaviorType,
      behavior_data: {
        communication_id: req.communication_id,
        ...req.interaction_data
      }
    });
    
    // Check for triggers
    await checkAndExecuteTriggers(
      req.prospect_id, 
      req.client_id, 
      `email_${req.interaction_type}` as BehaviorType
    );
    
    return { success: true };
  }
);

// Website activity tracking
export const trackWebsiteActivity = api(
  { method: "POST", path: "/trigger/website-activity", expose: true },
  async (req: {
    prospect_id: number;
    client_id: number;
    page_url: string;
    time_spent?: number;
    actions?: string[];
    referrer?: string;
  }) => {
    // Track as behavior
    await behaviorAnalysis.trackBehavior({
      prospect_id: req.prospect_id,
      client_id: req.client_id,
      behavior_type: 'website_visit',
      behavior_data: {
        page_url: req.page_url,
        time_spent: req.time_spent,
        actions: req.actions,
        referrer: req.referrer,
        timestamp: new Date()
      }
    });
    
    // Check for high-intent triggers
    if (req.time_spent && req.time_spent > 120) { // 2+ minutes
      await checkAndExecuteTriggers(req.prospect_id, req.client_id, 'website_visit');
    }
    
    return { success: true };
  }
);

// AI-powered trigger analysis and execution
export const analyzeAndExecuteTriggers = api(
  { method: "POST", path: "/trigger/ai-analyze", expose: true },
  async ({ prospect_id, client_id }: { prospect_id: number; client_id: number }) => {
    // Get recent behaviors
    const recentBehaviors = await nurturingDB.query`
      SELECT * FROM prospect_behavior 
      WHERE prospect_id = ${prospect_id}
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `;
    
    // Get engagement profile
    const [profile] = await nurturingDB.query`
      SELECT * FROM prospect_engagement_profile 
      WHERE prospect_id = ${prospect_id}
    `;
    
    // Get current enrollments
    const enrollments = await nurturingDB.query`
      SELECT se.*, ns.name as sequence_name
      FROM sequence_enrollments se
      JOIN nurturing_sequences ns ON se.sequence_id = ns.id
      WHERE se.prospect_id = ${prospect_id} 
        AND se.status = 'active'
    `;
    
    // Use AI to analyze trigger opportunities
    const prompt = `
Analyze this prospect's recent behavior and determine if any immediate triggers should be executed:

Recent Behaviors (last 24h):
${JSON.stringify(recentBehaviors, null, 2)}

Engagement Profile:
${JSON.stringify(profile, null, 2)}

Current Active Sequences:
${JSON.stringify(enrollments, null, 2)}

Evaluate for trigger opportunities:
1. High-intent behaviors that warrant immediate outreach
2. Sequence adjustments based on engagement changes
3. Escalation or de-escalation recommendations
4. Optimal timing for next contact

Respond with specific actions to take:
IMMEDIATE_ACTIONS: [list of immediate actions]
SEQUENCE_ADJUSTMENTS: [any sequence modifications needed]
TIMING_CHANGES: [timing recommendation changes]
ESCALATION: [escalation recommendations]
REASONING: [explanation of recommendations]
`;

    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 500,
      temperature: 0.3
    });
    
    const analysis = parseTriggerAnalysis(aiResponse.content);
    
    // Execute immediate actions if any
    const executedActions = [];
    for (const action of analysis.immediate_actions) {
      try {
        const result = await executeAction(action, prospect_id, client_id);
        executedActions.push(result);
      } catch (error) {
        console.error(`Failed to execute action: ${action}`, error);
      }
    }
    
    return {
      analysis,
      executed_actions: executedActions
    };
  }
);

// Cron job for periodic trigger analysis
export const periodicTriggerAnalysis = cron(
  { title: "Periodic Trigger Analysis", cron: "0 */2 * * *" }, // Every 2 hours
  async () => {
    // Get prospects with recent activity
    const activeProspects = await nurturingDB.query`
      SELECT DISTINCT prospect_id, client_id
      FROM prospect_behavior 
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '6 hours'
    `;
    
    console.log(`Analyzing triggers for ${activeProspects.length} active prospects`);
    
    for (const prospect of activeProspects) {
      try {
        await analyzeAndExecuteTriggers({
          prospect_id: prospect.prospect_id,
          client_id: prospect.client_id
        });
      } catch (error) {
        console.error(`Error analyzing triggers for prospect ${prospect.prospect_id}:`, error);
      }
    }
  }
);

// Check and execute triggers based on behavior
async function checkAndExecuteTriggers(
  prospectId: number, 
  clientId: number, 
  behaviorType: BehaviorType
): Promise<void> {
  // Define trigger rules
  const triggerRules = {
    email_reply: async () => {
      // Pause current sequences to avoid overwhelming
      await pauseActiveSequences(prospectId);
      
      // Schedule high-priority follow-up
      await scheduleImmediateFollowUp(prospectId, clientId, 'reply_received');
    },
    
    email_click: async () => {
      // Track interest spike
      await updateEngagementSpike(prospectId, 'email_engagement');
      
      // Consider sequence acceleration
      await considerSequenceAcceleration(prospectId);
    },
    
    website_visit: async () => {
      // Check for high-intent pages
      const recentVisit = await getRecentWebsiteVisit(prospectId);
      if (recentVisit?.page_url?.includes('pricing') || 
          recentVisit?.page_url?.includes('contact') ||
          recentVisit?.time_spent > 180) {
        await scheduleImmediateFollowUp(prospectId, clientId, 'high_intent_visit');
      }
    },
    
    meeting_scheduled: async () => {
      // Pause nurturing sequences
      await pauseActiveSequences(prospectId);
      
      // Schedule pre-meeting preparation sequence
      await enrollInPreMeetingSequence(prospectId, clientId);
    },
    
    meeting_no_show: async () => {
      // Enroll in re-engagement sequence
      await enrollInReEngagementSequence(prospectId, clientId);
    }
  };
  
  const triggerFunction = triggerRules[behaviorType];
  if (triggerFunction) {
    await triggerFunction();
  }
}

// Helper functions for trigger actions
async function pauseActiveSequences(prospectId: number): Promise<void> {
  await nurturingDB.exec`
    UPDATE sequence_enrollments 
    SET status = 'paused',
        completion_reason = 'triggered_pause',
        updated_at = CURRENT_TIMESTAMP
    WHERE prospect_id = ${prospectId} 
      AND status = 'active'
  `;
}

async function scheduleImmediateFollowUp(
  prospectId: number, 
  clientId: number, 
  reason: string
): Promise<void> {
  // Find or create immediate follow-up sequence
  const [immediateSequence] = await nurturingDB.query`
    SELECT id FROM nurturing_sequences 
    WHERE client_id = ${clientId}
      AND name LIKE '%immediate%'
      AND is_active = true
    LIMIT 1
  `;
  
  if (immediateSequence) {
    await sequenceManager.enrollProspect({
      prospect_id: prospectId,
      sequence_id: immediateSequence.id,
      client_id: clientId
    });
  }
}

async function updateEngagementSpike(prospectId: number, spikeType: string): Promise<void> {
  await nurturingDB.exec`
    UPDATE prospect_engagement_profile 
    SET total_score = total_score + 15,
        engagement_trend = 'increasing',
        updated_at = CURRENT_TIMESTAMP
    WHERE prospect_id = ${prospectId}
  `;
}

async function considerSequenceAcceleration(prospectId: number): Promise<void> {
  // Reduce delay for next scheduled step
  await nurturingDB.exec`
    UPDATE sequence_enrollments 
    SET next_step_scheduled_at = CURRENT_TIMESTAMP + INTERVAL '2 hours'
    WHERE prospect_id = ${prospectId} 
      AND status = 'active'
      AND next_step_scheduled_at > CURRENT_TIMESTAMP + INTERVAL '2 hours'
  `;
}

async function getRecentWebsiteVisit(prospectId: number): Promise<any> {
  const [visit] = await nurturingDB.query`
    SELECT behavior_data 
    FROM prospect_behavior 
    WHERE prospect_id = ${prospectId}
      AND behavior_type = 'website_visit'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  return visit?.behavior_data;
}

async function enrollInPreMeetingSequence(prospectId: number, clientId: number): Promise<void> {
  const [preMeetingSequence] = await nurturingDB.query`
    SELECT id FROM nurturing_sequences 
    WHERE client_id = ${clientId}
      AND name LIKE '%pre-meeting%'
      AND is_active = true
    LIMIT 1
  `;
  
  if (preMeetingSequence) {
    await sequenceManager.enrollProspect({
      prospect_id: prospectId,
      sequence_id: preMeetingSequence.id,
      client_id: clientId
    });
  }
}

async function enrollInReEngagementSequence(prospectId: number, clientId: number): Promise<void> {
  const [reEngagementSequence] = await nurturingDB.query`
    SELECT id FROM nurturing_sequences 
    WHERE client_id = ${clientId}
      AND name LIKE '%re-engagement%'
      AND is_active = true
    LIMIT 1
  `;
  
  if (reEngagementSequence) {
    await sequenceManager.enrollProspect({
      prospect_id: prospectId,
      sequence_id: reEngagementSequence.id,
      client_id: clientId
    });
  }
}

function getInteractionScore(interactionType: string): number {
  const scores = {
    open: 5,
    click: 15,
    reply: 30
  };
  return scores[interactionType] || 0;
}

function parseTriggerAnalysis(content: string): any {
  const sections = content.split('\n');
  let immediate_actions: string[] = [];
  let sequence_adjustments: string[] = [];
  let timing_changes: string[] = [];
  let escalation: string[] = [];
  let reasoning = '';
  
  let currentSection = '';
  
  for (const line of sections) {
    if (line.startsWith('IMMEDIATE_ACTIONS:')) {
      currentSection = 'immediate_actions';
      const text = line.replace('IMMEDIATE_ACTIONS:', '').trim();
      if (text) immediate_actions.push(text);
    } else if (line.startsWith('SEQUENCE_ADJUSTMENTS:')) {
      currentSection = 'sequence_adjustments';
      const text = line.replace('SEQUENCE_ADJUSTMENTS:', '').trim();
      if (text) sequence_adjustments.push(text);
    } else if (line.startsWith('TIMING_CHANGES:')) {
      currentSection = 'timing_changes';
      const text = line.replace('TIMING_CHANGES:', '').trim();
      if (text) timing_changes.push(text);
    } else if (line.startsWith('ESCALATION:')) {
      currentSection = 'escalation';
      const text = line.replace('ESCALATION:', '').trim();
      if (text) escalation.push(text);
    } else if (line.startsWith('REASONING:')) {
      currentSection = 'reasoning';
      reasoning = line.replace('REASONING:', '').trim();
    } else if (line.trim() && currentSection) {
      if (currentSection === 'immediate_actions') {
        immediate_actions.push(line.trim());
      } else if (currentSection === 'sequence_adjustments') {
        sequence_adjustments.push(line.trim());
      } else if (currentSection === 'timing_changes') {
        timing_changes.push(line.trim());
      } else if (currentSection === 'escalation') {
        escalation.push(line.trim());
      } else if (currentSection === 'reasoning') {
        reasoning += '\n' + line;
      }
    }
  }
  
  return {
    immediate_actions: immediate_actions.filter(a => a.length > 0),
    sequence_adjustments: sequence_adjustments.filter(a => a.length > 0),
    timing_changes: timing_changes.filter(a => a.length > 0),
    escalation: escalation.filter(a => a.length > 0),
    reasoning: reasoning.trim()
  };
}

async function executeAction(action: string, prospectId: number, clientId: number): Promise<any> {
  // Parse and execute specific actions
  if (action.toLowerCase().includes('pause sequence')) {
    await pauseActiveSequences(prospectId);
    return { action: 'pause_sequences', success: true };
  }
  
  if (action.toLowerCase().includes('immediate follow')) {
    await scheduleImmediateFollowUp(prospectId, clientId, 'ai_triggered');
    return { action: 'schedule_followup', success: true };
  }
  
  if (action.toLowerCase().includes('accelerate')) {
    await considerSequenceAcceleration(prospectId);
    return { action: 'accelerate_sequence', success: true };
  }
  
  // Default: log the action for manual review
  console.log(`Manual action required for prospect ${prospectId}: ${action}`);
  return { action: 'manual_review', description: action };
}