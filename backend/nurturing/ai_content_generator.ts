import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import * as ai from "../ai/openai";
import {
  AISequenceGenerationRequest,
  CreateSequenceRequest,
  NurturingSequence,
  ClassificationTarget,
  StageTarget,
  CommunicationType
} from "./types";

// Generate a complete AI-powered nurturing sequence
export const generateAISequence = api(
  { method: "POST", path: "/generate-ai-sequence", expose: true },
  async (req: AISequenceGenerationRequest) => {
    // Get prospect engagement data for context
    const engagementResults = await nurturingDB.query`
      SELECT * FROM prospect_engagement_profile 
      WHERE prospect_id = ${req.prospect_data.prospect_id}
    `;
    let engagementProfile = null;
    for await (const profile of engagementResults) {
      engagementProfile = profile;
      break;
    }
    
    const recentBehaviors = await nurturingDB.query`
      SELECT * FROM prospect_behavior 
      WHERE prospect_id = ${req.prospect_data.prospect_id}
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    // Create AI prompt for sequence generation
    const recentBehaviorsArray = [];
    for await (const behavior of recentBehaviors) {
      recentBehaviorsArray.push(behavior);
    }
    const prompt = createSequenceGenerationPrompt(req, engagementProfile, recentBehaviorsArray);
    
    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 1200,
      temperature: 0.8
    });
    
    // Parse AI response into sequence structure
    const sequenceData = parseSequenceResponse(aiResponse.content, req);
    
    // Create the sequence in database
    return await createSequenceFromAI(sequenceData, req.client_id);
  }
);

// Generate personalized content for a specific step
export const generateStepContent = api(
  { method: "POST", path: "/generate-step-content", expose: true },
  async (req: {
    prospect_id: number;
    sequence_id: number;
    step_number: number;
    classification: ClassificationTarget;
    stage: StageTarget;
    content_type: CommunicationType;
    context?: Record<string, any>;
  }) => {
    // Get prospect data and behavior history
    const [prospectData] = await nurturingDB.query`
      SELECT pb.*, pep.*
      FROM prospect_behavior pb
      LEFT JOIN prospect_engagement_profile pep ON pb.prospect_id = pep.prospect_id
      WHERE pb.prospect_id = ${req.prospect_id}
      ORDER BY pb.created_at DESC
      LIMIT 1
    `;
    
    // Get sequence context
    const [sequence] = await nurturingDB.query`
      SELECT * FROM nurturing_sequences WHERE id = ${req.sequence_id}
    `;
    
    // Get previous communications in this sequence
    const previousComms = await nurturingDB.query`
      SELECT nc.*, ss.step_number
      FROM nurturing_communications nc
      JOIN sequence_steps ss ON nc.step_id = ss.id
      JOIN sequence_enrollments se ON nc.enrollment_id = se.id
      WHERE se.prospect_id = ${req.prospect_id} 
        AND se.sequence_id = ${req.sequence_id}
      ORDER BY ss.step_number ASC
    `;
    
    const prompt = createStepContentPrompt(req, prospectData, sequence, previousComms);
    
    const aiResponse = await ai.generateContent({
      type: req.content_type === 'email' ? 'email' : req.content_type,
      classification: req.classification,
      stage: req.stage,
      prospectData: prospectData || {},
      context: {
        step_number: req.step_number,
        sequence_name: sequence?.name,
        previous_communications: previousComms,
        ...req.context
      }
    });
    
    return aiResponse;
  }
);

// Generate content variations for A/B testing
export const generateContentVariations = api(
  { method: "POST", path: "/generate-content-variations", expose: true },
  async (req: {
    base_content: string;
    variation_type: 'subject_line' | 'opening' | 'cta' | 'tone' | 'length';
    prospect_classification: ClassificationTarget;
    prospect_stage: StageTarget;
    count?: number;
  }) => {
    const prompt = `
You are an expert copywriter specializing in A/B testing variations. Create ${req.count || 3} variations of the following content, focusing on optimizing the ${req.variation_type}.

Original Content:
${req.base_content}

Prospect Classification: ${req.prospect_classification}
Prospect Stage: ${req.prospect_stage}
Variation Focus: ${req.variation_type}

Requirements:
1. Keep the core message and value proposition consistent
2. Vary only the specified element (${req.variation_type})
3. Ensure each variation has a clear hypothesis for why it might perform better
4. Make variations significantly different to ensure meaningful test results
5. Maintain professional tone appropriate for ${req.prospect_classification} prospects in ${req.prospect_stage} stage

Format your response as:
VARIATION_1: [content]
HYPOTHESIS_1: [why this might perform better]

VARIATION_2: [content]
HYPOTHESIS_2: [why this might perform better]

VARIATION_3: [content]
HYPOTHESIS_3: [why this might perform better]
`;

    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 800,
      temperature: 0.9
    });
    
    return parseVariationsResponse(aiResponse.content);
  }
);

// Optimize existing sequence based on performance data
export const optimizeSequence = api(
  { method: "POST", path: "/optimize-sequence/:sequence_id", expose: true },
  async ({ sequence_id }: { sequence_id: number }) => {
    // Get sequence performance data
    const performance = await getSequencePerformance(sequence_id);
    
    // Get step-by-step analytics
    const stepPerformance = await nurturingDB.query`
      SELECT 
        ss.step_number,
        ss.content_template,
        ss.subject_template,
        COUNT(nc.id) as total_sent,
        COUNT(nc.opened_at) as opened,
        COUNT(nc.clicked_at) as clicked,
        COUNT(nc.replied_at) as replied,
        AVG(nc.engagement_score) as avg_engagement
      FROM sequence_steps ss
      LEFT JOIN nurturing_communications nc ON ss.id = nc.step_id
      WHERE ss.sequence_id = ${sequence_id}
      GROUP BY ss.id, ss.step_number, ss.content_template, ss.subject_template
      ORDER BY ss.step_number
    `;
    
    // Generate AI recommendations for optimization
    const prompt = `
You are a sales sequence optimization expert. Analyze this nurturing sequence performance and provide specific optimization recommendations.

Sequence Performance:
${JSON.stringify(performance, null, 2)}

Step-by-Step Performance:
${JSON.stringify(stepPerformance, null, 2)}

Please provide:
1. Overall sequence assessment
2. Specific steps that need improvement
3. Content optimization suggestions for underperforming steps
4. Timing/delay recommendations
5. Recommended A/B tests to run

Format as:
ASSESSMENT: [overall assessment]
PROBLEM_STEPS: [list of step numbers with issues]
CONTENT_FIXES: [specific content improvements]
TIMING_FIXES: [delay/timing adjustments]
AB_TESTS: [recommended A/B tests]
`;

    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 700,
      temperature: 0.3
    });
    
    return {
      performance,
      step_performance: stepPerformance,
      ai_recommendations: aiResponse.content
    };
  }
);

// Helper functions
function createSequenceGenerationPrompt(
  req: AISequenceGenerationRequest,
  engagementProfile: any,
  recentBehaviors: any[]
): string {
  return `
You are an expert sales sequence architect. Create a personalized nurturing sequence for a prospect with the following characteristics:

Prospect Data:
${JSON.stringify(req.prospect_data, null, 2)}

Classification: ${req.classification}
Stage: ${req.stage}
Preferred Channels: ${req.preferred_channels?.join(', ') || 'email'}
Sequence Length: ${req.sequence_length || 5} steps

Engagement Profile:
${JSON.stringify(engagementProfile, null, 2)}

Recent Behaviors:
${JSON.stringify(recentBehaviors, null, 2)}

Create a ${req.sequence_length || 5}-step nurturing sequence that:
1. Progressively builds relationship and trust
2. Addresses their specific stage (${req.stage}) and classification (${req.classification})
3. Uses optimal timing based on their engagement patterns
4. Includes varied content types and calls-to-action
5. Accounts for their behavioral preferences

For each step, provide:
- Step number (1-${req.sequence_length || 5})
- Content type (email, linkedin_message, phone_call, etc.)
- Delay from previous step (in days)
- Subject/title template
- Content template with personalization placeholders
- Specific conditions for this step to execute

Format your response as:
SEQUENCE_NAME: [descriptive name for this sequence]

STEP_1:
TYPE: [content_type]
DELAY_DAYS: [number]
SUBJECT: [subject template]
CONTENT: [content template]
CONDITIONS: [any conditions]

STEP_2:
[repeat format]

... continue for all steps
`;
}

function createStepContentPrompt(
  req: any,
  prospectData: any,
  sequence: any,
  previousComms: any[]
): string {
  return `
Generate personalized content for step ${req.step_number} of a nurturing sequence.

Prospect Information:
${JSON.stringify(prospectData, null, 2)}

Sequence Context:
Name: ${sequence?.name}
Classification Target: ${req.classification}
Stage Target: ${req.stage}

Previous Communications in this Sequence:
${JSON.stringify(previousComms, null, 2)}

Content Type: ${req.content_type}
Step Number: ${req.step_number}

Additional Context:
${JSON.stringify(req.context || {}, null, 2)}

Requirements:
1. Reference and build upon previous communications naturally
2. Personalize using prospect data (name, company, industry, role)
3. Match the tone to their classification (${req.classification}) and stage (${req.stage})
4. Provide clear value and next step
5. Avoid repetition from previous steps
6. ${req.content_type === 'email' ? 'Include subject line and body' : 'Generate appropriate content for ' + req.content_type}

Make this feel like a natural continuation of the conversation, not a generic template.
`;
}

function parseSequenceResponse(content: string, req: AISequenceGenerationRequest): any {
  const lines = content.split('\n');
  let sequenceName = `AI Generated Sequence - ${req.classification}/${req.stage}`;
  const steps: any[] = [];
  let currentStep: any = null;
  let currentSection = '';
  
  for (const line of lines) {
    if (line.startsWith('SEQUENCE_NAME:')) {
      sequenceName = line.replace('SEQUENCE_NAME:', '').trim();
    } else if (line.match(/^STEP_\d+:/)) {
      if (currentStep) steps.push(currentStep);
      currentStep = {
        step_number: parseInt(line.match(/\d+/)?.[0] || '1'),
        content_type: 'email',
        delay_days: 1,
        subject_template: '',
        content_template: '',
        conditions: {}
      };
    } else if (line.startsWith('TYPE:')) {
      currentSection = 'type';
      if (currentStep) currentStep.content_type = line.replace('TYPE:', '').trim();
    } else if (line.startsWith('DELAY_DAYS:')) {
      if (currentStep) currentStep.delay_days = parseInt(line.replace('DELAY_DAYS:', '').trim()) || 1;
    } else if (line.startsWith('SUBJECT:')) {
      currentSection = 'subject';
      if (currentStep) currentStep.subject_template = line.replace('SUBJECT:', '').trim();
    } else if (line.startsWith('CONTENT:')) {
      currentSection = 'content';
      if (currentStep) currentStep.content_template = line.replace('CONTENT:', '').trim();
    } else if (line.startsWith('CONDITIONS:')) {
      currentSection = 'conditions';
      if (currentStep) {
        try {
          currentStep.conditions = JSON.parse(line.replace('CONDITIONS:', '').trim() || '{}');
        } catch {
          currentStep.conditions = { description: line.replace('CONDITIONS:', '').trim() };
        }
      }
    } else if (line.trim() && currentStep && currentSection) {
      if (currentSection === 'subject') {
        currentStep.subject_template += '\n' + line;
      } else if (currentSection === 'content') {
        currentStep.content_template += '\n' + line;
      }
    }
  }
  
  if (currentStep) steps.push(currentStep);
  
  return {
    name: sequenceName,
    steps: steps.filter(step => step.content_template.trim().length > 0)
  };
}

async function createSequenceFromAI(sequenceData: any, clientId: number): Promise<NurturingSequence> {
  // Insert sequence
  const [sequence] = await nurturingDB.query`
    INSERT INTO nurturing_sequences (
      client_id, name, classification_target, stage_target, 
      total_steps, created_by_ai, template_data
    )
    VALUES (
      ${clientId}, ${sequenceData.name}, 'warm', 'interest',
      ${sequenceData.steps.length}, true, ${JSON.stringify(sequenceData)}
    )
    RETURNING *
  `;
  
  // Insert steps
  for (const step of sequenceData.steps) {
    await nurturingDB.exec`
      INSERT INTO sequence_steps (
        sequence_id, step_number, content_type, delay_days,
        subject_template, content_template, conditions
      )
      VALUES (
        ${sequence.id}, ${step.step_number}, ${step.content_type}, ${step.delay_days},
        ${step.subject_template}, ${step.content_template}, ${JSON.stringify(step.conditions)}
      )
    `;
  }
  
  return sequence;
}

async function getSequencePerformance(sequenceId: number) {
  const [performance] = await nurturingDB.query`
    SELECT 
      COUNT(se.id) as total_enrollments,
      COUNT(CASE WHEN se.status = 'active' THEN 1 END) as active_enrollments,
      COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completed_enrollments,
      AVG(nc.engagement_score) as avg_engagement_score,
      COUNT(nc.opened_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as open_rate,
      COUNT(nc.clicked_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as click_rate,
      COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as reply_rate
    FROM sequence_enrollments se
    LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
    WHERE se.sequence_id = ${sequenceId}
  `;
  
  return performance;
}

function parseVariationsResponse(content: string) {
  const variations: Array<{ content: string; hypothesis: string }> = [];
  const lines = content.split('\n');
  let currentVariation: any = {};
  
  for (const line of lines) {
    if (line.match(/^VARIATION_\d+:/)) {
      if (currentVariation.content) variations.push(currentVariation);
      currentVariation = {
        content: line.replace(/^VARIATION_\d+:/, '').trim(),
        hypothesis: ''
      };
    } else if (line.match(/^HYPOTHESIS_\d+:/)) {
      if (currentVariation) {
        currentVariation.hypothesis = line.replace(/^HYPOTHESIS_\d+:/, '').trim();
      }
    } else if (line.trim() && currentVariation) {
      if (!currentVariation.hypothesis) {
        currentVariation.content += '\n' + line;
      } else {
        currentVariation.hypothesis += '\n' + line;
      }
    }
  }
  
  if (currentVariation.content) variations.push(currentVariation);
  
  return variations;
}