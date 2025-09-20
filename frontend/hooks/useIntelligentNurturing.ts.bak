import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export interface NurturingSequence {
  id: number;
  name: string;
  classification_target: string;
  stage_target: string;
  total_steps: number;
  is_active: boolean;
  performance_score: number;
  conversion_rate: number;
  created_by_ai: boolean;
  enrollment_count?: number;
  avg_engagement?: number;
  steps?: SequenceStep[];
}

export interface SequenceStep {
  id: number;
  sequence_id: number;
  step_number: number;
  content_type: string;
  delay_days: number;
  delay_hours: number;
  subject_template?: string;
  content_template: string;
  conditions: Record<string, any>;
  performance_metrics: Record<string, any>;
  is_active: boolean;
}

export interface EngagementProfile {
  id: number;
  prospect_id: number;
  total_score: number;
  email_engagement_score: number;
  content_engagement_score: number;
  response_rate: number;
  preferred_content_type?: string;
  engagement_trend: string;
  last_engagement_at?: string;
}

export interface ProspectBehavior {
  id: number;
  prospect_id: number;
  behavior_type: string;
  behavior_data: Record<string, any>;
  engagement_score: number;
  created_at: string;
}

export interface SequenceEnrollment {
  id: number;
  prospect_id: number;
  sequence_id: number;
  current_step: number;
  status: string;
  enrolled_at: string;
  next_step_scheduled_at?: string;
  sequence_name?: string;
}

export interface ABTest {
  id: number;
  sequence_id: number;
  test_name: string;
  status: string;
  traffic_split: number;
  winner?: string;
  statistical_significance: number;
  start_date: string;
  end_date?: string;
}

