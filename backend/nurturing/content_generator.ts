import { api } from "encore.dev/api";
import { db } from "./db";
import * as ai from "../ai/openai";
import { ContentTemplate, GenerateContentRequest, PersonalizationRule } from "./types";

export const generatePersonalizedContent = api(
  { method: "POST", path: "/content/generate", expose: true },
  async (req: GenerateContentRequest): Promise<{ subject?: string; content: string; variables: Record<string, string> }> => {
    // Get template
    const template = await getTemplate(req.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Get prospect data and classification
    const prospectData = await getProspectData(req.prospectId);
    const classification = await getProspectClassification(req.prospectId);
    const engagement = await getEngagementPattern(req.prospectId);
    const insights = await getAIInsights(req.prospectId);

    // Generate personalization variables
    const variables = await generatePersonalizationVariables(
      prospectData, 
      classification, 
      engagement, 
      insights,
      req.context || {}
    );

    // Apply personalization
    const personalizedContent = await personalizeContent(template, variables);

    return {
      subject: personalizedContent.subject,
      content: personalizedContent.content,
      variables
    };
  }
);

interface CreateContentTemplateRequest {
  name: string;
  type: string;
  subject?: string;
  content: string;
  variables: string[];
  classification: string[];
  stages: string[];
  industry?: string;
  persona?: string;
}

export const createContentTemplate = api(
  { method: "POST", path: "/content/templates", expose: true },
  async (template: CreateContentTemplateRequest) => {
    const result = await db.exec`
      INSERT INTO content_templates (
        name, type, subject, content, variables, classification, stages, industry, persona
      ) VALUES (
        ${template.name}, ${template.type}, ${template.subject}, ${template.content},
        ${JSON.stringify(template.variables)}, ${JSON.stringify(template.classification)},
        ${JSON.stringify(template.stages)}, ${template.industry}, ${template.persona}
      )
      RETURNING id, name, type, subject, content, variables, classification, stages, 
               industry, persona, sent_count, open_rate, click_rate, response_rate, created_at
    `;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      subject: row.subject,
      content: row.content,
      variables: row.variables,
      classification: row.classification,
      stages: row.stages,
      industry: row.industry,
      persona: row.persona,
      createdAt: row.created_at,
      performance: {
        sentCount: row.sent_count,
        openRate: parseFloat(row.open_rate),
        clickRate: parseFloat(row.click_rate),
        responseRate: parseFloat(row.response_rate)
      }
    };
  }
);

export const getContentTemplates = api(
  { method: "GET", path: "/content/templates", expose: true },
  async ({ 
    classification, 
    stage, 
    type,
    industry,
    persona 
  }: { 
    classification?: string; 
    stage?: string; 
    type?: string;
    industry?: string;
    persona?: string;
  }) => {
    let query = `
      SELECT id, name, type, subject, content, variables, classification, stages,
             industry, persona, sent_count, open_rate, click_rate, response_rate, created_at
      FROM content_templates
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 0;

    if (classification) {
      query += ` AND classification @> $${++paramIndex}`;
      params.push(JSON.stringify([classification]));
    }

    if (stage) {
      query += ` AND stages @> $${++paramIndex}`;
      params.push(JSON.stringify([stage]));
    }

    if (type) {
      query += ` AND type = $${++paramIndex}`;
      params.push(type);
    }

    if (industry) {
      query += ` AND (industry = $${++paramIndex} OR industry IS NULL)`;
      params.push(industry);
    }

    if (persona) {
      query += ` AND (persona = $${++paramIndex} OR persona IS NULL)`;
      params.push(persona);
    }

    query += ' ORDER BY response_rate DESC, open_rate DESC';

    const result = await db.exec(query, ...params);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      subject: row.subject,
      content: row.content,
      variables: row.variables,
      classification: row.classification,
      stages: row.stages,
      industry: row.industry,
      persona: row.persona,
      createdAt: row.created_at,
      performance: {
        sentCount: row.sent_count,
        openRate: parseFloat(row.open_rate),
        clickRate: parseFloat(row.click_rate),
        responseRate: parseFloat(row.response_rate)
      }
    }));
  }
);

export const generateAIContent = api(
  { method: "POST", path: "/content/ai-generate", expose: true },
  async ({
    prospectId,
    contentType,
    classification,
    stage,
    context
  }: {
    prospectId: string;
    contentType: 'email' | 'sms' | 'social';
    classification: string;
    stage: string;
    context?: Record<string, any>;
  }): Promise<{ subject?: string; content: string; reasoning: string }> => {
    const prospectData = await getProspectData(prospectId);
    const aiInsights = await getAIInsights(prospectId);
    const engagement = await getEngagementPattern(prospectId);

    // Use the centralized AI service for content generation
    return await ai.generateContent({
      type: contentType,
      classification: classification as any,
      stage: stage as any,
      prospectData: {
        ...prospectData,
        aiInsights,
        engagement
      },
      context
    });
  }
);

async function getTemplate(templateId: string): Promise<ContentTemplate | null> {
  const result = await db.exec`
    SELECT id, name, type, subject, content, variables, classification, stages,
           industry, persona, sent_count, open_rate, click_rate, response_rate, created_at
    FROM content_templates
    WHERE id = ${templateId}
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    subject: row.subject,
    content: row.content,
    variables: row.variables,
    classification: row.classification,
    stages: row.stages,
    industry: row.industry,
    persona: row.persona,
    createdAt: row.created_at,
    performance: {
      sentCount: row.sent_count,
      openRate: parseFloat(row.open_rate),
      clickRate: parseFloat(row.click_rate),
      responseRate: parseFloat(row.response_rate)
    }
  };
}

