import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { analyticsDB } from "./db";
import { validateField, Rules } from "../shared/validation";
import { executeQuery } from "../shared/database";
import { wrapAsync, BusinessLogicError } from "../shared/errors";

export interface GetMetricsRequest {
  agent_id?: Query<number>;
  days?: Query<number>;
}

export interface DashboardMetrics {
  total_prospects: number;
  total_emails_sent: number;
  total_responses: number;
  qualified_prospects: number;
  converted_prospects: number;
  response_rate: number;
  conversion_rate: number;
  daily_stats: DailyStats[];
}

export interface DailyStats {
  date: string;
  prospects_found: number;
  emails_sent: number;
  emails_opened: number;
  responses_received: number;
}

// Retrieves comprehensive analytics and performance metrics.
export const getMetrics = api<GetMetricsRequest, DashboardMetrics>(
  { expose: true, method: "GET", path: "/analytics/metrics" },
  wrapAsync(async (req) => {
    // Validate input
    if (req.days !== undefined) {
      validateField(req.days, "days", [Rules.positive(), Rules.integer(), Rules.max(365)]);
    }
    
    if (req.agent_id !== undefined) {
      validateField(req.agent_id, "agent_id", [Rules.positive(), Rules.integer()]);
    }
    const days = req.days || 30;
    let agentFilter = "";
    const params: any[] = [days];
    
    if (req.agent_id) {
      agentFilter = "AND agent_id = $2";
      params.push(req.agent_id);
    }

    // Get overall totals
    const totalsQuery = `
      SELECT 
        COUNT(*) as total_prospects,
        COUNT(CASE WHEN status IN ('contacted', 'responded', 'qualified', 'converted') THEN 1 END) as contacted_prospects,
        COUNT(CASE WHEN status = 'responded' OR status = 'qualified' OR status = 'converted' THEN 1 END) as total_responses,
        COUNT(CASE WHEN status = 'qualified' OR status = 'converted' THEN 1 END) as qualified_prospects,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_prospects
      FROM prospects 
      WHERE created_at >= NOW() - INTERVAL '${days} days' ${agentFilter}
    `;

    const totalsRow = await executeQuery(
      () => analyticsDB.rawQueryRow<{
        total_prospects: number;
        contacted_prospects: number;
        total_responses: number;
        qualified_prospects: number;
        converted_prospects: number;
      }>(totalsQuery, ...(req.agent_id ? [req.agent_id] : [])),
      "fetch prospect totals"
    );

    // Get email stats
    const emailQuery = `
      SELECT COUNT(*) as total_emails_sent
      FROM email_campaigns ec
      JOIN prospects p ON ec.prospect_id = p.id
      WHERE ec.sent_at >= NOW() - INTERVAL '${days} days' ${agentFilter}
    `;

    const emailRow = await executeQuery(
      () => analyticsDB.rawQueryRow<{ total_emails_sent: number }>(
        emailQuery, 
        ...(req.agent_id ? [req.agent_id] : [])
      ),
      "fetch email stats"
    );

    // Get daily stats
    const dailyQuery = `
      SELECT 
        DATE(p.created_at) as date,
        COUNT(*) as prospects_found,
        COUNT(ec.id) as emails_sent,
        COUNT(ec.opened_at) as emails_opened,
        COUNT(CASE WHEN p.status IN ('responded', 'qualified', 'converted') THEN 1 END) as responses_received
      FROM prospects p
      LEFT JOIN email_campaigns ec ON p.id = ec.prospect_id AND ec.sent_at >= NOW() - INTERVAL '${days} days'
      WHERE p.created_at >= NOW() - INTERVAL '${days} days' ${agentFilter}
      GROUP BY DATE(p.created_at)
      ORDER BY date DESC
      LIMIT ${days}
    `;

    const dailyStats = await executeQuery(
      () => analyticsDB.rawQueryAll<{
        date: string;
        prospects_found: number;
        emails_sent: number;
        emails_opened: number;
        responses_received: number;
      }>(dailyQuery, ...(req.agent_id ? [req.agent_id] : [])),
      "fetch daily statistics"
    );

    const totals = totalsRow || {
      total_prospects: 0,
      contacted_prospects: 0,
      total_responses: 0,
      qualified_prospects: 0,
      converted_prospects: 0,
    };

    const emailTotals = emailRow || { total_emails_sent: 0 };

    const response_rate = emailTotals.total_emails_sent > 0 
      ? (totals.total_responses / emailTotals.total_emails_sent) * 100 
      : 0;

    const conversion_rate = totals.total_prospects > 0 
      ? (totals.converted_prospects / totals.total_prospects) * 100 
      : 0;

    return {
      total_prospects: totals.total_prospects,
      total_emails_sent: emailTotals.total_emails_sent,
      total_responses: totals.total_responses,
      qualified_prospects: totals.qualified_prospects,
      converted_prospects: totals.converted_prospects,
      response_rate: Math.round(response_rate * 10) / 10,
      conversion_rate: Math.round(conversion_rate * 10) / 10,
      daily_stats: dailyStats.map(stat => ({
        ...stat,
        date: new Date(stat.date).toISOString().split('T')[0],
      })),
    };
  })
);
