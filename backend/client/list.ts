import { api } from "encore.dev/api";
import { clientDB } from "./db";
import type { ClientConfiguration } from "./types";
import { executeQuery, handleDatabaseError } from "../shared/database";
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
    
    // Get total count and clients based on filters
    let countResult: { count: number };
    const clients: ClientConfiguration[] = [];

    try {
      if (req.is_active !== undefined && req.business_type) {
        // Both filters
        countResult = await executeQuery(
          () => clientDB.queryRow<{ count: number }>`
            SELECT COUNT(*) as count
            FROM client_configurations
            WHERE is_active = ${req.is_active} AND business_type = ${req.business_type}
          `,
          "count clients"
        );

        const clientsResult = clientDB.query<ClientConfiguration>`
          SELECT *
          FROM client_configurations
          WHERE is_active = ${req.is_active} AND business_type = ${req.business_type}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        for await (const client of clientsResult) {
          clients.push(client);
        }
      } else if (req.is_active !== undefined) {
        // Only is_active filter
        countResult = await executeQuery(
          () => clientDB.queryRow<{ count: number }>`
            SELECT COUNT(*) as count
            FROM client_configurations
            WHERE is_active = ${req.is_active}
          `,
          "count clients"
        );

        const clientsResult = clientDB.query<ClientConfiguration>`
          SELECT *
          FROM client_configurations
          WHERE is_active = ${req.is_active}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        for await (const client of clientsResult) {
          clients.push(client);
        }
      } else if (req.business_type) {
        // Only business_type filter
        countResult = await executeQuery(
          () => clientDB.queryRow<{ count: number }>`
            SELECT COUNT(*) as count
            FROM client_configurations
            WHERE business_type = ${req.business_type}
          `,
          "count clients"
        );

        const clientsResult = clientDB.query<ClientConfiguration>`
          SELECT *
          FROM client_configurations
          WHERE business_type = ${req.business_type}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        for await (const client of clientsResult) {
          clients.push(client);
        }
      } else {
        // No filters
        countResult = await executeQuery(
          () => clientDB.queryRow<{ count: number }>`
            SELECT COUNT(*) as count
            FROM client_configurations
          `,
          "count clients"
        );

        const clientsResult = clientDB.query<ClientConfiguration>`
          SELECT *
          FROM client_configurations
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        for await (const client of clientsResult) {
          clients.push(client);
        }
      }
    } catch (error) {
      handleDatabaseError(error, "list clients");
      // Return empty result on error
      return {
        clients: [],
        total: 0
      };
    }
    
    return {
      clients,
      total: countResult?.count || 0
    };
  })
);