import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import type { 
  NurturingSequence, 
  ProspectClassificationData, 
  EngagementPattern,
  SequenceStepExecution,
  ProspectSequenceEnrollment
} from '~backend/nurturing/types';

export function useNurturing() {
  const queryClient = useQueryClient();
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);

  // Get nurturing analytics
  const analyticsQuery = useQuery({
    queryKey: ['nurturing', 'analytics'],
    queryFn: () => backend.nurturing.getNurturingAnalytics({})
  });

  // Get behavior analytics
  const behaviorAnalyticsQuery = useQuery({
    queryKey: ['nurturing', 'behavior-analytics'],
    queryFn: () => backend.nurturing.getBehaviorAnalytics({})
  });

  // Get optimization recommendations
  const recommendationsQuery = useQuery({
    queryKey: ['nurturing', 'recommendations'],
    queryFn: () => backend.nurturing.getOptimizationRecommendations({})
  });

  // Analyze prospect behavior
  const analyzeBehaviorMutation = useMutation({
    mutationFn: ({ prospectId, includePredictions }: { prospectId: string; includePredictions?: boolean }) =>
      backend.nurturing.analyzeBehavior({ 
        prospect_id: prospectId, 
        include_predictions: includePredictions 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'analytics'] });
    }
  });

  // Create sequence
  const createSequenceMutation = useMutation({
    mutationFn: (sequenceData: any) => 
      backend.nurturing.createSequence(sequenceData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing'] });
    }
  });

  // Enroll prospect
  const enrollProspectMutation = useMutation({
    mutationFn: ({ prospectId, sequenceId, overrideClassification }: { 
      prospectId: string; 
      sequenceId: string; 
      overrideClassification?: boolean;
    }) =>
      backend.nurturing.enrollProspect({ 
        prospect_id: prospectId, 
        sequence_id: sequenceId,
        override_classification: overrideClassification
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing'] });
    }
  });

  // Bulk enroll prospects
  const bulkEnrollMutation = useMutation({
    mutationFn: ({ prospectIds, sequenceId }: { 
      prospectIds: string[]; 
      sequenceId: string;
    }) =>
      backend.nurturing.bulkEnroll({ 
        prospect_ids: prospectIds, 
        sequence_id: sequenceId
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing'] });
    }
  });

  // Generate content
  const generateContentMutation = useMutation({
    mutationFn: ({ prospectId, sequenceStepId, contentVariant, customVariables }: {
      prospectId: string;
      sequenceStepId: string;
      contentVariant?: string;
      customVariables?: Record<string, any>;
    }) =>
      backend.nurturing.generateContent({ 
        prospect_id: prospectId, 
        sequence_step_id: sequenceStepId,
        content_variant: contentVariant as any,
        custom_variables: customVariables
      })
  });

  // Process scheduled steps
  const processScheduledStepsMutation = useMutation({
    mutationFn: () => backend.nurturing.processScheduledSteps({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing'] });
    }
  });

  // Get sequence performance
  const getSequencePerformance = useCallback((sequenceId: string) => {
    return queryClient.fetchQuery({
      queryKey: ['nurturing', 'sequence-performance', sequenceId],
      queryFn: () => backend.nurturing.getSequencePerformance({ sequence_id: sequenceId })
    });
  }, [queryClient]);

  const analyzeProspectBehavior = useCallback(async (prospectId: string) => {
    try {
      return await analyzeBehaviorMutation.mutateAsync({ 
        prospectId, 
        includePredictions: true 
      });
    } catch (error) {
      console.error('Failed to analyze prospect behavior:', error);
      throw error;
    }
  }, [analyzeBehaviorMutation]);

  const createNurturingSequence = useCallback(async (sequenceData: any) => {
    try {
      return await createSequenceMutation.mutateAsync(sequenceData);
    } catch (error) {
      console.error('Failed to create sequence:', error);
      throw error;
    }
  }, [createSequenceMutation]);

  const enrollInSequence = useCallback(async (
    prospectId: string, 
    sequenceId: string, 
    overrideClassification = false
  ) => {
    try {
      return await enrollProspectMutation.mutateAsync({ 
        prospectId, 
        sequenceId, 
        overrideClassification 
      });
    } catch (error) {
      console.error('Failed to enroll prospect:', error);
      throw error;
    }
  }, [enrollProspectMutation]);

  const bulkEnrollProspects = useCallback(async (
    prospectIds: string[], 
    sequenceId: string
  ) => {
    try {
      return await bulkEnrollMutation.mutateAsync({ prospectIds, sequenceId });
    } catch (error) {
      console.error('Failed to bulk enroll prospects:', error);
      throw error;
    }
  }, [bulkEnrollMutation]);

  const generatePersonalizedContent = useCallback(async (
    prospectId: string, 
    sequenceStepId: string, 
    options?: {
      contentVariant?: string;
      customVariables?: Record<string, any>;
    }
  ) => {
    try {
      return await generateContentMutation.mutateAsync({
        prospectId,
        sequenceStepId,
        contentVariant: options?.contentVariant,
        customVariables: options?.customVariables
      });
    } catch (error) {
      console.error('Failed to generate content:', error);
      throw error;
    }
  }, [generateContentMutation]);

  const processScheduledSteps = useCallback(async () => {
    try {
      return await processScheduledStepsMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to process scheduled steps:', error);
      throw error;
    }
  }, [processScheduledStepsMutation]);

  return {
    // Data
    analytics: analyticsQuery.data,
    behaviorAnalytics: behaviorAnalyticsQuery.data,
    recommendations: recommendationsQuery.data,
    selectedSequence,
    
    // Loading states
    isLoading: analyticsQuery.isLoading || behaviorAnalyticsQuery.isLoading,
    isCreatingSequence: createSequenceMutation.isPending,
    isEnrolling: enrollProspectMutation.isPending || bulkEnrollMutation.isPending,
    isGeneratingContent: generateContentMutation.isPending,
    isProcessing: processScheduledStepsMutation.isPending,
    isAnalyzing: analyzeBehaviorMutation.isPending,
    
    // Actions
    setSelectedSequence,
    analyzeProspectBehavior,
    createNurturingSequence,
    enrollInSequence,
    bulkEnrollProspects,
    generatePersonalizedContent,
    processScheduledSteps,
    getSequencePerformance,
    
    // Refetch functions
    refetchAnalytics: analyticsQuery.refetch,
    refetchBehaviorAnalytics: behaviorAnalyticsQuery.refetch,
    refetchRecommendations: recommendationsQuery.refetch
  };
}