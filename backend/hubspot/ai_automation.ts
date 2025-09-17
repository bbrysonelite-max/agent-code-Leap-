import { api } from "encore.dev/api";
import { hubspotDB } from "./db";
import { HubSpotClient } from "./client";
import { AIDecision, AIActionRequest, AutomationRule } from "./types";
import * as ai from "../ai/openai";

export const executeAIAction = api(
  { method: "POST", path: "/ai-action", expose: true },
  async (req: AIActionRequest): Promise<AIDecision> => {
    // Get the connection
    const connection = await hubspotDB.queryRow`
      SELECT * FROM hubspot_connections 
      WHERE id = ${req.connection_id} AND is_active = true
    `;

    if (!connection) {
      throw new Error("Connection not found or inactive");
    }

    const client = new HubSpotClient(connection.access_token);

    // Get applicable automation rules
    const rules = await hubspotDB.query`
      SELECT * FROM automation_rules 
      WHERE is_active = true
      ORDER BY created_at DESC
    `;

    // Convert to array and find matching rule
    const rulesArray: any[] = [];
    for await (const rule of rules) {
      rulesArray.push(rule);
    }
    const matchingRule = rulesArray.find((rule: any) => {
      // Simple condition matching - can be enhanced with more complex logic
      const conditions = rule.conditions || {};
      return Object.entries(conditions).every(([key, value]) => 
        req.trigger_data[key] === value
      );
    });

    if (!matchingRule) {
      throw new Error("No matching automation rule found");
    }

    // Use AI to make decision
    const aiDecision = await makeAIDecision(matchingRule, req.trigger_data, req.context);

    // Execute the AI decision
    await executeDecision(client, aiDecision);

    // Log the action
    await hubspotDB.exec`
      INSERT INTO hubspot_sync_logs (connection_id, operation, status, ai_decision)
      VALUES (${req.connection_id}, ${aiDecision.action}, 'success', ${JSON.stringify(aiDecision)})
    `;

    return aiDecision;
  }
);

async function makeAIDecision(rule: AutomationRule, triggerData: Record<string, any>, context?: Record<string, any>): Promise<AIDecision> {
  const prompt = `
You are an intelligent CRM automation system. Based on the following information, decide what action to take:

Automation Rule: ${rule.ai_prompt || 'Standard automation rule'}
Trigger Data: ${JSON.stringify(triggerData)}
Context: ${JSON.stringify(context || {})}

Available actions:
- create_contact: Create a new contact
- update_contact: Update existing contact
- create_deal: Create a new deal/opportunity
- update_deal: Update existing deal
- move_deal_stage: Move deal to next stage
- send_email: Send follow-up email
- schedule_task: Schedule a task

Please respond with:
ACTION: [one of the actions above]
CONFIDENCE: [0.0 to 1.0]
REASONING: [explanation of why this action was chosen]
DATA: [JSON object with data needed for the action]
  `;

  try {
    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 400,
      temperature: 0.3 // Lower temperature for more consistent decisions
    });

    return parseAIDecision(aiResponse.content, triggerData, rule);
  } catch (error) {
    console.error('AI decision error:', error);
    // Fallback to rule-based decision
    return {
      action: determineAction(triggerData, rule),
      confidence: calculateConfidence(triggerData, rule),
      reasoning: `Fallback decision (AI error: ${(error as Error).message})`,
      data: generateActionData(triggerData, rule)
    };
  }
}

function parseAIDecision(aiResponse: string, triggerData: Record<string, any>, rule: AutomationRule): AIDecision {
  const lines = aiResponse.split('\n');
  let action = 'update_contact';
  let confidence = 0.5;
  let reasoning = 'AI-generated decision';
  let data = {};

  for (const line of lines) {
    if (line.startsWith('ACTION:')) {
      const actionStr = line.replace('ACTION:', '').trim().toLowerCase();
      if (['create_contact', 'update_contact', 'create_deal', 'update_deal', 'move_deal_stage', 'send_email', 'schedule_task'].includes(actionStr)) {
        action = actionStr as AIDecision['action'];
      }
    } else if (line.startsWith('CONFIDENCE:')) {
      const conf = parseFloat(line.replace('CONFIDENCE:', '').trim());
      if (!isNaN(conf) && conf >= 0 && conf <= 1) {
        confidence = conf;
      }
    } else if (line.startsWith('REASONING:')) {
      reasoning = line.replace('REASONING:', '').trim();
    } else if (line.startsWith('DATA:')) {
      try {
        data = JSON.parse(line.replace('DATA:', '').trim());
      } catch {
        data = generateActionData(triggerData, rule);
      }
    }
  }

  // If no valid data was parsed, generate fallback data
  if (Object.keys(data).length === 0) {
    data = generateActionData(triggerData, rule);
  }

  return {
    action: action as AIDecision['action'],
    confidence,
    reasoning,
    data
  };
}

