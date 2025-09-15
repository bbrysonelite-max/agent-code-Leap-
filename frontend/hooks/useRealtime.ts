import { useEffect, useState, useCallback, useRef } from 'react';
import backend from '~backend/client';
import type { 
  RealtimeMessage, 
  AgentActivityData, 
  ProspectDiscoveryData, 
  EmailProgressData, 
  EmailResponseData,
  SystemNotificationData 
} from '~backend/realtime/types';

interface RealtimeState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  messages: RealtimeMessage[];
}

interface RealtimeHookOptions {
  subscriptions: string[];
  autoConnect?: boolean;
  maxMessages?: number;
}

export function useRealtime(options: RealtimeHookOptions) {
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    connecting: false,
    error: null,
    messages: []
  });

  const streamRef = useRef<any>(null);
  const clientIdRef = useRef<string>(`client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const subscriptionsRef = useRef(new Set(options.subscriptions));

  const connect = useCallback(async () => {
    if (streamRef.current || state.connecting) return;

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const stream = await backend.realtime.connect({
        clientId: clientIdRef.current,
        subscriptions: Array.from(subscriptionsRef.current)
      });

      streamRef.current = stream;

      setState(prev => ({ 
        ...prev, 
        connected: true, 
        connecting: false 
      }));

      // Listen for messages
      for await (const message of stream) {
        setState(prev => ({
          ...prev,
          messages: [
            message,
            ...prev.messages.slice(0, (options.maxMessages || 100) - 1)
          ]
        }));
      }

    } catch (error) {
      console.error('WebSocket connection error:', error);
      setState(prev => ({ 
        ...prev, 
        connected: false, 
        connecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
      streamRef.current = null;
    }
  }, [state.connecting, options.maxMessages]);

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current = null;
    }
    setState(prev => ({ 
      ...prev, 
      connected: false, 
      connecting: false 
    }));
  }, []);

  const updateSubscriptions = useCallback(async (newSubscriptions: string[]) => {
    subscriptionsRef.current = new Set(newSubscriptions);
    
    if (streamRef.current) {
      try {
        await streamRef.current.send({
          type: "system_notification" as const,
          data: {
            action: "update_subscriptions",
            subscriptions: newSubscriptions
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to update subscriptions:', error);
      }
    }
  }, []);

  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }));
  }, []);

  useEffect(() => {
    if (options.autoConnect !== false) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    updateSubscriptions(options.subscriptions);
  }, [options.subscriptions, updateSubscriptions]);

  return {
    ...state,
    connect,
    disconnect,
    updateSubscriptions,
    clearMessages,
    clientId: clientIdRef.current
  };
}

// Specific hooks for different message types
export function useAgentActivity() {
  const realtime = useRealtime({ 
    subscriptions: ['agent_activity'],
    maxMessages: 50 
  });

  const agentActivities = realtime.messages
    .filter(msg => msg.type === 'agent_activity')
    .map(msg => msg.data as AgentActivityData);

  return {
    ...realtime,
    activities: agentActivities
  };
}

export function useProspectDiscovery() {
  const realtime = useRealtime({ 
    subscriptions: ['prospect_discovery'],
    maxMessages: 100 
  });

  const discoveries = realtime.messages
    .filter(msg => msg.type === 'prospect_discovery')
    .map(msg => msg.data as ProspectDiscoveryData);

  return {
    ...realtime,
    discoveries
  };
}

export function useEmailProgress() {
  const realtime = useRealtime({ 
    subscriptions: ['email_progress'],
    maxMessages: 50 
  });

  const emailProgress = realtime.messages
    .filter(msg => msg.type === 'email_progress')
    .map(msg => msg.data as EmailProgressData);

  return {
    ...realtime,
    emailProgress
  };
}

export function useEmailResponses() {
  const realtime = useRealtime({ 
    subscriptions: ['email_response'],
    maxMessages: 50 
  });

  const responses = realtime.messages
    .filter(msg => msg.type === 'email_response')
    .map(msg => msg.data as EmailResponseData);

  return {
    ...realtime,
    responses
  };
}

export function useSystemNotifications() {
  const realtime = useRealtime({ 
    subscriptions: ['system_notification'],
    maxMessages: 20 
  });

  const notifications = realtime.messages
    .filter(msg => msg.type === 'system_notification')
    .map(msg => msg.data as SystemNotificationData);

  return {
    ...realtime,
    notifications
  };
}

// Combined hook for dashboard
export function useDashboardRealtime() {
  return useRealtime({
    subscriptions: [
      'agent_activity',
      'prospect_discovery', 
      'email_progress',
      'email_response',
      'system_notification'
    ],
    maxMessages: 200
  });
}