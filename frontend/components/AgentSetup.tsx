import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Bot, AlertCircle, CheckCircle } from 'lucide-react';
import backend from '~backend/client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AgentSetupProps {
  agentCount: number;
  onSetupComplete: () => void;
}

export default function AgentSetup({ agentCount, onSetupComplete }: AgentSetupProps) {
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleBootstrap = async () => {
    setIsBootstrapping(true);
    try {
      const result = await backend.agent.bootstrap();
      
      if (result.success) {
        toast({
          title: "Setup Complete!",
          description: result.message,
          variant: "default"
        });
        
        // Refresh the agents list
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        onSetupComplete();
      } else {
        toast({
          title: "Setup Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Bootstrap error:', error);
      toast({
        title: "Error",
        description: "Failed to create sample agents. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsBootstrapping(false);
    }
  };

  if (agentCount > 0) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          <CardTitle className="text-green-800 dark:text-green-200">
            Agents Ready
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700 dark:text-green-300 mb-3">
            You have <Badge variant="secondary">{agentCount}</Badge> agents available to chat with. 
            Click "Chat with Agent" on any agent card below to start a conversation!
          </p>
          <div className="flex items-center text-sm text-green-600 dark:text-green-400">
            <Bot className="w-4 h-4 mr-1" />
            Ready to assist with your CRM needs
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <AlertCircle className="w-5 h-5 text-orange-600 mr-2" />
        <CardTitle className="text-orange-800 dark:text-orange-200">
          No Agents Available
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-orange-700 dark:text-orange-300">
          You don't have any agents set up yet. Create some sample agents to start chatting!
        </p>
        
        <Button 
          onClick={handleBootstrap}
          disabled={isBootstrapping}
          className="w-full"
        >
          <Users className="w-4 h-4 mr-2" />
          {isBootstrapping ? 'Creating Agents...' : 'Create Sample Agents'}
        </Button>
        
        <div className="text-sm text-orange-600 dark:text-orange-400">
          This will create 3 sample AI agents:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Sarah - Lead Generator</li>
            <li>Mike - Business Development</li>
            <li>Alex - Customer Success</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}