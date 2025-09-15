import { useQuery } from '@tanstack/react-query';
import { Users, Mail, TrendingUp, Target, Activity, Bot } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import backend from '~backend/client';
import LoadingSpinner from './LoadingSpinner';
import StatsCard from './StatsCard';
import AgentStatusCard from './AgentStatusCard';

export default function Dashboard() {
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => backend.agent.list(),
    refetchInterval: 5000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => backend.analytics.getMetrics({}),
    refetchInterval: 30000,
  });

  const { data: prospects, isLoading: prospectsLoading } = useQuery({
    queryKey: ['recent-prospects'],
    queryFn: () => backend.prospect.list({ limit: 5 }),
  });

  if (agentsLoading || metricsLoading || prospectsLoading) {
    return <LoadingSpinner />;
  }

  const runningAgents = agents?.agents.filter(agent => agent.status === 'running') || [];
  const totalAgents = agents?.agents.length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            NuScan Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor your Nu Skin prospecting performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-green-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {runningAgents.length}/{totalAgents} agents active
          </span>
        </div>
      </div>

      {/* Agent Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents?.agents.map((agent) => (
          <AgentStatusCard key={agent.id} agent={agent} />
        ))}
      </div>

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Performance Trend
            </CardTitle>
            <CardDescription>
              Last 7 days activity summary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics?.daily_stats.slice(0, 7).map((stat) => (
                <div key={stat.date} className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(stat.date).toLocaleDateString()}
                  </div>
                  <div className="flex space-x-4 text-sm">
                    <span className="text-blue-600">
                      {stat.prospects_found} prospects
                    </span>
                    <span className="text-green-600">
                      {stat.emails_sent} emails
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
