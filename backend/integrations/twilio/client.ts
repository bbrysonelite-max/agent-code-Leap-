// Twilio SMS Client
// Part of AI Lead OS - TRANSMIT MODULE
import { secret } from "encore.dev/config";

// Twilio credentials - set via encore secret set
const twilioAccountSid = secret("TwilioAccountSid");
const twilioAuthToken = secret("TwilioAuthToken");
const twilioPhoneNumber = secret("TwilioPhoneNumber");

const TWILIO_BASE_URL = "https://api.twilio.com/2010-04-01";

export interface SendSMSRequest {
  to: string;
  body: string;
  from?: string;
  statusCallback?: string;
}

export interface SendSMSResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  dateCreated: string;
}

export interface SMSEvent {
  MessageSid: string;
  MessageStatus: "queued" | "sent" | "delivered" | "failed" | "undelivered";
  To: string;
  From: string;
  Body?: string;
  ErrorCode?: string;
}

/**
 * Twilio SMS Client
 * Handles all SMS sending for AI Lead OS
 */
export class TwilioClient {
  private _accountSid?: string;
  private _authToken?: string;
  private _fromNumber?: string;
  private baseUrl: string;

  constructor(accountSid?: string, authToken?: string, fromNumber?: string) {
    this._accountSid = accountSid;
    this._authToken = authToken;
    this._fromNumber = fromNumber;
    this.baseUrl = TWILIO_BASE_URL;
  }

  private get accountSid(): string {
    if (!this._accountSid) {
      this._accountSid = twilioAccountSid();
    }
    return this._accountSid;
  }

  private get authToken(): string {
    if (!this._authToken) {
      this._authToken = twilioAuthToken();
    }
    return this._authToken;
  }

  private get fromNumber(): string {
    if (!this._fromNumber) {
      this._fromNumber = twilioPhoneNumber();
    }
    return this._fromNumber;
  }

  /**
   * Send a single SMS
   */
  async sendSMS(req: SendSMSRequest): Promise<SendSMSResponse> {
    const url = `${this.baseUrl}/Accounts/${this.accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", this.formatPhoneNumber(req.to));
    formData.append("From", req.from || this.fromNumber);
    formData.append("Body", req.body);
    
    if (req.statusCallback) {
      formData.append("StatusCallback", req.statusCallback);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twilio API error: ${error.message || response.status}`);
    }

    const data = await response.json();
    return {
      sid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
      body: data.body,
      dateCreated: data.date_created,
    };
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(
    messages: Array<{ to: string; body: string }>
  ): Promise<{ sent: number; failed: number; results: any[] }> {
    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const msg of messages) {
      try {
        const result = await this.sendSMS(msg);
        results.push({ success: true, ...result });
        sent++;
        
        // Rate limiting - Twilio has limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        results.push({ success: false, error: (error as Error).message, to: msg.to });
        failed++;
      }
    }

    return { sent, failed, results };
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageSid: string): Promise<any> {
    const url = `${this.baseUrl}/Accounts/${this.accountSid}/Messages/${messageSid}.json`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get message status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get recent messages
   */
  async getRecentMessages(limit: number = 20): Promise<any[]> {
    const url = `${this.baseUrl}/Accounts/${this.accountSid}/Messages.json?PageSize=${limit}`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.status}`);
    }

    const data = await response.json();
    return data.messages || [];
  }

  /**
   * Format phone number to E.164
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    
    // If it's a US number without country code, add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // If it already has country code
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
    
    // Otherwise assume it's already formatted
    return phone.startsWith("+") ? phone : `+${digits}`;
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  /**
   * Instance method for validating phone numbers
   */
  isValidPhoneNumber(phone: string): boolean {
    return TwilioClient.isValidPhoneNumber(phone);
  }
}

// Export singleton
export const twilioClient = new TwilioClient();

/**
 * Personalize SMS content with variables
 */
export function personalizeSMS(
  template: string,
  variables: Record<string, string>
): string {
  let content = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    content = content.replace(regex, value);
  }
  
  // SMS should be under 160 chars for single message
  if (content.length > 160) {
    console.warn(`SMS exceeds 160 chars (${content.length}), will be sent as multiple segments`);
  }
  
  return content;
}

/**
 * Generate opt-out message
 */
export function appendOptOut(message: string): string {
  const optOut = "\n\nReply STOP to opt out";
  
  // Only append if not already there
  if (!message.toLowerCase().includes("stop")) {
    return message + optOut;
  }
  
  return message;
}
