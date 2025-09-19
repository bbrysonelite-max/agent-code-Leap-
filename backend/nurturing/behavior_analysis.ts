import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { 
  TrackBehaviorRequest, 
  ProspectBehavior, 
  ProspectEngagementProfile,
  BehaviorType,
  EngagementTrend,
  AIAnalysisRequest,
  AIAnalysisResponse
} from "./types";
import * as ai from "../ai/openai";

// Track a specific prospect behavior and update their engagement profile
export const trackBehavior = api(
  { method: "POST", path: "/track-behavior", expose: true },
  async (req: TrackBehaviorRequest): Promise<void> => {
    const engagement_score = calculateEngagementScore(req.behavior_type, req.behavior_data);
    
    // Insert behavior record
    await nurturingDB.exec`
      INSERT INTO prospect_behavior (prospect_id, client_id, behavior_type, behavior_data, engagement_score)
      VALUES (${req.prospect_id}, ${req.client_id}, ${req.behavior_type}, ${JSON.stringify(req.behavior_data || {})}, ${engagement_score})
    `;
    
    // Update or create engagement profile
    await updateEngagementProfile(req.prospect_id, req.client_id);
  }
);

// Get detailed engagement profile for a prospect
export const getEngagementProfile = api(
  { method: "GET", path: "/engagement-profile/:prospect_id", expose: true },
  async ({ prospect_id }: { prospect_id: number }) => {
    const profileResults = [];
    for await (const row of nurturingDB.query`
      SELECT * FROM prospect_engagement_profile 
      WHERE prospect_id = ${prospect_id}
    `) {
      profileResults.push(row);
    }
    const profile = profileResults[0];
    
    return profile || null;
  }
);

// Get recent behaviors for a prospect
export const getProspectBehaviors = api(
  { method: "GET", path: "/prospect-behaviors/:prospect_id", expose: true },
  async ({ prospect_id }: { prospect_id: number }) => {
    const behaviors = [];
    for await (const row of nurturingDB.query`
      SELECT * FROM prospect_behavior 
      WHERE prospect_id = ${prospect_id}
      ORDER BY created_at DESC
      LIMIT 50
    `) {
      behaviors.push(row);
    }
    
    return behaviors;
  }
);

// AI-powered analysis of prospect engagement patterns
export const analyzeProspectEngagement = api(
  { method: "POST", path: "/analyze-engagement", expose: true },
  async (req: AIAnalysisRequest) => {
    // Get prospect engagement data
    const profileQuery = await nurturingDB.query`
      SELECT * FROM prospect_engagement_profile 
      WHERE prospect_id = ${req.prospect_id}
    `;
    
    let profile = null;
    for await (const row of profileQuery) {
      profile = row;
      break;
    }
    
    const behaviors = await nurturingDB.query`
      SELECT * FROM prospect_behavior 
      WHERE prospect_id = ${req.prospect_id}
      ORDER BY created_at DESC
      LIMIT 20
    `;
    
    // Convert async generator to array
    const behaviorsArray = [];
    for await (const behavior of behaviors) {
      behaviorsArray.push(behavior);
    }
    
    // Create AI prompt based on analysis type
    const prompt = createAnalysisPrompt(req.analysis_type, profile, behaviorsArray, req.context);
    
    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 600,
      temperature: 0.3
    });
    
    return parseAnalysisResponse(aiResponse.content);
  }
);

