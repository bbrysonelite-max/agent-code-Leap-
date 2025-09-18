import { api } from "encore.dev/api";
import { db } from "./db";
import * as ai from "../ai/openai";
import { ProspectBehavior, EngagementPattern, AIInsight } from "./types";

export interface AdvancedEngagementAnalysis {
  prospectId: string;
  behaviorSignals: BehaviorSignal[];
  engagementScore: number;
  intentLevel: 'low' | 'medium' | 'high' | 'urgent';
  nextBestAction: string;
  optimalTiming: OptimalTiming;
  contentPreferences: ContentPreference[];
  predictedChurn: ChurnPrediction;
  sequenceRecommendations: SequenceRecommendation[];
}

export interface BehaviorSignal {
  type: string;
  strength: number;
  recency: number;
  frequency: number;
  context: Record<string, any>;
  score: number;
}

export interface OptimalTiming {
  preferredDays: string[];
  preferredHours: number[];
  timezone: string;
  responseWindow: number; // Hours
  confidence: number;
}

export interface ContentPreference {
  type: string;
  engagement: number;
  conversion: number;
  topics: string[];
  format: string;
}

export interface ChurnPrediction {
  riskLevel: 'low' | 'medium' | 'high';
  probability: number;
  factors: string[];
  timeframe: number; // Days
}

export interface SequenceRecommendation {
  sequenceId: string;
  priority: number;
  reasoning: string;
  expectedOutcome: string;
  confidence: number;
}

export const analyzeAdvancedBehavior = api(
  { method: "POST", path: "/prospects/:prospectId/advanced-analysis", expose: true },
  async ({ prospectId }: { prospectId: string }): Promise<AdvancedEngagementAnalysis> => {
    // Get comprehensive prospect data
    const [behaviors, engagement, classification, recentActivities] = await Promise.all([
      getProspectBehaviors(prospectId),
      getEngagementPattern(prospectId),
      getProspectClassification(prospectId),
      getRecentActivities(prospectId, 30) // Last 30 days
    ]);

    // Analyze behavior signals
    const behaviorSignals = await analyzeBehaviorSignals(behaviors, recentActivities);
    
    // Calculate advanced engagement score
    const engagementScore = calculateAdvancedEngagementScore(behaviorSignals, engagement);
    
    // Determine intent level
    const intentLevel = determineIntentLevel(behaviorSignals, engagementScore, classification);
    
    // Predict optimal timing
    const optimalTiming = await predictOptimalTiming(prospectId, behaviors, engagement);
    
    // Analyze content preferences
    const contentPreferences = analyzeContentPreferences(behaviors, classification);
    
    // Predict churn risk
    const predictedChurn = predictChurnRisk(behaviors, engagement, classification);
    
    // Generate sequence recommendations
    const sequenceRecommendations = await generateSequenceRecommendations(
      prospectId, 
      behaviorSignals, 
      intentLevel, 
      classification
    );
    
    // Determine next best action
    const nextBestAction = determineNextBestAction(
      behaviorSignals, 
      intentLevel, 
      optimalTiming, 
      predictedChurn
    );

    // Store the analysis for future reference
    await storeAdvancedAnalysis(prospectId, {
      engagementScore,
      intentLevel,
      nextBestAction,
      optimalTiming,
      predictedChurn
    });

    return {
      prospectId,
      behaviorSignals,
      engagementScore,
      intentLevel,
      nextBestAction,
      optimalTiming,
      contentPreferences,
      predictedChurn,
      sequenceRecommendations
    };
  }
);

