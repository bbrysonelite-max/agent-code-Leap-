import { api } from "encore.dev/api";
import { agentDB } from "./db";
import type { Agent } from "./types";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";

export interface ListAgentsResponse {
  agents: Agent[];
}

// Retrieves all Nu Skin prospecting agents.
export const list = api<void, ListAgentsResponse>(
  { expose: true, method: "GET", path: "/agents" },
  wrapAsync(async () => {
    const agents = await executeQuery(
      async () => {
        const results: Agent[] = [];
        for await (const row of agentDB.query<Agent>`
          SELECT * FROM agents 
          ORDER BY created_at DESC
        `) {
          results.push(row);
        }
        return results;
      },
      "list agents"
    );
    
    return { agents };
  })
);
