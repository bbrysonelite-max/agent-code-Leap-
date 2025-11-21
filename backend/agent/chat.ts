import { api, StreamInOut } from "encore.dev/api";
import log from "encore.dev/log";
import { broadcastMessage } from "../realtime/websocket";
import { ai } from "~encore/clients";
import { agentDB } from "./db";

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
  sessionId?: string; // Optional: to resume existing chat
}

export interface ChatSession {
  id: string;
  agentId?: string;
  userId: string;
  title?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

const activeChats = new Map<string, {
  stream: StreamInOut<ChatMessage, ChatMessage>;
  sessionId: string;
  agentId?: string;
  userId: string;
  lastActivity: Date;
}>();

// Helper function to save a message to the database
async function saveMessageToDB(message: ChatMessage, sessionId: string): Promise<void> {
  try {
    await agentDB.exec`
      INSERT INTO chat_messages (id, chat_session_id, agent_id, user_id, message, role, timestamp)
      VALUES (${message.id}, ${sessionId}, ${message.agentId || null}, ${message.userId}, ${message.message}, ${message.role}, ${message.timestamp})
    `;
  } catch (error) {
    log.error("Failed to save message to database:", error);
    throw error;
  }
}

// Helper function to create or update a chat session
async function upsertChatSession(sessionId: string, userId: string, agentId?: string): Promise<void> {
  try {
    // Check if session exists
    const existingSession = await agentDB.queryRow`
      SELECT id FROM chat_sessions WHERE id = ${sessionId}
    `;

    if (existingSession) {
      // Update existing session
      await agentDB.exec`
        UPDATE chat_sessions
        SET last_message_at = NOW(), updated_at = NOW()
        WHERE id = ${sessionId}
      `;
    } else {
      // Create new session
      await agentDB.exec`
        INSERT INTO chat_sessions (id, agent_id, user_id, last_message_at, created_at, updated_at)
        VALUES (${sessionId}, ${agentId || null}, ${userId}, NOW(), NOW(), NOW())
      `;
    }
  } catch (error) {
    log.error("Failed to upsert chat session:", error);
    throw error;
  }
}

// Helper function to load chat history from database
async function loadChatHistory(sessionId: string, limit: number = 100): Promise<ChatMessage[]> {
  try {
    const messages = await agentDB.query`
      SELECT id, agent_id as "agentId", user_id as "userId", message, role, timestamp
      FROM chat_messages
      WHERE chat_session_id = ${sessionId}
      ORDER BY timestamp ASC
      LIMIT ${limit}
    `;

    return messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
    }));
  } catch (error) {
    log.error("Failed to load chat history:", error);
    return [];
  }
}

// Real-time chat with AI agents
export const chat = api.streamInOut<ChatHandshake, ChatMessage, ChatMessage>(
  { expose: true, path: "/agents/chat" },
  async (handshake, stream) => {
    // Use provided sessionId or generate a new one
    const sessionId = handshake.sessionId || `session-${handshake.userId}-${handshake.agentId || 'general'}-${Date.now()}`;
    const chatId = `${sessionId}-${Date.now()}`;

    log.info(`Starting chat session ${sessionId} for user ${handshake.userId} with agent ${handshake.agentId || 'general'}`);

    // Create or update chat session in database
    await upsertChatSession(sessionId, handshake.userId, handshake.agentId);

    activeChats.set(chatId, {
      stream,
      sessionId,
      agentId: handshake.agentId,
      userId: handshake.userId,
      lastActivity: new Date()
    });

    // Load and send chat history if resuming existing session
    if (handshake.sessionId) {
      const history = await loadChatHistory(sessionId);
      for (const msg of history) {
        await stream.send(msg);
      }
      log.info(`Loaded ${history.length} messages from session ${sessionId}`);
    } else {
      // Send welcome message for new sessions
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
      // Save welcome message to database
      await saveMessageToDB(welcomeMessage, sessionId);
    }

    try {
      for await (const message of stream) {
        const chat = activeChats.get(chatId);
        if (chat) {
          chat.lastActivity = new Date();

          log.info(`Received message in chat ${chatId}:`, message.message);

          // Save user message to database
          await saveMessageToDB(message, sessionId);
          await upsertChatSession(sessionId, handshake.userId, handshake.agentId);

          // Broadcast user message to other systems if needed
          await broadcastMessage({
            type: "chat_message",
            data: {
              chatId,
              sessionId,
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

            // Save agent response to database
            await saveMessageToDB(responseMessage, sessionId);
            await upsertChatSession(sessionId, handshake.userId, handshake.agentId);

            // Broadcast agent response
            await broadcastMessage({
              type: "chat_message",
              data: {
                chatId,
                sessionId,
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
            // Save error message to database
            await saveMessageToDB(errorMessage, sessionId);
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

// Get all chat sessions for a user
export const getChatSessions = api(
  { expose: true, method: "GET", path: "/agents/chat/sessions/:userId" },
  async ({ userId }: { userId: string }): Promise<{ sessions: ChatSession[] }> => {
    try {
      const sessions = await agentDB.query`
        SELECT
          id,
          agent_id as "agentId",
          user_id as "userId",
          title,
          last_message_at as "lastMessageAt",
          created_at as "createdAt",
          updated_at as "updatedAt",
          is_archived as "isArchived"
        FROM chat_sessions
        WHERE user_id = ${userId} AND is_archived = FALSE
        ORDER BY last_message_at DESC NULLS LAST, created_at DESC
        LIMIT 50
      `;

      return {
        sessions: sessions.map(s => ({
          ...s,
          lastMessageAt: s.lastMessageAt instanceof Date ? s.lastMessageAt.toISOString() : s.lastMessageAt,
          createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
          updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt
        }))
      };
    } catch (error) {
      log.error("Failed to get chat sessions:", error);
      return { sessions: [] };
    }
  }
);

// Get messages for a specific session
export const getChatMessages = api(
  { expose: true, method: "GET", path: "/agents/chat/sessions/:sessionId/messages" },
  async ({ sessionId, limit = 100 }: { sessionId: string; limit?: number }): Promise<{ messages: ChatMessage[] }> => {
    try {
      const messages = await loadChatHistory(sessionId, limit);
      return { messages };
    } catch (error) {
      log.error("Failed to get chat messages:", error);
      return { messages: [] };
    }
  }
);

// Archive a chat session
export const archiveChatSession = api(
  { expose: true, method: "POST", path: "/agents/chat/sessions/:sessionId/archive" },
  async ({ sessionId }: { sessionId: string }): Promise<{ success: boolean }> => {
    try {
      await agentDB.exec`
        UPDATE chat_sessions
        SET is_archived = TRUE, updated_at = NOW()
        WHERE id = ${sessionId}
      `;
      return { success: true };
    } catch (error) {
      log.error("Failed to archive chat session:", error);
      return { success: false };
    }
  }
);

// Delete a chat session and all its messages
export const deleteChatSession = api(
  { expose: true, method: "DELETE", path: "/agents/chat/sessions/:sessionId" },
  async ({ sessionId }: { sessionId: string }): Promise<{ success: boolean }> => {
    try {
      // Delete messages first
      await agentDB.exec`
        DELETE FROM chat_messages WHERE chat_session_id = ${sessionId}
      `;

      // Delete session
      await agentDB.exec`
        DELETE FROM chat_sessions WHERE id = ${sessionId}
      `;

      return { success: true };
    } catch (error) {
      log.error("Failed to delete chat session:", error);
      return { success: false };
    }
  }
);