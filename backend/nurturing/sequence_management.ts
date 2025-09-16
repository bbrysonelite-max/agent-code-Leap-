import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { executeQuery, insertRow, requireRow } from "../shared/database";
import type { 
  CreateSequenceRequest,
  CreateSequenceStepRequest,
  EnrollProspectRequest,
  BulkEnrollRequest,
  NurturingSequence,
  SequenceStep,
  ProspectSequenceEnrollment,
  SequenceStepExecution,
  ProspectClassificationData
} from "./types";

// Create a new nurturing sequence with steps
export const createSequence = api<CreateSequenceRequest, { sequence: NurturingSequence; steps: SequenceStep[] }>(
  { expose: true, method: "POST", path: "/nurturing/sequences" },
  wrapAsync(async (req) => {
    validateField(req.name, "name", [Rules.required(), Rules.maxLength(255)]);
    validateField(req.target_classification, "target_classification", [Rules.required()]);
    validateField(req.target_funnel_stage, "target_funnel_stage", [Rules.required()]);
    validateField(req.steps, "steps", [Rules.required(), Rules.minLength(1)]);
    
    // Create the sequence
    const sequence = await insertRow(
      () => nurturingDB.queryRow<NurturingSequence>`
        INSERT INTO nurturing_sequences (
          name, description, target_classification, target_funnel_stage,
          ai_optimization_enabled, total_steps
        ) VALUES (
          ${req.name}, ${req.description || ''}, ${req.target_classification},
          ${req.target_funnel_stage}, ${req.ai_optimization_enabled || false},
          ${req.steps.length}
        )
        RETURNING *
      `,
      "create nurturing sequence"
    );
    
    // Create sequence steps
    const steps: SequenceStep[] = [];
    for (const stepReq of req.steps) {
      validateField(stepReq.step_number, "step_number", [Rules.required(), Rules.positive()]);
      validateField(stepReq.name, "name", [Rules.required(), Rules.maxLength(255)]);
      validateField(stepReq.content_template, "content_template", [Rules.required()]);
      
      const step = await insertRow(
        () => nurturingDB.queryRow<SequenceStep>`
          INSERT INTO sequence_steps (
            sequence_id, step_number, step_type, name, delay_days, delay_hours,
            conditions, content_template, personalization_variables, 
            ai_dynamic_content, success_criteria, fallback_action
          ) VALUES (
            ${sequence.id}, ${stepReq.step_number}, ${stepReq.step_type}, ${stepReq.name},
            ${stepReq.delay_days}, ${stepReq.delay_hours || 0}, 
            ${JSON.stringify(stepReq.conditions || {})}, ${stepReq.content_template},
            ${JSON.stringify(stepReq.personalization_variables || [])},
            ${stepReq.ai_dynamic_content || false}, ${JSON.stringify(stepReq.success_criteria || {})},
            ${stepReq.fallback_action}
          )
          RETURNING *
        `,
        "create sequence step"
      );
      steps.push(step);
    }
    
    return { sequence, steps };
  })
);

// Enroll a prospect in a nurturing sequence
export const enrollProspect = api<EnrollProspectRequest, { enrollment: ProspectSequenceEnrollment; next_execution: SequenceStepExecution }>(
  { expose: true, method: "POST", path: "/nurturing/enroll" },
  wrapAsync(async (req) => {
    validateField(req.prospect_id, "prospect_id", [Rules.required()]);
    validateField(req.sequence_id, "sequence_id", [Rules.required()]);
    
    // Get sequence details
    const sequence = await requireRow(
      () => nurturingDB.queryRow<NurturingSequence>`
        SELECT * FROM nurturing_sequences WHERE id = ${req.sequence_id} AND status = 'active'
      `,
      "active sequence",
      req.sequence_id
    );
    
    // Check if prospect is already enrolled
    const existingEnrollment = await nurturingDB.queryRow<ProspectSequenceEnrollment>`
      SELECT * FROM prospect_sequence_enrollments 
      WHERE prospect_id = ${req.prospect_id} AND sequence_id = ${req.sequence_id}
      AND status IN ('active', 'paused')
    `;
    
    if (existingEnrollment) {
      throw new BusinessLogicError("Prospect is already enrolled in this sequence");
    }
    
    // Validate prospect classification matches sequence target (unless overridden)
    if (!req.override_classification) {
      const classification = await nurturingDB.queryRow<ProspectClassificationData>`
        SELECT * FROM prospect_classifications WHERE prospect_id = ${req.prospect_id}
      `;
      
      if (classification && 
          classification.classification !== sequence.target_classification &&
          classification.funnel_stage !== sequence.target_funnel_stage) {
        throw new BusinessLogicError(
          `Prospect classification (${classification.classification}/${classification.funnel_stage}) doesn't match sequence target (${sequence.target_classification}/${sequence.target_funnel_stage})`
        );
      }
    }
    
    // Create enrollment
    const enrollment = await insertRow(
      () => nurturingDB.queryRow<ProspectSequenceEnrollment>`
        INSERT INTO prospect_sequence_enrollments (
          prospect_id, sequence_id, current_step, status
        ) VALUES (
          ${req.prospect_id}, ${req.sequence_id}, 1, 'active'
        )
        RETURNING *
      `,
      "create enrollment"
    );
    
    // Schedule first step
    const firstStep = await requireRow(
      () => nurturingDB.queryRow<SequenceStep>`
        SELECT * FROM sequence_steps 
        WHERE sequence_id = ${req.sequence_id} AND step_number = 1
      `,
      "first step",
      req.sequence_id
    );
    
    const nextExecution = await scheduleNextStep(enrollment, firstStep, req.custom_variables);
    
    return { enrollment, next_execution: nextExecution };
  })
);

