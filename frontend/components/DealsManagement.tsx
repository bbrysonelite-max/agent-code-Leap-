import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Search, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  User,
  Target,
  AlertTriangle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { useDeals, useCreateDeal, useUpdateDeal, useDealsPipeline, useContacts } from '../hooks/useAICRM';
import { useToast } from '@/components/ui/use-toast';
import type { CreateDealRequest, Deal } from '~backend/ai_crm/types';

export default function DealsManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const { data: deals, isLoading } = useDeals({
    stage: stageFilter || undefined,
    limit: 50
  });
  
  const { data: pipeline } = useDealsPipeline();
  const { data: contacts } = useContacts();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal(selectedDeal?.id || '');
  const { toast } = useToast();

  const handleCreateDeal = async (formData: FormData) => {
    try {
      const data: CreateDealRequest = {
        contact_id: formData.get('contact_id') as string,
        name: formData.get('name') as string,
        value: parseFloat(formData.get('value') as string),
        currency: formData.get('currency') as string || 'USD',
        stage: formData.get('stage') as any,
        probability: parseInt(formData.get('probability') as string) || 50,
        expected_close_date: formData.get('expected_close_date') 
          ? new Date(formData.get('expected_close_date') as string)
          : undefined,
        assigned_to: formData.get('assigned_to') as string || undefined,
        source: formData.get('source') as any,
        notes: formData.get('notes') as string || undefined,
      };

      await createDeal.mutateAsync(data);
      setShowCreateDialog(false);
      toast({
        title: "Deal created successfully",
        description: "AI recommendations will be generated automatically."
      });
    } catch (error) {
      console.error('Failed to create deal:', error);
      toast({
        title: "Error creating deal",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'prospecting': return 'bg-blue-500';
      case 'qualification': return 'bg-yellow-500';
      case 'proposal': return 'bg-orange-500';
      case 'negotiation': return 'bg-purple-500';
      case 'closed_won': return 'bg-green-500';
      case 'closed_lost': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 75) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    if (probability >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  const getStageProgress = (stage: string) => {
    switch (stage) {
      case 'prospecting': return 20;
      case 'qualification': return 40;
      case 'proposal': return 60;
      case 'negotiation': return 80;
      case 'closed_won': return 100;
      case 'closed_lost': return 0;
      default: return 0;
    }
  };

  const filteredDeals = deals?.filter((deal: any) => 
    deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (deal.contact_name && deal.contact_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (deal.contact_company && deal.contact_company.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Deals Management</h1>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Deal</DialogTitle>
            </DialogHeader>
            <form action={handleCreateDeal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Deal Name *</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="contact_id">Contact *</Label>
                  <Select name="contact_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts?.map((contact: any) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name} {contact.company && `(${contact.company})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="value">Value *</Label>
                  <Input id="value" name="value" type="number" step="0.01" required />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select name="currency" defaultValue="USD">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="probability">Probability (%)</Label>
                  <Input id="probability" name="probability" type="number" min="0" max="100" defaultValue="50" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stage">Stage *</Label>
                  <Select name="stage" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospecting">Prospecting</SelectItem>
                      <SelectItem value="qualification">Qualification</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="source">Source *</Label>
                  <Select name="source" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="import">Import</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expected_close_date">Expected Close Date</Label>
                  <Input id="expected_close_date" name="expected_close_date" type="date" />
                </div>
                <div>
                  <Label htmlFor="assigned_to">Assigned To</Label>
                  <Input id="assigned_to" name="assigned_to" />
                </div>
              </div>
              
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDeal.isPending}>
                  {createDeal.isPending ? 'Creating...' : 'Create Deal'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {pipeline?.map((stage: any) => (
          <Card key={stage.stage}>
            <CardContent className="p-4">
              <div className="text-center">
                <h3 className="font-medium capitalize mb-2">{stage.stage.replace('_', ' ')}</h3>
                <div className="text-2xl font-bold">{stage.deal_count}</div>
                <div className="text-sm text-muted-foreground">
                  ${(stage.total_value || 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stage.avg_win_probability?.toFixed(0)}% avg win rate
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Stages</SelectItem>
            <SelectItem value="prospecting">Prospecting</SelectItem>
            <SelectItem value="qualification">Qualification</SelectItem>
            <SelectItem value="proposal">Proposal</SelectItem>
            <SelectItem value="negotiation">Negotiation</SelectItem>
            <SelectItem value="closed_won">Closed Won</SelectItem>
            <SelectItem value="closed_lost">Closed Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Win Probability</TableHead>
                <TableHead>AI Probability</TableHead>
                <TableHead>Close Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.map((deal: any) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{deal.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {deal.assigned_to && `Assigned to ${deal.assigned_to}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{deal.contact_name}</div>
                      <div className="text-sm text-muted-foreground">{deal.contact_company}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {deal.currency} {deal.value.toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Badge 
                        variant="outline" 
                        className={`${getStageColor(deal.stage)} text-white border-none`}
                      >
                        {deal.stage.replace('_', ' ')}
                      </Badge>
                      <Progress value={getStageProgress(deal.stage)} className="h-1" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${getProbabilityColor(deal.probability)}`}>
                      {deal.probability}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <span className={`font-medium ${getProbabilityColor(deal.ai_win_probability)}`}>
                        {deal.ai_win_probability}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {deal.expected_close_date 
                        ? new Date(deal.expected_close_date).toLocaleDateString()
                        : '-'
                      }
                      {deal.expected_close_date && new Date(deal.expected_close_date) < new Date() && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDeal(deal)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredDeals.length === 0 && (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No deals found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || stageFilter
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first deal'
                }
              </p>
              {!searchQuery && !stageFilter && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Deal
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDeal && (
        <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Deal Details: {selectedDeal.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Value</Label>
                  <div className="text-2xl font-bold">
                    {selectedDeal.currency} {selectedDeal.value.toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label>Win Probability</Label>
                  <div className={`text-2xl font-bold ${getProbabilityColor(selectedDeal.probability)}`}>
                    {selectedDeal.probability}%
                  </div>
                </div>
                <div>
                  <Label>AI Win Probability</Label>
                  <div className={`text-2xl font-bold ${getProbabilityColor(selectedDeal.ai_win_probability)}`}>
                    {selectedDeal.ai_win_probability}%
                  </div>
                </div>
              </div>
              
              {selectedDeal.ai_risk_factors && selectedDeal.ai_risk_factors.length > 0 && (
                <div>
                  <Label>AI Risk Factors</Label>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedDeal.ai_risk_factors.map((factor, index) => (
                      <li key={index} className="text-sm text-red-600">{factor}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedDeal.ai_recommendations && selectedDeal.ai_recommendations.length > 0 && (
                <div>
                  <Label>AI Recommendations</Label>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedDeal.ai_recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-green-600">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Current Stage</Label>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`${getStageColor(selectedDeal.stage)} text-white border-none`}
                    >
                      {selectedDeal.stage.replace('_', ' ')}
                    </Badge>
                    <Progress value={getStageProgress(selectedDeal.stage)} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label>Expected Close Date</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {selectedDeal.expected_close_date 
                      ? new Date(selectedDeal.expected_close_date).toLocaleDateString()
                      : 'Not set'
                    }
                    {selectedDeal.expected_close_date && new Date(selectedDeal.expected_close_date) < new Date() && (
                      <Badge variant="destructive">Overdue</Badge>
                    )}
                  </div>
                </div>
              </div>
              
              {selectedDeal.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm">{selectedDeal.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button onClick={() => setSelectedDeal(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}