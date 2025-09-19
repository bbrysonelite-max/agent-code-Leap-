import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Database, 
  Clock, 
  AlertTriangle, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  Activity,
  BarChart3
} from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: any;
  trend?: 'up' | 'down' | 'stable';
}

function StatsCard({ title, value, icon: Icon, trend }: StatsCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4" />;
      case 'down': return <TrendingDown className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className={`flex items-center text-xs ${getTrendColor()}`}>
          {getTrendIcon()}
          <span className="ml-1">vs last period</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DatabasePerformanceDashboard() {
  const mockData = {
    overview: {
      avg_query_time: 125,
      total_queries: 45231,
      slow_query_count: 3,
      cache_hit_rate: 94.2
    },
    slow_queries: [
      {
        query: 'SELECT * FROM prospects WHERE...',
        avg_time: 2500,
        execution_count: 142,
        optimization_suggestion: 'Add index on email column'
      }
    ]
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Database Performance</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Reports
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Average Query Time"
          value={`${mockData.overview.avg_query_time}ms`}
          icon={Clock}
          trend="stable"
        />
        <StatsCard
          title="Total Queries"
          value={mockData.overview.total_queries.toLocaleString()}
          icon={Database}
          trend="up"
        />
        <StatsCard
          title="Slow Queries"
          value={mockData.overview.slow_query_count}
          icon={AlertTriangle}
          trend="down"
        />
        <StatsCard
          title="Cache Hit Rate"
          value={`${mockData.overview.cache_hit_rate}%`}
          icon={Zap}
          trend="up"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Slow Queries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockData.slow_queries.map((query, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="destructive">Slow Query</Badge>
                  <span className="text-sm text-muted-foreground">
                    Avg: {query.avg_time}ms
                  </span>
                </div>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-2">
                  {query.query}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Executed {query.execution_count} times
                  </span>
                  <Badge variant="outline">
                    {query.optimization_suggestion}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Query Performance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Fast Queries (&lt;100ms)</span>
                  <span>78%</span>
                </div>
                <Progress value={78} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Medium Queries (100-500ms)</span>
                  <span>18%</span>
                </div>
                <Progress value={18} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Slow Queries (&gt;500ms)</span>
                  <span>4%</span>
                </div>
                <Progress value={4} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>CPU Usage</span>
                  <span>45%</span>
                </div>
                <Progress value={45} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Memory Usage</span>
                  <span>62%</span>
                </div>
                <Progress value={62} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Disk I/O</span>
                  <span>28%</span>
                </div>
                <Progress value={28} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}