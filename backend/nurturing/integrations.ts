import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { executeQuery, insertRow } from "../shared/database";
import { broadcastMessage } from "../realtime/websocket";
import type { EmailProgressData, NurturingProgressData } from "../realtime/types";
import { auditDataChange } from "../audit/logger";

// Integration endpoints for connecting with existing email and analytics systems

// Track email engagement from existing email service
export const trackEmailEngagement = api<{
  prospect_id: string;
  email_campaign_id: string;
  engagement_type: 'open' | 'click' | 'reply' | 'bounce' | 'unsubscribe';
  metadata?: Record<string, any>;
}, { behavior_recorded: boolean }>(
  { expose: true, method: "POST", path: "/nurturing/track-email-engagement" },
  wrapAsync(async (req) => {
    validateField(req.prospect_id, "prospect_id", [Rules.required()]);
    validateField(req.email_campaign_id, "email_campaign_id", [Rules.required()]);
    validateField(req.engagement_type, "engagement_type", [Rules.required()]);

    // Calculate engagement score based on engagement type
    const engagementScores = {
      'open': 2,
      'click': 5,
      'reply': 8,
      'bounce': -2,
      'unsubscribe': -5
    };

    const engagementScore = engagementScores[req.engagement_type] || 0;

    // Record the behavior
    const behavior = await insertRow(
      () => nurturingDB.queryRow`
        INSERT INTO prospect_behaviors (
          prospect_id, behavior_type, metadata, timestamp, 
          engagement_score, source_campaign_id
        ) VALUES (
          ${req.prospect_id}, 
          ${'email_' + req.engagement_type}, 
          ${JSON.stringify(req.metadata || {})}, 
          NOW(), 
          ${engagementScore},
          ${req.email_campaign_id}
        )
        RETURNING *
      `,
      "record email engagement behavior"
    );

    // Update engagement pattern if exists
    await updateEngagementPattern(req.prospect_id);

    // Check if prospect needs re-classification
    await checkForReClassification(req.prospect_id);

    // Broadcast real-time update
    await broadcastMessage({
      type: "nurturing_progress",
      data: {
        prospectId: req.prospect_id,
        behaviorType: 'email_' + req.engagement_type,
        engagementScore,
        timestamp: new Date().toISOString()
      } as NurturingProgressData,
      timestamp: new Date().toISOString()
    }, "nurturing_progress");

    // Audit the engagement tracking
    await auditDataChange(
      'create',
      'prospect_behavior',
      behavior.id,
      null,
      {
        prospect_id: req.prospect_id,
        behavior_type: 'email_' + req.engagement_type,
        engagement_score: engagementScore,
        source_campaign_id: req.email_campaign_id
      },
      undefined,
      'nurturing',
      false
    );

    return { behavior_recorded: true };
  })
);

