import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DashboardWidget } from '~backend/reporting/types';
import { useReporting } from '../hooks/useReporting';

interface WidgetRendererProps {
  widget: DashboardWidget;
  expanded?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function WidgetRenderer({ widget, expanded = false }: WidgetRendererProps) {
  const { getWidgetData } = useReporting();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const widgetData = await getWidgetData(widget.id);
        setData(widgetData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load widget data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [widget.id, getWidgetData]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="space-y-2 w-full">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div>
          <p className="text-red-500 mb-2">Error loading widget</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const chartHeight = expanded ? 400 : 200;

  switch (widget.widget_type) {
    case 'metric':
      return <MetricWidget data={data} config={widget.config} expanded={expanded} />;
    case 'table':
      return <TableWidget data={data} config={widget.config} expanded={expanded} />;
    case 'chart':
      return <ChartWidget data={data} config={widget.config} height={chartHeight} />;
    case 'timeline':
      return <TimelineWidget data={data} config={widget.config} height={chartHeight} />;
    default:
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground">Unsupported widget type: {widget.widget_type}</p>
        </div>
      );
  }
}

function MetricWidget({ data, config, expanded }: { data: any; config: any; expanded: boolean }) {
  if (!data || data.length === 0) return <div>No data</div>;

  const metric = data[0];
  const value = metric.value || metric.total || metric.count || 0;
  const label = metric.label || config.metrics?.[0] || 'Metric';
  const previousValue = metric.previous_value || 0;
  const change = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0;

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toLocaleString();
  };

  const getTrendIcon = () => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="h-full flex flex-col justify-center space-y-2">
      <div className="text-center">
        <div className="text-3xl font-bold text-primary">
          {formatValue(value)}
        </div>
        <div className="text-sm text-muted-foreground">
          {label}
        </div>
        {previousValue > 0 && (
          <div className="flex items-center justify-center space-x-2 mt-2">
            {getTrendIcon()}
            <span className={`text-sm ${
              change > 0 ? 'text-green-500' : 
              change < 0 ? 'text-red-500' : 
              'text-muted-foreground'
            }`}>
              {Math.abs(change).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      {expanded && metric.description && (
        <div className="text-center text-sm text-muted-foreground mt-4">
          {metric.description}
        </div>
      )}
    </div>
  );
}

function TableWidget({ data, config, expanded }: { data: any; config: any; expanded: boolean }) {
  if (!data || data.length === 0) return <div>No data</div>;

  const displayData = expanded ? data : data.slice(0, 5);
  const columns = Object.keys(data[0]);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {columns.map((column) => (
              <th key={column} className="text-left p-2 font-medium">
                {column.replace(/_/g, ' ').toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row: any, index: number) => (
            <tr key={index} className="border-b">
              {columns.map((column) => (
                <td key={column} className="p-2">
                  {typeof row[column] === 'number' 
                    ? row[column].toLocaleString()
                    : String(row[column] || '')
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!expanded && data.length > 5 && (
        <div className="text-center text-sm text-muted-foreground mt-2">
          +{data.length - 5} more rows
        </div>
      )}
    </div>
  );
}

function ChartWidget({ data, config, height }: { data: any; config: any; height: number }) {
  if (!data || data.length === 0) return <div>No data</div>;

  const chartType = config.chart_type || 'bar';

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
          </LineChart>
        );
        
      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
          </AreaChart>
        );
        
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );
        
      default:
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        );
    }
  };

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

function TimelineWidget({ data, config, height }: { data: any; config: any; height: number }) {
  if (!data || data.length === 0) return <div>No data</div>;

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Legend />
          {config.metrics?.map((metric: string, index: number) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}