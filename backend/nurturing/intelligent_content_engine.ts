import { api } from "encore.dev/api";
import { db } from "./db";
import * as ai from "../ai/openai";
import { AdvancedEngagementAnalysis } from "./advanced_behavior_analyzer";

export interface IntelligentContentRequest {
  prospectId: string;
  contentType: 'email' | 'sms' | 'social' | 'call_script';
  purpose: 'nurture' | 'follow_up' | 'demo_invite' | 'closing' | 'retention';
  context?: {
    previousInteraction?: string;
    triggerEvent?: string;
    urgency?: 'low' | 'medium' | 'high';
    customVariables?: Record<string, any>;
  };
}

export interface IntelligentContentResponse {
  subject?: string;
  content: string;
  callToAction: string;
  personalizationLevel: number;
  confidenceScore: number;
  reasoning: string;
  alternatives: ContentAlternative[];
  optimalSendTime: Date;
  expectedResponse: string;
}

export interface ContentAlternative {
  content: string;
  subject?: string;
  tone: string;
  strategy: string;
  confidenceScore: number;
}

export interface DynamicPersonalization {
  variables: Record<string, any>;
  conditionalBlocks: ConditionalBlock[];
  aiGeneratedSections: AiSection[];
}

export interface ConditionalBlock {
  condition: string;
  content: string;
  priority: number;
}

export interface AiSection {
  section: string;
  prompt: string;
  generatedContent: string;
  reasoning: string;
}

export const generateIntelligentContent = api(
  { method: "POST", path: "/content/intelligent-generate", expose: true },
  async (req: IntelligentContentRequest): Promise<IntelligentContentResponse> => {
    // Get comprehensive prospect analysis
    const [behaviorAnalysis, classification, engagement, recentHistory] = await Promise.all([
      getAdvancedBehaviorAnalysis(req.prospectId),
      getProspectClassification(req.prospectId),
      getEngagementPattern(req.prospectId),
      getRecentInteractionHistory(req.prospectId, 10)
    ]);

    // Generate dynamic personalization data
    const personalization = await generateDynamicPersonalization(
      req.prospectId,
      behaviorAnalysis,
      classification,
      engagement,
      req.context
    );

    // Create content strategy based on analysis
    const strategy = generateContentStrategy(
      behaviorAnalysis,
      classification,
      req.purpose,
      req.context
    );

    // Generate primary content using AI
    const primaryContent = await generateAIContent(
      req,
      strategy,
      personalization,
      behaviorAnalysis
    );

    // Generate alternative content approaches
    const alternatives = await generateContentAlternatives(
      req,
      strategy,
      personalization,
      3 // Generate 3 alternatives
    );

    // Calculate optimal send time
    const optimalSendTime = calculateOptimalSendTime(
      behaviorAnalysis.optimalTiming,
      req.context?.urgency || 'medium'
    );

    // Predict expected response
    const expectedResponse = predictExpectedResponse(
      behaviorAnalysis,
      classification,
      strategy
    );

    return {
      subject: primaryContent.subject,
      content: primaryContent.content,
      callToAction: primaryContent.callToAction,
      personalizationLevel: personalization.variables ? Object.keys(personalization.variables).length : 0,
      confidenceScore: primaryContent.confidenceScore,
      reasoning: primaryContent.reasoning,
      alternatives,
      optimalSendTime,
      expectedResponse
    };
  }
);

export const generateSequenceContent = api(
  { method: "POST", path: "/sequences/:sequenceId/generate-content", expose: true },
  async ({ 
    sequenceId, 
    stepNumber, 
    prospectIds 
  }: { 
    sequenceId: string; 
    stepNumber: number; 
    prospectIds: string[] 
  }) => {
    const results: any = {};

    // Get sequence details
    const sequence = await getSequenceDetails(sequenceId);
    const step = await getSequenceStep(sequenceId, stepNumber);

    // Generate personalized content for each prospect
    for (const prospectId of prospectIds) {
      try {
        const content = await generateIntelligentContent({
          prospectId,
          contentType: step.type as any,
          purpose: determinePurposeFromStep(step, sequence),
          context: {
            triggerEvent: `sequence_step_${stepNumber}`,
            customVariables: { sequenceName: sequence.name, stepNumber }
          }
        });

        results[prospectId] = content;
      } catch (error) {
        console.error(`Failed to generate content for prospect ${prospectId}:`, error);
      }
    }

    return results;
  }
);

