// Calendly Integration
// Part of AI Lead OS - DOCK MODULE
import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { CRM } from "../../ai_crm/db";

// Calendly API Key - set via: encore secret set CalendlyApiKey
const calendlyApiKey = secret("CalendlyApiKey");
// Your Calendly scheduling link
const calendlyLink = secret("CalendlyLink");

const CALENDLY_API_URL = "https://api.calendly.com";

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  scheduling_url: string;
  timezone: string;
}

export interface CalendlyEvent {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  end_time: string;
  event_type: string;
  location?: {
    type: string;
    location?: string;
    join_url?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: "active" | "canceled";
  questions_and_answers?: Array<{
    question: string;
    answer: string;
  }>;
  timezone: string;
  created_at: string;
  updated_at: string;
  canceled?: boolean;
  cancellation?: {
    canceled_by: string;
    reason?: string;
  };
}

/**
 * Calendly API Client
 */
export class CalendlyClient {
  private _apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this._apiKey = apiKey;
    this.baseUrl = CALENDLY_API_URL;
  }

  private get apiKey(): string {
    if (!this._apiKey) {
      this._apiKey = calendlyApiKey();
    }
    return this._apiKey;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<CalendlyUser> {
    const response = await fetch(`${this.baseUrl}/users/me`, {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.status}`);
    }

    const data = await response.json();
    return data.resource;
  }

  /**
   * Get scheduled events
   */
  async getScheduledEvents(options?: {
    status?: "active" | "canceled";
    min_start_time?: string;
    max_start_time?: string;
    count?: number;
  }): Promise<CalendlyEvent[]> {
    const user = await this.getCurrentUser();
    
    const params = new URLSearchParams({
      user: user.uri,
      status: options?.status || "active",
      count: String(options?.count || 50),
    });

    if (options?.min_start_time) {
      params.set("min_start_time", options.min_start_time);
    }
    if (options?.max_start_time) {
      params.set("max_start_time", options.max_start_time);
    }

    const response = await fetch(`${this.baseUrl}/scheduled_events?${params}`, {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.status}`);
    }

    const data = await response.json();
    return data.collection;
  }

  /**
   * Get invitees for an event
   */
  async getEventInvitees(eventUri: string): Promise<CalendlyInvitee[]> {
    const eventUuid = eventUri.split("/").pop();
    
    const response = await fetch(`${this.baseUrl}/scheduled_events/${eventUuid}/invitees`, {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.status}`);
    }

    const data = await response.json();
    return data.collection;
  }
}

// Export lazy singleton getter
let _calendlyClient: CalendlyClient | null = null;
export const calendlyClient = {
  get instance(): CalendlyClient {
    if (!_calendlyClient) {
      _calendlyClient = new CalendlyClient();
    }
    return _calendlyClient;
  },
  getCurrentUser: () => calendlyClient.instance.getCurrentUser(),
  getScheduledEvents: (options?: any) => calendlyClient.instance.getScheduledEvents(options),
  getEventInvitees: (eventUri: string) => calendlyClient.instance.getEventInvitees(eventUri),
};

/**
 * Get your Calendly booking link
 */
export const getBookingLink = api<{}, { link: string }>(
  { method: "GET", path: "/calendly/link", expose: true },
  async () => {
    try {
      return { link: calendlyLink() };
    } catch {
      // Fallback if secret not set
      return { link: "https://calendly.com/bbrysonelite/30min" };
    }
  }
);

/**
 * Get upcoming meetings
 */
export const getUpcomingMeetings = api<{ days?: number }, { meetings: any[] }>(
  { method: "GET", path: "/calendly/meetings", expose: true },
  async (req) => {
    try {
      const client = new CalendlyClient();
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + (req.days || 7));

      const events = await client.getScheduledEvents({
        status: "active",
        min_start_time: now.toISOString(),
        max_start_time: future.toISOString(),
      });

      // Enrich with invitee data
      const meetings = await Promise.all(
        events.map(async (event) => {
          const invitees = await client.getEventInvitees(event.uri);
          return {
            ...event,
            invitees,
          };
        })
      );

      return { meetings };
    } catch (error) {
      console.error("Failed to fetch Calendly meetings:", error);
      return { meetings: [] };
    }
  }
);

/**
 * Sync Calendly meetings to our CRM
 */
export const syncMeetings = api<{}, { synced: number }>(
  { method: "POST", path: "/calendly/sync", expose: true },
  async () => {
    try {
      const client = new CalendlyClient();
      const now = new Date();
      const past = new Date();
      past.setDate(past.getDate() - 30); // Last 30 days

      const events = await client.getScheduledEvents({
        min_start_time: past.toISOString(),
        max_start_time: now.toISOString(),
      });

      let synced = 0;

      for (const event of events) {
        const invitees = await client.getEventInvitees(event.uri);
        
        for (const invitee of invitees) {
          // Find lead by email
          const lead = await CRM.queryRow<{ id: string }>`
            SELECT id FROM leads WHERE email = ${invitee.email}
          `;

          if (lead) {
            // Update lead with meeting info
            await CRM.exec`
              UPDATE leads SET 
                status = 'qualified',
                notes = CONCAT(COALESCE(notes, ''), '\n[MEETING BOOKED] ', ${event.name}, ' at ', ${event.start_time}),
                last_activity_at = ${event.start_time},
                updated_at = NOW()
              WHERE id = ${lead.id}
            `;

            // Create activity record
            await CRM.exec`
              INSERT INTO activities (lead_id, type, subject, description, scheduled_at, completed_at)
              VALUES (
                ${lead.id}, 
                'meeting', 
                ${event.name}, 
                ${'Calendly meeting: ' + (event.location?.join_url || 'TBD')},
                ${event.start_time},
                ${event.status === 'canceled' ? null : event.end_time}
              )
              ON CONFLICT DO NOTHING
            `;

            synced++;
          }
        }
      }

      return { synced };
    } catch (error) {
      console.error("Failed to sync Calendly meetings:", error);
      return { synced: 0 };
    }
  }
);
