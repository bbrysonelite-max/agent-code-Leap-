import { api, CronJob } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db, Report, ReportExecution } from "./db";
import { generateReportData } from "./report_generator";
import { exportReport } from "./exports";
import { ReportListResponse, ReportExecutionListResponse } from "./types";

// Run every hour to check for scheduled reports
export const checkScheduledReports = new CronJob("check-scheduled-reports", {
  title: "Check Scheduled Reports",
  schedule: "0 * * * *", // Every hour
  endpoint: processScheduledReports,
});

async function processScheduledReports(): Promise<void> {
  console.log("Checking for scheduled reports...");
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentDate = now.getDate();
  
  // Get all scheduled reports
  const scheduledReports = await db.query`
    SELECT * FROM reports 
    WHERE is_scheduled = true
  `;
  
  for (const report of scheduledReports) {
    const scheduleConfig = JSON.parse(report.schedule_config as string);
    
    if (!scheduleConfig?.enabled) {
      continue;
    }
    
    const shouldRun = checkIfShouldRun(scheduleConfig, now, currentHour, currentDay, currentDate);
    
    if (shouldRun) {
      console.log(`Generating scheduled report: ${report.name} (${report.id})`);
      await generateScheduledReport(report);
    }
  }
}

function checkIfShouldRun(
  config: any, 
  now: Date, 
  currentHour: number, 
  currentDay: number, 
  currentDate: number
): boolean {
  const [scheduleHour, scheduleMinute] = config.time.split(':').map(Number);
  
  // Check if we're at the right hour (within the current hour window)
  if (currentHour !== scheduleHour) {
    return false;
  }
  
  switch (config.frequency) {
    case 'daily':
      return true;
      
    case 'weekly':
      // Run on the same day of week (default to Monday if not specified)
      const targetDay = config.day_of_week || 1;
      return currentDay === targetDay;
      
    case 'monthly':
      // Run on the same day of month (default to 1st if not specified)
      const targetDate = config.day_of_month || 1;
      return currentDate === targetDate;
      
    case 'quarterly':
      // Run on the 1st day of quarter months (Jan, Apr, Jul, Oct)
      const quarterMonths = [0, 3, 6, 9]; // 0-indexed months
      const currentMonth = now.getMonth();
      return quarterMonths.includes(currentMonth) && currentDate === 1;
      
    default:
      return false;
  }
}

async function generateScheduledReport(report: Report): Promise<void> {
  try {
    // Create execution record
    const execution = await db.queryRow`
      INSERT INTO report_executions (report_id, status, format)
      VALUES (${report.id}, 'running', ${JSON.parse(report.schedule_config as string).format})
      RETURNING *
    `;
    
    const startTime = Date.now();
    
    // Generate report data
    const reportConfig = {
      ...report,
      config: JSON.parse(report.config as string),
      filters: JSON.parse(report.filters as string)
    };
    
    const reportData = await generateReportData(reportConfig);
    reportData.metadata.report_id = report.id;
    
    // Export report in requested format
    const scheduleConfig = JSON.parse(report.schedule_config as string);
    const exportResult = await exportReport({
      report_id: report.id,
      format: scheduleConfig.format,
      options: {
        include_charts: true,
        include_raw_data: true
      }
    }, reportData);
    
    const executionTime = Date.now() - startTime;
    
    // Update execution record
    await db.query`
      UPDATE report_executions 
      SET status = 'completed', 
          file_path = ${exportResult.file_path},
          file_size = ${exportResult.file_size},
          execution_time_ms = ${executionTime},
          completed_at = NOW()
      WHERE id = ${execution.id}
    `;
    
    // Update report last generated timestamp
    await db.query`
      UPDATE reports 
      SET last_generated_at = NOW()
      WHERE id = ${report.id}
    `;
    
    // Send email notifications if configured
    if (scheduleConfig.recipients?.length > 0) {
      await sendReportNotification(report, exportResult, scheduleConfig.recipients);
    }
    
    console.log(`Successfully generated scheduled report: ${report.name}`);
    
  } catch (error) {
    console.error(`Failed to generate scheduled report ${report.name}:`, error);
    
    // Update execution record with error
    await db.query`
      UPDATE report_executions 
      SET status = 'failed', 
          error_message = ${error.message},
          completed_at = NOW()
      WHERE report_id = ${report.id} AND status = 'running'
    `;
  }
}

async function sendReportNotification(
  report: Report, 
  exportResult: any, 
  recipients: string[]
): Promise<void> {
  // This would integrate with the email service to send notifications
  // For now, just log the notification
  console.log(`Would send report notification for ${report.name} to:`, recipients);
  console.log(`File path: ${exportResult.file_path}`);
}

export const getScheduledReports = api(
  { method: "GET", path: "/reports/scheduled", auth: true, expose: true },
  async (): Promise<ReportListResponse> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const results = await db.query`
      SELECT * FROM reports 
      WHERE user_id = ${userID} AND is_scheduled = true
      ORDER BY created_at DESC
    `;
    
    const reports = results.map(row => ({
      ...row,
      config: JSON.parse(row.config as string),
      filters: JSON.parse(row.filters as string),
      schedule_config: row.schedule_config ? JSON.parse(row.schedule_config as string) : null
    }));
    
    return { reports };
  }
);

export const getReportExecutions = api(
  { method: "GET", path: "/reports/:id/executions", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<ReportExecutionListResponse> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the report
    const report = await db.queryRow`
      SELECT id FROM reports 
      WHERE id = ${id} AND user_id = ${userID}
    `;
    
    if (!report) {
      throw new Error("Report not found or access denied");
    }
    
    const results = await db.query`
      SELECT * FROM report_executions 
      WHERE report_id = ${id}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    return { executions: results };
  }
);

export const toggleReportSchedule = api(
  { method: "POST", path: "/reports/:id/toggle-schedule", auth: true, expose: true },
  async ({ id, enabled }: { id: string; enabled: boolean }): Promise<{ success: boolean }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    await db.query`
      UPDATE reports 
      SET schedule_config = jsonb_set(
        COALESCE(schedule_config, '{}'),
        '{enabled}',
        ${JSON.stringify(enabled)}
      )
      WHERE id = ${id} AND user_id = ${userID}
    `;
    
    return { success: true };
  }
);