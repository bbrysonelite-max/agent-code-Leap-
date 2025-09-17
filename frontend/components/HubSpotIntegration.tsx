import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings, Activity, Play, Pause, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import backend from '~backend/client';

export default function HubSpotIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);

  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['hubspot-connections'],
    queryFn: async () => {
      const response = await backend.hubspot.listConnections();
      return response;
    }
  });

  const { data: automationRules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const response = await backend.hubspot.listAutomationRules();
      return response;
    }
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      return backend.hubspot.createConnection(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-connections'] });
      setIsConnectionDialogOpen(false);
      toast({ title: 'Success', description: 'HubSpot connection created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return backend.hubspot.testConnection({ id: connectionId });
    },
    onSuccess: (data) => {
      toast({ 
        title: data.success ? 'Success' : 'Error', 
        description: data.message,
        variant: data.success ? 'default' : 'destructive'
      });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async ({ connectionId, type }: { connectionId: string; type: 'contacts' | 'deals' }) => {
      if (type === 'contacts') {
        return backend.hubspot.syncContacts({ connectionId });
      } else {
        return backend.hubspot.syncDeals({ connectionId });
      }
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Sync Complete', 
        description: `Synced: ${data.synced}, Errors: ${data.errors}` 
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">HubSpot AI Integration</h1>
          <p className="text-muted-foreground">100% AI-driven CRM automation with HubSpot</p>
        </div>
        <Dialog open={isConnectionDialogOpen} onOpenChange={setIsConnectionDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect to HubSpot</DialogTitle>
              <DialogDescription>
                Add your HubSpot connection details to enable AI automation
              </DialogDescription>
            </DialogHeader>
            <ConnectionForm onSubmit={createConnectionMutation.mutate} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="automation">AI Automation</TabsTrigger>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          <div className="grid gap-4">
            {connectionsLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">Loading connections...</div>
                </CardContent>
              </Card>
            ) : connections.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">No HubSpot connections configured</p>
                    <Button onClick={() => setIsConnectionDialogOpen(true)}>
                      Add Your First Connection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              connections.map((connection: any) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  onTest={() => testConnectionMutation.mutate(connection.id)}
                  onSync={(type) => syncMutation.mutate({ connectionId: connection.id, type })}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <AutomationRules rules={automationRules} loading={rulesLoading} />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <SyncStatus connections={connections} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AIAnalytics connections={connections} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectionForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    access_token: '',
    portal_id: '',
    app_id: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Connection Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="access_token">Access Token</Label>
        <Input
          id="access_token"
          type="password"
          value={formData.access_token}
          onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="portal_id">Portal ID</Label>
        <Input
          id="portal_id"
          value={formData.portal_id}
          onChange={(e) => setFormData({ ...formData, portal_id: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="app_id">App ID</Label>
        <Input
          id="app_id"
          value={formData.app_id}
          onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
          required
        />
      </div>
      <Button type="submit" className="w-full">Create Connection</Button>
    </form>
  );
}

function ConnectionCard({ connection, onTest, onSync }: { 
  connection: any; 
  onTest: () => void; 
  onSync: (type: 'contacts' | 'deals') => void; 
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{connection.name}</CardTitle>
            <CardDescription>Portal ID: {connection.portal_id}</CardDescription>
          </div>
          <Badge variant={connection.is_active ? 'default' : 'secondary'}>
            {connection.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onTest}>
            Test Connection
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSync('contacts')}>
            Sync Contacts
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSync('deals')}>
            Sync Deals
          </Button>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>Created: {new Date(connection.created_at).toLocaleDateString()}</p>
          <p>Last Updated: {new Date(connection.updated_at).toLocaleDateString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationRules({ rules, loading }: { rules: any[]; loading: boolean }) {
  if (loading) {
    return <div>Loading automation rules...</div>;
  }

  return (
    <div className="grid gap-4">
      {rules.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No automation rules configured</p>
              <p className="text-sm text-muted-foreground">
                Automation rules define how AI makes decisions in your CRM
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        rules.map((rule: any) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{rule.name}</CardTitle>
                  <CardDescription>Trigger: {rule.trigger}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {rule.is_active ? (
                    <Play className="h-4 w-4 text-green-500" />
                  ) : (
                    <Pause className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <h4 className="font-medium">AI Prompt:</h4>
                  <p className="text-sm text-muted-foreground">{rule.ai_prompt}</p>
                </div>
                <div>
                  <h4 className="font-medium">Conditions:</h4>
                  <pre className="text-xs bg-muted p-2 rounded">{JSON.stringify(rule.conditions, null, 2)}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function SyncStatus({ connections }: { connections: any[] }) {
  const [selectedConnection, setSelectedConnection] = useState<string | null>(
    connections.length > 0 ? connections[0].id : null
  );

  const { data: syncStats } = useQuery({
    queryKey: ['sync-stats', selectedConnection],
    queryFn: async () => {
      if (!selectedConnection) return null;
      return backend.hubspot.getSyncStats({ connectionId: selectedConnection });
    },
    enabled: !!selectedConnection
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ['sync-logs', selectedConnection],
    queryFn: async () => {
      if (!selectedConnection) return [];
      return backend.hubspot.getSyncLogs({ connectionId: selectedConnection });
    },
    enabled: !!selectedConnection
  });

  if (connections.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No connections available for sync monitoring
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Connection</Label>
        <select
          className="w-full p-2 border rounded"
          value={selectedConnection || ''}
          onChange={(e) => setSelectedConnection(e.target.value)}
        >
          {connections.map((conn: any) => (
            <option key={conn.id} value={conn.id}>{conn.name}</option>
          ))}
        </select>
      </div>

      {syncStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{(syncStats as any).total_operations}</div>
              <div className="text-sm text-muted-foreground">Total Operations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{(syncStats as any).successful_operations}</div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{(syncStats as any).failed_operations}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{(syncStats as any).contact_syncs}</div>
              <div className="text-sm text-muted-foreground">Contact Syncs</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {syncLogs.length === 0 ? (
              <p className="text-muted-foreground">No sync operations yet</p>
            ) : (
              syncLogs.slice(0, 10).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {log.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : log.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium">{log.operation}</span>
                    {log.hubspot_id && <span className="text-sm text-muted-foreground">ID: {log.hubspot_id}</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AIAnalytics({ connections }: { connections: any[] }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Decision Analytics</CardTitle>
          <CardDescription>Monitor AI automation performance and decisions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">156</div>
              <div className="text-sm text-muted-foreground">AI Decisions Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">94%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0.89</div>
              <div className="text-sm text-muted-foreground">Avg Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">23</div>
              <div className="text-sm text-muted-foreground">Deals Created</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent AI Decisions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: 'create_contact', confidence: 0.95, reasoning: 'High-quality lead from email capture' },
              { action: 'create_deal', confidence: 0.87, reasoning: 'Enterprise contact with high engagement' },
              { action: 'send_email', confidence: 0.92, reasoning: 'Re-engagement needed for cold lead' },
              { action: 'move_deal_stage', confidence: 0.78, reasoning: 'Email opened multiple times' },
            ].map((decision, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{decision.action.replace('_', ' ').toUpperCase()}</div>
                  <div className="text-sm text-muted-foreground">{decision.reasoning}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{Math.round(decision.confidence * 100)}%</div>
                  <div className="text-sm text-muted-foreground">Confidence</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}