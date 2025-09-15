import { api, APIError } from "encore.dev/api";
import { agentDB } from "./db";
import type { Agent, AgentStatus } from "./types";

export interface UpdateStatusRequest {
  id: number;
  status: AgentStatus;
}

// Updates the status of a Nu Skin prospecting agent.
export const updateStatus = api<UpdateStatusRequest, Agent>(
  { expose: true, method: "PUT", path: "/agents/:id/status" },
  async (req) => {
    const row = await agentDB.queryRow<Agent>`
      UPDATE agents 
      SET status = ${req.status}, 
          updated_at = NOW(),
          last_activity_at = CASE 
            WHEN ${req.status} = 'running' THEN NOW()
            ELSE last_activity_at
          END
      WHERE id = ${req.id}
      RETURNING *
    `;
    
    if (!row) {
      throw APIError.notFound("Agent not found");
    }
    
    return row;
  }
);
