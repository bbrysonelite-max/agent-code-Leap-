import { api } from "encore.dev/api";
import { db } from "./db";
import { 
  NurturingSequence, 
  NurturingEnrollment, 
  NurturingAnalytics,
  StepPerformance,
  OptimizeSequenceRequest 
} from "./types";

export const getSequences = api(
  { method: "GET", path: "/sequences", expose: true },
  async ({ isActive }: { isActive?: boolean } = {}) => {
    let query = `
      SELECT s.id, s.name, s.description, s.target_classification, s.target_stages, 
             s.is_active, s.created_at, s.updated_at,
             COUNT(DISTINCT e.id) as total_enrollments,
             COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END) as active_enrollments,
             COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) as completed_enrollments
      FROM nurturing_sequences s
      LEFT JOIN nurturing_enrollments e ON e.sequence_id = s.id
    `;
    
    const params: any[] = [];
    if (isActive !== undefined) {
      query += ` WHERE s.is_active = $1`;
      params.push(isActive);
    }
    
    query += ` GROUP BY s.id, s.name, s.description, s.target_classification, s.target_stages, s.is_active, s.created_at, s.updated_at ORDER BY s.created_at DESC`;

    const result = await db.exec(query, ...params);

    const sequences: NurturingSequence[] = [];
    for (const row of result.rows) {
      // Get steps for each sequence
      const stepsResult = await db.exec`
        SELECT id, sequence_id, step_number, type, trigger_type, trigger_value,
               delay_days, delay_hours, content_template, personalization_rules, conditions, is_active
        FROM nurturing_steps
        WHERE sequence_id = ${row.id}
        ORDER BY step_number ASC
      `;

      sequences.push({
        id: row.id,
        name: row.name,
        description: row.description,
        targetClassification: row.target_classification,
        targetStages: row.target_stages,
        isActive: row.is_active,
        steps: stepsResult.rows.map(step => ({
          id: step.id,
          sequenceId: step.sequence_id,
          stepNumber: step.step_number,
          type: step.type,
          trigger: step.trigger_type,
          triggerValue: step.trigger_value,
          delayDays: step.delay_days,
          delayHours: step.delay_hours,
          contentTemplate: step.content_template,
          personalizationRules: step.personalization_rules,
          conditions: step.conditions,
          isActive: step.is_active
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }

    return sequences;
  }
);

export const getSequence = api(
  { method: "GET", path: "/sequences/:sequenceId", expose: true },
  async ({ sequenceId }: { sequenceId: string }) => {
    const sequenceResult = await db.exec`
      SELECT id, name, description, target_classification, target_stages, is_active, created_at, updated_at
      FROM nurturing_sequences
      WHERE id = ${sequenceId}
    `;

    if (sequenceResult.rows.length === 0) return null;

    const sequence = sequenceResult.rows[0];

    const stepsResult = await db.exec`
      SELECT id, sequence_id, step_number, type, trigger_type, trigger_value,
             delay_days, delay_hours, content_template, personalization_rules, conditions, is_active
      FROM nurturing_steps
      WHERE sequence_id = ${sequenceId}
      ORDER BY step_number ASC
    `;

    return {
      id: sequence.id,
      name: sequence.name,
      description: sequence.description,
      targetClassification: sequence.target_classification,
      targetStages: sequence.target_stages,
      isActive: sequence.is_active,
      steps: stepsResult.rows.map(step => ({
        id: step.id,
        sequenceId: step.sequence_id,
        stepNumber: step.step_number,
        type: step.type,
        trigger: step.trigger_type,
        triggerValue: step.trigger_value,
        delayDays: step.delay_days,
        delayHours: step.delay_hours,
        contentTemplate: step.content_template,
        personalizationRules: step.personalization_rules,
        conditions: step.conditions,
        isActive: step.is_active
      })),
      createdAt: sequence.created_at,
      updatedAt: sequence.updated_at
    };
  }
);

export const updateSequence = api(
  { method: "PUT", path: "/sequences/:sequenceId", expose: true },
  async ({ sequenceId, ...updates }: { sequenceId: string } & Partial<NurturingSequence>): Promise<NurturingSequence> => {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 0;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${++paramIndex}`);
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${++paramIndex}`);
      updateValues.push(updates.description);
    }
    if (updates.targetClassification !== undefined) {
      updateFields.push(`target_classification = $${++paramIndex}`);
      updateValues.push(JSON.stringify(updates.targetClassification));
    }
    if (updates.targetStages !== undefined) {
      updateFields.push(`target_stages = $${++paramIndex}`);
      updateValues.push(JSON.stringify(updates.targetStages));
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${++paramIndex}`);
      updateValues.push(updates.isActive);
    }

    updateFields.push(`updated_at = NOW()`);

    const query = `
      UPDATE nurturing_sequences 
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramIndex}
      RETURNING id, name, description, target_classification, target_stages, is_active, created_at, updated_at
    `;
    updateValues.push(sequenceId);

    const result = await db.exec(query, ...updateValues);
    
    if (result.rows.length === 0) {
      throw new Error('Sequence not found');
    }

    const sequence = result.rows[0];

    // Get steps
    const stepsResult = await db.exec`
      SELECT id, sequence_id, step_number, type, trigger_type, trigger_value,
             delay_days, delay_hours, content_template, personalization_rules, conditions, is_active
      FROM nurturing_steps
      WHERE sequence_id = ${sequenceId}
      ORDER BY step_number ASC
    `;

    return {
      id: sequence.id,
      name: sequence.name,
      description: sequence.description,
      targetClassification: sequence.target_classification,
      targetStages: sequence.target_stages,
      isActive: sequence.is_active,
      steps: stepsResult.rows.map(step => ({
        id: step.id,
        sequenceId: step.sequence_id,
        stepNumber: step.step_number,
        type: step.type,
        trigger: step.trigger_type,
        triggerValue: step.trigger_value,
        delayDays: step.delay_days,
        delayHours: step.delay_hours,
        contentTemplate: step.content_template,
        personalizationRules: step.personalization_rules,
        conditions: step.conditions,
        isActive: step.is_active
      })),
      createdAt: sequence.created_at,
      updatedAt: sequence.updated_at
    };
  }
);

export const deleteSequence = api(
  { method: "DELETE", path: "/sequences/:sequenceId", expose: true },
  async ({ sequenceId }: { sequenceId: string }): Promise<{ success: boolean }> => {
    // Check for active enrollments
    const activeEnrollments = await db.exec`
      SELECT COUNT(*) as count FROM nurturing_enrollments 
      WHERE sequence_id = ${sequenceId} AND status = 'active'
    `;

    if (parseInt(activeEnrollments.rows[0].count) > 0) {
      throw new Error('Cannot delete sequence with active enrollments');
    }

    await db.exec`DELETE FROM nurturing_sequences WHERE id = ${sequenceId}`;
    return { success: true };
  }
);

export const getSequenceEnrollments = api(
  { method: "GET", path: "/sequences/:sequenceId/enrollments", expose: true },
  async ({ 
    sequenceId, 
    status, 
    limit = 50, 
    offset = 0 
  }: { 
    sequenceId: string; 
    status?: string; 
    limit?: number; 
    offset?: number;
  }) => {
    let query = `
      SELECT id, prospect_id, sequence_id, current_step, status, enrolled_at,
             last_step_at, next_step_at, completed_steps, metadata, created_at, updated_at
      FROM nurturing_enrollments
      WHERE sequence_id = $1
    `;
    const params: any[] = [sequenceId];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${++paramIndex}`;
      params.push(status);
    }

    query += ` ORDER BY enrolled_at DESC LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;
    params.push(limit, offset);

    const result = await db.exec(query, ...params);

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

export const getSequenceAnalytics = api(
  { method: "GET", path: "/sequences/:sequenceId/analytics", expose: true },
  async ({ sequenceId, days = 30 }: { sequenceId: string; days?: number }): Promise<NurturingAnalytics> => {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get enrollment metrics
    const enrollmentMetrics = await db.exec`
      SELECT 
        COUNT(*) as total_enrolled,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_enrollments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_enrollments,
        AVG(CASE WHEN status = 'completed' THEN EXTRACT(epoch FROM (updated_at - enrolled_at))/86400 END) as avg_days_to_completion
      FROM nurturing_enrollments
      WHERE sequence_id = ${sequenceId} AND enrolled_at >= ${startDate}
    `;

    const metrics = enrollmentMetrics.rows[0];
    const conversionRate = metrics.total_enrolled > 0 ? 
      parseFloat(metrics.completed_enrollments) / parseFloat(metrics.total_enrolled) : 0;

    // Get execution metrics
    const executionMetrics = await db.exec`
      SELECT 
        COUNT(*) as total_sent,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as total_clicked,
        COUNT(CASE WHEN responded_at IS NOT NULL THEN 1 END) as total_responded,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed
      FROM nurturing_executions ex
      JOIN nurturing_enrollments en ON en.id = ex.enrollment_id
      WHERE en.sequence_id = ${sequenceId} AND ex.executed_at >= ${startDate}
    `;

    const execMetrics = executionMetrics.rows[0];
    const totalSent = parseInt(execMetrics.total_sent);
    const openRate = totalSent > 0 ? parseInt(execMetrics.total_opened) / totalSent : 0;
    const clickRate = totalSent > 0 ? parseInt(execMetrics.total_clicked) / totalSent : 0;
    const responseRate = totalSent > 0 ? parseInt(execMetrics.total_responded) / totalSent : 0;
    const unsubscribeRate = 0; // Would calculate from unsubscribe events

    // Get step performance
    const stepPerformance = await db.exec`
      SELECT 
        s.step_number,
        COUNT(ex.id) as sent_count,
        COUNT(CASE WHEN ex.status = 'success' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN ex.opened_at IS NOT NULL THEN 1 END) as open_count,
        COUNT(CASE WHEN ex.clicked_at IS NOT NULL THEN 1 END) as click_count,
        COUNT(CASE WHEN ex.responded_at IS NOT NULL THEN 1 END) as response_count,
        COUNT(CASE WHEN ex.status = 'failed' THEN 1 END) as bounce_count
      FROM nurturing_steps s
      LEFT JOIN nurturing_executions ex ON ex.step_id = s.id
      LEFT JOIN nurturing_enrollments en ON en.id = ex.enrollment_id
      WHERE s.sequence_id = ${sequenceId} 
      AND (ex.executed_at IS NULL OR ex.executed_at >= ${startDate})
      GROUP BY s.step_number
      ORDER BY s.step_number
    `;

    const stepPerf: StepPerformance[] = stepPerformance.rows.map(row => {
      const sentCount = parseInt(row.sent_count);
      const deliveredCount = parseInt(row.delivered_count);
      const dropoffRate = sentCount > 0 ? 
        (sentCount - deliveredCount) / sentCount : 0;

      return {
        stepNumber: row.step_number,
        sentCount,
        deliveredCount,
        openCount: parseInt(row.open_count),
        clickCount: parseInt(row.click_count),
        responseCount: parseInt(row.response_count),
        unsubscribeCount: 0, // Would calculate from actual data
        bounceCount: parseInt(row.bounce_count),
        dropoffRate
      };
    });

    return {
      sequenceId,
      totalEnrolled: parseInt(metrics.total_enrolled),
      activeEnrollments: parseInt(metrics.active_enrollments),
      completedEnrollments: parseInt(metrics.completed_enrollments),
      conversionRate,
      avgTimeToConversion: parseFloat(metrics.avg_days_to_completion) || 0,
      stepPerformance: stepPerf,
      engagementMetrics: {
        totalSent,
        openRate,
        clickRate,
        responseRate,
        unsubscribeRate
      }
    };
  }
);

export const optimizeSequence = api(
  { method: "POST", path: "/sequences/:sequenceId/optimize", expose: true },
  async ({ sequenceId, ...req }: { sequenceId: string } & OptimizeSequenceRequest): Promise<{ recommendations: string[]; estimatedImprovement: number }> => {
    const analytics = await getSequenceAnalytics({ sequenceId, days: 90 });
    const sequence = await getSequence({ sequenceId });
    
    if (!sequence) {
      throw new Error('Sequence not found');
    }

    const recommendations: string[] = [];
    let estimatedImprovement = 0;

    // Analyze performance and generate recommendations
    
    // Low open rates
    if (analytics.engagementMetrics.openRate < 0.2) {
      recommendations.push('Subject lines may need improvement - consider A/B testing different approaches');
      recommendations.push('Send timing optimization - analyze prospect engagement patterns for better timing');
      estimatedImprovement += 15;
    }

    // Low click rates but good open rates
    if (analytics.engagementMetrics.openRate > 0.2 && analytics.engagementMetrics.clickRate < 0.05) {
      recommendations.push('Content relevance needs improvement - personalize based on prospect classification');
      recommendations.push('Call-to-action optimization - make CTAs more prominent and compelling');
      estimatedImprovement += 10;
    }

    // Step dropoff analysis
    let previousStepSent = 0;
    for (const step of analytics.stepPerformance) {
      if (previousStepSent > 0 && step.dropoffRate > 0.3) {
        recommendations.push(`Step ${step.stepNumber} has high dropoff rate (${Math.round(step.dropoffRate * 100)}%) - consider reducing delay or improving content`);
        estimatedImprovement += 8;
      }
      previousStepSent = step.sentCount;
    }

    // Low conversion rate
    if (analytics.conversionRate < 0.1) {
      recommendations.push('Overall sequence conversion is low - consider adding more value-driven content');
      recommendations.push('Sequence may be too long - analyze optimal sequence length for your audience');
      estimatedImprovement += 20;
    }

    // Long time to conversion
    if (analytics.avgTimeToConversion > 30) {
      recommendations.push('Time to conversion is high - consider adding urgency elements or shortening delays');
      estimatedImprovement += 12;
    }

    // Target optimization based on goal
    switch (req.optimizationGoal) {
      case 'conversion':
        recommendations.push('Focus on prospects showing buying signals in classification');
        recommendations.push('Add social proof and case studies to later steps');
        break;
      case 'engagement':
        recommendations.push('Increase content variety and interactive elements');
        recommendations.push('Optimize send times based on engagement patterns');
        break;
      case 'response_rate':
        recommendations.push('Add direct questions and clear response mechanisms');
        recommendations.push('Reduce content length for better readability');
        break;
    }

    // AI-based insights from prospect classifications
    const classifications = await db.exec`
      SELECT pc.classification, pc.stage, COUNT(*) as count
      FROM prospect_classifications pc
      JOIN nurturing_enrollments ne ON ne.prospect_id = pc.prospect_id
      WHERE ne.sequence_id = ${sequenceId}
      GROUP BY pc.classification, pc.stage
      ORDER BY count DESC
    `;

    if (classifications.rows.length > 0) {
      const topClassification = classifications.rows[0];
      recommendations.push(`Most enrolled prospects are ${topClassification.classification} in ${topClassification.stage} stage - tailor content accordingly`);
    }

    return {
      recommendations,
      estimatedImprovement: Math.min(estimatedImprovement, 50) // Cap at 50%
    };
  }
);

export const duplicateSequence = api(
  { method: "POST", path: "/sequences/:sequenceId/duplicate", expose: true },
  async ({ sequenceId, name }: { sequenceId: string; name: string }): Promise<NurturingSequence> => {
    const originalSequence = await getSequence({ sequenceId });
    
    if (!originalSequence) {
      throw new Error('Original sequence not found');
    }

    // Create new sequence
    const newSequenceResult = await db.exec`
      INSERT INTO nurturing_sequences (name, description, target_classification, target_stages, is_active)
      VALUES (${name}, ${originalSequence.description + ' (Copy)'}, 
              ${JSON.stringify(originalSequence.targetClassification)}, 
              ${JSON.stringify(originalSequence.targetStages)}, false)
      RETURNING id, name, description, target_classification, target_stages, is_active, created_at, updated_at
    `;

    const newSequence = newSequenceResult.rows[0];

    // Copy steps
    for (const step of originalSequence.steps) {
      await db.exec`
        INSERT INTO nurturing_steps (
          sequence_id, step_number, type, trigger_type, trigger_value,
          delay_days, delay_hours, content_template, personalization_rules, conditions, is_active
        ) VALUES (
          ${newSequence.id}, ${step.stepNumber}, ${step.type}, ${step.trigger}, ${step.triggerValue},
          ${step.delayDays}, ${step.delayHours}, ${step.contentTemplate},
          ${JSON.stringify(step.personalizationRules)}, ${JSON.stringify(step.conditions)}, ${step.isActive}
        )
      `;
    }

    return {
      id: newSequence.id,
      name: newSequence.name,
      description: newSequence.description,
      targetClassification: newSequence.target_classification,
      targetStages: newSequence.target_stages,
      isActive: newSequence.is_active,
      steps: originalSequence.steps.map(step => ({
        ...step,
        id: `${step.id}_copy`, // Simplified for demo
        sequenceId: newSequence.id
      })),
      createdAt: newSequence.created_at,
      updatedAt: newSequence.updated_at
    };
  }
);

export const getBulkEnrollmentCandidates = api(
  { method: "GET", path: "/sequences/:sequenceId/enrollment-candidates", expose: true },
  async ({ 
    sequenceId, 
    limit = 100 
  }: { 
    sequenceId: string; 
    limit?: number;
  }) => {
    const sequence = await getSequence({ sequenceId });
    
    if (!sequence) {
      throw new Error('Sequence not found');
    }

    const candidates = await db.exec`
      SELECT DISTINCT 
        pc.prospect_id,
        pc.classification,
        pc.stage,
        pc.confidence as score
      FROM prospect_classifications pc
      LEFT JOIN nurturing_enrollments ne ON ne.prospect_id = pc.prospect_id 
        AND ne.sequence_id = ${sequenceId} 
        AND ne.status IN ('active', 'completed')
      WHERE pc.classification = ANY(${JSON.stringify(sequence.targetClassification)})
      AND pc.stage = ANY(${JSON.stringify(sequence.targetStages)})
      AND ne.id IS NULL
      ORDER BY pc.confidence DESC
      LIMIT ${limit}
    `;

    return candidates.rows.map(row => ({
      prospectId: row.prospect_id,
      classification: row.classification,
      stage: row.stage,
      score: parseFloat(row.score)
    }));
  }
);

export const bulkEnrollProspects = api(
  { method: "POST", path: "/sequences/:sequenceId/bulk-enroll", expose: true },
  async ({ 
    sequenceId, 
    prospectIds 
  }: { 
    sequenceId: string; 
    prospectIds: string[];
  }): Promise<{ enrolled: number; failed: string[] }> => {
    let enrolled = 0;
    const failed: string[] = [];

    for (const prospectId of prospectIds) {
      try {
        await enrollProspect({ sequenceId, prospectId });
        enrolled++;
      } catch (error) {
        failed.push(prospectId);
      }
    }

    return { enrolled, failed };
  }
);