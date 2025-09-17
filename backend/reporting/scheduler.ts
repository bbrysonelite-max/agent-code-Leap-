import { api, CronJob } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "./db";
import { 
  ScheduledReportJob, 
  ReportSubscription,
  ReportData,
  ExportRequest 
} from "./types";
import { generateReportData } from "./report_generator";
import { exportReport } from "./exports";

// Cron job that runs every hour to check for scheduled reports
export const processScheduledReports = new CronJob("process-scheduled-reports", {
  title: "Process Scheduled Reports",
  every: "1h",
  endpoint: processScheduledReportsHandler,
});

async function processScheduledReportsHandler(): Promise<void> {
  console.log("Processing scheduled reports...");

  // Get all scheduled reports that need to run
  const scheduledJobs = await db.queryAll`
    SELECT srj.*, r.name as report_name, r.type, r.config, r.filters, r.user_id
    FROM scheduled_report_jobs srj
    JOIN reports r ON srj.report_id = r.id
    WHERE srj.is_active = true 
    AND srj.next_run_at <= NOW()
    ORDER BY srj.next_run_at ASC
  `;

  console.log(`Found ${scheduledJobs.length} scheduled reports to process`);

  for (const job of scheduledJobs) {
    try {
      await processScheduledReport(job);
    } catch (error) {
      console.error(`Failed to process scheduled report ${job.id}:`, error);
      
      // Log the error
      await db.queryAll`
        INSERT INTO audit_logs (user_id, action, resource_type, details, status)
        VALUES (${job.user_id}, 'scheduled_report_failed', 'report', 
                ${JSON.stringify({ job_id: job.id, error: error.message })}, 'error')
      `;
    }
  }
}

async function processScheduledReport(job: any): Promise<void> {
  const startTime = Date.now();
  
  console.log(`Processing scheduled report: ${job.report_name} (${job.id})`);

  try {
    // Generate the report
    const reportConfig = {
      id: job.report_id,
      user_id: job.user_id,
      name: job.report_name,
      type: job.type,
      config: JSON.parse(job.config as string),
      filters: JSON.parse(job.filters as string),
      created_at: new Date(),
      updated_at: new Date()
    };

    const reportData = await generateReportData(reportConfig);

    // Get all subscriptions for this report
    const subscriptions = await db.queryAll`
      SELECT * FROM report_subscriptions
      WHERE report_id = ${job.report_id} AND is_active = true
    `;

    // Generate exports for each unique format requested
    const formatsToGenerate = [...new Set(subscriptions.map(sub => sub.format))];
    const exportResults: { [format: string]: any } = {};

    for (const format of formatsToGenerate) {
      if (format !== 'email_summary') {
        const exportRequest: ExportRequest = {
          report_id: job.report_id,
          format: format as 'pdf' | 'excel',
          options: {
            include_charts: true,
            include_raw_data: true
          }
        };

        exportResults[format] = await exportReport(exportRequest, reportData);
      }
    }

    // Send notifications to all subscribers
    for (const subscription of subscriptions) {
      await sendReportNotification(subscription, reportData, exportResults[subscription.format]);
    }

    // Update last run time and calculate next run time
    const nextRunTime = calculateNextRunTime(job.cron_expression);
    
    await db.queryAll`
      UPDATE scheduled_report_jobs
      SET last_run_at = NOW(),
          next_run_at = ${nextRunTime}
      WHERE id = ${job.id}
    `;

    const executionTime = Date.now() - startTime;
    
    // Log successful execution
    await db.queryAll`
      INSERT INTO audit_logs (user_id, action, resource_type, details, status)
      VALUES (${job.user_id}, 'scheduled_report_completed', 'report', 
              ${JSON.stringify({ 
                job_id: job.id, 
                execution_time_ms: executionTime,
                subscriptions_notified: subscriptions.length 
              })}, 'success')
    `;

    console.log(`Scheduled report ${job.id} processed successfully in ${executionTime}ms`);

  } catch (error) {
    console.error(`Error processing scheduled report ${job.id}:`, error);
    throw error;
  }
}

