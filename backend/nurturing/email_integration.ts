import { api } from "encore.dev/api";
import { db } from "./db";

// Import email service functions
export async function sendNurturingEmail(params: {
  to: string;
  prospectId: string;
  subject: string;
  content: string;
  sequenceId: string;
  stepNumber: number;
  enrollmentId: string;
}): Promise<{ deliveryId: string; success: boolean }> {
  try {
    // Generate personalized content
    const personalizedContent = await generatePersonalizedEmailContent(
      params.prospectId,
      params.subject,
      params.content,
      params.sequenceId
    );

    // Send email using existing email service
    const emailResult = await sendEmailViaService({
      to: params.to,
      subject: personalizedContent.subject,
      htmlContent: personalizedContent.htmlContent,
      textContent: personalizedContent.textContent,
      metadata: {
        type: 'nurturing',
        sequenceId: params.sequenceId,
        stepNumber: params.stepNumber,
        enrollmentId: params.enrollmentId,
        prospectId: params.prospectId
      }
    });

    // Track email sent event
    await trackEmailEvent({
      enrollmentId: params.enrollmentId,
      deliveryId: emailResult.deliveryId,
      eventType: 'sent',
      prospectId: params.prospectId
    });

    return {
      deliveryId: emailResult.deliveryId,
      success: true
    };
  } catch (error) {
    console.error('Failed to send nurturing email:', error);
    
    // Track failed event
    await trackEmailEvent({
      enrollmentId: params.enrollmentId,
      deliveryId: '',
      eventType: 'failed',
      prospectId: params.prospectId,
      errorMessage: error.message
    });

    return {
      deliveryId: '',
      success: false
    };
  }
}

async function generatePersonalizedEmailContent(
  prospectId: string,
  subject: string,
  content: string,
  sequenceId: string
): Promise<{ subject: string; htmlContent: string; textContent: string }> {
  // Get prospect data for personalization
  const prospectData = await getProspectDataForEmail(prospectId);
  const classification = await getProspectClassification(prospectId);
  const engagement = await getEngagementPattern(prospectId);

  // Generate personalization variables
  const variables = await generatePersonalizationVariables(
    prospectData,
    classification,
    engagement
  );

  // Apply personalization to subject and content
  let personalizedSubject = subject;
  let personalizedContent = content;

  // Replace variables
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    personalizedSubject = personalizedSubject.replace(regex, variables[key]);
    personalizedContent = personalizedContent.replace(regex, variables[key]);
  });

  // Apply conditional logic
  personalizedContent = applyConditionalLogic(personalizedContent, variables);

  // Convert to HTML
  const htmlContent = convertToHTML(personalizedContent, prospectData, sequenceId);
  
  return {
    subject: personalizedSubject,
    htmlContent,
    textContent: personalizedContent
  };
}

