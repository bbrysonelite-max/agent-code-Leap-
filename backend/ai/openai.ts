import { secret } from 'encore.dev/config';
import { api } from "encore.dev/api";

// Define the OpenAI API key as a secret
const openAIKey = secret("OpenAIKey");

export interface AIRequest {
  prompt: string;
  context?: Record<string, any>;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  reasoning?: string;
}

export interface ContentGenerationRequest {
  type: 'email' | 'sms' | 'social' | 'linkedin_message' | 'phone_call' | 'task';
  classification: 'hot' | 'warm' | 'cold' | 'nurture' | 'unqualified';
  stage: 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
  prospectData: Record<string, any>;
  context?: Record<string, any>;
}

export interface ContentGenerationResponse {
  subject?: string;
  content: string;
  reasoning: string;
}

export interface SequenceGenerationRequest {
  prospectData: Record<string, any>;
  target: string;
  goals: string[];
  stepCount?: number;
}

export interface SequenceStep {
  step_number: number;
  content_type: 'email' | 'sms' | 'social' | 'phone_call' | 'linkedin_message' | 'task';
  delay_days: number;
  content_data: Record<string, any>;
}

export interface SequenceGenerationResponse {
  sequence: {
    name: string;
    description: string;
    steps: SequenceStep[];
  };
  reasoning: string;
}

