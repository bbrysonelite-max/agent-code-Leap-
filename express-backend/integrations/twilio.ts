const TWILIO_BASE_URL = "https://api.twilio.com/2010-04-01";

export class TwilioClient {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async sendSMS(req: { to: string; body: string; from?: string }): Promise<{ sid: string; status: string }> {
    const toNumber = this.formatPhoneNumber(req.to);
    const fromNumber = req.from || this.fromNumber;
    
    if (this.normalizeNumber(toNumber) === this.normalizeNumber(fromNumber)) {
      throw new Error(
        `Cannot send SMS: 'To' number (${toNumber}) is the same as your Twilio 'From' number. ` +
        `Please send to a different phone number.`
      );
    }
    
    const url = `${TWILIO_BASE_URL}/Accounts/${this.accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", toNumber);
    formData.append("From", fromNumber);
    formData.append("Body", req.body);

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
    };
  }

  async getRecentMessages(limit: number = 20): Promise<any[]> {
    const url = `${TWILIO_BASE_URL}/Accounts/${this.accountSid}/Messages.json?PageSize=${limit}`;

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

  private normalizeNumber(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  private formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
    
    return phone.startsWith("+") ? phone : `+${digits}`;
  }
}

