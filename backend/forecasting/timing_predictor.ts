import { api } from "encore.dev/api";
import { db } from "./db";
import { OutreachTiming } from "./types";

export interface PredictOptimalTimingRequest {
  prospectId: string;
  channels?: ('email' | 'call' | 'linkedin' | 'social')[];
  timeWindow?: {
    startHour: number;
    endHour: number;
  };
  daysAhead?: number;
}

export interface OptimalTimingResponse {
  recommendations: OutreachTiming[];
  engagementPatterns: EngagementPattern[];
  bestTimeSlots: TimeSlot[];
  channelEffectiveness: ChannelStats[];
}

export interface EngagementPattern {
  dayOfWeek: number;
  hour: number;
  channel: string;
  engagementRate: number;
  sampleSize: number;
  confidence: number;
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  probability: number;
  channel: string;
  reasoning: string[];
}

export interface ChannelStats {
  channel: string;
  avgResponseRate: number;
  bestHours: number[];
  bestDays: number[];
  avgResponseTime: number;
}

export interface BulkTimingRequest {
  prospectIds: string[];
  channels: ('email' | 'call' | 'linkedin' | 'social')[];
  priority?: 'high' | 'medium' | 'low';
}

export interface BulkTimingResponse {
  recommendations: OutreachTiming[];
  optimizedSchedule: ScheduleBlock[];
  channelDistribution: Record<string, number>;
}

export interface ScheduleBlock {
  timeSlot: Date;
  prospects: string[];
  channel: string;
  expectedEngagement: number;
}

export const predictOptimalTiming = api(
  { method: "POST", path: "/forecasting/timing/predict", expose: true },
  async (req: PredictOptimalTimingRequest): Promise<OptimalTimingResponse> => {
    const prospect = await getProspectDetails(req.prospectId);
    const engagementPatterns = await analyzeEngagementPatterns(req.prospectId, req.channels);
    const channelEffectiveness = await analyzeChannelEffectiveness(prospect);
    
    const recommendations: OutreachTiming[] = [];
    const channels = req.channels || ['email', 'call', 'linkedin', 'social'];
    const daysAhead = req.daysAhead || 7;

    for (const channel of channels) {
      const timing = await generateOptimalTiming(prospect, channel, engagementPatterns, daysAhead, req.timeWindow);
      if (timing) {
        await saveTimingRecommendation(timing);
        recommendations.push(timing);
      }
    }

    const bestTimeSlots = generateBestTimeSlots(engagementPatterns, daysAhead);

    return {
      recommendations,
      engagementPatterns,
      bestTimeSlots,
      channelEffectiveness
    };
  }
);

export const bulkPredictTiming = api(
  { method: "POST", path: "/forecasting/timing/bulk-predict", expose: true },
  async (req: BulkTimingRequest): Promise<BulkTimingResponse> => {
    const recommendations: OutreachTiming[] = [];
    const scheduleBlocks: ScheduleBlock[] = [];
    const channelDistribution: Record<string, number> = {};

    for (const channel of req.channels) {
      channelDistribution[channel] = 0;
    }

    const prospects = await getProspectsDetails(req.prospectIds);
    const globalPatterns = await getGlobalEngagementPatterns();

    for (const prospect of prospects) {
      const prospectPatterns = await analyzeEngagementPatterns(prospect.id, req.channels);
      
      for (const channel of req.channels) {
        const timing = await generateOptimalTiming(prospect, channel, prospectPatterns, 7);
        if (timing) {
          recommendations.push(timing);
          channelDistribution[channel]++;
        }
      }
    }

    const optimizedSchedule = optimizeSchedule(recommendations, globalPatterns);

    return {
      recommendations,
      optimizedSchedule,
      channelDistribution
    };
  }
);

export const getTimingAnalytics = api(
  { method: "GET", path: "/forecasting/timing/analytics", expose: true },
  async (): Promise<{
    globalPatterns: EngagementPattern[];
    channelPerformance: ChannelStats[];
    timeZoneAnalysis: TimeZoneStats[];
    recentRecommendations: OutreachTiming[];
  }> => {
    const globalPatterns = await getGlobalEngagementPatterns();
    const channelPerformance = await getChannelPerformanceStats();
    const timeZoneAnalysis = await analyzeTimeZonePerformance();
    const recentRecommendations = await getRecentTimingRecommendations();

    return {
      globalPatterns,
      channelPerformance,
      timeZoneAnalysis,
      recentRecommendations
    };
  }
);

