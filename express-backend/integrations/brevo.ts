const BREVO_BASE_URL = "https://api.brevo.com/v3";

export class BrevoClient {
  private apiKey: string;
  private defaultSender = {
    email: "help@botcraftwrks.ai",
    name: "Brent Bryson"
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(req: {
    to: { email: string; name?: string }[];
    subject: string;
    htmlContent?: string;
    textContent?: string;
    sender?: { email: string; name: string };
    replyTo?: { email: string; name?: string };
    tags?: string[];
    params?: Record<string, any>;
    templateId?: number;
  }): Promise<{ messageId: string }> {
    const response = await fetch(`${BREVO_BASE_URL}/smtp/email`, {
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

  async getStatistics(days: number = 7): Promise<any> {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await fetch(
      `${BREVO_BASE_URL}/smtp/statistics/aggregatedReport?startDate=${startDate}&endDate=${endDate}`,
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
}

