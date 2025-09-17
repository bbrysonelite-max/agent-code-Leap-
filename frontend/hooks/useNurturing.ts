import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import type { 
  NurturingSequence, 
  NurturingEnrollment, 
  ProspectBehavior, 
  ProspectClassification,
  ContentTemplate,
  AIInsight,
  NurturingAnalytics
} from '~backend/nurturing/types';

export function useNurturingSequences(isActive?: boolean) {
  return useQuery({
    queryKey: ['nurturing-sequences', isActive],
    queryFn: () => backend.nurturing.getSequences({ isActive })
  });
}

export function useNurturingSequence(sequenceId: string) {
  return useQuery({
    queryKey: ['nurturing-sequence', sequenceId],
    queryFn: () => backend.nurturing.getSequence({ sequenceId }),
    enabled: !!sequenceId
  });
}

export function useSequenceEnrollments(sequenceId: string, status?: string) {
  return useQuery({
    queryKey: ['sequence-enrollments', sequenceId, status],
    queryFn: () => backend.nurturing.getSequenceEnrollments({ sequenceId, status }),
    enabled: !!sequenceId
  });
}

export function useSequenceAnalytics(sequenceId: string, days = 30) {
  return useQuery({
    queryKey: ['sequence-analytics', sequenceId, days],
    queryFn: () => backend.nurturing.getSequenceAnalytics({ sequenceId, days }),
    enabled: !!sequenceId
  });
}

export function useProspectBehaviors(prospectId: string) {
  return useQuery({
    queryKey: ['prospect-behaviors', prospectId],
    queryFn: () => backend.nurturing.getProspectBehaviors({ prospectId }),
    enabled: !!prospectId
  });
}

export function useProspectClassification(prospectId: string) {
  return useQuery({
    queryKey: ['prospect-classification', prospectId],
    queryFn: () => backend.nurturing.getProspectClassification({ prospectId }),
    enabled: !!prospectId
  });
}

export function useAIInsights(prospectId: string) {
  return useQuery({
    queryKey: ['ai-insights', prospectId],
    queryFn: () => backend.nurturing.getAIInsights({ prospectId }),
    enabled: !!prospectId
  });
}

export function useContentTemplates(filters?: {
  classification?: string;
  stage?: string;
  type?: string;
  industry?: string;
  persona?: string;
}) {
  return useQuery({
    queryKey: ['content-templates', filters],
    queryFn: () => backend.nurturing.getContentTemplates(filters || {})
  });
}

export function useCreateSequence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: backend.nurturing.createSequence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-sequences'] });
    }
  });
}

export function useUpdateSequence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sequenceId, ...updates }: { sequenceId: string } & Partial<NurturingSequence>) =>
      backend.nurturing.updateSequence({ sequenceId, ...updates }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['nurturing-sequence', variables.sequenceId] });
    }
  });
}

export function useDeleteSequence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sequenceId }: { sequenceId: string }) =>
      backend.nurturing.deleteSequence({ sequenceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-sequences'] });
    }
  });
}

export function useEnrollProspect() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sequenceId, prospectId, metadata }: { sequenceId: string; prospectId: string; metadata?: Record<string, any> }) =>
      backend.nurturing.enrollProspect({ sequenceId, prospectId, metadata }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-enrollments', variables.sequenceId] });
    }
  });
}

export function useBulkEnrollProspects() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sequenceId, prospectIds }: { sequenceId: string; prospectIds: string[] }) =>
      backend.nurturing.bulkEnrollProspects({ sequenceId, prospectIds }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sequence-enrollments', variables.sequenceId] });
    }
  });
}

export function useTrackBehavior() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: backend.nurturing.trackBehavior,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospect-behaviors', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['prospect-classification', variables.prospectId] });
    }
  });
}

export function useClassifyProspect() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ prospectId }: { prospectId: string }) =>
      backend.nurturing.classifyProspect({ prospectId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospect-classification', variables.prospectId] });
    }
  });
}

export function useGenerateAIInsights() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ prospectId }: { prospectId: string }) =>
      backend.nurturing.generateAIInsights({ prospectId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights', variables.prospectId] });
    }
  });
}

export function useGeneratePersonalizedContent() {
  return useMutation({
    mutationFn: backend.nurturing.generatePersonalizedContent
  });
}

export function useCreateContentTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: backend.nurturing.createContentTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-templates'] });
    }
  });
}

export function useOptimizeSequence() {
  return useMutation({
    mutationFn: ({ sequenceId, optimizationGoal }: { sequenceId: string; optimizationGoal: 'conversion' | 'engagement' | 'response_rate' }) =>
      backend.nurturing.optimizeSequence({ sequenceId, optimizationGoal })
  });
}

export function useDuplicateSequence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sequenceId, name }: { sequenceId: string; name: string }) =>
      backend.nurturing.duplicateSequence({ sequenceId, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-sequences'] });
    }
  });
}

export function useEnrollmentCandidates(sequenceId: string) {
  return useQuery({
    queryKey: ['enrollment-candidates', sequenceId],
    queryFn: () => backend.nurturing.getBulkEnrollmentCandidates({ sequenceId }),
    enabled: !!sequenceId
  });
}

export function usePauseEnrollment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ enrollmentId }: { enrollmentId: string }) =>
      backend.nurturing.pauseEnrollment({ enrollmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-enrollments'] });
    }
  });
}

export function useResumeEnrollment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ enrollmentId }: { enrollmentId: string }) =>
      backend.nurturing.resumeEnrollment({ enrollmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-enrollments'] });
    }
  });
}