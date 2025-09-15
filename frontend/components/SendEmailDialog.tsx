import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { Prospect, EmailTemplate } from '~backend/agent/types';

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospects: Prospect[];
  templates: EmailTemplate[];
}

export default function SendEmailDialog({
  open,
  onOpenChange,
  prospects,
  templates,
}: SendEmailDialogProps) {
  const [prospectId, setProspectId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [agentName, setAgentName] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendEmailMutation = useMutation({
    mutationFn: (data: { prospect_id: number; template_id: number; agent_name?: string }) =>
      backend.email.sendEmail(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast({
        title: 'Email Sent',
        description: result.message,
      });
      onOpenChange(false);
      setProspectId('');
      setTemplateId('');
      setAgentName('');
    },
    onError: (error) => {
      console.error('Failed to send email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send email. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prospectId || !templateId) {
      toast({
        title: 'Error',
        description: 'Please select both a prospect and template.',
        variant: 'destructive',
      });
      return;
    }

    sendEmailMutation.mutate({
      prospect_id: parseInt(prospectId),
      template_id: parseInt(templateId),
      agent_name: agentName || undefined,
    });
  };

  const selectedProspect = prospects.find(p => p.id.toString() === prospectId);
  const selectedTemplate = templates.find(t => t.id.toString() === templateId);

  // Filter templates based on prospect classification
  const relevantTemplates = selectedProspect 
    ? templates.filter(t => 
        t.template_type === selectedProspect.classification || 
        t.template_type === 'initial_outreach' || 
        t.template_type === 'follow_up'
      )
    : templates;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Email Campaign</DialogTitle>
          <DialogDescription>
            Send a personalized Nu Skin outreach email to a prospect
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prospect">Select Prospect</Label>
            <Select value={prospectId} onValueChange={setProspectId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a prospect" />
              </SelectTrigger>
              <SelectContent>
                {prospects.map((prospect) => (
                  <SelectItem key={prospect.id} value={prospect.id.toString()}>
                    {prospect.name} ({prospect.email}) - {prospect.classification.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Email Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an email template" />
              </SelectTrigger>
              <SelectContent>
                {relevantTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name} ({template.template_type.replace('_', ' ')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent_name">Your Name (optional)</Label>
            <Input
              id="agent_name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Enter your name for personalization"
            />
          </div>

          {selectedProspect && selectedTemplate && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Email Preview
              </h4>
              <div className="text-sm space-y-2">
                <p>
                  <strong>To:</strong> {selectedProspect.name} ({selectedProspect.email})
                </p>
                <p>
                  <strong>Subject:</strong> {selectedTemplate.subject
                    .replace(/\{\{name\}\}/g, selectedProspect.name)
                    .replace(/\{\{agent_name\}\}/g, agentName || 'Your Nu Skin Partner')
                  }
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  The email content will be automatically personalized with the prospect's details.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={sendEmailMutation.isPending || !prospectId || !templateId}
            >
              {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
