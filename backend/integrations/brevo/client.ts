// Brevo (formerly Sendinblue) Email Client
// Part of AI Lead OS - TRANSMIT MODULE
import { secret } from "encore.dev/config";

// Brevo API Key - set via: encore secret set BrevoApiKey
const brevoApiKey = secret("BrevoApiKey");

const BREVO_BASE_URL = "https://api.brevo.com/v3";

export interface SendEmailRequest {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  sender?: { email: string; name: string };
  replyTo?: { email: string; name?: string };
  tags?: string[];
  params?: Record<string, any>;
  templateId?: number;
}

export interface SendEmailResponse {
  messageId: string;
}

export interface EmailEvent {
  email: string;
  event: "delivered" | "opened" | "clicked" | "bounced" | "spam" | "unsubscribed";
  timestamp: string;
  messageId: string;
  link?: string;
}

/**
 * Brevo Email Client
 * Handles all email sending for AI Lead OS
 */
export class BrevoClient {
  private _apiKey?: string;
  private baseUrl: string;
  private defaultSender: { email: string; name: string };

  constructor(apiKey?: string) {
    this._apiKey = apiKey;
    this.baseUrl = BREVO_BASE_URL;
    this.defaultSender = {
      email: "help@botcraftwrks.ai",
      name: "Brent Bryson"
    };
  }

  private get apiKey(): string {
    if (!this._apiKey) {
      this._apiKey = brevoApiKey();
    }
    return this._apiKey;
  }

  /**
   * Send a single email
   */
  async sendEmail(req: SendEmailRequest): Promise<SendEmailResponse> {
    const response = await fetch(`${this.baseUrl}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: req.sender || this.defaultSender,
        to: req.to,
        subject: req.subject,
        htmlContent: req.htmlContent,
        textContent: req.textContent,
        replyTo: req.replyTo,
        tags: req.tags || ["ai-lead-os"],
        params: req.params,
        templateId: req.templateId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Brevo API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Send email using a template
   */
  async sendTemplateEmail(
    templateId: number,
    to: { email: string; name?: string },
    params: Record<string, any>
  ): Promise<SendEmailResponse> {
    return this.sendEmail({
      to: [to],
      subject: "", // Template has subject
      templateId,
      params,
    });
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(
    emails: Array<{
      to: { email: string; name?: string };
      subject: string;
      htmlContent: string;
      params?: Record<string, any>;
    }>
  ): Promise<{ sent: number; failed: number; results: any[] }> {
    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        const result = await this.sendEmail({
          to: [email.to],
          subject: email.subject,
          htmlContent: email.htmlContent,
          params: email.params,
        });
        results.push({ success: true, ...result });
        sent++;
        
        // Rate limiting - don't hammer the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
        failed++;
      }
    }

    return { sent, failed, results };
  }

  /**
   * Get email statistics
   */
  async getStatistics(days: number = 7): Promise<any> {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await fetch(
      `${this.baseUrl}/smtp/statistics/aggregatedReport?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: {
          "api-key": this.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get statistics: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Add contact to a list
   */
  async addContact(
    email: string,
    attributes: Record<string, any>,
    listIds?: number[]
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/contacts`, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds,
        updateEnabled: true,
      }),
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(`Failed to add contact: ${error}`);
    }
  }

  /**
   * Remove contact (unsubscribe)
   */
  async removeContact(email: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/contacts/${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: {
          "api-key": this.apiKey,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to remove contact: ${response.status}`);
    }
  }

  /**
   * Check if email is blocked/blacklisted
   */
  async isBlocked(email: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/contacts/${encodeURIComponent(email)}`,
        {
          headers: {
            "api-key": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        return false; // Contact doesn't exist, not blocked
      }

      const contact = await response.json();
      return contact.emailBlacklisted === true;
    } catch {
      return false;
    }
  }

  /**
   * Add email to blocklist
   */
  async addToBlocklist(email: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/contacts/blacklist/${encodeURIComponent(email)}`,
      {
        method: "POST",
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      // Try alternative method
      await fetch(`${this.baseUrl}/contacts`, {
        method: "POST",
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          emailBlacklisted: true,
          updateEnabled: true,
        }),
      });
    }
  }
}

// Export singleton
export const brevoClient = new BrevoClient();

/**
 * Personalize email content with variables
 */
export function personalizeContent(
  template: string,
  variables: Record<string, string>
): string {
  let content = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    content = content.replace(regex, value);
  }
  
  return content;
}

/**
 * Generate unsubscribe link
 */
export function generateUnsubscribeLink(email: string, baseUrl: string): string {
  const token = Buffer.from(email).toString("base64");
  return `${baseUrl}/unsubscribe?token=${token}`;
}