export const updateEngagementFeedback = api(
  { method: "POST", path: "/forecasting/timing/feedback", expose: true },
  async (req: {
    timingId: string;
    actualEngagement: boolean;
    responseTime?: number;
    channelUsed: string;
  }): Promise<{ success: boolean; updatedAccuracy: number }> => {
    await db.exec`
      INSERT INTO timing_feedback (timing_id, actual_engagement, response_time, channel_used, created_at)
      VALUES (${req.timingId}, ${req.actualEngagement}, ${req.responseTime}, ${req.channelUsed}, NOW())
    `;

    const accuracy = await calculateTimingAccuracy();
    
    return {
      success: true,
      updatedAccuracy: accuracy
    };
  }
);

interface TimeZoneStats {
  timezone: string;
  optimalHours: number[];
  engagementRate: number;
  sampleSize: number;
}

async function getProspectDetails(prospectId: string): Promise<any> {
  const rows = await db.exec`
    SELECT p.*, 
           COALESCE(p.timezone, 'UTC') as timezone,
           EXTRACT(EPOCH FROM (NOW() - p.last_contact)) / 86400 as days_since_contact
    FROM prospects p
    WHERE p.id = ${prospectId}
  `;

  if (rows.length === 0) {
    throw new Error(`Prospect ${prospectId} not found`);
  }

  return rows[0];
}

async function getProspectsDetails(prospectIds: string[]): Promise<any[]> {
  const placeholders = prospectIds.map((_, i) => `$${i + 1}`).join(',');
  const query = `
    SELECT p.*, 
           COALESCE(p.timezone, 'UTC') as timezone,
           EXTRACT(EPOCH FROM (NOW() - p.last_contact)) / 86400 as days_since_contact
    FROM prospects p
    WHERE p.id IN (${placeholders})
  `;

  return await db.exec(query, ...prospectIds);
}

async function analyzeEngagementPatterns(prospectId: string, channels?: string[]): Promise<EngagementPattern[]> {
  const channelFilter = channels ? `AND a.channel = ANY($2)` : '';
  const params = channels ? [prospectId, channels] : [prospectId];

  const rows = await db.exec(`
    SELECT 
      EXTRACT(DOW FROM a.created_at) as day_of_week,
      EXTRACT(HOUR FROM a.created_at) as hour,
      a.channel,
      COUNT(*) as total_outreach,
      COUNT(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered', 'meeting_scheduled') THEN 1 END) as engagements,
      AVG(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered', 'meeting_scheduled') THEN 1 ELSE 0 END) as engagement_rate
    FROM activities a
    WHERE a.prospect_id = $1 ${channelFilter}
      AND a.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM a.created_at), EXTRACT(HOUR FROM a.created_at), a.channel
    HAVING COUNT(*) >= 3
    ORDER BY engagement_rate DESC
  `, ...params);

  return rows.map(row => ({
    dayOfWeek: parseInt(row.day_of_week),
    hour: parseInt(row.hour),
    channel: row.channel,
    engagementRate: parseFloat(row.engagement_rate),
    sampleSize: parseInt(row.total_outreach),
    confidence: Math.min(parseInt(row.total_outreach) / 10, 1)
  }));
}

async function analyzeChannelEffectiveness(prospect: any): Promise<ChannelStats[]> {
  const rows = await db.exec`
    SELECT 
      a.channel,
      AVG(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered', 'meeting_scheduled') THEN 1 ELSE 0 END) as avg_response_rate,
      ARRAY_AGG(DISTINCT EXTRACT(HOUR FROM a.created_at) ORDER BY EXTRACT(HOUR FROM a.created_at)) as hours,
      ARRAY_AGG(DISTINCT EXTRACT(DOW FROM a.created_at) ORDER BY EXTRACT(DOW FROM a.created_at)) as days,
      AVG(EXTRACT(EPOCH FROM (a.response_time - a.created_at)) / 3600) as avg_response_time_hours
    FROM activities a
    WHERE a.prospect_id = ${prospect.id}
      AND a.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY a.channel
  `;

  return rows.map(row => {
    const engagedHours = row.hours ? JSON.parse(row.hours).slice(0, 3) : [];
    const engagedDays = row.days ? JSON.parse(row.days) : [];

    return {
      channel: row.channel,
      avgResponseRate: parseFloat(row.avg_response_rate) || 0,
      bestHours: engagedHours,
      bestDays: engagedDays,
      avgResponseTime: parseFloat(row.avg_response_time_hours) || 0
    };
  });
}

