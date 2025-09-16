import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { executeQuery, insertRow, requireRow } from "../shared/database";
import type { 
  GenerateContentRequest, 
  GenerateContentResponse, 
  ContentVariant,
  ProspectClassificationData,
  SequenceStep,
  AIContentGeneration
} from "./types";

// Generate dynamic, personalized content using AI based on prospect data
export const generateContent = api<GenerateContentRequest, GenerateContentResponse>(
  { expose: true, method: "POST", path: "/nurturing/generate-content" },
  wrapAsync(async (req) => {
    validateField(req.prospect_id, "prospect_id", [Rules.required()]);
    validateField(req.sequence_step_id, "sequence_step_id", [Rules.required()]);
    
    // Get prospect classification and behavior data
    const classification = await requireRow(
      () => nurturingDB.queryRow<ProspectClassificationData>`
        SELECT * FROM prospect_classifications WHERE prospect_id = ${req.prospect_id}
      `,
      "prospect classification",
      req.prospect_id
    );
    
    // Get sequence step details
    const step = await requireRow(
      () => nurturingDB.queryRow<SequenceStep>`
        SELECT ss.*, ns.name as sequence_name 
        FROM sequence_steps ss
        JOIN nurturing_sequences ns ON ss.sequence_id = ns.id
        WHERE ss.id = ${req.sequence_step_id}
      `,
      "sequence step",
      req.sequence_step_id
    );
    
    // Get prospect engagement history
    const recentBehaviors = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT behavior_type, engagement_score, timestamp, metadata 
        FROM prospect_behaviors 
        WHERE prospect_id = ${req.prospect_id}
        ORDER BY timestamp DESC 
        LIMIT 10
      `,
      "get prospect behaviors"
    );
    
    // Generate personalized content
    const generationStart = Date.now();
    const contentResult = await generatePersonalizedContent(
      classification,
      step,
      recentBehaviors,
      req.content_variant || 'personal',
      req.custom_variables || {},
      req.tone_preference
    );
    const generationTime = Date.now() - generationStart;
    
    // Log AI content generation
    const generationLog = await insertRow(
      () => nurturingDB.queryRow<AIContentGeneration>`
        INSERT INTO ai_content_generations (
          prospect_id, sequence_step_id, prompt_used, generated_content,
          personalization_factors, quality_score, relevance_score,
          sentiment_tone, reading_level, content_length, 
          ai_model_version, generation_time_ms
        ) VALUES (
          ${req.prospect_id}, ${req.sequence_step_id}, ${contentResult.promptUsed},
          ${contentResult.content}, ${JSON.stringify(contentResult.personalizationData)},
          ${contentResult.qualityMetrics.quality_score}, ${contentResult.qualityMetrics.relevance_score},
          ${contentResult.qualityMetrics.sentiment_tone}, ${contentResult.qualityMetrics.reading_level},
          ${contentResult.content.length}, 'gpt-4', ${generationTime}
        )
        RETURNING *
      `,
      "log content generation"
    );
    
    return {
      content: contentResult.content,
      personalization_data: contentResult.personalizationData,
      ai_insights: contentResult.aiInsights,
      quality_metrics: contentResult.qualityMetrics,
      generation_id: generationLog.id
    };
  })
);

interface ContentGenerationResult {
  content: string;
  personalizationData: Record<string, any>;
  aiInsights: string[];
  qualityMetrics: Record<string, any>;
  promptUsed: string;
}

async function generatePersonalizedContent(
  classification: ProspectClassificationData,
  step: SequenceStep & { sequence_name: string },
  recentBehaviors: any[],
  contentVariant: ContentVariant,
  customVariables: Record<string, any>,
  tonePreference?: string
): Promise<ContentGenerationResult> {
  
  // Build context for AI generation
  const context = buildContextForGeneration(classification, step, recentBehaviors, customVariables);
  
  // Generate content prompt based on classification and step
  const prompt = buildContentPrompt(
    classification, 
    step, 
    context, 
    contentVariant, 
    tonePreference
  );
  
  // Simulate AI content generation (in production, this would call OpenAI/Claude)
  const generatedContent = await simulateAIContentGeneration(prompt, context);
  
  // Personalize with variable substitution
  const personalizedContent = personalizeContent(
    generatedContent, 
    context.personalizationVars
  );
  
  // Analyze content quality
  const qualityMetrics = analyzeContentQuality(personalizedContent, classification);
  
  // Generate AI insights about the content
  const aiInsights = generateContentInsights(
    personalizedContent, 
    classification, 
    recentBehaviors
  );
  
  return {
    content: personalizedContent,
    personalizationData: context.personalizationVars,
    aiInsights,
    qualityMetrics,
    promptUsed: prompt
  };
}

function buildContextForGeneration(
  classification: ProspectClassificationData,
  step: SequenceStep & { sequence_name: string },
  recentBehaviors: any[],
  customVariables: Record<string, any>
): any {
  return {
    prospect: {
      classification: classification.classification,
      funnelStage: classification.funnel_stage,
      engagementLevel: classification.engagement_level,
      closeProbability: classification.estimated_close_probability,
      behaviorInsights: classification.behavioral_indicators,
      nextBestActions: classification.next_best_actions
    },
    sequence: {
      name: step.sequence_name,
      stepNumber: step.step_number,
      stepType: step.step_type,
      stepName: step.name
    },
    recentActivity: {
      behaviors: recentBehaviors.slice(0, 5),
      lastEngagement: recentBehaviors[0]?.timestamp,
      engagementTrend: analyzeEngagementTrend(recentBehaviors)
    },
    personalizationVars: {
      ...extractPersonalizationVariables(classification),
      ...customVariables
    }
  };
}

function buildContentPrompt(
  classification: ProspectClassificationData,
  step: SequenceStep & { sequence_name: string },
  context: any,
  contentVariant: ContentVariant,
  tonePreference?: string
): string {
  const basePrompt = `Generate ${contentVariant} content for a ${step.step_type} in a nurturing sequence.

Prospect Context:
- Classification: ${classification.classification}
- Funnel Stage: ${classification.funnel_stage}
- Engagement Level: ${classification.engagement_level}
- Close Probability: ${(classification.estimated_close_probability * 100).toFixed(1)}%

Recent Behavior: ${context.recentActivity.engagementTrend}

Content Requirements:
- Step: ${step.step_number} of "${step.sequence_name}" sequence
- Type: ${step.step_type}
- Goal: ${step.name}
- Tone: ${tonePreference || getDefaultTone(contentVariant, classification.classification)}

Template to enhance: ${step.content_template}

Instructions:
1. Personalize based on prospect classification and behavior
2. Match the specified tone and variant style
3. Include relevant value propositions for their funnel stage
4. Add compelling call-to-action appropriate for their engagement level
5. Keep content concise and scannable
6. Use behavior insights to address likely concerns or interests

Generate enhanced, personalized content:`;

  return basePrompt;
}

async function simulateAIContentGeneration(prompt: string, context: any): Promise<string> {
  // In production, this would call OpenAI API
  // For simulation, we'll generate contextually appropriate content
  
  const { prospect, sequence, recentActivity } = context;
  
  const contentTemplates = {
    hot: {
      email: `Hi {{name}},

I noticed you've been actively engaging with our content recently, particularly around {{topic}}. Based on your interest level, I'd love to have a quick conversation about how we can help {{company}} achieve {{specific_goal}}.

Your engagement suggests you're ready to move forward - would you be available for a 15-minute call this week to discuss next steps?

Looking forward to connecting,
{{sender_name}}`,
      
      call: `Hi {{name}}, this is {{sender_name}}. I've been tracking your engagement and can see you're actively researching solutions for {{pain_point}}. I have some insights specific to {{company}} that could be valuable. Do you have 5 minutes to chat?`
    },
    
    warm: {
      email: `Hi {{name}},

I saw that you downloaded our {{resource_name}} guide last week. Since you're interested in {{topic}}, I thought you might find value in seeing how companies like {{similar_company}} have successfully implemented similar strategies.

I've prepared a brief case study that shows {{specific_benefit}} - would you like me to send it over?

Best regards,
{{sender_name}}`,
      
      social_media: `Hi {{name}}! Noticed your interest in {{topic}}. We've helped companies similar to {{company}} achieve {{specific_result}}. Would love to share some insights with you.`
    },
    
    cold: {
      email: `Hi {{name}},

I hope this email finds you well. I've been researching {{company}} and noticed you might be facing challenges with {{common_pain_point}}.

We've helped companies in {{industry}} achieve {{specific_outcome}} through {{solution_approach}}. 

Would you be interested in a brief 10-minute conversation to explore if this could be relevant for {{company}}?

Best,
{{sender_name}}`,
      
      delay: `Wait 3 days for prospect to engage with previous content before next touchpoint.`
    }
  };
  
  const classificationTemplates = contentTemplates[prospect.classification as keyof typeof contentTemplates] || contentTemplates.cold;
  const template = classificationTemplates[sequence.stepType as keyof typeof classificationTemplates] || classificationTemplates.email;
  
  return template;
}

