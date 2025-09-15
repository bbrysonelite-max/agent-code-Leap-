import { api } from "encore.dev/api";
import { agentDB } from "./db";
import type { Agent } from "./types";

export interface ListAgentsResponse {
  agents: Agent[];
}

// Retrieves all Nu Skin prospecting agents.
export const list = api<void, ListAgentsResponse>(
  { expose: true, method: "GET", path: "/agents" },
  async () => {
    const agents: Agent[] = [];
    for await (const row of agentDB.query<Agent>`
      SELECT * FROM agents 
      ORDER BY created_at DESC
    `) {
      agents.push(row);
    }
    
    return { agents };
  }
);
