import { api } from "encore.dev/api";
import { CRM } from "./db";
import type { 
  Activity, 
  ConversationAnalysis, 
  AnalyzeConversationRequest,
  SentimentScore 
} from "./types";

export const analyzeConversation = api(
  { method: "POST", path: "/ai-crm/conversations/analyze", expose: true },
  async (req: AnalyzeConversationRequest): Promise<ConversationAnalysis> => {
    const activity = await CRM.queryRow`
      SELECT * FROM activities WHERE id = ${req.activity_id}
    ` as Activity;

    if (!activity) {
      throw new Error("Activity not found");
    }

    const analysis = await performAIAnalysis(
      req.transcript || activity.description || '', 
      req.context || ''
    );

    const conversationAnalysis = await CRM.queryRow`
      INSERT INTO conversation_analysis (
        activity_id, transcript, summary, sentiment,
        key_points, action_items, objections, buying_signals,
        next_steps, ai_score
      ) VALUES (
        ${req.activity_id}, ${req.transcript || null}, ${analysis.summary},
        ${analysis.sentiment}, ${analysis.keyPoints}, ${analysis.actionItems},
        ${analysis.objections}, ${analysis.buyingSignals}, ${analysis.nextSteps},
        ${analysis.score}
      )
      RETURNING *
    `;

    await CRM.exec`
      UPDATE activities 
      SET 
        ai_sentiment = ${analysis.sentiment},
        ai_key_topics = ${analysis.keyPoints},
        ai_action_items = ${analysis.actionItems},
        updated_at = NOW()
      WHERE id = ${req.activity_id}
    `;

    return conversationAnalysis as ConversationAnalysis;
  }
);

interface ConversationAnalysisResponse {
  analysis: ConversationAnalysis | null;
}

export const getConversationAnalysis = api(
  { method: "GET", path: "/ai-crm/conversations/:activityId/analysis", expose: true },
  async ({ activityId }: { activityId: string }): Promise<ConversationAnalysisResponse> => {
    const analysis = await CRM.queryRow`
      SELECT * FROM conversation_analysis WHERE activity_id = ${activityId}
    `;

    return { analysis: analysis as ConversationAnalysis | null };
  }
);

export const analyzeSentimentBatch = api(
  { method: "POST", path: "/ai-crm/conversations/analyze-sentiment-batch", expose: true },
  async ({ activityIds }: { activityIds: string[] }): Promise<{ processed: number; errors: number }> => {
    let processed = 0;
    let errors = 0;

    for (const activityId of activityIds) {
      try {
        const activity = await CRM.queryRow`
          SELECT * FROM activities WHERE id = ${activityId}
        ` as Activity;

        if (activity && activity.description) {
          const sentiment = await analyzeSentiment(activity.description);
          
          await CRM.exec`
            UPDATE activities 
            SET ai_sentiment = ${sentiment}, updated_at = NOW()
            WHERE id = ${activityId}
          `;
          processed++;
        }
      } catch (error) {
        console.error(`Error analyzing sentiment for activity ${activityId}:`, error);
        errors++;
      }
    }

    return { processed, errors };
  }
);

export const getConversationInsights = api(
  { method: "GET", path: "/ai-crm/conversations/insights", expose: true },
  async ({ 
    entityType, 
    entityId, 
    limit = 10 
  }: { 
    entityType?: 'lead' | 'contact' | 'deal'; 
    entityId?: string; 
    limit?: number; 
  }) => {
    let query = `
      SELECT ca.*, a.type as activity_type, a.subject, a.created_at as activity_date
      FROM conversation_analysis ca
      JOIN activities a ON ca.activity_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (entityType && entityId) {
      query += ` AND a.${entityType}_id = $${paramIndex}`;
      params.push(entityId);
      paramIndex++;
    }

    query += ` ORDER BY ca.ai_score DESC, ca.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const insights = await CRM.rawQueryAll(query, ...params);
    return insights;
  }
);

