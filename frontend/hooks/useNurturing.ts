import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { 
  NurturingSequence,
  ProspectSequence,
  CreateSequenceRequest,
  EnrollProspectRequest,
  ProspectClassification,
  BehaviorEvent
} from '~backend/nurturing/types';

export function useNurturing() {
  const [sequences, setSequences] = useState<NurturingSequence[]>([]);
  const [activeSequences, setActiveSequences] = useState<ProspectSequence[]>([]);
  const [funnelAnalytics, setFunnelAnalytics] = useState<any>(null);
  const [stagnantProspects, setStagnantProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadNurturingData();
  }, []);

  const loadNurturingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overview, sequenceList, stagnantRes] = await Promise.all([
        backend.nurturing.getNurturingOverview(),
        backend.nurturing.getSequenceList(),
        backend.nurturing.getStagnantProspects()
      ]);

      setSequences(sequenceList.sequences.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        isActive: s.isActive,
        clientId: 'default',
        triggerConditions: {},
        targetAudience: {},
        createdAt: new Date(),
        updatedAt: new Date()
      })));

      setActiveSequences([]);
      setFunnelAnalytics({
        stageDistribution: [
          { funnel_stage: 'awareness', prospect_count: 45, avg_confidence: 75 },
          { funnel_stage: 'interest', prospect_count: 32, avg_confidence: 80 },
          { funnel_stage: 'consideration', prospect_count: 18, avg_confidence: 85 }
        ],
        conversionRates: [],
        avgTimeInStage: [],
        stageProgression: []
      });
      setStagnantProspects(stagnantRes.prospects.map(p => ({
        prospectId: p.id,
        funnelStage: p.stage,
        stageEnteredAt: new Date(),
        daysInStage: p.daysInStage,
        prospect: {
          firstName: p.name.split(' ')[0],
          lastName: p.name.split(' ')[1] || '',
          email: p.email,
          company: p.company
        },
        engagementScore: 45
      })));
    } catch (err) {
      console.error('Failed to load nurturing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      toast({
        title: "Error",
        description: "Failed to load nurturing data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createSequence = async (sequenceData: CreateSequenceRequest) => {
    try {
      const result = await backend.nurturing.createSequence(sequenceData);
      toast({
        title: "Success",
        description: "Nurturing sequence created successfully"
      });
      await loadNurturingData();
      return result;
    } catch (err) {
      console.error('Failed to create sequence:', err);
      toast({
        title: "Error",
        description: "Failed to create sequence",
        variant: "destructive"
      });
      throw err;
    }
  };

  const enrollProspect = async (enrollmentData: EnrollProspectRequest) => {
    try {
      const result = await backend.nurturing.enrollProspect(enrollmentData);
      toast({
        title: "Success",
        description: "Prospect enrolled in sequence"
      });
      await loadNurturingData();
      return result;
    } catch (err) {
      console.error('Failed to enroll prospect:', err);
      toast({
        title: "Error",
        description: "Failed to enroll prospect",
        variant: "destructive"
      });
      throw err;
    }
  };

  const pauseSequence = async (prospectSequenceId: string) => {
    try {
      await backend.nurturing.pauseSequence({ prospectSequenceId });
      toast({
        title: "Success",
        description: "Sequence paused"
      });
      await loadNurturingData();
    } catch (err) {
      console.error('Failed to pause sequence:', err);
      toast({
        title: "Error",
        description: "Failed to pause sequence",
        variant: "destructive"
      });
    }
  };

  const resumeSequence = async (prospectSequenceId: string) => {
    try {
      await backend.nurturing.resumeSequence({ prospectSequenceId });
      toast({
        title: "Success",
        description: "Sequence resumed"
      });
      await loadNurturingData();
    } catch (err) {
      console.error('Failed to resume sequence:', err);
      toast({
        title: "Error",
        description: "Failed to resume sequence",
        variant: "destructive"
      });
    }
  };

  const analyzeProspectBehavior = async (behaviorEvent: BehaviorEvent) => {
    try {
      await backend.nurturing.analyzeBehavior(behaviorEvent);
      toast({
        title: "Behavior Analyzed",
        description: "Prospect behavior has been analyzed and processed"
      });
    } catch (err) {
      console.error('Failed to analyze behavior:', err);
      toast({
        title: "Error",
        description: "Failed to analyze prospect behavior",
        variant: "destructive"
      });
    }
  };

  const getProspectAnalysis = async (prospectId: string) => {
    try {
      return await backend.nurturing.getProspectAnalysis({ prospectId });
    } catch (err) {
      console.error('Failed to get prospect analysis:', err);
      toast({
        title: "Error",
        description: "Failed to get prospect analysis",
        variant: "destructive"
      });
      throw err;
    }
  };

  const generateContent = async (contentRequest: any) => {
    try {
      return await backend.nurturing.generateContent(contentRequest);
    } catch (err) {
      console.error('Failed to generate content:', err);
      toast({
        title: "Error",
        description: "Failed to generate content",
        variant: "destructive"
      });
      throw err;
    }
  };

  const classifyProspect = async (prospectId: string) => {
    try {
      const result = await backend.nurturing.classifyProspect({ prospectId });
      toast({
        title: "Success",
        description: "Prospect classified successfully"
      });
      return result;
    } catch (err) {
      console.error('Failed to classify prospect:', err);
      toast({
        title: "Error",
        description: "Failed to classify prospect",
        variant: "destructive"
      });
      throw err;
    }
  };

  const updateFunnelStage = async (
    prospectId: string, 
    stage: 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase',
    reason?: string
  ) => {
    try {
      await backend.nurturing.updateFunnelStage({ prospectId, stage, reason });
      toast({
        title: "Success",
        description: `Prospect moved to ${stage} stage`
      });
      await loadNurturingData();
    } catch (err) {
      console.error('Failed to update funnel stage:', err);
      toast({
        title: "Error",
        description: "Failed to update funnel stage",
        variant: "destructive"
      });
    }
  };

  return {
    sequences,
    activeSequences,
    funnelAnalytics,
    stagnantProspects,
    loading,
    error,
    createSequence,
    enrollProspect,
    pauseSequence,
    resumeSequence,
    analyzeProspectBehavior,
    getProspectAnalysis,
    generateContent,
    classifyProspect,
    updateFunnelStage,
    refreshData: loadNurturingData
  };
}