import { api } from "encore.dev/api";
import { clientDB } from "./db";
import type { ClientConfiguration } from "./types";
import { executeQuery } from "../shared/database";
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
    
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    
    if (req.is_active !== undefined) {
      whereClause += ` AND is_active = $${params.length + 1}`;
      params.push(req.is_active);
    }
    
    if (req.business_type) {
      whereClause += ` AND business_type = $${params.length + 1}`;
      params.push(req.business_type);
    }
    
    // Get total count
    const countResult = await executeQuery(
      () => clientDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count 
        FROM client_configurations 
        ${whereClause}
      `,
      "count clients"
    );
    
    // Get clients with pagination  
    const clientsResult = await executeQuery(
      () => clientDB.query<ClientConfiguration>`
        SELECT * 
        FROM client_configurations 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      "list clients"
    );
    
    // Convert async generator to array
    const clients: ClientConfiguration[] = [];
    for await (const client of clientsResult) {
      clients.push(client);
    }
    
    return {
      clients,
      total: countResult?.count || 0
    };
  })
);