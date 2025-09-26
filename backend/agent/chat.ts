import { api, StreamInOut } from "encore.dev/api";
import log from "encore.dev/log";
import { broadcastMessage } from "../realtime/websocket";
import { ai } from "~encore/clients";

export interface ChatMessage {
  id: string;
  agentId?: string;
  userId: string;
  message: string;
  role: "user" | "agent" | "system";
  timestamp: string;
}

export interface ChatHandshake {
  agentId?: string;
  userId: string;
}

const activeChats = new Map<string, {
  stream: StreamInOut<ChatMessage, ChatMessage>;
  agentId?: string;
  userId: string;
  lastActivity: Date;
}>();

// Real-time chat with AI agents
export const chat = api.streamInOut<ChatHandshake, ChatMessage, ChatMessage>(
  { expose: true, path: "/agents/chat" },
  async (handshake, stream) => {
    const chatId = `${handshake.userId}-${handshake.agentId || 'general'}-${Date.now()}`;
    log.info(`Starting chat session ${chatId} for user ${handshake.userId} with agent ${handshake.agentId || 'general'}`);
    
    activeChats.set(chatId, {
      stream,
      agentId: handshake.agentId,
      userId: handshake.userId,
      lastActivity: new Date()
    });

    // Send welcome message
    const welcomeMessage: ChatMessage = {
      id: `welcome-${Date.now()}`,
      agentId: handshake.agentId,
      userId: handshake.userId,
      message: handshake.agentId 
        ? `Hello! I'm your AI agent. How can I help you today?`
        : `Hello! I'm your AI assistant. How can I help you with your CRM today?`,
      role: "agent",
      timestamp: new Date().toISOString()
    };
    
    await stream.send(welcomeMessage);

    try {
      for await (const message of stream) {
        const chat = activeChats.get(chatId);
        if (chat) {
          chat.lastActivity = new Date();
          
          log.info(`Received message in chat ${chatId}:`, message.message);
          
          // Broadcast user message to other systems if needed
          await broadcastMessage({
            type: "chat_message",
            data: {
              chatId,
              message,
              agentId: handshake.agentId
            },
            timestamp: new Date().toISOString()
          }, "chat_activity");

          // Generate AI response
          try {
            const aiResponse = await generateAgentResponse(message, handshake.agentId);
            
            const responseMessage: ChatMessage = {
              id: `agent-${Date.now()}`,
              agentId: handshake.agentId,
              userId: handshake.userId,
              message: aiResponse,
              role: "agent",
              timestamp: new Date().toISOString()
            };
            
            await stream.send(responseMessage);
            
            // Broadcast agent response
            await broadcastMessage({
              type: "chat_message", 
              data: {
                chatId,
                message: responseMessage,
                agentId: handshake.agentId
              },
              timestamp: new Date().toISOString()
            }, "chat_activity");
            
          } catch (error) {
            log.error(`Error generating AI response:`, error);
            
            const errorMessage: ChatMessage = {
              id: `error-${Date.now()}`,
              agentId: handshake.agentId,
              userId: handshake.userId,
              message: "I'm sorry, I'm having trouble processing your request right now. Please try again.",
              role: "system",
              timestamp: new Date().toISOString()
            };
            
            await stream.send(errorMessage);
          }
        }
      }
    } catch (error) {
      log.error(`Chat error for session ${chatId}:`, error);
    } finally {
      activeChats.delete(chatId);
      log.info(`Chat session ${chatId} ended`);
    }
  }
);

async function generateAgentResponse(userMessage: ChatMessage, agentId?: string): Promise<string> {
  try {
    // Create a context-aware prompt for the AI
    const systemPrompt = agentId 
      ? `You are a helpful AI sales agent for a CRM system. You help users manage prospects, analyze data, and optimize their sales processes. Be helpful, professional, and concise. Agent ID: ${agentId}`
      : `You are a helpful AI assistant for a CRM platform. You help users with their customer relationship management tasks, data analysis, and business insights. Be helpful, professional, and concise.`;
    
    const aiRequest = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system" as const,
          content: systemPrompt
        },
        {
          role: "user" as const,
          content: userMessage.message
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    };

    const response = await ai.chatCompletion(aiRequest);
    return response.message || "I'm not sure how to help with that. Could you please rephrase your question?";
    
  } catch (error) {
    log.error("Error calling AI service:", error);
    throw error;
  }
}

// Get active chat sessions
export const getActiveChats = api(
  { expose: true, method: "GET", path: "/agents/chat/active" },
  async (): Promise<{ count: number; chats: Array<{ chatId: string; agentId?: string; userId: string; lastActivity: string }> }> => {
    const chats = Array.from(activeChats.entries()).map(([chatId, chat]) => ({
      chatId,
      agentId: chat.agentId,
      userId: chat.userId,
      lastActivity: chat.lastActivity.toISOString()
    }));
    
    return {
      count: chats.length,
      chats
    };
  }
);

// Send message to specific chat
export interface SendChatMessageRequest {
  chatId: string;
  message: string;
  role: "user" | "agent" | "system";
}

export const sendMessage = api<SendChatMessageRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/agents/chat/send" },
  async (req) => {
    // Find the chat by scanning active chats
    for (const [chatId, chat] of activeChats.entries()) {
      if (chatId.includes(req.chatId)) {
        const message: ChatMessage = {
          id: `manual-${Date.now()}`,
          agentId: chat.agentId,
          userId: chat.userId,
          message: req.message,
          role: req.role,
          timestamp: new Date().toISOString()
        };
        
        try {
          await chat.stream.send(message);
          return { success: true };
        } catch (error) {
          log.error(`Failed to send message to chat ${chatId}:`, error);
          activeChats.delete(chatId);
          return { success: false };
        }
      }
    }
    
    return { success: false };
  }
);

// Cleanup old chat sessions
const cleanupInterval = setInterval(() => {
  const now = new Date();
  const staleThreshold = 30 * 60 * 1000; // 30 minutes
  
  for (const [chatId, chat] of activeChats.entries()) {
    if (now.getTime() - chat.lastActivity.getTime() > staleThreshold) {
      activeChats.delete(chatId);
      log.info(`Removed stale chat session ${chatId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

export function stopChatCleanup() {
  clearInterval(cleanupInterval);
}