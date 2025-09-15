import { ScoringFactors, ProspectScore, ScoreWeights } from "./types";

const DEFAULT_WEIGHTS: ScoreWeights = {
  companySize: 0.20,
  companyRevenue: 0.15,
  position: 0.25,
  seniority: 0.15,
  linkedinActivity: 0.10,
  emailEngagement: 0.15,
};

const SENIORITY_SCORES: Record<string, number> = {
  'c-level': 100,
  'vp': 90,
  'director': 80,
  'manager': 70,
  'senior': 60,
  'lead': 50,
  'associate': 40,
  'coordinator': 30,
  'assistant': 20,
  'intern': 10,
};

const POSITION_KEYWORDS: Record<string, number> = {
  'ceo': 100,
  'cto': 95,
  'cfo': 95,
  'president': 90,
  'founder': 90,
  'owner': 85,
  'director': 80,
  'vp': 85,
  'vice president': 85,
  'manager': 70,
  'head': 75,
  'lead': 65,
  'senior': 60,
  'principal': 65,
  'architect': 70,
  'specialist': 50,
  'analyst': 45,
  'coordinator': 40,
  'associate': 35,
  'assistant': 25,
};

export function calculateCompanyScore(factors: ScoringFactors): number {
  let score = 0;
  const reasons: string[] = [];

  if (factors.companySize) {
    if (factors.companySize >= 1000) {
      score = 100;
      reasons.push("Large enterprise (1000+ employees)");
    } else if (factors.companySize >= 500) {
      score = 85;
      reasons.push("Mid-large company (500-999 employees)");
    } else if (factors.companySize >= 100) {
      score = 70;
      reasons.push("Medium company (100-499 employees)");
    } else if (factors.companySize >= 50) {
      score = 55;
      reasons.push("Small-medium company (50-99 employees)");
    } else if (factors.companySize >= 10) {
      score = 40;
      reasons.push("Small company (10-49 employees)");
    } else {
      score = 20;
      reasons.push("Very small company (<10 employees)");
    }
  }

  if (factors.companyRevenue) {
    const revenueBonus = Math.min(20, Math.log10(factors.companyRevenue / 1000000) * 5);
    score = Math.min(100, score + revenueBonus);
    if (factors.companyRevenue >= 100000000) {
      reasons.push("High revenue company ($100M+)");
    } else if (factors.companyRevenue >= 10000000) {
      reasons.push("Substantial revenue ($10M-$100M)");
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function calculatePositionScore(factors: ScoringFactors): number {
  let score = 0;
  const reasons: string[] = [];

  if (!factors.position) return 0;

  const position = factors.position.toLowerCase();
  
  let maxKeywordScore = 0;
  let matchedKeyword = '';
  
  for (const [keyword, keywordScore] of Object.entries(POSITION_KEYWORDS)) {
    if (position.includes(keyword)) {
      if (keywordScore > maxKeywordScore) {
        maxKeywordScore = keywordScore;
        matchedKeyword = keyword;
      }
    }
  }
  
  score = maxKeywordScore;

  if (factors.seniority) {
    const seniorityScore = SENIORITY_SCORES[factors.seniority.toLowerCase()] || 30;
    score = Math.max(score, seniorityScore);
  }

  if (position.includes('decision') || position.includes('budget') || position.includes('purchase')) {
    score = Math.min(100, score + 15);
    reasons.push("Decision-making authority");
  }

  if (position.includes('business') || position.includes('strategy') || position.includes('growth')) {
    score = Math.min(100, score + 10);
    reasons.push("Business development focus");
  }

  return Math.max(0, Math.min(100, score));
}

export function calculateLinkedInScore(factors: ScoringFactors): number {
  let score = 0;
  const reasons: string[] = [];

  if (factors.linkedinConnections) {
    if (factors.linkedinConnections >= 500) {
      score += 40;
      reasons.push("Well-connected professional (500+ connections)");
    } else if (factors.linkedinConnections >= 200) {
      score += 30;
      reasons.push("Active networker (200-499 connections)");
    } else if (factors.linkedinConnections >= 50) {
      score += 20;
      reasons.push("Moderate network (50-199 connections)");
    } else {
      score += 10;
      reasons.push("Limited network (<50 connections)");
    }
  }

  if (factors.linkedinActivity) {
    if (factors.linkedinActivity >= 10) {
      score += 40;
      reasons.push("Highly active on LinkedIn");
    } else if (factors.linkedinActivity >= 5) {
      score += 30;
      reasons.push("Moderately active on LinkedIn");
    } else if (factors.linkedinActivity >= 1) {
      score += 20;
      reasons.push("Some LinkedIn activity");
    } else {
      score += 5;
      reasons.push("Low LinkedIn activity");
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function calculateEmailEngagementScore(factors: ScoringFactors): number {
  let score = 0;
  const reasons: string[] = [];

  if (factors.emailOpenRate !== undefined) {
    const openScore = factors.emailOpenRate * 100;
    score += openScore * 0.4;
    if (factors.emailOpenRate > 0.5) {
      reasons.push("High email open rate");
    } else if (factors.emailOpenRate > 0.2) {
      reasons.push("Moderate email engagement");
    }
  }

  if (factors.emailClickRate !== undefined) {
    const clickScore = factors.emailClickRate * 100;
    score += clickScore * 0.6;
    if (factors.emailClickRate > 0.1) {
      reasons.push("Clicks email links");
    }
  }

  if (factors.emailReplies && factors.emailReplies > 0) {
    score += 30;
    reasons.push("Responds to emails");
  }

  if (factors.lastEmailEngagement) {
    const daysSince = (Date.now() - factors.lastEmailEngagement.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      score += 20;
      reasons.push("Recent email engagement");
    } else if (daysSince < 30) {
      score += 10;
      reasons.push("Email engagement within last month");
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function calculateProspectScore(
  factors: ScoringFactors,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): ProspectScore {
  const companyScore = calculateCompanyScore(factors);
  const positionScore = calculatePositionScore(factors);
  const linkedinScore = calculateLinkedInScore(factors);
  const emailEngagementScore = calculateEmailEngagementScore(factors);

  const totalScore = Math.round(
    companyScore * weights.companySize +
    companyScore * weights.companyRevenue +
    positionScore * weights.position +
    positionScore * weights.seniority +
    linkedinScore * weights.linkedinActivity +
    emailEngagementScore * weights.emailEngagement
  );

  let priority: "high" | "medium" | "low";
  if (totalScore >= 80) {
    priority = "high";
  } else if (totalScore >= 60) {
    priority = "medium";
  } else {
    priority = "low";
  }

  const reasons: string[] = [];
  
  if (companyScore >= 80) reasons.push("High-value company profile");
  if (positionScore >= 80) reasons.push("Senior decision-maker position");
  if (linkedinScore >= 70) reasons.push("Strong LinkedIn presence");
  if (emailEngagementScore >= 70) reasons.push("High email engagement");
  
  if (totalScore >= 80) {
    reasons.push("Top-tier prospect for immediate outreach");
  } else if (totalScore >= 60) {
    reasons.push("Good prospect worth pursuing");
  } else {
    reasons.push("Lower priority, consider nurturing");
  }

  return {
    prospectId: "", // Will be set by caller
    totalScore,
    companyScore,
    positionScore,
    linkedinScore,
    emailEngagementScore,
    priority,
    lastUpdated: new Date(),
    reasons,
  };
}