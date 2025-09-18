import { api, Header } from "encore.dev/api";
import { db } from "./db";
import { calculateProspectScore } from "./algorithm";
import { ScoreAnalysisRequest, ProspectScore } from "./types";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync } from "../shared/errors";
import { withEnhancedRateLimit } from "../shared/enhanced-rate-limiting-middleware";
import { retryWithAdaptiveBackoff } from "../shared/intelligent-backoff";

export const scoreProspect = api(
  { expose: true, method: "POST", path: "/scoring/prospect" },
  wrapAsync(async (
    req: ScoreAnalysisRequest,
    userAgent?: Header<"user-agent">,
    forwardedFor?: Header<"x-forwarded-for">
  ) => {
    // Enhanced rate limiting for scoring operations
    await withEnhancedRateLimit({
      identifier: `scoring_${req.prospectId}`,
      endpoint: "/scoring/prospect",
      method: "POST",
      userTier: "basic"
    }, userAgent, forwardedFor);
    
    validateField(req.prospectId, "prospectId", [Rules.required(), Rules.minLength(1)]);

    const score = calculateProspectScore(req.factors);
    score.prospectId = req.prospectId;

    await retryWithAdaptiveBackoff(
      () => db.exec`
        INSERT INTO prospect_scores (
          prospect_id, total_score, company_score, position_score, 
          linkedin_score, email_engagement_score, priority, reasons
        ) VALUES (
          ${req.prospectId}, ${score.totalScore}, ${score.companyScore},
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
      `,
      "/scoring/prospect",
      "POST",
      { requestId: `score_${req.prospectId}` }
    );

    await db.exec`
      INSERT INTO scoring_factors (
        prospect_id, company_size, company_revenue, company_industry,
        position, seniority, linkedin_connections, linkedin_activity,
        email_open_rate, email_click_rate, email_replies, last_email_engagement
      ) VALUES (
        ${req.prospectId}, ${req.factors.companySize || null}, 
        ${req.factors.companyRevenue || null}, ${req.factors.companyIndustry || null},
        ${req.factors.position || null}, ${req.factors.seniority || null},
        ${req.factors.linkedinConnections || null}, ${req.factors.linkedinActivity || null},
        ${req.factors.emailOpenRate || null}, ${req.factors.emailClickRate || null},
        ${req.factors.emailReplies || null}, ${req.factors.lastEmailEngagement || null}
      )
      ON CONFLICT (prospect_id) DO UPDATE SET
        company_size = EXCLUDED.company_size,
        company_revenue = EXCLUDED.company_revenue,
        company_industry = EXCLUDED.company_industry,
        position = EXCLUDED.position,
        seniority = EXCLUDED.seniority,
        linkedin_connections = EXCLUDED.linkedin_connections,
        linkedin_activity = EXCLUDED.linkedin_activity,
        email_open_rate = EXCLUDED.email_open_rate,
        email_click_rate = EXCLUDED.email_click_rate,
        email_replies = EXCLUDED.email_replies,
        last_email_engagement = EXCLUDED.last_email_engagement,
        updated_at = CURRENT_TIMESTAMP
    `;

    return score;
  })
);