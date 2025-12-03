// Brevo (formerly Sendinblue) API Types

export interface BrevoConfig {
  apiKey: string;
}

export interface BrevoSender {
  name: string;
  email: string;
}

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface BrevoSendRequest {
  sender: BrevoSender;
  to: BrevoRecipient[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  replyTo?: BrevoSender;
  tags?: string[];
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface BrevoSendResponse {
  messageId: string;
}

export interface BrevoTemplate {
  id: number;
  name: string;
  subject: string;
  htmlContent: string;
  isActive: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface BrevoContact {
  email: string;
  id?: number;
  emailBlacklisted?: boolean;
  smsBlacklisted?: boolean;
  attributes?: Record<string, any>;
  listIds?: number[];
}

export interface BrevoWebhookEvent {
  event: 'delivered' | 'opened' | 'clicked' | 'hardBounce' | 'softBounce' | 'spam' | 'unsubscribed' | 'reply';
  email: string;
  messageId: string;
  date: string;
  ts: number;
  link?: string;
  subject?: string;
  tag?: string;
}

// Our internal email record
export interface EmailRecord {
  id: string;
  leadId: string;
  sequenceId?: string;
  stepNumber?: number;
  
  to: string;
  toName?: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  
  brevoMessageId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed';
  
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// Service types (used by service.ts)
export interface SendEmailOptions {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text?: string;
  from?: { email: string; name?: string };
  replyTo?: string;
  tags?: string[];
  leadId?: string;
  sequenceId?: string;
  stepNumber?: number;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  category: string;
}