async function generatePersonalizationVariables(
  prospectData: any,
  classification: any,
  engagement: any,
  insights: any[],
  context: Record<string, any>
): Promise<Record<string, string>> {
  const variables: Record<string, string> = {};

  // Basic prospect variables
  variables.firstName = prospectData?.firstName || 'there';
  variables.lastName = prospectData?.lastName || '';
  variables.fullName = `${variables.firstName} ${variables.lastName}`.trim();
  variables.company = prospectData?.company || 'your company';
  variables.title = prospectData?.title || 'your role';
  variables.industry = prospectData?.industry || 'your industry';

  // Classification-based variables
  if (classification) {
    variables.classification = classification.classification;
    variables.stage = classification.stage;
    variables.confidence = Math.round(classification.confidence * 100).toString();
    
    // Dynamic content based on buying signals
    if (classification.buyingSignals?.length > 0) {
      variables.buyingSignals = classification.buyingSignals.join(', ');
      variables.topBuyingSignal = classification.buyingSignals[0];
    }

    // Pain points
    if (classification.painPoints?.length > 0) {
      variables.painPoints = classification.painPoints.join(', ');
      variables.mainPainPoint = classification.painPoints[0];
    }

    // Interests
    if (classification.interests?.length > 0) {
      variables.interests = classification.interests.join(', ');
      variables.primaryInterest = classification.interests[0];
    }
  }

  // Engagement-based variables
  if (engagement) {
    variables.responseRate = Math.round(engagement.responseRate * 100).toString();
    variables.engagementTrend = engagement.engagementTrend;
    variables.totalEngagements = engagement.totalEngagements.toString();
    
    if (engagement.preferredContactTimes?.length > 0) {
      variables.preferredTime = engagement.preferredContactTimes[0];
    }

    if (engagement.lastEngagement) {
      const daysSince = Math.floor((Date.now() - new Date(engagement.lastEngagement).getTime()) / (1000 * 60 * 60 * 24));
      variables.daysSinceLastEngagement = daysSince.toString();
      variables.lastEngagementText = daysSince === 0 ? 'today' : 
                                   daysSince === 1 ? 'yesterday' : 
                                   `${daysSince} days ago`;
    }
  }

  // AI insights variables
  const engagementInsight = insights.find(i => i.type === 'engagement_prediction');
  if (engagementInsight) {
    variables.predictedEngagement = engagementInsight.data.predictedScore?.toString() || '0';
    variables.engagementDirection = engagementInsight.data.trend || 'stable';
  }

  const contentInsight = insights.find(i => i.type === 'content_recommendation');
  if (contentInsight) {
    variables.recommendedContent = contentInsight.data.recommendedContentTypes?.join(', ') || '';
  }

  // Context variables
  Object.keys(context).forEach(key => {
    variables[key] = context[key]?.toString() || '';
  });

  // Dynamic time-based variables
  const now = new Date();
  variables.currentTime = now.toLocaleTimeString();
  variables.currentDate = now.toLocaleDateString();
  variables.dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  variables.timeOfDay = getTimeOfDay(now.getHours());

  return variables;
}

async function personalizeContent(
  template: ContentTemplate,
  variables: Record<string, string>
): Promise<{ subject?: string; content: string }> {
  let personalizedSubject = template.subject;
  let personalizedContent = template.content;

  // Replace variables in subject
  if (personalizedSubject) {
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      personalizedSubject = personalizedSubject!.replace(regex, variables[key]);
    });
  }

  // Replace variables in content
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    personalizedContent = personalizedContent.replace(regex, variables[key]);
  });

  // Apply conditional logic
  personalizedContent = applyConditionalLogic(personalizedContent, variables);

  return {
    subject: personalizedSubject,
    content: personalizedContent
  };
}

