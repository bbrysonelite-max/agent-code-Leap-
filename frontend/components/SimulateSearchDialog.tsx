import { useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { Agent } from '~backend/agent/types';
import { useSimulateSearch } from '../hooks/useProspects';

interface SimulateSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
}

export default function SimulateSearchDialog({
  open,
  onOpenChange,
  agents,
}: SimulateSearchDialogProps) {
  const [agentId, setAgentId] = useState('');
  const [count, setCount] = useState([5]);

  const simulateSearchMutation = useSimulateSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agentId) {
      return;
    }

    simulateSearchMutation.mutate({
      agent_id: parseInt(agentId),
      count: count[0],
    }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Simulate LinkedIn Search
          </DialogTitle>
          <DialogDescription>
            Simulate finding new prospects through LinkedIn search and add them to your pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="agent">Select Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent to perform the search" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    {agent.name} ({agent.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label>Number of Prospects to Find</Label>
            <div className="px-3">
              <Slider
                value={count}
                onValueChange={setCount}
                max={10}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>1</span>
                <span className="font-medium">{count[0]} prospects</span>
                <span>10</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              What this simulation includes:
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Realistic prospect profiles with LinkedIn data</li>
              <li>• Mix of business builders and product customers</li>
              <li>• Professional backgrounds relevant to Nu Skin</li>
              <li>• Contact information for outreach campaigns</li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={simulateSearchMutation.isPending || !agentId}
            >
              {simulateSearchMutation.isPending ? 'Searching...' : 'Start Search'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
