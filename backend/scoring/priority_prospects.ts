import { api } from "encore.dev/api";
import { db } from "./db";
import { TopProspectsRequest, PriorityRecommendation } from "./types";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync } from "../shared/errors";

export interface TopProspectsResponse {
  prospects: PriorityRecommendation[];
}

export const getTopProspects = api<TopProspectsRequest, TopProspectsResponse>(
  { expose: true, method: "GET", path: "/scoring/top-prospects" },
  wrapAsync(async (req) => {
    const limit = req.limit || 20;
    const minScore = req.minScore || 60;
    
    validateField(limit, "limit", [Rules.max(100), Rules.positive()]);
    validateField(minScore, "minScore", [Rules.min(0), Rules.max(100)]);

    let results;
    if (req.priority) {
      results = await db.queryAll`
        SELECT 
          ps.prospect_id,
          p.name,
          p.company,
          ps.total_score as score,
          ps.priority,
          ps.reasons,
          COALESCE(ps.total_score * 0.01, 0.5) as confidence
        FROM prospect_scores ps
        JOIN prospects p ON p.id::text = ps.prospect_id
        WHERE ps.total_score >= ${minScore} AND ps.priority = ${req.priority}
        ORDER BY ps.total_score DESC, ps.last_updated DESC
        LIMIT ${limit}
      `;
    } else {
      results = await db.queryAll`
        SELECT 
          ps.prospect_id,
          p.name,
          p.company,
          ps.total_score as score,
          ps.priority,
          ps.reasons,
          COALESCE(ps.total_score * 0.01, 0.5) as confidence
        FROM prospect_scores ps
        JOIN prospects p ON p.id::text = ps.prospect_id
        WHERE ps.total_score >= ${minScore}
        ORDER BY ps.total_score DESC, ps.last_updated DESC
        LIMIT ${limit}
      `;
    }

    const resultArray = [];
    for await (const row of results) {
      resultArray.push(row);
    }

    const prospects = resultArray.map((row: any) => ({
      prospectId: row.prospect_id,
      name: row.name,
      company: row.company || 'Unknown Company',
      score: row.score,
      priority: row.priority,
      reasons: JSON.parse(row.reasons || '[]'),
      nextAction: getNextAction(row.score, row.priority),
      confidence: row.confidence,
    }));

    return { prospects };
  })
);

function getNextAction(score: number, priority: string): string {
  if (priority === 'high' && score >= 85) {
    return "Schedule immediate personalized outreach";
  } else if (priority === 'high') {
    return "Send high-priority email template";
  } else if (priority === 'medium' && score >= 70) {
    return "Add to weekly outreach campaign";
  } else if (priority === 'medium') {
    return "Include in nurture sequence";
  } else {
    return "Add to long-term nurture campaign";
  }
}

export interface ProspectScoreResponse {
  prospect: PriorityRecommendation | null;
}

export const getProspectScore = api<{ prospectId: string }, ProspectScoreResponse>(
  { expose: true, method: "GET", path: "/scoring/prospect/:prospectId" },
  wrapAsync(async ({ prospectId }) => {
    validateField(prospectId, "prospectId", [Rules.required()]);

    const result = await db.queryAllRow`
      SELECT 
        ps.prospect_id,
        p.name,
        p.company,
        ps.total_score as score,
        ps.priority,
        ps.reasons,
        COALESCE(ps.total_score * 0.01, 0.5) as confidence
      FROM prospect_scores ps
      JOIN prospects p ON p.id::text = ps.prospect_id
      WHERE ps.prospect_id = ${prospectId}
    `;

    if (!result) return { prospect: null };

    const prospect = {
      prospectId: result.prospect_id,
      name: result.name,
      company: result.company || 'Unknown Company',
      score: result.score,
      priority: result.priority,
      reasons: JSON.parse(result.reasons || '[]'),
      nextAction: getNextAction(result.score, result.priority),
      confidence: result.confidence,
    };

    return { prospect };
  })
);