function applyConditionalLogic(content: string, variables: Record<string, string>): string {
  // Handle conditional blocks like {{#if classification == 'hot'}}...{{/if}}
  const conditionalRegex = /{{#if\s+(\w+)\s*(==|!=|>|<)\s*'([^']+)'}}(.*?){{\/if}}/gs;
  
  return content.replace(conditionalRegex, (match, variable, operator, value, block) => {
    const variableValue = variables[variable];
    let condition = false;

    switch (operator) {
      case '==':
        condition = variableValue === value;
        break;
      case '!=':
        condition = variableValue !== value;
        break;
      case '>':
        condition = parseFloat(variableValue) > parseFloat(value);
        break;
      case '<':
        condition = parseFloat(variableValue) < parseFloat(value);
        break;
    }

    return condition ? block : '';
  });
}

async function generateAIBasedContent(
  contentType: 'email' | 'sms' | 'social',
  classification: string,
  stage: string,
  prospectData: any,
  insights: any[],
  engagement: any,
  context: Record<string, any>
): Promise<{ subject?: string; content: string; reasoning: string }> {
  // This is a simplified AI content generation
  // In a real implementation, you would call an AI service like OpenAI
  
  const contentStrategies = {
    email: {
      hot: {
        intent: {
          subject: "Ready to discuss your {{industry}} challenges?",
          content: `Hi {{firstName}},

I noticed you've been actively exploring solutions for {{mainPainPoint}}. Based on your engagement pattern, it seems like you're in the evaluation phase.

{{#if daysSinceLastEngagement < 3}}
Since we last connected, I wanted to share how we've helped similar {{industry}} companies achieve {{primaryInterest}}.
{{/if}}

Would you be available for a brief call this week to discuss your specific needs?

Best regards,
Sales Team`
        },
        consideration: {
          subject: "{{company}}: Next steps for {{primaryInterest}}",
          content: `Hi {{firstName}},

Thanks for your continued interest in our solution. I can see you've been researching {{interests}}, which aligns perfectly with what we offer.

Based on your {{industry}} background and {{title}} role, I'd like to show you:
- Specific ROI examples from similar companies
- Implementation timeline for {{company}}
- Custom demo focusing on {{mainPainPoint}}

When would be a good time to connect?

Best,
Sales Team`
        }
      },
      warm: {
        interest: {
          subject: "{{firstName}}, here's what {{industry}} leaders are doing",
          content: `Hi {{firstName}},

I noticed you've been looking into solutions for {{mainPainPoint}}. As a {{title}} in {{industry}}, you'll appreciate this case study from a similar company.

{{#if engagementTrend == 'increasing'}}
Your increasing engagement shows you're serious about finding the right solution.
{{/if}}

Key benefits they achieved:
- 40% improvement in {{primaryInterest}}
- ROI within 6 months
- Seamless integration with existing systems

Would a 15-minute overview be valuable?

Best,
Sales Team`
        }
      },
      nurture: {
        awareness: {
          subject: "Quick insight for {{industry}} professionals",
          content: `Hi {{firstName}},

As someone in {{industry}}, you might find this industry report interesting. It covers the latest trends in {{primaryInterest}}.

{{#if responseRate > 30}}
I've noticed you engage well with our content, so I thought this would be particularly relevant.
{{/if}}

Key findings:
- Industry benchmark data
- Best practices from leading companies
- Future trends to watch

Download here: [Link]

Best,
Content Team`
        }
      }
    },
    sms: {
      hot: {
        intent: "Hi {{firstName}}, saw your interest in {{primaryInterest}}. Quick call this week to discuss {{company}}'s needs? Reply YES for times."
      },
      warm: {
        interest: "{{firstName}}, that {{industry}} case study I mentioned might interest you. Worth a quick chat? Reply CALL for scheduling."
      }
    }
  };

  const strategy = contentStrategies[contentType]?.[classification]?.[stage];
  
  let subject: string | undefined;
  let content: string;
  let reasoning: string;

  if (strategy) {
    if (contentType === 'email' && typeof strategy === 'object') {
      subject = strategy.subject;
      content = strategy.content;
    } else {
      content = strategy as string;
    }
  } else {
    // Fallback generic content
    content = `Hi {{firstName}}, I wanted to reach out regarding {{primaryInterest}}. Based on your {{classification}} status and {{stage}} stage, I believe we can help with {{mainPainPoint}}. Let's connect!`;
    reasoning = `Generated fallback content for ${classification} prospect in ${stage} stage`;
  }

  reasoning = `Generated ${contentType} content for ${classification} prospect in ${stage} stage. ` +
             `Incorporated ${insights.length} AI insights and engagement pattern: ${engagement?.engagementTrend || 'unknown'}.`;

  return { subject, content, reasoning };
}

function getTimeOfDay(hour: number): string {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// Helper functions that would typically call other services
async function getProspectData(prospectId: string): Promise<any> {
  return {
    firstName: 'John',
    lastName: 'Doe',
    company: 'Tech Corp',
    title: 'CTO',
    industry: 'Technology'
  };
}

async function getProspectClassification(prospectId: string): Promise<any> {
  const result = await db.exec`
    SELECT * FROM prospect_classifications WHERE prospect_id = ${prospectId}
  `;
  return result.rows[0] || null;
}

async function getEngagementPattern(prospectId: string): Promise<any> {
  const result = await db.exec`
    SELECT * FROM engagement_patterns WHERE prospect_id = ${prospectId}
  `;
  return result.rows[0] || null;
}

async function getAIInsights(prospectId: string): Promise<any[]> {
  const result = await db.exec`
    SELECT * FROM ai_insights WHERE prospect_id = ${prospectId} ORDER BY created_at DESC LIMIT 10
  `;
  return result.rows;
}