export const getBehaviorInsights = api(
  { method: "GET", path: "/prospects/:prospectId/behavior-insights", expose: true },
  async ({ prospectId }: { prospectId: string }) => {
    const insights = await db.queryAll`
      SELECT type, insight, confidence, data, created_at
      FROM ai_insights
      WHERE prospect_id = ${prospectId}
      AND type IN ('behavior_pattern', 'engagement_prediction', 'intent_signal', 'timing_optimization')
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return insights.map(row => ({
      type: row.type,
      insight: row.insight,
      confidence: parseFloat(row.confidence),
      data: row.data,
      createdAt: row.created_at
    }));
  }
);

export const predictEngagementWindow = api(
  { method: "POST", path: "/prospects/:prospectId/engagement-window", expose: true },
  async ({ prospectId }: { prospectId: string }): Promise<{
    nextWindow: Date;
    confidence: number;
    duration: number;
    reasoning: string;
  }> => {
    const behaviors = await getProspectBehaviors(prospectId);
    const engagement = await getEngagementPattern(prospectId);
    
    // Analyze historical engagement windows
    const windows = analyzeEngagementWindows(behaviors);
    
    // Use ML-style pattern recognition
    const prediction = predictNextEngagementWindow(windows, engagement);
    
    return prediction;
  }
);

async function analyzeBehaviorSignals(
  behaviors: any[], 
  recentActivities: any[]
): Promise<BehaviorSignal[]> {
  const signals: BehaviorSignal[] = [];
  const now = Date.now();

  // Analyze email engagement patterns
  const emailBehaviors = behaviors.filter(b => b.event_type.includes('email'));
  if (emailBehaviors.length > 0) {
    const openRate = emailBehaviors.filter(b => b.event_type === 'email_open').length / emailBehaviors.length;
    const clickRate = emailBehaviors.filter(b => b.event_type === 'email_click').length / emailBehaviors.length;
    
    signals.push({
      type: 'email_engagement',
      strength: (openRate + clickRate * 2) / 2,
      recency: calculateRecency(emailBehaviors[0]?.timestamp, now),
      frequency: emailBehaviors.length / 30, // Per day
      context: { openRate, clickRate, totalEmails: emailBehaviors.length },
      score: Math.round((openRate + clickRate * 2) * 50)
    });
  }

  // Analyze website behavior patterns
  const websiteBehaviors = behaviors.filter(b => b.event_type === 'website_visit');
  if (websiteBehaviors.length > 0) {
    const avgDuration = websiteBehaviors.reduce((sum, b) => sum + (b.event_data?.duration || 0), 0) / websiteBehaviors.length;
    const pageDepth = websiteBehaviors.reduce((sum, b) => sum + (b.event_data?.pages || 1), 0) / websiteBehaviors.length;
    
    signals.push({
      type: 'website_engagement',
      strength: Math.min((avgDuration / 300 + pageDepth / 5) / 2, 1), // Normalize to 0-1
      recency: calculateRecency(websiteBehaviors[0]?.timestamp, now),
      frequency: websiteBehaviors.length / 30,
      context: { avgDuration, pageDepth, visits: websiteBehaviors.length },
      score: Math.round(((avgDuration / 300) + (pageDepth / 5)) * 25)
    });
  }

  // Analyze form submission patterns
  const formBehaviors = behaviors.filter(b => b.event_type === 'form_submit');
  if (formBehaviors.length > 0) {
    signals.push({
      type: 'form_engagement',
      strength: 0.9, // High intent signal
      recency: calculateRecency(formBehaviors[0]?.timestamp, now),
      frequency: formBehaviors.length / 30,
      context: { submissions: formBehaviors.length, types: formBehaviors.map(b => b.event_data?.formType) },
      score: 75
    });
  }

  // Analyze meeting behaviors
  const meetingBehaviors = behaviors.filter(b => ['meeting_scheduled', 'meeting_attended', 'meeting_no_show'].includes(b.event_type));
  if (meetingBehaviors.length > 0) {
    const attendanceRate = meetingBehaviors.filter(b => b.event_type === 'meeting_attended').length / 
                          meetingBehaviors.filter(b => b.event_type !== 'meeting_no_show').length;
    
    signals.push({
      type: 'meeting_engagement',
      strength: attendanceRate,
      recency: calculateRecency(meetingBehaviors[0]?.timestamp, now),
      frequency: meetingBehaviors.length / 30,
      context: { attendanceRate, meetings: meetingBehaviors.length },
      score: Math.round(attendanceRate * 100)
    });
  }

  // Analyze download behaviors
  const downloadBehaviors = behaviors.filter(b => b.event_type === 'download');
  if (downloadBehaviors.length > 0) {
    signals.push({
      type: 'content_engagement',
      strength: 0.7,
      recency: calculateRecency(downloadBehaviors[0]?.timestamp, now),
      frequency: downloadBehaviors.length / 30,
      context: { downloads: downloadBehaviors.length, types: downloadBehaviors.map(b => b.event_data?.fileType) },
      score: 60
    });
  }

  // Analyze response patterns
  const responseBehaviors = behaviors.filter(b => 
    ['email_click', 'form_submit', 'meeting_scheduled'].includes(b.event_type)
  );
  if (responseBehaviors.length > 0) {
    const responseRate = responseBehaviors.length / behaviors.length;
    signals.push({
      type: 'response_pattern',
      strength: responseRate,
      recency: calculateRecency(responseBehaviors[0]?.timestamp, now),
      frequency: responseBehaviors.length / 30,
      context: { responseRate, responses: responseBehaviors.length },
      score: Math.round(responseRate * 80)
    });
  }

  return signals;
}

function calculateAdvancedEngagementScore(
  behaviorSignals: BehaviorSignal[], 
  engagement: any
): number {
  let totalScore = 0;
  let weightSum = 0;

  // Weight behavior signals by type and recency
  const signalWeights = {
    'email_engagement': 0.2,
    'website_engagement': 0.25,
    'form_engagement': 0.3,
    'meeting_engagement': 0.4,
    'content_engagement': 0.15,
    'response_pattern': 0.35
  };

  behaviorSignals.forEach(signal => {
    const weight = signalWeights[signal.type] || 0.1;
    const recencyBoost = Math.max(0.5, 1 - signal.recency); // Recent activity gets higher weight
    const finalWeight = weight * recencyBoost;
    
    totalScore += signal.score * finalWeight;
    weightSum += finalWeight;
  });

  // Factor in historical engagement pattern
  if (engagement) {
    const trendMultiplier = engagement.engagement_trend === 'increasing' ? 1.2 : 
                           engagement.engagement_trend === 'decreasing' ? 0.8 : 1.0;
    totalScore *= trendMultiplier;
  }

  return weightSum > 0 ? Math.min(Math.round(totalScore / weightSum), 100) : 0;
}

function determineIntentLevel(
  behaviorSignals: BehaviorSignal[], 
  engagementScore: number, 
  classification: any
): 'low' | 'medium' | 'high' | 'urgent' {
  const urgentSignals = behaviorSignals.filter(s => 
    ['meeting_engagement', 'form_engagement'].includes(s.type) && s.recency < 0.1
  );

  const highIntentSignals = behaviorSignals.filter(s => 
    s.type === 'form_engagement' || 
    (s.type === 'website_engagement' && s.strength > 0.7) ||
    (s.type === 'email_engagement' && s.strength > 0.6)
  );

  if (urgentSignals.length > 0 || engagementScore > 90) {
    return 'urgent';
  } else if (highIntentSignals.length >= 2 || engagementScore > 70) {
    return 'high';
  } else if (engagementScore > 40 || classification?.classification === 'warm') {
    return 'medium';
  } else {
    return 'low';
  }
}

async function predictOptimalTiming(
  prospectId: string, 
  behaviors: any[], 
  engagement: any
): Promise<OptimalTiming> {
  // Analyze historical engagement timing
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<number, number> = {};
  const responseTimings: number[] = [];

  behaviors.forEach(behavior => {
    const date = new Date(behavior.timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  // Find peak engagement times
  const preferredHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  const preferredDays = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)]);

  // Calculate response window based on historical patterns
  const responseWindow = calculateAverageResponseTime(behaviors);

  return {
    preferredDays,
    preferredHours,
    timezone: 'UTC', // Would be determined from prospect data
    responseWindow,
    confidence: Math.min(behaviors.length / 10, 1) // Higher confidence with more data
  };
}

function analyzeContentPreferences(behaviors: any[], classification: any): ContentPreference[] {
  const preferences: ContentPreference[] = [];
  
  // Analyze email content preferences
  const emailEngagement = behaviors.filter(b => b.event_type.includes('email'));
  if (emailEngagement.length > 0) {
    const clickRate = emailEngagement.filter(b => b.event_type === 'email_click').length / emailEngagement.length;
    preferences.push({
      type: 'email',
      engagement: clickRate,
      conversion: clickRate * 0.7, // Estimated conversion
      topics: classification?.interests || [],
      format: 'text'
    });
  }

  // Analyze download preferences
  const downloads = behaviors.filter(b => b.event_type === 'download');
  if (downloads.length > 0) {
    const fileTypes = downloads.map(d => d.event_data?.fileType).filter(Boolean);
    preferences.push({
      type: 'content_download',
      engagement: 0.8,
      conversion: 0.6,
      topics: fileTypes,
      format: 'document'
    });
  }

  return preferences;
}

function predictChurnRisk(behaviors: any[], engagement: any, classification: any): ChurnPrediction {
  const recentBehaviors = behaviors.filter(b => {
    const daysSince = (Date.now() - new Date(b.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 14;
  });

  const factors: string[] = [];
  let riskScore = 0;

  // Low recent activity
  if (recentBehaviors.length < 2) {
    factors.push('Low recent activity');
    riskScore += 0.3;
  }

  // Declining engagement trend
  if (engagement?.engagement_trend === 'decreasing') {
    factors.push('Declining engagement trend');
    riskScore += 0.4;
  }

  // No response to recent communications
  if (engagement?.response_rate < 0.1) {
    factors.push('Low response rate');
    riskScore += 0.2;
  }

  // Classification factors
  if (classification?.classification === 'cold') {
    factors.push('Cold classification');
    riskScore += 0.3;
  }

  const riskLevel: 'low' | 'medium' | 'high' = 
    riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';

  return {
    riskLevel,
    probability: Math.min(riskScore, 1),
    factors,
    timeframe: riskLevel === 'high' ? 7 : riskLevel === 'medium' ? 14 : 30
  };
}

async function generateSequenceRecommendations(
  prospectId: string,
  behaviorSignals: BehaviorSignal[],
  intentLevel: string,
  classification: any
): Promise<SequenceRecommendation[]> {
  // Get available sequences
  const sequences = await db.queryAll`
    SELECT id, name, target_classification, target_stages, description
    FROM nurturing_sequences
    WHERE is_active = true
    AND (
      target_classification @> ${JSON.stringify([classification?.classification])} OR
      target_stages @> ${JSON.stringify([classification?.stage])}
    )
  `;

  const recommendations: SequenceRecommendation[] = [];

  for (const sequence of sequences) {
    let priority = 0.5;
    let reasoning = '';
    let expectedOutcome = '';

    // Score based on intent level
    if (intentLevel === 'urgent') {
      priority += 0.4;
      reasoning += 'High intent detected. ';
      expectedOutcome = 'Meeting scheduled';
    } else if (intentLevel === 'high') {
      priority += 0.3;
      reasoning += 'Strong engagement signals. ';
      expectedOutcome = 'Demo requested';
    }

    // Score based on behavior signals
    const relevantSignals = behaviorSignals.filter(s => s.strength > 0.5);
    priority += relevantSignals.length * 0.1;

    // Sequence-specific scoring
    if (sequence.name.toLowerCase().includes('demo') && intentLevel === 'high') {
      priority += 0.2;
      reasoning += 'Demo sequence matches high intent. ';
    }

    if (sequence.name.toLowerCase().includes('nurture') && intentLevel === 'low') {
      priority += 0.2;
      reasoning += 'Nurture sequence appropriate for low intent. ';
    }

    recommendations.push({
      sequenceId: sequence.id,
      priority: Math.min(priority, 1),
      reasoning: reasoning.trim(),
      expectedOutcome: expectedOutcome || 'Increased engagement',
      confidence: Math.min(behaviorSignals.length / 5, 1)
    });
  }

  return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

function determineNextBestAction(
  behaviorSignals: BehaviorSignal[],
  intentLevel: string,
  optimalTiming: OptimalTiming,
  predictedChurn: ChurnPrediction
): string {
  if (predictedChurn.riskLevel === 'high') {
    return 'Immediate personal outreach to prevent churn';
  }

  if (intentLevel === 'urgent') {
    return 'Schedule demo call within 24 hours';
  }

  if (intentLevel === 'high') {
    return `Send personalized demo invitation for ${optimalTiming.preferredDays[0]} at ${optimalTiming.preferredHours[0]}:00`;
  }

  if (intentLevel === 'medium') {
    return 'Send targeted content based on recent engagement';
  }

  return 'Enroll in appropriate nurturing sequence';
}

// Helper functions
function calculateRecency(timestamp: string, now: number): number {
  if (!timestamp) return 1;
  const daysSince = (now - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(daysSince / 30, 1); // Normalize to 0-1 over 30 days
}

function calculateAverageResponseTime(behaviors: any[]): number {
  const responses = behaviors.filter(b => 
    ['email_click', 'form_submit', 'meeting_scheduled'].includes(b.event_type)
  );
  
  if (responses.length < 2) return 24; // Default 24 hours
  
  let totalTime = 0;
  for (let i = 1; i < responses.length; i++) {
    const timeDiff = new Date(responses[i-1].timestamp).getTime() - new Date(responses[i].timestamp).getTime();
    totalTime += Math.abs(timeDiff);
  }
  
  return Math.round((totalTime / (responses.length - 1)) / (1000 * 60 * 60)); // Hours
}

function analyzeEngagementWindows(behaviors: any[]): any[] {
  // Analyze when prospect is most likely to engage
  const windows = [];
  const sortedBehaviors = behaviors.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  for (let i = 0; i < sortedBehaviors.length - 1; i++) {
    const current = new Date(sortedBehaviors[i].timestamp);
    const next = new Date(sortedBehaviors[i + 1].timestamp);
    const gap = next.getTime() - current.getTime();
    
    windows.push({
      start: current,
      duration: gap,
      day: current.getDay(),
      hour: current.getHours()
    });
  }
  
  return windows;
}

function predictNextEngagementWindow(windows: any[], engagement: any): any {
  if (windows.length === 0) {
    return {
      nextWindow: new Date(Date.now() + 24 * 60 * 60 * 1000),
      confidence: 0.3,
      duration: 60,
      reasoning: 'No historical data available, using default prediction'
    };
  }
  
  // Find most common engagement patterns
  const avgGap = windows.reduce((sum, w) => sum + w.duration, 0) / windows.length;
  const mostCommonHour = engagement?.preferred_contact_times?.[0] || '10:00';
  
  const nextWindow = new Date();
  nextWindow.setHours(parseInt(mostCommonHour.split(':')[0]), 0, 0, 0);
  if (nextWindow < new Date()) {
    nextWindow.setDate(nextWindow.getDate() + 1);
  }
  
  return {
    nextWindow,
    confidence: Math.min(windows.length / 10, 0.9),
    duration: Math.round(avgGap / (1000 * 60)), // Minutes
    reasoning: `Based on ${windows.length} historical engagement patterns, optimal time is ${mostCommonHour}`
  };
}

async function storeAdvancedAnalysis(prospectId: string, analysis: any): Promise<void> {
  await db.exec`
    INSERT INTO ai_insights (prospect_id, type, insight, confidence, data, actionable)
    VALUES 
      (${prospectId}, 'advanced_behavior_analysis', 
       ${`Engagement score: ${analysis.engagementScore}, Intent: ${analysis.intentLevel}, Next action: ${analysis.nextBestAction}`},
       ${0.9}, ${JSON.stringify(analysis)}, true)
  `;
}

// Placeholder functions that would call other services
async function getProspectBehaviors(prospectId: string): Promise<any[]> {
  const result = await db.queryAll`
    SELECT * FROM prospect_behaviors 
    WHERE prospect_id = ${prospectId} 
    ORDER BY timestamp DESC 
    LIMIT 100
  `;
  return result;
}

async function getEngagementPattern(prospectId: string): Promise<any> {
  const result = await db.queryRow`
    SELECT * FROM engagement_patterns WHERE prospect_id = ${prospectId}
  `;
  return result;
}

async function getProspectClassification(prospectId: string): Promise<any> {
  const result = await db.queryRow`
    SELECT * FROM prospect_classifications WHERE prospect_id = ${prospectId}
  `;
  return result;
}

async function getRecentActivities(prospectId: string, days: number): Promise<any[]> {
  const result = await db.queryAll`
    SELECT * FROM prospect_behaviors 
    WHERE prospect_id = ${prospectId} 
    AND timestamp > NOW() - INTERVAL '${days} days'
    ORDER BY timestamp DESC
  `;
  return result;
}