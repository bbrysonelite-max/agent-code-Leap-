import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db, Dashboard } from "./db";
import { CreateDashboardRequest, UpdateDashboardRequest, DashboardListResponse } from "./types";

export const createDashboard = api(
  { method: "POST", path: "/dashboards", auth: true, expose: true },
  async (req: CreateDashboardRequest): Promise<Dashboard> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const result = await db.queryAllRow`
      INSERT INTO dashboards (user_id, name, description, layout, is_default, is_public)
      VALUES (${userID}, ${req.name}, ${req.description || null}, ${JSON.stringify(req.layout || [])}, 
              ${req.is_default || false}, ${req.is_public || false})
      RETURNING *
    `;
    
    return {
      ...result,
      layout: JSON.parse(result.layout as string)
    };
  }
);

export const listDashboards = api(
  { method: "GET", path: "/dashboards", auth: true, expose: true },
  async (): Promise<DashboardListResponse> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const results = await db.queryAll`
      SELECT * FROM dashboards 
      WHERE user_id = ${userID} OR is_public = true
      ORDER BY is_default DESC, created_at DESC
    `;
    
    const dashboards = results.map(row => ({
      ...row,
      layout: JSON.parse(row.layout as string)
    }));
    
    return { dashboards };
  }
);

export const getDashboard = api(
  { method: "GET", path: "/dashboards/:id", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<Dashboard> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const result = await db.queryAllRow`
      SELECT * FROM dashboards 
      WHERE id = ${id} AND (user_id = ${userID} OR is_public = true)
    `;
    
    if (!result) {
      throw new Error("Dashboard not found");
    }
    
    return {
      ...result,
      layout: JSON.parse(result.layout as string)
    };
  }
);

export const updateDashboard = api(
  { method: "PUT", path: "/dashboards/:id", auth: true, expose: true },
  async ({ id, ...req }: { id: string } & UpdateDashboardRequest): Promise<Dashboard> => {
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
    if (req.layout !== undefined) {
      updates.push(`layout = $${values.length + 1}`);
      values.push(JSON.stringify(req.layout));
    }
    if (req.is_default !== undefined) {
      updates.push(`is_default = $${values.length + 1}`);
      values.push(req.is_default);
    }
    if (req.is_public !== undefined) {
      updates.push(`is_public = $${values.length + 1}`);
      values.push(req.is_public);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id, userID);
    
    const query = `
      UPDATE dashboards 
      SET ${updates.join(', ')}
      WHERE id = $${values.length - 1} AND user_id = $${values.length}
      RETURNING *
    `;
    
    const result = await db.rawQueryRow(query, ...values);
    
    if (!result) {
      throw new Error("Dashboard not found or access denied");
    }
    
    return {
      ...result,
      layout: JSON.parse(result.layout as string)
    };
  }
);

export const removeDashboard = api(
  { method: "DELETE", path: "/dashboards/:id", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const result = await db.queryAll`
      DELETE FROM dashboards 
      WHERE id = ${id} AND user_id = ${userID}
    `;
    
    return { success: true };
  }
);