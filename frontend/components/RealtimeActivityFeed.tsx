import { useDashboardRealtime } from '../hooks/useRealtime';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Users, Mail, Bell, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RealtimeActivityFeed() {
  const { messages, connected, connecting, error } = useDashboardRealtime();

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'agent_activity': return <Activity className="w-4 h-4" />;
      case 'prospect_discovery': return <Users className="w-4 h-4" />;
      case 'email_progress': return <Mail className="w-4 h-4" />;
      case 'email_response': return <Mail className="w-4 h-4" />;
      case 'system_notification': return <Bell className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'agent_activity': return 'bg-blue-100 text-blue-800';
      case 'prospect_discovery': return 'bg-green-100 text-green-800';
      case 'email_progress': return 'bg-purple-100 text-purple-800';
      case 'email_response': return 'bg-orange-100 text-orange-800';
      case 'system_notification': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatMessage = (message: any) => {
    switch (message.type) {
      case 'agent_activity':
        return `Agent ${message.data.agentId} ${message.data.action} - Status: ${message.data.status}`;
      case 'prospect_discovery':
        if (message.data.status === 'completed') {
          return `Search completed: Found ${message.data.prospectCount} prospects`;
        } else if (message.data.status === 'found') {
          return `New prospect discovered: ${message.data.prospect?.name || 'Unknown'}`;
        } else if (message.data.status === 'searching') {
          return 'Starting prospect search...';
        }
        return `Prospect discovery: ${message.data.status}`;
      case 'email_progress':
        return `Email ${message.data.status}: ${message.data.recipientEmail} (${message.data.progress.sent}/${message.data.progress.total})`;
      case 'email_response':
        return `Email ${message.data.responseType}: ${message.data.recipientEmail}`;
      case 'system_notification':
        return `${message.data.title}: ${message.data.message}`;
      default:
        return 'Unknown activity';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Live Activity Feed</CardTitle>
            <CardDescription>Real-time updates from your agents</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Wifi className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : connecting ? (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <Activity className="w-3 h-3 mr-1 animate-spin" />
                Connecting...
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="w-3 h-3 mr-1" />
                Disconnected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">Connection error: {error}</p>
          </div>
        )}
        
        <ScrollArea className="h-80">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
              <p className="text-xs">Live updates will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className={`p-2 rounded-full ${getMessageColor(message.type)}`}>
                    {getMessageIcon(message.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {formatMessage(message)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getMessageColor(message.type)}`}
                  >
                    {message.type.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}