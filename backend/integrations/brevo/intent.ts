// Intent Classification
// Part of AI Lead OS - BRAIN MODULE
import { secret } from "encore.dev/config";

const openAIKey = secret("OpenAIKey");

export type Intent = 
  | "interested" 
  | "question" 
  | "not_now" 
  | "not_interested" 
  | "unsubscribe" 
  | "out_of_office"
  | "unknown";

/**
 * Classify the intent of a reply message
 */
export async function classifyIntent(message: string): Promise<Intent> {
  // Quick pattern matching for common responses
  const lowerMessage = message.toLowerCase();

  // Unsubscribe patterns
  if (lowerMessage.includes("unsubscribe") || 
      lowerMessage.includes("stop") || 
      lowerMessage.includes("remove me")) {
    return "unsubscribe";
  }

  // Out of office patterns
  if (lowerMessage.includes("out of office") || 
      lowerMessage.includes("on vacation") ||
      lowerMessage.includes("away from") ||
      lowerMessage.includes("auto-reply")) {
    return "out_of_office";
  }

  // Not interested patterns
  if (lowerMessage.includes("not interested") || 
      lowerMessage.includes("no thanks") ||
      lowerMessage.includes("no thank you") ||
      lowerMessage.includes("please don't")) {
    return "not_interested";
  }

  // Interested patterns
  if (lowerMessage.includes("interested") ||
      lowerMessage.includes("tell me more") ||
      lowerMessage.includes("let's talk") ||
      lowerMessage.includes("set up a call") ||
      lowerMessage.includes("schedule") ||
      lowerMessage.includes("yes")) {
    return "interested";
  }

  // Question patterns
  if (lowerMessage.includes("?") ||
      lowerMessage.includes("how") ||
      lowerMessage.includes("what") ||
      lowerMessage.includes("when") ||
      lowerMessage.includes("price") ||
      lowerMessage.includes("cost")) {
    return "question";
  }

  // Not now patterns
  if (lowerMessage.includes("not right now") ||
      lowerMessage.includes("maybe later") ||
      lowerMessage.includes("busy") ||
      lowerMessage.includes("next quarter") ||
      lowerMessage.includes("reach out later")) {
    return "not_now";
  }

  // If patterns don't match, try AI classification
  try {
    return await aiClassifyIntent(message);
  } catch (error) {
    console.warn("AI intent classification failed:", error);
    return "unknown";
  }
}

/**
 * Use AI to classify intent when patterns don't match
 */
async function aiClassifyIntent(message: string): Promise<Intent> {
  try {
    const apiKey = openAIKey();
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Classify the intent of this email reply. Return ONLY one of: interested, question, not_now, not_interested, unsubscribe, out_of_office, unknown`
          },
          {
            role: "user",
            content: message.substring(0, 500) // Limit length
          }
        ],
        max_tokens: 20,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI API error");
    }

    const data = await response.json();
    const intent = data.choices[0].message.content.trim().toLowerCase() as Intent;
    
    // Validate it's a known intent
    const validIntents: Intent[] = ["interested", "question", "not_now", "not_interested", "unsubscribe", "out_of_office", "unknown"];
    return validIntents.includes(intent) ? intent : "unknown";
  } catch (error) {
    return "unknown";
  }
}

/**
 * Get recommended action based on intent
 */
export function getRecommendedAction(intent: Intent): string {
  switch (intent) {
    case "interested":
      return "Send Calendly link immediately. Follow up within 4 hours if no booking.";
    case "question":
      return "Answer their question and include Calendly link. Prioritize response.";
    case "not_now":
      return "Add to 30-day follow-up queue. Send value content in 2 weeks.";
    case "not_interested":
      return "Mark as closed-lost. Add to long-term nurture (90 days).";
    case "unsubscribe":
      return "Remove from all sequences immediately. Mark do-not-contact.";
    case "out_of_office":
      return "Pause sequence. Resume when they're back (check return date).";
    default:
      return "Review manually. Classify and respond appropriately.";
  }
}

