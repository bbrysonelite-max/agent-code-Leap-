import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { db } from "./db";
import { 
  NurturingSequence, 
  NurturingEnrollment, 
  NurturingStep,
  CreateSequenceRequest,
  EnrollProspectRequest 
} from "./types";

export const createSequence = api(
  { method: "POST", path: "/sequences", expose: true },
  async (req: CreateSequenceRequest): Promise<NurturingSequence> => {
    // Create sequence
    const sequenceResult = await db.exec`
      INSERT INTO nurturing_sequences (name, description, target_classification, target_stages, is_active)
      VALUES (${req.name}, ${req.description}, ${JSON.stringify(req.targetClassification)}, 
              ${JSON.stringify(req.targetStages)}, true)
      RETURNING id, name, description, target_classification, target_stages, is_active, created_at, updated_at
    `;

    const sequence = sequenceResult.rows[0];

    // Create steps
    for (let i = 0; i < req.steps.length; i++) {
      const step = req.steps[i];
      await db.exec`
        INSERT INTO nurturing_steps (
          sequence_id, step_number, type, trigger_type, trigger_value, 
          delay_days, delay_hours, content_template, personalization_rules, conditions, is_active
        ) VALUES (
          ${sequence.id}, ${step.stepNumber}, ${step.type}, ${step.trigger}, ${step.triggerValue},
          ${step.delayDays || 0}, ${step.delayHours || 0}, ${step.contentTemplate},
          ${JSON.stringify(step.personalizationRules)}, ${JSON.stringify(step.conditions)}, ${step.isActive}
        )
      `;
    }

    return {
      id: sequence.id,
      name: sequence.name,
      description: sequence.description,
      targetClassification: sequence.target_classification,
      targetStages: sequence.target_stages,
      isActive: sequence.is_active,
      steps: req.steps.map((step, index) => ({
        ...step,
        id: `step_${index}`, // Simplified for demo
        sequenceId: sequence.id
      })),
      createdAt: sequence.created_at,
      updatedAt: sequence.updated_at
    };
  }
);

export const enrollProspect = api(
  { method: "POST", path: "/sequences/:sequenceId/enroll", expose: true },
  async ({ sequenceId, ...req }: { sequenceId: string } & EnrollProspectRequest): Promise<NurturingEnrollment> => {
    // Check if prospect is already enrolled
    const existing = await db.exec`
      SELECT id FROM nurturing_enrollments 
      WHERE prospect_id = ${req.prospectId} AND sequence_id = ${sequenceId} AND status = 'active'
    `;

    if (existing.rows.length > 0) {
      throw new Error('Prospect is already enrolled in this sequence');
    }

    // Get first step timing
    const firstStep = await db.exec`
      SELECT delay_days, delay_hours FROM nurturing_steps 
      WHERE sequence_id = ${sequenceId} AND step_number = 1 AND is_active = true
    `;

    let nextStepAt = new Date();
    if (firstStep.rows.length > 0) {
      const step = firstStep.rows[0];
      nextStepAt = new Date(Date.now() + (step.delay_days * 24 * 60 * 60 * 1000) + (step.delay_hours * 60 * 60 * 1000));
    }

    const result = await db.exec`
      INSERT INTO nurturing_enrollments (
        prospect_id, sequence_id, current_step, status, enrolled_at, next_step_at, metadata
      ) VALUES (
        ${req.prospectId}, ${sequenceId}, 1, 'active', NOW(), ${nextStepAt}, ${JSON.stringify(req.metadata || {})}
      )
      RETURNING id, prospect_id, sequence_id, current_step, status, enrolled_at, 
               last_step_at, next_step_at, completed_steps, metadata, created_at, updated_at
    `;

    const enrollment = result.rows[0];
    return {
      id: enrollment.id,
      prospectId: enrollment.prospect_id,
      sequenceId: enrollment.sequence_id,
      currentStep: enrollment.current_step,
      status: enrollment.status,
      enrolledAt: enrollment.enrolled_at,
      lastStepAt: enrollment.last_step_at,
      nextStepAt: enrollment.next_step_at,
      completedSteps: enrollment.completed_steps,
      metadata: enrollment.metadata
    };
  }
);

