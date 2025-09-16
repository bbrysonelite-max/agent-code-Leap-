import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { executeQuery, insertRow, requireRow } from "../shared/database";
import type { 
  AnalyzeBehaviorRequest, 
  AnalyzeBehaviorResponse, 
  ProspectBehavior, 
  EngagementPattern, 
  ProspectClassificationData,
  ProspectClassification,
  FunnelStage,
  EngagementLevel,
  BehaviorType
} from "./types";

// AI behavior analysis to classify prospects and track engagement patterns
export const analyzeBehavior = api<AnalyzeBehaviorRequest, AnalyzeBehaviorResponse>(
  { expose: true, method: "POST", path: "/nurturing/analyze-behavior" },
  wrapAsync(async (req) => {
    validateField(req.prospect_id, "prospect_id", [Rules.required()]);
    
    // Get recent behaviors for this prospect
    const recentBehaviors = await executeQuery(
      () => nurturingDB.queryAll<ProspectBehavior>`
        SELECT * FROM prospect_behaviors 
        WHERE prospect_id = ${req.prospect_id}
        ORDER BY timestamp DESC 
        LIMIT 100
      `,
      "get recent behaviors"
    );
    
    // Get existing engagement pattern
    let engagementPattern = await nurturingDB.queryRow<EngagementPattern>`
      SELECT * FROM engagement_patterns WHERE prospect_id = ${req.prospect_id}
    `;
    
    // Analyze behaviors and calculate engagement metrics
    const behaviorAnalysis = analyzeBehaviorPatterns(recentBehaviors);
    const engagementMetrics = calculateEngagementMetrics(recentBehaviors);
    const classification = classifyProspect(recentBehaviors, engagementMetrics);
    
    // Update or create engagement pattern
    if (engagementPattern) {
      engagementPattern = await executeQuery(
        () => nurturingDB.queryRow<EngagementPattern>`
          UPDATE engagement_patterns 
          SET 
            pattern_type = ${behaviorAnalysis.patternType},
            description = ${behaviorAnalysis.description},
            frequency_score = ${engagementMetrics.frequencyScore},
            engagement_level = ${engagementMetrics.level},
            preferred_channels = ${JSON.stringify(behaviorAnalysis.preferredChannels)},
            optimal_timing = ${behaviorAnalysis.optimalTiming},
            ai_insights = ${JSON.stringify(behaviorAnalysis.insights)},
            confidence_score = ${behaviorAnalysis.confidence},
            last_updated = NOW()
          WHERE prospect_id = ${req.prospect_id}
          RETURNING *
        `,
        "update engagement pattern"
      );
    } else {
      engagementPattern = await insertRow(
        () => nurturingDB.queryRow<EngagementPattern>`
          INSERT INTO engagement_patterns (
            prospect_id, pattern_type, description, frequency_score, 
            engagement_level, preferred_channels, optimal_timing, 
            ai_insights, confidence_score
          ) VALUES (
            ${req.prospect_id}, ${behaviorAnalysis.patternType}, ${behaviorAnalysis.description},
            ${engagementMetrics.frequencyScore}, ${engagementMetrics.level}, 
            ${JSON.stringify(behaviorAnalysis.preferredChannels)}, ${behaviorAnalysis.optimalTiming},
            ${JSON.stringify(behaviorAnalysis.insights)}, ${behaviorAnalysis.confidence}
          )
          RETURNING *
        `,
        "create engagement pattern"
      );
    }
    
    // Create or update prospect classification
    const classificationData = await upsertProspectClassification(
      req.prospect_id, 
      classification, 
      engagementMetrics,
      behaviorAnalysis
    );
    
    // Get recommended sequences based on classification
    const recommendedSequences = await getRecommendedSequences(
      classificationData.classification,
      classificationData.funnel_stage
    );
    
    return {
      prospect_id: req.prospect_id,
      classification: classificationData,
      engagement_pattern: engagementPattern,
      recommended_sequences,
      next_best_actions: classificationData.next_best_actions,
      ai_insights: behaviorAnalysis.insights
    };
  })
);

interface BehaviorAnalysis {
  patternType: string;
  description: string;
  preferredChannels: string[];
  optimalTiming: string;
  insights: string[];
  confidence: number;
}

interface EngagementMetrics {
  frequencyScore: number;
  level: EngagementLevel;
  totalInteractions: number;
  recentActivity: number;
  responseRate: number;
}

