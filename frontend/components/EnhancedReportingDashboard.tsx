import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  FileText, 
  Calendar, 
  Download, 
  Plus, 
  Settings, 
  TrendingUp, 
  Users, 
  Mail, 
  Target, 
  Search, 
  Filter, 
  Layers,
  Activity,
  Clock,
  Eye,
  Bookmark
} from 'lucide-react';
import { useReporting } from '../hooks/useReporting';
import ReportBuilder from './ReportBuilder';
import AdvancedReportBuilder from './AdvancedReportBuilder';
import DrillDownAnalyzer from './DrillDownAnalyzer';
import ScheduledReports from './ScheduledReports';
import DashboardGrid from './DashboardGrid';
import ExportDialog from './ExportDialog';

export default function EnhancedReportingDashboard() {
  const { reports, dashboards, isLoading, createReport, createDashboard } = useReporting();
  const [activeTab, setActiveTab] = useState('overview');
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [showAdvancedBuilder, setShowAdvancedBuilder] = useState(false);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [quickStats, setQuickStats] = useState<any>({});
  const [favoriteReports, setFavoriteReports] = useState<any[]>([]);

  useEffect(() => {
    loadQuickStats();
    loadRecentActivity();
    loadFavoriteReports();
  }, []);

  const loadQuickStats = async () => {
    // Mock implementation - replace with actual API calls
    setQuickStats({
      total_reports: reports.length,
      active_dashboards: dashboards.length,
      scheduled_reports: 5,
      data_sources: 4,
      drill_downs_performed: 23,
      exports_this_month: 12,
      views_this_week: 156,
      active_users: 8
    });
  };

  const loadRecentActivity = async () => {
    // Mock implementation - replace with actual API calls
    setRecentActivity([
      { 
        id: 1, 
        type: 'report_generated', 
        description: 'Prospect Analysis Report generated', 
        timestamp: new Date(Date.now() - 1000 * 60 * 30), 
        user: 'You',
        status: 'completed'
      },
      { 
        id: 2, 
        type: 'drill_down', 
        description: 'Email engagement drill-down performed', 
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), 
        user: 'John Doe',
        status: 'completed'
      },
      { 
        id: 3, 
        type: 'export', 
        description: 'Deal pipeline exported to PDF', 
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), 
        user: 'Jane Smith',
        status: 'completed'
      },
      { 
        id: 4, 
        type: 'dashboard_created', 
        description: 'Sales Performance Dashboard created', 
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), 
        user: 'Mike Johnson',
        status: 'completed'
      },
      { 
        id: 5, 
        type: 'scheduled_report', 
        description: 'Weekly Campaign Report scheduled', 
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), 
        user: 'Sarah Wilson',
        status: 'active'
      }
    ]);
  };

  const loadFavoriteReports = async () => {
    // Mock implementation
    setFavoriteReports([
      { id: 1, name: 'Weekly Prospect Summary', type: 'prospect_analysis', last_run: new Date(), views: 23 },
      { id: 2, name: 'Email Campaign Performance', type: 'email_performance', last_run: new Date(), views: 18 },
      { id: 3, name: 'Agent Productivity Report', type: 'agent_performance', last_run: new Date(), views: 15 }
    ]);
  };

  const quickActions = [
    {
      title: 'Advanced Report Builder',
      description: 'Create sophisticated reports with drill-down',
      icon: BarChart,
      action: () => setShowAdvancedBuilder(true),
      color: 'blue',
      badge: 'New'
    },
    {
      title: 'Drill-Down Analysis',
      description: 'Explore data with interactive drill-downs',
      icon: Search,
      action: () => setShowDrillDown(true),
      color: 'purple',
      badge: 'Popular'
    },
    {
      title: 'Bulk Export',
      description: 'Export multiple reports at once',
      icon: Download,
      action: () => setShowExportDialog(true),
      color: 'green'
    },
    {
      title: 'Simple Report',
      description: 'Quick report creation',
      icon: FileText,
      action: () => setShowReportBuilder(true),
      color: 'gray'
    },
    {
      title: 'New Dashboard',
      description: 'Create a new dashboard',
      icon: Layers,
      action: () => createDashboard({ name: 'New Dashboard', description: 'Custom dashboard' }),
      color: 'orange'
    },
    {
      title: 'Schedule Report',
      description: 'Set up automated reporting',
      icon: Calendar,
      action: () => setActiveTab('scheduled'),
      color: 'red'
    }
  ];

  const statsCards = [
    {
      title: 'Total Reports',
      value: quickStats.total_reports || 0,
      icon: FileText,
      color: 'blue',
      change: '+12%',
      trend: 'up'
    },
    {
      title: 'Active Dashboards',
      value: quickStats.active_dashboards || 0,
      icon: BarChart,
      color: 'green',
      change: '+8%',
      trend: 'up'
    },
    {
      title: 'Drill-Down Analyses',
      value: quickStats.drill_downs_performed || 0,
      icon: Search,
      color: 'purple',
      change: '+45%',
      trend: 'up',
      badge: 'Hot'
    },
    {
      title: 'Monthly Exports',
      value: quickStats.exports_this_month || 0,
      icon: Download,
      color: 'orange',
      change: '+23%',
      trend: 'up'
    },
    {
      title: 'Weekly Views',
      value: quickStats.views_this_week || 0,
      icon: Eye,
      color: 'cyan',
      change: '+34%',
      trend: 'up'
    },
    {
      title: 'Active Users',
      value: quickStats.active_users || 0,
      icon: Users,
      color: 'pink',
      change: '+5%',
      trend: 'up'
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'report_generated': return FileText;
      case 'drill_down': return Search;
      case 'export': return Download;
      case 'dashboard_created': return Layers;
      case 'scheduled_report': return Calendar;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'report_generated': return 'blue';
      case 'drill_down': return 'purple';
      case 'export': return 'green';
      case 'dashboard_created': return 'orange';
      case 'scheduled_report': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Advanced Reporting</h1>
              <p className="text-gray-600 mt-1">Comprehensive analytics and reporting platform</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowAdvancedBuilder(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Report
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDrillDown(true)}
              >
                <Search className="w-4 h-4 mr-2" />
                Analyze
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {statsCards.map((card) => {
                const IconComponent = card.icon;
                return (
                  <Card key={card.title} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="text-xs font-medium text-gray-600">{card.title}</p>
                            {card.badge && (
                              <Badge variant="secondary" className="text-xs px-1">
                                {card.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
                          <div className="flex items-center space-x-1 mt-1">
                            <p className={`text-xs ${ 
                              card.trend === 'up' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {card.change}
                            </p>
                          </div>
                        </div>
                        <div className={`p-2 rounded-lg bg-${card.color}-100`}>
                          <IconComponent className={`h-4 w-4 text-${card.color}-600`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {quickActions.map((action) => {
                        const IconComponent = action.icon;
                        return (
                          <Button
                            key={action.title}
                            variant="outline"
                            className="h-auto p-4 flex flex-col items-center space-y-2 hover:shadow-md relative"
                            onClick={action.action}
                          >
                            {action.badge && (
                              <Badge 
                                variant="default" 
                                className="absolute -top-2 -right-2 text-xs"
                              >
                                {action.badge}
                              </Badge>
                            )}
                            <div className={`p-2 rounded-lg bg-${action.color}-100`}>
                              <IconComponent className={`h-5 w-5 text-${action.color}-600`} />
                            </div>
                            <div className="text-center">
                              <div className="font-medium text-sm">{action.title}</div>
                              <div className="text-xs text-gray-500 mt-1">{action.description}</div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>Recent Activity</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivity.slice(0, 6).map((activity) => {
                        const IconComponent = getActivityIcon(activity.type);
                        const color = getActivityColor(activity.type);
                        return (
                          <div key={activity.id} className="flex items-start space-x-3">
                            <div className={`w-8 h-8 rounded-full bg-${color}-100 flex items-center justify-center flex-shrink-0`}>
                              <IconComponent className={`w-4 h-4 text-${color}-600`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {activity.description}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-gray-500">
                                  {activity.user}
                                </p>
                                <span className="text-xs text-gray-400">•</span>
                                <p className="text-xs text-gray-500">
                                  {activity.timestamp.toLocaleTimeString()}
                                </p>
                                <Badge 
                                  variant={activity.status === 'completed' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {activity.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button variant="ghost" className="w-full mt-4 text-sm">
                      View all activity
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Favorite Reports */}
            {favoriteReports.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Bookmark className="w-5 h-5" />
                    <span>Favorite Reports</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favoriteReports.map((report) => (
                      <Card key={report.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{report.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {report.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </p>
                              <div className="flex items-center space-x-4 mt-2">
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    {report.last_run.toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Eye className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    {report.views} views
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <FileText className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>All Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{report.name}</h3>
                        <p className="text-sm text-gray-600">{report.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">View</Button>
                        <Button variant="outline" size="sm">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboards">
            <DashboardGrid dashboards={dashboards} />
          </TabsContent>

          <TabsContent value="analytics">
            <DrillDownAnalyzer />
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledReports />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Reporting Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">General Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Default Export Format</p>
                          <p className="text-sm text-gray-600">Choose the default format for report exports</p>
                        </div>
                        <Select defaultValue="pdf">
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                            <SelectItem value="csv">CSV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Cache Duration</p>
                          <p className="text-sm text-gray-600">How long to cache report data</p>
                        </div>
                        <Select defaultValue="300">
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="60">1 minute</SelectItem>
                            <SelectItem value="300">5 minutes</SelectItem>
                            <SelectItem value="900">15 minutes</SelectItem>
                            <SelectItem value="3600">1 hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      {showReportBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Simple Report</h2>
              <Button
                variant="ghost"
                onClick={() => setShowReportBuilder(false)}
              >
                ×
              </Button>
            </div>
            <ReportBuilder
              onSave={(report) => {
                createReport(report);
                setShowReportBuilder(false);
              }}
              onCancel={() => setShowReportBuilder(false)}
            />
          </div>
        </div>
      )}

      {showAdvancedBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Advanced Report Builder</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowAdvancedBuilder(false)}
                >
                  ×
                </Button>
              </div>
              <AdvancedReportBuilder
                onSave={(config) => {
                  createReport(config);
                  setShowAdvancedBuilder(false);
                }}
                onGenerate={(config) => {
                  console.log('Generating report with config:', config);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showDrillDown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Drill-Down Analysis</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowDrillDown(false)}
                >
                  ×
                </Button>
              </div>
              <DrillDownAnalyzer
                onSaveDrillDown={(drillDown) => {
                  console.log('Saved drill-down:', drillDown);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showExportDialog && (
        <ExportDialog
          reports={reports}
          onClose={() => setShowExportDialog(false)}
          onExport={(exportConfig) => {
            console.log('Exporting with config:', exportConfig);
            setShowExportDialog(false);
          }}
        />
      )}
    </div>
  );
}