export const optimizeContentPerformance = api(
  { method: "POST", path: "/content/optimize", expose: true },
  async ({ 
    templateId, 
    performanceData 
  }: { 
    templateId: string; 
    performanceData: any 
  }): Promise<{
    optimizedContent: string;
    improvements: string[];
    expectedLift: number;
  }> => {
    // Get template and performance history
    const template = await getContentTemplate(templateId);
    const historicalPerformance = await getTemplatePerformance(templateId);

    // Analyze performance patterns
    const analysis = analyzePerformancePatterns(performanceData, historicalPerformance);

    // Generate optimized version using AI
    const optimized = await ai.optimizeContent({
      originalContent: template.content,
      performanceData: analysis,
      optimizationGoals: ['open_rate', 'click_rate', 'response_rate']
    });

    return optimized;
  }
);

export interface SubjectLineResult {
  subject: string;
  strategy: string;
  predictedOpenRate: number;
}

export const generatePersonalizedSubjectLines = api(
  { method: "POST", path: "/content/subject-lines", expose: true },
  async ({ 
    prospectId, 
    contentPurpose, 
    count = 5 
  }: { 
    prospectId: string; 
    contentPurpose: string; 
    count?: number 
  }) => {
    const [behaviorAnalysis, classification] = await Promise.all([
      getAdvancedBehaviorAnalysis(prospectId),
      getProspectClassification(prospectId)
    ]);

    const subjectLines = await ai.generateSubjectLines({
      prospectData: {
        classification: classification?.classification,
        stage: classification?.stage,
        industry: classification?.industry,
        behaviorSignals: behaviorAnalysis.behaviorSignals
      },
      purpose: contentPurpose,
      count,
      strategies: ['curiosity', 'urgency', 'personal', 'benefit', 'question']
    });

    return subjectLines;
  }
);

async function generateDynamicPersonalization(
  prospectId: string,
  behaviorAnalysis: AdvancedEngagementAnalysis,
  classification: any,
  engagement: any,
  context?: any
): Promise<DynamicPersonalization> {
  // Get prospect data
  const prospectData = await getProspectData(prospectId);
  
  // Generate comprehensive variable set
  const variables: Record<string, any> = {
    // Basic prospect info
    firstName: prospectData?.firstName || 'there',
    lastName: prospectData?.lastName || '',
    fullName: `${prospectData?.firstName || ''} ${prospectData?.lastName || ''}`.trim(),
    company: prospectData?.company || 'your company',
    title: prospectData?.title || 'your role',
    industry: prospectData?.industry || 'your industry',
    
    // AI-driven insights
    engagementScore: behaviorAnalysis.engagementScore,
    intentLevel: behaviorAnalysis.intentLevel,
    nextBestAction: behaviorAnalysis.nextBestAction,
    churnRisk: behaviorAnalysis.predictedChurn.riskLevel,
    
    // Behavioral data
    totalEngagements: engagement?.total_engagements || 0,
    engagementTrend: engagement?.engagement_trend || 'stable',
    responseRate: Math.round((engagement?.response_rate || 0) * 100),
    
    // Dynamic timing
    preferredContactTime: behaviorAnalysis.optimalTiming.preferredHours[0] || 10,
    preferredDay: behaviorAnalysis.optimalTiming.preferredDays[0] || 'Tuesday',
    
    // Content preferences
    topContentType: behaviorAnalysis.contentPreferences[0]?.type || 'email',
    primaryInterest: classification?.interests?.[0] || 'your business',
    mainPainPoint: classification?.pain_points?.[0] || 'operational efficiency',
    
    // Contextual
    daysSinceLastContact: calculateDaysSinceLastContact(prospectId),
    currentDateTime: new Date().toLocaleString(),
    seasonalContext: getSeasonalContext(),
    
    // AI-generated insights
    topBuyingSignal: classification?.buying_signals?.[0] || 'research activity',
    predictedAction: behaviorAnalysis.sequenceRecommendations[0]?.expectedOutcome || 'engagement'
  };

  // Generate conditional blocks based on behavior
  const conditionalBlocks: ConditionalBlock[] = [];

  if (behaviorAnalysis.intentLevel === 'urgent') {
    conditionalBlocks.push({
      condition: 'intent_urgent',
      content: 'Given your recent high-intent activities, I wanted to reach out directly.',
      priority: 10
    });
  }

  if (behaviorAnalysis.predictedChurn.riskLevel === 'high') {
    conditionalBlocks.push({
      condition: 'churn_risk_high',
      content: 'I noticed you haven\'t been as active lately. Is there anything I can help clarify?',
      priority: 9
    });
  }

  if (engagement?.engagement_trend === 'increasing') {
    conditionalBlocks.push({
      condition: 'engagement_increasing',
      content: 'Your increasing engagement shows you\'re actively evaluating solutions.',
      priority: 8
    });
  }

  // Generate AI sections for dynamic content
  const aiGeneratedSections: AiSection[] = await generateAISections(
    prospectId,
    behaviorAnalysis,
    classification,
    context
  );

  return {
    variables,
    conditionalBlocks,
    aiGeneratedSections
  };
}