// Bulk enroll prospects in a sequence
export const bulkEnroll = api<BulkEnrollRequest, { enrolled_count: number; failed_enrollments: string[] }>(
  { expose: true, method: "POST", path: "/nurturing/bulk-enroll" },
  wrapAsync(async (req) => {
    validateField(req.prospect_ids, "prospect_ids", [Rules.required(), Rules.minLength(1)]);
    validateField(req.sequence_id, "sequence_id", [Rules.required()]);
    
    let enrolledCount = 0;
    const failedEnrollments: string[] = [];
    
    for (const prospectId of req.prospect_ids) {
      try {
        await enrollProspect.handler({
          prospect_id: prospectId,
          sequence_id: req.sequence_id,
          override_classification: true // Allow bulk enrollment to override classification checks
        });
        enrolledCount++;
      } catch (error) {
        failedEnrollments.push(prospectId);
      }
    }
    
    return { enrolled_count: enrolledCount, failed_enrollments: failedEnrollments };
  })
);

// Process scheduled sequence steps
export const processScheduledSteps = api<{}, { processed_count: number; failed_count: number }>(
  { expose: true, method: "POST", path: "/nurturing/process-scheduled" },
  wrapAsync(async () => {
    // Get all scheduled executions that are due
    const dueExecutions = await executeQuery(
      () => nurturingDB.queryAll<SequenceStepExecution & { step: SequenceStep; enrollment: ProspectSequenceEnrollment }>`
        SELECT 
          sse.*,
          ss.* as step,
          pse.* as enrollment
        FROM sequence_step_executions sse
        JOIN sequence_steps ss ON sse.step_id = ss.id
        JOIN prospect_sequence_enrollments pse ON sse.enrollment_id = pse.id
        WHERE sse.status = 'scheduled' 
        AND sse.scheduled_at <= NOW()
        ORDER BY sse.scheduled_at
        LIMIT 100
      `,
      "get due executions"
    );
    
    let processedCount = 0;
    let failedCount = 0;
    
    for (const execution of dueExecutions) {
      try {
        await processStepExecution(execution);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process execution ${execution.id}:`, error);
        
        // Mark execution as failed
        await executeQuery(
          () => nurturingDB.exec`
            UPDATE sequence_step_executions 
            SET status = 'failed', failed_at = NOW(), 
                error_message = ${error instanceof Error ? error.message : 'Unknown error'},
                retry_count = retry_count + 1
            WHERE id = ${execution.id}
          `,
          "mark execution failed"
        );
        
        failedCount++;
      }
    }
    
    return { processed_count: processedCount, failed_count: failedCount };
  })
);

interface SequencePerformanceResponse {
  sequence_id: string;
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  avg_engagement_score: number;
  avg_completion_days: number;
  conversion_rate: number;
  step_performance: any[];
}

// Get sequence performance metrics
export const getSequencePerformance = api<{ sequence_id: string }, SequencePerformanceResponse>(
  { expose: true, method: "GET", path: "/nurturing/sequences/:sequence_id/performance" },
  wrapAsync(async (req) => {
    validateField(req.sequence_id, "sequence_id", [Rules.required()]);
    
    const performance = await executeQuery(
      () => nurturingDB.queryRow`
        SELECT 
          COUNT(*) as total_enrollments,
          COUNT(CASE WHEN pse.status = 'active' THEN 1 END) as active_enrollments,
          COUNT(CASE WHEN pse.status = 'completed' THEN 1 END) as completed_enrollments,
          AVG(pse.total_engagement_score) as avg_engagement_score,
          AVG(CASE WHEN pse.completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (pse.completed_at - pse.enrolled_at))/86400 
              END) as avg_completion_days
        FROM prospect_sequence_enrollments pse
        WHERE pse.sequence_id = ${req.sequence_id}
      `,
      "get sequence performance"
    );
    
    const stepPerformance = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          ss.step_number,
          ss.name,
          COUNT(sse.*) as total_executions,
          COUNT(CASE WHEN sse.status = 'sent' THEN 1 END) as successful_executions,
          COUNT(CASE WHEN sse.status = 'failed' THEN 1 END) as failed_executions,
          AVG(CASE WHEN sse.engagement_metrics->>'engagement_score' IS NOT NULL 
              THEN CAST(sse.engagement_metrics->>'engagement_score' AS DECIMAL) 
              END) as avg_engagement_score
        FROM sequence_steps ss
        LEFT JOIN sequence_step_executions sse ON ss.id = sse.step_id
        WHERE ss.sequence_id = ${req.sequence_id}
        GROUP BY ss.id, ss.step_number, ss.name
        ORDER BY ss.step_number
      `,
      "get step performance"
    );
    
    return {
      sequence_id: req.sequence_id,
      ...performance,
      conversion_rate: performance.total_enrollments > 0 
        ? (performance.completed_enrollments / performance.total_enrollments) * 100 
        : 0,
      step_performance: stepPerformance
    };
  })
);

