import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useRateLimit, RateLimitRule, UserQuotaConfig } from '../hooks/useRateLimit';

export default function RateLimitManagement() {
  const { toast } = useToast();
  const {
    rules,
    quotas,
    rulesLoading,
    quotasLoading,
    createRule,
    updateRule,
    deleteRule,
    createQuota,
    updateQuota,
    deleteQuota,
    bulkUpdateQuotas,
    isCreatingRule,
    isUpdatingRule,
    isDeletingRule,
    isCreatingQuota,
    isUpdatingQuota,
    isDeletingQuota,
    isBulkUpdating,
    refresh
  } = useRateLimit();

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [bulkQuotaDialogOpen, setBulkQuotaDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RateLimitRule | null>(null);
  const [editingQuota, setEditingQuota] = useState<UserQuotaConfig | null>(null);
  
  const [ruleForm, setRuleForm] = useState<Partial<RateLimitRule>>({
    endpoint: '',
    method: 'GET',
    tier: 'basic',
    windowSeconds: 60,
    maxRequests: 100,
    burstLimit: 0,
    enabled: true
  });
  
  const [quotaForm, setQuotaForm] = useState<Partial<UserQuotaConfig>>({
    userId: '',
    tier: 'basic',
    dailyQuota: 1000,
    monthlyQuota: 30000
  });
  
  const [bulkQuotaForm, setBulkQuotaForm] = useState({
    tier: 'basic',
    dailyQuota: '',
    monthlyQuota: ''
  });

  const handleCreateRule = () => {
    if (!ruleForm.endpoint || !ruleForm.method || !ruleForm.tier) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }
    
    createRule(ruleForm as Omit<RateLimitRule, 'id'>);
    setRuleDialogOpen(false);
    setRuleForm({
      endpoint: '',
      method: 'GET',
      tier: 'basic',
      windowSeconds: 60,
      maxRequests: 100,
      burstLimit: 0,
      enabled: true
    });
  };

  const handleEditRule = (rule: RateLimitRule) => {
    setEditingRule(rule);
    setRuleForm(rule);
    setRuleDialogOpen(true);
  };

  const handleDeleteRule = (id: number) => {
    if (window.confirm('Are you sure you want to delete this rate limit rule?')) {
      deleteRule(id);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      case 'premium': return 'bg-blue-100 text-blue-800';
      case 'basic': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-800';
      case 'POST': return 'bg-blue-100 text-blue-800';
      case 'PUT': return 'bg-yellow-100 text-yellow-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rate Limiting Management</h1>
          <p className="text-muted-foreground">
            Configure rate limiting rules and user quotas across all services
          </p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rules">Rate Limit Rules</TabsTrigger>
          <TabsTrigger value="quotas">User Quotas</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rate Limit Rules</CardTitle>
                  <CardDescription>
                    Configure rate limiting rules for different endpoints and user tiers
                  </CardDescription>
                </div>
                <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingRule(null);
                      setRuleForm({
                        endpoint: '',
                        method: 'GET',
                        tier: 'basic',
                        windowSeconds: 60,
                        maxRequests: 100,
                        burstLimit: 0,
                        enabled: true
                      });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingRule ? 'Edit Rate Limit Rule' : 'Create Rate Limit Rule'}
                      </DialogTitle>
                      <DialogDescription>
                        Configure rate limiting parameters for an endpoint and tier combination.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="endpoint">Endpoint</Label>
                          <Input
                            id="endpoint"
                            placeholder="/api/endpoint"
                            value={ruleForm.endpoint}
                            onChange={(e) => setRuleForm(prev => ({ ...prev, endpoint: e.target.value }))}
                            disabled={!!editingRule}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="method">Method</Label>
                          <Select 
                            value={ruleForm.method} 
                            onValueChange={(value) => setRuleForm(prev => ({ ...prev, method: value }))}
                            disabled={!!editingRule}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="DELETE">DELETE</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRuleDialogOpen(false);
                          setEditingRule(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateRule}
                        disabled={isCreatingRule || isUpdatingRule}
                      >
                        {editingRule ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Max Requests</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules?.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono text-sm">{rule.endpoint}</TableCell>
                        <TableCell>
                          <Badge className={getMethodColor(rule.method)}>
                            {rule.method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTierColor(rule.tier)}>
                            {rule.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>{rule.windowSeconds}s</TableCell>
                        <TableCell>{rule.maxRequests.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditRule(rule)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => rule.id && handleDeleteRule(rule.id)}
                              disabled={isDeletingRule}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Quotas</CardTitle>
              <CardDescription>
                Manage daily and monthly quotas for individual users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground">
                Quota management interface coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}