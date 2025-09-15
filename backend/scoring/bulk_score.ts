import { api } from "encore.dev/api";
import { db } from "./db";
import { calculateProspectScore } from "./algorithm";
import { BulkScoreRequest, ProspectScore } from "./types";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync } from "../shared/errors";

export interface BulkScoreResponse {
  scores: ProspectScore[];
}

export const bulkScoreProspects = api<BulkScoreRequest, BulkScoreResponse>(
  { expose: true, method: "POST", path: "/scoring/bulk" },
  wrapAsync(async (req) => {
    validateField(req.prospectIds, "prospectIds", [Rules.required()]);
    validateField(req.prospectIds.length, "prospectIds.length", [Rules.max(100)]);

    const results: ProspectScore[] = [];

    for (const prospectId of req.prospectIds) {
      const factorsResult = await db.queryRow`
        SELECT * FROM scoring_factors WHERE prospect_id = ${prospectId}
      `;

      if (factorsResult) {
        const factors = {
          companySize: factorsResult.company_size,
          companyRevenue: factorsResult.company_revenue,
          companyIndustry: factorsResult.company_industry,
          position: factorsResult.position,
          seniority: factorsResult.seniority,
          linkedinConnections: factorsResult.linkedin_connections,
          linkedinActivity: factorsResult.linkedin_activity,
          emailOpenRate: factorsResult.email_open_rate,
          emailClickRate: factorsResult.email_click_rate,
          emailReplies: factorsResult.email_replies,
          lastEmailEngagement: factorsResult.last_email_engagement,
        };

        const score = calculateProspectScore(factors);
        score.prospectId = prospectId;

        await db.exec`
          INSERT INTO prospect_scores (
            prospect_id, total_score, company_score, position_score, 
            linkedin_score, email_engagement_score, priority, reasons
          ) VALUES (
            ${prospectId}, ${score.totalScore}, ${score.companyScore},
            ${score.positionScore}, ${score.linkedinScore}, ${score.emailEngagementScore},
            ${score.priority}, ${JSON.stringify(score.reasons)}
          )
          ON CONFLICT (prospect_id) DO UPDATE SET
            total_score = EXCLUDED.total_score,
            company_score = EXCLUDED.company_score,
            position_score = EXCLUDED.position_score,
            linkedin_score = EXCLUDED.linkedin_score,
            email_engagement_score = EXCLUDED.email_engagement_score,
            priority = EXCLUDED.priority,
            reasons = EXCLUDED.reasons,
            last_updated = CURRENT_TIMESTAMP
        `;

        results.push(score);
      }
    }

    return { scores: results };
  })
);