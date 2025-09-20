import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, CheckCheck, X, Mail, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import { useToast } from '@/components/ui/use-toast';

interface Notification {
  id: string;
  type: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

export default function NurturingNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['nurturing-notifications'],
    queryFn: () => backend.nurturing.getRecentNurturingEvents({ 
      userId: 'current-user', // Would get from auth context
      limit: 20 
    }),
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const markAsRead = useMutation({
    mutationFn: ({ notificationId }: { notificationId: string }) =>
      backend.nurturing.markNotificationAsRead({ 
        notificationId, 
        userId: 'current-user' 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-notifications'] });
    }
  });

  const markAllAsRead = useMutation({
    mutationFn: () => backend.nurturing.markAllNotificationsAsRead({ 
      userId: 'current-user' 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-notifications'] });
      toast({
        title: "All notifications marked as read",
        duration: 2000
      });
    }
  });

  const unreadCount = notifications?.unreadCount || 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'enrollment_created':
      case 'enrollment_completed':
        return <Users className="h-4 w-4" />;
      case 'email_replied':
      case 'step_executed':
        return <Mail className="h-4 w-4" />;
      case 'performance_alert':
        return <AlertTriangle className="h-4 w-4" />;
      case 'milestone_reached':
      case 'optimization_available':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string, priority?: string) => {
    if (priority === 'high') return 'text-red-500';
    if (priority === 'medium') return 'text-orange-500';
    
    switch (type) {
      case 'email_replied':
      case 'hot_prospect':
        return 'text-red-500';
      case 'enrollment_completed':
      case 'milestone_reached':
        return 'text-green-500';
      case 'performance_alert':
        return 'text-orange-500';
      default:
        return 'text-blue-500';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">High</Badge>;
      case 'medium':
        return <Badge variant="default" className="text-xs">Medium</Badge>;
      default:
        return null;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 z-50">
          <Card className="shadow-lg border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Nurturing Notifications
                </CardTitle>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsRead.mutate()}
                      disabled={markAllAsRead.isPending}
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications?.events.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    You're all caught up! New nurturing events will appear here.
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {notifications?.events.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={(id) => markAsRead.mutate({ notificationId: id })}
                    />
                  ))}
                </div>
              )}
              
              {notifications && notifications.events.length > 0 && (
                <div className="p-3 border-t bg-muted/50">
                  <Button variant="ghost" size="sm" className="w-full">
                    View all notifications
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function NotificationItem({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'enrollment_created':
      case 'enrollment_completed':
        return <Users className="h-4 w-4" />;
      case 'email_replied':
      case 'step_executed':
        return <Mail className="h-4 w-4" />;
      case 'performance_alert':
        return <AlertTriangle className="h-4 w-4" />;
      case 'milestone_reached':
      case 'optimization_available':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'email_replied':
      case 'hot_prospect':
        return 'text-red-500';
      case 'enrollment_completed':
      case 'milestone_reached':
        return 'text-green-500';
      case 'performance_alert':
        return 'text-orange-500';
      default:
        return 'text-blue-500';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div 
      className={`p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors ${
        !notification.isRead ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : ''
      }`}
      onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 ${getNotificationColor(notification.type)}`}>
          {getNotificationIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
              {notification.message}
            </p>
            <div className="flex items-center gap-2">
              {notification.data.priority && notification.data.priority !== 'low' && (
                <Badge 
                  variant={notification.data.priority === 'high' ? 'destructive' : 'default'}
                  className="text-xs"
                >
                  {notification.data.priority}
                </Badge>
              )}
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            {formatTimeAgo(notification.createdAt)}
          </p>
          
          {/* Additional data display */}
          {notification.data.prospectId && (
            <p className="text-xs text-muted-foreground mt-1">
              Prospect: {notification.data.prospectId}
            </p>
          )}
          
          {notification.data.sequenceId && (
            <p className="text-xs text-muted-foreground">
              Sequence: {notification.data.sequenceId}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}