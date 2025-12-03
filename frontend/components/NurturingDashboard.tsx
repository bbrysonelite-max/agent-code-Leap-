import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { 
  Plus, 
  Play, 
  Pause, 
  Users, 
  Target,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  Mail,
  Activity
} from 'lucide-react';
import { useNurturing } from '../hooks/useNurturing';
import LoadingSpinner from './LoadingSpinner';

// Default client ID for now - in production this would come from auth context
const DEFAULT_CLIENT_ID = 1;

export default function NurturingDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  
  const {
    dashboard,
    sequences,
    engagementAnalytics,
    health,
    isLoading,
    isError,
    error,
    refetch
  } = useNurturing(DEFAULT_CLIENT_ID);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Error loading nurturing data: {error?.message}</span>
            </div>
            <Button onClick={() => refetch()} className="mt-4" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = dashboard?.stats || {};
  const topSequences = dashboard?.top_sequences || [];
  const recentActivity = dashboard?.recent_activity || [];
  const engagementTrends = dashboard?.engagement_trends || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Nurturing</h1>
          <p className="text-muted-foreground">
            Intelligent prospect nurturing with automated sequences
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health?.status === 'healthy' ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              System Healthy
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              System Error
            </Badge>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sequences</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_sequences || 0}</div>
            <p className="text-xs text-muted-foreground">
              Nurturing campaigns
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Enrollments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_enrollments || 0}</div>
            <p className="text-xs text-muted-foreground">
              of {stats.total_enrollments || 0} total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avg_engagement_score?.toFixed(1) || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Engagement score
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.overall_reply_rate?.toFixed(1) || '0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              Open rate: {stats.overall_open_rate?.toFixed(1) || '0'}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Top Performing Sequences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Top Performing Sequences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topSequences.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sequence data yet. Create your first sequence to see performance metrics.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sequence</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Enrollments</TableHead>
                      <TableHead>Completions</TableHead>
                      <TableHead>Reply Rate</TableHead>
                      <TableHead>Engagement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSequences.map((seq: any) => (
                      <TableRow key={seq.id}>
                        <TableCell className="font-medium">{seq.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">
                              {seq.classification_target}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {seq.stage_target}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{seq.enrollments}</TableCell>
                        <TableCell>{seq.completions}</TableCell>
                        <TableCell>
                          <span className={seq.reply_rate > 10 ? 'text-green-600' : 'text-yellow-600'}>
                            {seq.reply_rate?.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={seq.avg_engagement || 0} 
                              className="w-16 h-2" 
                            />
                            <span className="text-sm">{seq.avg_engagement?.toFixed(0) || 0}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Engagement Trends */}
          {engagementTrends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Engagement Trends (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {engagementTrends.map((trend: any, index: number) => (
                    <div 
                      key={index}
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{ 
                        height: `${Math.min(100, (trend.avg_score || 0))}%`,
                        minHeight: '4px'
                      }}
                      title={`${new Date(trend.date).toLocaleDateString()}: ${trend.total_behaviors} behaviors, ${trend.avg_score?.toFixed(1)} avg score`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sequences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Sequences</CardTitle>
            </CardHeader>
            <CardContent>
              {!sequences || sequences.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No sequences yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first nurturing sequence to start engaging prospects
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sequences as any[])?.map((seq: any) => (
                      <TableRow key={seq.id}>
                        <TableCell className="font-medium">
                          <div>
                            {seq.name}
                            {seq.created_by_ai && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                AI
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{seq.sequence_type}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-xs w-fit">
                              {seq.classification_target}
                            </Badge>
                            <Badge variant="outline" className="text-xs w-fit">
                              {seq.stage_target}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{seq.total_steps} steps</TableCell>
                        <TableCell>
                          {seq.is_active ? (
                            <Badge className="bg-green-500">
                              <Play className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Pause className="h-3 w-3 mr-1" />
                              Paused
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={seq.performance_score || 0} 
                              className="w-16 h-2" 
                            />
                            <span className="text-sm">{seq.performance_score?.toFixed(0) || 0}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {seq.conversion_rate?.toFixed(1) || 0}% conversion
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity to display.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity: any, index: number) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          activity.activity_type === 'behavior' 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-green-100 text-green-600'
                        }`}>
                          {activity.activity_type === 'behavior' ? (
                            <Activity className="h-4 w-4" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium capitalize">
                            {activity.behavior_type?.replace(/_/g, ' ') || activity.communication_type}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Engagement score: {activity.engagement_score?.toFixed(0) || 0}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(activity.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
