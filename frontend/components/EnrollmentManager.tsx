import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, Play, Pause, Plus, Search, Filter } from 'lucide-react';
import { useNurturing } from '../hooks/useNurturing';
import { useToast } from '@/components/ui/use-toast';
import LoadingSpinner from './LoadingSpinner';

interface EnrollmentManagerProps {
  sequences: any[];
  selectedSequenceId: string | null;
}

export default function EnrollmentManager({ 
  sequences, 
  selectedSequenceId 
}: EnrollmentManagerProps) {
  const [selectedSequence, setSelectedSequence] = useState(selectedSequenceId || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showBulkEnroll, setShowBulkEnroll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: enrollments, isLoading } = useSequenceEnrollments(
    selectedSequence,
    statusFilter === 'all' ? undefined : statusFilter
  );

  const { toast } = useToast();

  if (!selectedSequence) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select a Sequence</h3>
          <p className="text-muted-foreground text-center mb-4">
            Choose a nurturing sequence to view and manage enrollments.
          </p>
          <Select value={selectedSequence} onValueChange={setSelectedSequence}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select sequence..." />
            </SelectTrigger>
            <SelectContent>
              {sequences.map((seq) => (
                <SelectItem key={seq.id} value={seq.id}>
                  {seq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }

  const sequence = sequences.find(s => s.id === selectedSequence);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'unsubscribed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredEnrollments = enrollments?.filter(enrollment => 
    searchTerm === '' || 
    enrollment.prospectId.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Enrollment Management</h2>
          <p className="text-muted-foreground">
            Manage prospect enrollments for {sequence?.name}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedSequence} onValueChange={setSelectedSequence}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sequences.map((seq) => (
                <SelectItem key={seq.id} value={seq.id}>
                  {seq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={() => setShowBulkEnroll(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Bulk Enroll
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prospects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Enrollments List */}
      {isLoading ? (
        <LoadingSpinner />
      ) : filteredEnrollments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Enrollments Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'No enrollments match your filters'
                : 'No prospects are enrolled in this sequence yet'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setShowBulkEnroll(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Enroll Prospects
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredEnrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-semibold">{enrollment.prospectId}</h3>
                      <p className="text-sm text-muted-foreground">
                        Enrolled {formatDate(enrollment.enrolledAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{enrollment.currentStep}</div>
                      <div className="text-xs text-muted-foreground">Current Step</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-semibold">{enrollment.completedSteps}</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                    
                    <Badge className={`${getStatusColor(enrollment.status)} text-white border-0`}>
                      {enrollment.status}
                    </Badge>
                    
                    <div className="flex space-x-2">
                      {enrollment.status === 'active' && (
                        <Button variant="outline" size="sm">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {enrollment.status === 'paused' && (
                        <Button variant="outline" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {enrollment.nextStepAt && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Next step scheduled for {formatDate(enrollment.nextStepAt)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Enrollment Dialog */}
      {showBulkEnroll && (
        <BulkEnrollmentDialog
          sequenceId={selectedSequence}
          onClose={() => setShowBulkEnroll(false)}
        />
      )}
    </div>
  );
}

function BulkEnrollmentDialog({ 
  sequenceId, 
  onClose 
}: { 
  sequenceId: string; 
  onClose: () => void;
}) {
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  
  const { data: candidates, isLoading } = useEnrollmentCandidates(sequenceId);
  const bulkEnroll = useBulkEnrollProspects();
  const { toast } = useToast();

  const handleEnroll = async () => {
    if (selectedProspects.length === 0) {
      toast({
        title: "No prospects selected",
        description: "Please select at least one prospect to enroll",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await bulkEnroll.mutateAsync({
        sequenceId,
        prospectIds: selectedProspects
      });
      
      toast({
        title: "Bulk enrollment complete",
        description: `Successfully enrolled ${result.enrolled} prospects. ${result.failed.length} failed.`
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Enrollment failed",
        description: "Failed to enroll prospects in sequence",
        variant: "destructive"
      });
    }
  };

  const toggleProspect = (prospectId: string) => {
    setSelectedProspects(prev => 
      prev.includes(prospectId)
        ? prev.filter(id => id !== prospectId)
        : [...prev, prospectId]
    );
  };

  const selectAll = () => {
    setSelectedProspects(candidates?.map(c => c.prospectId) || []);
  };

  const clearSelection = () => {
    setSelectedProspects([]);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Enroll Prospects</DialogTitle>
          <DialogDescription>
            Select prospects to enroll in this nurturing sequence based on their classification and stage.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {candidates?.length || 0} eligible prospects found
              </p>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {candidates?.map((candidate) => (
                <label
                  key={candidate.prospectId}
                  className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedProspects.includes(candidate.prospectId)}
                    onChange={() => toggleProspect(candidate.prospectId)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{candidate.prospectId}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline">{candidate.classification}</Badge>
                      <Badge variant="outline">{candidate.stage}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Score: {Math.round(candidate.score * 100)}%
                      </span>
                    </div>
                  </div>
                </label>
              )) || (
                <p className="text-center text-muted-foreground py-8">
                  No eligible prospects found for this sequence
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleEnroll} 
            disabled={bulkEnroll.isPending || selectedProspects.length === 0}
          >
            {bulkEnroll.isPending ? 'Enrolling...' : `Enroll ${selectedProspects.length} Prospects`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}