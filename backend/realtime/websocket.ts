import { api, StreamInOut } from "encore.dev/api";
import log from "encore.dev/log";
import { RealtimeHandshake, RealtimeMessage } from "./types";

const connectedClients = new Map<string, {
  stream: StreamInOut<RealtimeMessage, RealtimeMessage>;
  subscriptions: Set<string>;
  lastSeen: Date;
}>();

// Real-time WebSocket connection for live updates
export const connect = api.streamInOut<RealtimeHandshake, RealtimeMessage, RealtimeMessage>(
  { expose: true, path: "/realtime/connect" },
  async (handshake, stream) => {
    const clientId = handshake.clientId;
    const subscriptions = new Set(handshake.subscriptions);
    
    log.info(`Client ${clientId} connected with subscriptions:`, handshake.subscriptions);
    
    connectedClients.set(clientId, {
      stream,
      subscriptions,
      lastSeen: new Date()
    });

    try {
      for await (const message of stream) {
        const client = connectedClients.get(clientId);
        if (client) {
          client.lastSeen = new Date();
          
          // Handle subscription updates
          if (message.type === "system_notification" && message.data?.action === "update_subscriptions") {
            client.subscriptions.clear();
            message.data.subscriptions?.forEach((sub: string) => client.subscriptions.add(sub));
            log.info(`Updated subscriptions for client ${clientId}:`, Array.from(client.subscriptions));
          }
        }
      }
    } catch (error) {
      log.error(`WebSocket error for client ${clientId}:`, error);
    } finally {
      connectedClients.delete(clientId);
      log.info(`Client ${clientId} disconnected`);
    }
  }
);

// Broadcast message to all connected clients with matching subscriptions
export async function broadcastMessage(message: RealtimeMessage, channel?: string) {
  const disconnectedClients: string[] = [];
  
  for (const [clientId, client] of connectedClients.entries()) {
    try {
      // Check if client is subscribed to this channel
      if (channel && !client.subscriptions.has(channel)) {
        continue;
      }
      
      // Send message to client
      await client.stream.send({
        ...message,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      log.error(`Failed to send message to client ${clientId}:`, error);
      disconnectedClients.push(clientId);
    }
  }
  
  // Clean up disconnected clients
  disconnectedClients.forEach(clientId => {
    connectedClients.delete(clientId);
    log.info(`Removed disconnected client ${clientId}`);
  });
}

// Send message to specific client
export async function sendToClient(clientId: string, message: RealtimeMessage) {
  const client = connectedClients.get(clientId);
  if (!client) {
    log.warn(`Client ${clientId} not found for direct message`);
    return false;
  }
  
  try {
    await client.stream.send({
      ...message,
      timestamp: new Date().toISOString(),
      clientId
    });
    return true;
  } catch (error) {
    log.error(`Failed to send message to client ${clientId}:`, error);
    connectedClients.delete(clientId);
    return false;
  }
}

// Get connected clients stats
export const getConnectedClients = api(
  { expose: true, method: "GET", path: "/realtime/clients" },
  async (): Promise<{ count: number; clients: Array<{ clientId: string; subscriptions: string[]; lastSeen: string }> }> => {
    const clients = Array.from(connectedClients.entries()).map(([clientId, client]) => ({
      clientId,
      subscriptions: Array.from(client.subscriptions),
      lastSeen: client.lastSeen.toISOString()
    }));
    
    return {
      count: clients.length,
      clients
    };
  }
);

// Clean up stale connections
const cleanupInterval = setInterval(() => {
  const now = new Date();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  for (const [clientId, client] of connectedClients.entries()) {
    if (now.getTime() - client.lastSeen.getTime() > staleThreshold) {
      connectedClients.delete(clientId);
      log.info(`Removed stale client ${clientId}`);
    }
  }
}, 60000); // Check every minute

// Cleanup function to stop the interval
export function stopCleanup() {
  clearInterval(cleanupInterval);
}