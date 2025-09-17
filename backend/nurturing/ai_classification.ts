import { api } from "encore.dev/api";
import { db } from "./db";
import { ProspectClassification, AIInsight, AnalyzeBehaviorRequest } from "./types";
import * as ai from "../ai/openai";

export const classifyProspect = api(
  { method: "POST", path: "/prospects/:prospectId/classify", expose: true },
  async ({ prospectId }: { prospectId: string }): Promise<ProspectClassification> => {
    // Get prospect behaviors and engagement patterns
    const behaviors = await db.queryAll`
      SELECT event_type, score, timestamp, event_data
      FROM prospect_behaviors
      WHERE prospect_id = ${prospectId}
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    const engagement = await db.queryRow`
      SELECT *
      FROM engagement_patterns
      WHERE prospect_id = ${prospectId}
    `;

    // Get prospect data from prospect service
    const prospectData = await getProspectData(prospectId);
    
    // Perform AI classification
    const classification = await performAIClassification(prospectId, behaviors, engagement, prospectData);
    
    // Store classification
    await db.exec`
      INSERT INTO prospect_classifications (
        prospect_id, classification, confidence, factors, stage, 
        buying_signals, pain_points, interests, last_updated
      ) VALUES (
        ${prospectId}, ${classification.classification}, ${classification.confidence},
        ${JSON.stringify(classification.factors)}, ${classification.stage},
        ${JSON.stringify(classification.buyingSignals)}, ${JSON.stringify(classification.painPoints)},
        ${JSON.stringify(classification.interests)}, NOW()
      )
      ON CONFLICT (prospect_id) DO UPDATE SET
        classification = EXCLUDED.classification,
        confidence = EXCLUDED.confidence,
        factors = EXCLUDED.factors,
        stage = EXCLUDED.stage,
        buying_signals = EXCLUDED.buying_signals,
        pain_points = EXCLUDED.pain_points,
        interests = EXCLUDED.interests,
        last_updated = NOW()
      RETURNING id
    `;

    return classification;
  }
);

export const getProspectClassification = api(
  { method: "GET", path: "/prospects/:prospectId/classification", expose: true },
  async ({ prospectId }: { prospectId: string }) => {
    const row = await db.queryRow`
      SELECT id, prospect_id, classification, confidence, factors, stage,
             buying_signals, pain_points, interests, last_updated
      FROM prospect_classifications
      WHERE prospect_id = ${prospectId}
    `;

    if (!row) {
      return null;
    }
    return {
      id: row.id,
      prospectId: row.prospect_id,
      classification: row.classification,
      confidence: parseFloat(row.confidence),
      factors: row.factors,
      stage: row.stage,
      buyingSignals: row.buying_signals,
      painPoints: row.pain_points,
      interests: row.interests,
      lastUpdated: row.last_updated
    };
  }
);

export const generateAIInsights = api(
  { method: "POST", path: "/prospects/:prospectId/ai-insights", expose: true },
  async ({ prospectId }: { prospectId: string }) => {
    const behaviorQuery = await db.query`
      SELECT event_type, score, timestamp, event_data
      FROM prospect_behaviors
      WHERE prospect_id = ${prospectId}
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    const behaviorRows: any[] = [];
    for await (const row of behaviorQuery) {
      behaviorRows.push(row);
    }

    const classification = await getProspectClassification({ prospectId });
    const engagementQuery = await db.query`
      SELECT * FROM engagement_patterns WHERE prospect_id = ${prospectId}
    `;

    const engagementRows: any[] = [];
    for await (const row of engagementQuery) {
      engagementRows.push(row);
    }

    const insights = await generateInsights(prospectId, behaviorRows, classification, engagementRows[0]);
    
    // Store insights
    for (const insight of insights) {
      await db.exec`
        INSERT INTO ai_insights (prospect_id, type, insight, confidence, data, actionable)
        VALUES (${prospectId}, ${insight.type}, ${insight.insight}, ${insight.confidence}, 
                ${JSON.stringify(insight.data)}, ${insight.actionable})
      `;
    }

    return insights;
  }
);

