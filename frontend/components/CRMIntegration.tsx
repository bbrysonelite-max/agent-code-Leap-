import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowRight, 
  Users, 
  Mail, 
  Download, 
  Upload,
  Zap,
  CheckCircle,
  AlertCircle,
  BarChart3,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useProspects } from '../hooks/useProspects';
import { useLeads, useContacts } from '../hooks/useAICRM';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function CRMIntegration() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const { data: prospects } = useProspects({ limit: 100 });
  const { data: leads } = useLeads({ limit: 100 });
  const { data: contacts } = useContacts({ limit: 100 });
  const { toast } = useToast();

  const handleBulkImportProspects = async () => {
    if (!prospects || prospects.length === 0) {
      toast({
        title: "No prospects to import",
        description: "Please add some prospects first.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const batchSize = 10;
      let imported = 0;
      let errors = 0;

      for (let i = 0; i < prospects.length; i += batchSize) {
        const batch = prospects.slice(i, i + batchSize);
        
        try {
          const result = await backend.ai_crm.bulkImportProspects({ 
            prospects: batch.map(p => ({
              name: p.name,
              email: p.email,
              company: p.company,
              position: p.position,
              linkedin_profile: p.linkedin_profile,
              notes: p.notes
            }))
          });
          
          imported += result.imported;
          errors += result.errors;
        } catch (error) {
          console.error('Batch import error:', error);
          errors += batch.length;
        }

        setImportProgress(Math.round(((i + batchSize) / prospects.length) * 100));
      }

      toast({
        title: "Import completed",
        description: `Successfully imported ${imported} prospects as leads. ${errors} errors occurred.`
      });

      setShowImportDialog(false);
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: "Import failed",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleConvertLeadToContact = async (leadId: string) => {
    try {
      await backend.ai_crm.convertLeadToContact({ leadId });
      toast({
        title: "Lead converted successfully",
        description: "Lead has been converted to a contact."
      });
    } catch (error) {
      console.error('Conversion failed:', error);
      toast({
        title: "Conversion failed",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };

  const getConversionRate = () => {
    if (!prospects || !leads) return 0;
    const importedLeads = leads.filter(lead => lead.source === 'import').length;
    return prospects.length > 0 ? (importedLeads / prospects.length) * 100 : 0;
  };

  const getQualificationRate = () => {
    if (!leads) return 0;
    const qualifiedLeads = leads.filter(lead => lead.status === 'qualified').length;
    return leads.length > 0 ? (qualifiedLeads / leads.length) * 100 : 0;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">CRM Integration</h1>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          AI-Enhanced
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Prospects</p>
                <p className="text-2xl font-bold">{prospects?.length || 0}</p>
                <p className="text-xs text-muted-foreground">
                  Ready for import
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CRM Leads</p>
                <p className="text-2xl font-bold">{leads?.length || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {leads?.filter(l => l.source === 'import').length || 0} from prospects
                </p>
              </div>
              <Download className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CRM Contacts</p>
                <p className="text-2xl font-bold">{contacts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {contacts?.filter(c => c.lead_id).length || 0} from leads
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList>
          <TabsTrigger value="import">Data Import</TabsTrigger>
          <TabsTrigger value="conversion">Lead Conversion</TabsTrigger>
          <TabsTrigger value="analytics">Integration Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Prospect Import
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Prospect Database</p>
                      <p className="text-sm text-muted-foreground">
                        {prospects?.length || 0} prospects available
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                      <Download className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">AI CRM Leads</p>
                      <p className="text-sm text-muted-foreground">
                        Auto-scored and qualified
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>

                <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full" disabled={!prospects || prospects.length === 0}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Prospects to CRM
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import Prospects</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p>
                        This will import {prospects?.length || 0} prospects from your prospect database 
                        into the AI CRM as leads. Each lead will be automatically scored and qualified.
                      </p>
                      
                      {isImporting && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Importing prospects...</span>
                            <span className="text-sm">{importProgress}%</span>
                          </div>
                          <Progress value={importProgress} />
                        </div>
                      )}
                      
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowImportDialog(false)}
                          disabled={isImporting}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleBulkImportProspects}
                          disabled={isImporting}
                        >
                          {isImporting ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Start Import
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Conversion Rate</span>
                    <span className="font-medium">{getConversionRate().toFixed(1)}%</span>
                  </div>
                  <Progress value={getConversionRate()} />
                  
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {prospects?.length || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Prospects</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {leads?.filter(l => l.source === 'import').length || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Imported Leads</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conversion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead to Contact Conversion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Qualification Rate</span>
                  <span className="font-medium">{getQualificationRate().toFixed(1)}%</span>
                </div>
                <Progress value={getQualificationRate()} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="space-y-3">
                    <h4 className="font-medium">High-Scoring Leads</h4>
                    {leads?.filter(lead => lead.ai_score >= 70).slice(0, 5).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-sm text-muted-foreground">{lead.company}</p>
                          <Badge variant="secondary" className="mt-1">
                            Score: {lead.ai_score}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConvertLeadToContact(lead.id)}
                          disabled={lead.status === 'converted'}
                        >
                          {lead.status === 'converted' ? 'Converted' : 'Convert'}
                        </Button>
                      </div>
                    ))}
                    
                    {(!leads || leads.filter(lead => lead.ai_score >= 70).length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>No high-scoring leads yet</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium">Recent Contacts</h4>
                    {contacts?.filter(contact => contact.lead_id).slice(0, 5).map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">{contact.company}</p>
                          <Badge variant="outline" className="mt-1">
                            {contact.type}
                          </Badge>
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                    ))}
                    
                    {(!contacts || contacts.filter(contact => contact.lead_id).length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>No converted contacts yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Integration Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Data Flow Efficiency</span>
                    <span className="font-medium">
                      {((leads?.filter(l => l.source === 'import').length || 0) / Math.max(prospects?.length || 1, 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>AI Score Coverage</span>
                    <span className="font-medium">
                      {((leads?.filter(l => l.ai_score > 0).length || 0) / Math.max(leads?.length || 1, 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Lead to Contact Rate</span>
                    <span className="font-medium">
                      {((contacts?.filter(c => c.lead_id).length || 0) / Math.max(leads?.length || 1, 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Prospect System</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>AI CRM</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Email Integration</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Synced
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>AI Scoring</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <Zap className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}