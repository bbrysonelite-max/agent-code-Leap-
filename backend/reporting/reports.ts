import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db, Report } from "./db";
import { CreateReportRequest, UpdateReportRequest, ReportData, ReportListResponse } from "./types";
import { generateReportData } from "./report_generator";

export const createReport = api(
  { method: "POST", path: "/reports", auth: true, expose: true },
  async (req: CreateReportRequest): Promise<Report> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const result = await db.queryRow`
      INSERT INTO reports (user_id, name, description, type, config, filters, schedule_config, is_scheduled)
      VALUES (${userID}, ${req.name}, ${req.description || null}, ${req.type}, 
              ${JSON.stringify(req.config)}, ${JSON.stringify(req.filters || {})},
              ${JSON.stringify(req.schedule_config || null)}, ${!!req.schedule_config})
      RETURNING *
    `;
    
    return {
      ...result,
      config: JSON.parse(result.config as string),
      filters: JSON.parse(result.filters as string),
      schedule_config: result.schedule_config ? JSON.parse(result.schedule_config as string) : null
    };
  }
);

export const listReports = api(
  { method: "GET", path: "/reports", auth: true, expose: true },
  async (): Promise<ReportListResponse> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const results = await db.query`
      SELECT * FROM reports 
      WHERE user_id = ${userID}
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

export const getReport = api(
  { method: "GET", path: "/reports/:id", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<Report> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const result = await db.queryRow`
      SELECT * FROM reports 
      WHERE id = ${id} AND user_id = ${userID}
    `;
    
    if (!result) {
      throw new Error("Report not found");
    }
    
    return {
      ...result,
      config: JSON.parse(result.config as string),
      filters: JSON.parse(result.filters as string),
      schedule_config: result.schedule_config ? JSON.parse(result.schedule_config as string) : null
    };
  }
);

export const updateReport = api(
  { method: "PUT", path: "/reports/:id", auth: true, expose: true },
  async ({ id, ...req }: { id: string } & UpdateReportRequest): Promise<Report> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (req.name !== undefined) {
      updates.push(`name = $${values.length + 1}`);
      values.push(req.name);
    }
    if (req.description !== undefined) {
      updates.push(`description = $${values.length + 1}`);
      values.push(req.description);
    }
    if (req.config !== undefined) {
      updates.push(`config = $${values.length + 1}`);
      values.push(JSON.stringify(req.config));
    }
    if (req.filters !== undefined) {
      updates.push(`filters = $${values.length + 1}`);
      values.push(JSON.stringify(req.filters));
    }
    if (req.schedule_config !== undefined) {
      updates.push(`schedule_config = $${values.length + 1}`);
      values.push(JSON.stringify(req.schedule_config));
      updates.push(`is_scheduled = $${values.length + 1}`);
      values.push(!!req.schedule_config);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id, userID);
    
    const query = `
      UPDATE reports 
      SET ${updates.join(', ')}
      WHERE id = $${values.length - 1} AND user_id = $${values.length}
      RETURNING *
    `;
    
    const result = await db.rawQueryRow(query, ...values);
    
    if (!result) {
      throw new Error("Report not found or access denied");
    }
    
    return {
      ...result,
      config: JSON.parse(result.config as string),
      filters: JSON.parse(result.filters as string),
      schedule_config: result.schedule_config ? JSON.parse(result.schedule_config as string) : null
    };
  }
);

export const generateReport = api(
  { method: "POST", path: "/reports/:id/generate", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<ReportData> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const report = await db.queryRow`
      SELECT * FROM reports 
      WHERE id = ${id} AND user_id = ${userID}
    `;
    
    if (!report) {
      throw new Error("Report not found");
    }
    
    const reportConfig = {
      ...report,
      config: JSON.parse(report.config as string),
      filters: JSON.parse(report.filters as string)
    };
    
    const reportData = await generateReportData(reportConfig);
    
    await db.query`
      UPDATE reports 
      SET last_generated_at = NOW()
      WHERE id = ${id}
    `;
    
    return reportData;
  }
);

export const removeReport = api(
  { method: "DELETE", path: "/reports/:id", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    await db.query`
      DELETE FROM reports 
      WHERE id = ${id} AND user_id = ${userID}
    `;
    
    return { success: true };
  }
);