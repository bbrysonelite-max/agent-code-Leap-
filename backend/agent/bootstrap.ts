import { api } from "encore.dev/api";
import { agentDB } from "./db";
import { client } from "~encore/clients";
import { wrapAsync } from "../shared/errors";

export interface BootstrapResponse {
  success: boolean;
  message: string;
  created: {
    client?: any;
    agents?: any[];
  };
}

// Bootstrap sample data for testing
export const bootstrap = api<void, BootstrapResponse>(
  { expose: true, method: "POST", path: "/agents/bootstrap" },
  wrapAsync(async () => {
    try {
      // Get first available client (one should exist from setup)
      const clients = await client.list({});
      
      if (!clients || !clients.clients || clients.clients.length === 0) {
        return {
          success: false,
          message: "No client configuration found. Please create a client first using /clients endpoint.",
          created: {}
        };
      }
      
      const firstClient = clients.clients[0];

      // Create sample agents for this client
      const agents = [];
      
      const agent1 = await agentDB.queryRow`
        INSERT INTO agents (name, client_id, status, prospects_found_today, emails_sent_today, responses_today, last_activity_at) 
        VALUES ('Sarah - Lead Generator', ${firstClient.id}, 'running', 12, 8, 3, NOW())
        RETURNING *
      `;
      agents.push(agent1);

      const agent2 = await agentDB.queryRow`
        INSERT INTO agents (name, client_id, status, prospects_found_today, emails_sent_today, responses_today, last_activity_at) 
        VALUES ('Mike - Business Development', ${firstClient.id}, 'paused', 8, 15, 5, NOW() - INTERVAL '2 hours')
        RETURNING *
      `;
      agents.push(agent2);

      const agent3 = await agentDB.queryRow`
        INSERT INTO agents (name, client_id, status, prospects_found_today, emails_sent_today, responses_today, last_activity_at) 
        VALUES ('Alex - Customer Success', ${firstClient.id}, 'running', 6, 12, 2, NOW() - INTERVAL '30 minutes')
        RETURNING *
      `;
      agents.push(agent3);

      return {
        success: true,
        message: "Sample agents created successfully! You now have 3 agents ready to work.",
        created: {
          client: firstClient,
          agents: agents
        }
      };

    } catch (error) {
      console.error("Bootstrap error:", error);
      return {
        success: false,
        message: `Failed to create sample data: ${(error as Error).message}`,
        created: {}
      };
    }
  })
);