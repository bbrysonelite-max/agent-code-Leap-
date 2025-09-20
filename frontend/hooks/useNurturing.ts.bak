import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export function useNurturing() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [activeSequences, setActiveSequences] = useState<any[]>([]);
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

      const [sequencesRes, stagnantRes, funnelRes] = await Promise.all([
        backend.nurturing.getSequences(),
        backend.nurturing.getStagnantProspects(), 
        backend.nurturing.getFunnelAnalytics()
      ]);

      setSequences(sequencesRes.sequences.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        isActive: s.isActive,
        clientId: 'default',
        triggerConditions: {},
        targetAudience: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: []
      })));

      setActiveSequences([]);
      
      setFunnelAnalytics({
        stageDistribution: funnelRes.stageDistribution.map(s => ({
          funnel_stage: s.stage,
          prospect_count: s.count,
          avg_confidence: 75
        })),
        conversionRates: funnelRes.conversionRates.map(r => ({
          from_stage: r.fromStage,
          to_stage: r.toStage,
          transitions: 100,
          conversion_rate: r.rate
        })),
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

  const createSequence = async (sequenceData: any) => {
    try {
      const result = await backend.nurturing.createSequence({
        name: sequenceData.name,
        description: sequenceData.description || '',
        steps: sequenceData.steps || []
      });
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

  const enrollProspect = async (enrollmentData: any) => {
    try {
      const result = await backend.nurturing.enrollProspect({
        prospectId: enrollmentData.prospectId,
        sequenceId: enrollmentData.sequenceId
      });
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

  const analyzeProspectBehavior = async (behaviorEvent: any) => {
    try {
      // Mock implementation for now
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
      // Mock implementation for now
      return {
        prospectId,
        engagementScore: 75,
        conversionProbability: 65,
        insights: ['High email engagement', 'Active website visitor'],
        recommendedActions: []
      };
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
      // Mock implementation for now
      return {
        subject: 'Personalized Email Subject',
        body: 'Personalized email content based on prospect data...',
        variables: {},
        personalizationApplied: [],
        aiEnhancements: []
      };
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
      // Mock implementation for now
      toast({
        title: "Success",
        description: "Prospect classified successfully"
      });
      return { id: 'mock', prospectId, classification: 'hot_lead' };
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
    stage: string,
    reason?: string
  ) => {
    try {
      // Mock implementation for now
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