async function sendReportNotification(
  subscription: any, 
  reportData: ReportData, 
  exportResult?: any
): Promise<void> {
  const { email, format } = subscription;

  if (format === 'email_summary') {
    // Send email summary
    await sendEmailSummary(email, reportData);
  } else {
    // Send email with attachment
    await sendEmailWithAttachment(email, reportData, exportResult, format);
  }
}

async function sendEmailSummary(email: string, reportData: ReportData): Promise<void> {
  const summaryHtml = generateEmailSummaryHtml(reportData);
  
  // In a real implementation, you would use your email service
  console.log(`Sending email summary to ${email}`);
  console.log("Summary HTML:", summaryHtml);
  
  // Mock email sending - replace with actual email service integration
  // await emailService.send({
  //   to: email,
  //   subject: `Report Summary - ${reportData.metadata.report_id}`,
  //   html: summaryHtml
  // });
}

async function sendEmailWithAttachment(
  email: string, 
  reportData: ReportData, 
  exportResult: any, 
  format: string
): Promise<void> {
  console.log(`Sending ${format} report to ${email}`);
  
  // Mock email sending with attachment
  // await emailService.send({
  //   to: email,
  //   subject: `Scheduled Report - ${reportData.metadata.report_id}`,
  //   text: `Please find your scheduled report attached.`,
  //   attachments: [{
  //     filename: `report.${format}`,
  //     path: exportResult.file_path,
  //     contentType: exportResult.mime_type
  //   }]
  // });
}