async function sendEmailViaService(params: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  metadata: Record<string, any>;
}): Promise<{ deliveryId: string }> {
  // This would integrate with the existing email service
  // For now, we'll simulate the email send
  
  // In a real implementation, this would call:
  // return await emailService.send(params);
  
  return {
    deliveryId: `nurturing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

async function trackEmailEvent(params: {
  enrollmentId: string;
  deliveryId: string;
  eventType: string;
  prospectId: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    // Update nurturing execution record
    await db.exec`
      UPDATE nurturing_executions 
      SET delivery_id = ${params.deliveryId}, 
          status = ${params.eventType},
          error_message = ${params.errorMessage || null}
      WHERE enrollment_id = ${params.enrollmentId} 
      AND executed_at > NOW() - INTERVAL '1 hour'
      ORDER BY executed_at DESC
      LIMIT 1
    `;

    // Track behavior for analytics
    if (params.eventType !== 'failed') {
      await trackProspectBehavior({
        prospectId: params.prospectId,
        eventType: `email_${params.eventType}`,
        eventData: {
          deliveryId: params.deliveryId,
          enrollmentId: params.enrollmentId,
          source: 'nurturing_sequence'
        },
        source: 'nurturing_system'
      });
    }
  } catch (error) {
    console.error('Failed to track email event:', error);
  }
}

// Email event webhook handlers
export const handleEmailOpened = api(
  { method: "POST", path: "/email/webhook/opened", expose: true },
  async (params: { deliveryId: string; timestamp: string; metadata?: Record<string, any> }): Promise<{ success: boolean }> => {
    try {
      // Find the nurturing execution
      const execution = await db.exec`
        SELECT ne.enrollment_id, ne.prospect_id
        FROM nurturing_executions ne
        WHERE ne.delivery_id = ${params.deliveryId}
      `;

      if (execution.rows.length > 0) {
        const { enrollment_id, prospect_id } = execution.rows[0];

        // Update execution record
        await db.exec`
          UPDATE nurturing_executions 
          SET opened_at = ${params.timestamp}
          WHERE delivery_id = ${params.deliveryId}
        `;

        // Track behavior
        await trackProspectBehavior({
          prospectId: prospect_id,
          eventType: 'email_open',
          eventData: {
            deliveryId: params.deliveryId,
            enrollmentId: enrollment_id,
            source: 'nurturing_sequence'
          },
          source: 'email_tracking'
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to handle email opened event:', error);
      return { success: false };
    }
  }
);

export const handleEmailClicked = api(
  { method: "POST", path: "/email/webhook/clicked", expose: true },
  async (params: { 
    deliveryId: string; 
    timestamp: string; 
    url: string;
    metadata?: Record<string, any> 
  }): Promise<{ success: boolean }> => {
    try {
      const execution = await db.exec`
        SELECT ne.enrollment_id, ne.prospect_id
        FROM nurturing_executions ne
        WHERE ne.delivery_id = ${params.deliveryId}
      `;

      if (execution.rows.length > 0) {
        const { enrollment_id, prospect_id } = execution.rows[0];

        // Update execution record
        await db.exec`
          UPDATE nurturing_executions 
          SET clicked_at = ${params.timestamp}
          WHERE delivery_id = ${params.deliveryId}
        `;

        // Track behavior with higher score for clicks
        await trackProspectBehavior({
          prospectId: prospect_id,
          eventType: 'email_click',
          eventData: {
            deliveryId: params.deliveryId,
            enrollmentId: enrollment_id,
            url: params.url,
            source: 'nurturing_sequence'
          },
          source: 'email_tracking'
        });

        // Check if this click should trigger any behavior-based sequences
        await checkBehaviorTriggers(prospect_id, 'email_click', {
          url: params.url,
          deliveryId: params.deliveryId
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to handle email clicked event:', error);
      return { success: false };
    }
  }
);

export const handleEmailReplied = api(
  { method: "POST", path: "/email/webhook/replied", expose: true },
  async (params: { 
    deliveryId: string; 
    timestamp: string; 
    replyContent: string;
    metadata?: Record<string, any> 
  }): Promise<{ success: boolean }> => {
    try {
      const execution = await db.exec`
        SELECT ne.enrollment_id, ne.prospect_id
        FROM nurturing_executions ne
        WHERE ne.delivery_id = ${params.deliveryId}
      `;

      if (execution.rows.length > 0) {
        const { enrollment_id, prospect_id } = execution.rows[0];

        // Update execution record
        await db.exec`
          UPDATE nurturing_executions 
          SET responded_at = ${params.timestamp}
          WHERE delivery_id = ${params.deliveryId}
        `;

        // Track high-value behavior
        await trackProspectBehavior({
          prospectId: prospect_id,
          eventType: 'email_reply',
          eventData: {
            deliveryId: params.deliveryId,
            enrollmentId: enrollment_id,
            replyContent: params.replyContent,
            source: 'nurturing_sequence'
          },
          source: 'email_tracking'
        });

        // Consider pausing the nurturing sequence since they replied
        await pauseNurturingSequenceForProspect(prospect_id, enrollment_id, 'prospect_replied');

        // Notify sales team
        await notifySalesTeam({
          prospectId: prospect_id,
          event: 'nurturing_reply',
          data: {
            replyContent: params.replyContent,
            enrollmentId: enrollment_id
          }
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to handle email replied event:', error);
      return { success: false };
    }
  }
);

export const handleEmailUnsubscribed = api(
  { method: "POST", path: "/email/webhook/unsubscribed", expose: true },
  async (params: { 
    deliveryId: string; 
    timestamp: string; 
    prospectEmail: string;
    metadata?: Record<string, any> 
  }): Promise<{ success: boolean }> => {
    try {
      const execution = await db.exec`
        SELECT ne.enrollment_id, ne.prospect_id
        FROM nurturing_executions ne
        WHERE ne.delivery_id = ${params.deliveryId}
      `;

      if (execution.rows.length > 0) {
        const { enrollment_id, prospect_id } = execution.rows[0];

        // Mark enrollment as unsubscribed
        await db.exec`
          UPDATE nurturing_enrollments 
          SET status = 'unsubscribed', updated_at = NOW()
          WHERE id = ${enrollment_id}
        `;

        // Track unsubscribe behavior
        await trackProspectBehavior({
          prospectId: prospect_id,
          eventType: 'email_unsubscribe',
          eventData: {
            deliveryId: params.deliveryId,
            enrollmentId: enrollment_id,
            email: params.prospectEmail,
            source: 'nurturing_sequence'
          },
          source: 'email_tracking'
        });

        // Pause all active nurturing sequences for this prospect
        await db.exec`
          UPDATE nurturing_enrollments 
          SET status = 'unsubscribed', updated_at = NOW()
          WHERE prospect_id = ${prospect_id} AND status = 'active'
        `;
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to handle email unsubscribed event:', error);
      return { success: false };
    }
  }
);

// Helper functions
async function getProspectDataForEmail(prospectId: string): Promise<any> {
  // This would typically fetch from the prospect service
  return {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    company: 'Tech Corp',
    title: 'CTO',
    industry: 'Technology'
  };
}

async function getProspectClassification(prospectId: string): Promise<any> {
  const result = await db.exec`
    SELECT * FROM prospect_classifications WHERE prospect_id = ${prospectId}
  `;
  return result.rows[0] || null;
}

async function getEngagementPattern(prospectId: string): Promise<any> {
  const result = await db.exec`
    SELECT * FROM engagement_patterns WHERE prospect_id = ${prospectId}
  `;
  return result.rows[0] || null;
}

async function generatePersonalizationVariables(
  prospectData: any,
  classification: any,
  engagement: any
): Promise<Record<string, string>> {
  const variables: Record<string, string> = {};

  // Basic variables
  variables.firstName = prospectData?.firstName || 'there';
  variables.lastName = prospectData?.lastName || '';
  variables.fullName = `${variables.firstName} ${variables.lastName}`.trim();
  variables.company = prospectData?.company || 'your company';
  variables.title = prospectData?.title || 'your role';
  variables.industry = prospectData?.industry || 'your industry';

  // Classification variables
  if (classification) {
    variables.classification = classification.classification;
    variables.stage = classification.stage;
    variables.confidence = Math.round(classification.confidence * 100).toString();
  }

  // Engagement variables
  if (engagement) {
    variables.responseRate = Math.round(engagement.response_rate * 100).toString();
    variables.engagementTrend = engagement.engagement_trend;
  }

  // Time-based variables
  const now = new Date();
  variables.currentDate = now.toLocaleDateString();
  variables.dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];

  return variables;
}

function applyConditionalLogic(content: string, variables: Record<string, string>): string {
  // Handle conditional blocks like {{#if classification == 'hot'}}...{{/if}}
  const conditionalRegex = /{{#if\s+(\w+)\s*(==|!=|>|<)\s*'([^']+)'}}(.*?){{\/if}}/gs;
  
  return content.replace(conditionalRegex, (match, variable, operator, value, block) => {
    const variableValue = variables[variable];
    let condition = false;

    switch (operator) {
      case '==':
        condition = variableValue === value;
        break;
      case '!=':
        condition = variableValue !== value;
        break;
      case '>':
        condition = parseFloat(variableValue) > parseFloat(value);
        break;
      case '<':
        condition = parseFloat(variableValue) < parseFloat(value);
        break;
    }

    return condition ? block : '';
  });
}

function convertToHTML(content: string, prospectData: any, sequenceId: string): string {
  // Convert text to HTML with basic formatting
  let html = content
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  // Wrap in paragraphs
  html = `<p>${html}</p>`;
  
  // Add tracking pixel and unsubscribe link
  html += `
    <img src="https://track.example.com/pixel?prospect=${prospectData.email}&seq=${sequenceId}" width="1" height="1" style="display:none;">
    <div style="font-size: 11px; color: #666; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
      <a href="https://unsubscribe.example.com?prospect=${prospectData.email}&seq=${sequenceId}" style="color: #666;">Unsubscribe</a>
    </div>
  `;
  
  return html;
}

async function trackProspectBehavior(params: {
  prospectId: string;
  eventType: string;
  eventData: Record<string, any>;
  source: string;
}): Promise<void> {
  try {
    const score = calculateBehaviorScore(params.eventType, params.eventData);
    
    await db.exec`
      INSERT INTO prospect_behaviors (prospect_id, event_type, event_data, source, score)
      VALUES (${params.prospectId}, ${params.eventType}, ${JSON.stringify(params.eventData)}, ${params.source}, ${score})
    `;

    // Update engagement patterns asynchronously
    updateEngagementPattern(params.prospectId);
  } catch (error) {
    console.error('Failed to track prospect behavior:', error);
  }
}

function calculateBehaviorScore(eventType: string, eventData: Record<string, any>): number {
  const scoreMap: Record<string, number> = {
    'email_sent': 0,
    'email_open': 5,
    'email_click': 15,
    'email_reply': 50,
    'email_unsubscribe': -20
  };

  return scoreMap[eventType] || 0;
}

async function updateEngagementPattern(prospectId: string): Promise<void> {
  // This would update the engagement pattern based on new behavior
  // Implementation similar to behavior_tracking.ts
}

async function checkBehaviorTriggers(prospectId: string, eventType: string, eventData: Record<string, any>): Promise<void> {
  try {
    // Get active behavior triggers
    const triggers = await db.exec`
      SELECT * FROM behavior_triggers 
      WHERE event_type = ${eventType} AND is_active = true
    `;

    for (const trigger of triggers.rows) {
      // Check if conditions are met
      const conditionsMet = evaluateTriggerConditions(trigger.conditions, eventData);
      
      if (conditionsMet) {
        // Execute trigger actions
        await executeTriggerActions(prospectId, trigger.actions);
      }
    }
  } catch (error) {
    console.error('Failed to check behavior triggers:', error);
  }
}

function evaluateTriggerConditions(conditions: any, eventData: Record<string, any>): boolean {
  // Simplified condition evaluation
  return true; // In real implementation, would evaluate complex conditions
}

async function executeTriggerActions(prospectId: string, actions: any[]): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'enroll_sequence':
        // Enroll in another sequence
        break;
      case 'send_email':
        // Send immediate email
        break;
      case 'create_task':
        // Create task for sales team
        break;
      case 'update_score':
        // Update prospect score
        break;
      case 'notify_sales':
        await notifySalesTeam({
          prospectId,
          event: 'behavior_trigger',
          data: action.parameters
        });
        break;
    }
  }
}

async function pauseNurturingSequenceForProspect(
  prospectId: string, 
  enrollmentId: string, 
  reason: string
): Promise<void> {
  await db.exec`
    UPDATE nurturing_enrollments 
    SET status = 'paused', 
        metadata = metadata || ${JSON.stringify({ pauseReason: reason })},
        updated_at = NOW()
    WHERE id = ${enrollmentId}
  `;
}

async function notifySalesTeam(params: {
  prospectId: string;
  event: string;
  data: Record<string, any>;
}): Promise<void> {
  // This would integrate with the notification system
  console.log('Sales team notification:', params);
}