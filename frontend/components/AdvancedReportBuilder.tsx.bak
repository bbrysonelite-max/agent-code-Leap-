import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Plus, X, Filter, TrendingUp, BarChart, Calendar as CalendarIcon, Download, Share2, Save, Play } from 'lucide-react';
import backend from '~backend/client';

interface ReportConfig {
  name: string;
  description: string;
  type: string;
  data_sources: string[];
  time_period: {
    start_date: Date;
    end_date: Date;
    granularity: string;
  };
  metrics: string[];
  grouping: string[];
  filters: { [key: string]: any };
  visualization: {
    chart_types: string[];
    include_tables: boolean;
    include_summaries: boolean;
  };
  advanced_options: {
    drill_down_enabled: boolean;
    real_time_updates: boolean;
    cache_duration: number;
    comparison_periods: any[];
  };
}

interface AdvancedReportBuilderProps {
  initialConfig?: Partial<ReportConfig>;
  onSave?: (config: ReportConfig) => void;
  onGenerate?: (config: ReportConfig) => void;
}

export default function FixedAdvancedReportBuilder({ 
  initialConfig, 
  onSave, 
  onGenerate 
}: AdvancedReportBuilderProps) {
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    description: '',
    type: 'prospect_analysis',
    data_sources: ['prospects'],
    time_period: {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date: new Date(),
      granularity: 'day'
    },
    metrics: ['count'],
    grouping: ['status'],
    filters: {},
    visualization: {
      chart_types: ['line'],
      include_tables: true,
      include_summaries: true
    },
    advanced_options: {
      drill_down_enabled: true,
      real_time_updates: false,
      cache_duration: 300,
      comparison_periods: []
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { id: 'basics', title: 'Report Basics', icon: BarChart },
    { id: 'data', title: 'Data & Metrics', icon: TrendingUp },
    { id: 'filters', title: 'Filters & Segments', icon: Filter },
    { id: 'visualization', title: 'Visualization', icon: BarChart },
    { id: 'advanced', title: 'Advanced Options', icon: TrendingUp }
  ];

  const reportTypes = [
    { value: 'prospect_analysis', label: 'Prospect Analysis', description: 'Analyze prospect behavior and conversion' },
    { value: 'email_performance', label: 'Email Performance', description: 'Track email campaigns and engagement' },
    { value: 'agent_performance', label: 'Agent Performance', description: 'Monitor agent productivity and efficiency' },
    { value: 'deal_pipeline', label: 'Deal Pipeline', description: 'Analyze deal progression and velocity' },
    { value: 'conversion_funnel', label: 'Conversion Funnel', description: 'Track conversion through stages' },
    { value: 'cohort_analysis', label: 'Cohort Analysis', description: 'Analyze user retention and behavior over time' },
    { value: 'custom', label: 'Custom Report', description: 'Build a custom report with flexible options' }
  ];

  const chartTypeOptions = [
    { value: 'line', label: 'Line Chart', icon: '📈' },
    { value: 'bar', label: 'Bar Chart', icon: '📊' },
    { value: 'pie', label: 'Pie Chart', icon: '🥧' },
    { value: 'area', label: 'Area Chart', icon: '📈' },
    { value: 'funnel', label: 'Funnel Chart', icon: '🔽' },
    { value: 'heatmap', label: 'Heatmap', icon: '🌡️' },
    { value: 'scatter', label: 'Scatter Plot', icon: '⚪' }
  ];

  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => ({ ...prev, ...initialConfig }));
    }
  }, [initialConfig]);

  const updateConfig = (path: string, value: any) => {
    setConfig(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (onSave) {
        await onSave(config);
      }
    } catch (error) {
      console.error('Failed to save report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      if (onGenerate) {
        await onGenerate(config);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderBasicsStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="name">Report Name</Label>
          <Input
            id="name"
            value={config.name}
            onChange={(e) => updateConfig('name', e.target.value)}
            placeholder="Enter report name"
          />
        </div>
        
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={config.description}
            onChange={(e) => updateConfig('description', e.target.value)}
            placeholder="Describe what this report will analyze"
            rows={3}
          />
        </div>
      </div>

      <div>
        <Label>Report Type</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {reportTypes.map((type) => (
            <Card 
              key={type.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                config.type === type.value ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => updateConfig('type', type.value)}
            >
              <CardContent className="p-4">
                <div className="font-medium">{type.label}</div>
                <div className="text-sm text-gray-600 mt-1">{type.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Label>Time Period</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div>
            <Label className="text-sm">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {config.time_period.start_date.toLocaleDateString()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={config.time_period.start_date}
                  onSelect={(date) => date && updateConfig('time_period.start_date', date)}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label className="text-sm">End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {config.time_period.end_date.toLocaleDateString()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={config.time_period.end_date}
                  onSelect={(date) => date && updateConfig('time_period.end_date', date)}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label className="text-sm">Granularity</Label>
            <Select 
              value={config.time_period.granularity} 
              onValueChange={(value) => updateConfig('time_period.granularity', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Hour</SelectItem>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVisualizationStep = () => (
    <div className="space-y-6">
      <div>
        <Label>Chart Types</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {chartTypeOptions.map((chart) => (
            <Card 
              key={chart.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                config.visualization.chart_types.includes(chart.value) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => {
                const updated = config.visualization.chart_types.includes(chart.value)
                  ? config.visualization.chart_types.filter(c => c !== chart.value)
                  : [...config.visualization.chart_types, chart.value];
                updateConfig('visualization.chart_types', updated);
              }}
            >
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-2">{chart.icon}</div>
                <div className="text-sm font-medium">{chart.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="include-tables"
            checked={config.visualization.include_tables}
            onCheckedChange={(checked) => updateConfig('visualization.include_tables', checked)}
          />
          <Label htmlFor="include-tables">Include data tables</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="include-summaries"
            checked={config.visualization.include_summaries}
            onCheckedChange={(checked) => updateConfig('visualization.include_summaries', checked)}
          />
          <Label htmlFor="include-summaries">Include summary statistics</Label>
        </div>
      </div>
    </div>
  );

  const renderAdvancedStep = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="drill-down"
            checked={config.advanced_options.drill_down_enabled}
            onCheckedChange={(checked) => updateConfig('advanced_options.drill_down_enabled', checked)}
          />
          <Label htmlFor="drill-down">Enable drill-down capabilities</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="real-time"
            checked={config.advanced_options.real_time_updates}
            onCheckedChange={(checked) => updateConfig('advanced_options.real_time_updates', checked)}
          />
          <Label htmlFor="real-time">Real-time updates</Label>
        </div>
      </div>

      <div>
        <Label>Cache Duration (seconds)</Label>
        <Input
          type="number"
          value={config.advanced_options.cache_duration}
          onChange={(e) => updateConfig('advanced_options.cache_duration', parseInt(e.target.value))}
          className="mt-1"
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Report Builder</h1>
        <p className="text-gray-600">Create sophisticated reports with drill-down analytics and custom visualizations</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div 
                key={step.id}
                className={`flex items-center cursor-pointer ${
                  index < steps.length - 1 ? 'flex-1' : ''
                }`}
                onClick={() => setCurrentStep(index)}
              >
                <div className={`flex items-center ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isActive ? 'border-blue-600 bg-blue-50' : 
                    isCompleted ? 'border-green-600 bg-green-50' : 
                    'border-gray-300 bg-white'
                  }`}>
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <span className="ml-2 text-sm font-medium">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && renderBasicsStep()}
          {currentStep === 1 && <div>Data and Metrics Configuration</div>}
          {currentStep === 2 && <div>Filters and Segments Configuration</div>}
          {currentStep === 3 && renderVisualizationStep()}
          {currentStep === 4 && renderAdvancedStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          Previous
        </Button>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isLoading || !config.name}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Report
          </Button>
          
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !config.name}
          >
            <Play className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
        
        <Button
          onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
          disabled={currentStep === steps.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}