import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Calendar,
  Table,
  MoreVertical,
  Edit,
  Trash2,
  Plus,
  Maximize2
} from 'lucide-react';
import { Dashboard, DashboardWidget } from '~backend/reporting/types';
import { WidgetRenderer } from './WidgetRenderer';
import { WidgetEditor } from './WidgetEditor';

interface DashboardGridProps {
  dashboard: Dashboard;
  widgets: DashboardWidget[];
  onUpdateDashboard: (id: string, updates: any) => Promise<void>;
}

const WIDGET_ICONS = {
  chart: BarChart3,
  table: Table,
  metric: TrendingUp,
  timeline: Calendar,
  pie: PieChart
};

export function DashboardGrid({ dashboard, widgets, onUpdateDashboard }: DashboardGridProps) {
  const [selectedWidget, setSelectedWidget] = useState<DashboardWidget | null>(null);
  const [showWidgetEditor, setShowWidgetEditor] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);

  const handleAddWidget = () => {
    setEditingWidget(null);
    setShowWidgetEditor(true);
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setEditingWidget(widget);
    setShowWidgetEditor(true);
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (confirm('Are you sure you want to delete this widget?')) {
      // This would call the delete widget API
      console.log('Delete widget:', widgetId);
    }
  };

  const handleExpandWidget = (widgetId: string) => {
    setExpandedWidget(expandedWidget === widgetId ? null : widgetId);
  };

  const getGridClass = (widget: DashboardWidget) => {
    const { width = 4, height = 3 } = widget;
    return `col-span-${Math.min(width, 12)} row-span-${Math.min(height, 6)}`;
  };

  const sortedWidgets = [...widgets].sort((a, b) => {
    if (a.position_y !== b.position_y) {
      return a.position_y - b.position_y;
    }
    return a.position_x - b.position_x;
  });

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{dashboard.name}</h2>
          {dashboard.description && (
            <p className="text-muted-foreground">{dashboard.description}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {dashboard.is_default && (
            <Badge variant="secondary">Default</Badge>
          )}
          {dashboard.is_public && (
            <Badge variant="outline">Public</Badge>
          )}
          <Button onClick={handleAddWidget} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Widget
          </Button>
        </div>
      </div>

      {/* Widgets Grid */}
      {widgets.length > 0 ? (
        <div className="grid grid-cols-12 gap-4 auto-rows-fr">
          {sortedWidgets.map((widget) => {
            const IconComponent = WIDGET_ICONS[widget.widget_type as keyof typeof WIDGET_ICONS] || BarChart3;
            const isExpanded = expandedWidget === widget.id;
            
            return (
              <Card 
                key={widget.id} 
                className={`${getGridClass(widget)} ${isExpanded ? 'col-span-12 row-span-6 z-10' : ''} transition-all duration-200`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">
                      {widget.title}
                    </CardTitle>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExpandWidget(widget.id)}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditWidget(widget)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteWidget(widget.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="h-full">
                  <WidgetRenderer 
                    widget={widget} 
                    expanded={isExpanded}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Widgets Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first widget to start building your dashboard
              </p>
              <Button onClick={handleAddWidget}>
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widget Editor Dialog */}
      {showWidgetEditor && (
        <WidgetEditor
          dashboardId={dashboard.id}
          widget={editingWidget}
          onClose={() => {
            setShowWidgetEditor(false);
            setEditingWidget(null);
          }}
          onSave={() => {
            setShowWidgetEditor(false);
            setEditingWidget(null);
            // Refresh widgets
          }}
        />
      )}
    </div>
  );
}