import { api } from "encore.dev/api";
import { Header, Query } from "encore.dev/api";
import { salesforceDB } from "./db";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";
import { SalesforceClient } from "./client";
import type { SalesforceConnection } from "./types";

export interface CreateConnectionRequest {
  org_name: string;
  client_id: string;
  client_secret: string;
  is_sandbox?: boolean;
}

export interface ConnectionResponse {
  connection: SalesforceConnection;
  auth_url: string;
}

export interface OAuthCallbackRequest {
  code: Query<string>;
  state?: Query<string>;
  connection_id: Query<number>;
}

export interface TestConnectionRequest {
  connection_id: number;
}

export interface DeleteConnectionRequest {
  connection_id: number;
}

// Initialize Salesforce OAuth connection
export const createConnection = api(
  { expose: true, method: "POST", path: "/salesforce/connections" },
  wrapAsync(async (req: CreateConnectionRequest): Promise<ConnectionResponse> => {
    validateField(req.org_name, "org_name", [Rules.minLength(1), Rules.maxLength(100)]);
    validateField(req.client_id, "client_id", [Rules.minLength(1)]);
    validateField(req.client_secret, "client_secret", [Rules.minLength(1)]);

    const isSandbox = req.is_sandbox || false;
    const baseUrl = isSandbox ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
    
    // Create connection record (without tokens initially)
    const connection = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceConnection>(
        `INSERT INTO salesforce_connections 
         (org_name, instance_url, access_token, refresh_token, client_id, client_secret, is_sandbox, is_active)
         VALUES ($1, $2, '', '', $3, $4, $5, false)
         RETURNING *`,
        req.org_name, baseUrl, req.client_id, req.client_secret, isSandbox
      ),
      "create salesforce connection"
    );

    if (!connection) {
      throw new Error("Failed to create connection");
    }

    // Generate OAuth URL
    const redirectUri = `${process.env.APP_URL || 'http://localhost:4000'}/api/salesforce/oauth/callback`;
    const authUrl = `${baseUrl}/services/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${encodeURIComponent(req.client_id)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${connection.id}&` +
      `scope=full refresh_token`;

    return {
      connection,
      auth_url: authUrl
    };
  })
);

// Handle OAuth callback from Salesforce
export const handleOAuthCallback = api(
  { expose: true, method: "GET", path: "/salesforce/oauth/callback" },
  wrapAsync(async (req: OAuthCallbackRequest): Promise<{ success: boolean; message: string }> => {
    validateField(req.code, "code", [Rules.minLength(1)]);
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);

    // Get connection details
    const connection = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceConnection>(
        `SELECT * FROM salesforce_connections WHERE id = $1`,
        req.connection_id
      ),
      "get salesforce connection"
    );

    if (!connection) {
      throw new Error("Connection not found");
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.APP_URL || 'http://localhost:4000'}/api/salesforce/oauth/callback`;
    const tokenResponse = await fetch(`${connection.instance_url}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: req.code,
        client_id: connection.client_id,
        client_secret: connection.client_secret,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`OAuth token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as any;

    // Update connection with tokens and instance URL
    await executeQuery(
      () => salesforceDB.rawQueryRow(
        `UPDATE salesforce_connections 
         SET access_token = $1, refresh_token = $2, instance_url = $3, is_active = true, updated_at = NOW()
         WHERE id = $4`,
        tokenData.access_token, tokenData.refresh_token, tokenData.instance_url, connection.id
      ),
      "update salesforce connection tokens"
    );

    return {
      success: true,
      message: "Salesforce connection established successfully"
    };
  })
);

// Test Salesforce connection
export const testConnection = api<TestConnectionRequest, { success: boolean; message: string; details?: any }>(
  { expose: true, method: "POST", path: "/salesforce/connections/:connection_id/test" },
  wrapAsync(async (req: TestConnectionRequest): Promise<{ success: boolean; message: string; details?: any }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);

    const connection = await executeQuery(
      () => salesforceDB.rawQueryRow<SalesforceConnection>(
        `SELECT * FROM salesforce_connections WHERE id = $1 AND is_active = true`,
        req.connection_id
      ),
      "get salesforce connection"
    );

    if (!connection) {
      return {
        success: false,
        message: "Connection not found or inactive"
      };
    }

    try {
      const client = new SalesforceClient(connection);
      const isConnected = await client.testConnection();

      if (isConnected) {
        // Get org info
        const orgInfo = await client.query("SELECT Id, Name, OrganizationType FROM Organization LIMIT 1");
        
        return {
          success: true,
          message: "Connection successful",
          details: {
            org_name: orgInfo.records[0]?.Name,
            org_type: orgInfo.records[0]?.OrganizationType,
            instance_url: connection.instance_url
          }
        };
      } else {
        return {
          success: false,
          message: "Connection test failed"
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  })
);

// List all connections
export const listConnections = api(
  { expose: true, method: "GET", path: "/salesforce/connections" },
  wrapAsync(async (): Promise<{ connections: SalesforceConnection[] }> => {
    const connections = await executeQuery(
      () => salesforceDB.rawQueryAll<SalesforceConnection>(
        `SELECT id, org_name, instance_url, is_sandbox, is_active, last_sync_at, created_at, updated_at
         FROM salesforce_connections 
         ORDER BY created_at DESC`
      ),
      "list salesforce connections"
    );

    return { connections };
  })
);

// Delete connection
export const deleteConnection = api<DeleteConnectionRequest, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/salesforce/connections/:connection_id" },
  wrapAsync(async (req: DeleteConnectionRequest): Promise<{ success: boolean }> => {
    validateField(req.connection_id, "connection_id", [Rules.positive(), Rules.integer()]);

    await executeQuery(
      () => salesforceDB.rawQueryRow(
        `DELETE FROM salesforce_connections WHERE id = $1`,
        req.connection_id
      ),
      "delete salesforce connection"
    );

    return { success: true };
  })
);