function personalizeContent(content: string, personalizationVars: Record<string, any>): string {
  let personalizedContent = content;
  
  // Replace personalization variables
  Object.entries(personalizationVars).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    personalizedContent = personalizedContent.replace(regex, value || `[${key}]`);
  });
  
  return personalizedContent;
}

function analyzeContentQuality(content: string, classification: ProspectClassificationData): Record<string, any> {
  const wordCount = content.split(/\s+/).length;
  const sentenceCount = content.split(/[.!?]+/).length;
  const avgWordsPerSentence = wordCount / sentenceCount;
  
  // Calculate quality scores
  const lengthScore = wordCount >= 50 && wordCount <= 200 ? 1.0 : 0.7;
  const readabilityScore = avgWordsPerSentence <= 20 ? 1.0 : 0.8;
  const personalizationScore = (content.match(/{{.*?}}/g) || []).length > 0 ? 0.9 : 0.6;
  
  const qualityScore = (lengthScore + readabilityScore + personalizationScore) / 3;
  const relevanceScore = calculateRelevanceScore(content, classification);
  
  return {
    quality_score: Math.round(qualityScore * 100) / 100,
    relevance_score: Math.round(relevanceScore * 100) / 100,
    word_count: wordCount,
    sentence_count: sentenceCount,
    sentiment_tone: determineSentimentTone(content),
    reading_level: avgWordsPerSentence <= 15 ? 'easy' : avgWordsPerSentence <= 20 ? 'medium' : 'complex',
    personalization_elements: (content.match(/{{.*?}}/g) || []).length
  };
}

