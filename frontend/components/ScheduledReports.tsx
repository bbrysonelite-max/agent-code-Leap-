import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar,
  Clock,
  Mail,
  MoreVertical,
  Play,
  Pause,
  Edit,
  Trash2,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useReporting } from '../hooks/useReporting';

export function ScheduledReports() {
  const {
    scheduledReports,
    reportExecutions,
    loading,
    loadScheduledReports,
    loadReportExecutions,
    toggleReportSchedule,
    generateReport
  } = useReporting();

  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showExecutions, setShowExecutions] = useState(false);
  const [executionsLoading, setExecutionsLoading] = useState(false);

  useEffect(() => {
    loadScheduledReports();
  }, [loadScheduledReports]);

  const handleToggleSchedule = async (reportId: string, enabled: boolean) => {
    try {
      await toggleReportSchedule(reportId, enabled);
      loadScheduledReports(); // Refresh the list
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handleViewExecutions = async (report: any) => {
    setSelectedReport(report);
    setShowExecutions(true);
    setExecutionsLoading(true);
    
    try {
      await loadReportExecutions(report.id);
    } catch (error) {
      console.error('Failed to load executions:', error);
    } finally {
      setExecutionsLoading(false);
    }
  };

  const handleRunNow = async (reportId: string) => {
    try {
      await generateReport(reportId);
      alert('Report generation started successfully!');
    } catch (error) {
      console.error('Failed to run report:', error);
      alert('Failed to start report generation');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      running: 'secondary',
      pending: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const formatSchedule = (config: any) => {
    if (!config) return 'Not scheduled';
    
    const { frequency, time } = config;
    return `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} at ${time}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Scheduled Reports</h2>
          <p className="text-muted-foreground">
            Manage automated report generation and delivery
          </p>
        </div>
      </div>

      {scheduledReports.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Active Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{report.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {report.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">
                          {formatSchedule(report.schedule_config)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4" />
                        <span className="text-sm">
                          {report.schedule_config?.recipients?.length || 0} recipients
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {report.last_generated_at
                          ? new Date(report.last_generated_at).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={report.schedule_config?.enabled || false}
                          onCheckedChange={(checked) => 
                            handleToggleSchedule(report.id, checked)
                          }
                        />
                        <span className="text-sm">
                          {report.schedule_config?.enabled ? 'Active' : 'Paused'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRunNow(report.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Run Now
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewExecutions(report)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View History
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Scheduled Reports</h3>
              <p className="text-muted-foreground mb-4">
                Create a report with scheduling enabled to see it here
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution History Dialog */}
      <Dialog open={showExecutions} onOpenChange={setShowExecutions}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Execution History: {selectedReport?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {executionsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : reportExecutions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>File Size</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportExecutions.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell>
                        {new Date(execution.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(execution.status)}
                          {getStatusBadge(execution.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {execution.format.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {execution.file_size ? formatFileSize(execution.file_size) : '-'}
                      </TableCell>
                      <TableCell>
                        {execution.execution_time_ms 
                          ? `${(execution.execution_time_ms / 1000).toFixed(1)}s`
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {execution.status === 'completed' && (
                          <Button size="sm" variant="outline">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        )}
                        {execution.status === 'failed' && execution.error_message && (
                          <div className="text-xs text-red-600 max-w-xs truncate">
                            {execution.error_message}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No execution history found
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowExecutions(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}