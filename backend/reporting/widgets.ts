import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db, DashboardWidget } from "./db";
import { CreateWidgetRequest, UpdateWidgetRequest, WidgetDataResponse, WidgetListResponse } from "./types";

export const createWidget = api(
  { method: "POST", path: "/widgets", auth: true, expose: true },
  async (req: CreateWidgetRequest): Promise<DashboardWidget> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the dashboard
    const dashboard = await db.queryRow`
      SELECT id FROM dashboards 
      WHERE id = ${req.dashboard_id} AND user_id = ${userID}
    `;
    
    if (!dashboard) {
      throw new Error("Dashboard not found or access denied");
    }
    
    const result = await db.queryRow`
      INSERT INTO dashboard_widgets (
        dashboard_id, widget_type, title, config, data_source,
        position_x, position_y, width, height
      )
      VALUES (
        ${req.dashboard_id}, ${req.widget_type}, ${req.title}, 
        ${JSON.stringify(req.config)}, ${req.data_source},
        ${req.position_x || 0}, ${req.position_y || 0}, 
        ${req.width || 4}, ${req.height || 3}
      )
      RETURNING *
    `;
    
    return {
      ...result,
      config: JSON.parse(result.config as string)
    };
  }
);

export const listWidgets = api(
  { method: "GET", path: "/widgets/dashboard/:dashboardId", auth: true, expose: true },
  async ({ dashboardId }: { dashboardId: string }): Promise<WidgetListResponse> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user has access to the dashboard
    const dashboard = await db.queryRow`
      SELECT id FROM dashboards 
      WHERE id = ${dashboardId} AND (user_id = ${userID} OR is_public = true)
    `;
    
    if (!dashboard) {
      throw new Error("Dashboard not found or access denied");
    }
    
    const results = await db.query`
      SELECT * FROM dashboard_widgets 
      WHERE dashboard_id = ${dashboardId}
      ORDER BY position_y, position_x
    `;
    
    const widgets = results.map(row => ({
      ...row,
      config: JSON.parse(row.config as string)
    }));
    
    return { widgets };
  }
);

export const getWidget = api(
  { method: "GET", path: "/widgets/:id", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<DashboardWidget> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const result = await db.queryRow`
      SELECT w.*, d.user_id 
      FROM dashboard_widgets w
      JOIN dashboards d ON w.dashboard_id = d.id
      WHERE w.id = ${id} AND (d.user_id = ${userID} OR d.is_public = true)
    `;
    
    if (!result) {
      throw new Error("Widget not found or access denied");
    }
    
    return {
      ...result,
      config: JSON.parse(result.config as string)
    };
  }
);

export const updateWidget = api(
  { method: "PUT", path: "/widgets/:id", auth: true, expose: true },
  async ({ id, ...req }: { id: string } & UpdateWidgetRequest): Promise<DashboardWidget> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the widget's dashboard
    const widget = await db.queryRow`
      SELECT w.*, d.user_id 
      FROM dashboard_widgets w
      JOIN dashboards d ON w.dashboard_id = d.id
      WHERE w.id = ${id} AND d.user_id = ${userID}
    `;
    
    if (!widget) {
      throw new Error("Widget not found or access denied");
    }
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (req.widget_type !== undefined) {
      updates.push(`widget_type = $${values.length + 1}`);
      values.push(req.widget_type);
    }
    if (req.title !== undefined) {
      updates.push(`title = $${values.length + 1}`);
      values.push(req.title);
    }
    if (req.config !== undefined) {
      updates.push(`config = $${values.length + 1}`);
      values.push(JSON.stringify(req.config));
    }
    if (req.data_source !== undefined) {
      updates.push(`data_source = $${values.length + 1}`);
      values.push(req.data_source);
    }
    if (req.position_x !== undefined) {
      updates.push(`position_x = $${values.length + 1}`);
      values.push(req.position_x);
    }
    if (req.position_y !== undefined) {
      updates.push(`position_y = $${values.length + 1}`);
      values.push(req.position_y);
    }
    if (req.width !== undefined) {
      updates.push(`width = $${values.length + 1}`);
      values.push(req.width);
    }
    if (req.height !== undefined) {
      updates.push(`height = $${values.length + 1}`);
      values.push(req.height);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `
      UPDATE dashboard_widgets 
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `;
    
    const result = await db.queryRow(query, ...values);
    
    return {
      ...result,
      config: JSON.parse(result.config as string)
    };
  }
);

export const removeWidget = api(
  { method: "DELETE", path: "/widgets/:id", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the widget's dashboard
    await db.query`
      DELETE FROM dashboard_widgets 
      WHERE id = ${id} AND dashboard_id IN (
        SELECT id FROM dashboards WHERE user_id = ${userID}
      )
    `;
    
    return { success: true };
  }
);

export const getWidgetData = api(
  { method: "POST", path: "/widgets/:id/data", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<WidgetDataResponse> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    const widget = await db.queryRow`
      SELECT w.*, d.user_id 
      FROM dashboard_widgets w
      JOIN dashboards d ON w.dashboard_id = d.id
      WHERE w.id = ${id} AND (d.user_id = ${userID} OR d.is_public = true)
    `;
    
    if (!widget) {
      throw new Error("Widget not found or access denied");
    }
    
    const config = JSON.parse(widget.config as string);
    
    // Generate widget data based on data source and configuration
    return await generateWidgetData(widget.data_source, config);
  }
);

async function generateWidgetData(dataSource: string, config: any): Promise<any> {
  // This would integrate with the report generator to fetch data
  // For now, return mock data structure
  
  const mockData = {
    prospects: [
      { period: '2024-01-01', value: 150, label: 'Total Prospects' },
      { period: '2024-01-02', value: 165, label: 'Total Prospects' },
      { period: '2024-01-03', value: 142, label: 'Total Prospects' }
    ],
    campaigns: [
      { name: 'Campaign A', sent: 1000, opened: 250, clicked: 50 },
      { name: 'Campaign B', sent: 800, opened: 200, clicked: 40 },
      { name: 'Campaign C', sent: 1200, opened: 360, clicked: 72 }
    ],
    agents: [
      { name: 'Agent 1', status: 'active', daily_limit: 100 },
      { name: 'Agent 2', status: 'active', daily_limit: 80 },
      { name: 'Agent 3', status: 'paused', daily_limit: 120 }
    ]
  };
  
  return mockData[dataSource as keyof typeof mockData] || [];
}