// Get engagement analytics for a client
export const getEngagementAnalytics = api(
  { method: "GET", path: "/engagement-analytics/:client_id", expose: true },
  async ({ client_id }: { client_id: number }) => {
    const analytics = await nurturingDB.query`
      SELECT 
        COUNT(DISTINCT pb.prospect_id) as total_active_prospects,
        AVG(pep.total_score) as avg_engagement_score,
        COUNT(pb.id) as total_behaviors_tracked,
        COUNT(CASE WHEN pb.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as behaviors_last_week
      FROM prospect_behavior pb
      LEFT JOIN prospect_engagement_profile pep ON pb.prospect_id = pep.prospect_id
      WHERE pb.client_id = ${client_id}
    `;
    
    const trendData = await nurturingDB.query`
      SELECT 
        DATE(created_at) as date,
        COUNT(id) as total_behaviors,
        AVG(engagement_score) as avg_score,
        COUNT(DISTINCT prospect_id) as unique_prospects
      FROM prospect_behavior
      WHERE client_id = ${client_id}
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    
    const analyticsArray = [];
    for await (const row of analytics) {
      analyticsArray.push(row);
    }
    
    const trendArray = [];
    for await (const row of trendData) {
      trendArray.push(row);
    }
    
    return {
      summary: analyticsArray[0],
      trends: trendArray
    };
  }
);

// Helper function to calculate engagement score based on behavior type
function calculateEngagementScore(behaviorType: BehaviorType, behaviorData?: Record<string, any>): number {
  const baseScores: Record<BehaviorType, number> = {
    email_open: 10,
    email_click: 25,
    email_reply: 50,
    website_visit: 20,
    linkedin_view: 15,
    linkedin_connect: 40,
    phone_answer: 60,
    phone_voicemail: 5,
    content_download: 35,
    meeting_scheduled: 80,
    meeting_attended: 90,
    meeting_no_show: -20
  };
  
  let score = baseScores[behaviorType] || 0;
  
  // Apply modifiers based on additional data
  if (behaviorData) {
    if (behaviorData.time_spent && behaviorData.time_spent > 30) {
      score += 10; // Bonus for extended engagement
    }
    if (behaviorData.return_visitor) {
      score += 5; // Bonus for return engagement
    }
    if (behaviorData.shared_content) {
      score += 15; // Bonus for sharing/viral actions
    }
  }
  
  return Math.max(0, Math.min(100, score)); // Clamp between 0-100
}

// Update engagement profile based on recent behaviors
async function updateEngagementProfile(prospectId: number, clientId: number): Promise<void> {
  // Calculate aggregated metrics from recent behaviors
  const metricsResult = await nurturingDB.query`
    SELECT 
      COUNT(id) as total_behaviors,
      AVG(engagement_score) as avg_score,
      COUNT(CASE WHEN behavior_type LIKE 'email_%' THEN 1 END) as email_behaviors,
      COUNT(CASE WHEN behavior_type = 'email_reply' THEN 1 END) as email_replies,
      COUNT(CASE WHEN behavior_type LIKE 'meeting_%' THEN 1 END) as meeting_behaviors,
      MAX(created_at) as last_behavior
    FROM prospect_behavior
    WHERE prospect_id = ${prospectId}
      AND created_at >= CURRENT_DATE - INTERVAL '90 days'
  `;
  
  // Calculate response rate and timing patterns
  let metrics = null;
  for await (const row of metricsResult) {
    metrics = row;
    break;
  }
  const responseRate = metrics && metrics.email_behaviors > 0 ? 
    (metrics.email_replies / metrics.email_behaviors) * 100 : 0;
  
  // Determine engagement trend
  const recentScoreQuery = await nurturingDB.query`
    SELECT AVG(engagement_score) as recent_avg
    FROM prospect_behavior
    WHERE prospect_id = ${prospectId}
      AND created_at >= CURRENT_DATE - INTERVAL '14 days'
  `;
  
  const olderScoreQuery = await nurturingDB.query`
    SELECT AVG(engagement_score) as older_avg
    FROM prospect_behavior
    WHERE prospect_id = ${prospectId}
      AND created_at >= CURRENT_DATE - INTERVAL '28 days'
      AND created_at < CURRENT_DATE - INTERVAL '14 days'
  `;
  
  let recentScore = null;
  for await (const row of recentScoreQuery) {
    recentScore = row;
    break;
  }
  
  let olderScore = null;
  for await (const row of olderScoreQuery) {
    olderScore = row;
    break;
  }
  
  let trend: EngagementTrend = 'neutral';
  if (recentScore && recentScore.recent_avg && olderScore && olderScore.older_avg) {
    const difference = recentScore.recent_avg - olderScore.older_avg;
    if (difference > 5) trend = 'increasing';
    else if (difference < -5) trend = 'decreasing';
    else trend = 'stable';
  }
  
  // Upsert engagement profile
  await nurturingDB.exec`
    INSERT INTO prospect_engagement_profile (
      prospect_id, client_id, total_score, email_engagement_score, 
      response_rate, engagement_trend, last_engagement_at, updated_at
    )
    VALUES (
      ${prospectId}, ${clientId}, ${Math.round(metrics?.avg_score || 0)}, 
      ${Math.round(metrics ? (metrics.email_behaviors / Math.max(1, metrics.total_behaviors)) * 100 : 0)},
      ${Math.round(responseRate)}, ${trend}, ${metrics?.last_behavior}, CURRENT_TIMESTAMP
    )
    ON CONFLICT (prospect_id) DO UPDATE SET
      total_score = EXCLUDED.total_score,
      email_engagement_score = EXCLUDED.email_engagement_score,
      response_rate = EXCLUDED.response_rate,
      engagement_trend = EXCLUDED.engagement_trend,
      last_engagement_at = EXCLUDED.last_engagement_at,
      updated_at = CURRENT_TIMESTAMP
  `;
}

// Create AI analysis prompt based on type
function createAnalysisPrompt(
  analysisType: string, 
  profile: any, 
  behaviors: any[], 
  context?: Record<string, any>
): string {
  const basePrompt = `
You are an expert sales engagement analyst. Analyze the following prospect data and provide actionable insights.

Prospect Engagement Profile:
${JSON.stringify(profile, null, 2)}

Recent Behaviors (last 20):
${JSON.stringify(behaviors, null, 2)}

Additional Context:
${JSON.stringify(context || {}, null, 2)}
`;

  switch (analysisType) {
    case 'engagement_prediction':
      return basePrompt + `
Analysis Type: Engagement Prediction

Please analyze this prospect's engagement patterns and predict:
1. Likelihood of responding to next outreach (0-100%)
2. Best time/day to reach out
3. Recommended communication channel
4. Content topics most likely to resonate

Format your response as:
RECOMMENDATIONS: [list of 3-5 specific recommendations]
CONFIDENCE: [0-100 confidence score]
REASONING: [explanation of analysis]
ACTIONS: [specific next steps to take]
DATA: [any relevant metrics or insights in JSON format]
`;

    case 'content_optimization':
      return basePrompt + `
Analysis Type: Content Optimization

Based on this prospect's behavior patterns, recommend:
1. Content topics that would most engage them
2. Optimal content format (long/short, formal/casual)
3. Key pain points to address
4. Call-to-action strategies

Format your response as:
RECOMMENDATIONS: [list of content optimization suggestions]
CONFIDENCE: [0-100 confidence score]
REASONING: [explanation of why these recommendations]
ACTIONS: [specific content creation steps]
DATA: [relevant insights in JSON format]
`;

    case 'timing_optimization':
      return basePrompt + `
Analysis Type: Timing Optimization

Analyze when this prospect is most likely to engage:
1. Optimal send times (hour of day)
2. Best days of the week
3. Recommended frequency of outreach
4. Timing patterns in their behavior

Format your response as:
RECOMMENDATIONS: [timing optimization suggestions]
CONFIDENCE: [0-100 confidence score]
REASONING: [explanation of timing analysis]
ACTIONS: [specific scheduling recommendations]
DATA: [timing insights in JSON format]
`;

    default:
      return basePrompt + `
Provide general engagement analysis and recommendations.
`;
  }
}

// Parse AI analysis response
function parseAnalysisResponse(content: string): AIAnalysisResponse {
  const sections = content.split('\n');
  let recommendations: string[] = [];
  let confidence_score = 70;
  let reasoning = '';
  let suggested_actions: string[] = [];
  let data: Record<string, any> = {};
  
  let currentSection = '';
  
  for (const line of sections) {
    if (line.startsWith('RECOMMENDATIONS:')) {
      currentSection = 'recommendations';
      const text = line.replace('RECOMMENDATIONS:', '').trim();
      if (text) recommendations.push(text);
    } else if (line.startsWith('CONFIDENCE:')) {
      const confMatch = line.match(/(\d+)/);
      if (confMatch) confidence_score = parseInt(confMatch[1]);
    } else if (line.startsWith('REASONING:')) {
      currentSection = 'reasoning';
      reasoning = line.replace('REASONING:', '').trim();
    } else if (line.startsWith('ACTIONS:')) {
      currentSection = 'actions';
      const text = line.replace('ACTIONS:', '').trim();
      if (text) suggested_actions.push(text);
    } else if (line.startsWith('DATA:')) {
      try {
        const jsonText = line.replace('DATA:', '').trim();
        data = JSON.parse(jsonText);
      } catch (e) {
        data = { raw: line.replace('DATA:', '').trim() };
      }
    } else if (line.trim() && currentSection) {
      if (currentSection === 'recommendations') {
        recommendations.push(line.trim());
      } else if (currentSection === 'reasoning') {
        reasoning += '\n' + line;
      } else if (currentSection === 'actions') {
        suggested_actions.push(line.trim());
      }
    }
  }
  
  return {
    recommendations: recommendations.filter(r => r.length > 0),
    confidence_score,
    reasoning: reasoning.trim(),
    suggested_actions: suggested_actions.filter(a => a.length > 0),
    data
  };
}