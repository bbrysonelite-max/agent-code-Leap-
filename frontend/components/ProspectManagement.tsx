import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, UserPlus, Edit, Mail, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { ProspectClassification, ProspectStatus } from '~backend/agent/types';
import LoadingSpinner from './LoadingSpinner';
import ProspectDialog from './ProspectDialog';
import SimulateSearchDialog from './SimulateSearchDialog';

export default function ProspectManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<ProspectClassification | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const [showProspectDialog, setShowProspectDialog] = useState(false);
  const [showSimulateDialog, setShowSimulateDialog] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => backend.agent.list(),
  });

  const { data: prospectsData, isLoading } = useQuery({
    queryKey: ['prospects', searchTerm, classificationFilter, statusFilter],
    queryFn: () => backend.prospect.list({
      search: searchTerm || undefined,
      classification: classificationFilter !== 'all' ? classificationFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      limit: 100,
    }),
  });

  const updateProspectMutation = useMutation({
    mutationFn: (data: { id: number; classification?: ProspectClassification; status?: ProspectStatus; notes?: string }) =>
      backend.prospect.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast({
        title: 'Prospect Updated',
        description: 'Prospect information has been updated successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to update prospect:', error);
      toast({
        title: 'Error',
        description: 'Failed to update prospect. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const getClassificationColor = (classification: ProspectClassification) => {
    switch (classification) {
      case 'business_builder':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'product_customer':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'unqualified':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: ProspectStatus) => {
    switch (status) {
      case 'new':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'contacted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'responded':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'qualified':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'converted':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    }
  };

  const handleUpdateClassification = (prospect: any, classification: ProspectClassification) => {
    updateProspectMutation.mutate({
      id: prospect.id,
      classification,
    });
  };

  const handleUpdateStatus = (prospect: any, status: ProspectStatus) => {
    updateProspectMutation.mutate({
      id: prospect.id,
      status,
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Prospect Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and track your Nu Skin prospects
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setShowSimulateDialog(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            Simulate Search
          </Button>
          <Button onClick={() => setShowProspectDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Prospect
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prospects ({prospectsData?.total || 0})</CardTitle>
          <CardDescription>
            Filter and search through your prospect database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search prospects by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={classificationFilter}
              onValueChange={(value) => setClassificationFilter(value as ProspectClassification | 'all')}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classifications</SelectItem>
                <SelectItem value="business_builder">Business Builder</SelectItem>
                <SelectItem value="product_customer">Product Customer</SelectItem>
                <SelectItem value="unqualified">Unqualified</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as ProspectStatus | 'all')}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {prospectsData?.prospects.map((prospect) => (
              <div
                key={prospect.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {prospect.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {prospect.email}
                      </p>
                      {prospect.company && (
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          {prospect.position} at {prospect.company}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Badge className={getClassificationColor(prospect.classification)}>
                    {prospect.classification.replace('_', ' ')}
                  </Badge>
                  <Badge className={getStatusColor(prospect.status)}>
                    {prospect.status}
                  </Badge>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedProspect(prospect);
                          setShowProspectDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

          {prospectsData?.prospects.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No prospects found. Try adjusting your filters or add some prospects.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ProspectDialog
        open={showProspectDialog}
        onOpenChange={setShowProspectDialog}
        prospect={selectedProspect}
        agents={agents?.agents || []}
        onClose={() => {
          setShowProspectDialog(false);
          setSelectedProspect(null);
        }}
      />

      <SimulateSearchDialog
        open={showSimulateDialog}
        onOpenChange={setShowSimulateDialog}
        agents={agents?.agents || []}
      />
    </div>
  );
}