async function scheduleNextStep(
  enrollment: ProspectSequenceEnrollment,
  step: SequenceStep,
  customVariables?: Record<string, any>
): Promise<SequenceStepExecution> {
  
  // Calculate when to schedule this step
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + step.delay_days);
  scheduledAt.setHours(scheduledAt.getHours() + step.delay_hours);
  
  // Create step execution record
  const execution = await insertRow(
    () => nurturingDB.queryRow<SequenceStepExecution>`
      INSERT INTO sequence_step_executions (
        enrollment_id, step_id, prospect_id, status, scheduled_at,
        personalization_data
      ) VALUES (
        ${enrollment.id}, ${step.id}, ${enrollment.prospect_id}, 
        ${step.step_type === 'delay' ? 'sent' : 'scheduled'}, ${scheduledAt},
        ${JSON.stringify(customVariables || {})}
      )
      RETURNING *
    `,
    "create step execution"
  );
  
  // If it's a delay step, mark it as complete and schedule next step
  if (step.step_type === 'delay') {
    await completeStepAndScheduleNext(execution, enrollment);
  }
  
  return execution;
}

async function processStepExecution(execution: SequenceStepExecution & { step: SequenceStep; enrollment: ProspectSequenceEnrollment }): Promise<void> {
  
  // Check if conditions are met
  if (execution.step.conditions && Object.keys(execution.step.conditions).length > 0) {
    const conditionsMet = await evaluateStepConditions(execution.step.conditions, execution.prospect_id);
    if (!conditionsMet) {
      // Skip this step
      await executeQuery(
        () => nurturingDB.exec`
          UPDATE sequence_step_executions 
          SET status = 'skipped', executed_at = NOW()
          WHERE id = ${execution.id}
        `,
        "skip step execution"
      );
      
      await completeStepAndScheduleNext(execution, execution.enrollment);
      return;
    }
  }
  
  // Generate content if AI dynamic content is enabled
  let content = execution.step.content_template;
  if (execution.step.ai_dynamic_content) {
    try {
      // Call content generation API
      const contentResponse = await fetch(`/nurturing/generate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id: execution.prospect_id,
          sequence_step_id: execution.step.id,
          custom_variables: execution.personalization_data
        })
      });
      
      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        content = contentData.content;
      }
    } catch (error) {
      console.warn('AI content generation failed, using template:', error);
    }
  }
  
  // Execute the step based on its type
  switch (execution.step.step_type) {
    case 'email':
      await executeEmailStep(execution, content);
      break;
    case 'call':
      await executeCallStep(execution, content);
      break;
    case 'social_media':
      await executeSocialStep(execution, content);
      break;
    case 'conditional':
      await executeConditionalStep(execution);
      break;
    default:
      throw new BusinessLogicError(`Unknown step type: ${execution.step.step_type}`);
  }
  
  // Complete step and schedule next if sequence continues
  await completeStepAndScheduleNext(execution, execution.enrollment);
}

async function executeEmailStep(execution: SequenceStepExecution, content: string): Promise<void> {
  // Integration with email service
  try {
    // This would integrate with the existing email service
    // For now, we'll simulate email sending
    
    await executeQuery(
      () => nurturingDB.exec`
        UPDATE sequence_step_executions 
        SET status = 'sent', executed_at = NOW(), content_generated = ${content},
            engagement_metrics = '{"email_sent": true}'
        WHERE id = ${execution.id}
      `,
      "mark email step executed"
    );
    
  } catch (error) {
    throw new BusinessLogicError(`Failed to send email: ${error}`);
  }
}

async function executeCallStep(execution: SequenceStepExecution, content: string): Promise<void> {
  // Create call task/reminder
  await executeQuery(
    () => nurturingDB.exec`
      UPDATE sequence_step_executions 
      SET status = 'sent', executed_at = NOW(), content_generated = ${content},
          engagement_metrics = '{"call_scheduled": true}'
      WHERE id = ${execution.id}
    `,
    "mark call step executed"
  );
}

async function executeSocialStep(execution: SequenceStepExecution, content: string): Promise<void> {
  // Create social media outreach task
  await executeQuery(
    () => nurturingDB.exec`
      UPDATE sequence_step_executions 
      SET status = 'sent', executed_at = NOW(), content_generated = ${content},
          engagement_metrics = '{"social_outreach": true}'
      WHERE id = ${execution.id}
    `,
    "mark social step executed"
  );
}

async function executeConditionalStep(execution: SequenceStepExecution): Promise<void> {
  // Evaluate conditions and potentially branch to different paths
  await executeQuery(
    () => nurturingDB.exec`
      UPDATE sequence_step_executions 
      SET status = 'sent', executed_at = NOW(),
          engagement_metrics = '{"conditional_evaluated": true}'
      WHERE id = ${execution.id}
    `,
    "mark conditional step executed"
  );
}

async function completeStepAndScheduleNext(
  execution: SequenceStepExecution,
  enrollment: ProspectSequenceEnrollment
): Promise<void> {
  
  // Update enrollment to next step
  const nextStepNumber = enrollment.current_step + 1;
  
  // Check if there's a next step
  const nextStep = await nurturingDB.queryRow<SequenceStep>`
    SELECT * FROM sequence_steps 
    WHERE sequence_id = ${enrollment.sequence_id} AND step_number = ${nextStepNumber}
  `;
  
  if (nextStep) {
    // Update enrollment current step
    await executeQuery(
      () => nurturingDB.exec`
        UPDATE prospect_sequence_enrollments 
        SET current_step = ${nextStepNumber}, updated_at = NOW()
        WHERE id = ${enrollment.id}
      `,
      "update enrollment step"
    );
    
    // Schedule next step
    const updatedEnrollment = { ...enrollment, current_step: nextStepNumber };
    await scheduleNextStep(updatedEnrollment, nextStep);
    
  } else {
    // Sequence completed
    await executeQuery(
      () => nurturingDB.exec`
        UPDATE prospect_sequence_enrollments 
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = ${enrollment.id}
      `,
      "complete enrollment"
    );
    
    // Update sequence completion metrics
    await updateSequenceMetrics(enrollment.sequence_id);
  }
}

async function evaluateStepConditions(conditions: Record<string, any>, prospectId: string): Promise<boolean> {
  // Evaluate conditions like "has_opened_email", "clicked_link", etc.
  
  if (conditions.min_engagement_score) {
    const recentBehavior = await nurturingDB.queryRow`
      SELECT AVG(engagement_score) as avg_score
      FROM prospect_behaviors 
      WHERE prospect_id = ${prospectId} 
      AND timestamp > NOW() - INTERVAL '7 days'
    `;
    
    if ((recentBehavior?.avg_score || 0) < conditions.min_engagement_score) {
      return false;
    }
  }
  
  if (conditions.required_behavior) {
    const hasBehavior = await nurturingDB.queryRow`
      SELECT COUNT(*) as count
      FROM prospect_behaviors 
      WHERE prospect_id = ${prospectId} 
      AND behavior_type = ${conditions.required_behavior}
      AND timestamp > NOW() - INTERVAL '7 days'
    `;
    
    if ((hasBehavior?.count || 0) === 0) {
      return false;
    }
  }
  
  return true;
}

async function updateSequenceMetrics(sequenceId: string): Promise<void> {
  await executeQuery(
    () => nurturingDB.exec`
      UPDATE nurturing_sequences 
      SET 
        completion_rate = (
          SELECT COALESCE(
            CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) AS DECIMAL) / 
            NULLIF(COUNT(*), 0) * 100, 0
          )
          FROM prospect_sequence_enrollments 
          WHERE sequence_id = ${sequenceId}
        ),
        avg_engagement_rate = (
          SELECT COALESCE(AVG(total_engagement_score), 0)
          FROM prospect_sequence_enrollments 
          WHERE sequence_id = ${sequenceId}
        ),
        updated_at = NOW()
      WHERE id = ${sequenceId}
    `,
    "update sequence metrics"
  );
}