function generateContentStrategy(
  behaviorAnalysis: AdvancedEngagementAnalysis,
  classification: any,
  purpose: string,
  context?: any
): any {
  return {
    primaryTone: determineTone(behaviorAnalysis.intentLevel, classification?.stage),
    approach: determineApproach(behaviorAnalysis, purpose),
    focusAreas: determineFocusAreas(behaviorAnalysis.behaviorSignals, classification),
    urgencyLevel: determineUrgencyLevel(behaviorAnalysis, context),
    callToActionType: determineCallToActionType(behaviorAnalysis.intentLevel, purpose),
    personalizationLevel: 'high'
  };
}

async function generateAIContent(
  req: IntelligentContentRequest,
  strategy: any,
  personalization: DynamicPersonalization,
  behaviorAnalysis: AdvancedEngagementAnalysis
): Promise<{
  subject?: string;
  content: string;
  callToAction: string;
  confidenceScore: number;
  reasoning: string;
}> {
  const prompt = buildContentPrompt(req, strategy, personalization, behaviorAnalysis);
  
  const aiResponse = await ai.generateContent({
    prompt,
    type: req.contentType,
    maxTokens: req.contentType === 'sms' ? 160 : 500,
    temperature: 0.7
  });

  // Apply personalization variables
  let finalContent = aiResponse.content;
  Object.entries(personalization.variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    finalContent = finalContent.replace(regex, value?.toString() || '');
  });

  // Apply conditional blocks
  personalization.conditionalBlocks.forEach(block => {
    if (shouldIncludeConditionalBlock(block, behaviorAnalysis)) {
      finalContent = finalContent.replace(`{{${block.condition}}}`, block.content);
    }
  });

  // Apply AI-generated sections
  personalization.aiGeneratedSections.forEach(section => {
    finalContent = finalContent.replace(`{{${section.section}}}`, section.generatedContent);
  });

  return {
    subject: aiResponse.subject,
    content: finalContent,
    callToAction: aiResponse.callToAction || generateCallToAction(req.purpose, behaviorAnalysis.intentLevel),
    confidenceScore: aiResponse.confidence || 0.8,
    reasoning: aiResponse.reasoning || 'AI-generated based on behavior analysis and personalization data'
  };
}

async function generateContentAlternatives(
  req: IntelligentContentRequest,
  strategy: any,
  personalization: DynamicPersonalization,
  count: number
): Promise<ContentAlternative[]> {
  const alternatives: ContentAlternative[] = [];
  const strategies = ['direct', 'consultative', 'social_proof', 'curiosity', 'urgency'];
  
  for (let i = 0; i < count && i < strategies.length; i++) {
    const altStrategy = { ...strategy, approach: strategies[i] };
    const altPrompt = buildContentPrompt(req, altStrategy, personalization, null);
    
    try {
      const aiResponse = await ai.generateContent({
        prompt: altPrompt,
        type: req.contentType,
        maxTokens: req.contentType === 'sms' ? 160 : 500,
        temperature: 0.8
      });

      alternatives.push({
        content: aiResponse.content,
        subject: aiResponse.subject,
        tone: strategies[i],
        strategy: strategies[i],
        confidenceScore: aiResponse.confidence || 0.7
      });
    } catch (error) {
      console.error(`Failed to generate alternative content with strategy ${strategies[i]}:`, error);
    }
  }

  return alternatives;
}

