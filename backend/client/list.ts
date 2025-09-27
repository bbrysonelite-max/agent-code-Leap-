import { api } from "encore.dev/api";
import { clientDB } from "./db";
import type { ClientConfiguration } from "./types";
import { wrapDatabaseQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";

export interface ListClientsRequest {
  is_active?: boolean;
  business_type?: string;
  limit?: number;
  offset?: number;
}

export interface ListClientsResponse {
  clients: ClientConfiguration[];
  total: number;
}

export const list = api<ListClientsRequest, ListClientsResponse>(
  { expose: true, method: "GET", path: "/clients" },
  wrapAsync(async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;
    
    // Build where conditions
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (req.is_active !== undefined) {
      conditions.push('is_active = $' + (params.length + 1));
      params.push(req.is_active);
    }
    
    if (req.business_type) {
      conditions.push('business_type = $' + (params.length + 1));
      params.push(req.business_type);
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    // Get total count
    const countResult = await wrapDatabaseQuery(
      () => clientDB.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM client_configurations ${whereClause}`,
        ...params
      ),
      "count clients"
    );
    
    // Get clients with pagination
    const clients = await wrapDatabaseQuery(
      async () => {
        const result: ClientConfiguration[] = [];
        const query = clientDB.rawQuery<ClientConfiguration>(
          `SELECT * FROM client_configurations ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          ...params, limit, offset
        );
        
        for await (const client of query) {
          result.push(client);
        }
        return result;
      },
      "list clients"
    );
    
    return {
      clients,
      total: countResult?.count || 0
    };
  })
);