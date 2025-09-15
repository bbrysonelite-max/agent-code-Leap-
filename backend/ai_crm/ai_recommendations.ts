import { api } from "encore.dev/api";
import { CRM } from "./db";
import type { 
  NextBestAction, 
  AIInsight, 
  GetInsightsRequest,
  Lead,
  Contact,
  Deal,
  Activity,
  Priority
} from "./types";

interface GenerateRecommendationsRequest {
  entity_type: 'lead' | 'contact' | 'deal';
  entity_id: string;
}

interface GenerateRecommendationsResponse {
  recommendations: NextBestAction[];
}

export const generateRecommendations = api(
  { method: "POST", path: "/ai-crm/recommendations/generate", expose: true },
  async (req: GenerateRecommendationsRequest): Promise<GenerateRecommendationsResponse> => {
    let recommendations: NextBestAction[];
    
    switch (req.entity_type) {
      case 'lead':
        recommendations = await generateLeadRecommendations(req.entity_id);
        break;
      case 'contact':
        recommendations = await generateContactRecommendations(req.entity_id);
        break;
      case 'deal':
        recommendations = await generateDealRecommendations(req.entity_id);
        break;
      default:
        throw new Error("Invalid entity type");
    }
    
    return { recommendations };
  }
);

export const getAIInsights = api(
  { method: "GET", path: "/ai-crm/insights", expose: true },
  async (req: GetInsightsRequest) => {
    let query = `
      SELECT * FROM ai_insights 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (req.entity_type) {
      query += ` AND entity_type = $${paramIndex}`;
      params.push(req.entity_type);
      paramIndex++;
    }

    if (req.entity_id) {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(req.entity_id);
      paramIndex++;
    }

    if (req.insight_type) {
      query += ` AND insight_type = $${paramIndex}`;
      params.push(req.insight_type);
      paramIndex++;
    }

    if (req.only_actionable) {
      query += ` AND actionable = true`;
    }

    query += ` AND (expires_at IS NULL OR expires_at > NOW())`;
    query += ` ORDER BY priority ASC, confidence_score DESC, created_at DESC`;
    
    if (req.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(req.limit);
    }

    const insights = await CRM.queryRows(query, ...params);
    return insights as AIInsight[];
  }
);

export const createAIInsight = api(
  { method: "POST", path: "/ai-crm/insights", expose: true },
  async ({
    entity_type,
    entity_id,
    insight_type,
    title,
    description,
    confidence_score,
    actionable = true,
    priority = 'medium',
    expires_at
  }: {
    entity_type: 'lead' | 'contact' | 'deal' | 'activity';
    entity_id: string;
    insight_type: string;
    title: string;
    description: string;
    confidence_score: number;
    actionable?: boolean;
    priority?: Priority;
    expires_at?: Date;
  }): Promise<AIInsight> => {
    const insight = await CRM.queryRow`
      INSERT INTO ai_insights (
        entity_type, entity_id, insight_type, title, description,
        confidence_score, actionable, priority, expires_at
      ) VALUES (
        ${entity_type}, ${entity_id}, ${insight_type}, ${title}, ${description},
        ${confidence_score}, ${actionable}, ${priority}, ${expires_at || null}
      )
      RETURNING *
    `;

    return insight as AIInsight;
  }
);

export const markInsightActedUpon = api(
  { method: "PUT", path: "/ai-crm/insights/:id/acted-upon", expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    const result = await CRM.exec`
      UPDATE ai_insights 
      SET acted_upon = true 
      WHERE id = ${id}
    `;

    return { success: result.rowCount > 0 };
  }
);

export const getDashboardInsights = api(
  { method: "GET", path: "/ai-crm/insights/dashboard", expose: true },
  async ({ limit = 10 }: { limit?: number }) => {
    const insights = await CRM.queryRows`
      SELECT ai.*, 
             CASE 
               WHEN ai.entity_type = 'lead' THEN l.name
               WHEN ai.entity_type = 'contact' THEN c.name
               WHEN ai.entity_type = 'deal' THEN d.name
               ELSE 'Unknown'
             END as entity_name
      FROM ai_insights ai
      LEFT JOIN leads l ON ai.entity_type = 'lead' AND ai.entity_id = l.id
      LEFT JOIN contacts c ON ai.entity_type = 'contact' AND ai.entity_id = c.id
      LEFT JOIN deals d ON ai.entity_type = 'deal' AND ai.entity_id = d.id
      WHERE ai.actionable = true 
        AND ai.acted_upon = false
        AND (ai.expires_at IS NULL OR ai.expires_at > NOW())
      ORDER BY 
        CASE ai.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        ai.confidence_score DESC,
        ai.created_at DESC
      LIMIT ${limit}
    `;

    return insights;
  }
);

export const getRecommendationsByPriority = api(
  { method: "GET", path: "/ai-crm/recommendations/priority/:priority", expose: true },
  async ({ priority, limit = 20 }: { priority: string; limit?: number }) => {
    const recommendations: NextBestAction[] = [];

    const highScoreLeads = await CRM.queryRows`
      SELECT * FROM leads 
      WHERE ai_score >= 70 AND status = 'new'
      ORDER BY ai_score DESC 
      LIMIT 5
    `;

    for (const lead of highScoreLeads as Lead[]) {
      recommendations.push({
        entity_type: 'lead',
        entity_id: lead.id,
        action: `Follow up with high-scoring lead: ${lead.name}`,
        reasoning: `AI score: ${lead.ai_score}. High potential for conversion.`,
        priority: lead.ai_score > 85 ? 'urgent' : 'high',
        estimated_impact: lead.ai_score,
        confidence: 85
      });
    }

    const stalledDeals = await CRM.queryRows`
      SELECT d.*, c.name as contact_name
      FROM deals d
      JOIN contacts c ON d.contact_id = c.id
      WHERE d.stage NOT IN ('closed_won', 'closed_lost')
        AND d.updated_at < NOW() - INTERVAL '7 days'
      ORDER BY d.value DESC
      LIMIT 5
    `;

    for (const deal of stalledDeals) {
      recommendations.push({
        entity_type: 'deal',
        entity_id: deal.id,
        action: `Re-engage stalled deal: ${deal.name}`,
        reasoning: `Deal worth $${deal.value} hasn't been updated in 7+ days`,
        priority: deal.value > 10000 ? 'high' : 'medium',
        estimated_impact: Math.min(90, deal.value / 1000),
        confidence: 75,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      });
    }

    return { recommendations: recommendations.filter(r => r.priority === priority).slice(0, limit) };
  }
);

