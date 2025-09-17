import { api } from "encore.dev/api";
import { db } from "./db";
import { ProspectBehavior, CreateBehaviorRequest, EngagementPattern } from "./types";

export const trackBehavior = api(
  { method: "POST", path: "/behaviors", expose: true },
  async (req: CreateBehaviorRequest): Promise<ProspectBehavior> => {
    const score = calculateBehaviorScore(req.eventType, req.eventData);
    
    const behavior = await db.queryRow`
      INSERT INTO prospect_behaviors (prospect_id, event_type, event_data, ip_address, user_agent, source, score)
      VALUES (${req.prospectId}, ${req.eventType}, ${JSON.stringify(req.eventData)}, ${req.ipAddress}, ${req.userAgent}, ${req.source}, ${score})
      RETURNING id, prospect_id, event_type, event_data, timestamp, ip_address, user_agent, source, score
    `;
    
    // Update engagement patterns asynchronously
    updateEngagementPattern(req.prospectId);
    
    return {
      id: behavior.id,
      prospectId: behavior.prospect_id,
      eventType: behavior.event_type,
      eventData: behavior.event_data,
      timestamp: behavior.timestamp,
      ipAddress: behavior.ip_address,
      userAgent: behavior.user_agent,
      source: behavior.source,
      score: behavior.score
    };
  }
);

export const getProspectBehaviors = api(
  { method: "GET", path: "/prospects/:prospectId/behaviors", expose: true },
  async ({ prospectId }: { prospectId: string }) => {
    const result = await db.exec`
      SELECT id, prospect_id, event_type, event_data, timestamp, ip_address, user_agent, source, score
      FROM prospect_behaviors
      WHERE prospect_id = ${prospectId}
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    return result.rows.map(row => ({
      id: row.id,
      prospectId: row.prospect_id,
      eventType: row.event_type,
      eventData: row.event_data,
      timestamp: row.timestamp,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      source: row.source,
      score: row.score
    }));
  }
);

export const getEngagementPattern = api(
  { method: "GET", path: "/prospects/:prospectId/engagement-pattern", expose: true },
  async ({ prospectId }: { prospectId: string }) => {
    const row = await db.queryRow`
      SELECT prospect_id, total_engagements, avg_time_between_engagements, 
             preferred_contact_times, preferred_channels, response_rate, 
             last_engagement, engagement_trend, peak_engagement_days
      FROM engagement_patterns
      WHERE prospect_id = ${prospectId}
    `;

    if (!row) {
      return null;
    }
    return {
      prospectId: row.prospect_id,
      totalEngagements: row.total_engagements,
      avgTimeBetweenEngagements: row.avg_time_between_engagements,
      preferredContactTimes: row.preferred_contact_times,
      preferredChannels: row.preferred_channels,
      responseRate: parseFloat(row.response_rate),
      lastEngagement: row.last_engagement,
      engagementTrend: row.engagement_trend,
      peakEngagementDays: row.peak_engagement_days
    };
  }
);

function calculateBehaviorScore(eventType: string, eventData: Record<string, any>): number {
  const scoreMap: Record<string, number> = {
    'email_open': 5,
    'email_click': 15,
    'website_visit': 10,
    'form_submit': 25,
    'download': 20,
    'meeting_scheduled': 50,
    'meeting_attended': 75,
    'meeting_no_show': -10
  };

  let baseScore = scoreMap[eventType] || 0;
  
  // Apply modifiers based on event data
  if (eventData.duration && eventData.duration > 300) {
    baseScore *= 1.5; // Longer engagement
  }
  
  if (eventData.pages && eventData.pages > 3) {
    baseScore *= 1.3; // Multiple page views
  }
  
  if (eventData.source === 'direct') {
    baseScore *= 1.2; // Direct traffic shows intent
  }

  return Math.round(baseScore);
}

async function updateEngagementPattern(prospectId: string): Promise<void> {
  try {
    const behaviors = await db.exec`
      SELECT event_type, timestamp, event_data
      FROM prospect_behaviors
      WHERE prospect_id = ${prospectId}
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    if (behaviors.rows.length === 0) return;

    const totalEngagements = behaviors.rows.length;
    const lastEngagement = behaviors.rows[0].timestamp;
    
    // Calculate average time between engagements
    let totalTimeDiff = 0;
    for (let i = 1; i < behaviors.rows.length; i++) {
      const diff = new Date(behaviors.rows[i-1].timestamp).getTime() - new Date(behaviors.rows[i].timestamp).getTime();
      totalTimeDiff += diff;
    }
    const avgTimeBetweenEngagements = behaviors.rows.length > 1 
      ? Math.round(totalTimeDiff / (behaviors.rows.length - 1) / 1000) + ' seconds'
      : null;

    // Analyze preferred contact times
    const hourCounts: Record<number, number> = {};
    behaviors.rows.forEach(row => {
      const hour = new Date(row.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const preferredContactTimes = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    // Analyze preferred channels
    const channelCounts: Record<string, number> = {};
    behaviors.rows.forEach(row => {
      const source = row.event_data?.source || 'unknown';
      channelCounts[source] = (channelCounts[source] || 0) + 1;
    });
    
    const preferredChannels = Object.entries(channelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([channel]) => channel);

    // Calculate response rate (simplified)
    const responseEvents = behaviors.rows.filter(row => 
      ['form_submit', 'meeting_scheduled', 'email_click'].includes(row.event_type)
    ).length;
    const responseRate = totalEngagements > 0 ? responseEvents / totalEngagements : 0;

    // Determine engagement trend
    const recentEngagements = behaviors.rows.slice(0, 10).length;
    const olderEngagements = behaviors.rows.slice(10, 20).length;
    let engagementTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    
    if (recentEngagements > olderEngagements * 1.2) {
      engagementTrend = 'increasing';
    } else if (recentEngagements < olderEngagements * 0.8) {
      engagementTrend = 'decreasing';
    }

    // Analyze peak engagement days
    const dayCounts: Record<number, number> = {};
    behaviors.rows.forEach(row => {
      const day = new Date(row.timestamp).getDay();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    
    const peakEngagementDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => parseInt(day));

    // Upsert engagement pattern
    await db.exec`
      INSERT INTO engagement_patterns (
        prospect_id, total_engagements, avg_time_between_engagements,
        preferred_contact_times, preferred_channels, response_rate,
        last_engagement, engagement_trend, peak_engagement_days, updated_at
      ) VALUES (
        ${prospectId}, ${totalEngagements}, ${avgTimeBetweenEngagements},
        ${JSON.stringify(preferredContactTimes)}, ${JSON.stringify(preferredChannels)}, ${responseRate},
        ${lastEngagement}, ${engagementTrend}, ${JSON.stringify(peakEngagementDays)}, NOW()
      )
      ON CONFLICT (prospect_id) DO UPDATE SET
        total_engagements = EXCLUDED.total_engagements,
        avg_time_between_engagements = EXCLUDED.avg_time_between_engagements,
        preferred_contact_times = EXCLUDED.preferred_contact_times,
        preferred_channels = EXCLUDED.preferred_channels,
        response_rate = EXCLUDED.response_rate,
        last_engagement = EXCLUDED.last_engagement,
        engagement_trend = EXCLUDED.engagement_trend,
        peak_engagement_days = EXCLUDED.peak_engagement_days,
        updated_at = NOW()
    `;
  } catch (error) {
    console.error('Error updating engagement pattern:', error);
  }
}