function calculateRelevanceScore(content: string, classification: ProspectClassificationData): number {
  const contentLower = content.toLowerCase();
  let relevanceScore = 0.5; // Base score
  
  // Check for classification-appropriate language
  const classificationKeywords = {
    hot: ['ready', 'next steps', 'call', 'schedule', 'move forward'],
    warm: ['interested', 'learn more', 'case study', 'demo', 'explore'],
    cold: ['introduce', 'help', 'challenge', 'solution', 'benefit'],
    unengaged: ['reconnect', 'still relevant', 'different approach', 'final']
  };
  
  const keywords = classificationKeywords[classification.classification] || [];
  const keywordMatches = keywords.filter(keyword => contentLower.includes(keyword)).length;
  relevanceScore += (keywordMatches / keywords.length) * 0.3;
  
  // Check for funnel stage alignment
  const stageKeywords = {
    awareness: ['introduce', 'discover', 'learn'],
    interest: ['benefits', 'value', 'how'],
    consideration: ['compare', 'evaluate', 'options'],
    intent: ['ready', 'implement', 'start'],
    decision: ['choose', 'decide', 'commit']
  };
  
  const stageWords = stageKeywords[classification.funnel_stage] || [];
  const stageMatches = stageWords.filter(word => contentLower.includes(word)).length;
  relevanceScore += (stageMatches / stageWords.length) * 0.2;
  
  return Math.min(1.0, relevanceScore);
}