// Track website behavior from analytics systems
export const trackWebsiteBehavior = api<{
  prospect_id: string;
  page_url: string;
  behavior_type: 'page_view' | 'form_submit' | 'download' | 'video_watch';
  session_duration?: number;
  metadata?: Record<string, any>;
}, { behavior_recorded: boolean }>(
  { expose: true, method: "POST", path: "/nurturing/track-website-behavior" },
  wrapAsync(async (req) => {
    validateField(req.prospect_id, "prospect_id", [Rules.required()]);
    validateField(req.page_url, "page_url", [Rules.required()]);
    validateField(req.behavior_type, "behavior_type", [Rules.required()]);

    // Calculate engagement score based on behavior type and duration
    let engagementScore = 1; // Base score for any website activity
    
    switch (req.behavior_type) {
      case 'page_view':
        engagementScore = req.session_duration ? Math.min(5, Math.floor(req.session_duration / 30)) : 1;
        break;
      case 'form_submit':
        engagementScore = 7;
        break;
      case 'download':
        engagementScore = 6;
        break;
      case 'video_watch':
        engagementScore = 4;
        break;
    }

    // Record the behavior
    const behavior = await insertRow(
      () => nurturingDB.queryRow`
        INSERT INTO prospect_behaviors (
          prospect_id, behavior_type, metadata, timestamp, engagement_score
        ) VALUES (
          ${req.prospect_id}, 
          ${req.behavior_type === 'page_view' ? 'website_visit' : req.behavior_type}, 
          ${JSON.stringify({ page_url: req.page_url, session_duration: req.session_duration, ...req.metadata })}, 
          NOW(), 
          ${engagementScore}
        )
        RETURNING *
      `,
      "record website behavior"
    );

    // Update engagement pattern
    await updateEngagementPattern(req.prospect_id);

    // Check for re-classification
    await checkForReClassification(req.prospect_id);

    // Broadcast real-time update
    await broadcastMessage({
      type: "nurturing_progress",
      data: {
        prospectId: req.prospect_id,
        behaviorType: req.behavior_type,
        engagementScore,
        metadata: { page_url: req.page_url },
        timestamp: new Date().toISOString()
      } as NurturingProgressData,
      timestamp: new Date().toISOString()
    }, "nurturing_progress");

    return { behavior_recorded: true };
  })
);

// Sync with existing analytics to update sequence performance
export const syncSequencePerformance = api<{
  sequence_id: string;
  performance_data: {
    opens?: number;
    clicks?: number;
    replies?: number;
    conversions?: number;
    revenue?: number;
  };
}, { sync_completed: boolean }>(
  { expose: true, method: "POST", path: "/nurturing/sync-performance" },
  wrapAsync(async (req) => {
    validateField(req.sequence_id, "sequence_id", [Rules.required()]);

    // Calculate updated metrics
    const totalEngagements = (req.performance_data.opens || 0) + 
                           (req.performance_data.clicks || 0) + 
                           (req.performance_data.replies || 0);

    const engagementRate = totalEngagements > 0 ? 
      ((req.performance_data.clicks || 0) + (req.performance_data.replies || 0)) / totalEngagements * 100 : 0;

    const conversionRate = (req.performance_data.opens || 0) > 0 ?
      (req.performance_data.conversions || 0) / (req.performance_data.opens || 0) * 100 : 0;

    // Update sequence performance
    await executeQuery(
      () => nurturingDB.exec`
        UPDATE nurturing_sequences 
        SET 
          performance_metrics = ${JSON.stringify(req.performance_data)},
          avg_engagement_rate = ${engagementRate},
          conversion_rate = ${conversionRate},
          updated_at = NOW()
        WHERE id = ${req.sequence_id}
      `,
      "sync sequence performance"
    );

    // Broadcast performance update
    await broadcastMessage({
      type: "sequence_performance_update",
      data: {
        sequenceId: req.sequence_id,
        engagementRate,
        conversionRate,
        performanceData: req.performance_data
      },
      timestamp: new Date().toISOString()
    }, "sequence_performance");

    return { sync_completed: true };
  })
);