async function generateLeadRecommendations(leadId: string): Promise<NextBestAction[]> {
  const lead = await CRM.queryRow`
    SELECT * FROM leads WHERE id = ${leadId}
  ` as Lead;

  if (!lead) {
    throw new Error("Lead not found");
  }

  const recommendations: NextBestAction[] = [];

  if (lead.ai_score >= 80 && lead.status === 'new') {
    recommendations.push({
      entity_type: 'lead',
      entity_id: leadId,
      action: 'Schedule immediate qualification call',
      reasoning: `Extremely high AI score (${lead.ai_score}) indicates strong buying intent`,
      priority: 'urgent',
      estimated_impact: 95,
      confidence: 90,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  }

  if (!lead.phone && lead.ai_score > 60) {
    recommendations.push({
      entity_type: 'lead',
      entity_id: leadId,
      action: 'Research and add phone number',
      reasoning: 'Phone contact increases conversion rate by 40%',
      priority: 'medium',
      estimated_impact: 40,
      confidence: 75
    });
  }

  const activityCount = await CRM.queryRow`
    SELECT COUNT(*) as count FROM activities WHERE lead_id = ${leadId}
  `;

  if ((activityCount?.count || 0) === 0 && lead.ai_score > 50) {
    recommendations.push({
      entity_type: 'lead',
      entity_id: leadId,
      action: 'Send personalized introduction email',
      reasoning: 'No previous contact attempts recorded',
      priority: 'high',
      estimated_impact: 60,
      confidence: 85
    });
  }

  const daysSinceCreated = Math.floor((Date.now() - lead.created_at.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceCreated > 14 && lead.status === 'new') {
    recommendations.push({
      entity_type: 'lead',
      entity_id: leadId,
      action: 'Update lead status or archive',
      reasoning: `Lead has been in 'new' status for ${daysSinceCreated} days`,
      priority: 'low',
      estimated_impact: 20,
      confidence: 60
    });
  }

  await generateAndStoreInsights('lead', leadId, recommendations);
  return recommendations;
}

async function generateContactRecommendations(contactId: string): Promise<NextBestAction[]> {
  const contact = await CRM.queryRow`
    SELECT * FROM contacts WHERE id = ${contactId}
  ` as Contact;

  if (!contact) {
    throw new Error("Contact not found");
  }

  const recommendations: NextBestAction[] = [];

  const lastActivity = await CRM.queryRow`
    SELECT * FROM activities 
    WHERE contact_id = ${contactId}
    ORDER BY created_at DESC
    LIMIT 1
  ` as Activity;

  if (lastActivity) {
    const daysSinceLastActivity = Math.floor((Date.now() - lastActivity.created_at.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastActivity > 30) {
      recommendations.push({
        entity_type: 'contact',
        entity_id: contactId,
        action: 'Schedule re-engagement call',
        reasoning: `No contact activity for ${daysSinceLastActivity} days`,
        priority: 'medium',
        estimated_impact: 50,
        confidence: 70
      });
    }

    if (lastActivity.ai_sentiment === 'positive' || lastActivity.ai_sentiment === 'very_positive') {
      recommendations.push({
        entity_type: 'contact',
        entity_id: contactId,
        action: 'Follow up on positive interaction',
        reasoning: 'Last conversation had positive sentiment - capitalize on momentum',
        priority: 'high',
        estimated_impact: 75,
        confidence: 85
      });
    }
  }

  const openDeals = await CRM.queryRows`
    SELECT * FROM deals 
    WHERE contact_id = ${contactId} 
      AND stage NOT IN ('closed_won', 'closed_lost')
  `;

  if (openDeals.length === 0 && contact.type === 'prospect') {
    recommendations.push({
      entity_type: 'contact',
      entity_id: contactId,
      action: 'Create new sales opportunity',
      reasoning: 'Prospect has no active deals - identify potential opportunities',
      priority: 'medium',
      estimated_impact: 60,
      confidence: 70
    });
  }

  await generateAndStoreInsights('contact', contactId, recommendations);
  return recommendations;
}

async function generateDealRecommendations(dealId: string): Promise<NextBestAction[]> {
  const deal = await CRM.queryRow`
    SELECT d.*, c.name as contact_name, c.email as contact_email
    FROM deals d
    JOIN contacts c ON d.contact_id = c.id
    WHERE d.id = ${dealId}
  ` as Deal & { contact_name: string; contact_email: string };

  if (!deal) {
    throw new Error("Deal not found");
  }

  const recommendations: NextBestAction[] = [];

  if (deal.ai_win_probability < 30 && deal.stage !== 'closed_lost') {
    recommendations.push({
      entity_type: 'deal',
      entity_id: dealId,
      action: 'Address identified risk factors',
      reasoning: `Low win probability (${deal.ai_win_probability}%) - review and address concerns`,
      priority: 'high',
      estimated_impact: 70,
      confidence: 80
    });
  }

  if (deal.expected_close_date && deal.expected_close_date < new Date() && deal.stage !== 'closed_won') {
    const daysOverdue = Math.floor((Date.now() - deal.expected_close_date.getTime()) / (1000 * 60 * 60 * 24));
    recommendations.push({
      entity_type: 'deal',
      entity_id: dealId,
      action: 'Update close date or accelerate deal',
      reasoning: `Deal is ${daysOverdue} days past expected close date`,
      priority: 'urgent',
      estimated_impact: 85,
      confidence: 90
    });
  }

  const recentActivities = await CRM.queryRows`
    SELECT * FROM activities 
    WHERE deal_id = ${dealId}
    ORDER BY created_at DESC
    LIMIT 3
  `;

  if (recentActivities.length === 0) {
    recommendations.push({
      entity_type: 'deal',
      entity_id: dealId,
      action: 'Schedule check-in call',
      reasoning: 'No recent activity on this deal',
      priority: 'medium',
      estimated_impact: 50,
      confidence: 75
    });
  }

  if (deal.stage === 'proposal' || deal.stage === 'negotiation') {
    recommendations.push({
      entity_type: 'deal',
      entity_id: dealId,
      action: 'Prepare for deal closure',
      reasoning: 'Deal is in advanced stage - focus on closing activities',
      priority: 'high',
      estimated_impact: 80,
      confidence: 85
    });
  }

  await generateAndStoreInsights('deal', dealId, recommendations);
  return recommendations;
}

async function generateAndStoreInsights(
  entityType: 'lead' | 'contact' | 'deal',
  entityId: string,
  recommendations: NextBestAction[]
) {
  for (const rec of recommendations) {
    try {
      await CRM.exec`
        INSERT INTO ai_insights (
          entity_type, entity_id, insight_type, title, description,
          confidence_score, actionable, priority
        ) VALUES (
          ${entityType}, ${entityId}, 'next_action', ${rec.action},
          ${rec.reasoning}, ${rec.confidence}, true, ${rec.priority}
        )
        ON CONFLICT (entity_type, entity_id, insight_type, title) 
        DO UPDATE SET 
          description = EXCLUDED.description,
          confidence_score = EXCLUDED.confidence_score,
          priority = EXCLUDED.priority,
          created_at = NOW()
      `;
    } catch (error) {
      console.error('Error storing insight:', error);
    }
  }
}