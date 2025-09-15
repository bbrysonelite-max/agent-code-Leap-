export interface ProspectScore {
  prospectId: string;
  totalScore: number;
  companyScore: number;
  positionScore: number;
  linkedinScore: number;
  emailEngagementScore: number;
  priority: "high" | "medium" | "low";
  lastUpdated: Date;
  reasons: string[];
}

export interface ScoringFactors {
  companySize?: number;
  companyRevenue?: number;
  companyIndustry?: string;
  position?: string;
  seniority?: string;
  linkedinConnections?: number;
  linkedinActivity?: number;
  emailOpenRate?: number;
  emailClickRate?: number;
  emailReplies?: number;
  lastEmailEngagement?: Date;
}

export interface ScoreWeights {
  companySize: number;
  companyRevenue: number;
  position: number;
  seniority: number;
  linkedinActivity: number;
  emailEngagement: number;
}

export interface PriorityRecommendation {
  prospectId: string;
  name: string;
  company: string;
  score: number;
  priority: "high" | "medium" | "low";
  reasons: string[];
  nextAction: string;
  confidence: number;
}

export interface ScoreAnalysisRequest {
  prospectId: string;
  factors: ScoringFactors;
}

export interface BulkScoreRequest {
  prospectIds: string[];
}

export interface TopProspectsRequest {
  limit?: number;
  minScore?: number;
  priority?: "high" | "medium" | "low";
}