// Integrations API Endpoints
// Part of AI Lead OS - Consolidated API for all integrations
import { api } from "encore.dev/api";
import { apolloClient } from "./apollo/client";
import { brevoClient } from "./brevo/client";
import { twilioClient, TwilioClient } from "./twilio/client";
import { calendlyClient, getBookingLink } from "./calendly/client";
import { ApolloSearchPeopleRequest } from "./apollo/types";

// Re-export webhook handlers
export { handleBrevoWebhook, handleInboundEmail } from "./brevo/webhooks";
export { handleTwilioStatus, handleInboundSMS } from "./twilio/webhooks";
export { handleCalendlyWebhook, generateTrackingLink } from "./calendly/webhooks";
export { searchAndImportProspects } from "./apollo/search";

// ============================================
// APOLLO API
// ============================================

export const searchApolloProspects = api<ApolloSearchPeopleRequest, { people: any[]; total: number }>(
  { method: "POST", path: "/integrations/apollo/search", expose: true },
  async (req) => {
    const response = await apolloClient.searchPeople(req);
    return {
      people: response.people,
      total: response.pagination.total_entries,
    };
  }
);

// ============================================
// BREVO (EMAIL) API
// ============================================

export const sendEmail = api<{
  to: { email: string; name?: string };
  subject: string;
  htmlContent: string;
  textContent?: string;
}, { messageId: string }>(
  { method: "POST", path: "/integrations/brevo/send", expose: true },
  async (req) => {
    const response = await brevoClient.sendEmail({
      to: [req.to],
      subject: req.subject,
      htmlContent: req.htmlContent,
      textContent: req.textContent,
    });
    return { messageId: response.messageId };
  }
);

export const getEmailStats = api<{ days?: number }, { stats: any }>(
  { method: "GET", path: "/integrations/brevo/stats", expose: true },
  async (req) => {
    const stats = await brevoClient.getStatistics(req.days || 7);
    return { stats };
  }
);

// ============================================
// TWILIO (SMS) API
// ============================================

export const sendSMS = api<{
  to: string;
  body: string;
}, { sid: string; status: string }>(
  { method: "POST", path: "/integrations/twilio/send", expose: true },
  async (req) => {
    if (!TwilioClient.isValidPhoneNumber(req.to)) {
      throw new Error("Invalid phone number format");
    }
    const response = await twilioClient.sendSMS(req);
    return { sid: response.sid, status: response.status };
  }
);

export const getSMSStatus = api<{ sid: string }, { message: any }>(
  { method: "GET", path: "/integrations/twilio/status/:sid", expose: true },
  async (req) => {
    const message = await twilioClient.getMessageStatus(req.sid);
    return { message };
  }
);

// ============================================
// CALENDLY API
// ============================================

export const getCalendlyLink = api<{}, { link: string }>(
  { method: "GET", path: "/integrations/calendly/link", expose: true },
  async () => {
    return getBookingLink({});
  }
);

export const getCalendlyMeetings = api<{ days?: number }, { meetings: any[] }>(
  { method: "GET", path: "/integrations/calendly/meetings", expose: true },
  async (req) => {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + (req.days || 7));

    try {
      const events = await calendlyClient.getScheduledEvents({
        status: "active",
        min_start_time: now.toISOString(),
        max_start_time: future.toISOString(),
      });

      return { meetings: events };
    } catch (error) {
      console.error("Failed to fetch Calendly meetings:", error);
      return { meetings: [] };
    }
  }
);

// ============================================
// HEALTH CHECK
// ============================================

export const checkIntegrations = api<{}, { integrations: Record<string, { status: string; message?: string }> }>(
  { method: "GET", path: "/integrations/health", expose: true },
  async () => {
    const integrations: Record<string, { status: string; message?: string }> = {};

    // Check Apollo
    try {
      await apolloClient.searchPeople({ per_page: 1 });
      integrations.apollo = { status: "connected" };
    } catch (error) {
      integrations.apollo = { status: "error", message: (error as Error).message };
    }

    // Check Brevo
    try {
      await brevoClient.getStatistics(1);
      integrations.brevo = { status: "connected" };
    } catch (error) {
      integrations.brevo = { status: "error", message: (error as Error).message };
    }

    // Check Twilio
    try {
      await twilioClient.getRecentMessages(1);
      integrations.twilio = { status: "connected" };
    } catch (error) {
      integrations.twilio = { status: "error", message: (error as Error).message };
    }

    // Check Calendly
    try {
      await calendlyClient.getCurrentUser();
      integrations.calendly = { status: "connected" };
    } catch (error) {
      integrations.calendly = { status: "error", message: (error as Error).message };
    }

    return { integrations };
  }
);

