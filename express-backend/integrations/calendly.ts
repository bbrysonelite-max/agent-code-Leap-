const CALENDLY_BASE_URL = "https://api.calendly.com";

export class CalendlyClient {
  private apiKey: string;
  private bookingLink: string;

  constructor(apiKey: string, bookingLink: string) {
    this.apiKey = apiKey;
    this.bookingLink = bookingLink;
  }

  getBookingLink(): string {
    return this.bookingLink;
  }

  async getCurrentUser(): Promise<any> {
    const response = await fetch(`${CALENDLY_BASE_URL}/users/me`, {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.status}`);
    }

    return response.json();
  }

  async getScheduledEvents(params: {
    status?: string;
    min_start_time?: string;
    max_start_time?: string;
  }): Promise<any[]> {
    const user = await this.getCurrentUser();
    const userUri = user.resource.uri;

    const queryParams = new URLSearchParams();
    queryParams.append("user", userUri);
    if (params.status) queryParams.append("status", params.status);
    if (params.min_start_time) queryParams.append("min_start_time", params.min_start_time);
    if (params.max_start_time) queryParams.append("max_start_time", params.max_start_time);

    const response = await fetch(`${CALENDLY_BASE_URL}/scheduled_events?${queryParams}`, {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get events: ${response.status}`);
    }

    const data = await response.json();
    return data.collection || [];
  }
}

