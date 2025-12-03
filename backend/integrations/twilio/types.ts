// Twilio SMS Types

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface TwilioSendRequest {
  to: string;
  body: string;
  from?: string;
  statusCallback?: string;
}

export interface TwilioMessage {
  sid: string;
  accountSid: string;
  from: string;
  to: string;
  body: string;
  status: TwilioMessageStatus;
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  dateCreated: string;
  dateSent: string;
  dateUpdated: string;
  price: string;
  priceUnit: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export type TwilioMessageStatus = 
  | 'queued' 
  | 'sending' 
  | 'sent' 
  | 'delivered' 
  | 'undelivered' 
  | 'failed' 
  | 'received';

export interface TwilioWebhook {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  MessageStatus?: TwilioMessageStatus;
  SmsStatus?: TwilioMessageStatus;
  NumMedia?: string;
  NumSegments?: string;
}

// Our internal SMS record
export interface SmsRecord {
  id: string;
  leadId: string;
  sequenceId?: string;
  stepNumber?: number;
  
  to: string;
  from: string;
  body: string;
  
  twilioSid?: string;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'replied';
  
  sentAt?: Date;
  deliveredAt?: Date;
  repliedAt?: Date;
  
  replyBody?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Service types (used by service.ts)
export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
  category: string;
}