async function generateAISections(
  prospectId: string,
  behaviorAnalysis: AdvancedEngagementAnalysis,
  classification: any,
  context?: any
): Promise<AiSection[]> {
  const sections: AiSection[] = [];

  // Generate pain point section
  if (classification?.pain_points?.length > 0) {
    const painPointPrompt = `Generate a 2-sentence section addressing this prospect's main pain point: ${classification.pain_points[0]}. Make it specific to their ${classification?.industry} industry.`;
    
    try {
      const painPointContent = await ai.generateText(painPointPrompt);
      sections.push({
        section: 'pain_point_section',
        prompt: painPointPrompt,
        generatedContent: painPointContent,
        reasoning: 'Addresses prospect\'s primary pain point'
      });
    } catch (error) {
      console.error('Failed to generate pain point section:', error);
    }
  }

  // Generate success story section
  if (behaviorAnalysis.intentLevel === 'high' || behaviorAnalysis.intentLevel === 'urgent') {
    const successPrompt = `Generate a brief success story (2-3 sentences) for a ${classification?.industry} company similar to ${classification?.company}. Focus on ${classification?.interests?.[0] || 'business growth'}.`;
    
    try {
      const successStory = await ai.generateText(successPrompt);
      sections.push({
        section: 'success_story',
        prompt: successPrompt,
        generatedContent: successStory,
        reasoning: 'Provides social proof for high-intent prospect'
      });
    } catch (error) {
      console.error('Failed to generate success story:', error);
    }
  }

  // Generate urgency section
  if (behaviorAnalysis.predictedChurn.riskLevel === 'high') {
    const urgencyPrompt = `Generate a tactful urgency statement (1-2 sentences) that addresses potential churn without being pushy. Focus on value and missing opportunities.`;
    
    try {
      const urgencyContent = await ai.generateText(urgencyPrompt);
      sections.push({
        section: 'urgency_section',
        prompt: urgencyPrompt,
        generatedContent: urgencyContent,
        reasoning: 'Addresses churn risk with value-focused urgency'
      });
    } catch (error) {
      console.error('Failed to generate urgency section:', error);
    }
  }

  return sections;
}

function buildContentPrompt(
  req: IntelligentContentRequest,
  strategy: any,
  personalization: DynamicPersonalization,
  behaviorAnalysis: AdvancedEngagementAnalysis | null
): string {
  let prompt = `Generate a ${req.contentType} for ${req.purpose} with the following context:\n\n`;
  
  prompt += `Prospect Details:\n`;
  prompt += `- Name: ${personalization.variables.firstName} ${personalization.variables.lastName}\n`;
  prompt += `- Company: ${personalization.variables.company}\n`;
  prompt += `- Title: ${personalization.variables.title}\n`;
  prompt += `- Industry: ${personalization.variables.industry}\n\n`;
  
  if (behaviorAnalysis) {
    prompt += `Behavioral Analysis:\n`;
    prompt += `- Engagement Score: ${behaviorAnalysis.engagementScore}/100\n`;
    prompt += `- Intent Level: ${behaviorAnalysis.intentLevel}\n`;
    prompt += `- Churn Risk: ${behaviorAnalysis.predictedChurn.riskLevel}\n`;
    prompt += `- Next Best Action: ${behaviorAnalysis.nextBestAction}\n\n`;
  }
  
  prompt += `Content Strategy:\n`;
  prompt += `- Tone: ${strategy.primaryTone}\n`;
  prompt += `- Approach: ${strategy.approach}\n`;
  prompt += `- Urgency: ${strategy.urgencyLevel}\n`;
  prompt += `- CTA Type: ${strategy.callToActionType}\n\n`;
  
  prompt += `Requirements:\n`;
  prompt += `- Keep ${req.contentType === 'sms' ? 'under 160 characters' : 'concise and actionable'}\n`;
  prompt += `- Include personalization variables where appropriate\n`;
  prompt += `- Make it sound natural and conversational\n`;
  prompt += `- Include a clear call-to-action\n`;
  
  if (req.contentType === 'email') {
    prompt += `- Provide both subject line and body content\n`;
  }

  return prompt;
}