export const getSentimentTrends = api(
  { method: "GET", path: "/ai-crm/conversations/sentiment-trends", expose: true },
  async ({ 
    entityType, 
    entityId, 
    days = 30 
  }: { 
    entityType?: 'lead' | 'contact' | 'deal'; 
    entityId?: string; 
    days?: number; 
  }) => {
    let query = `
      SELECT 
        ai_sentiment,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM activities
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND ai_sentiment IS NOT NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (entityType && entityId) {
      query += ` AND ${entityType}_id = $${paramIndex}`;
      params.push(entityId);
      paramIndex++;
    }

    query += ` GROUP BY ai_sentiment, DATE(created_at) ORDER BY date DESC`;

    const trends = await CRM.queryAll(query, ...params);
    return trends;
  }
);

async function performAIAnalysis(content: string, context: string) {
  const sentiment = await analyzeSentiment(content);
  const keyPoints = extractKeyPoints(content);
  const actionItems = extractActionItems(content);
  const objections = extractObjections(content);
  const buyingSignals = extractBuyingSignals(content);
  const nextSteps = extractNextSteps(content);
  const score = calculateConversationScore(content, sentiment, buyingSignals.length, objections.length);
  const summary = generateSummary(content, keyPoints);

  return {
    summary,
    sentiment,
    keyPoints,
    actionItems,
    objections,
    buyingSignals,
    nextSteps,
    score
  };
}

async function analyzeSentiment(content: string): Promise<SentimentScore> {
  const positiveWords = ['great', 'excellent', 'perfect', 'love', 'amazing', 'interested', 'excited', 'yes', 'absolutely', 'definitely'];
  const negativeWords = ['terrible', 'awful', 'hate', 'no', 'never', 'impossible', 'wrong', 'bad', 'disappointed', 'frustrated'];
  const veryPositiveWords = ['fantastic', 'outstanding', 'incredible', 'phenomenal', 'revolutionary'];
  const veryNegativeWords = ['horrible', 'disgusting', 'useless', 'waste', 'scam'];

  const words = content.toLowerCase().split(/\s+/);
  let positiveScore = 0;
  let negativeScore = 0;

  words.forEach(word => {
    if (veryPositiveWords.includes(word)) positiveScore += 2;
    else if (positiveWords.includes(word)) positiveScore += 1;
    else if (veryNegativeWords.includes(word)) negativeScore += 2;
    else if (negativeWords.includes(word)) negativeScore += 1;
  });

  const totalScore = positiveScore - negativeScore;
  
  if (totalScore >= 3) return 'very_positive';
  if (totalScore >= 1) return 'positive';
  if (totalScore <= -3) return 'very_negative';
  if (totalScore <= -1) return 'negative';
  return 'neutral';
}

function extractKeyPoints(content: string): string[] {
  const keyPhrases = [
    /budget.*?\$[\d,]+/gi,
    /timeline.*?(\d+\s+(?:days?|weeks?|months?))/gi,
    /decision.*?maker/gi,
    /competitor.*?(\w+)/gi,
    /feature.*?request/gi,
    /pain.*?point/gi,
    /requirement.*?(\w+)/gi
  ];

  const points: string[] = [];
  keyPhrases.forEach(phrase => {
    const matches = content.match(phrase);
    if (matches) {
      points.push(...matches);
    }
  });

  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  const importantSentences = sentences.filter(sentence => 
    sentence.toLowerCase().includes('need') ||
    sentence.toLowerCase().includes('want') ||
    sentence.toLowerCase().includes('problem') ||
    sentence.toLowerCase().includes('solution') ||
    sentence.toLowerCase().includes('budget') ||
    sentence.toLowerCase().includes('timeline')
  );

  return [...points, ...importantSentences.slice(0, 3)];
}

function extractActionItems(content: string): string[] {
  const actionPhrases = [
    /(?:will|should|need to|must)\s+([^.!?]+)/gi,
    /(?:follow up|schedule|send|call|email)\s+([^.!?]+)/gi,
    /(?:next step|action item|todo)\s*:?\s*([^.!?]+)/gi
  ];

  const actions: string[] = [];
  actionPhrases.forEach(phrase => {
    const matches = content.match(phrase);
    if (matches) {
      actions.push(...matches.map(match => match.trim()));
    }
  });

  return actions.slice(0, 5);
}

function extractObjections(content: string): string[] {
  const objectionPhrases = [
    /(?:but|however|concern|worry|problem)\s+([^.!?]+)/gi,
    /(?:too expensive|can't afford|no budget)/gi,
    /(?:not ready|need more time|think about)/gi,
    /(?:already have|current solution)/gi
  ];

  const objections: string[] = [];
  objectionPhrases.forEach(phrase => {
    const matches = content.match(phrase);
    if (matches) {
      objections.push(...matches.map(match => match.trim()));
    }
  });

  return objections.slice(0, 3);
}

function extractBuyingSignals(content: string): string[] {
  const buyingSignals = [
    /(?:when can|how soon|what's the price|cost|pricing)/gi,
    /(?:demo|trial|pilot|test)/gi,
    /(?:contract|agreement|proposal|quote)/gi,
    /(?:approve|budget|purchase|buy)/gi,
    /(?:decision maker|authority|sign off)/gi
  ];

  const signals: string[] = [];
  buyingSignals.forEach(phrase => {
    const matches = content.match(phrase);
    if (matches) {
      signals.push(...matches.map(match => match.trim()));
    }
  });

  return signals.slice(0, 5);
}

function extractNextSteps(content: string): string[] {
  const nextStepPhrases = [
    /(?:next|follow up|schedule)\s+([^.!?]+)/gi,
    /(?:will\s+(?:send|call|email|provide))\s+([^.!?]+)/gi,
    /(?:let's|we should|I'll)\s+([^.!?]+)/gi
  ];

  const steps: string[] = [];
  nextStepPhrases.forEach(phrase => {
    const matches = content.match(phrase);
    if (matches) {
      steps.push(...matches.map(match => match.trim()));
    }
  });

  return steps.slice(0, 3);
}

function calculateConversationScore(content: string, sentiment: SentimentScore, buyingSignals: number, objections: number): number {
  let score = 50; // Base score

  // Sentiment impact
  switch (sentiment) {
    case 'very_positive': score += 30; break;
    case 'positive': score += 15; break;
    case 'neutral': score += 0; break;
    case 'negative': score -= 15; break;
    case 'very_negative': score -= 30; break;
  }

  // Buying signals boost
  score += buyingSignals * 10;

  // Objections penalty
  score -= objections * 5;

  // Content quality
  if (content.length > 500) score += 10;
  if (content.length > 1000) score += 5;

  return Math.min(100, Math.max(0, score));
}

function generateSummary(content: string, keyPoints: string[]): string {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  const firstSentence = sentences[0] || '';
  const lastSentence = sentences[sentences.length - 1] || '';
  
  let summary = `${firstSentence}`;
  
  if (keyPoints.length > 0) {
    summary += ` Key discussion points included: ${keyPoints.slice(0, 2).join(', ')}.`;
  }
  
  if (lastSentence && lastSentence !== firstSentence) {
    summary += ` ${lastSentence}`;
  }

  return summary.length > 300 ? summary.substring(0, 297) + '...' : summary;
}