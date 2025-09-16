import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  FileText, 
  Activity,
  Download,
  Clock,
  TrendingUp,
  Users,
  Database,
  Lock
} from 'lucide-react';
import { useCompliance, useComplianceReport } from '../hooks/useCompliance';
import { AuditTrailViewer } from './AuditTrailViewer';
import { GDPRManagement } from './GDPRManagement';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export const ComplianceDashboard: React.FC = () => {
  const { auditStats } = useCompliance();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const { data: complianceReport } = useComplianceReport(selectedPeriod);
  const [currentUserId] = useState('current-user-id'); // This would come from auth context

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const securitySeverityData = auditStats?.security_events_by_severity.map(item => ({
    name: item.severity,
    value: item.count
  })) || [];

  const mockComplianceScore = 94; // This would be calculated based on actual compliance metrics

  const complianceMetrics = [
    {
      title: 'Overall Compliance Score',
      value: `${mockComplianceScore}%`,
      icon: Shield,
      color: mockComplianceScore >= 90 ? 'text-green-600' : mockComplianceScore >= 75 ? 'text-yellow-600' : 'text-red-600',
      bgColor: mockComplianceScore >= 90 ? 'bg-green-50' : mockComplianceScore >= 75 ? 'bg-yellow-50' : 'bg-red-50'
    },
    {
      title: 'GDPR Requests (30d)',
      value: complianceReport?.data_exports + complianceReport?.user_deletions || 0,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Security Incidents',
      value: complianceReport?.security_incidents?.length || 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Data Changes Today',
      value: auditStats?.data_changes_today || 0,
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Compliance Dashboard</h1>
          <p className="text-muted-foreground">Monitor compliance status, audit trails, and GDPR management</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {complianceMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className={metric.bgColor}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                    <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${metric.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Security Events by Severity
            </CardTitle>
            <CardDescription>Distribution of security events by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={securitySeverityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {securitySeverityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Active Users
            </CardTitle>
            <CardDescription>Users with the most audit trail activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditStats?.top_users_by_activity.slice(0, 5).map((user, index) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                    </div>
                    <span className="font-medium">{user.user_id}</span>
                  </div>
                  <Badge variant="outline">{user.activity_count} actions</Badge>
                </div>
              )) || (
                <p className="text-muted-foreground text-center py-4">No activity data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {complianceReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Access Trends
            </CardTitle>
            <CardDescription>Daily data access events over the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={complianceReport.data_access_events}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value) => [value, 'Access Events']}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="audit" className="w-full">
        <TabsList>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Audit Trails
          </TabsTrigger>
          <TabsTrigger value="gdpr" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            GDPR Management
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Policies & Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          <AuditTrailViewer />
        </TabsContent>

        <TabsContent value="gdpr" className="space-y-4">
          <GDPRManagement userId={currentUserId} />
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Retention Policies</CardTitle>
                <CardDescription>Current data retention settings across services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">User Data</h4>
                      <p className="text-sm text-muted-foreground">Personal information and preferences</p>
                    </div>
                    <Badge variant="outline">365 days</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Audit Logs</h4>
                      <p className="text-sm text-muted-foreground">System activity and compliance logs</p>
                    </div>
                    <Badge variant="outline">7 years</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Prospect Data</h4>
                      <p className="text-sm text-muted-foreground">CRM and lead information</p>
                    </div>
                    <Badge variant="outline">3 years</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>Current compliance with various regulations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="font-medium">GDPR</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="font-medium">CCPA</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">SOC 2</span>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">In Progress</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};