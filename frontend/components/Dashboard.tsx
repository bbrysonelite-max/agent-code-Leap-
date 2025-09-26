import { Users, Mail, TrendingUp, Target, Activity, Bot, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import LoadingSpinner from './LoadingSpinner';
import StatsCard from './StatsCard';
import AgentStatusCard from './AgentStatusCard';
import AgentSetup from './AgentSetup';
import RealtimeActivityFeed from './RealtimeActivityFeed';
import RealtimeNotifications from './RealtimeNotifications';
import RealtimeTestControls from './RealtimeTestControls';
import AgentChat from './AgentChat';
import { useAgents } from '../hooks/useAgents';
import { useMetrics } from '../hooks/useAnalytics';
import { useRecentProspects } from '../hooks/useProspects';
import { useState } from 'react';

export default function Dashboard() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: prospects, isLoading: prospectsLoading } = useRecentProspects(5);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  
  // Mock user ID - in a real app this would come from auth
  const userId = 'user-123';

  if (agentsLoading || metricsLoading || prospectsLoading) {
    return <LoadingSpinner />;
  }

  const runningAgents = agents?.agents.filter(agent => agent.status === 'running') || [];
  const totalAgents = agents?.agents.length || 0;

  const handleAgentChatClick = (agentId: string) => {
    setSelectedAgentId(agentId);
    setChatOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            AI Prospect Agent Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor your intelligent prospecting performance across all clients
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-green-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {runningAgents.length}/{totalAgents} agents active
          </span>
        </div>
      </div>

      {/* Agent Setup or Status Overview */}
      <AgentSetup 
        agentCount={totalAgents}
        onSetupComplete={() => {
          // Refresh data after setup
        }}
      />

      {/* Agent Status Overview */}
      {totalAgents > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents?.agents.map((agent) => (
            <AgentStatusCard 
              key={agent.id} 
              agent={agent} 
              onChatClick={handleAgentChatClick}
            />
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Prospects"
          value={metrics?.total_prospects || 0}
          icon={Users}
          trend={+12}
          description="New prospects found"
        />
        <StatsCard
          title="Emails Sent"
          value={metrics?.total_emails_sent || 0}
          icon={Mail}
          trend={+8}
          description="Outreach campaigns"
        />
        <StatsCard
          title="Response Rate"
          value={`${metrics?.response_rate || 0}%`}
          icon={TrendingUp}
          trend={+3.2}
          description="Email engagement"
        />
        <StatsCard
          title="Qualified Leads"
          value={metrics?.qualified_prospects || 0}
          icon={Target}
          trend={+15}
          description="Ready for follow-up"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Recent Prospects
            </CardTitle>
            <CardDescription>
              Latest prospects discovered by your agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(prospects?.prospects || prospects?.data)?.slice(0, 5).map((prospect) => (
                <div key={prospect.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {prospect.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {prospect.company} • {prospect.position}
                    </p>
                  </div>
                  <Badge 
                    variant={prospect.classification === 'business_builder' ? 'default' : 'secondary'}
                  >
                    {prospect.classification.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <RealtimeActivityFeed />
      </div>

      <RealtimeTestControls />
      <RealtimeNotifications />
      
      {/* Floating Chat Button */}
      {!chatOpen && (
        <Button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-40"
          size="icon"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      )}
      
      {/* Agent Chat */}
      <AgentChat
        agentId={selectedAgentId}
        userId={userId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