async function generateOptimalTiming(
  prospect: any, 
  channel: string, 
  patterns: EngagementPattern[],
  daysAhead: number = 7,
  timeWindow?: { startHour: number; endHour: number }
): Promise<OutreachTiming | null> {
  const channelPatterns = patterns.filter(p => p.channel === channel);
  const globalPatterns = await getGlobalChannelPatterns(channel);
  
  if (channelPatterns.length === 0 && globalPatterns.length === 0) {
    return null;
  }

  const primaryPatterns = channelPatterns.length > 0 ? channelPatterns : globalPatterns;
  const bestPattern = primaryPatterns.reduce((best, current) => 
    current.engagementRate > best.engagementRate ? current : best
  );

  const recommendedTime = calculateOptimalTime(
    bestPattern, 
    prospect.timezone, 
    daysAhead,
    timeWindow
  );

  const probability = calculateTimingProbability(bestPattern, prospect);
  const reasoning = generateTimingReasoning(bestPattern, prospect, channelPatterns.length > 0);

  return {
    id: crypto.randomUUID(),
    prospectId: prospect.id,
    recommendedTime,
    channel: channel as any,
    probability,
    reasoning,
    timeZone: prospect.timezone,
    createdAt: new Date()
  };
}

function calculateOptimalTime(
  pattern: EngagementPattern, 
  timezone: string, 
  daysAhead: number,
  timeWindow?: { startHour: number; endHour: number }
): Date {
  const now = new Date();
  const targetDate = new Date(now);
  
  let dayOffset = 0;
  for (let i = 1; i <= daysAhead; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + i);
    
    if (checkDate.getDay() === pattern.dayOfWeek) {
      dayOffset = i;
      break;
    }
  }
  
  if (dayOffset === 0) {
    dayOffset = 1;
  }

  targetDate.setDate(targetDate.getDate() + dayOffset);
  
  let targetHour = pattern.hour;
  if (timeWindow) {
    targetHour = Math.max(timeWindow.startHour, Math.min(targetHour, timeWindow.endHour));
  }
  
  targetDate.setHours(targetHour, 0, 0, 0);

  return targetDate;
}

function calculateTimingProbability(pattern: EngagementPattern, prospect: any): number {
  let baseProbability = pattern.engagementRate;
  
  const confidenceAdjustment = pattern.confidence * 0.2;
  baseProbability += confidenceAdjustment;
  
  const daysSinceContact = parseFloat(prospect.days_since_contact) || 0;
  if (daysSinceContact > 14) {
    baseProbability += 0.1;
  } else if (daysSinceContact < 3) {
    baseProbability -= 0.1;
  }
  
  const prospectEngagement = parseFloat(prospect.engagement_score) || 0.5;
  baseProbability = (baseProbability + prospectEngagement) / 2;
  
  return Math.min(Math.max(baseProbability, 0), 1);
}

function generateTimingReasoning(
  pattern: EngagementPattern, 
  prospect: any, 
  hasPersonalData: boolean
): string[] {
  const reasoning: string[] = [];
  
  if (hasPersonalData) {
    reasoning.push(`Based on ${prospect.first_name || 'this prospect'}'s historical engagement patterns`);
  } else {
    reasoning.push("Based on global engagement patterns for similar prospects");
  }
  
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][pattern.dayOfWeek];
  reasoning.push(`${dayName}s at ${pattern.hour}:00 show ${(pattern.engagementRate * 100).toFixed(1)}% engagement rate`);
  
  if (pattern.confidence > 0.7) {
    reasoning.push(`High confidence recommendation (${pattern.sampleSize} data points)`);
  } else if (pattern.confidence < 0.4) {
    reasoning.push(`Limited data available - recommendation based on general patterns`);
  }
  
  const daysSinceContact = parseFloat(prospect.days_since_contact) || 0;
  if (daysSinceContact > 14) {
    reasoning.push("Extended time since last contact increases likelihood of engagement");
  } else if (daysSinceContact < 3) {
    reasoning.push("Recent contact - may want to allow more time before follow-up");
  }
  
  return reasoning;
}

