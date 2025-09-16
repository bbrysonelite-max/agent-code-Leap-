import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, Play } from 'lucide-react';
import { useReporting } from '../hooks/useReporting';

interface ReportBuilderProps {
  onClose?: () => void;
}

const REPORT_TYPES = [
  { value: 'prospects', label: 'Prospects Report' },
  { value: 'campaigns', label: 'Email Campaigns Report' },
  { value: 'agents', label: 'Agents Performance Report' },
  { value: 'deals', label: 'Deals Pipeline Report' },
  { value: 'activities', label: 'Activities Report' }
];

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'funnel', label: 'Funnel Chart' }
];

const TIME_PERIODS = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' }
];

const SCHEDULE_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' }
];

const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'excel', label: 'Excel' },
  { value: 'json', label: 'JSON' }
];

export function ReportBuilder({ onClose }: ReportBuilderProps) {
  const { createReport, generateReport } = useReporting();
  const [loading, setLoading] = useState(false);
  const [testingReport, setTestingReport] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'prospects',
    config: {
      date_range: {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end_date: new Date()
      },
      grouping: {
        primary: 'date',
        time_period: 'day'
      },
      metrics: ['total_prospects'],
      chart_type: 'bar',
      segments: []
    },
    filters: {
      prospect_statuses: [],
      agent_ids: [],
      campaign_ids: [],
      deal_stages: [],
      activity_types: []
    },
    schedule_config: {
      frequency: 'weekly',
      time: '09:00',
      timezone: 'UTC',
      recipients: [''],
      format: 'pdf',
      enabled: false
    }
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfigChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [field]: value }
    }));
  };

  const handleGroupingChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        grouping: { ...prev.config.grouping, [field]: value }
      }
    }));
  };

  const handleFilterChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      filters: { ...prev.filters, [field]: value }
    }));
  };

  const handleScheduleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      schedule_config: { ...prev.schedule_config, [field]: value }
    }));
  };

  const handleMetricToggle = (metric: string) => {
    const currentMetrics = formData.config.metrics;
    const newMetrics = currentMetrics.includes(metric)
      ? currentMetrics.filter(m => m !== metric)
      : [...currentMetrics, metric];
    
    handleConfigChange('metrics', newMetrics);
  };

  const addRecipient = () => {
    const newRecipients = [...formData.schedule_config.recipients, ''];
    handleScheduleChange('recipients', newRecipients);
  };

  const updateRecipient = (index: number, email: string) => {
    const newRecipients = [...formData.schedule_config.recipients];
    newRecipients[index] = email;
    handleScheduleChange('recipients', newRecipients);
  };

  const removeRecipient = (index: number) => {
    const newRecipients = formData.schedule_config.recipients.filter((_, i) => i !== index);
    handleScheduleChange('recipients', newRecipients);
  };

  const handleTestReport = async () => {
    setTestingReport(true);
    try {
      // Create a temporary report for testing
      const testReport = await createReport({
        ...formData,
        name: `Test: ${formData.name || 'Untitled Report'}`,
        schedule_config: undefined // Don't schedule test reports
      });
      
      // Generate the report
      await generateReport(testReport.id);
      alert('Test report generated successfully! Check the Reports tab to view it.');
    } catch (error) {
      console.error('Failed to test report:', error);
      alert('Failed to generate test report. Please check your configuration.');
    } finally {
      setTestingReport(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.type) {
      alert('Please fill in the report name and type');
      return;
    }

    if (formData.config.metrics.length === 0) {
      alert('Please select at least one metric');
      return;
    }

    setLoading(true);
    try {
      await createReport(formData);
      alert('Report created successfully!');
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to create report:', error);
      alert('Failed to create report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMetricsForType = (type: string) => {
    const metrics = {
      prospects: ['total_prospects', 'qualified_prospects', 'avg_score', 'conversion_rate'],
      campaigns: ['total_sent', 'open_rate', 'click_rate', 'reply_rate'],
      agents: ['active_agents', 'avg_daily_limit', 'utilization_rate'],
      deals: ['total_deals', 'total_value', 'win_rate', 'avg_deal_value'],
      activities: ['total_activities', 'success_rate', 'avg_duration']
    };
    return metrics[type as keyof typeof metrics] || [];
  };

  const availableMetrics = getMetricsForType(formData.type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Report Builder</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleTestReport}
            disabled={testingReport || !formData.name}
          >
            <Play className="h-4 w-4 mr-2" />
            {testingReport ? 'Testing...' : 'Test Report'}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Report'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
          <TabsTrigger value="visualization">Visualization</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Report Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter report name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe what this report shows"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="type">Report Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => {
                    handleInputChange('type', value);
                    // Reset metrics when changing type
                    handleConfigChange('metrics', []);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.config.date_range.start_date.toISOString().split('T')[0]}
                    onChange={(e) => handleConfigChange('date_range', {
                      ...formData.config.date_range,
                      start_date: new Date(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.config.date_range.end_date.toISOString().split('T')[0]}
                    onChange={(e) => handleConfigChange('date_range', {
                      ...formData.config.date_range,
                      end_date: new Date(e.target.value)
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {availableMetrics.map((metric) => (
                  <div key={metric} className="flex items-center space-x-2">
                    <Checkbox
                      id={metric}
                      checked={formData.config.metrics.includes(metric)}
                      onCheckedChange={() => handleMetricToggle(metric)}
                    />
                    <Label htmlFor={metric} className="text-sm">
                      {metric.replace(/_/g, ' ').toUpperCase()}
                    </Label>
                  </div>
                ))}
              </div>

              <div>
                <Label>Selected Metrics</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.config.metrics.map((metric) => (
                    <Badge key={metric} variant="secondary">
                      {metric.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <Label htmlFor="time_period">Time Grouping</Label>
                <Select
                  value={formData.config.grouping.time_period}
                  onValueChange={(value) => handleGroupingChange('time_period', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time period" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PERIODS.map((period) => (
                      <SelectItem key={period.value} value={period.value}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure filters to narrow down your report data
              </p>
              
              {formData.type === 'prospects' && (
                <div>
                  <Label>Prospect Statuses</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['new', 'contacted', 'qualified', 'unqualified'].map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={formData.filters.prospect_statuses?.includes(status)}
                          onCheckedChange={(checked) => {
                            const current = formData.filters.prospect_statuses || [];
                            const updated = checked
                              ? [...current, status]
                              : current.filter(s => s !== status);
                            handleFilterChange('prospect_statuses', updated);
                          }}
                        />
                        <Label htmlFor={`status-${status}`} className="text-sm capitalize">
                          {status}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.type === 'deals' && (
                <div>
                  <Label>Deal Stages</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'].map((stage) => (
                      <div key={stage} className="flex items-center space-x-2">
                        <Checkbox
                          id={`stage-${stage}`}
                          checked={formData.filters.deal_stages?.includes(stage)}
                          onCheckedChange={(checked) => {
                            const current = formData.filters.deal_stages || [];
                            const updated = checked
                              ? [...current, stage]
                              : current.filter(s => s !== stage);
                            handleFilterChange('deal_stages', updated);
                          }}
                        />
                        <Label htmlFor={`stage-${stage}`} className="text-sm">
                          {stage.replace(/_/g, ' ').toUpperCase()}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.type === 'activities' && (
                <div>
                  <Label>Activity Types</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['email', 'call', 'meeting', 'note', 'task'].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`activity-${type}`}
                          checked={formData.filters.activity_types?.includes(type)}
                          onCheckedChange={(checked) => {
                            const current = formData.filters.activity_types || [];
                            const updated = checked
                              ? [...current, type]
                              : current.filter(t => t !== type);
                            handleFilterChange('activity_types', updated);
                          }}
                        />
                        <Label htmlFor={`activity-${type}`} className="text-sm capitalize">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visualization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Visualization Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="chart_type">Default Chart Type</Label>
                <Select
                  value={formData.config.chart_type}
                  onValueChange={(value) => handleConfigChange('chart_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select chart type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Chart Configuration</Label>
                <div className="text-sm text-muted-foreground mt-1">
                  Charts will be automatically generated based on your selected metrics and grouping settings.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable_schedule"
                  checked={formData.schedule_config.enabled}
                  onCheckedChange={(checked) => handleScheduleChange('enabled', checked)}
                />
                <Label htmlFor="enable_schedule">Enable Scheduled Reports</Label>
              </div>

              {formData.schedule_config.enabled && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="frequency">Frequency</Label>
                      <Select
                        value={formData.schedule_config.frequency}
                        onValueChange={(value) => handleScheduleChange('frequency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {SCHEDULE_FREQUENCIES.map((freq) => (
                            <SelectItem key={freq.value} value={freq.value}>
                              {freq.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={formData.schedule_config.time}
                        onChange={(e) => handleScheduleChange('time', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="format">Export Format</Label>
                      <Select
                        value={formData.schedule_config.format}
                        onValueChange={(value) => handleScheduleChange('format', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPORT_FORMATS.map((format) => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Email Recipients</Label>
                      <Button size="sm" variant="outline" onClick={addRecipient}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {formData.schedule_config.recipients.map((email, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => updateRecipient(index, e.target.value)}
                            placeholder="Enter email address"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeRecipient(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}