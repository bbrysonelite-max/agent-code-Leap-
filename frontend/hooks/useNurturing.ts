import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Client, Local } from '../client';

const backend = new Client(Local);

// Types based on backend nurturing service
export interface NurturingSequence {
  id: number;
  client_id: number;
  name: string;
  classification_target: string;
  stage_target: string;
  sequence_type: string;
  total_steps: number;
  is_active: boolean;
  performance_score: number;
  conversion_rate: number;
  created_by_ai: boolean;
  template_data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
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
  conditions: Record<string, unknown>;
  performance_metrics: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
}

export interface SequenceEnrollment {
  id: number;
  prospect_id: number;
  sequence_id: number;
  client_id: number;
  current_step: number;
  status: 'active' | 'paused' | 'completed' | 'stopped';
  enrolled_at: Date;
  last_step_sent_at?: Date;
  next_step_scheduled_at?: Date;
  completion_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EngagementProfile {
  id: number;
  prospect_id: number;
  client_id: number;
  total_score: number;
  email_engagement_score: number;
  content_engagement_score: number;
  response_rate: number;
  avg_response_time_hours: number;
  preferred_content_type?: string;
  optimal_send_time?: string;
  optimal_send_day?: number;
  engagement_trend: string;
  last_engagement_at?: Date;
}

// List sequences
export function useSequences(clientId: number) {
  return useQuery({
    queryKey: ['nurturing', 'sequences', clientId],
    queryFn: () => backend.nurturing.listSequences({ client_id: clientId }),
    enabled: !!clientId
  });
}

// Get single sequence
export function useSequence(sequenceId: number) {
  return useQuery({
    queryKey: ['nurturing', 'sequence', sequenceId],
    queryFn: () => backend.nurturing.getSequence({ sequence_id: sequenceId }),
    enabled: !!sequenceId
  });
}

// Get nurturing dashboard
export function useNurturingDashboard(clientId: number) {
  return useQuery({
    queryKey: ['nurturing', 'dashboard', clientId],
    queryFn: () => backend.nurturing.getNurturingDashboard({ client_id: clientId }),
    enabled: !!clientId
  });
}

// Get sequence performance
export function useSequencePerformance(sequenceId: number) {
  return useQuery({
    queryKey: ['nurturing', 'performance', sequenceId],
    queryFn: () => backend.nurturing.getSequencePerformance({ sequence_id: sequenceId }),
    enabled: !!sequenceId
  });
}

// Get engagement analytics
export function useEngagementAnalytics(clientId: number) {
  return useQuery({
    queryKey: ['nurturing', 'engagement-analytics', clientId],
    queryFn: () => backend.nurturing.getEngagementAnalytics({ client_id: clientId }),
    enabled: !!clientId
  });
}

// Get engagement profile for a prospect
export function useEngagementProfile(prospectId: number, clientId: number) {
  return useQuery({
    queryKey: ['nurturing', 'engagement-profile', prospectId],
    queryFn: () => backend.nurturing.getEngagementProfile({ 
      prospect_id: prospectId, 
      client_id: clientId 
    }),
    enabled: !!prospectId && !!clientId
  });
}

// Get prospect enrollments
export function useProspectEnrollments(prospectId: number, clientId: number) {
  return useQuery({
    queryKey: ['nurturing', 'enrollments', prospectId],
    queryFn: () => backend.nurturing.getProspectEnrollments({ 
      prospect_id: prospectId,
      client_id: clientId
    }),
    enabled: !!prospectId && !!clientId
  });
}

// Get prospect behaviors
export function useProspectBehaviors(prospectId: number, clientId: number, limit?: number) {
  return useQuery({
    queryKey: ['nurturing', 'behaviors', prospectId, limit],
    queryFn: () => backend.nurturing.getProspectBehaviors({ 
      prospect_id: prospectId,
      client_id: clientId,
      limit
    }),
    enabled: !!prospectId && !!clientId
  });
}

// Get active A/B tests
export function useActiveABTests(clientId: number) {
  return useQuery({
    queryKey: ['nurturing', 'ab-tests', clientId],
    queryFn: () => backend.nurturing.getActiveABTests({ client_id: clientId }),
    enabled: !!clientId
  });
}

// Get A/B test results
export function useABTestResults(testId: number) {
  return useQuery({
    queryKey: ['nurturing', 'ab-test-results', testId],
    queryFn: () => backend.nurturing.getABTestResults({ test_id: testId }),
    enabled: !!testId
  });
}

// System health check
export function useNurturingHealth() {
  return useQuery({
    queryKey: ['nurturing', 'health'],
    queryFn: () => backend.nurturing.getSystemHealth()
  });
}

// Mutations

// Create sequence
export function useCreateSequence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      client_id: number;
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
        conditions?: Record<string, unknown>;
      }>;
      template_data?: Record<string, unknown>;
    }) => backend.nurturing.createSequence(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'sequences', variables.client_id] });
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'dashboard', variables.client_id] });
    }
  });
}

