import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, TrendingDown, Users, Mail, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import backend from '~backend/client';
import LoadingSpinner from './LoadingSpinner';
import StatsCard from './StatsCard';
import { useState } from 'react';

export default function Analytics() {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<string>('30');

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => backend.agent.list(),
  });

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['analytics', selectedAgent, timeframe],
    queryFn: () => backend.analytics.getMetrics({
      agent_id: selectedAgent !== 'all' ? parseInt(selectedAgent) : undefined,
      days: parseInt(timeframe),
    }),
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const chartData = metrics?.daily_stats.reverse().map(stat => ({
    date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    prospects: stat.prospects_found,
    emails: stat.emails_sent,
    responses: stat.responses_received,
  })) || [];

  const conversionData = [
    { name: 'Prospects Found', value: metrics?.total_prospects || 0, color: '#3b82f6' },
    { name: 'Emails Sent', value: metrics?.total_emails_sent || 0, color: '#10b981' },
    { name: 'Responses', value: metrics?.total_responses || 0, color: '#8b5cf6' },
    { name: 'Qualified', value: metrics?.qualified_prospects || 0, color: '#f59e0b' },
    { name: 'Converted', value: metrics?.converted_prospects || 0, color: '#ef4444' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your Nu Skin prospecting performance and metrics
          </p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Prospects"
          value={metrics?.total_prospects || 0}
          icon={Users}
          description="Prospects discovered"
          className="border-blue-200 dark:border-blue-800"
        />
        <StatsCard
          title="Emails Sent"
          value={metrics?.total_emails_sent || 0}
          icon={Mail}
          description="Outreach campaigns"
          className="border-green-200 dark:border-green-800"
        />
        <StatsCard
          title="Response Rate"
          value={`${metrics?.response_rate || 0}%`}
          icon={metrics && metrics.response_rate >= 10 ? TrendingUp : TrendingDown}
          description="Email engagement"
          className="border-purple-200 dark:border-purple-800"
        />
        <StatsCard
          title="Conversion Rate"
          value={`${metrics?.conversion_rate || 0}%`}
          icon={metrics && metrics.conversion_rate >= 5 ? TrendingUp : TrendingDown}
          description="Prospect to customer"
          className="border-orange-200 dark:border-orange-800"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Daily Activity Trend
            </CardTitle>
            <CardDescription>
              Track daily prospect discovery and email outreach over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="prospects" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Prospects Found"
                />
                <Line 
                  type="monotone" 
                  dataKey="emails" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Emails Sent"
                />
                <Line 
                  type="monotone" 
                  dataKey="responses" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="Responses"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>
              Visualize your prospect conversion pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversionData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar 
                  dataKey="value" 
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Days</CardTitle>
            <CardDescription>
              Best days for prospect discovery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chartData
                .sort((a, b) => b.prospects - a.prospects)
                .slice(0, 5)
                .map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {day.date}
                    </span>
                    <span className="font-medium text-blue-600">
                      {day.prospects} prospects
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Performance</CardTitle>
            <CardDescription>
              Engagement metrics summary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Response Rate
                </span>
                <span className="font-medium text-green-600">
                  {metrics?.response_rate || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Conversion Rate
                </span>
                <span className="font-medium text-purple-600">
                  {metrics?.conversion_rate || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Total Qualified
                </span>
                <span className="font-medium text-orange-600">
                  {metrics?.qualified_prospects || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Total Converted
                </span>
                <span className="font-medium text-red-600">
                  {metrics?.converted_prospects || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Goal Progress</CardTitle>
            <CardDescription>
              Nu Skin prospecting targets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Monthly Prospects</span>
                  <span>{metrics?.total_prospects || 0}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${Math.min(((metrics?.total_prospects || 0) / 100) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Email Target</span>
                  <span>{metrics?.total_emails_sent || 0}/50</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${Math.min(((metrics?.total_emails_sent || 0) / 50) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Conversion Goal</span>
                  <span>{metrics?.converted_prospects || 0}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{ width: `${Math.min(((metrics?.converted_prospects || 0) / 10) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