function determineSentimentTone(content: string): string {
  const contentLower = content.toLowerCase();
  
  const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'excited', 'love', 'perfect'];
  const urgentWords = ['urgent', 'immediately', 'asap', 'quickly', 'deadline'];
  const professionalWords = ['pleased', 'opportunity', 'collaborate', 'partnership'];
  
  const positiveCount = positiveWords.filter(word => contentLower.includes(word)).length;
  const urgentCount = urgentWords.filter(word => contentLower.includes(word)).length;
  const professionalCount = professionalWords.filter(word => contentLower.includes(word)).length;
  
  if (urgentCount > 0) return 'urgent';
  if (positiveCount > professionalCount) return 'enthusiastic';
  if (professionalCount > 0) return 'professional';
  return 'neutral';
}

function generateContentInsights(
  content: string, 
  classification: ProspectClassificationData,
  recentBehaviors: any[]
): string[] {
  const insights: string[] = [];
  
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 150) {
    insights.push("Content is on the longer side - consider A/B testing with shorter version");
  }
  
  if (classification.classification === 'hot' && !content.toLowerCase().includes('call')) {
    insights.push("Hot prospects respond well to direct call-to-action requests");
  }
  
  if (classification.engagement_level === 'low' && content.includes('{{')) {
    insights.push("High personalization may help re-engage low-engagement prospects");
  }
  
  const hasRecentEmailActivity = recentBehaviors.some(b => 
    b.behavior_type === 'email_open' || b.behavior_type === 'email_click'
  );
  
  if (!hasRecentEmailActivity && content.length > 100) {
    insights.push("Prospect hasn't engaged recently - shorter content may perform better");
  }
  
  if (classification.funnel_stage === 'decision' && !content.toLowerCase().includes('demo')) {
    insights.push("Decision stage prospects often benefit from demo or trial offers");
  }
  
  return insights;
}

function getDefaultTone(variant: ContentVariant, classification: string): string {
  const toneMap = {
    personal: classification === 'hot' ? 'enthusiastic' : 'friendly',
    professional: 'formal',
    casual: 'conversational',
    formal: 'professional',
    educational: 'informative',
    promotional: 'persuasive'
  };
  
  return toneMap[variant] || 'professional';
}

function extractPersonalizationVariables(classification: ProspectClassificationData): Record<string, any> {
  return {
    name: '{{name}}',
    company: '{{company}}',
    position: '{{position}}',
    sender_name: '{{sender_name}}',
    classification: classification.classification,
    funnel_stage: classification.funnel_stage,
    engagement_level: classification.engagement_level,
    topic: '{{topic}}',
    pain_point: '{{pain_point}}',
    specific_goal: '{{specific_goal}}',
    industry: '{{industry}}',
    similar_company: '{{similar_company}}',
    specific_benefit: '{{specific_benefit}}',
    resource_name: '{{resource_name}}',
    common_pain_point: '{{common_pain_point}}',
    solution_approach: '{{solution_approach}}',
    specific_outcome: '{{specific_outcome}}'
  };
}

function analyzeEngagementTrend(behaviors: any[]): string {
  if (behaviors.length === 0) return "No recent activity";
  
  const recentScores = behaviors.slice(0, 5).map(b => b.engagement_score || 0);
  const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  
  if (avgRecent >= 7) return "High engagement trend";
  if (avgRecent >= 5) return "Moderate engagement";
  if (avgRecent >= 3) return "Low but present engagement";
  return "Declining engagement";
}