async function getGlobalEngagementPatterns(): Promise<EngagementPattern[]> {
  const rows = await db.exec`
    SELECT 
      EXTRACT(DOW FROM a.created_at) as day_of_week,
      EXTRACT(HOUR FROM a.created_at) as hour,
      a.channel,
      COUNT(*) as total_outreach,
      AVG(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered', 'meeting_scheduled') THEN 1 ELSE 0 END) as engagement_rate
    FROM activities a
    WHERE a.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM a.created_at), EXTRACT(HOUR FROM a.created_at), a.channel
    HAVING COUNT(*) >= 10
    ORDER BY engagement_rate DESC
  `;

  return rows.map(row => ({
    dayOfWeek: parseInt(row.day_of_week),
    hour: parseInt(row.hour),
    channel: row.channel,
    engagementRate: parseFloat(row.engagement_rate),
    sampleSize: parseInt(row.total_outreach),
    confidence: Math.min(parseInt(row.total_outreach) / 50, 1)
  }));
}

async function getGlobalChannelPatterns(channel: string): Promise<EngagementPattern[]> {
  const rows = await db.exec`
    SELECT 
      EXTRACT(DOW FROM a.created_at) as day_of_week,
      EXTRACT(HOUR FROM a.created_at) as hour,
      a.channel,
      COUNT(*) as total_outreach,
      AVG(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered', 'meeting_scheduled') THEN 1 ELSE 0 END) as engagement_rate
    FROM activities a
    WHERE a.channel = ${channel}
      AND a.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM a.created_at), EXTRACT(HOUR FROM a.created_at), a.channel
    HAVING COUNT(*) >= 5
    ORDER BY engagement_rate DESC
  `;

  return rows.map(row => ({
    dayOfWeek: parseInt(row.day_of_week),
    hour: parseInt(row.hour),
    channel: row.channel,
    engagementRate: parseFloat(row.engagement_rate),
    sampleSize: parseInt(row.total_outreach),
    confidence: Math.min(parseInt(row.total_outreach) / 20, 1)
  }));
}

function generateBestTimeSlots(patterns: EngagementPattern[], daysAhead: number): TimeSlot[] {
  const timeSlots: TimeSlot[] = [];
  const now = new Date();
  
  const topPatterns = patterns
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 5);

  for (const pattern of topPatterns) {
    for (let day = 1; day <= daysAhead; day++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + day);
      
      if (targetDate.getDay() === pattern.dayOfWeek) {
        const startTime = new Date(targetDate);
        startTime.setHours(pattern.hour, 0, 0, 0);
        
        const endTime = new Date(startTime);
        endTime.setHours(pattern.hour + 1, 0, 0, 0);
        
        timeSlots.push({
          startTime,
          endTime,
          probability: pattern.engagementRate,
          channel: pattern.channel,
          reasoning: [
            `${(pattern.engagementRate * 100).toFixed(1)}% engagement rate`,
            `Based on ${pattern.sampleSize} interactions`
          ]
        });
      }
    }
  }

  return timeSlots.sort((a, b) => b.probability - a.probability);
}

async function getChannelPerformanceStats(): Promise<ChannelStats[]> {
  const rows = await db.exec`
    SELECT 
      a.channel,
      AVG(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered', 'meeting_scheduled') THEN 1 ELSE 0 END) as avg_response_rate,
      mode() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM a.created_at)) as best_hour,
      mode() WITHIN GROUP (ORDER BY EXTRACT(DOW FROM a.created_at)) as best_day,
      AVG(EXTRACT(EPOCH FROM (a.response_time - a.created_at)) / 3600) as avg_response_time_hours
    FROM activities a
    WHERE a.created_at >= NOW() - INTERVAL '90 days'
      AND a.response_time IS NOT NULL
    GROUP BY a.channel
  `;

  return rows.map(row => ({
    channel: row.channel,
    avgResponseRate: parseFloat(row.avg_response_rate) || 0,
    bestHours: [parseInt(row.best_hour) || 10],
    bestDays: [parseInt(row.best_day) || 2],
    avgResponseTime: parseFloat(row.avg_response_time_hours) || 0
  }));
}