// Integration endpoint for CRM systems to enroll prospects automatically
export const autoEnrollFromCRM = api<{
  prospect_data: {
    id: string;
    email: string;
    name: string;
    company?: string;
    source?: string;
    score?: number;
  };
  enrollment_criteria?: {
    min_score?: number;
    required_source?: string;
    classification_override?: string;
  };
}, { enrollment_result: any }>(
  { expose: true, method: "POST", path: "/nurturing/auto-enroll" },
  wrapAsync(async (req) => {
    validateField(req.prospect_data.id, "prospect_data.id", [Rules.required()]);
    validateField(req.prospect_data.email, "prospect_data.email", [Rules.required(), Rules.email()]);

    const { prospect_data, enrollment_criteria } = req;

    // Check enrollment criteria
    if (enrollment_criteria?.min_score && (prospect_data.score || 0) < enrollment_criteria.min_score) {
      return { 
        enrollment_result: { 
          enrolled: false, 
          reason: "Score below minimum threshold" 
        } 
      };
    }

    if (enrollment_criteria?.required_source && prospect_data.source !== enrollment_criteria.required_source) {
      return { 
        enrollment_result: { 
          enrolled: false, 
          reason: "Source does not match criteria" 
        } 
      };
    }

    // Try to find existing classification or create one
    let classification = await nurturingDB.queryRow`
      SELECT * FROM prospect_classifications WHERE prospect_id = ${prospect_data.id}
    `;

    if (!classification) {
      // Create initial classification based on score or defaults
      const initialClassification = enrollment_criteria?.classification_override || 
        (prospect_data.score && prospect_data.score > 80 ? 'hot' :
         prospect_data.score && prospect_data.score > 60 ? 'warm' : 'cold');

      classification = await insertRow(
        () => nurturingDB.queryRow`
          INSERT INTO prospect_classifications (
            prospect_id, classification, funnel_stage, engagement_level,
            ai_reasoning, confidence_score, estimated_close_probability
          ) VALUES (
            ${prospect_data.id}, ${initialClassification}, 'awareness', 'medium',
            'Auto-enrolled from CRM with score ${prospect_data.score || 0}',
            0.5, ${(prospect_data.score || 50) / 100}
          )
          RETURNING *
        `,
        "create initial classification"
      );
    }

    // Find suitable sequence
    const suitableSequences = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT * FROM nurturing_sequences 
        WHERE status = 'active' 
        AND target_classification = ${classification.classification}
        ORDER BY conversion_rate DESC 
        LIMIT 3
      `,
      "find suitable sequences"
    );

    if (suitableSequences.length === 0) {
      return { 
        enrollment_result: { 
          enrolled: false, 
          reason: "No suitable sequence found" 
        } 
      };
    }

    // Enroll in best performing sequence
    const selectedSequence = suitableSequences[0];

    try {
      // Check if already enrolled
      const existingEnrollment = await nurturingDB.queryRow`
        SELECT * FROM prospect_sequence_enrollments 
        WHERE prospect_id = ${prospect_data.id} 
        AND sequence_id = ${selectedSequence.id}
        AND status IN ('active', 'paused')
      `;

      if (existingEnrollment) {
        return { 
          enrollment_result: { 
            enrolled: false, 
            reason: "Already enrolled in this sequence" 
          } 
        };
      }

      // Create enrollment
      const enrollment = await insertRow(
        () => nurturingDB.queryRow`
          INSERT INTO prospect_sequence_enrollments (
            prospect_id, sequence_id, current_step, status
          ) VALUES (
            ${prospect_data.id}, ${selectedSequence.id}, 1, 'active'
          )
          RETURNING *
        `,
        "create auto enrollment"
      );

      // Schedule first step
      const firstStep = await nurturingDB.queryRow`
        SELECT * FROM sequence_steps 
        WHERE sequence_id = ${selectedSequence.id} AND step_number = 1
      `;

      if (firstStep) {
        const scheduledAt = new Date();
        scheduledAt.setHours(scheduledAt.getHours() + (firstStep.delay_hours || 0));
        scheduledAt.setDate(scheduledAt.getDate() + (firstStep.delay_days || 0));

        await insertRow(
          () => nurturingDB.queryRow`
            INSERT INTO sequence_step_executions (
              enrollment_id, step_id, prospect_id, status, scheduled_at
            ) VALUES (
              ${enrollment.id}, ${firstStep.id}, ${prospect_data.id}, 'scheduled', ${scheduledAt}
            )
            RETURNING *
          `,
          "schedule first step"
        );
      }

      // Broadcast enrollment
      await broadcastMessage({
        type: "prospect_enrolled",
        data: {
          prospectId: prospect_data.id,
          sequenceId: selectedSequence.id,
          sequenceName: selectedSequence.name,
          enrollmentSource: "CRM Auto-Enroll"
        },
        timestamp: new Date().toISOString()
      }, "prospect_enrolled");

      return { 
        enrollment_result: { 
          enrolled: true, 
          sequence_id: selectedSequence.id,
          sequence_name: selectedSequence.name,
          enrollment_id: enrollment.id
        } 
      };

    } catch (error) {
      return { 
        enrollment_result: { 
          enrolled: false, 
          reason: `Enrollment failed: ${error}` 
        } 
      };
    }
  })
);

// Helper functions

async function updateEngagementPattern(prospectId: string): Promise<void> {
  // Get recent behaviors
  const recentBehaviors = await executeQuery(
    () => nurturingDB.queryAll`
      SELECT * FROM prospect_behaviors 
      WHERE prospect_id = ${prospectId}
      ORDER BY timestamp DESC 
      LIMIT 20
    `,
    "get recent behaviors for pattern update"
  );

  if (recentBehaviors.length === 0) return;

  // Calculate updated metrics
  const avgEngagementScore = recentBehaviors.reduce((sum, b) => sum + b.engagement_score, 0) / recentBehaviors.length;
  const frequencyScore = Math.min(100, recentBehaviors.length * 5);
  
  let engagementLevel = 'low';
  if (avgEngagementScore >= 6) engagementLevel = 'very_high';
  else if (avgEngagementScore >= 4) engagementLevel = 'high';
  else if (avgEngagementScore >= 2) engagementLevel = 'medium';
  else if (avgEngagementScore >= 1) engagementLevel = 'low';
  else engagementLevel = 'very_low';

  // Update or create engagement pattern
  await executeQuery(
    () => nurturingDB.exec`
      INSERT INTO engagement_patterns (
        prospect_id, pattern_type, description, frequency_score,
        engagement_level, confidence_score, last_updated
      ) VALUES (
        ${prospectId}, 'updated_pattern', 'Auto-updated from behavior tracking',
        ${frequencyScore}, ${engagementLevel}, 0.7, NOW()
      )
      ON CONFLICT (prospect_id) 
      DO UPDATE SET 
        frequency_score = ${frequencyScore},
        engagement_level = ${engagementLevel},
        confidence_score = 0.7,
        last_updated = NOW()
    `,
    "update engagement pattern"
  );
}

async function checkForReClassification(prospectId: string): Promise<void> {
  // Get current classification
  const classification = await nurturingDB.queryRow`
    SELECT * FROM prospect_classifications WHERE prospect_id = ${prospectId}
  `;

  if (!classification) return;

  // Get recent high-engagement behaviors
  const highEngagementBehaviors = await executeQuery(
    () => nurturingDB.queryAll`
      SELECT COUNT(*) as count
      FROM prospect_behaviors 
      WHERE prospect_id = ${prospectId}
      AND timestamp > NOW() - INTERVAL '7 days'
      AND engagement_score >= 5
    `,
    "get high engagement behaviors"
  );

  const highEngagementCount = highEngagementBehaviors[0]?.count || 0;

  // Re-classify if there's significant engagement increase
  if (highEngagementCount >= 3 && classification.classification !== 'hot') {
    const newClassification = highEngagementCount >= 5 ? 'hot' : 'warm';
    
    await executeQuery(
      () => nurturingDB.exec`
        UPDATE prospect_classifications 
        SET 
          classification = ${newClassification},
          ai_reasoning = 'Auto-updated due to increased engagement activity',
          confidence_score = 0.8,
          last_updated = NOW()
        WHERE prospect_id = ${prospectId}
      `,
      "update classification"
    );

    // Broadcast classification update
    await broadcastMessage({
      type: "classification_updated",
      data: {
        prospectId,
        oldClassification: classification.classification,
        newClassification,
        reason: "Increased engagement activity"
      },
      timestamp: new Date().toISOString()
    }, "classification_updated");
  }
}