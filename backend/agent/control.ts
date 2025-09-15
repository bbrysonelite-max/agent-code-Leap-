import { api } from "encore.dev/api";
import { agentDB } from "./db";
import type { Agent, AgentStatus } from "./types";
import { validateField, Rules } from "../shared/validation";
import { requireRow } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { broadcastMessage } from "../realtime/websocket";
import type { AgentActivityData } from "../realtime/types";

export interface UpdateStatusRequest {
  id: number;
  status: AgentStatus;
}

const validStatuses: AgentStatus[] = ['stopped', 'running', 'paused'];

// Updates the status of a Nu Skin prospecting agent.
export const updateStatus = api<UpdateStatusRequest, Agent>(
  { expose: true, method: "PUT", path: "/agents/:id/status" },
  wrapAsync(async (req) => {
    // Validate input
    validateField(req.id, "id", [Rules.required(), Rules.positive(), Rules.integer()]);
    validateField(req.status, "status", [Rules.required(), Rules.oneOf(validStatuses)]);

    const agent = await requireRow(
      () => agentDB.queryRow<Agent>`
        UPDATE agents 
        SET status = ${req.status}, 
            updated_at = NOW(),
            last_activity_at = CASE 
              WHEN ${req.status} = 'running' THEN NOW()
              ELSE last_activity_at
            END
        WHERE id = ${req.id}
        RETURNING *
      `,
      "agent",
      req.id
    );

    // Broadcast real-time update
    const activityData: AgentActivityData = {
      agentId: agent.id.toString(),
      action: "status_changed",
      status: req.status === 'running' ? 'active' : req.status === 'paused' ? 'idle' : 'idle',
      details: { newStatus: req.status, timestamp: new Date().toISOString() }
    };

    await broadcastMessage({
      type: "agent_activity",
      data: activityData,
      timestamp: new Date().toISOString()
    }, "agent_activity");

    return agent;
  })
);