// Helper functions
function determineTone(intentLevel: string, stage?: string): string {
  if (intentLevel === 'urgent') return 'direct';
  if (intentLevel === 'high') return 'professional';
  if (stage === 'awareness') return 'educational';
  return 'friendly';
}

function determineApproach(behaviorAnalysis: AdvancedEngagementAnalysis, purpose: string): string {
  if (purpose === 'closing') return 'direct';
  if (behaviorAnalysis.intentLevel === 'urgent') return 'consultative';
  if (behaviorAnalysis.predictedChurn.riskLevel === 'high') return 'value_reinforcement';
  return 'relationship_building';
}

function determineFocusAreas(behaviorSignals: any[], classification: any): string[] {
  const areas = [];
  
  if (behaviorSignals.some(s => s.type === 'form_engagement')) {
    areas.push('product_information');
  }
  
  if (behaviorSignals.some(s => s.type === 'website_engagement')) {
    areas.push('content_interests');
  }
  
  if (classification?.pain_points?.length > 0) {
    areas.push('pain_point_resolution');
  }
  
  return areas.length > 0 ? areas : ['general_value_proposition'];
}

function determineUrgencyLevel(behaviorAnalysis: AdvancedEngagementAnalysis, context?: any): string {
  if (context?.urgency) return context.urgency;
  if (behaviorAnalysis.intentLevel === 'urgent') return 'high';
  if (behaviorAnalysis.predictedChurn.riskLevel === 'high') return 'medium';
  return 'low';
}

function determineCallToActionType(intentLevel: string, purpose: string): string {
  if (purpose === 'demo_invite') return 'schedule_demo';
  if (purpose === 'closing') return 'make_decision';
  if (intentLevel === 'urgent') return 'immediate_response';
  if (intentLevel === 'high') return 'schedule_call';
  return 'engage_content';
}

function calculateOptimalSendTime(optimalTiming: any, urgency: string): Date {
  const now = new Date();
  const sendTime = new Date();
  
  if (urgency === 'high') {
    // Send within 1 hour for high urgency
    sendTime.setHours(now.getHours() + 1);
    return sendTime;
  }
  
  // Use optimal timing data
  const preferredHour = optimalTiming?.preferredHours?.[0] || 10;
  sendTime.setHours(preferredHour, 0, 0, 0);
  
  // If preferred time has passed today, schedule for tomorrow
  if (sendTime <= now) {
    sendTime.setDate(sendTime.getDate() + 1);
  }
  
  return sendTime;
}

function predictExpectedResponse(
  behaviorAnalysis: AdvancedEngagementAnalysis,
  classification: any,
  strategy: any
): string {
  if (behaviorAnalysis.intentLevel === 'urgent') {
    return 'Meeting scheduled within 24 hours';
  } else if (behaviorAnalysis.intentLevel === 'high') {
    return 'Positive response or demo request';
  } else if (behaviorAnalysis.engagementScore > 60) {
    return 'Content engagement or reply';
  } else {
    return 'Improved engagement score';
  }
}

function shouldIncludeConditionalBlock(block: ConditionalBlock, behaviorAnalysis: AdvancedEngagementAnalysis): boolean {
  switch (block.condition) {
    case 'intent_urgent':
      return behaviorAnalysis.intentLevel === 'urgent';
    case 'churn_risk_high':
      return behaviorAnalysis.predictedChurn.riskLevel === 'high';
    case 'engagement_increasing':
      return behaviorAnalysis.behaviorSignals.some(s => s.type === 'response_pattern' && s.strength > 0.7);
    default:
      return false;
  }
}

function generateCallToAction(purpose: string, intentLevel: string): string {
  const ctas = {
    'nurture': [
      'What are your thoughts on this?',
      'Would you like to learn more?',
      'Is this relevant to your current situation?'
    ],
    'demo_invite': [
      'Would you like to see this in action?',
      'Should we schedule a quick demo?',
      'Want to see how this could work for your team?'
    ],
    'follow_up': [
      'What questions do you have?',
      'Should we discuss this further?',
      'What would be most helpful to explore next?'
    ],
    'closing': [
      'Are you ready to move forward?',
      'Should we get started?',
      'What do you need to make a decision?'
    ]
  };

  const urgentCtas = [
    'Can we connect today?',
    'Should I call you this afternoon?',
    'Is now a good time to discuss?'
  ];

  if (intentLevel === 'urgent') {
    return urgentCtas[Math.floor(Math.random() * urgentCtas.length)];
  }

  const purposeCtas = ctas[purpose] || ctas['nurture'];
  return purposeCtas[Math.floor(Math.random() * purposeCtas.length)];
}

