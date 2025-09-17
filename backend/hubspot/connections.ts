import { api } from "encore.dev/api";
import { hubspotDB } from "./db";
import { HubSpotConnection, CreateConnectionRequest, UpdateConnectionRequest } from "./types";

export const createConnection = api(
  { method: "POST", path: "/connections", expose: true },
  async (req: CreateConnectionRequest) => {
    const connection = await hubspotDB.queryRow`
      INSERT INTO hubspot_connections (name, access_token, refresh_token, portal_id, app_id)
      VALUES (${req.name}, ${req.access_token}, ${req.refresh_token || null}, 
              ${req.portal_id}, ${req.app_id})
      RETURNING *
    `;

    return connection;
  }
);

export const listConnections = api(
  { method: "GET", path: "/connections", expose: true },
  async () => {
    return await hubspotDB.query`
      SELECT * FROM hubspot_connections 
      ORDER BY created_at DESC
    `;
  }
);

export const getConnection = api(
  { method: "GET", path: "/connections/:id", expose: true },
  async ({ id }: { id: string }) => {
    const connection = await hubspotDB.queryRow`
      SELECT * FROM hubspot_connections WHERE id = ${id}
    `;

    if (!connection) {
      throw new Error("Connection not found");
    }

    return connection;
  }
);

export const updateConnection = api(
  { method: "PUT", path: "/connections/:id", expose: true },
  async ({ id, ...req }: { id: string } & UpdateConnectionRequest) => {
    const updates: string[] = [];
    const values: any[] = [];

    if (req.name !== undefined) {
      updates.push(`name = $${values.length + 1}`);
      values.push(req.name);
    }
    if (req.access_token !== undefined) {
      updates.push(`access_token = $${values.length + 1}`);
      values.push(req.access_token);
    }
    if (req.refresh_token !== undefined) {
      updates.push(`refresh_token = $${values.length + 1}`);
      values.push(req.refresh_token);
    }
    if (req.is_active !== undefined) {
      updates.push(`is_active = $${values.length + 1}`);
      values.push(req.is_active);
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE hubspot_connections 
      SET ${updates.join(', ')} 
      WHERE id = $${values.length}
      RETURNING *
    `;

    const connection = await hubspotDB.queryRow(query as any, ...values);

    if (!connection) {
      throw new Error("Connection not found");
    }

    return connection;
  }
);

export const deleteConnection = api(
  { method: "DELETE", path: "/connections/:id", expose: true },
  async ({ id }: { id: string }) => {
    await hubspotDB.exec`
      DELETE FROM hubspot_connections WHERE id = ${id}
    `;
  }
);

export const testConnection = api(
  { method: "POST", path: "/connections/:id/test", expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean; message: string }> => {
    const connection = await hubspotDB.queryRow`
      SELECT * FROM hubspot_connections WHERE id = ${id}
    `;

    if (!connection) {
      throw new Error("Connection not found");
    }

    try {
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return { success: true, message: "Connection successful" };
      } else {
        return { success: false, message: `API error: ${response.status} ${response.statusText}` };
      }
    } catch (error) {
      return { success: false, message: `Connection failed: ${(error as Error).message}` };
    }
  }
);