function generateEmailSummaryHtml(reportData: ReportData): string {
  const { summary, charts, metadata } = reportData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Report Summary</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .summary-card { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; }
        .summary-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .summary-label { color: #64748b; font-size: 14px; }
        .charts-section { margin-top: 30px; }
        .chart-item { margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Report Summary</h1>
        <p>Generated on: ${metadata.generated_at.toLocaleString()}</p>
        <p>Report ID: ${metadata.report_id}</p>
        <p>Total Records: ${metadata.total_records}</p>
      </div>
      
      <div class="summary-grid">
        ${Object.entries(summary).map(([key, value]) => `
          <div class="summary-card">
            <div class="summary-value">${formatValue(value)}</div>
            <div class="summary-label">${formatLabel(key)}</div>
          </div>
        `).join('')}
      </div>
      
      ${charts && charts.length > 0 ? `
        <div class="charts-section">
          <h2>Key Insights</h2>
          ${charts.map(chart => `
            <div class="chart-item">
              <h3>${chart.title}</h3>
              <p>Chart Type: ${chart.type}</p>
              <p>Data Points: ${chart.data.length}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
        This is an automated report. For detailed analysis, please access your dashboard.
      </div>
    </body>
    </html>
  `;
}

function calculateNextRunTime(cronExpression: string): Date {
  // Simple cron parser for basic expressions
  // In production, you'd use a proper cron library like node-cron
  
  const now = new Date();
  const nextRun = new Date(now);

  // Parse basic cron expressions (minute hour day month dayOfWeek)
  const parts = cronExpression.split(' ');
  
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression');
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Simple daily schedule (0 9 * * *) - 9 AM every day
  if (minute === '0' && hour === '9' && day === '*' && month === '*' && dayOfWeek === '*') {
    nextRun.setHours(9, 0, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    return nextRun;
  }

  // Weekly schedule (0 9 * * 1) - 9 AM every Monday
  if (minute === '0' && hour === '9' && day === '*' && month === '*' && dayOfWeek === '1') {
    nextRun.setHours(9, 0, 0, 0);
    const daysUntilMonday = (1 + 7 - nextRun.getDay()) % 7;
    if (daysUntilMonday === 0 && nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 7);
    } else {
      nextRun.setDate(nextRun.getDate() + daysUntilMonday);
    }
    return nextRun;
  }

  // Monthly schedule (0 9 1 * *) - 9 AM on 1st of every month
  if (minute === '0' && hour === '9' && day === '1' && month === '*' && dayOfWeek === '*') {
    nextRun.setHours(9, 0, 0, 0);
    nextRun.setDate(1);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
    return nextRun;
  }

  // Default: add 1 hour
  nextRun.setHours(nextRun.getHours() + 1);
  return nextRun;
}

// API endpoints for managing scheduled reports

export const createScheduledReport = api(
  { method: "POST", path: "/reports/:reportId/schedule", auth: true, expose: true },
  async ({ reportId, ...request }: {
    reportId: string;
    cron_expression: string;
    notification_emails: string[];
  }): Promise<ScheduledReportJob> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    // Verify user owns the report
    const report = await db.queryRow`
      SELECT * FROM reports 
      WHERE id = ${reportId} AND user_id = ${userID}
    `;

    if (!report) {
      throw new Error("Report not found or access denied");
    }

    // Validate cron expression
    const nextRunTime = calculateNextRunTime(request.cron_expression);

    const result = await db.queryRow`
      INSERT INTO scheduled_report_jobs (report_id, cron_expression, next_run_at, notification_emails)
      VALUES (${reportId}, ${request.cron_expression}, ${nextRunTime}, ${request.notification_emails})
      RETURNING *
    `;

    return result;
  }
);

export const listScheduledReports = api(
  { method: "GET", path: "/reports/scheduled", auth: true, expose: true },
  async (): Promise<{ scheduled_jobs: ScheduledReportJob[] }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    const results = await db.queryAll`
      SELECT srj.*, r.name as report_name
      FROM scheduled_report_jobs srj
      JOIN reports r ON srj.report_id = r.id
      WHERE r.user_id = ${userID}
      ORDER BY srj.next_run_at ASC
    `;

    return { scheduled_jobs: results };
  }
);

export const updateScheduledReport = api(
  { method: "PUT", path: "/reports/scheduled/:jobId", auth: true, expose: true },
  async ({ jobId, ...request }: {
    jobId: string;
    cron_expression?: string;
    notification_emails?: string[];
    is_active?: boolean;
  }): Promise<ScheduledReportJob> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    // Verify user owns the scheduled job
    const job = await db.queryRow`
      SELECT srj.* FROM scheduled_report_jobs srj
      JOIN reports r ON srj.report_id = r.id
      WHERE srj.id = ${jobId} AND r.user_id = ${userID}
    `;

    if (!job) {
      throw new Error("Scheduled job not found or access denied");
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (request.cron_expression !== undefined) {
      const nextRunTime = calculateNextRunTime(request.cron_expression);
      updates.push(`cron_expression = $${values.length + 1}`);
      values.push(request.cron_expression);
      updates.push(`next_run_at = $${values.length + 1}`);
      values.push(nextRunTime);
    }

    if (request.notification_emails !== undefined) {
      updates.push(`notification_emails = $${values.length + 1}`);
      values.push(request.notification_emails);
    }

    if (request.is_active !== undefined) {
      updates.push(`is_active = $${values.length + 1}`);
      values.push(request.is_active);
    }

    updates.push(`updated_at = NOW()`);
    values.push(jobId);

    const query = `
      UPDATE scheduled_report_jobs 
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result = await db.rawQueryRow(query, ...values);
    return result;
  }
);

export const deleteScheduledReport = api(
  { method: "DELETE", path: "/reports/scheduled/:jobId", auth: true, expose: true },
  async ({ jobId }: { jobId: string }): Promise<{ success: boolean }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    await db.queryAll`
      DELETE FROM scheduled_report_jobs
      WHERE id = ${jobId} 
      AND report_id IN (SELECT id FROM reports WHERE user_id = ${userID})
    `;

    return { success: true };
  }
);

export const createReportSubscription = api(
  { method: "POST", path: "/reports/:reportId/subscribe", auth: true, expose: true },
  async ({ reportId, ...request }: {
    reportId: string;
    email: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    format: 'pdf' | 'excel' | 'email_summary';
  }): Promise<ReportSubscription> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    // Verify user owns the report
    const report = await db.queryRow`
      SELECT * FROM reports 
      WHERE id = ${reportId} AND user_id = ${userID}
    `;

    if (!report) {
      throw new Error("Report not found or access denied");
    }

    const result = await db.queryRow`
      INSERT INTO report_subscriptions (report_id, user_id, email, frequency, format)
      VALUES (${reportId}, ${userID}, ${request.email}, ${request.frequency}, ${request.format})
      RETURNING *
    `;

    return result;
  }
);

// Helper functions
function formatValue(value: any): string {
  if (typeof value === 'number') {
    if (value % 1 === 0) {
      return value.toLocaleString();
    } else {
      return value.toFixed(2);
    }
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  return String(value || '');
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}