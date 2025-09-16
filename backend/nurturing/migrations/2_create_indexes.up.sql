-- Performance indexes for prospect behaviors
CREATE INDEX idx_prospect_behaviors_prospect_id ON prospect_behaviors(prospect_id);
CREATE INDEX idx_prospect_behaviors_behavior_type ON prospect_behaviors(behavior_type);
CREATE INDEX idx_prospect_behaviors_timestamp ON prospect_behaviors(timestamp DESC);
CREATE INDEX idx_prospect_behaviors_engagement_score ON prospect_behaviors(engagement_score DESC);

-- Performance indexes for engagement patterns
CREATE INDEX idx_engagement_patterns_prospect_id ON engagement_patterns(prospect_id);
CREATE INDEX idx_engagement_patterns_engagement_level ON engagement_patterns(engagement_level);
CREATE INDEX idx_engagement_patterns_last_updated ON engagement_patterns(last_updated DESC);

-- Performance indexes for prospect classifications
CREATE INDEX idx_prospect_classifications_prospect_id ON prospect_classifications(prospect_id);
CREATE INDEX idx_prospect_classifications_classification ON prospect_classifications(classification);
CREATE INDEX idx_prospect_classifications_funnel_stage ON prospect_classifications(funnel_stage);
CREATE INDEX idx_prospect_classifications_engagement_level ON prospect_classifications(engagement_level);
CREATE INDEX idx_prospect_classifications_expires_at ON prospect_classifications(classification_expires_at);
CREATE INDEX idx_prospect_classifications_confidence ON prospect_classifications(confidence_score DESC);

-- Performance indexes for nurturing sequences
CREATE INDEX idx_nurturing_sequences_status ON nurturing_sequences(status);
CREATE INDEX idx_nurturing_sequences_target_classification ON nurturing_sequences(target_classification);
CREATE INDEX idx_nurturing_sequences_target_funnel_stage ON nurturing_sequences(target_funnel_stage);
CREATE INDEX idx_nurturing_sequences_conversion_rate ON nurturing_sequences(conversion_rate DESC);

-- Performance indexes for sequence steps
CREATE INDEX idx_sequence_steps_sequence_id ON sequence_steps(sequence_id);
CREATE INDEX idx_sequence_steps_step_number ON sequence_steps(sequence_id, step_number);
CREATE INDEX idx_sequence_steps_step_type ON sequence_steps(step_type);

-- Performance indexes for prospect enrollments
CREATE INDEX idx_prospect_enrollments_prospect_id ON prospect_sequence_enrollments(prospect_id);
CREATE INDEX idx_prospect_enrollments_sequence_id ON prospect_sequence_enrollments(sequence_id);
CREATE INDEX idx_prospect_enrollments_status ON prospect_sequence_enrollments(status);
CREATE INDEX idx_prospect_enrollments_enrolled_at ON prospect_sequence_enrollments(enrolled_at DESC);
CREATE INDEX idx_prospect_enrollments_current_step ON prospect_sequence_enrollments(current_step);

-- Performance indexes for step executions
CREATE INDEX idx_step_executions_enrollment_id ON sequence_step_executions(enrollment_id);
CREATE INDEX idx_step_executions_step_id ON sequence_step_executions(step_id);
CREATE INDEX idx_step_executions_prospect_id ON sequence_step_executions(prospect_id);
CREATE INDEX idx_step_executions_status ON sequence_step_executions(status);
CREATE INDEX idx_step_executions_scheduled_at ON sequence_step_executions(scheduled_at);
CREATE INDEX idx_step_executions_executed_at ON sequence_step_executions(executed_at DESC);

-- Performance indexes for content variations
CREATE INDEX idx_content_variations_step_id ON content_variations(sequence_step_id);
CREATE INDEX idx_content_variations_variant_type ON content_variations(variant_type);
CREATE INDEX idx_content_variations_performance ON content_variations(performance_score DESC);
CREATE INDEX idx_content_variations_active ON content_variations(is_active);

-- Performance indexes for AI content generations
CREATE INDEX idx_ai_content_prospect_id ON ai_content_generations(prospect_id);
CREATE INDEX idx_ai_content_step_id ON ai_content_generations(sequence_step_id);
CREATE INDEX idx_ai_content_created_at ON ai_content_generations(created_at DESC);
CREATE INDEX idx_ai_content_quality_score ON ai_content_generations(quality_score DESC);