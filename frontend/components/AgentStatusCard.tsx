import { Bot, Play, Pause, Square, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import type { Agent } from '~backend/agent/types';
import backend from '~backend/client';

interface AgentStatusCardProps {
  agent: Agent;
}

export default function AgentStatusCard({ agent }: AgentStatusCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: (status: 'running' | 'paused' | 'stopped') =>
      backend.agent.updateStatus({ id: agent.id, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast({
        title: 'Agent Updated',
        description: `Agent ${agent.name} status changed successfully.`,
      });
    },
    onError: (error) => {
      console.error('Failed to update agent status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update agent status. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'stopped':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleStatusChange = (newStatus: 'running' | 'paused' | 'stopped') => {
    updateStatusMutation.mutate(newStatus);
  };

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center text-sm font-medium">
          <Bot className="h-4 w-4 mr-2" />
          {agent.name}
        </CardTitle>
        <Badge className={getStatusColor(agent.status)}>
          {agent.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-semibold text-blue-600">
              {agent.prospects_found_today}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Prospects
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">
              {agent.emails_sent_today}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Emails
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-purple-600">
              {agent.responses_today}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Responses
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          {agent.status === 'stopped' && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleStatusChange('running')}
              disabled={updateStatusMutation.isPending}
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          
          {agent.status === 'running' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleStatusChange('paused')}
                disabled={updateStatusMutation.isPending}
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleStatusChange('stopped')}
                disabled={updateStatusMutation.isPending}
              >
                <Square className="h-3 w-3" />
              </Button>
            </>
          )}
          
          {agent.status === 'paused' && (
            <>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleStatusChange('running')}
                disabled={updateStatusMutation.isPending}
              >
                <Play className="h-3 w-3 mr-1" />
                Resume
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleStatusChange('stopped')}
                disabled={updateStatusMutation.isPending}
              >
                <Square className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        {agent.last_activity_at && (
          <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
            <Activity className="h-3 w-3 mr-1" />
            Last active: {new Date(agent.last_activity_at).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
