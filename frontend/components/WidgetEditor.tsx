import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DashboardWidget } from '~backend/reporting/types';
import { useReporting } from '../hooks/useReporting';

interface WidgetEditorProps {
  dashboardId: string;
  widget?: DashboardWidget | null;
  onClose: () => void;
  onSave: () => void;
}

const WIDGET_TYPES = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
  { value: 'metric', label: 'Metric' },
  { value: 'timeline', label: 'Timeline' }
];

const DATA_SOURCES = [
  { value: 'prospects', label: 'Prospects' },
  { value: 'campaigns', label: 'Email Campaigns' },
  { value: 'agents', label: 'Agents' },
  { value: 'deals', label: 'Deals' },
  { value: 'activities', label: 'Activities' }
];

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'doughnut', label: 'Doughnut Chart' }
];

const METRICS_BY_SOURCE = {
  prospects: ['total_prospects', 'qualified_prospects', 'avg_score', 'conversion_rate'],
  campaigns: ['total_sent', 'open_rate', 'click_rate', 'reply_rate'],
  agents: ['active_agents', 'avg_daily_limit', 'utilization_rate'],
  deals: ['total_deals', 'total_value', 'win_rate', 'avg_deal_value'],
  activities: ['total_activities', 'success_rate', 'avg_duration']
};

export function WidgetEditor({ dashboardId, widget, onClose, onSave }: WidgetEditorProps) {
  const { createWidget, updateWidget } = useReporting();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: widget?.title || '',
    widget_type: widget?.widget_type || 'chart',
    data_source: widget?.data_source || 'prospects',
    position_x: widget?.position_x || 0,
    position_y: widget?.position_y || 0,
    width: widget?.width || 4,
    height: widget?.height || 3,
    config: {
      chart_type: widget?.config?.chart_type || 'bar',
      metrics: widget?.config?.metrics || [],
      filters: widget?.config?.filters || {},
      date_range: widget?.config?.date_range || {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end_date: new Date()
      },
      display_options: widget?.config?.display_options || {
        show_legend: true,
        show_labels: true,
        color_scheme: 'default',
        animation: true
      }
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

  const handleDisplayOptionChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        display_options: { ...prev.config.display_options, [field]: value }
      }
    }));
  };

  const handleMetricToggle = (metric: string) => {
    const currentMetrics = formData.config.metrics;
    const newMetrics = currentMetrics.includes(metric)
      ? currentMetrics.filter(m => m !== metric)
      : [...currentMetrics, metric];
    
    handleConfigChange('metrics', newMetrics);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.widget_type || !formData.data_source) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.config.metrics.length === 0) {
      alert('Please select at least one metric');
      return;
    }

    setLoading(true);
    try {
      if (widget) {
        await updateWidget(widget.id, formData);
      } else {
        await createWidget({
          dashboard_id: dashboardId,
          ...formData
        });
      }
      onSave();
    } catch (error) {
      console.error('Failed to save widget:', error);
      alert('Failed to save widget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const availableMetrics = METRICS_BY_SOURCE[formData.data_source as keyof typeof METRICS_BY_SOURCE] || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {widget ? 'Edit Widget' : 'Create New Widget'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Widget Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter widget title"
                />
              </div>
              <div>
                <Label htmlFor="widget_type">Widget Type</Label>
                <Select
                  value={formData.widget_type}
                  onValueChange={(value) => handleInputChange('widget_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select widget type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDGET_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="data_source">Data Source</Label>
              <Select
                value={formData.data_source}
                onValueChange={(value) => {
                  handleInputChange('data_source', value);
                  handleConfigChange('metrics', []); // Reset metrics when changing data source
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select data source" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.widget_type === 'chart' && (
              <div>
                <Label htmlFor="chart_type">Chart Type</Label>
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
            )}
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <div>
              <Label>Metrics</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
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
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.config.metrics.map((metric) => (
                  <Badge key={metric} variant="secondary">
                    {metric.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
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
          </TabsContent>

          <TabsContent value="display" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Display Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show_legend"
                    checked={formData.config.display_options.show_legend}
                    onCheckedChange={(checked) => handleDisplayOptionChange('show_legend', checked)}
                  />
                  <Label htmlFor="show_legend">Show Legend</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show_labels"
                    checked={formData.config.display_options.show_labels}
                    onCheckedChange={(checked) => handleDisplayOptionChange('show_labels', checked)}
                  />
                  <Label htmlFor="show_labels">Show Labels</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="animation"
                    checked={formData.config.display_options.animation}
                    onCheckedChange={(checked) => handleDisplayOptionChange('animation', checked)}
                  />
                  <Label htmlFor="animation">Enable Animation</Label>
                </div>

                <div>
                  <Label htmlFor="color_scheme">Color Scheme</Label>
                  <Select
                    value={formData.config.display_options.color_scheme}
                    onValueChange={(value) => handleDisplayOptionChange('color_scheme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select color scheme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="layout" className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="position_x">X Position</Label>
                <Input
                  id="position_x"
                  type="number"
                  min="0"
                  max="11"
                  value={formData.position_x}
                  onChange={(e) => handleInputChange('position_x', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="position_y">Y Position</Label>
                <Input
                  id="position_y"
                  type="number"
                  min="0"
                  value={formData.position_y}
                  onChange={(e) => handleInputChange('position_y', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="width">Width (1-12)</Label>
                <Input
                  id="width"
                  type="number"
                  min="1"
                  max="12"
                  value={formData.width}
                  onChange={(e) => handleInputChange('width', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="height">Height (1-6)</Label>
                <Input
                  id="height"
                  type="number"
                  min="1"
                  max="6"
                  value={formData.height}
                  onChange={(e) => handleInputChange('height', parseInt(e.target.value))}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Grid Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-12 gap-1 h-32 border rounded">
                  {Array.from({ length: 72 }, (_, i) => {
                    const col = i % 12;
                    const row = Math.floor(i / 12);
                    const isOccupied = col >= formData.position_x && 
                                     col < formData.position_x + formData.width &&
                                     row >= formData.position_y &&
                                     row < formData.position_y + formData.height;
                    
                    return (
                      <div
                        key={i}
                        className={`aspect-square border border-gray-200 ${
                          isOccupied ? 'bg-blue-200' : 'bg-gray-50'
                        }`}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : widget ? 'Update Widget' : 'Create Widget'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}