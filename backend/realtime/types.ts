export interface RealtimeHandshake {
  clientId: string;
  subscriptions: string[];
}

export interface RealtimeMessage {
  type: "agent_activity" | "prospect_discovery" | "email_progress" | "email_response" | "system_notification" | "chat_message";
  data: any;
  timestamp: string;
  clientId?: string;
}

export interface AgentActivityData {
  agentId: string;
  action: string;
  status: "active" | "idle" | "error";
  details?: any;
}

export interface ProspectDiscoveryData {
  searchId: string;
  prospectCount: number;
  status: "searching" | "found" | "completed" | "error";
  prospect?: any;
}

export interface EmailProgressData {
  campaignId: string;
  emailId: string;
  status: "queued" | "sending" | "sent" | "failed";
  recipientEmail: string;
  progress: {
    sent: number;
    total: number;
    failed: number;
  };
}

export interface EmailResponseData {
  emailId: string;
  campaignId: string;
  recipientEmail: string;
  responseType: "opened" | "clicked" | "replied" | "bounced" | "unsubscribed";
  responseData?: any;
}

export interface SystemNotificationData {
  level: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  action?: {
    label: string;
    url: string;
  };
}