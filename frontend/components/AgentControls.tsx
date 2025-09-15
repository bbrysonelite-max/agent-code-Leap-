import { useState } from 'react';
import { Bot, Play, Pause, Square, Plus, Settings, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import LoadingSpinner from './LoadingSpinner';
import AgentStatusCard from './AgentStatusCard';
import { useAgents, useCreateAgent, useControlAgent } from '../hooks/useAgents';

export default function AgentControls() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');

  const { toast } = useToast();
  const { data: agents, isLoading } = useAgents();
  
  const createAgentMutation = useCreateAgent();
  const controlAgentMutation = useControlAgent();
  
  // Override onSuccess for create agent to handle UI state
  const handleCreateAgent = () => {
    createAgentMutation.mutate({ name: newAgentName }, {
      onSuccess: () => {
        setShowCreateDialog(false);
        setNewAgentName('');
      },
    });
  };

  const handleCreateAgentForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the agent.',
        variant: 'destructive',
      });
      return;
    }
    handleCreateAgent();
  };

  const handleControlAgent = (agentId: number, action: 'start' | 'stop' | 'pause') => {
    controlAgentMutation.mutate({ agentId, action });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const runningAgents = agents?.agents.filter(agent => agent.status === 'running') || [];
  const pausedAgents = agents?.agents.filter(agent => agent.status === 'paused') || [];
  const stoppedAgents = agents?.agents.filter(agent => agent.status === 'stopped') || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Agent Controls
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your Nu Skin prospecting agents
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Create a new Nu Skin prospecting agent to start finding qualified prospects.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAgentForm}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="agentName">Agent Name</Label>
                  <Input
                    id="agentName"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="Enter agent name..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAgentMutation.isPending}
                >
                  {createAgentMutation.isPending ? 'Creating...' : 'Create Agent'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running Agents</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{runningAgents.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently prospecting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused Agents</CardTitle>
            <Pause className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pausedAgents.length}</div>
            <p className="text-xs text-muted-foreground">
              Temporarily paused
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stopped Agents</CardTitle>
            <Square className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stoppedAgents.length}</div>
            <p className="text-xs text-muted-foreground">
              Not active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">All Agents</h2>
        {agents?.agents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No agents created yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first Nu Skin prospecting agent to get started.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Agent
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {agents?.agents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Bot className="h-6 w-6 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription>
                          Created {new Date(agent.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        agent.status === 'running' 
                          ? 'default' 
                          : agent.status === 'paused' 
                          ? 'secondary' 
                          : 'outline'
                      }
                    >
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Prospects Found</p>
                        <p className="font-semibold">{agent.prospects_found_today}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Emails Sent</p>
                        <p className="font-semibold">{agent.emails_sent_today}</p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {agent.status === 'stopped' && (
                        <Button 
                          size="sm" 
                          onClick={() => handleControlAgent(agent.id, 'start')}
                          disabled={controlAgentMutation.isPending}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                      )}
                      {agent.status === 'running' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleControlAgent(agent.id, 'pause')}
                            disabled={controlAgentMutation.isPending}
                          >
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleControlAgent(agent.id, 'stop')}
                            disabled={controlAgentMutation.isPending}
                          >
                            <Square className="h-4 w-4 mr-1" />
                            Stop
                          </Button>
                        </>
                      )}
                      {agent.status === 'paused' && (
                        <>
                          <Button 
                            size="sm"
                            onClick={() => handleControlAgent(agent.id, 'start')}
                            disabled={controlAgentMutation.isPending}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Resume
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleControlAgent(agent.id, 'stop')}
                            disabled={controlAgentMutation.isPending}
                          >
                            <Square className="h-4 w-4 mr-1" />
                            Stop
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}