import { api } from "encore.dev/api";

export interface NurturingSequence {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  steps: number;
  prospects: number;
}

export interface StagnantProspect {
  id: string;
  name: string;
  email: string;
  company: string;
  stage: string;
  daysInStage: number;
}

export const getSequences = api(
  { method: "GET", path: "/sequences", expose: true },
  async (): Promise<{ sequences: NurturingSequence[] }> => {
    return {
      sequences: [
        {
          id: "seq1",
          name: "Welcome Series",
          description: "Initial onboarding sequence for new prospects",
          isActive: true,
          steps: 5,
          prospects: 45
        },
        {
          id: "seq2",
          name: "Product Demo Follow-up",
          description: "Follow-up sequence after demo requests",
          isActive: true,
          steps: 3,
          prospects: 23
        },
        {
          id: "seq3",
          name: "Re-engagement Campaign",
          description: "Reactivate dormant prospects",
          isActive: false,
          steps: 4,
          prospects: 12
        }
      ]
    };
  }
);

export const getStagnantProspects = api(
  { method: "GET", path: "/stagnant-prospects", expose: true },
  async (): Promise<{ prospects: StagnantProspect[] }> => {
    return {
      prospects: [
        {
          id: "p1",
          name: "John Smith",
          email: "john@techcorp.com",
          company: "TechCorp Inc.",
          stage: "consideration",
          daysInStage: 45
        },
        {
          id: "p2",
          name: "Sarah Johnson",
          email: "sarah@startup.io",
          company: "StartupIO",
          stage: "interest",
          daysInStage: 32
        },
        {
          id: "p3",
          name: "Mike Wilson",
          email: "mike@enterprise.com",
          company: "Enterprise Solutions",
          stage: "evaluation",
          daysInStage: 67
        }
      ]
    };
  }
);

export const getFunnelAnalytics = api(
  { method: "GET", path: "/funnel-analytics", expose: true },
  async (): Promise<{
    stageDistribution: Array<{
      stage: string;
      count: number;
      percentage: number;
    }>;
    conversionRates: Array<{
      fromStage: string;
      toStage: string;
      rate: number;
    }>;
  }> => {
    return {
      stageDistribution: [
        { stage: "awareness", count: 45, percentage: 35.2 },
        { stage: "interest", count: 32, percentage: 25.0 },
        { stage: "consideration", count: 25, percentage: 19.5 },
        { stage: "intent", count: 15, percentage: 11.7 },
        { stage: "evaluation", count: 8, percentage: 6.3 },
        { stage: "purchase", count: 3, percentage: 2.3 }
      ],
      conversionRates: [
        { fromStage: "awareness", toStage: "interest", rate: 71.1 },
        { fromStage: "interest", toStage: "consideration", rate: 78.1 },
        { fromStage: "consideration", toStage: "intent", rate: 60.0 },
        { fromStage: "intent", toStage: "evaluation", rate: 53.3 },
        { fromStage: "evaluation", toStage: "purchase", rate: 37.5 }
      ]
    };
  }
);

export const createSequence = api(
  { method: "POST", path: "/sequences", expose: true },
  async (request: {
    name: string;
    description: string;
    steps: Array<{
      type: string;
      delay: number;
      content: string;
    }>;
  }): Promise<{ id: string; success: boolean }> => {
    // In a real implementation, this would save to database
    const sequenceId = `seq_${Date.now()}`;
    
    return {
      id: sequenceId,
      success: true
    };
  }
);

export const enrollProspect = api(
  { method: "POST", path: "/enroll", expose: true },
  async (request: {
    prospectId: string;
    sequenceId: string;
  }): Promise<{ success: boolean; message: string }> => {
    // In a real implementation, this would enroll the prospect
    return {
      success: true,
      message: `Prospect ${request.prospectId} enrolled in sequence ${request.sequenceId}`
    };
  }
);