export const getActiveEnrollments = api(
  { method: "GET", path: "/enrollments/active", expose: true },
  async () => {
    const result = await db.exec`
      SELECT id, prospect_id, sequence_id, current_step, status, enrolled_at,
             last_step_at, next_step_at, completed_steps, metadata, created_at, updated_at
      FROM nurturing_enrollments
      WHERE status = 'active' AND next_step_at <= NOW()
      ORDER BY next_step_at ASC
      LIMIT 100
    `;

    return result.rows.map(row => ({
      id: row.id,
      prospectId: row.prospect_id,
      sequenceId: row.sequence_id,
      currentStep: row.current_step,
      status: row.status,
      enrolledAt: row.enrolled_at,
      lastStepAt: row.last_step_at,
      nextStepAt: row.next_step_at,
      completedSteps: row.completed_steps,
      metadata: row.metadata
    }));
  }
);

export const executeStep = api(
  { method: "POST", path: "/enrollments/:enrollmentId/execute", expose: true },
  async ({ enrollmentId }: { enrollmentId: string }): Promise<{ success: boolean; nextStepAt?: Date; completed?: boolean }> => {
    // Get enrollment and current step
    const enrollment = await db.exec`
      SELECT e.*, s.type, s.trigger_type, s.delay_days, s.delay_hours, s.content_template,
             s.personalization_rules, s.conditions, seq.name as sequence_name
      FROM nurturing_enrollments e
      JOIN nurturing_steps s ON s.sequence_id = e.sequence_id AND s.step_number = e.current_step
      JOIN nurturing_sequences seq ON seq.id = e.sequence_id
      WHERE e.id = ${enrollmentId} AND e.status = 'active'
    `;

    if (enrollment.rows.length === 0) {
      throw new Error('Enrollment not found or not active');
    }

    const enrollmentData = enrollment.rows[0];
    
    // Check if conditions are met
    const conditionsMet = await checkStepConditions(enrollmentData.prospect_id, enrollmentData.conditions);
    if (!conditionsMet) {
      // Reschedule for later
      const nextStepAt = new Date(Date.now() + 60 * 60 * 1000); // Try again in 1 hour
      await db.exec`
        UPDATE nurturing_enrollments SET next_step_at = ${nextStepAt} WHERE id = ${enrollmentId}
      `;
      return { success: false, nextStepAt };
    }

    let executionResult: any = { success: true };

    // Execute step based on type
    switch (enrollmentData.type) {
      case 'email':
        executionResult = await executeEmailStep(enrollmentData);
        break;
      case 'sms':
        executionResult = await executeSMSStep(enrollmentData);
        break;
      case 'task':
        executionResult = await executeTaskStep(enrollmentData);
        break;
      case 'delay':
        executionResult = { success: true }; // Delay is just waiting
        break;
      default:
        executionResult = { success: false, error: 'Unknown step type' };
    }

    // Log execution
    await db.exec`
      INSERT INTO nurturing_executions (
        enrollment_id, step_id, executed_at, status, result_data, error_message
      ) VALUES (
        ${enrollmentId}, 
        (SELECT id FROM nurturing_steps WHERE sequence_id = ${enrollmentData.sequence_id} AND step_number = ${enrollmentData.current_step}),
        NOW(), ${executionResult.success ? 'success' : 'failed'}, 
        ${JSON.stringify(executionResult)}, ${executionResult.error || null}
      )
    `;

    if (executionResult.success) {
      // Move to next step
      const nextStep = await db.exec`
        SELECT step_number, delay_days, delay_hours
        FROM nurturing_steps
        WHERE sequence_id = ${enrollmentData.sequence_id} 
        AND step_number > ${enrollmentData.current_step}
        AND is_active = true
        ORDER BY step_number ASC
        LIMIT 1
      `;

      if (nextStep.rows.length > 0) {
        // Calculate next step time
        const step = nextStep.rows[0];
        const nextStepAt = new Date(
          Date.now() + 
          (step.delay_days * 24 * 60 * 60 * 1000) + 
          (step.delay_hours * 60 * 60 * 1000)
        );

        await db.exec`
          UPDATE nurturing_enrollments 
          SET current_step = ${step.step_number}, 
              completed_steps = completed_steps + 1,
              last_step_at = NOW(),
              next_step_at = ${nextStepAt},
              updated_at = NOW()
          WHERE id = ${enrollmentId}
        `;

        return { success: true, nextStepAt };
      } else {
        // Sequence completed
        await db.exec`
          UPDATE nurturing_enrollments 
          SET status = 'completed', 
              completed_steps = completed_steps + 1,
              last_step_at = NOW(),
              next_step_at = NULL,
              updated_at = NOW()
          WHERE id = ${enrollmentId}
        `;

        return { success: true, completed: true };
      }
    } else {
      // Mark as failed
      await db.exec`
        UPDATE nurturing_enrollments 
        SET status = 'failed', updated_at = NOW()
        WHERE id = ${enrollmentId}
      `;

      return { success: false };
    }
  }
);

