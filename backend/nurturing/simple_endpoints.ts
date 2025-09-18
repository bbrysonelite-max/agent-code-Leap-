import { api } from "encore.dev/api";

export const getNurturingOverview = api(
  { method: "GET", path: "/overview", expose: true },
  async (): Promise<{
    activeSequences: number;
    totalProspects: number;
    avgEngagement: number;
    completionRate: number;
  }> => {
    return {
      activeSequences: 5,
      totalProspects: 125,
      avgEngagement: 72,
      completionRate: 68
    };
  }
);

export const getSequenceList = api(
  { method: "GET", path: "/sequences", expose: true },
  async (): Promise<{
    sequences: Array<{
      id: string;
      name: string;
      description: string;
      isActive: boolean;
      prospects: number;
    }>;
  }> => {
    return {
      sequences: [
        {
          id: "seq1",
          name: "Welcome Series",
          description: "Initial onboarding sequence",
          isActive: true,
          prospects: 45
        },
        {
          id: "seq2", 
          name: "Product Demo Follow-up",
          description: "Follow-up after demo request",
          isActive: true,
          prospects: 23
        }
      ]
    };
  }
);

export const getStagnantProspects = api(
  { method: "GET", path: "/stagnant", expose: true },
  async (): Promise<{
    prospects: Array<{
      id: string;
      name: string;
      email: string;
      company: string;
      stage: string;
      daysInStage: number;
    }>;
  }> => {
    return {
      prospects: [
        {
          id: "p1",
          name: "John Smith",
          email: "john@example.com",
          company: "TechCorp",
          stage: "consideration",
          daysInStage: 45
        }
      ]
    };
  }
);