export function useIntelligentNurturing(clientId: number) {
  const [sequences, setSequences] = useState<NurturingSequence[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await backend.nurturing.getNurturingDashboard({ client_id: clientId });
      setDashboardData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  // Load sequences
  const loadSequences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await backend.nurturing.listSequences({ client_id: clientId });
      setSequences(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sequences';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  // Get sequence details
  const getSequence = useCallback(async (sequenceId: number): Promise<NurturingSequence | null> => {
    try {
      return await backend.nurturing.getSequence({ sequence_id: sequenceId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get sequence';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  // Generate AI sequence
  const generateAISequence = useCallback(async (params: {
    prospect_data: Record<string, any>;
    classification: string;
    stage: string;
    sequence_length?: number;
    preferred_channels?: string[];
  }) => {
    try {
      setLoading(true);
      const sequence = await backend.nurturing.generateAISequence({
        client_id: clientId,
        ...params
      });
      
      toast({
        title: "Success",
        description: "AI sequence generated successfully"
      });
      
      await loadSequences();
      return sequence;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate AI sequence';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clientId, loadSequences, toast]);

  // Create manual sequence
  const createSequence = useCallback(async (sequenceData: {
    name: string;
    classification_target: string;
    stage_target: string;
    sequence_type?: string;
    steps: Array<{
      step_number: number;
      content_type: string;
      delay_days: number;
      delay_hours?: number;
      subject_template?: string;
      content_template: string;
      conditions?: Record<string, any>;
    }>;
    template_data?: Record<string, any>;
  }) => {
    try {
      setLoading(true);
      const sequence = await backend.nurturing.createSequence({
        client_id: clientId,
        ...sequenceData
      });
      
      toast({
        title: "Success",
        description: "Sequence created successfully"
      });
      
      await loadSequences();
      return sequence;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create sequence';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clientId, loadSequences, toast]);

  // Enroll prospect in sequence
  const enrollProspect = useCallback(async (prospectId: number, sequenceId: number) => {
    try {
      const enrollment = await backend.nurturing.enrollProspect({
        prospect_id: prospectId,
        sequence_id: sequenceId,
        client_id: clientId
      });
      
      toast({
        title: "Success",
        description: "Prospect enrolled in sequence"
      });
      
      return enrollment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enroll prospect';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [clientId, toast]);

  // Smart enroll prospect (AI-powered)
  const smartEnrollProspect = useCallback(async (prospectId: number) => {
    try {
      const result = await backend.nurturing.smartEnrollProspect({
        prospect_id: prospectId,
        client_id: clientId
      });
      
      toast({
        title: "Success",
        description: `Prospect enrolled in ${result.sequence.name}`
      });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to smart enroll prospect';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [clientId, toast]);

  // Bulk enroll prospects
  const bulkEnrollProspects = useCallback(async (prospectIds: number[], sequenceId?: number, useSmartEnrollment = false) => {
    try {
      setLoading(true);
      const result = await backend.nurturing.bulkEnrollProspects({
        prospect_ids: prospectIds,
        sequence_id: sequenceId!,
        client_id: clientId,
        use_smart_enrollment: useSmartEnrollment
      });
      
      toast({
        title: "Success",
        description: `Enrolled ${result.successful} of ${result.total_processed} prospects`
      });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk enroll prospects';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  // Track behavior
  const trackBehavior = useCallback(async (prospectId: number, behaviorType: string, behaviorData?: Record<string, any>) => {
    try {
      await backend.nurturing.trackBehavior({
        prospect_id: prospectId,
        client_id: clientId,
        behavior_type: behaviorType,
        behavior_data: behaviorData
      });
    } catch (err) {
      console.error('Failed to track behavior:', err);
    }
  }, [clientId]);

  // Get engagement profile
  const getEngagementProfile = useCallback(async (prospectId: number): Promise<EngagementProfile | null> => {
    try {
      return await backend.nurturing.getEngagementProfile({ prospect_id: prospectId });
    } catch (err) {
      console.error('Failed to get engagement profile:', err);
      return null;
    }
  }, []);

  // Get prospect behaviors
  const getProspectBehaviors = useCallback(async (prospectId: number): Promise<ProspectBehavior[]> => {
    try {
      return await backend.nurturing.getProspectBehaviors({ prospect_id: prospectId });
    } catch (err) {
      console.error('Failed to get prospect behaviors:', err);
      return [];
    }
  }, []);

  // Get prospect enrollments
  const getProspectEnrollments = useCallback(async (prospectId: number): Promise<SequenceEnrollment[]> => {
    try {
      return await backend.nurturing.getProspectEnrollments({ prospect_id: prospectId });
    } catch (err) {
      console.error('Failed to get prospect enrollments:', err);
      return [];
    }
  }, []);

  // Update enrollment status
  const updateEnrollmentStatus = useCallback(async (enrollmentId: number, status: string, reason?: string) => {
    try {
      await backend.nurturing.updateEnrollmentStatus({
        enrollment_id: enrollmentId,
        status: status as any,
        reason
      });
      
      toast({
        title: "Success",
        description: "Enrollment status updated"
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update enrollment status';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [toast]);

  // Get sequence performance
  const getSequencePerformance = useCallback(async (sequenceId: number) => {
    try {
      return await backend.nurturing.getSequencePerformance({ sequence_id: sequenceId });
    } catch (err) {
      console.error('Failed to get sequence performance:', err);
      return null;
    }
  }, []);

  // Analyze prospect engagement
  const analyzeProspectEngagement = useCallback(async (prospectId: number, analysisType: string, context?: Record<string, any>) => {
    try {
      return await backend.nurturing.analyzeProspectEngagement({
        prospect_id: prospectId,
        client_id: clientId,
        analysis_type: analysisType as any,
        context
      });
    } catch (err) {
      console.error('Failed to analyze prospect engagement:', err);
      return null;
    }
  }, [clientId]);

  // Generate content variations for A/B testing
  const generateContentVariations = useCallback(async (params: {
    base_content: string;
    variation_type: string;
    prospect_classification: string;
    prospect_stage: string;
    count?: number;
  }) => {
    try {
      return await backend.nurturing.generateContentVariations(params as any);
    } catch (err) {
      console.error('Failed to generate content variations:', err);
      return [];
    }
  }, []);

  // Optimize sequence
  const optimizeSequence = useCallback(async (sequenceId: number) => {
    try {
      return await backend.nurturing.optimizeSequence({ sequence_id: sequenceId });
    } catch (err) {
      console.error('Failed to optimize sequence:', err);
      return null;
    }
  }, []);

  // Initialize data loading
  useEffect(() => {
    if (clientId) {
      loadDashboard();
      loadSequences();
    }
  }, [clientId, loadDashboard, loadSequences]);

  return {
    // State
    sequences,
    dashboardData,
    loading,
    error,

    // Actions
    loadDashboard,
    loadSequences,
    getSequence,
    generateAISequence,
    createSequence,
    enrollProspect,
    smartEnrollProspect,
    bulkEnrollProspects,
    trackBehavior,
    getEngagementProfile,
    getProspectBehaviors,
    getProspectEnrollments,
    updateEnrollmentStatus,
    getSequencePerformance,
    analyzeProspectEngagement,
    generateContentVariations,
    optimizeSequence
  };
}