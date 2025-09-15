import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Mail, Users, TestTube } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export default function RealtimeTestControls() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSimulateResponse = async () => {
    setLoading(true);
    try {
      await backend.email.simulateResponse();
      toast({
        title: 'Response Simulated',
        description: 'Email response simulated successfully',
      });
    } catch (error) {
      console.error('Failed to simulate response:', error);
      toast({
        title: 'Simulation Failed',
        description: 'Could not simulate email response',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGetConnectedClients = async () => {
    try {
      const result = await backend.realtime.getConnectedClients();
      toast({
        title: 'Connected Clients',
        description: `${result.count} clients connected`,
      });
    } catch (error) {
      console.error('Failed to get connected clients:', error);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center text-sm">
          <TestTube className="h-4 w-4 mr-2" />
          Real-time Testing Controls
        </CardTitle>
        <CardDescription className="text-xs">
          Test real-time features and WebSocket connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleSimulateResponse}
            disabled={loading}
          >
            <Mail className="h-3 w-3 mr-1" />
            {loading ? 'Simulating...' : 'Simulate Email Response'}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleGetConnectedClients}
          >
            <Users className="h-3 w-3 mr-1" />
            Check Connections
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}