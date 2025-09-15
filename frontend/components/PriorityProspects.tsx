import { useState } from 'react';
import { useTopProspects } from '@/hooks/useScoring';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Star, TrendingUp, Mail, Users, Target } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import type { PriorityRecommendation } from '~backend/scoring/types';

export function PriorityProspects() {
  const [priority, setPriority] = useState<'high' | 'medium' | 'low' | undefined>();
  const [minScore, setMinScore] = useState([60]);
  const [limit, setLimit] = useState(20);

  const { data: topProspects, isLoading, error } = useTopProspects({
    priority,
    minScore: minScore[0],
    limit,
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading priority prospects</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Priority Prospects</h2>
          <p className="text-muted-foreground">AI-powered lead prioritization for maximum ROI</p>
        </div>
        <div className="flex items-center gap-4">
          <Target className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">{topProspects?.length || 0} high-value prospects</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Priority Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={priority || 'all'} onValueChange={(value) => setPriority(value === 'all' ? undefined : value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="low">Low Priority</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Min Score: {minScore[0]}</CardTitle>
          </CardHeader>
          <CardContent>
            <Slider
              value={minScore}
              onValueChange={setMinScore}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Results Limit</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 prospects</SelectItem>
                <SelectItem value="20">20 prospects</SelectItem>
                <SelectItem value="50">50 prospects</SelectItem>
                <SelectItem value="100">100 prospects</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>High Priority:</span>
                <span className="font-medium">{topProspects?.filter(p => p.priority === 'high').length || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Avg Score:</span>
                <span className="font-medium">
                  {topProspects?.length ? Math.round(topProspects.reduce((sum, p) => sum + p.score, 0) / topProspects.length) : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {topProspects?.map((prospect) => (
          <ProspectCard key={prospect.prospectId} prospect={prospect} />
        ))}
        
        {!topProspects?.length && (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Priority Prospects Found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or score more prospects to see recommendations.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProspectCard({ prospect }: { prospect: PriorityRecommendation }) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{prospect.name}</h3>
              <Badge variant="outline" className={getPriorityColor(prospect.priority)}>
                {prospect.priority.toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-1">{prospect.company}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                <span>Score: {prospect.score}/100</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                <span>Confidence: {Math.round(prospect.confidence * 100)}%</span>
              </div>
            </div>
          </div>
          <Button size="sm" className="ml-4">
            <Mail className="h-4 w-4 mr-1" />
            Contact
          </Button>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-sm mb-2">Next Action:</h4>
          <p className="text-sm text-muted-foreground bg-blue-50 p-2 rounded border-l-4 border-blue-200">
            {prospect.nextAction}
          </p>
        </div>

        {prospect.reasons.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2">AI Analysis:</h4>
            <div className="flex flex-wrap gap-2">
              {prospect.reasons.map((reason, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {reason}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}