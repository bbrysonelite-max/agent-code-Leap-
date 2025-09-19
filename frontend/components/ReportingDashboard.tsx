import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download, 
  Settings, 
  Plus,
  Calendar,
  Filter
} from 'lucide-react';
import { useReporting } from '../hooks/useReporting';
import DashboardGrid from './DashboardGrid';
import ReportBuilder from './ReportBuilder';
import ScheduledReports from './ScheduledReports';
import ExportDialog from './ExportDialog';

interface ReportingDashboardProps {
  initialDashboardId?: string;
}

export default function ReportingDashboard({ initialDashboardId }: ReportingDashboardProps) {
  const {
    dashboards,
    currentDashboard,
    reports,
    widgets,
    loading,
    loadDashboards,
    selectDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    loadWidgets
  } = useReporting();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  useEffect(() => {
    if (initialDashboardId) {
      selectDashboard(initialDashboardId);
    } else if (dashboards.length > 0 && !currentDashboard) {
      // Select default dashboard or first one
      const defaultDashboard = dashboards.find(d => d.is_default) || dashboards[0];
      selectDashboard(defaultDashboard.id);
    }
  }, [dashboards, initialDashboardId, currentDashboard, selectDashboard]);

  useEffect(() => {
    if (currentDashboard) {
      loadWidgets(currentDashboard.id);
    }
  }, [currentDashboard, loadWidgets]);

  const handleCreateDashboard = async () => {
    const name = prompt('Dashboard name:');
    if (name) {
      await createDashboard({
        name,
        description: `Custom dashboard: ${name}`,
        layout: []
      });
    }
  };

  const handleExportReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setShowExportDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Reporting</h1>
          <p className="text-muted-foreground">
            Comprehensive insights and customizable dashboards
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select
            value={currentDashboard?.id || ''}
            onValueChange={selectDashboard}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select dashboard" />
            </SelectTrigger>
            <SelectContent>
              {dashboards.map((dashboard) => (
                <SelectItem key={dashboard.id} value={dashboard.id}>
                  <div className="flex items-center space-x-2">
                    <span>{dashboard.name}</span>
                    {dashboard.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreateDashboard} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            New Dashboard
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Scheduled</span>
          </TabsTrigger>
          <TabsTrigger value="builder" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Builder</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {currentDashboard ? (
            <DashboardGrid 
              dashboard={currentDashboard}
              widgets={widgets}
              onUpdateDashboard={updateDashboard}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Dashboard Selected</h3>
                  <p className="text-muted-foreground mb-4">
                    Select a dashboard or create a new one to get started
                  </p>
                  <Button onClick={handleCreateDashboard}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Generated Reports</h2>
            <Button onClick={() => setShowReportBuilder(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Button>
          </div>

          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-lg">{report.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {report.description}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={report.is_scheduled ? 'default' : 'secondary'}>
                      {report.type}
                    </Badge>
                    {report.is_scheduled && (
                      <Badge variant="outline">Scheduled</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Last generated: {report.last_generated_at 
                        ? new Date(report.last_generated_at).toLocaleDateString()
                        : 'Never'
                      }
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportReport(report.id)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {reports.length === 0 && (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first report to start analyzing your data
                  </p>
                  <Button onClick={() => setShowReportBuilder(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-6 mt-6">
          <ScheduledReports />
        </TabsContent>

        <TabsContent value="builder" className="space-y-6 mt-6">
          <ReportBuilder 
            onClose={() => setShowReportBuilder(false)}
          />
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      {showExportDialog && selectedReportId && (
        <ExportDialog
          reportId={selectedReportId}
          open={showExportDialog}
          onClose={() => {
            setShowExportDialog(false);
            setSelectedReportId(null);
          }}
        />
      )}
    </div>
  );
}