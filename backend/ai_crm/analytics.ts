import { api } from "encore.dev/api";
import { CRM } from "./db";
import type { PipelineAnalytics } from "./types";

export const getPipelineAnalytics = api(
  { method: "GET", path: "/ai-crm/analytics/pipeline", expose: true },
  async (): Promise<PipelineAnalytics> => {
    const [leads, contacts, deals, conversions, aiScores] = await Promise.all([
      CRM.queryRow`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'qualified') as qualified
        FROM leads
      `,
      CRM.queryRow`SELECT COUNT(*) as total FROM contacts`,
      CRM.queryRow`
        SELECT 
          COUNT(*) as active,
          COUNT(*) FILTER (WHERE stage = 'closed_won') as won,
          COUNT(*) FILTER (WHERE stage = 'closed_lost') as lost,
          SUM(value) as total_value,
          AVG(value) as avg_value
        FROM deals
      `,
      CRM.queryAll`
        SELECT 
          'lead_to_contact' as conversion_type,
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT c.id) as converted
        FROM leads l
        LEFT JOIN contacts c ON l.id = c.lead_id
        UNION ALL
        SELECT 
          'contact_to_deal' as conversion_type,
          COUNT(DISTINCT c.id) as total_contacts,
          COUNT(DISTINCT d.id) as converted
        FROM contacts c
        LEFT JOIN deals d ON c.id = d.contact_id
      `,
      CRM.queryAll`
        SELECT 
          CASE 
            WHEN ai_score >= 80 THEN 'high'
            WHEN ai_score >= 60 THEN 'medium'
            WHEN ai_score >= 40 THEN 'low'
            ELSE 'very_low'
          END as score_range,
          COUNT(*) as count
        FROM leads
        WHERE ai_score > 0
        GROUP BY score_range
      `
    ]);

    const conversionRates: Record<string, number> = {};
    for (const conv of conversions) {
      if (conv.total_leads > 0) {
        conversionRates[conv.conversion_type] = (conv.converted / conv.total_leads) * 100;
      }
    }

    const aiScoreDistribution: Record<string, number> = {};
    for (const score of aiScores) {
      aiScoreDistribution[score.score_range] = score.count;
    }

    const winRate = deals?.won && deals?.lost 
      ? (deals.won / (deals.won + deals.lost)) * 100 
      : 0;

    return {
      total_leads: leads?.total || 0,
      qualified_leads: leads?.qualified || 0,
      total_contacts: contacts?.total || 0,
      active_deals: deals?.active || 0,
      total_deal_value: deals?.total_value || 0,
      avg_deal_size: deals?.avg_value || 0,
      win_rate: winRate,
      avg_sales_cycle_days: 30,
      conversion_rates: conversionRates,
      ai_score_distribution: aiScoreDistribution
    };
  }
);

export const getActivityAnalytics = api(
  { method: "GET", path: "/ai-crm/analytics/activities", expose: true },
  async ({ days = 30 }: { days?: number }) => {
    const [byType, bySentiment, byDay] = await Promise.all([
      CRM.queryAll`
        SELECT 
          type,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed
        FROM activities
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY type
        ORDER BY count DESC
      `,
      CRM.queryAll`
        SELECT 
          ai_sentiment,
          COUNT(*) as count
        FROM activities
        WHERE created_at >= NOW() - INTERVAL '${days} days'
          AND ai_sentiment IS NOT NULL
        GROUP BY ai_sentiment
        ORDER BY count DESC
      `,
      CRM.queryAll`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as activity_count,
          COUNT(DISTINCT CASE 
            WHEN contact_id IS NOT NULL THEN contact_id
            WHEN lead_id IS NOT NULL THEN lead_id
            WHEN deal_id IS NOT NULL THEN deal_id
          END) as unique_entities
        FROM activities
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `
    ]);

    return {
      by_type: byType,
      by_sentiment: bySentiment,
      daily_trends: byDay
    };
  }
);

export const getTopPerformers = api(
  { method: "GET", path: "/ai-crm/analytics/top-performers", expose: true },
  async ({ limit = 10 }: { limit?: number }) => {
    const [topLeads, topContacts, topDeals] = await Promise.all([
      CRM.queryAll`
        SELECT 
          id, name, email, company, ai_score, status,
          (SELECT COUNT(*) FROM activities WHERE lead_id = leads.id) as activity_count
        FROM leads
        ORDER BY ai_score DESC, activity_count DESC
        LIMIT ${limit}
      `,
      CRM.queryAll`
        SELECT 
          id, name, email, company, type, lifetime_value,
          (SELECT COUNT(*) FROM activities WHERE contact_id = contacts.id) as activity_count,
          (SELECT COUNT(*) FROM deals WHERE contact_id = contacts.id) as deal_count
        FROM contacts
        ORDER BY lifetime_value DESC, deal_count DESC, activity_count DESC
        LIMIT ${limit}
      `,
      CRM.queryAll`
        SELECT 
          d.id, d.name, d.value, d.stage, d.ai_win_probability,
          c.name as contact_name, c.company as contact_company,
          (SELECT COUNT(*) FROM activities WHERE deal_id = d.id) as activity_count
        FROM deals d
        JOIN contacts c ON d.contact_id = c.id
        WHERE d.stage NOT IN ('closed_won', 'closed_lost')
        ORDER BY d.value DESC, d.ai_win_probability DESC
        LIMIT ${limit}
      `
    ]);

    return {
      top_leads: topLeads,
      top_contacts: topContacts,
      top_deals: topDeals
    };
  }
);

export const getAIInsightsAnalytics = api(
  { method: "GET", path: "/ai-crm/analytics/ai-insights", expose: true },
  async ({ days = 30 }: { days?: number }) => {
    const [byType, byPriority, actionTaken] = await Promise.all([
      CRM.queryAll`
        SELECT 
          insight_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM ai_insights
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY insight_type
        ORDER BY count DESC
      `,
      CRM.queryAll`
        SELECT 
          priority,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE acted_upon = true) as acted_upon
        FROM ai_insights
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY priority
        ORDER BY count DESC
      `,
      CRM.queryRow`
        SELECT 
          COUNT(*) as total_insights,
          COUNT(*) FILTER (WHERE acted_upon = true) as acted_upon,
          COUNT(*) FILTER (WHERE actionable = true) as actionable
        FROM ai_insights
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `
    ]);

    const actionRate = actionTaken?.total_insights 
      ? (actionTaken.acted_upon / actionTaken.total_insights) * 100 
      : 0;

    return {
      by_type: byType,
      by_priority: byPriority,
      action_rate: actionRate,
      total_insights: actionTaken?.total_insights || 0,
      actionable_insights: actionTaken?.actionable || 0
    };
  }
);