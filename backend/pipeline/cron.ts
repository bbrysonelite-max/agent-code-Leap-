// AI Lead OS Scheduled Tasks
// Cron jobs for automated processing
import { Cron } from "encore.dev/cron";
import { runSendProcessor } from "./orchestrator";
import { syncMeetings } from "../integrations/calendly/client";
import log from "encore.dev/log";

/**
 * Process scheduled sends every 5 minutes
 */
export const processSends = new Cron("process-sends", {
  title: "Process Scheduled Sends",
  schedule: "*/5 * * * *", // Every 5 minutes
  endpoint: async () => {
    log.info("⏰ Cron: Processing scheduled sends...");
    const result = await runSendProcessor({});
    log.info("Cron: Sends processed", result);
  },
});

/**
 * Sync Calendly meetings every hour
 */
export const syncCalendly = new Cron("sync-calendly", {
  title: "Sync Calendly Meetings",
  schedule: "0 * * * *", // Every hour
  endpoint: async () => {
    log.info("📅 Cron: Syncing Calendly meetings...");
    try {
      const result = await syncMeetings({});
      log.info("Cron: Calendly synced", result);
    } catch (error) {
      log.warn("Cron: Calendly sync failed", error);
    }
  },
});

