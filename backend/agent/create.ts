import { api } from "encore.dev/api";
import { agentDB } from "./db";
import type { Agent } from "./types";
import { validateField, Rules } from "../shared/validation";
import { insertRow, executeQuery } from "../shared/database";
import { wrapAsync, BusinessLogicError } from "../shared/errors";

export interface CreateAgentRequest {
  name: string;
  client_id: number;
}

// Creates a new prospecting agent for a specific client.
export const create = api<CreateAgentRequest, Agent>(
  { expose: true, method: "POST", path: "/agents" },
  wrapAsync(async (req) => {
    // Validate input
    validateField(req.name, "name", [Rules.required(), Rules.minLength(2), Rules.maxLength(100)]);
    validateField(req.client_id, "client_id", [Rules.required(), Rules.positive(), Rules.integer()]);
    
    // Verify client exists and is active
    const clientExists = await executeQuery(
      () => agentDB.queryRow<{ exists: boolean } | undefined>`
        SELECT EXISTS(SELECT 1 FROM client_configurations WHERE id = ${req.client_id} AND is_active = true) as exists
      `,
      "check client exists"
    );
    
    if (!clientExists || !clientExists.exists) {
      throw new BusinessLogicError("Client configuration not found or inactive");
    }

    return await insertRow(
      () => agentDB.queryRow<Agent>`
        INSERT INTO agents (name, client_id) 
        VALUES (${req.name}, ${req.client_id})
        RETURNING *
      `,
      "agent"
    );
  })
);
