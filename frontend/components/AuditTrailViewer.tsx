import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, Download, Shield, Activity, AlertTriangle } from 'lucide-react';
import { useCompliance } from '../hooks/useCompliance';
import { format } from 'date-fns';

export const AuditTrailViewer: React.FC = () => {
  const {
    auditLogs,
    auditTotal,
    securityLogs,
    securityTotal,
    auditStats,
    isLoading,
    auditFilter,
    securityFilter,
    updateAuditFilter,
    updateSecurityFilter,
    loadMoreAuditLogs,
    loadMoreSecurityLogs
  } = useCompliance();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');

  const handleAuditSearch = () => {
    updateAuditFilter({
      user_id: searchTerm.includes('@') ? searchTerm : undefined,
      resource_id: !searchTerm.includes('@') && searchTerm ? searchTerm : undefined,
      service_name: selectedService || undefined,
      action: selectedAction || undefined
    });
  };

  const handleSecuritySearch = () => {
    updateSecurityFilter({
      user_id: searchTerm.includes('@') ? searchTerm : undefined,
      service_name: selectedService || undefined,
      event_type: selectedAction || undefined
    });
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800 border-red-200',
      ERROR: 'bg-orange-100 text-orange-800 border-orange-200',
      WARN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      INFO: 'bg-blue-100 text-blue-800 border-blue-200',
      DEBUG: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[severity as keyof typeof colors] || colors.INFO;
  };

  const getActionBadge = (action: string) => {
    const colors = {
      create: 'bg-green-100 text-green-800 border-green-200',
      update: 'bg-blue-100 text-blue-800 border-blue-200',
      delete: 'bg-red-100 text-red-800 border-red-200',
      read: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[action as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audit Trails & Security Logs</h2>
          <p className="text-muted-foreground">Monitor all system activities and security events</p>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {auditStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Audit Logs</p>
                  <p className="text-2xl font-bold">{auditStats.total_audit_logs.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Security Events</p>
                  <p className="text-2xl font-bold">{auditStats.total_security_logs.toLocaleString()}</p>
                </div>
                <Shield className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failed Logins (24h)</p>
                  <p className="text-2xl font-bold text-red-600">{auditStats.recent_failed_logins}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Compliance Events</p>
                  <p className="text-2xl font-bold text-purple-600">{auditStats.compliance_events_today}</p>
                </div>
                <Filter className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filter Logs</CardTitle>
          <CardDescription>Search and filter audit trails and security events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by user ID, email, or resource ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Services</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
                <SelectItem value="prospect">Prospects</SelectItem>
                <SelectItem value="ai_crm">AI CRM</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="scoring">Scoring</SelectItem>
                <SelectItem value="gdpr">GDPR</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="audit" className="w-full">
        <TabsList>
          <TabsTrigger value="audit">Audit Logs ({auditTotal})</TabsTrigger>
          <TabsTrigger value="security">Security Logs ({securityTotal})</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Data Change Audit Trail</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={handleAuditSearch}
                  className="flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 bg-card">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getActionBadge(log.action)}>
                            {log.action}
                          </Badge>
                          <span className="text-sm font-medium">{log.resource_type}</span>
                          {log.compliance_relevant && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              GDPR
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">User:</span> {log.user_id || 'System'}
                        </div>
                        <div>
                          <span className="font-medium">Service:</span> {log.service_name}
                        </div>
                        <div>
                          <span className="font-medium">Resource ID:</span> {log.resource_id || 'N/A'}
                        </div>
                      </div>

                      {(log.old_values || log.new_values) && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {log.old_values && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Old Values:</span>
                                <pre className="text-xs bg-muted rounded p-2 mt-1 overflow-auto">
                                  {JSON.stringify(log.old_values, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_values && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">New Values:</span>
                                <pre className="text-xs bg-muted rounded p-2 mt-1 overflow-auto">
                                  {JSON.stringify(log.new_values, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {auditLogs.length < auditTotal && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={loadMoreAuditLogs}>
                    Load More ({auditTotal - auditLogs.length} remaining)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Security Event Logs</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={handleSecuritySearch}
                  className="flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {securityLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 bg-card">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getSeverityBadge(log.severity)}>
                            {log.severity}
                          </Badge>
                          <span className="text-sm font-medium">{log.event_type}</span>
                          {log.success === false && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">User:</span> {log.user_id || 'Anonymous'}
                        </div>
                        <div>
                          <span className="font-medium">Service:</span> {log.service_name}
                        </div>
                        <div>
                          <span className="font-medium">IP Address:</span> {log.ip_address || 'N/A'}
                        </div>
                      </div>

                      {log.failure_reason && (
                        <div className="mt-2">
                          <span className="text-sm font-medium text-red-600">Failure Reason:</span>
                          <p className="text-sm text-red-700 mt-1">{log.failure_reason}</p>
                        </div>
                      )}

                      {log.metadata && (
                        <div className="mt-3 pt-3 border-t">
                          <span className="text-xs font-medium text-muted-foreground">Additional Details:</span>
                          <pre className="text-xs bg-muted rounded p-2 mt-1 overflow-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {securityLogs.length < securityTotal && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={loadMoreSecurityLogs}>
                    Load More ({securityTotal - securityLogs.length} remaining)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};