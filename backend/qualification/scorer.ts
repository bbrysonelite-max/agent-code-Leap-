// AI Lead Qualification Scorer
// Part of AI Lead OS - BRAIN MODULE
import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { CRM } from "../ai_crm/db";

// OpenAI API Key
const openAIKey = secret("OpenAIKey");

export interface LeadData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  industry?: string;
  companySize?: number;
  source?: string;
  linkedinUrl?: string;
  notes?: string;
}

export interface ScoreResult {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  qualification: "hot" | "warm" | "cold" | "unqualified";
  reasons: string[];
  nextBestAction: string;
  confidence: number;
}

export interface ScoringCriteria {
  // Title scoring
  targetTitles: string[];
  titleWeight: number;
  
  // Company scoring
  targetIndustries: string[];
  industryWeight: number;
  minCompanySize: number;
  maxCompanySize: number;
  companySizeWeight: number;
  
  // Contact quality
  requirePhone: boolean;
  phoneWeight: number;
  requireLinkedIn: boolean;
  linkedInWeight: number;
  
  // Source scoring
  preferredSources: string[];
  sourceWeight: number;
}

const DEFAULT_CRITERIA: ScoringCriteria = {
  targetTitles: ["CEO", "Founder", "Owner", "President", "VP", "Director", "Head", "Chief"],
  titleWeight: 25,
  targetIndustries: [],
  industryWeight: 15,
  minCompanySize: 10,
  maxCompanySize: 500,
  companySizeWeight: 15,
  requirePhone: true,
  phoneWeight: 15,
  requireLinkedIn: false,
  linkedInWeight: 10,
  preferredSources: ["referral", "website", "linkedin"],
  sourceWeight: 10,
};

// ============================================
// SCORING FUNCTIONS
// ============================================

/**
 * Score a single lead
 */
export const scoreLead = api<{ leadId: string; criteria?: Partial<ScoringCriteria> }, { result: ScoreResult }>(
  { method: "POST", path: "/qualification/score/:leadId", expose: true },
  async (req) => {
    // Get lead data
    const lead = await CRM.queryRow<LeadData>`
      SELECT id, name, email, phone, company, position, source, linkedin_profile as "linkedinUrl", notes
      FROM leads WHERE id = ${req.leadId}
    `;

    if (!lead) {
      throw new Error("Lead not found");
    }

    const criteria = { ...DEFAULT_CRITERIA, ...req.criteria };
    const result = calculateScore(lead, criteria);

    // Update lead with score
    await CRM.exec`
      UPDATE leads SET 
        ai_score = ${result.score},
        ai_qualification = ${result.qualification},
        next_best_action = ${result.nextBestAction},
        priority = ${result.qualification === 'hot' ? 'urgent' : result.qualification === 'warm' ? 'high' : result.qualification === 'cold' ? 'medium' : 'low'},
        updated_at = NOW()
      WHERE id = ${req.leadId}
    `;

    return { result };
  }
);

/**
 * Bulk score multiple leads
 */
export const bulkScoreLeads = api<{ leadIds?: string[]; criteria?: Partial<ScoringCriteria> }, { scored: number; results: Record<string, ScoreResult> }>(
  { method: "POST", path: "/qualification/bulk-score", expose: true },
  async (req) => {
    let leads: LeadData[];
    
    if (req.leadIds && req.leadIds.length > 0) {
      // Score specific leads
      leads = [];
      for (const id of req.leadIds) {
        const lead = await CRM.queryRow<LeadData>`
          SELECT id, name, email, phone, company, position, source, linkedin_profile as "linkedinUrl", notes
          FROM leads WHERE id = ${id}
        `;
        if (lead) leads.push(lead);
      }
    } else {
      // Score all unscored leads
      leads = await CRM.queryAll<LeadData>`
        SELECT id, name, email, phone, company, position, source, linkedin_profile as "linkedinUrl", notes
        FROM leads WHERE ai_score = 0 OR ai_score IS NULL
        LIMIT 100
      `;
    }

    const criteria = { ...DEFAULT_CRITERIA, ...req.criteria };
    const results: Record<string, ScoreResult> = {};

    for (const lead of leads) {
      const result = calculateScore(lead, criteria);
      results[lead.id] = result;

      // Update lead
      await CRM.exec`
        UPDATE leads SET 
          ai_score = ${result.score},
          ai_qualification = ${result.qualification},
          next_best_action = ${result.nextBestAction},
          priority = ${result.qualification === 'hot' ? 'urgent' : result.qualification === 'warm' ? 'high' : result.qualification === 'cold' ? 'medium' : 'low'},
          updated_at = NOW()
        WHERE id = ${lead.id}
      `;
    }

    return { scored: leads.length, results };
  }
);

