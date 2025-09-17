import { api } from "encore.dev/api";
import { Topic } from "encore.dev/pubsub";
import { Subscription } from "encore.dev/pubsub";
import { db } from "./db";

// Define real-time notification topics
export const nurturingEvents = new Topic<NurturingEvent>("nurturing-events", {
  deliveryGuarantee: "at-least-once",
});

export const prospectEngagementEvents = new Topic<ProspectEngagementEvent>("prospect-engagement", {
  deliveryGuarantee: "at-least-once",
});

export const sequencePerformanceEvents = new Topic<SequencePerformanceEvent>("sequence-performance", {
  deliveryGuarantee: "at-least-once",
});

interface NurturingEvent {
  type: 'enrollment_created' | 'enrollment_completed' | 'enrollment_paused' | 'step_executed' | 'sequence_optimized';
  prospectId: string;
  sequenceId: string;
  enrollmentId?: string;
  stepNumber?: number;
  data: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

interface ProspectEngagementEvent {
  type: 'email_opened' | 'email_clicked' | 'email_replied' | 'classification_changed' | 'behavior_tracked';
  prospectId: string;
  sequenceId?: string;
  enrollmentId?: string;
  eventData: Record<string, any>;
  score?: number;
  classification?: string;
  timestamp: Date;
}

interface SequencePerformanceEvent {
  type: 'performance_alert' | 'optimization_recommendation' | 'milestone_reached';
  sequenceId: string;
  metricType: string;
  currentValue: number;
  previousValue?: number;
  threshold?: number;
  message: string;
  timestamp: Date;
}

// Real-time notification APIs
export const subscribeToNurturingEvents = api(
  { method: "POST", path: "/notifications/subscribe", expose: true },
  async ({ userId, eventTypes }: { userId: string; eventTypes: string[] }): Promise<{ success: boolean; subscriptionId: string }> => {
    const subscriptionId = `user_${userId}_${Date.now()}`;
    
    // Store subscription preferences
    await db.exec`
      INSERT INTO user_subscriptions (user_id, subscription_id, event_types, is_active)
      VALUES (${userId}, ${subscriptionId}, ${JSON.stringify(eventTypes)}, true)
      ON CONFLICT (user_id) DO UPDATE SET
        subscription_id = EXCLUDED.subscription_id,
        event_types = EXCLUDED.event_types,
        is_active = true,
        updated_at = NOW()
    `;

    return { success: true, subscriptionId };
  }
);

export const unsubscribeFromNurturingEvents = api(
  { method: "DELETE", path: "/notifications/unsubscribe", expose: true },
  async ({ userId }: { userId: string }): Promise<{ success: boolean }> => {
    await db.exec`
      UPDATE user_subscriptions 
      SET is_active = false, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    return { success: true };
  }
);

export const getRecentNurturingEvents = api(
  { method: "GET", path: "/notifications/recent", expose: true },
  async ({ 
    userId, 
    limit = 50, 
    offset = 0,
    eventTypes 
  }: { 
    userId: string; 
    limit?: number; 
    offset?: number;
    eventTypes?: string[];
  }): Promise<{
    events: Array<{
      id: string;
      type: string;
      message: string;
      data: Record<string, any>;
      isRead: boolean;
      createdAt: Date;
    }>;
    total: number;
    unreadCount: number;
  }> => {
    let query = `
      SELECT n.id, n.event_type, n.message, n.data, n.is_read, n.created_at
      FROM notifications n
      WHERE n.user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 1;

    if (eventTypes && eventTypes.length > 0) {
      query += ` AND n.event_type = ANY($${++paramIndex})`;
      params.push(eventTypes);
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;
    params.push(limit, offset);

    const events = await db.exec(query, ...params);

    // Get total count
    const totalResult = await db.exec`
      SELECT COUNT(*) as total, COUNT(CASE WHEN NOT is_read THEN 1 END) as unread
      FROM notifications
      WHERE user_id = ${userId}
    `;

    return {
      events: events.rows.map(row => ({
        id: row.id,
        type: row.event_type,
        message: row.message,
        data: row.data,
        isRead: row.is_read,
        createdAt: row.created_at
      })),
      total: parseInt(totalResult.rows[0].total),
      unreadCount: parseInt(totalResult.rows[0].unread)
    };
  }
);

export const markNotificationAsRead = api(
  { method: "PUT", path: "/notifications/:notificationId/read", expose: true },
  async ({ notificationId, userId }: { notificationId: string; userId: string }): Promise<{ success: boolean }> => {
    await db.exec`
      UPDATE notifications 
      SET is_read = true, updated_at = NOW()
      WHERE id = ${notificationId} AND user_id = ${userId}
    `;

    return { success: true };
  }
);

export const markAllNotificationsAsRead = api(
  { method: "PUT", path: "/notifications/read-all", expose: true },
  async ({ userId }: { userId: string }): Promise<{ success: boolean }> => {
    await db.exec`
      UPDATE notifications 
      SET is_read = true, updated_at = NOW()
      WHERE user_id = ${userId} AND NOT is_read
    `;

    return { success: true };
  }
);

// Event publishing functions
export async function publishNurturingEvent(event: NurturingEvent): Promise<void> {
  await nurturingEvents.publish(event);
  
  // Also store in database for persistent notifications
  await storeNotification({
    eventType: event.type,
    prospectId: event.prospectId,
    sequenceId: event.sequenceId,
    data: event.data,
    timestamp: event.timestamp
  });
}

export async function publishProspectEngagementEvent(event: ProspectEngagementEvent): Promise<void> {
  await prospectEngagementEvents.publish(event);
  
  // Store high-value engagement events as notifications
  if (['email_replied', 'classification_changed'].includes(event.type)) {
    await storeNotification({
      eventType: event.type,
      prospectId: event.prospectId,
      sequenceId: event.sequenceId,
      data: event.eventData,
      timestamp: event.timestamp
    });
  }
}

export async function publishSequencePerformanceEvent(event: SequencePerformanceEvent): Promise<void> {
  await sequencePerformanceEvents.publish(event);
  
  // Store performance alerts as notifications
  await storeNotification({
    eventType: event.type,
    sequenceId: event.sequenceId,
    data: {
      metricType: event.metricType,
      currentValue: event.currentValue,
      previousValue: event.previousValue,
      threshold: event.threshold,
      message: event.message
    },
    timestamp: event.timestamp
  });
}

// Subscription handlers
export const _ = new Subscription(nurturingEvents, "nurturing-event-handler", {
  handler: async (event: NurturingEvent) => {
    try {
      await handleNurturingEvent(event);
    } catch (error) {
      console.error('Failed to handle nurturing event:', error);
    }
  },
});

export const __ = new Subscription(prospectEngagementEvents, "engagement-event-handler", {
  handler: async (event: ProspectEngagementEvent) => {
    try {
      await handleEngagementEvent(event);
    } catch (error) {
      console.error('Failed to handle engagement event:', error);
    }
  },
});

export const ___ = new Subscription(sequencePerformanceEvents, "performance-event-handler", {
  handler: async (event: SequencePerformanceEvent) => {
    try {
      await handlePerformanceEvent(event);
    } catch (error) {
      console.error('Failed to handle performance event:', error);
    }
  },
});

// Event handlers
async function handleNurturingEvent(event: NurturingEvent): Promise<void> {
  console.log('Handling nurturing event:', event.type);
  
  switch (event.type) {
    case 'enrollment_created':
      await notifyRelevantUsers('enrollment_created', {
        message: `New prospect enrolled in sequence`,
        prospectId: event.prospectId,
        sequenceId: event.sequenceId,
        data: event.data
      });
      break;
      
    case 'enrollment_completed':
      await notifyRelevantUsers('enrollment_completed', {
        message: `Prospect completed nurturing sequence`,
        prospectId: event.prospectId,
        sequenceId: event.sequenceId,
        data: event.data
      });
      break;
      
    case 'step_executed':
      // Only notify for important step executions
      if (event.stepNumber === 1 || event.data.isImportant) {
        await notifyRelevantUsers('step_executed', {
          message: `Nurturing step ${event.stepNumber} executed`,
          prospectId: event.prospectId,
          sequenceId: event.sequenceId,
          data: event.data
        });
      }
      break;
  }
}

async function handleEngagementEvent(event: ProspectEngagementEvent): Promise<void> {
  console.log('Handling engagement event:', event.type);
  
  switch (event.type) {
    case 'email_replied':
      await notifyRelevantUsers('high_engagement', {
        message: `Prospect replied to nurturing email`,
        prospectId: event.prospectId,
        sequenceId: event.sequenceId,
        data: event.eventData,
        priority: 'high'
      });
      break;
      
    case 'classification_changed':
      if (event.classification === 'hot') {
        await notifyRelevantUsers('hot_prospect', {
          message: `Prospect classified as HOT`,
          prospectId: event.prospectId,
          data: event.eventData,
          priority: 'high'
        });
      }
      break;
      
    case 'email_clicked':
      // Track click patterns for behavior analysis
      await updateClickAnalytics(event.prospectId, event.eventData);
      break;
  }
}

async function handlePerformanceEvent(event: SequencePerformanceEvent): Promise<void> {
  console.log('Handling performance event:', event.type);
  
  switch (event.type) {
    case 'performance_alert':
      await notifyRelevantUsers('performance_alert', {
        message: event.message,
        sequenceId: event.sequenceId,
        data: {
          metricType: event.metricType,
          currentValue: event.currentValue,
          threshold: event.threshold
        },
        priority: 'medium'
      });
      break;
      
    case 'optimization_recommendation':
      await notifyRelevantUsers('optimization_available', {
        message: `New optimization recommendations available`,
        sequenceId: event.sequenceId,
        data: { message: event.message },
        priority: 'low'
      });
      break;
      
    case 'milestone_reached':
      await notifyRelevantUsers('milestone_reached', {
        message: event.message,
        sequenceId: event.sequenceId,
        data: {
          metricType: event.metricType,
          value: event.currentValue
        },
        priority: 'low'
      });
      break;
  }
}

// Helper functions
async function storeNotification(params: {
  eventType: string;
  prospectId?: string;
  sequenceId?: string;
  data: Record<string, any>;
  timestamp: Date;
}): Promise<void> {
  const message = generateNotificationMessage(params.eventType, params.data);
  
  // Get users who should receive this notification
  const users = await getRelevantUsers(params.eventType, params.sequenceId);
  
  for (const userId of users) {
    await db.exec`
      INSERT INTO notifications (user_id, event_type, message, data, prospect_id, sequence_id, is_read)
      VALUES (${userId}, ${params.eventType}, ${message}, ${JSON.stringify(params.data)}, 
              ${params.prospectId}, ${params.sequenceId}, false)
    `;
  }
}

function generateNotificationMessage(eventType: string, data: Record<string, any>): string {
  switch (eventType) {
    case 'enrollment_created':
      return `New prospect enrolled in nurturing sequence`;
    case 'enrollment_completed':
      return `Prospect completed nurturing sequence`;
    case 'email_replied':
      return `Prospect replied to nurturing email`;
    case 'classification_changed':
      return `Prospect classification updated to ${data.classification}`;
    case 'performance_alert':
      return `Sequence performance alert: ${data.message}`;
    case 'optimization_recommendation':
      return `New optimization recommendations available`;
    case 'milestone_reached':
      return `Sequence milestone reached: ${data.message}`;
    default:
      return `Nurturing event: ${eventType}`;
  }
}

async function getRelevantUsers(eventType: string, sequenceId?: string): Promise<string[]> {
  // Get users subscribed to this event type
  const result = await db.exec`
    SELECT DISTINCT user_id 
    FROM user_subscriptions 
    WHERE is_active = true 
    AND event_types @> ${JSON.stringify([eventType])}
  `;
  
  return result.rows.map(row => row.user_id);
}

async function notifyRelevantUsers(eventType: string, notification: {
  message: string;
  prospectId?: string;
  sequenceId?: string;
  data: Record<string, any>;
  priority?: string;
}): Promise<void> {
  const users = await getRelevantUsers(eventType, notification.sequenceId);
  
  for (const userId of users) {
    await db.exec`
      INSERT INTO notifications (user_id, event_type, message, data, prospect_id, sequence_id, priority, is_read)
      VALUES (${userId}, ${eventType}, ${notification.message}, ${JSON.stringify(notification.data)}, 
              ${notification.prospectId}, ${notification.sequenceId}, ${notification.priority || 'low'}, false)
    `;
  }
}

async function updateClickAnalytics(prospectId: string, eventData: Record<string, any>): Promise<void> {
  // Update click analytics for behavior patterns
  const url = eventData.url;
  if (url) {
    await db.exec`
      INSERT INTO click_analytics (prospect_id, url, clicked_at, source)
      VALUES (${prospectId}, ${url}, NOW(), 'nurturing_email')
    `;
  }
}

// Helper function to trigger events from other parts of the system
export async function triggerNurturingEvent(
  type: NurturingEvent['type'],
  data: Omit<NurturingEvent, 'type' | 'timestamp'>
): Promise<void> {
  await publishNurturingEvent({
    type,
    ...data,
    timestamp: new Date()
  });
}

export async function triggerEngagementEvent(
  type: ProspectEngagementEvent['type'],
  data: Omit<ProspectEngagementEvent, 'type' | 'timestamp'>
): Promise<void> {
  await publishProspectEngagementEvent({
    type,
    ...data,
    timestamp: new Date()
  });
}

export async function triggerPerformanceEvent(
  type: SequencePerformanceEvent['type'],
  data: Omit<SequencePerformanceEvent, 'type' | 'timestamp'>
): Promise<void> {
  await publishSequencePerformanceEvent({
    type,
    ...data,
    timestamp: new Date()
  });
}