function calculateDaysSinceLastContact(prospectId: string): number {
  // This would query the database for the last contact
  // For now, return a placeholder
  return 7;
}

function getSeasonalContext(): string {
  const month = new Date().getMonth();
  const seasonalContexts = {
    0: 'New Year planning', 1: 'Q1 initiatives', 2: 'Q1 initiatives',
    3: 'Q2 planning', 4: 'Spring initiatives', 5: 'Mid-year planning',
    6: 'Summer projects', 7: 'Summer projects', 8: 'Fall planning',
    9: 'Q4 initiatives', 10: 'Year-end planning', 11: 'Holiday season'
  };
  return seasonalContexts[month] || 'current business cycle';
}

// Placeholder functions for external data
async function getAdvancedBehaviorAnalysis(prospectId: string): Promise<AdvancedEngagementAnalysis> {
  // This would call the advanced behavior analyzer
  return {
    prospectId,
    behaviorSignals: [],
    engagementScore: 65,
    intentLevel: 'medium',
    nextBestAction: 'Send personalized content',
    optimalTiming: {
      preferredDays: ['Tuesday', 'Wednesday'],
      preferredHours: [10, 14],
      timezone: 'UTC',
      responseWindow: 24,
      confidence: 0.8
    },
    contentPreferences: [],
    predictedChurn: {
      riskLevel: 'low',
      probability: 0.2,
      factors: [],
      timeframe: 30
    },
    sequenceRecommendations: []
  };
}

async function getProspectClassification(prospectId: string): Promise<any> {
  const result = await db.queryRow`
    SELECT * FROM prospect_classifications WHERE prospect_id = ${prospectId}
  `;
  return result;
}

async function getEngagementPattern(prospectId: string): Promise<any> {
  const result = await db.queryRow`
    SELECT * FROM engagement_patterns WHERE prospect_id = ${prospectId}
  `;
  return result;
}

async function getRecentInteractionHistory(prospectId: string, limit: number): Promise<any[]> {
  const result = await db.queryAll`
    SELECT * FROM prospect_behaviors 
    WHERE prospect_id = ${prospectId} 
    ORDER BY timestamp DESC 
    LIMIT ${limit}
  `;
  return result;
}

async function getProspectData(prospectId: string): Promise<any> {
  // This would call the prospect service
  return {
    firstName: 'John',
    lastName: 'Doe',
    company: 'Tech Corp',
    title: 'CTO',
    industry: 'Technology'
  };
}

async function getSequenceDetails(sequenceId: string): Promise<any> {
  const result = await db.queryRow`
    SELECT * FROM nurturing_sequences WHERE id = ${sequenceId}
  `;
  return result;
}

async function getSequenceStep(sequenceId: string, stepNumber: number): Promise<any> {
  const result = await db.queryRow`
    SELECT * FROM nurturing_steps 
    WHERE sequence_id = ${sequenceId} AND step_number = ${stepNumber}
  `;
  return result;
}

function determinePurposeFromStep(step: any, sequence: any): string {
  if (step.type === 'email' && sequence.name.toLowerCase().includes('demo')) {
    return 'demo_invite';
  }
  if (step.step_number === 1) {
    return 'nurture';
  }
  return 'follow_up';
}

async function getContentTemplate(templateId: string): Promise<any> {
  const result = await db.queryRow`
    SELECT * FROM content_templates WHERE id = ${templateId}
  `;
  return result;
}

async function getTemplatePerformance(templateId: string): Promise<any> {
  // This would aggregate performance data for the template
  return {
    openRate: 0.25,
    clickRate: 0.05,
    responseRate: 0.02,
    totalSent: 100
  };
}

function analyzePerformancePatterns(current: any, historical: any): any {
  return {
    trends: [],
    improvements: [],
    weaknesses: []
  };
}