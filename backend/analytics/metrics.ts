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

    // Note: Prospects table query disabled - prospects are in a different service database
    // TODO: Implement proper cross-service data aggregation or use shared database
    // For now, returning zero values
    const totalsRow = {
      total_prospects: 0,
      contacted_prospects: 0,
      total_responses: 0,
      qualified_prospects: 0,
      converted_prospects: 0
    };

    // Note: Email campaigns query disabled - depends on prospects table from different service
    // TODO: Implement proper cross-service data aggregation
    const emailRow = { total_emails_sent: 0 };

    // Note: Daily stats query disabled - depends on prospects table from different service
    // TODO: Implement proper cross-service data aggregation
    const dailyStats: Array<{
        date: string;
        prospects_found: number;
        emails_sent: number;
        emails_opened: number;
        responses_received: number;
    }> = [];

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
