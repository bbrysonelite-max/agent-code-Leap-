import { api } from "encore.dev/api";
import { agentDB } from "./db";
import type { Agent } from "./types";
import { validateField, Rules } from "../shared/validation";
import { insertRow, handleDatabaseError } from "../shared/database";
import { wrapAsync } from "../shared/errors";

export interface CreateAgentRequest {
  name: string;
}

// Creates a new Nu Skin prospecting agent.
export const create = api<CreateAgentRequest, Agent>(
  { expose: true, method: "POST", path: "/agents" },
  wrapAsync(async (req) => {
    // Validate input
    validateField(req.name, "name", [Rules.required(), Rules.minLength(2), Rules.maxLength(100)]);

    return await insertRow(
      () => agentDB.queryRow<Agent>`
        INSERT INTO agents (name) 
        VALUES (${req.name})
        RETURNING *
      `,
      "agent"
    );
  })
);
