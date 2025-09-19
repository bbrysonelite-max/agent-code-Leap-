import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import {
  CreateSequenceRequest,
  EnrollProspectRequest,
  NurturingSequence,
  SequenceEnrollment,
  SequenceStep,
  NurturingCommunication,
  SequenceStatus
} from "./types";
import * as ai from "../ai/openai";

// Create a new nurturing sequence
export const createSequence = api(
  { method: "POST", path: "/sequences", expose: true },
  async (req: CreateSequenceRequest) => {
    // Insert sequence
    const [sequence] = await nurturingDB.query`
      INSERT INTO nurturing_sequences (
        client_id, name, classification_target, stage_target,
        sequence_type, total_steps, template_data
      )
      VALUES (
        ${req.client_id}, ${req.name}, ${req.classification_target}, ${req.stage_target},
        ${req.sequence_type || 'email'}, ${req.steps.length}, ${JSON.stringify(req.template_data || {})}
      )
      RETURNING *
    `;
    
    // Insert steps
    for (const step of req.steps) {
      await nurturingDB.exec`
        INSERT INTO sequence_steps (
          sequence_id, step_number, content_type, delay_days, delay_hours,
          subject_template, content_template, conditions
        )
        VALUES (
          ${sequence.id}, ${step.step_number}, ${step.content_type}, 
          ${step.delay_days}, ${step.delay_hours || 0},
          ${step.subject_template || ''}, ${step.content_template}, 
          ${JSON.stringify(step.conditions || {})}
        )
      `;
    }
    
    return sequence;
  }
);

// Get all sequences for a client
export const listSequences = api(
  { method: "GET", path: "/sequences/:client_id", expose: true },
  async ({ client_id }: { client_id: number }) => {
    const sequences = await nurturingDB.query`
      SELECT 
        ns.*,
        COUNT(se.id) as enrollment_count,
        AVG(nc.engagement_score) as avg_engagement
      FROM nurturing_sequences ns
      LEFT JOIN sequence_enrollments se ON ns.id = se.sequence_id
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE ns.client_id = ${client_id}
      GROUP BY ns.id
      ORDER BY ns.created_at DESC
    `;
    
    return sequences;
  }
);

// Get sequence details with steps
export const getSequence = api(
  { method: "GET", path: "/sequence/:sequence_id", expose: true },
  async ({ sequence_id }: { sequence_id: number }) => {
    const [sequence] = await nurturingDB.query`
      SELECT * FROM nurturing_sequences WHERE id = ${sequence_id}
    `;
    
    if (!sequence) return null;
    
    const steps = await nurturingDB.query`
      SELECT * FROM sequence_steps 
      WHERE sequence_id = ${sequence_id} 
      ORDER BY step_number ASC
    `;
    
    return { ...sequence, steps };
  }
);

// Enroll a prospect in a sequence
export const enrollProspect = api(
  { method: "POST", path: "/enroll", expose: true },
  async (req: EnrollProspectRequest) => {
    // Check if prospect is already enrolled in this sequence
    const [existing] = await nurturingDB.query`
      SELECT id FROM sequence_enrollments 
      WHERE prospect_id = ${req.prospect_id} 
        AND sequence_id = ${req.sequence_id}
        AND status IN ('active', 'paused')
    `;
    
    if (existing) {
      throw new Error("Prospect is already enrolled in this sequence");
    }
    
    // Get sequence details to calculate first step timing
    const [sequence] = await nurturingDB.query`
      SELECT * FROM nurturing_sequences WHERE id = ${req.sequence_id}
    `;
    
    if (!sequence) {
      throw new Error("Sequence not found");
    }
    
    // Get first step details
    const [firstStep] = await nurturingDB.query`
      SELECT * FROM sequence_steps 
      WHERE sequence_id = ${req.sequence_id} 
        AND step_number = 1
      ORDER BY step_number ASC
      LIMIT 1
    `;
    
    // Calculate next step time
    const nextStepTime = new Date();
    if (firstStep) {
      nextStepTime.setDate(nextStepTime.getDate() + firstStep.delay_days);
      nextStepTime.setHours(nextStepTime.getHours() + (firstStep.delay_hours || 0));
    }
    
    // Create enrollment
    const [enrollment] = await nurturingDB.query`
      INSERT INTO sequence_enrollments (
        prospect_id, sequence_id, client_id, current_step,
        next_step_scheduled_at
      )
      VALUES (
        ${req.prospect_id}, ${req.sequence_id}, ${req.client_id}, 1,
        ${nextStepTime}
      )
      RETURNING *
    `;
    
    return enrollment;
  }
);

