import { api } from "encore.dev/api";
import { agentDB } from "./db";
import type { Agent } from "./types";

export interface CreateAgentRequest {
  name: string;
}

// Creates a new Nu Skin prospecting agent.
export const create = api<CreateAgentRequest, Agent>(
  { expose: true, method: "POST", path: "/agents" },
  async (req) => {
    const row = await agentDB.queryRow<Agent>`
      INSERT INTO agents (name) 
      VALUES (${req.name})
      RETURNING *
    `;
    
    if (!row) {
      throw new Error("Failed to create agent");
    }
    
    return row;
  }
);
