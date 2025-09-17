import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  ChevronRight, 
  ArrowLeft,
  Download,
  Bookmark,
  RefreshCw
} from 'lucide-react';

interface DrillDownData {
  metric: string;
  dimension: string;
  data: any[];
  total_records: number;
  aggregations: { [key: string]: any };
  parent_context?: any;
}

interface DrillDownAnalyzerProps {
  initialMetric?: string;
  initialFilters?: any;
  onSaveDrillDown?: (drillDown: any) => void;
}

export default function SimpleDrillDownAnalyzer({ 
  initialMetric = 'prospect_conversion',
  initialFilters = {},
  onSaveDrillDown
}: DrillDownAnalyzerProps) {
  const [currentMetric, setCurrentMetric] = useState(initialMetric);
  const [filters, setFilters] = useState(initialFilters);
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chart');

  const metricOptions = [
    { value: 'prospect_conversion', label: 'Prospect Conversion', icon: TrendingUp },
    { value: 'email_engagement', label: 'Email Engagement', icon: BarChart3 },
    { value: 'agent_performance', label: 'Agent Performance', icon: TrendingUp },
    { value: 'deal_velocity', label: 'Deal Velocity', icon: TrendingDown }
  ];

  const mockDrillDownData: DrillDownData = {
    metric: 'prospect_conversion',
    dimension: 'source_breakdown',
    data: [
      { source: 'LinkedIn', prospects: 150, converted: 45, conversion_rate: 30 },
      { source: 'Website', prospects: 120, converted: 24, conversion_rate: 20 },
      { source: 'Email', prospects: 80, converted: 12, conversion_rate: 15 },
      { source: 'Referral', prospects: 60, converted: 18, conversion_rate: 30 }
    ],
    total_records: 410,
    aggregations: {
      total_prospects: 410,
      total_converted: 99,
      overall_conversion_rate: 24.1,
      top_source: 'LinkedIn'
    }
  };

  const performDrillDown = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setDrillDownData(mockDrillDownData);
      setIsLoading(false);
    }, 1000);
  };

  useEffect(() => {
    performDrillDown();
  }, [currentMetric]);

  const renderChart = () => {
    if (!drillDownData?.data) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(drillDownData.aggregations).map(([key, value]) => (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                <div className="text-sm text-gray-600">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drillDownData.data.slice(0, 10).map((item, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {Object.entries(item)
                        .filter(([key]) => key !== 'value' && key !== 'count')
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTable = () => {
    if (!drillDownData?.data) return null;

    const columns = drillDownData.data.length > 0 ? Object.keys(drillDownData.data[0]) : [];

    return (
      <Card>
        <CardHeader>
          <CardTitle>Detailed Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {columns.map((column) => (
                    <th key={column} className="text-left p-2 font-medium">
                      {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drillDownData.data.map((row, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    {columns.map((column) => (
                      <td key={column} className="p-2">
                        {typeof row[column] === 'number' 
                          ? row[column].toLocaleString() 
                          : row[column]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderInsights = () => {
    if (!drillDownData) return null;

    const insights = [
      `Analyzed ${drillDownData.total_records} records`,
      `Primary dimension: ${drillDownData.dimension}`,
      `Top performing segment: ${drillDownData.data[0] ? Object.values(drillDownData.data[0])[0] : 'N/A'}`
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                <div className="text-sm text-gray-700">{insight}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Drill-Down Analyzer</h1>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!drillDownData}
            >
              <Bookmark className="w-4 h-4 mr-2" />
              Save Analysis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={performDrillDown}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analysis Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Metric to Analyze</Label>
                <Select value={currentMetric} onValueChange={setCurrentMetric}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metricOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <div className="text-lg font-medium">Analyzing data...</div>
                <div className="text-sm text-gray-600">Performing drill-down analysis</div>
              </CardContent>
            </Card>
          ) : drillDownData ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chart">Visual Analysis</TabsTrigger>
                <TabsTrigger value="table">Data Table</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>
              
              <TabsContent value="chart" className="mt-4">
                {renderChart()}
              </TabsContent>
              
              <TabsContent value="table" className="mt-4">
                {renderTable()}
              </TabsContent>
              
              <TabsContent value="insights" className="mt-4">
                {renderInsights()}
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <div className="text-lg font-medium text-gray-600">Select a metric to begin analysis</div>
                <div className="text-sm text-gray-500">Choose a metric and dimension to start drilling down into your data</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}