async function analyzeTimeZonePerformance(): Promise<TimeZoneStats[]> {
  const rows = await db.exec`
    SELECT 
      COALESCE(p.timezone, 'UTC') as timezone,
      EXTRACT(HOUR FROM a.created_at AT TIME ZONE COALESCE(p.timezone, 'UTC')) as local_hour,
      COUNT(*) as total_outreach,
      AVG(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered', 'meeting_scheduled') THEN 1 ELSE 0 END) as engagement_rate
    FROM activities a
    JOIN prospects p ON a.prospect_id = p.id
    WHERE a.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY COALESCE(p.timezone, 'UTC'), EXTRACT(HOUR FROM a.created_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))
    HAVING COUNT(*) >= 5
  `;

  const timezoneStats: Record<string, TimeZoneStats> = {};

  for (const row of rows) {
    const tz = row.timezone;
    if (!timezoneStats[tz]) {
      timezoneStats[tz] = {
        timezone: tz,
        optimalHours: [],
        engagementRate: 0,
        sampleSize: 0
      };
    }

    const stats = timezoneStats[tz];
    const hour = parseInt(row.local_hour);
    const rate = parseFloat(row.engagement_rate);
    const count = parseInt(row.total_outreach);

    if (rate > 0.3) {
      stats.optimalHours.push(hour);
    }

    stats.engagementRate = (stats.engagementRate * stats.sampleSize + rate * count) / (stats.sampleSize + count);
    stats.sampleSize += count;
  }

  return Object.values(timezoneStats);
}

async function getRecentTimingRecommendations(): Promise<OutreachTiming[]> {
  const rows = await db.exec`
    SELECT * FROM outreach_timing 
    ORDER BY created_at DESC 
    LIMIT 20
  `;

  return rows.map(row => ({
    id: row.id,
    prospectId: row.prospect_id,
    recommendedTime: row.recommended_time,
    channel: row.channel,
    probability: parseFloat(row.probability),
    reasoning: JSON.parse(row.reasoning),
    timeZone: row.time_zone,
    createdAt: row.created_at
  }));
}

function optimizeSchedule(recommendations: OutreachTiming[], globalPatterns: EngagementPattern[]): ScheduleBlock[] {
  const scheduleMap: Map<string, ScheduleBlock> = new Map();

  for (const rec of recommendations) {
    const timeKey = `${rec.recommendedTime.toISOString().slice(0, 13)}:00:00.000Z`;
    
    if (!scheduleMap.has(timeKey)) {
      scheduleMap.set(timeKey, {
        timeSlot: new Date(timeKey),
        prospects: [],
        channel: rec.channel,
        expectedEngagement: 0
      });
    }

    const block = scheduleMap.get(timeKey)!;
    block.prospects.push(rec.prospectId);
    block.expectedEngagement = (block.expectedEngagement * (block.prospects.length - 1) + rec.probability) / block.prospects.length;
  }

  return Array.from(scheduleMap.values())
    .sort((a, b) => b.expectedEngagement - a.expectedEngagement)
    .slice(0, 20);
}

async function saveTimingRecommendation(timing: OutreachTiming): Promise<void> {
  await db.exec`
    INSERT INTO outreach_timing (id, prospect_id, recommended_time, channel, probability, reasoning, time_zone)
    VALUES (${timing.id}, ${timing.prospectId}, ${timing.recommendedTime}, ${timing.channel},
            ${timing.probability}, ${JSON.stringify(timing.reasoning)}, ${timing.timeZone})
  `;
}

async function calculateTimingAccuracy(): Promise<number> {
  const rows = await db.exec`
    SELECT 
      COUNT(*) as total_recommendations,
      COUNT(CASE WHEN tf.actual_engagement = true THEN 1 END) as successful_recommendations
    FROM outreach_timing ot
    LEFT JOIN timing_feedback tf ON ot.id = tf.timing_id
    WHERE ot.created_at >= NOW() - INTERVAL '30 days'
      AND tf.id IS NOT NULL
  `;

  if (rows.length === 0 || parseInt(rows[0].total_recommendations) === 0) {
    return 0.5;
  }

  return parseInt(rows[0].successful_recommendations) / parseInt(rows[0].total_recommendations);
}