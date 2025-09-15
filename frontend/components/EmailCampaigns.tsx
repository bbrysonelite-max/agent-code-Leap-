import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Send, Eye, MoreHorizontal, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { CampaignStatus } from '~backend/agent/types';
import LoadingSpinner from './LoadingSpinner';
import EmailTemplateDialog from './EmailTemplateDialog';
import SendEmailDialog from './SendEmailDialog';

export default function EmailCampaigns() {
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', statusFilter],
    queryFn: () => backend.email.listCampaigns({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      limit: 100,
    }),
  });

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => backend.email.listTemplates({ active_only: true }),
  });

  const { data: prospects } = useQuery({
    queryKey: ['prospects-all'],
    queryFn: () => backend.prospect.list({ limit: 1000 }),
  });

  const getStatusColor = (status: CampaignStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'opened':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'clicked':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'replied':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'bounced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  if (campaignsLoading || templatesLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Email Campaigns
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your Nu Skin outreach campaigns and templates
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setShowTemplateDialog(true)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Templates
          </Button>
          <Button onClick={() => setShowSendDialog(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {campaignsData?.campaigns.filter(c => c.status === 'sent').length || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Emails Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {campaignsData?.campaigns.filter(c => c.status === 'opened').length || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Emails Opened</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">
              {campaignsData?.campaigns.filter(c => c.status === 'clicked').length || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Links Clicked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">
              {campaignsData?.campaigns.filter(c => c.status === 'replied').length || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Replies Received</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campaign History</CardTitle>
              <CardDescription>
                Track the performance of your outreach campaigns
              </CardDescription>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as CampaignStatus | 'all')}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="opened">Opened</SelectItem>
                <SelectItem value="clicked">Clicked</SelectItem>
                <SelectItem value="replied">Replied</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaignsData?.campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {campaign.subject}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        To: {campaign.prospect_name} ({campaign.prospect_email})
                      </p>
                      {campaign.prospect_company && (
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          {campaign.prospect_company}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {campaign.sent_at 
                          ? new Date(campaign.sent_at).toLocaleString()
                          : 'Not sent'
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setSelectedCampaign(campaign)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

          {campaignsData?.campaigns.length === 0 && (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No campaigns found. Start by sending your first email!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <EmailTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        templates={templatesData?.templates || []}
      />

      <SendEmailDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        prospects={prospects?.prospects || []}
        templates={templatesData?.templates || []}
      />
    </div>
  );
}