/**
 * Get scoring criteria recommendations
 */
export const getScoringInsights = api<{}, { insights: any }>(
  { method: "GET", path: "/qualification/insights", expose: true },
  async () => {
    // Get distribution of scores
    const distribution = await CRM.queryAll<{ qualification: string; count: number }>`
      SELECT ai_qualification as qualification, COUNT(*) as count
      FROM leads
      WHERE ai_qualification IS NOT NULL
      GROUP BY ai_qualification
    `;

    // Get top converting sources
    const sources = await CRM.queryAll<{ source: string; avg_score: number; count: number }>`
      SELECT source, AVG(ai_score) as avg_score, COUNT(*) as count
      FROM leads
      WHERE ai_score > 0
      GROUP BY source
      ORDER BY avg_score DESC
    `;

    // Get top titles
    const titles = await CRM.queryAll<{ position: string; avg_score: number; count: number }>`
      SELECT position, AVG(ai_score) as avg_score, COUNT(*) as count
      FROM leads
      WHERE ai_score > 0 AND position IS NOT NULL
      GROUP BY position
      ORDER BY avg_score DESC
      LIMIT 10
    `;

    return {
      insights: {
        distribution,
        topSources: sources,
        topTitles: titles,
        recommendations: generateRecommendations(distribution, sources),
      },
    };
  }
);

// ============================================
// SCORING LOGIC
// ============================================

function calculateScore(lead: LeadData, criteria: ScoringCriteria): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  let maxPossibleScore = 0;

  // Title scoring
  maxPossibleScore += criteria.titleWeight;
  if (lead.position) {
    const titleMatch = criteria.targetTitles.some(t => 
      lead.position!.toLowerCase().includes(t.toLowerCase())
    );
    if (titleMatch) {
      score += criteria.titleWeight;
      reasons.push(`✓ Decision maker title: ${lead.position}`);
    } else {
      reasons.push(`✗ Title not in target list: ${lead.position}`);
    }
  } else {
    reasons.push(`✗ No title information`);
  }

  // Company size scoring
  maxPossibleScore += criteria.companySizeWeight;
  if (lead.companySize) {
    if (lead.companySize >= criteria.minCompanySize && lead.companySize <= criteria.maxCompanySize) {
      score += criteria.companySizeWeight;
      reasons.push(`✓ Company size in range: ${lead.companySize}`);
    } else {
      const partial = criteria.companySizeWeight * 0.5;
      score += partial;
      reasons.push(`~ Company size outside ideal range: ${lead.companySize}`);
    }
  }

  // Industry scoring
  if (criteria.targetIndustries.length > 0) {
    maxPossibleScore += criteria.industryWeight;
    if (lead.industry) {
      const industryMatch = criteria.targetIndustries.some(i =>
        lead.industry!.toLowerCase().includes(i.toLowerCase())
      );
      if (industryMatch) {
        score += criteria.industryWeight;
        reasons.push(`✓ Target industry: ${lead.industry}`);
      }
    }
  }

  // Phone scoring
  maxPossibleScore += criteria.phoneWeight;
  if (lead.phone) {
    score += criteria.phoneWeight;
    reasons.push(`✓ Has phone number`);
  } else if (criteria.requirePhone) {
    reasons.push(`✗ Missing phone number (required for SMS)`);
  }

  // LinkedIn scoring
  maxPossibleScore += criteria.linkedInWeight;
  if (lead.linkedinUrl) {
    score += criteria.linkedInWeight;
    reasons.push(`✓ Has LinkedIn profile`);
  }

  // Source scoring
  maxPossibleScore += criteria.sourceWeight;
  if (lead.source && criteria.preferredSources.includes(lead.source)) {
    score += criteria.sourceWeight;
    reasons.push(`✓ Preferred source: ${lead.source}`);
  }

  // Email domain scoring (bonus)
  const emailDomain = lead.email.split("@")[1];
  if (emailDomain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(emailDomain)) {
    score += 10;
    maxPossibleScore += 10;
    reasons.push(`✓ Business email domain: ${emailDomain}`);
  }

  // Normalize score to 0-100
  const normalizedScore = Math.round((score / maxPossibleScore) * 100);
  
  // Determine grade and qualification
  const grade = getGrade(normalizedScore);
  const qualification = getQualification(normalizedScore);
  const nextBestAction = getNextBestAction(qualification, lead);

  return {
    score: normalizedScore,
    grade,
    qualification,
    reasons,
    nextBestAction,
    confidence: maxPossibleScore > 50 ? 0.8 : 0.6,
  };
}

function getGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

function getQualification(score: number): "hot" | "warm" | "cold" | "unqualified" {
  if (score >= 70) return "hot";
  if (score >= 50) return "warm";
  if (score >= 30) return "cold";
  return "unqualified";
}

function getNextBestAction(qualification: string, lead: LeadData): string {
  switch (qualification) {
    case "hot":
      return lead.phone 
        ? "Send personalized SMS + email immediately, then call within 24 hours"
        : "Send personalized email immediately with Calendly link";
    case "warm":
      return "Enroll in standard outreach sequence (email + SMS)";
    case "cold":
      return "Enroll in nurture sequence, gather more information";
    default:
      return "Archive or mark for review - does not meet criteria";
  }
}

function generateRecommendations(distribution: any[], sources: any[]): string[] {
  const recommendations: string[] = [];

  // Analyze distribution
  const total = distribution.reduce((sum, d) => sum + Number(d.count), 0);
  const hotCount = distribution.find(d => d.qualification === "hot")?.count || 0;
  const hotPercent = total > 0 ? (Number(hotCount) / total) * 100 : 0;

  if (hotPercent < 10) {
    recommendations.push("Low hot lead percentage. Consider adjusting targeting criteria or lead sources.");
  }

  if (sources.length > 0 && sources[0].avg_score > 70) {
    recommendations.push(`Focus on "${sources[0].source}" - highest average score of ${Math.round(sources[0].avg_score)}`);
  }

  return recommendations;
}

// ============================================
// AI-ENHANCED SCORING (Uses OpenAI)
// ============================================

export const aiScoreLead = api<{ leadId: string }, { result: ScoreResult }>(
  { method: "POST", path: "/qualification/ai-score/:leadId", expose: true },
  async (req) => {
    const lead = await CRM.queryRow<LeadData>`
      SELECT id, name, email, phone, company, position, source, linkedin_profile as "linkedinUrl", notes
      FROM leads WHERE id = ${req.leadId}
    `;

    if (!lead) throw new Error("Lead not found");

    try {
      const apiKey = openAIKey();
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a lead qualification expert. Score leads from 0-100 based on their likelihood to convert to a customer. Consider: title/seniority, company size, industry fit, contact quality. Return JSON only.`
            },
            {
              role: "user",
              content: `Score this lead:
Name: ${lead.name}
Email: ${lead.email}
Phone: ${lead.phone || "Not provided"}
Company: ${lead.company || "Unknown"}
Position: ${lead.position || "Unknown"}
Source: ${lead.source || "Unknown"}
Notes: ${lead.notes || "None"}

Return JSON: { "score": number, "qualification": "hot|warm|cold|unqualified", "reasons": string[], "nextBestAction": string }`
            }
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error("OpenAI API error");
      }

      const data = await response.json();
      const aiResult = JSON.parse(data.choices[0].message.content);

      const result: ScoreResult = {
        score: aiResult.score,
        grade: getGrade(aiResult.score),
        qualification: aiResult.qualification,
        reasons: aiResult.reasons,
        nextBestAction: aiResult.nextBestAction,
        confidence: 0.9,
      };

      // Update lead
      await CRM.exec`
        UPDATE leads SET 
          ai_score = ${result.score},
          ai_qualification = ${result.qualification},
          next_best_action = ${result.nextBestAction},
          priority = ${result.qualification === 'hot' ? 'urgent' : result.qualification === 'warm' ? 'high' : result.qualification === 'cold' ? 'medium' : 'low'},
          updated_at = NOW()
        WHERE id = ${req.leadId}
      `;

      return { result };
    } catch (error) {
      // Fallback to rule-based scoring
      console.warn("AI scoring failed, using rule-based:", error);
      return scoreLead({ leadId: req.leadId });
    }
  }
);