function determineAction(triggerData: Record<string, any>, rule: AutomationRule): AIDecision['action'] {
  // Intelligent action determination based on trigger data
  if (triggerData.email && !triggerData.contact_exists) {
    return 'create_contact';
  }
  
  if (triggerData.contact_id && triggerData.lead_score > 80) {
    return 'create_deal';
  }
  
  if (triggerData.deal_id && triggerData.email_opened) {
    return 'move_deal_stage';
  }
  
  if (triggerData.contact_id && !triggerData.recent_activity) {
    return 'send_email';
  }
  
  return 'update_contact';
}

function calculateConfidence(triggerData: Record<string, any>, rule: AutomationRule): number {
  // Calculate confidence based on data quality and rule matching
  let confidence = 0.5;
  
  if (triggerData.email && isValidEmail(triggerData.email)) {
    confidence += 0.2;
  }
  
  if (triggerData.lead_score && triggerData.lead_score > 50) {
    confidence += 0.2;
  }
  
  if (triggerData.company_name) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

function generateReasoning(triggerData: Record<string, any>, rule: AutomationRule): string {
  const action = determineAction(triggerData, rule);
  
  switch (action) {
    case 'create_contact':
      return 'New email detected without existing contact. Creating contact to track engagement.';
    case 'create_deal':
      return `High lead score (${triggerData.lead_score || 'unknown'}) indicates sales opportunity. Creating deal for pipeline tracking.`;
    case 'move_deal_stage':
      return 'Email engagement detected on existing deal. Moving to next stage based on engagement level.';
    case 'send_email':
      return 'Contact shows no recent activity. Sending re-engagement email to maintain relationship.';
    default:
      return 'Updating contact with new information to maintain accurate records.';
  }
}

function generateActionData(triggerData: Record<string, any>, rule: AutomationRule): Record<string, any> {
  const action = determineAction(triggerData, rule);
  
  switch (action) {
    case 'create_contact':
      return {
        email: triggerData.email,
        firstname: triggerData.firstname || extractFirstName(triggerData.email),
        lastname: triggerData.lastname || extractLastName(triggerData.email),
        company: triggerData.company_name,
        lifecyclestage: 'lead',
        lead_status: 'NEW'
      };
      
    case 'create_deal':
      return {
        dealname: `Deal - ${triggerData.company_name || triggerData.email}`,
        amount: estimateDealValue(triggerData),
        dealstage: 'qualifiedtobuy',
        pipeline: 'default'
      };
      
    case 'move_deal_stage':
      return {
        dealstage: getNextStage(triggerData.current_stage)
      };
      
    case 'send_email':
      return {
        template: 'reengagement',
        subject: 'Following up on your interest',
        personalization: {
          company: triggerData.company_name,
          firstname: triggerData.firstname
        }
      };
      
    default:
      return {
        lastmodifieddate: new Date().toISOString(),
        lead_status: 'ENGAGED'
      };
  }
}

async function executeDecision(client: HubSpotClient, decision: AIDecision): Promise<void> {
  switch (decision.action) {
    case 'create_contact':
      await client.createContact(decision.data);
      break;
      
    case 'update_contact':
      if (decision.contact_id) {
        await client.updateContact(decision.contact_id, decision.data);
      }
      break;
      
    case 'create_deal':
      const deal = await client.createDeal(decision.data);
      if (decision.contact_id) {
        await client.associateContactWithDeal(decision.contact_id, (deal as any).id);
      }
      break;
      
    case 'update_deal':
      if (decision.deal_id) {
        await client.updateDeal(decision.deal_id, decision.data);
      }
      break;
      
    case 'move_deal_stage':
      if (decision.deal_id) {
        await client.updateDeal(decision.deal_id, { dealstage: decision.data.dealstage });
      }
      break;
      
    case 'send_email':
      // This would integrate with email service
      console.log('Would send email:', decision.data);
      break;
      
    case 'schedule_task':
      // This would create a task in HubSpot
      console.log('Would schedule task:', decision.data);
      break;
  }
}

// Helper functions
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractFirstName(email: string): string {
  const username = email.split('@')[0];
  const parts = username.split(/[._-]/);
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

function extractLastName(email: string): string {
  const username = email.split('@')[0];
  const parts = username.split(/[._-]/);
  return parts.length > 1 ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
}

function estimateDealValue(triggerData: Record<string, any>): number {
  // AI-based deal value estimation
  let baseValue = 5000;
  
  if (triggerData.company_size === 'enterprise') {
    baseValue *= 10;
  } else if (triggerData.company_size === 'mid-market') {
    baseValue *= 5;
  }
  
  if (triggerData.lead_score > 80) {
    baseValue *= 1.5;
  }
  
  return baseValue;
}

function getNextStage(currentStage: string): string {
  const stageFlow: Record<string, string> = {
    'appointmentscheduled': 'qualifiedtobuy',
    'qualifiedtobuy': 'presentationscheduled',
    'presentationscheduled': 'decisionmakerboughtin',
    'decisionmakerboughtin': 'contractsent',
    'contractsent': 'closedwon'
  };
  
  return stageFlow[currentStage] || 'qualifiedtobuy';
}