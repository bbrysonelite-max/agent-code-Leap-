import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, MessageCircle, X, Trash2 } from 'lucide-react';
import backend from '~backend/client';
import { useToast } from '@/components/ui/use-toast';

interface ChatMessage {
  id: string;
  agentId?: string;
  userId: string;
  message: string;
  role: "user" | "agent" | "system";
  timestamp: string;
}

interface AgentChatProps {
  agentId?: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AgentChat({ agentId, userId, isOpen, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<any>(null);
  const { toast } = useToast();

  // Load sessionId and messages from localStorage on mount
  useEffect(() => {
    const storageKey = `chat-session-${userId}-${agentId || 'general'}`;
    const storedSessionId = localStorage.getItem(storageKey);
    const storedMessages = localStorage.getItem(`${storageKey}-messages`);

    if (storedSessionId) {
      setSessionId(storedSessionId);
    }

    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages);
        setMessages(parsed);
      } catch (error) {
        console.error('Failed to parse stored messages:', error);
      }
    }
  }, [userId, agentId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isConnected) {
      connectToAgent();
    } else if (!isOpen && isConnected) {
      disconnectFromAgent();
    }

    return () => {
      disconnectFromAgent();
    };
  }, [isOpen, userId, agentId]);

  const connectToAgent = async () => {
    try {
      setIsLoading(true);

      // Generate or use existing sessionId
      const storageKey = `chat-session-${userId}-${agentId || 'general'}`;
      let currentSessionId = sessionId;

      if (!currentSessionId) {
        currentSessionId = `session-${userId}-${agentId || 'general'}-${Date.now()}`;
        setSessionId(currentSessionId);
        localStorage.setItem(storageKey, currentSessionId);
      }

      const handshake = {
        agentId,
        userId,
        sessionId: currentSessionId
      };

      streamRef.current = await backend.agent.chat(handshake);
      setIsConnected(true);
      setIsLoading(false);

      // Listen for incoming messages
      for await (const message of streamRef.current) {
        setMessages(prev => {
          const updated = [...prev, message];
          // Save to localStorage for offline access
          localStorage.setItem(`${storageKey}-messages`, JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('Error connecting to agent chat:', error);
      setIsLoading(false);
      toast({
        title: "Connection Error",
        description: "Failed to connect to agent chat",
        variant: "destructive"
      });
    }
  };

  const disconnectFromAgent = () => {
    if (streamRef.current) {
      try {
        streamRef.current.close?.();
      } catch (error) {
        console.error('Error closing stream:', error);
      }
      streamRef.current = null;
    }
    setIsConnected(false);
    // Don't clear messages - they're persisted!
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !isConnected) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      agentId,
      userId,
      message: inputMessage,
      role: 'user',
      timestamp: new Date().toISOString()
    };

    try {
      // Add user message to UI immediately
      setMessages(prev => {
        const updated = [...prev, userMessage];
        // Save to localStorage
        const storageKey = `chat-session-${userId}-${agentId || 'general'}`;
        localStorage.setItem(`${storageKey}-messages`, JSON.stringify(updated));
        return updated;
      });
      setInputMessage('');

      // Send message through stream
      if (streamRef.current) {
        await streamRef.current.send(userMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Send Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const clearHistory = () => {
    const storageKey = `chat-session-${userId}-${agentId || 'general'}`;
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}-messages`);
    setMessages([]);
    setSessionId(null);
    toast({
      title: "History Cleared",
      description: "Starting a new conversation"
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'agent':
        return <Bot className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getMessageBadgeVariant = (role: string) => {
    switch (role) {
      case 'user':
        return 'default' as const;
      case 'agent':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] z-50">
      <Card className="h-full flex flex-col shadow-2xl border-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {agentId ? `Agent ${agentId}` : 'AI Assistant'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="h-6 w-6 p-0"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 pt-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-muted-foreground">Connecting to agent...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-muted-foreground">Start a conversation!</div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : message.role === 'system'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getMessageIcon(message.role)}
                      <Badge variant={getMessageBadgeVariant(message.role)} className="text-xs">
                        {message.role}
                      </Badge>
                      <span className="text-xs opacity-70">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{message.message}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type your message..." : "Connecting..."}
              disabled={!isConnected || isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || !isConnected || isLoading}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}