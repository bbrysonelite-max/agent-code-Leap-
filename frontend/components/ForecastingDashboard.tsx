import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Target, 
  Clock, 
  Users, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  LineChart,
  Calendar,
  Brain,
  Zap
} from 'lucide-react';
import backend from '~backend/client';

interface ConversionPrediction {
  id: string;
  prospectId: string;
  predictionScore: number;
  confidence: number;
  factors: ConversionFactor[];
  predictedDate?: Date;
  createdAt: Date;
}

interface ConversionFactor {
  name: string;
  weight: number;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
}

interface RevenueForecast {
  id: string;
  clientId?: string;
  agentId?: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  predictedRevenue: number;
  confidence: number;
  trendDirection: 'up' | 'down' | 'stable';
  factors: ForecastFactor[];
  createdAt: Date;
}

interface ForecastFactor {
  category: string;
  weight: number;
  historicalAverage: number;
  currentTrend: number;
  seasonalAdjustment: number;
}

interface OutreachTiming {
  id: string;
  prospectId: string;
  recommendedTime: Date;
  channel: 'email' | 'call' | 'linkedin' | 'social';
  probability: number;
  reasoning: string[];
  timeZone: string;
  createdAt: Date;
}

interface CohortAnalysis {
  id: string;
  cohortName: string;
  startDate: Date;
  endDate: Date;
  totalProspects: number;
  convertedProspects: number;
  conversionRate: number;
  averageTimeToConvert: number;
  totalRevenue: number;
  averageRevenuePerProspect: number;
  retentionRate: number;
  dropoffStages: CohortDropoff[];
  createdAt: Date;
}

interface CohortDropoff {
  stage: string;
  count: number;
  percentage: number;
}

interface PerformancePrediction {
  id: string;
  entityType: 'agent' | 'campaign' | 'client';
  entityId: string;
  metric: 'conversion_rate' | 'revenue' | 'response_rate' | 'engagement';
  period: 'week' | 'month' | 'quarter';
  currentValue: number;
  predictedValue: number;
  confidence: number;
  trend: 'improving' | 'declining' | 'stable';
  recommendations: string[];
  createdAt: Date;
}

const ForecastingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [conversionPredictions, setConversionPredictions] = useState<ConversionPrediction[]>([]);
  const [revenueForecasts, setRevenueForecasts] = useState<RevenueForecast[]>([]);
  const [outreachTiming, setOutreachTiming] = useState<OutreachTiming[]>([]);
  const [cohortAnalyses, setCohortAnalyses] = useState<CohortAnalysis[]>([]);
  const [performancePredictions, setPerformancePredictions] = useState<PerformancePrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForecastingData();
  }, [selectedPeriod]);

  const loadForecastingData = async () => {
    setLoading(true);
    try {
      const [
        conversions,
        revenue,
        timing,
        cohorts,
        performance
      ] = await Promise.all([
        backend.forecasting.getConversionPredictions().then(r => r.predictions),
        backend.forecasting.getRevenueForecasts().then(r => r.forecasts),
        backend.forecasting.getTimingAnalytics(),
        backend.forecasting.getCohortAnalyses().then(r => r.analyses),
        backend.forecasting.getPerformancePredictions({}).then(r => r.predictions)
      ]);

      setConversionPredictions(conversions);
      setRevenueForecasts(revenue);
      setOutreachTiming(timing.recentRecommendations || []);
      setCohortAnalyses(cohorts);
      setPerformancePredictions(performance);
    } catch (error) {
      console.error('Failed to load forecasting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainModel = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);

      await backend.forecasting.trainConversionModel({
        startDate,
        endDate,
        features: [
          'company_size',
          'industry_score',
          'job_title_score',
          'email_engagement',
          'activity_level',
          'meetings_scheduled'
        ]
      });

      await loadForecastingData();
    } catch (error) {
      console.error('Failed to train model:', error);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    const variant = confidence > 0.7 ? 'default' : confidence > 0.4 ? 'secondary' : 'destructive';
    return <Badge variant={variant}>{percentage}% confidence</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Forecasting Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const topConversionPredictions = conversionPredictions
    .sort((a, b) => b.predictionScore - a.predictionScore)
    .slice(0, 5);

  const latestRevenueForecast = revenueForecasts[0];
  const avgConversionScore = conversionPredictions.length > 0 
    ? conversionPredictions.reduce((sum, p) => sum + p.predictionScore, 0) / conversionPredictions.length 
    : 0;

  const upcomingOutreach = outreachTiming
    .filter(timing => new Date(timing.recommendedTime) > new Date())
    .sort((a, b) => new Date(a.recommendedTime).getTime() - new Date(b.recommendedTime).getTime())
    .slice(0, 5);

  const latestCohort = cohortAnalyses[0];
  const improvingPerformance = performancePredictions.filter(p => p.trend === 'improving').length;
  const decliningPerformance = performancePredictions.filter(p => p.trend === 'declining').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Forecasting Dashboard</h1>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleTrainModel} variant="outline">
            <Brain className="h-4 w-4 mr-2" />
            Train Model
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Conversion Score</p>
                <p className="text-2xl font-bold">{(avgConversionScore * 100).toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Revenue Forecast</p>
                <p className="text-2xl font-bold">
                  {latestRevenueForecast ? formatCurrency(latestRevenueForecast.predictedRevenue) : '$0'}
                </p>
                <div className="flex items-center mt-1">
                  {latestRevenueForecast && getTrendIcon(latestRevenueForecast.trendDirection)}
                  <span className="text-sm text-muted-foreground ml-1">
                    {latestRevenueForecast?.period || 'N/A'}
                  </span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Optimal Timing</p>
                <p className="text-2xl font-bold">{upcomingOutreach.length}</p>
                <p className="text-sm text-muted-foreground">upcoming recommendations</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Performance Trends</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm">{improvingPerformance}</span>
                  </div>
                  <div className="flex items-center">
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                    <span className="text-sm">{decliningPerformance}</span>
                  </div>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
          <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Top Conversion Predictions
                </CardTitle>
                <CardDescription>Prospects most likely to convert</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topConversionPredictions.map((prediction) => (
                    <div key={prediction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">Prospect {prediction.prospectId.slice(0, 8)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={prediction.predictionScore * 100} className="w-24" />
                          <span className="text-sm text-muted-foreground">
                            {(prediction.predictionScore * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {getConfidenceBadge(prediction.confidence)}
                        {prediction.predictedDate && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(prediction.predictedDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Upcoming Outreach
                </CardTitle>
                <CardDescription>Optimal timing recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingOutreach.map((timing) => (
                    <div key={timing.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">Prospect {timing.prospectId.slice(0, 8)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{timing.channel}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {(timing.probability * 100).toFixed(0)}% probability
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatDate(timing.recommendedTime)}</p>
                        <p className="text-sm text-muted-foreground">{timing.timeZone}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Latest Cohort Analysis
                </CardTitle>
                <CardDescription>
                  {latestCohort ? latestCohort.cohortName : 'No cohort data available'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {latestCohort ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Prospects</p>
                        <p className="text-2xl font-bold">{latestCohort.totalProspects}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Conversion Rate</p>
                        <p className="text-2xl font-bold">{(latestCohort.conversionRate * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Time to Convert</p>
                        <p className="text-2xl font-bold">{latestCohort.averageTimeToConvert} days</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Revenue per Prospect</p>
                        <p className="text-2xl font-bold">{formatCurrency(latestCohort.averageRevenuePerProspect)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No cohort analysis data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Predictions
                </CardTitle>
                <CardDescription>Entity performance trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performancePredictions.slice(0, 5).map((prediction) => (
                    <div key={prediction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{prediction.entityType} {prediction.entityId.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">{prediction.metric}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(prediction.trend)}
                        <div className="text-right">
                          <p className="font-medium">
                            {prediction.metric.includes('rate') 
                              ? `${(prediction.predictedValue * 100).toFixed(1)}%`
                              : prediction.metric === 'revenue'
                              ? formatCurrency(prediction.predictedValue)
                              : prediction.predictedValue.toFixed(1)
                            }
                          </p>
                          {getConfidenceBadge(prediction.confidence)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conversion" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Predictions</CardTitle>
                <CardDescription>Detailed prospect conversion likelihood analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conversionPredictions.slice(0, 10).map((prediction) => (
                    <div key={prediction.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Prospect {prediction.prospectId.slice(0, 8)}</h4>
                        {getConfidenceBadge(prediction.confidence)}
                      </div>
                      
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex-1">
                          <Progress value={prediction.predictionScore * 100} className="mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {(prediction.predictionScore * 100).toFixed(1)}% conversion likelihood
                          </p>
                        </div>
                        {prediction.predictedDate && (
                          <div className="text-right">
                            <p className="text-sm font-medium">Predicted Date</p>
                            <p className="text-sm text-muted-foreground">{formatDate(prediction.predictedDate)}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Key Factors:</p>
                        {prediction.factors.slice(0, 3).map((factor, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{factor.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={factor.impact === 'positive' ? 'text-green-600' : factor.impact === 'negative' ? 'text-red-600' : 'text-gray-600'}>
                                {factor.impact === 'positive' ? '+' : factor.impact === 'negative' ? '-' : ''}
                                {(factor.weight * 100).toFixed(0)}%
                              </span>
                              {factor.impact === 'positive' ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : factor.impact === 'negative' ? (
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                              ) : (
                                <Minus className="h-3 w-3 text-gray-500" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Insights</CardTitle>
                <CardDescription>Key patterns and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Score Distribution</h4>
                    <div className="space-y-2">
                      {['High (70%+)', 'Medium (40-70%)', 'Low (<40%)'].map((range, index) => {
                        const counts = [
                          conversionPredictions.filter(p => p.predictionScore >= 0.7).length,
                          conversionPredictions.filter(p => p.predictionScore >= 0.4 && p.predictionScore < 0.7).length,
                          conversionPredictions.filter(p => p.predictionScore < 0.4).length
                        ];
                        return (
                          <div key={range} className="flex items-center justify-between">
                            <span className="text-sm">{range}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={(counts[index] / conversionPredictions.length) * 100} className="w-20" />
                              <span className="text-sm font-medium">{counts[index]}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Top Converting Factors</h4>
                    <div className="space-y-2">
                      {['Meeting Engagement', 'Email Engagement', 'High-Value Job Title'].map((factor) => (
                        <div key={factor} className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <span className="text-sm">{factor}</span>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Risk Factors</h4>
                    <div className="space-y-2">
                      {['Long Pipeline Duration', 'Low Engagement', 'Poor Job Title Match'].map((factor) => (
                        <div key={factor} className="flex items-center justify-between p-2 bg-red-50 rounded">
                          <span className="text-sm">{factor}</span>
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Forecasts</CardTitle>
                <CardDescription>Predicted revenue by period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {revenueForecasts.slice(0, 5).map((forecast) => (
                    <div key={forecast.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{forecast.period.charAt(0).toUpperCase() + forecast.period.slice(1)} Forecast</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(forecast.startDate).toLocaleDateString()} - {new Date(forecast.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        {getTrendIcon(forecast.trendDirection)}
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-2xl font-bold">{formatCurrency(forecast.predictedRevenue)}</p>
                        {getConfidenceBadge(forecast.confidence)}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Forecast Factors:</p>
                        {forecast.factors.slice(0, 2).map((factor, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{factor.category}</span>
                            <span className="font-medium">{(factor.weight * 100).toFixed(0)}% weight</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Historical and projected revenue patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Trend Analysis</h4>
                    <div className="space-y-3">
                      {revenueForecasts.slice(0, 3).map((forecast) => (
                        <div key={forecast.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{forecast.period}</p>
                            <p className="text-sm text-muted-foreground">
                              Trend: {forecast.trendDirection}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(forecast.trendDirection)}
                            <span className="font-medium">{formatCurrency(forecast.predictedRevenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Key Insights</h4>
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-50 rounded">
                        <p className="text-sm">
                          <strong>Growth Trend:</strong> Revenue showing positive momentum across quarterly forecasts
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded">
                        <p className="text-sm">
                          <strong>Seasonality:</strong> Q4 typically shows 15-20% higher performance
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded">
                        <p className="text-sm">
                          <strong>Pipeline Health:</strong> Strong pipeline indicates sustained growth potential
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Optimal Outreach Times</CardTitle>
                <CardDescription>AI-powered timing recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {outreachTiming.slice(0, 8).map((timing) => (
                    <div key={timing.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">Prospect {timing.prospectId.slice(0, 8)}</h4>
                          <p className="text-sm text-muted-foreground">{timing.timeZone}</p>
                        </div>
                        <Badge variant="outline">{timing.channel}</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-lg font-semibold">{formatDate(timing.recommendedTime)}</p>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Success Probability</p>
                          <p className="font-medium">{(timing.probability * 100).toFixed(0)}%</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Reasoning:</p>
                        {timing.reasoning.slice(0, 2).map((reason, index) => (
                          <p key={index} className="text-sm text-muted-foreground">• {reason}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Performance</CardTitle>
                <CardDescription>Engagement rates by channel and time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Best Performing Channels</h4>
                    <div className="space-y-3">
                      {[
                        { channel: 'Email', rate: 0.24, time: '10:00 AM' },
                        { channel: 'LinkedIn', rate: 0.31, time: '2:00 PM' },
                        { channel: 'Call', rate: 0.18, time: '11:00 AM' },
                        { channel: 'Social', rate: 0.15, time: '3:00 PM' }
                      ].map((item) => (
                        <div key={item.channel} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{item.channel}</p>
                            <p className="text-sm text-muted-foreground">Best time: {item.time}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{(item.rate * 100).toFixed(1)}%</p>
                            <p className="text-sm text-muted-foreground">response rate</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Timing Insights</h4>
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-50 rounded">
                        <p className="text-sm">
                          <strong>Peak Hours:</strong> 10-11 AM and 2-3 PM show highest engagement
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded">
                        <p className="text-sm">
                          <strong>Best Days:</strong> Tuesday and Wednesday outperform other weekdays
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded">
                        <p className="text-sm">
                          <strong>Time Zones:</strong> Adjust for prospect's local time for 23% better response
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cohort Analysis</CardTitle>
                <CardDescription>Track prospect groups over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cohortAnalyses.slice(0, 5).map((cohort) => (
                    <div key={cohort.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{cohort.cohortName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(cohort.startDate).toLocaleDateString()} - {new Date(cohort.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Prospects</p>
                          <p className="text-xl font-bold">{cohort.totalProspects}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Converted</p>
                          <p className="text-xl font-bold">{cohort.convertedProspects}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Conversion Rate</p>
                          <p className="text-xl font-bold">{(cohort.conversionRate * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Time</p>
                          <p className="text-xl font-bold">{cohort.averageTimeToConvert}d</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Total Revenue</span>
                          <span className="font-medium">{formatCurrency(cohort.totalRevenue)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Revenue per Prospect</span>
                          <span className="font-medium">{formatCurrency(cohort.averageRevenuePerProspect)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Retention Rate</span>
                          <span className="font-medium">{(cohort.retentionRate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cohort Insights</CardTitle>
                <CardDescription>Performance patterns and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Conversion Funnel</h4>
                    {latestCohort && (
                      <div className="space-y-2">
                        {latestCohort.dropoffStages.map((stage, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{stage.stage}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{stage.count}</span>
                              <span className="text-sm text-muted-foreground">({stage.percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Performance Comparison</h4>
                    <div className="space-y-3">
                      {cohortAnalyses.slice(0, 3).map((cohort, index) => (
                        <div key={cohort.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{cohort.cohortName}</p>
                            <p className="text-sm text-muted-foreground">
                              {(cohort.conversionRate * 100).toFixed(1)}% conversion
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(cohort.averageRevenuePerProspect)}</p>
                            <p className="text-sm text-muted-foreground">per prospect</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Key Findings</h4>
                    <div className="space-y-2">
                      <div className="p-3 bg-green-50 rounded">
                        <p className="text-sm">
                          <strong>Top Performer:</strong> Enterprise cohort shows 34% higher conversion rates
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded">
                        <p className="text-sm">
                          <strong>Time Pattern:</strong> Prospects convert 40% faster with regular follow-up
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded">
                        <p className="text-sm">
                          <strong>Retention:</strong> High-touch cohorts show 25% better retention rates
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ForecastingDashboard;