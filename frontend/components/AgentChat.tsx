import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, MessageCircle, X, RefreshCw } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<any>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isConnected && !isLoading) {
      connectToAgent();
    } else if (!isOpen) {
      disconnectFromAgent();
    }

    return () => {
      if (!isOpen) {
        disconnectFromAgent();
      }
    };
  }, [isOpen]);

  const connectToAgent = async () => {
    try {
      setIsLoading(true);
      setIsConnected(false);

      const handshake = {
        agentId,
        userId
      };

      streamRef.current = await backend.agent.chat(handshake);

      // Set connected state before starting message loop
      setIsConnected(true);
      setIsLoading(false);

      // Listen for incoming messages
      try {
        for await (const message of streamRef.current) {
          setMessages(prev => [...prev, message]);
        }
      } catch (streamError) {
        console.error('Stream error:', streamError);
        // Stream ended or errored, but connection was established
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error connecting to agent chat:', error);
      setIsLoading(false);
      setIsConnected(false);
      toast({
        title: "Connection Error",
        description: "Failed to connect to agent chat. Click to retry.",
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
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !isConnected || !streamRef.current) return;

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
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      // Send message through stream
      await streamRef.current.send(userMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsConnected(false);
      toast({
        title: "Send Error",
        description: "Failed to send message. Connection lost.",
        variant: "destructive"
      });
    }
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
            {!isConnected && !isLoading && (
              <Button
                onClick={connectToAgent}
                variant="outline"
                size="sm"
                className="flex-shrink-0"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            )}
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                isLoading
                  ? "Connecting..."
                  : isConnected
                    ? "Type your message..."
                    : "Connection failed - Click retry"
              }
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