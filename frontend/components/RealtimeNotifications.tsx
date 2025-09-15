import { useEffect } from 'react';
import { useSystemNotifications, useEmailResponses, useProspectDiscovery } from '../hooks/useRealtime';
import { useToast } from '@/components/ui/use-toast';
import { Bell, Mail, Users, TrendingUp } from 'lucide-react';

export default function RealtimeNotifications() {
  const { notifications } = useSystemNotifications();
  const { responses } = useEmailResponses();
  const { discoveries } = useProspectDiscovery();
  const { toast } = useToast();

  // Handle system notifications
  useEffect(() => {
    const latestNotification = notifications[0];
    if (latestNotification) {
      toast({
        title: latestNotification.title,
        description: latestNotification.message,
        variant: latestNotification.level === 'error' ? 'destructive' : 'default',
      });
    }
  }, [notifications, toast]);

  // Handle email response notifications
  useEffect(() => {
    const latestResponse = responses[0];
    if (latestResponse) {
      const getIcon = () => {
        switch (latestResponse.responseType) {
          case 'opened': return '📖';
          case 'clicked': return '👆';
          case 'replied': return '💬';
          case 'bounced': return '❌';
          case 'unsubscribed': return '🚫';
          default: return '📧';
        }
      };

      toast({
        title: `Email ${latestResponse.responseType}`,
        description: `${getIcon()} ${latestResponse.recipientEmail} ${latestResponse.responseType} your email`,
        variant: latestResponse.responseType === 'bounced' || latestResponse.responseType === 'unsubscribed' ? 'destructive' : 'default',
      });
    }
  }, [responses, toast]);

  // Handle prospect discovery notifications
  useEffect(() => {
    const latestDiscovery = discoveries[0];
    if (latestDiscovery && latestDiscovery.status === 'completed' && latestDiscovery.prospectCount > 0) {
      toast({
        title: 'Prospects Found!',
        description: `🎯 Found ${latestDiscovery.prospectCount} new prospects`,
      });
    }
  }, [discoveries, toast]);

  return null; // This component only handles notifications
}