export const getAIInsights = api(
  { method: "GET", path: "/prospects/:prospectId/insights", expose: true },
  async ({ prospectId }: { prospectId: string }) => {
    const result = await db.query`
      SELECT id, prospect_id, type, insight, confidence, data, actionable, created_at, applied_at
      FROM ai_insights
      WHERE prospect_id = ${prospectId}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const rows: any[] = [];
    for await (const row of result) {
      rows.push(row);
    }

    return rows.map((row: any) => ({
      id: row.id,
      prospectId: row.prospect_id,
      type: row.type,
      insight: row.insight,
      confidence: parseFloat(row.confidence),
      data: row.data,
      actionable: row.actionable,
      createdAt: row.created_at,
      appliedAt: row.applied_at
    }));
  }
);

async function performAIClassification(
  prospectId: string, 
  behaviors: any[], 
  engagement: any, 
  prospectData: any
): Promise<ProspectClassification> {
  // Calculate total engagement score
  const totalScore = behaviors.reduce((sum, b) => sum + (b.score || 0), 0);
  const avgScore = behaviors.length > 0 ? totalScore / behaviors.length : 0;
  
  // Analyze recent activity (last 7 days)
  const recentBehaviors = behaviors.filter(b => {
    const daysSince = (Date.now() - new Date(b.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  });
  
  const recentScore = recentBehaviors.reduce((sum, b) => sum + (b.score || 0), 0);
  
  // Determine classification
  let classification: string;
  let confidence: number;
  let factors: string[] = [];
  let stage: string;
  let buyingSignals: string[] = [];
  let painPoints: string[] = [];
  let interests: string[] = [];

  // Classification logic
  if (recentScore >= 100 || behaviors.some(b => ['meeting_scheduled', 'meeting_attended'].includes(b.event_type))) {
    classification = 'hot';
    confidence = 0.9;
    factors.push('High recent engagement', 'Meeting activity');
    stage = 'intent' as 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
    buyingSignals.push('Scheduled meetings', 'High engagement');
  } else if (recentScore >= 50 || avgScore >= 15) {
    classification = 'warm';
    confidence = 0.8;
    factors.push('Moderate engagement', 'Consistent activity');
    stage = 'consideration' as 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
    buyingSignals.push('Content engagement', 'Website visits');
  } else if (totalScore >= 30 && behaviors.length >= 5) {
    classification = 'nurture';
    confidence = 0.7;
    factors.push('Some engagement', 'Multiple touchpoints');
    stage = 'interest' as 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
  } else if (totalScore < 10 || behaviors.length < 3) {
    classification = 'cold';
    confidence = 0.8;
    factors.push('Low engagement', 'Minimal activity');
    stage = 'awareness' as 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
  } else {
    classification = 'unqualified';
    confidence = 0.6;
    factors.push('Inconsistent patterns');
    stage = 'awareness' as 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
  }

  // Analyze behavior patterns for insights
  const emailBehaviors = behaviors.filter(b => b.event_type.includes('email'));
  const websiteBehaviors = behaviors.filter(b => b.event_type === 'website_visit');
  const formBehaviors = behaviors.filter(b => b.event_type === 'form_submit');

  if (emailBehaviors.length > 0) {
    const openRate = emailBehaviors.filter(b => b.event_type === 'email_open').length / emailBehaviors.length;
    if (openRate > 0.7) {
      buyingSignals.push('High email engagement');
      interests.push('Email communication');
    }
  }

  if (websiteBehaviors.length > 5) {
    buyingSignals.push('Active website visitor');
    interests.push('Web content');
  }

  if (formBehaviors.length > 0) {
    buyingSignals.push('Form submissions');
    interests.push('Information gathering');
  }

  // Analyze timing patterns
  if (engagement) {
    if (engagement.response_rate > 0.3) {
      buyingSignals.push('High response rate');
      factors.push('Responsive prospect');
    }
    
    if (engagement.engagement_trend === 'increasing') {
      buyingSignals.push('Increasing engagement');
      factors.push('Growing interest');
    }
  }

  // Industry-specific insights
  if (prospectData?.industry) {
    interests.push(prospectData.industry as string);
    painPoints.push(`${prospectData.industry} challenges`);
  }

  // Company size insights
  if (prospectData?.companySize) {
    if (prospectData.companySize === 'enterprise') {
      painPoints.push('Scalability concerns', 'Complex integration needs');
      stage = (stage === 'awareness' ? 'interest' : stage) as 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
    } else if (prospectData.companySize === 'startup') {
      painPoints.push('Budget constraints', 'Fast growth needs');
    }
  }

  return {
    id: '', // Will be set by database
    prospectId,
    classification,
    confidence,
    factors,
    stage,
    buyingSignals,
    painPoints,
    interests,
    lastUpdated: new Date()
  };
}

async function generateInsights(
  prospectId: string,
  behaviors: any[],
  classification: ProspectClassification | null,
  engagement: any
): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];

  // Engagement prediction
  if (behaviors.length >= 5) {
    const recentEngagement = behaviors.slice(0, 10);
    const trend = calculateEngagementTrend(recentEngagement);
    
    insights.push({
      id: '',
      prospectId,
      type: 'engagement_prediction',
      insight: `Based on recent activity, this prospect is ${trend.direction} likely to engage in the next 7 days. Predicted engagement score: ${trend.predictedScore}`,
      confidence: trend.confidence,
      data: { predictedScore: trend.predictedScore, trend: trend.direction },
      actionable: true,
      createdAt: new Date()
    });
  }

  // Content recommendation
  if (classification) {
    const contentRec = generateContentRecommendation(classification, behaviors);
    insights.push({
      id: '',
      prospectId,
      type: 'content_recommendation',
      insight: contentRec.insight,
      confidence: contentRec.confidence,
      data: contentRec.data,
      actionable: true,
      createdAt: new Date()
    });
  }

  // Timing optimization
  if (engagement && engagement.preferred_contact_times.length > 0) {
    insights.push({
      id: '',
      prospectId,
      type: 'timing_optimization',
      insight: `Best contact times: ${engagement.preferred_contact_times.join(', ')}. Peak engagement days: ${engagement.peak_engagement_days.map((d: number) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}`,
      confidence: 0.8,
      data: { 
        preferredTimes: engagement.preferred_contact_times,
        peakDays: engagement.peak_engagement_days 
      },
      actionable: true,
      createdAt: new Date()
    });
  }

  // Channel preference
  if (engagement && engagement.preferred_channels.length > 0) {
    insights.push({
      id: '',
      prospectId,
      type: 'channel_preference',
      insight: `Preferred communication channels: ${engagement.preferred_channels.join(', ')}`,
      confidence: 0.7,
      data: { channels: engagement.preferred_channels },
      actionable: true,
      createdAt: new Date()
    });
  }

  return insights;
}

function calculateEngagementTrend(recentBehaviors: any[]): { direction: string; predictedScore: number; confidence: number } {
  if (recentBehaviors.length < 3) {
    return { direction: 'stable', predictedScore: 10, confidence: 0.5 };
  }

  const scores = recentBehaviors.map(b => b.score || 0);
  const avgRecent = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const avgOlder = scores.slice(3).reduce((a, b) => a + b, 0) / Math.max(scores.slice(3).length, 1);

  let direction = 'stable';
  let confidence = 0.7;

  if (avgRecent > avgOlder * 1.3) {
    direction = 'increasingly';
    confidence = 0.8;
  } else if (avgRecent < avgOlder * 0.7) {
    direction = 'decreasingly';
    confidence = 0.8;
  }

  const predictedScore = Math.round(avgRecent * (direction === 'increasingly' ? 1.2 : direction === 'decreasingly' ? 0.8 : 1));

  return { direction, predictedScore, confidence };
}

function generateContentRecommendation(classification: ProspectClassification, behaviors: any[]): { insight: string; confidence: number; data: any } {
  const hasEmailEngagement = behaviors.some(b => b.event_type.includes('email'));
  const hasWebsiteActivity = behaviors.some(b => b.event_type === 'website_visit');
  const hasFormSubmissions = behaviors.some(b => b.event_type === 'form_submit');

  let recommendation = '';
  let confidence = 0.7;
  let contentTypes: string[] = [];

  switch (classification.stage) {
    case 'awareness':
      contentTypes = ['blog_posts', 'educational_content', 'industry_reports'];
      recommendation = 'Focus on educational content to build awareness and establish thought leadership';
      break;
    case 'interest':
      contentTypes = ['case_studies', 'webinars', 'product_overviews'];
      recommendation = 'Share relevant case studies and product information to nurture interest';
      break;
    case 'consideration':
      contentTypes = ['demos', 'comparisons', 'roi_calculators'];
      recommendation = 'Provide comparison content and ROI demonstrations to support evaluation';
      break;
    case 'intent':
      contentTypes = ['pricing', 'implementation_guides', 'customer_testimonials'];
      recommendation = 'Share pricing information and implementation success stories';
      confidence = 0.9;
      break;
    case 'evaluation':
      contentTypes = ['trial_offers', 'technical_specs', 'support_information'];
      recommendation = 'Offer trials and detailed technical information for final evaluation';
      confidence = 0.9;
      break;
    default:
      contentTypes = ['mixed_content'];
      recommendation = 'Use varied content to gauge interest and engagement patterns';
  }

  if (hasEmailEngagement) {
    recommendation += '. Email channel shows good engagement.';
  }

  if (hasWebsiteActivity) {
    recommendation += '. Website activity indicates research behavior.';
  }

  return {
    insight: recommendation,
    confidence,
    data: { 
      recommendedContentTypes: contentTypes,
      stage: classification.stage,
      classification: classification.classification
    }
  };
}

async function getProspectData(prospectId: string): Promise<any> {
  try {
    // This would typically call the prospect service
    // For now, return mock data
    return {
      industry: 'Technology',
      companySize: 'startup',
      title: 'CTO',
      location: 'San Francisco'
    };
  } catch (error) {
    console.error('Error fetching prospect data:', error);
    return {};
  }
}