import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  Trash2, 
  Shield, 
  AlertTriangle, 
  FileText, 
  Clock,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { useCompliance, useGDPRData } from '../hooks/useCompliance';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

interface GDPRManagementProps {
  userId: string;
}

export const GDPRManagement: React.FC<GDPRManagementProps> = ({ userId }) => {
  const { toast } = useToast();
  const { dataSummary, isLoading } = useGDPRData(userId);
  const { requestGDPRAction, isRequestingGDPR } = useCompliance();
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'xml'>('json');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleDataExport = async () => {
    try {
      await requestGDPRAction({
        user_id: userId,
        request_type: 'export',
        data_categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        export_format: exportFormat
      });
      
      toast({
        title: 'Export Request Submitted',
        description: 'Your data export request has been submitted. You will receive a notification when it\'s ready.',
      });
      
      setShowExportDialog(false);
      setSelectedCategories([]);
    } catch (error) {
      toast({
        title: 'Export Request Failed',
        description: 'Failed to submit export request. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleDataDeletion = async () => {
    try {
      await requestGDPRAction({
        user_id: userId,
        request_type: 'delete'
      });
      
      toast({
        title: 'Deletion Request Submitted',
        description: 'Your data deletion request has been submitted and is being processed.',
      });
      
      setShowDeleteConfirm(false);
    } catch (error) {
      toast({
        title: 'Deletion Request Failed',
        description: 'Failed to submit deletion request. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200'
    };
    return variants[status as keyof typeof variants] || variants.pending;
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
          <h2 className="text-2xl font-bold text-foreground">GDPR Data Management</h2>
          <p className="text-muted-foreground">Manage your personal data and privacy rights</p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Shield className="h-3 w-3 mr-1" />
          GDPR Compliant
        </Badge>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Under GDPR, you have the right to access, export, and delete your personal data. 
          These actions are irreversible and may affect your ability to use certain features.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Data Overview</TabsTrigger>
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="delete">Delete Data</TabsTrigger>
          <TabsTrigger value="requests">Request History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Your Data Categories
                </CardTitle>
                <CardDescription>Overview of personal data we store about you</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dataSummary?.data_categories.map((category) => (
                    <div key={category.category} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium capitalize">{category.category.replace('_', ' ')} Data</h4>
                        <p className="text-sm text-muted-foreground">
                          Services: {category.services.join(', ')}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {category.record_count} records
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Data Retention
                </CardTitle>
                <CardDescription>How long we keep your data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dataSummary?.retention_policies.map((policy, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <h4 className="font-medium">{policy.service}</h4>
                      <p className="text-sm text-muted-foreground">{policy.policy}</p>
                      {policy.expires_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires: {format(new Date(policy.expires_at), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Your Data
              </CardTitle>
              <CardDescription>
                Download a copy of all your personal data in a machine-readable format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Select Data Categories (optional)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {dataSummary?.data_categories.map((category) => (
                      <div key={category.category} className="flex items-center space-x-2">
                        <Checkbox
                          id={category.category}
                          checked={selectedCategories.includes(category.category)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCategories([...selectedCategories, category.category]);
                            } else {
                              setSelectedCategories(selectedCategories.filter(c => c !== category.category));
                            }
                          }}
                        />
                        <label htmlFor={category.category} className="text-sm font-medium capitalize">
                          {category.category.replace('_', ' ')} Data
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedCategories.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      If no categories are selected, all available data will be exported
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Export Format</h4>
                  <Select value={exportFormat} onValueChange={(value: 'json' | 'csv' | 'xml') => setExportFormat(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON (Recommended)</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xml">XML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Request Data Export
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Data Export</DialogTitle>
                      <DialogDescription>
                        This will create a secure download link for your personal data. 
                        The link will expire after 30 days for security reasons.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <p><strong>Categories:</strong> {selectedCategories.length > 0 ? selectedCategories.join(', ') : 'All available data'}</p>
                      <p><strong>Format:</strong> {exportFormat.toUpperCase()}</p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleDataExport} disabled={isRequestingGDPR}>
                        {isRequestingGDPR ? 'Processing...' : 'Confirm Export'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delete" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete Your Data
              </CardTitle>
              <CardDescription>
                Permanently delete all your personal data from our systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This action is irreversible. Once deleted, your data cannot be recovered.
                  Your account will be permanently closed and you will lose access to all services.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">What will be deleted:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• All personal information and contact details</li>
                    <li>• All prospect and CRM data associated with your account</li>
                    <li>• Email templates and campaign data</li>
                    <li>• Analytics and scoring data</li>
                    <li>• Account preferences and settings</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">What will be retained:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Anonymized audit logs for compliance purposes</li>
                    <li>• Aggregated analytics data (non-identifiable)</li>
                    <li>• Legal and financial records as required by law</li>
                  </ul>
                </div>

                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Request Data Deletion
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-red-600">Confirm Data Deletion</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. All your personal data will be permanently deleted 
                        and your account will be closed.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="font-medium text-red-600">
                        Are you absolutely sure you want to delete all your data?
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleDataDeletion} disabled={isRequestingGDPR}>
                        {isRequestingGDPR ? 'Processing...' : 'Yes, Delete Everything'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Request History
              </CardTitle>
              <CardDescription>Track the status of your GDPR requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dataSummary?.active_gdpr_requests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No GDPR requests found
                  </p>
                ) : (
                  dataSummary?.active_gdpr_requests.map((request) => (
                    <div key={request.request_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          <span className="font-medium capitalize">{request.type} Request</span>
                          <Badge className={getStatusBadge(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(request.created_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Request ID: {request.request_id}
                      </p>
                      {request.status === 'processing' && (
                        <div className="mt-2">
                          <Progress value={65} className="w-full" />
                          <p className="text-xs text-muted-foreground mt-1">
                            Processing... This may take up to 30 days to complete.
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};