function analyzeBehaviorPatterns(behaviors: ProspectBehavior[]): BehaviorAnalysis {
  if (behaviors.length === 0) {
    return {
      patternType: "new_prospect",
      description: "No behavioral data available",
      preferredChannels: ["email"],
      optimalTiming: "business_hours",
      insights: ["New prospect with no engagement history"],
      confidence: 0.1
    };
  }
  
  // Analyze behavior frequency and types
  const behaviorCounts = behaviors.reduce((acc, behavior) => {
    acc[behavior.behavior_type] = (acc[behavior.behavior_type] || 0) + 1;
    return acc;
  }, {} as Record<BehaviorType, number>);
  
  // Determine preferred channels
  const channelPreferences = Object.entries(behaviorCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([channel]) => channel);
  
  // Analyze timing patterns
  const hourlyActivity = behaviors.reduce((acc, behavior) => {
    const hour = new Date(behavior.timestamp).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  const peakHour = Object.entries(hourlyActivity)
    .sort(([, a], [, b]) => b - a)[0];
  
  const optimalTiming = peakHour && parseInt(peakHour[0]) >= 9 && parseInt(peakHour[0]) <= 17 
    ? "business_hours" : "evening";
  
  // Generate AI insights
  const insights = generateBehaviorInsights(behaviors, behaviorCounts, channelPreferences);
  
  // Determine pattern type
  const patternType = determinePatternType(behaviors, behaviorCounts);
  
  return {
    patternType,
    description: `Prospect shows ${patternType} engagement with ${channelPreferences[0]} preference`,
    preferredChannels: channelPreferences.slice(0, 3),
    optimalTiming,
    insights,
    confidence: Math.min(0.9, behaviors.length * 0.05 + 0.3)
  };
}

function calculateEngagementMetrics(behaviors: ProspectBehavior[]): EngagementMetrics {
  const totalInteractions = behaviors.length;
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentActivity = behaviors.filter(b => 
    new Date(b.timestamp) > last7Days
  ).length;
  
  const emailBehaviors = behaviors.filter(b => 
    b.behavior_type === 'email_open' || b.behavior_type === 'email_click'
  );
  
  const responseRate = emailBehaviors.length > 0 
    ? behaviors.filter(b => b.behavior_type === 'reply').length / emailBehaviors.length
    : 0;
  
  const avgEngagementScore = behaviors.length > 0 
    ? behaviors.reduce((sum, b) => sum + b.engagement_score, 0) / behaviors.length
    : 0;
  
  const frequencyScore = Math.min(100, (recentActivity * 10) + (totalInteractions * 2));
  
  let level: EngagementLevel;
  if (avgEngagementScore >= 8) level = 'very_high';
  else if (avgEngagementScore >= 6) level = 'high';
  else if (avgEngagementScore >= 4) level = 'medium';
  else if (avgEngagementScore >= 2) level = 'low';
  else level = 'very_low';
  
  return {
    frequencyScore,
    level,
    totalInteractions,
    recentActivity,
    responseRate
  };
}

function classifyProspect(
  behaviors: ProspectBehavior[], 
  metrics: EngagementMetrics
): { classification: ProspectClassification; funnelStage: FunnelStage } {
  
  // High engagement recent activity
  if (metrics.recentActivity >= 5 && metrics.level === 'very_high') {
    return { classification: 'hot', funnelStage: 'intent' };
  }
  
  // Good engagement with responses
  if (metrics.responseRate > 0.3 && metrics.level >= 'high') {
    return { classification: 'warm', funnelStage: 'consideration' };
  }
  
  // Some engagement but declining
  if (metrics.totalInteractions > 5 && metrics.recentActivity < 2) {
    return { classification: 'cold', funnelStage: 'awareness' };
  }
  
  // No recent activity
  if (metrics.recentActivity === 0 && metrics.totalInteractions > 0) {
    return { classification: 'unengaged', funnelStage: 'awareness' };
  }
  
  // New or low engagement
  return { classification: 'cold', funnelStage: 'awareness' };
}

function generateBehaviorInsights(
  behaviors: ProspectBehavior[], 
  behaviorCounts: Record<string, number>,
  channelPreferences: string[]
): string[] {
  const insights: string[] = [];
  
  if (behaviorCounts.email_open > behaviorCounts.email_click * 3) {
    insights.push("Opens emails but rarely clicks - content may need to be more compelling");
  }
  
  if (behaviorCounts.website_visit > 3) {
    insights.push("Shows strong research behavior with multiple website visits");
  }
  
  if (behaviorCounts.reply > 0) {
    insights.push("Responsive to email communication - good candidate for personal outreach");
  }
  
  if (channelPreferences[0] === 'social_engagement') {
    insights.push("Prefers social media interaction over email");
  }
  
  const recentBehaviors = behaviors.filter(b => 
    new Date(b.timestamp) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  );
  
  if (recentBehaviors.length > 3) {
    insights.push("High recent activity suggests increased interest");
  }
  
  return insights;
}

function determinePatternType(
  behaviors: ProspectBehavior[], 
  behaviorCounts: Record<string, number>
): string {
  const totalBehaviors = behaviors.length;
  
  if (behaviorCounts.email_open > totalBehaviors * 0.5) {
    return "email_focused";
  }
  
  if (behaviorCounts.website_visit > totalBehaviors * 0.3) {
    return "research_oriented";
  }
  
  if (behaviorCounts.social_engagement > totalBehaviors * 0.4) {
    return "social_preferred";
  }
  
  if (behaviorCounts.reply > 0) {
    return "responsive_communicator";
  }
  
  return "passive_observer";
}

async function upsertProspectClassification(
  prospectId: string,
  classification: { classification: ProspectClassification; funnelStage: FunnelStage },
  metrics: EngagementMetrics,
  analysis: BehaviorAnalysis
): Promise<ProspectClassificationData> {
  
  const aiReasoning = `Classified as ${classification.classification} based on ${metrics.totalInteractions} total interactions, ${metrics.recentActivity} recent activities, and ${metrics.responseRate} response rate. Pattern: ${analysis.patternType}`;
  
  const nextBestActions = generateNextBestActions(classification.classification, classification.funnelStage, metrics);
  
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7); // Classifications expire in 7 days
  
  const existing = await nurturingDB.queryRow<ProspectClassificationData>`
    SELECT * FROM prospect_classifications WHERE prospect_id = ${prospectId}
  `;
  
  if (existing) {
    return await executeQuery(
      () => nurturingDB.queryRow<ProspectClassificationData>`
        UPDATE prospect_classifications 
        SET 
          classification = ${classification.classification},
          funnel_stage = ${classification.funnelStage},
          engagement_level = ${metrics.level},
          ai_reasoning = ${aiReasoning},
          behavioral_indicators = ${JSON.stringify(analysis.insights)},
          confidence_score = ${analysis.confidence},
          next_best_actions = ${JSON.stringify(nextBestActions)},
          estimated_close_probability = ${calculateCloseProbability(classification, metrics)},
          predicted_revenue = ${calculatePredictedRevenue(classification, metrics)},
          classification_expires_at = ${expirationDate},
          last_updated = NOW()
        WHERE prospect_id = ${prospectId}
        RETURNING *
      `,
      "update prospect classification"
    );
  } else {
    return await insertRow(
      () => nurturingDB.queryRow<ProspectClassificationData>`
        INSERT INTO prospect_classifications (
          prospect_id, classification, funnel_stage, engagement_level,
          ai_reasoning, behavioral_indicators, confidence_score, 
          next_best_actions, estimated_close_probability, predicted_revenue,
          classification_expires_at
        ) VALUES (
          ${prospectId}, ${classification.classification}, ${classification.funnelStage}, ${metrics.level},
          ${aiReasoning}, ${JSON.stringify(analysis.insights)}, ${analysis.confidence},
          ${JSON.stringify(nextBestActions)}, ${calculateCloseProbability(classification, metrics)}, 
          ${calculatePredictedRevenue(classification, metrics)}, ${expirationDate}
        )
        RETURNING *
      `,
      "create prospect classification"
    );
  }
}

function generateNextBestActions(
  classification: ProspectClassification, 
  funnelStage: FunnelStage, 
  metrics: EngagementMetrics
): string[] {
  const actions: string[] = [];
  
  switch (classification) {
    case 'hot':
      actions.push("Schedule immediate sales call");
      actions.push("Send personalized proposal");
      break;
    case 'warm':
      actions.push("Send educational content");
      actions.push("Invite to product demo");
      break;
    case 'cold':
      actions.push("Re-engagement email sequence");
      actions.push("Social media connection");
      break;
    case 'unengaged':
      actions.push("Break-up email campaign");
      actions.push("Different channel outreach");
      break;
  }
  
  if (metrics.responseRate > 0) {
    actions.push("Personal follow-up email");
  }
  
  return actions;
}

function calculateCloseProbability(
  classification: { classification: ProspectClassification; funnelStage: FunnelStage },
  metrics: EngagementMetrics
): number {
  let baseProbability = 0;
  
  switch (classification.classification) {
    case 'hot': baseProbability = 0.7; break;
    case 'warm': baseProbability = 0.4; break;
    case 'cold': baseProbability = 0.15; break;
    case 'unengaged': baseProbability = 0.05; break;
    default: baseProbability = 0.1;
  }
  
  // Adjust based on funnel stage
  const stageMultiplier = {
    'awareness': 0.5,
    'interest': 0.7,
    'consideration': 0.8,
    'intent': 1.2,
    'decision': 1.5,
    'retention': 0.3
  }[classification.funnelStage] || 1;
  
  // Adjust based on engagement metrics
  const engagementMultiplier = metrics.responseRate + (metrics.level === 'very_high' ? 0.3 : 0);
  
  return Math.min(0.95, baseProbability * stageMultiplier * (1 + engagementMultiplier));
}

function calculatePredictedRevenue(
  classification: { classification: ProspectClassification; funnelStage: FunnelStage },
  metrics: EngagementMetrics
): number {
  const baseRevenue = 5000; // Average deal size
  const probability = calculateCloseProbability(classification, metrics);
  
  return baseRevenue * probability;
}

async function getRecommendedSequences(
  classification: ProspectClassification,
  funnelStage: FunnelStage
): Promise<string[]> {
  const sequences = await executeQuery(
    () => nurturingDB.queryAll<{ id: string; name: string }>`
      SELECT id, name FROM nurturing_sequences 
      WHERE status = 'active' 
      AND (target_classification = ${classification} OR target_funnel_stage = ${funnelStage})
      ORDER BY conversion_rate DESC
      LIMIT 5
    `,
    "get recommended sequences"
  );
  
  return sequences.map(s => s.id);
}