export const pauseEnrollment = api(
  { method: "POST", path: "/enrollments/:enrollmentId/pause", expose: true },
  async ({ enrollmentId }: { enrollmentId: string }): Promise<{ success: boolean }> => {
    await db.exec`
      UPDATE nurturing_enrollments 
      SET status = 'paused', updated_at = NOW()
      WHERE id = ${enrollmentId}
    `;
    return { success: true };
  }
);

export const resumeEnrollment = api(
  { method: "POST", path: "/enrollments/:enrollmentId/resume", expose: true },
  async ({ enrollmentId }: { enrollmentId: string }): Promise<{ success: boolean }> => {
    await db.exec`
      UPDATE nurturing_enrollments 
      SET status = 'active', updated_at = NOW()
      WHERE id = ${enrollmentId}
    `;
    return { success: true };
  }
);

// Cron job handler for processing scheduled nurturing steps
export const processScheduledStepsHandler = api(
  { method: "POST", path: "/cron/process-steps", expose: false },
  async (): Promise<{ processed: number }> => {
    console.log('Processing scheduled nurturing steps...');
    
    const activeEnrollments = await getActiveEnrollments();
    
    for (const enrollment of activeEnrollments) {
      try {
        await executeStep({ enrollmentId: enrollment.id });
        console.log(`Executed step for enrollment ${enrollment.id}`);
      } catch (error) {
        console.error(`Failed to execute step for enrollment ${enrollment.id}:`, error);
      }
    }
    
    console.log(`Processed ${activeEnrollments.length} scheduled steps`);
    return { processed: activeEnrollments.length };
  }
);

// Cron job to process scheduled nurturing steps
export const processScheduledSteps = new CronJob("process-nurturing-steps", {
  title: "Process Scheduled Nurturing Steps",
  endpoint: processScheduledStepsHandler,
  every: "5m", // Every 5 minutes
});

// Auto-enrollment cron job handler
export const autoEnrollProspectsHandler = api(
  { method: "POST", path: "/cron/auto-enroll", expose: false },
  async (): Promise<{ enrolled: number }> => {
    console.log('Checking for auto-enrollment opportunities...');
    
    let totalEnrolled = 0;
    
    // Get active sequences with auto-enrollment criteria
    const sequences = await db.exec`
      SELECT id, target_classification, target_stages
      FROM nurturing_sequences
      WHERE is_active = true
    `;

    for (const sequence of sequences.rows) {
      // Find prospects matching criteria who aren't already enrolled
      const prospects = await db.exec`
        SELECT DISTINCT pc.prospect_id
        FROM prospect_classifications pc
        LEFT JOIN nurturing_enrollments ne ON ne.prospect_id = pc.prospect_id 
          AND ne.sequence_id = ${sequence.id} 
          AND ne.status IN ('active', 'completed')
        WHERE pc.classification = ANY(${sequence.target_classification})
        AND pc.stage = ANY(${sequence.target_stages})
        AND ne.id IS NULL
        LIMIT 50
      `;

      for (const prospect of prospects.rows) {
        try {
          await enrollProspect({ 
            sequenceId: sequence.id, 
            prospectId: prospect.prospect_id 
          });
          console.log(`Auto-enrolled prospect ${prospect.prospect_id} in sequence ${sequence.id}`);
          totalEnrolled++;
        } catch (error) {
          console.error(`Failed to auto-enroll prospect ${prospect.prospect_id}:`, error);
        }
      }
    }
    
    return { enrolled: totalEnrolled };
  }
);