export const generateText = api(
  { method: "POST", path: "/generate-text", expose: true },
  async (req: AIRequest): Promise<AIResponse> => {
    const apiKey = openAIKey();
    
    if (!apiKey) {
      // Fallback to mock implementation when no key is configured
      return {
        content: generateMockResponse(req.prompt),
        reasoning: "Generated using mock AI service (OpenAI key not configured)"
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Using the more cost-effective model
          messages: [
            {
              role: 'user',
              content: req.prompt
            }
          ],
          max_tokens: req.maxTokens || 500,
          temperature: req.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      
      return {
        content: data.choices[0]?.message?.content || "",
        reasoning: "Generated using OpenAI GPT-4"
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Fallback to mock implementation on error
      return {
        content: generateMockResponse(req.prompt),
        reasoning: `Fallback response (OpenAI error: ${(error as Error).message})`
      };
    }
  }
);

export const generateContent = api(
  { method: "POST", path: "/generate-content", expose: true },
  async (req: ContentGenerationRequest): Promise<ContentGenerationResponse> => {
    const prompt = createContentPrompt(req);
    
    const response = await generateText({
      prompt,
      maxTokens: 800,
      temperature: 0.8
    });

    return parseContentResponse(response.content, req.type);
  }
);

function createContentPrompt(req: ContentGenerationRequest): string {
  return `
You are an expert sales and marketing copywriter. Generate personalized ${req.type} content for a prospect with the following characteristics:

Classification: ${req.classification}
Stage: ${req.stage}
Type: ${req.type}

Prospect Information:
${JSON.stringify(req.prospectData, null, 2)}

Context:
${JSON.stringify(req.context || {}, null, 2)}

Requirements:
1. ${req.type === 'email' ? 'Include both subject line and email body' : 'Generate compelling content'}
2. Personalize based on prospect data (name, company, industry, etc.)
3. Match the tone to their current stage (${req.stage}) and classification (${req.classification})
4. Include a clear call-to-action appropriate for their stage
5. Keep it professional but engaging
6. ${req.type === 'email' ? 'Email should be 150-300 words' : req.type === 'sms' ? 'SMS should be under 160 characters' : 'Social content should be engaging and shareable'}

${req.type === 'email' ? `
Format your response as:
SUBJECT: [subject line]
CONTENT: [email body]
REASONING: [explanation of approach]
` : `
Format your response as:
CONTENT: [${req.type} content]
REASONING: [explanation of approach]
`}
`;
}

function parseContentResponse(content: string, type: string): ContentGenerationResponse {
  const lines = content.split('\n');
  let subject = '';
  let bodyContent = '';
  let reasoning = '';
  
  let currentSection = '';
  
  for (const line of lines) {
    if (line.startsWith('SUBJECT:')) {
      currentSection = 'subject';
      subject = line.replace('SUBJECT:', '').trim();
    } else if (line.startsWith('CONTENT:')) {
      currentSection = 'content';
      bodyContent = line.replace('CONTENT:', '').trim();
    } else if (line.startsWith('REASONING:')) {
      currentSection = 'reasoning';
      reasoning = line.replace('REASONING:', '').trim();
    } else if (line.trim() && currentSection) {
      if (currentSection === 'content') {
        bodyContent += '\n' + line;
      } else if (currentSection === 'reasoning') {
        reasoning += '\n' + line;
      }
    }
  }
  
  return {
    ...(type === 'email' && subject ? { subject } : {}),
    content: bodyContent || content,
    reasoning: reasoning || 'AI-generated content'
  };
}

function generateMockResponse(prompt: string): string {
  // Simple mock response based on prompt content
  if (prompt.includes('email') || prompt.includes('EMAIL')) {
    return `SUBJECT: Following up on your interest

CONTENT: Hi there,

I noticed you've been exploring solutions that could help with your business challenges. Based on your recent activity, I thought you might be interested in learning more about how we can help.

Would you be available for a brief conversation this week to discuss your specific needs?

Best regards,
Sales Team

REASONING: Generated a professional follow-up email with personalized touch and clear call-to-action.`;
  }
  
  if (prompt.includes('sms') || prompt.includes('SMS')) {
    return `CONTENT: Hi! Quick question about your business needs. Are you available for a brief call this week to discuss how we can help? Reply YES if interested.

REASONING: Short, direct SMS with clear call-to-action that respects character limits.`;
  }
  
  return "This is a mock AI response. Please configure your OpenAI API key in the Infrastructure tab to use real AI generation.";
}

export const generateAISequence = api(
  { method: "POST", path: "/generate-sequence", expose: true },
  async (req: SequenceGenerationRequest): Promise<SequenceGenerationResponse> => {
    const prompt = `
You are an expert sales sequence designer. Create a nurturing sequence for a prospect with the following characteristics:

Prospect Data: ${JSON.stringify(req.prospectData, null, 2)}
Target Classification: ${req.target}
Goals: ${req.goals.join(', ')}
Number of Steps: ${req.stepCount || 5}

Create a sequence with the following specifications:
1. Mix of communication types (email, sms, social, phone_call, linkedin_message)
2. Appropriate delays between steps (1-7 days typically)
3. Progressive value delivery and engagement
4. Clear call-to-actions for each step
5. Personalized content based on prospect data

Format as JSON:
{
  "name": "Sequence Name",
  "description": "Brief description",
  "steps": [
    {
      "step_number": 1,
      "content_type": "email",
      "delay_days": 0,
      "content_data": {
        "subject": "Email subject",
        "content": "Email content",
        "call_to_action": "CTA text"
      }
    }
  ]
}
`;

    const response = await generateText({
      prompt,
      maxTokens: 1200,
      temperature: 0.8
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        sequence: parsed,
        reasoning: response.reasoning || "AI-generated sequence"
      };
    } catch {
      // Fallback mock sequence
      return {
        sequence: {
          name: "Personalized Nurturing Sequence",
          description: "AI-generated nurturing sequence for prospect engagement",
          steps: [
            {
              step_number: 1,
              content_type: "email",
              delay_days: 0,
              content_data: {
                subject: "Introduction and Value Proposition",
                content: "Personalized introduction email with value proposition",
                call_to_action: "Schedule a brief call"
              }
            },
            {
              step_number: 2,
              content_type: "email",
              delay_days: 3,
              content_data: {
                subject: "Follow-up with Resources",
                content: "Follow-up email with helpful resources",
                call_to_action: "Download our guide"
              }
            }
          ]
        },
        reasoning: "Fallback sequence due to parsing error"
      };
    }
  }
);

export const generateBasicStepContent = api(
  { method: "POST", path: "/generate-basic-step-content", expose: true },
  async (req: {
    contentType: string;
    prospectData: Record<string, any>;
    stepNumber: number;
    context?: Record<string, any>;
  }): Promise<ContentGenerationResponse> => {
    const prompt = `
Generate personalized content for step ${req.stepNumber} of a nurturing sequence.

Content Type: ${req.contentType}
Prospect Data: ${JSON.stringify(req.prospectData, null, 2)}
Context: ${JSON.stringify(req.context || {}, null, 2)}

Requirements:
1. Personalize based on prospect information
2. Appropriate for step ${req.stepNumber} in the sequence
3. Include clear call-to-action
4. Professional but engaging tone

${req.contentType === 'email' ? `
Format as:
SUBJECT: [subject line]
CONTENT: [email body]
REASONING: [explanation]
` : `
Format as:
CONTENT: [${req.contentType} content]
REASONING: [explanation]
`}
`;

    const response = await generateText({
      prompt,
      maxTokens: 600,
      temperature: 0.7
    });

    return parseContentResponse(response.content, req.contentType);
  }
);