import { api, Header } from "encore.dev/api";
import { CRM } from "./db";
import type { Lead, CreateLeadRequest, UpdateLeadRequest, NextBestAction } from "./types";
import { withEnhancedRateLimit } from "../shared/simple-rate-limiting";
import { retryWithAdaptiveBackoff } from "../shared/intelligent-backoff";

interface AIScoreResult {
  score: number;
  qualification: string;
  reasoning: string[];
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  nextBestAction: string;
}

export const scoreLeadWithAI = api(
  { method: "POST", path: "/ai-crm/leads/:id/score", expose: true },
  async (
    { id }: { id: string },
    userAgent?: Header<"user-agent">,
    forwardedFor?: Header<"x-forwarded-for">
  ): Promise<AIScoreResult> => {
    // Enhanced rate limiting for AI scoring
    await withEnhancedRateLimit({
      identifier: `ai_scoring_${id}`,
      endpoint: "/ai-crm/leads/score",
      method: "POST",
      userTier: "basic" // Default tier for AI operations
    }, userAgent, forwardedFor);
    const result = await CRM.queryRow`
      SELECT * FROM leads WHERE id = ${id}
    `;
    
    if (!result) {
      throw new Error("Lead not found");
    }

    const lead = result as Lead;
    const aiScore = await calculateAIScore(lead);
    
    await retryWithAdaptiveBackoff(
      () => CRM.exec`
        UPDATE leads 
        SET ai_score = ${aiScore.score},
            ai_qualification = ${aiScore.qualification},
            next_best_action = ${aiScore.nextBestAction},
            priority = ${aiScore.priority},
            updated_at = NOW()
        WHERE id = ${id}
      `,
      "/ai-crm/leads/score",
      "POST",
      { requestId: `score_${id}` }
    );

    return aiScore;
  }
);

export const bulkScoreLeads = api(
  { method: "POST", path: "/ai-crm/leads/bulk-score", expose: true },
  async (
    { leadIds }: { leadIds: string[] },
    userAgent?: Header<"user-agent">,
    forwardedFor?: Header<"x-forwarded-for">
  ): Promise<{ processed: number; errors: number }> => {
    // Enhanced rate limiting for bulk operations
    await withEnhancedRateLimit({
      identifier: `bulk_scoring_${leadIds.length}`,
      endpoint: "/ai-crm/leads/bulk-score",
      method: "POST",
      userTier: "premium" // Bulk operations require higher tier
    }, userAgent, forwardedFor);
    let processed = 0;
    let errors = 0;

    for (const leadId of leadIds) {
      try {
        await scoreLeadWithAI({ id: leadId });
        processed++;
      } catch (error) {
        console.error(`Error scoring lead ${leadId}:`, error);
        errors++;
      }
    }

    return { processed, errors };
  }
);

export const getTopScoredLeads = api(
  { method: "GET", path: "/ai-crm/leads/top-scored", expose: true },
  async ({ limit = 20, minScore = 70 }: { limit?: number; minScore?: number }) => {
    const leads = await CRM.queryAll`
      SELECT * FROM leads 
      WHERE ai_score >= ${minScore}
      ORDER BY ai_score DESC, priority ASC, created_at DESC
      LIMIT ${limit}
    `;

    return leads as Lead[];
  }
);

async function calculateAIScore(lead: Lead): Promise<AIScoreResult> {
  let score = 0;
  const reasoning: string[] = [];
  let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  let qualification = 'unqualified';
  let nextBestAction = 'Schedule initial call';

  if (lead.email?.includes('@gmail.com') || lead.email?.includes('@yahoo.com')) {
    score += 20;
    reasoning.push("Personal email domain (+20)");
  } else if (lead.email && !lead.email.includes('@')) {
    score -= 30;
    reasoning.push("Invalid email format (-30)");
  } else {
    score += 40;
    reasoning.push("Professional email domain (+40)");
  }

  if (lead.company) {
    score += 25;
    reasoning.push("Company information available (+25)");
    
    const companyIndicators = ['CEO', 'CTO', 'VP', 'Director', 'Manager', 'Lead'];
    if (lead.position && companyIndicators.some(indicator => 
      lead.position!.toLowerCase().includes(indicator.toLowerCase()))) {
      score += 30;
      reasoning.push("Senior position identified (+30)");
      priority = 'high';
    }
  }

  if (lead.linkedin_profile) {
    score += 15;
    reasoning.push("LinkedIn profile available (+15)");
  }

  if (lead.phone) {
    score += 10;
    reasoning.push("Phone number available (+10)");
  }

  const activityResult = await CRM.queryRow`
    SELECT COUNT(*) as activity_count 
    FROM activities 
    WHERE lead_id = ${lead.id}
  `;
  
  const activityCount = activityResult?.activity_count || 0;
  if (activityCount > 0) {
    score += Math.min(activityCount * 5, 25);
    reasoning.push(`Recent activity (${activityCount} activities) (+${Math.min(activityCount * 5, 25)})`);
  }

  if (score >= 80) {
    qualification = 'hot_lead';
    priority = 'urgent';
    nextBestAction = 'Schedule demo call immediately';
  } else if (score >= 60) {
    qualification = 'warm_lead';
    priority = 'high';
    nextBestAction = 'Send personalized follow-up email';
  } else if (score >= 40) {
    qualification = 'cold_lead';
    priority = 'medium';
    nextBestAction = 'Add to nurture campaign';
  } else {
    qualification = 'unqualified';
    priority = 'low';
    nextBestAction = 'Mark for review or disqualify';
  }

  const confidence = Math.min(95, Math.max(50, score + 10));

  return {
    score: Math.min(100, Math.max(0, score)),
    qualification,
    reasoning,
    confidence,
    priority,
    nextBestAction
  };
}

interface LeadRecommendationsResponse {
  recommendations: NextBestAction[];
}

export const getLeadRecommendations = api(
  { method: "GET", path: "/ai-crm/leads/:id/recommendations", expose: true },
  async ({ id }: { id: string }): Promise<LeadRecommendationsResponse> => {
    const lead = await CRM.queryRow`
      SELECT * FROM leads WHERE id = ${id}
    ` as Lead;

    if (!lead) {
      throw new Error("Lead not found");
    }

    const recommendations: NextBestAction[] = [];

    if (lead.ai_score >= 70 && lead.status === 'new') {
      recommendations.push({
        entity_type: 'lead',
        entity_id: id,
        action: 'Schedule immediate follow-up call',
        reasoning: 'High AI score indicates strong potential',
        priority: 'urgent',
        estimated_impact: 85,
        confidence: 90,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    if (!lead.phone && lead.ai_score > 50) {
      recommendations.push({
        entity_type: 'lead',
        entity_id: id,
        action: 'Research and find phone number',
        reasoning: 'Phone contact increases conversion rate by 40%',
        priority: 'medium',
        estimated_impact: 40,
        confidence: 75
      });
    }

    if (!lead.linkedin_profile && lead.company) {
      recommendations.push({
        entity_type: 'lead',
        entity_id: id,
        action: 'Find LinkedIn profile',
        reasoning: 'LinkedIn connection improves engagement',
        priority: 'medium',
        estimated_impact: 25,
        confidence: 80
      });
    }

    const daysSinceCreated = Math.floor((Date.now() - lead.created_at.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated > 7 && lead.status === 'new') {
      recommendations.push({
        entity_type: 'lead',
        entity_id: id,
        action: 'Update lead status or add follow-up note',
        reasoning: 'Lead has been in new status for over a week',
        priority: 'low',
        estimated_impact: 15,
        confidence: 60
      });
    }

    return { recommendations };
  }
);