// Auto-enrollment cron job
export const autoEnrollProspects = new CronJob("auto-enroll-prospects", {
  title: "Auto-enroll Prospects in Nurturing Sequences",
  endpoint: autoEnrollProspectsHandler,
  every: "6h", // Every 6 hours
});

async function checkStepConditions(prospectId: string, conditions: any[]): Promise<boolean> {
  if (!conditions || conditions.length === 0) return true;

  for (const condition of conditions) {
    const { field, operator, value } = condition;
    
    // Get prospect data based on field
    let actualValue: any;
    
    if (field.startsWith('classification.')) {
      const classification = await db.exec`
        SELECT * FROM prospect_classifications WHERE prospect_id = ${prospectId}
      `;
      if (classification.rows.length === 0) return false;
      actualValue = classification.rows[0][field.split('.')[1]];
    } else if (field.startsWith('behavior.')) {
      // Check recent behavior
      const recentBehaviors = await db.exec`
        SELECT COUNT(*) as count FROM prospect_behaviors 
        WHERE prospect_id = ${prospectId} 
        AND timestamp > NOW() - INTERVAL '7 days'
        AND event_type = ${value}
      `;
      actualValue = parseInt(recentBehaviors.rows[0].count);
    }

    // Evaluate condition
    switch (operator) {
      case 'equals':
        if (actualValue !== value) return false;
        break;
      case 'not_equals':
        if (actualValue === value) return false;
        break;
      case 'greater_than':
        if (parseFloat(actualValue) <= parseFloat(value)) return false;
        break;
      case 'less_than':
        if (parseFloat(actualValue) >= parseFloat(value)) return false;
        break;
      case 'contains':
        if (!actualValue?.toString().includes(value)) return false;
        break;
      case 'not_contains':
        if (actualValue?.toString().includes(value)) return false;
        break;
    }
  }

  return true;
}

async function executeEmailStep(enrollmentData: any): Promise<any> {
  try {
    // Generate personalized content
    const content = await generateStepContent(enrollmentData);
    
    // Send email (integrate with email service)
    const emailResult = await sendEmail({
      to: enrollmentData.prospect_id, // This would be the prospect's email
      subject: content.subject,
      content: content.content,
      sequenceId: enrollmentData.sequence_id,
      stepNumber: enrollmentData.current_step
    });

    return { 
      success: true, 
      deliveryId: emailResult.deliveryId,
      type: 'email'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      type: 'email'
    };
  }
}

async function executeSMSStep(enrollmentData: any): Promise<any> {
  try {
    const content = await generateStepContent(enrollmentData);
    
    // Send SMS (integrate with SMS service)
    const smsResult = await sendSMS({
      to: enrollmentData.prospect_id,
      content: content.content,
      sequenceId: enrollmentData.sequence_id
    });

    return { 
      success: true, 
      deliveryId: smsResult.deliveryId,
      type: 'sms'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      type: 'sms'
    };
  }
}

async function executeTaskStep(enrollmentData: any): Promise<any> {
  try {
    // Create task for sales team
    const task = await createSalesTask({
      prospectId: enrollmentData.prospect_id,
      title: `Follow up with prospect - ${enrollmentData.sequence_name} Step ${enrollmentData.current_step}`,
      description: enrollmentData.content_template,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Due tomorrow
    });

    return { 
      success: true, 
      taskId: task.id,
      type: 'task'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      type: 'task'
    };
  }
}

async function generateStepContent(enrollmentData: any): Promise<{ subject?: string; content: string }> {
  // Use the content generator to personalize the template
  return {
    subject: `Follow up: ${enrollmentData.sequence_name}`,
    content: enrollmentData.content_template // Simplified - would use full personalization
  };
}

// Placeholder functions for integrations
async function sendEmail(params: any): Promise<{ deliveryId: string }> {
  // Would integrate with email service
  return { deliveryId: `email_${Date.now()}` };
}

async function sendSMS(params: any): Promise<{ deliveryId: string }> {
  // Would integrate with SMS service
  return { deliveryId: `sms_${Date.now()}` };
}

async function createSalesTask(params: any): Promise<{ id: string }> {
  // Would integrate with task management system
  return { id: `task_${Date.now()}` };
}