// Enroll prospect in sequence
export function useEnrollProspect() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      prospect_id: number;
      sequence_id: number;
      client_id: number;
    }) => backend.nurturing.enrollProspect(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'enrollments', variables.prospect_id] });
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'dashboard', variables.client_id] });
    }
  });
}

// Smart enroll prospect (AI-powered)
export function useSmartEnrollProspect() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      prospect_id: number;
      client_id: number;
    }) => backend.nurturing.smartEnrollProspect(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'enrollments', variables.prospect_id] });
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'dashboard', variables.client_id] });
    }
  });
}

// Bulk enroll prospects
export function useBulkEnrollProspects() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      prospect_ids: number[];
      sequence_id: number;
      client_id: number;
      use_smart_enrollment?: boolean;
    }) => backend.nurturing.bulkEnrollProspects(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing'] });
    }
  });
}

// Update enrollment status
export function useUpdateEnrollmentStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      enrollment_id: number;
      status: 'active' | 'paused' | 'stopped';
      reason?: string;
    }) => backend.nurturing.updateEnrollmentStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'dashboard'] });
    }
  });
}

// Track behavior
export function useTrackBehavior() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      prospect_id: number;
      client_id: number;
      behavior_type: string;
      behavior_data?: Record<string, unknown>;
    }) => backend.nurturing.trackBehavior(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'behaviors', variables.prospect_id] });
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'engagement-profile', variables.prospect_id] });
    }
  });
}

// Generate AI sequence
export function useGenerateAISequence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      client_id: number;
      prospect_data: Record<string, unknown>;
      classification: string;
      stage: string;
      sequence_length?: number;
      preferred_channels?: string[];
    }) => backend.nurturing.generateAISequence(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'sequences', variables.client_id] });
    }
  });
}

// Generate step content
export function useGenerateStepContent() {
  return useMutation({
    mutationFn: (data: {
      prospect_id: number;
      step_number: number;
      content_type: string;
      context?: Record<string, unknown>;
    }) => backend.nurturing.generateStepContent(data)
  });
}

// Create A/B test
export function useCreateABTest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      sequence_id: number;
      test_name: string;
      variant_a_data: Record<string, unknown>;
      variant_b_data: Record<string, unknown>;
      traffic_split?: number;
    }) => backend.nurturing.createABTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'ab-tests'] });
    }
  });
}

// Analyze A/B test results
export function useAnalyzeABTestResults() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (testId: number) => backend.nurturing.analyzeABTestResults({ test_id: testId }),
    onSuccess: (_, testId) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'ab-test-results', testId] });
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'ab-tests'] });
    }
  });
}

// Track email interaction
export function useTrackEmailInteraction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      prospect_id: number;
      client_id: number;
      communication_id: number;
      interaction_type: 'open' | 'click' | 'reply';
      interaction_data?: Record<string, unknown>;
    }) => backend.nurturing.trackEmailInteraction(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'behaviors', variables.prospect_id] });
    }
  });
}

// Optimize sequence with AI
export function useOptimizeSequence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      sequence_id: number;
      optimization_goal: 'engagement' | 'conversion' | 'speed';
    }) => backend.nurturing.optimizeSequence(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing', 'sequences'] });
    }
  });
}

// Combined hook for common nurturing operations
export function useNurturing(clientId: number) {
  const dashboard = useNurturingDashboard(clientId);
  const sequences = useSequences(clientId);
  const engagementAnalytics = useEngagementAnalytics(clientId);
  const abTests = useActiveABTests(clientId);
  const health = useNurturingHealth();
  
  const createSequence = useCreateSequence();
  const enrollProspect = useEnrollProspect();
  const smartEnroll = useSmartEnrollProspect();
  const bulkEnroll = useBulkEnrollProspects();
  const updateStatus = useUpdateEnrollmentStatus();
  const trackBehavior = useTrackBehavior();
  const generateSequence = useGenerateAISequence();
  
  return {
    // Queries
    dashboard: dashboard.data,
    sequences: sequences.data,
    engagementAnalytics: engagementAnalytics.data,
    abTests: abTests.data,
    health: health.data,
    
    // Loading states
    isLoading: dashboard.isLoading || sequences.isLoading,
    isError: dashboard.isError || sequences.isError,
    error: dashboard.error || sequences.error,
    
    // Mutations
    createSequence: createSequence.mutateAsync,
    enrollProspect: enrollProspect.mutateAsync,
    smartEnroll: smartEnroll.mutateAsync,
    bulkEnroll: bulkEnroll.mutateAsync,
    updateEnrollmentStatus: updateStatus.mutateAsync,
    trackBehavior: trackBehavior.mutateAsync,
    generateAISequence: generateSequence.mutateAsync,
    
    // Mutation states
    isCreatingSequence: createSequence.isPending,
    isEnrolling: enrollProspect.isPending || smartEnroll.isPending,
    
    // Refetch
    refetch: () => {
      dashboard.refetch();
      sequences.refetch();
      engagementAnalytics.refetch();
    }
  };
}

export default useNurturing;



