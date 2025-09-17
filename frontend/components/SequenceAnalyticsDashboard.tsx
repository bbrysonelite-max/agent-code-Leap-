import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  MousePointer,
  MessageCircle,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { useSequenceAnalytics, useOptimizeSequence } from '../hooks/useNurturing';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';

interface AnalyticsDashboardProps {
  sequences: any[];
  selectedSequenceId: string | null;
}

export default function SequenceAnalyticsDashboard({ 
  sequences, 
  selectedSequenceId 
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('30');
  const [selectedSequence, setSelectedSequence] = useState(selectedSequenceId || '');
  
  const { data: analytics, isLoading } = useSequenceAnalytics(
    selectedSequence, 
    parseInt(timeRange)
  );
  
  const optimizeSequence = useOptimizeSequence();
  const { toast } = useToast();

  if (!selectedSequence) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select a Sequence</h3>
          <p className="text-muted-foreground text-center mb-4">
            Choose a nurturing sequence to view detailed analytics and performance metrics.
          </p>
          <Select value={selectedSequence} onValueChange={setSelectedSequence}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select sequence..." />
            </SelectTrigger>
            <SelectContent>
              {sequences.map((seq) => (
                <SelectItem key={seq.id} value={seq.id}>
                  {seq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-muted-foreground">
            Analytics data is not available for this sequence.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sequence = sequences.find(s => s.id === selectedSequence);

  const handleOptimize = async (goal: 'conversion' | 'engagement' | 'response_rate') => {
    try {
      const result = await optimizeSequence.mutateAsync({
        sequenceId: selectedSequence,
        optimizationGoal: goal
      });
      
      toast({
        title: "Optimization Complete",
        description: `Found ${result.recommendations.length} recommendations with ${result.estimatedImprovement}% estimated improvement`
      });
    } catch (error) {
      toast({
        title: "Optimization Failed",
        description: "Unable to generate optimization recommendations",
        variant: "destructive"
      });
    }
  };

  const stepPerformanceData = analytics.stepPerformance.map(step => ({
    step: `Step ${step.stepNumber}`,
    sent: step.sentCount,
    delivered: step.deliveredCount,
    opened: step.openCount,
    clicked: step.clickCount,
    responded: step.responseCount,
    dropoffRate: step.dropoffRate * 100
  }));

  const engagementData = [
    { name: 'Sent', value: analytics.engagementMetrics.totalSent, color: '#8884d8' },
    { name: 'Opened', value: Math.round(analytics.engagementMetrics.totalSent * analytics.engagementMetrics.openRate), color: '#82ca9d' },
    { name: 'Clicked', value: Math.round(analytics.engagementMetrics.totalSent * analytics.engagementMetrics.clickRate), color: '#ffc658' },
    { name: 'Responded', value: Math.round(analytics.engagementMetrics.totalSent * analytics.engagementMetrics.responseRate), color: '#ff7300' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{sequence?.name} Analytics</h2>
          <p className="text-muted-foreground">
            Performance insights and optimization recommendations
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedSequence} onValueChange={setSelectedSequence}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sequences.map((seq) => (
                <SelectItem key={seq.id} value={seq.id}>
                  {seq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolled</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalEnrolled}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.activeEnrollments} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.conversionRate * 100)}%
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {analytics.conversionRate > 0.15 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              {analytics.completedEnrollments} completed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.engagementMetrics.openRate * 100)}%
            </div>
            <Progress 
              value={analytics.engagementMetrics.openRate * 100} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.engagementMetrics.clickRate * 100)}%
            </div>
            <Progress 
              value={analytics.engagementMetrics.clickRate * 100} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.engagementMetrics.responseRate * 100)}%
            </div>
            <Progress 
              value={analytics.engagementMetrics.responseRate * 100} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Step Performance</CardTitle>
            <CardDescription>
              Performance metrics for each step in the sequence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stepPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="step" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sent" name="Sent" fill="#8884d8" />
                <Bar dataKey="opened" name="Opened" fill="#82ca9d" />
                <Bar dataKey="clicked" name="Clicked" fill="#ffc658" />
                <Bar dataKey="responded" name="Responded" fill="#ff7300" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Engagement Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Funnel</CardTitle>
            <CardDescription>
              Overall engagement funnel for the sequence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={engagementData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {engagementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Step Dropoff Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Step Dropoff Analysis</CardTitle>
          <CardDescription>
            Identify where prospects are dropping off in your sequence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stepPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="step" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="dropoffRate" 
                stroke="#ff4444" 
                fill="#ff4444" 
                fillOpacity={0.3}
                name="Dropoff Rate (%)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Optimization Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Optimize for Conversion
            </CardTitle>
            <CardDescription>
              Get recommendations to improve conversion rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleOptimize('conversion')}
              disabled={optimizeSequence.isPending}
              className="w-full"
            >
              {optimizeSequence.isPending ? 'Analyzing...' : 'Generate Recommendations'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Optimize for Engagement
            </CardTitle>
            <CardDescription>
              Improve open rates and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleOptimize('engagement')}
              disabled={optimizeSequence.isPending}
              className="w-full"
              variant="outline"
            >
              {optimizeSequence.isPending ? 'Analyzing...' : 'Generate Recommendations'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Optimize for Response
            </CardTitle>
            <CardDescription>
              Increase response rates and interactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleOptimize('response_rate')}
              disabled={optimizeSequence.isPending}
              className="w-full"
              variant="outline"
            >
              {optimizeSequence.isPending ? 'Analyzing...' : 'Generate Recommendations'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Time to Conversion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time to Conversion
          </CardTitle>
          <CardDescription>
            Average time for prospects to convert through this sequence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2">
            {Math.round(analytics.avgTimeToConversion)} days
          </div>
          <div className="text-sm text-muted-foreground">
            Based on {analytics.completedEnrollments} completed enrollments
          </div>
          <Progress 
            value={Math.min((30 / Math.max(analytics.avgTimeToConversion, 1)) * 100, 100)} 
            className="h-2 mt-4"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Benchmark: 30 days or less is considered optimal
          </p>
        </CardContent>
      </Card>
    </div>
  );
}