// Get prospect enrollments
export const getProspectEnrollments = api(
  { method: "GET", path: "/enrollments/:prospect_id", expose: true },
  async ({ prospect_id }: { prospect_id: number }) => {
    const enrollments = await nurturingDB.query`
      SELECT 
        se.*,
        ns.name as sequence_name,
        ns.classification_target,
        ns.stage_target
      FROM sequence_enrollments se
      JOIN nurturing_sequences ns ON se.sequence_id = ns.id
      WHERE se.prospect_id = ${prospect_id}
      ORDER BY se.created_at DESC
    `;
    
    return enrollments;
  }
);

// Update enrollment status
export const updateEnrollmentStatus = api(
  { method: "PUT", path: "/enrollment/:enrollment_id/status", expose: true },
  async ({ enrollment_id, status, reason }: { enrollment_id: number; status: SequenceStatus; reason?: string }) => {
    await nurturingDB.exec`
      UPDATE sequence_enrollments 
      SET status = ${status}, 
          completion_reason = ${reason || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${enrollment_id}
    `;
    
    return { success: true };
  }
);

// Smart enrollment based on prospect classification and behavior
export const smartEnrollProspect = api(
  { method: "POST", path: "/smart-enroll", expose: true },
  async ({ prospect_id, client_id }: { prospect_id: number; client_id: number }) => {
    // Get prospect engagement profile
    const [profile] = await nurturingDB.query`
      SELECT * FROM prospect_engagement_profile 
      WHERE prospect_id = ${prospect_id}
    `;
    
    // Get recent behaviors to inform classification
    const behaviors = await nurturingDB.query`
      SELECT * FROM prospect_behavior 
      WHERE prospect_id = ${prospect_id}
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    // Use AI to determine best sequence for this prospect
    const prompt = `
Analyze this prospect's engagement profile and behavior history to recommend the best nurturing sequence:

Engagement Profile:
${JSON.stringify(profile, null, 2)}

Recent Behaviors:
${JSON.stringify(behaviors, null, 2)}

Available sequence types:
- High engagement prospects (hot/warm): Aggressive follow-up, shorter delays
- Medium engagement prospects (nurture): Educational content, longer delays  
- Low engagement prospects (cold): Value-first approach, spaced timing
- Unresponsive prospects: Break-up sequences or re-engagement campaigns

Recommend:
1. Classification (hot/warm/cold/nurture/unqualified)
2. Stage (awareness/interest/consideration/intent/evaluation/purchase)
3. Sequence type and reasoning
4. Optimal timing for first contact

Format:
CLASSIFICATION: [classification]
STAGE: [stage]
SEQUENCE_TYPE: [recommended sequence approach]
REASONING: [why this approach]
TIMING: [optimal first contact timing]
`;

    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 400,
      temperature: 0.3
    });
    
    // Parse AI recommendation
    const recommendation = parseEnrollmentRecommendation(aiResponse.content);
    
    // Find best matching sequence
    const [bestSequence] = await nurturingDB.query`
      SELECT * FROM nurturing_sequences 
      WHERE client_id = ${client_id}
        AND classification_target = ${recommendation.classification}
        AND stage_target = ${recommendation.stage}
        AND is_active = true
      ORDER BY performance_score DESC
      LIMIT 1
    `;
    
    if (bestSequence) {
      // Enroll in best sequence
      const enrollment = await enrollProspect({
        prospect_id,
        sequence_id: bestSequence.id,
        client_id
      });
      
      return {
        enrollment,
        sequence: bestSequence,
        ai_reasoning: recommendation.reasoning
      };
    } else {
      // Generate new sequence if none exists
      const newSequence = await ai.generateAISequence({
        client_id,
        prospect_data: { prospect_id, ...profile },
        classification: recommendation.classification,
        stage: recommendation.stage,
        sequence_length: 5
      });
      
      const enrollment = await enrollProspect({
        prospect_id,
        sequence_id: newSequence.id,
        client_id
      });
      
      return {
        enrollment,
        sequence: newSequence,
        ai_reasoning: recommendation.reasoning,
        sequence_generated: true
      };
    }
  }
);

// Cron job to process scheduled sequence steps
export const processScheduledSteps = cron(
  { title: "Process Scheduled Sequence Steps", cron: "*/5 * * * *" }, // Every 5 minutes
  async () => {
    // Get all enrollments with scheduled steps due
    const dueEnrollments = await nurturingDB.query`
      SELECT 
        se.*,
        ss.id as step_id,
        ss.content_type,
        ss.subject_template,
        ss.content_template,
        ss.delay_days,
        ss.delay_hours,
        ns.name as sequence_name
      FROM sequence_enrollments se
      JOIN sequence_steps ss ON se.sequence_id = ss.sequence_id AND se.current_step = ss.step_number
      JOIN nurturing_sequences ns ON se.sequence_id = ns.id
      WHERE se.status = 'active'
        AND se.next_step_scheduled_at <= CURRENT_TIMESTAMP
        AND ss.is_active = true
      LIMIT 100
    `;
    
    console.log(`Processing ${dueEnrollments.length} scheduled steps`);
    
    for (const enrollment of dueEnrollments) {
      try {
        await processSequenceStep(enrollment);
      } catch (error) {
        console.error(`Error processing step for enrollment ${enrollment.id}:`, error);
      }
    }
  }
);

// Process individual sequence step
async function processSequenceStep(enrollment: any): Promise<void> {
  // Generate personalized content for this step
  const content = await ai.generateStepContent({
    prospect_id: enrollment.prospect_id,
    sequence_id: enrollment.sequence_id,
    step_number: enrollment.current_step,
    classification: 'warm', // Would get from prospect data
    stage: 'interest', // Would get from prospect data
    content_type: enrollment.content_type
  });
  
  // Record the communication
  const [communication] = await nurturingDB.query`
    INSERT INTO nurturing_communications (
      enrollment_id, step_id, prospect_id, communication_type,
      subject, content, engagement_score
    )
    VALUES (
      ${enrollment.id}, ${enrollment.step_id}, ${enrollment.prospect_id}, 
      ${enrollment.content_type}, ${content.subject || ''}, ${content.content}, 0
    )
    RETURNING *
  `;
  
  // Update enrollment for next step
  const nextStepNumber = enrollment.current_step + 1;
  
  // Check if there's a next step
  const [nextStep] = await nurturingDB.query`
    SELECT * FROM sequence_steps 
    WHERE sequence_id = ${enrollment.sequence_id} 
      AND step_number = ${nextStepNumber}
  `;
  
  if (nextStep) {
    // Schedule next step
    const nextStepTime = new Date();
    nextStepTime.setDate(nextStepTime.getDate() + nextStep.delay_days);
    nextStepTime.setHours(nextStepTime.getHours() + (nextStep.delay_hours || 0));
    
    await nurturingDB.exec`
      UPDATE sequence_enrollments 
      SET current_step = ${nextStepNumber},
          last_step_sent_at = CURRENT_TIMESTAMP,
          next_step_scheduled_at = ${nextStepTime},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${enrollment.id}
    `;
  } else {
    // Sequence completed
    await nurturingDB.exec`
      UPDATE sequence_enrollments 
      SET status = 'completed',
          last_step_sent_at = CURRENT_TIMESTAMP,
          next_step_scheduled_at = NULL,
          completion_reason = 'sequence_completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${enrollment.id}
    `;
  }
  
  // TODO: Actually send the communication (integrate with email service)
  console.log(`Processed step ${enrollment.current_step} for prospect ${enrollment.prospect_id}`);
}

// Helper function to parse AI enrollment recommendation
function parseEnrollmentRecommendation(content: string): any {
  const lines = content.split('\n');
  let classification = 'warm';
  let stage = 'interest';
  let sequenceType = 'standard';
  let reasoning = '';
  let timing = 'immediate';
  
  for (const line of lines) {
    if (line.startsWith('CLASSIFICATION:')) {
      classification = line.replace('CLASSIFICATION:', '').trim().toLowerCase();
    } else if (line.startsWith('STAGE:')) {
      stage = line.replace('STAGE:', '').trim().toLowerCase();
    } else if (line.startsWith('SEQUENCE_TYPE:')) {
      sequenceType = line.replace('SEQUENCE_TYPE:', '').trim();
    } else if (line.startsWith('REASONING:')) {
      reasoning = line.replace('REASONING:', '').trim();
    } else if (line.startsWith('TIMING:')) {
      timing = line.replace('TIMING:', '').trim();
    }
  }
  
  return {
    classification,
    stage,
    sequenceType,
    reasoning,
    timing
  };
}