import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Agent, ProspectClassification } from '~backend/agent/types';
import { useCreateProspect, useUpdateProspect } from '../hooks/useProspects';

interface ProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect?: any;
  agents: Agent[];
  onClose: () => void;
}

export default function ProspectDialog({
  open,
  onOpenChange,
  prospect,
  agents,
  onClose,
}: ProspectDialogProps) {
  const [formData, setFormData] = useState({
    agent_id: '',
    name: '',
    email: '',
    linkedin_profile: '',
    company: '',
    position: '',
    classification: 'unqualified' as ProspectClassification,
    notes: '',
  });

  const createMutation = useCreateProspect();
  const updateMutation = useUpdateProspect();

  useEffect(() => {
    if (prospect) {
      setFormData({
        agent_id: prospect.agent_id.toString(),
        name: prospect.name,
        email: prospect.email,
        linkedin_profile: prospect.linkedin_profile || '',
        company: prospect.company || '',
        position: prospect.position || '',
        classification: prospect.classification,
        notes: prospect.notes || '',
      });
    } else {
      setFormData({
        agent_id: agents[0]?.id.toString() || '',
        name: '',
        email: '',
        linkedin_profile: '',
        company: '',
        position: '',
        classification: 'unqualified',
        notes: '',
      });
    }
  }, [prospect, agents]);



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      agent_id: parseInt(formData.agent_id),
    };

    if (prospect) {
      updateMutation.mutate({
        id: prospect.id,
        classification: data.classification,
        notes: data.notes,
      }, {
        onSuccess: () => onClose(),
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => onClose(),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {prospect ? 'Edit Prospect' : 'Add New Prospect'}
          </DialogTitle>
          <DialogDescription>
            {prospect 
              ? 'Update prospect information and classification.'
              : 'Add a new prospect to your Nu Skin pipeline.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!prospect && (
            <div className="space-y-2">
              <Label htmlFor="agent_id">Agent</Label>
              <Select
                value={formData.agent_id}
                onValueChange={(value) => setFormData({ ...formData, agent_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!!prospect}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!prospect}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin_profile">LinkedIn Profile</Label>
            <Input
              id="linkedin_profile"
              value={formData.linkedin_profile}
              onChange={(e) => setFormData({ ...formData, linkedin_profile: e.target.value })}
              disabled={!!prospect}
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                disabled={!!prospect}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                disabled={!!prospect}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="classification">Classification</Label>
            <Select
              value={formData.classification}
              onValueChange={(value) => setFormData({ ...formData, classification: value as ProspectClassification })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="business_builder">Business Builder</SelectItem>
                <SelectItem value="product_customer">Product Customer</SelectItem>
                <SelectItem value="unqualified">Unqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes about this prospect..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {prospect ? 'Update' : 'Create'} Prospect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
