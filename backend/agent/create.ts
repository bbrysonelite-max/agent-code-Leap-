import { api, Header } from "encore.dev/api";
import { agentDB } from "./db";
import type { Agent } from "./types";
import { validateField, Rules } from "../shared/validation";
import { insertRow, executeQuery } from "../shared/database";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { withEnhancedRateLimit } from "../shared/simple-rate-limiting";
import { retryWithAdaptiveBackoff } from "../shared/intelligent-backoff";

export interface CreateAgentRequest {
  name: string;
  client_id: number;
  userTier?: string;
  userId?: string;
}

// Creates a new prospecting agent for a specific client.
export const create = api<CreateAgentRequest, Agent>(
  { expose: true, method: "POST", path: "/agents" },
  wrapAsync(async (
    req: CreateAgentRequest,
    userAgent?: Header<"user-agent">,
    forwardedFor?: Header<"x-forwarded-for">
  ) => {
    // Enhanced rate limiting for agent creation
    await withEnhancedRateLimit({
      identifier: req.userId || `client_${req.client_id}`,
      endpoint: "/agents",
      method: "POST",
      userTier: req.userTier || "basic",
      userId: req.userId
    }, userAgent, forwardedFor);
    
    // Validate input
    validateField(req.name, "name", [Rules.required(), Rules.minLength(2), Rules.maxLength(100)]);
    validateField(req.client_id, "client_id", [Rules.required(), Rules.positive(), Rules.integer()]);
    
    // Note: Skipping client existence check for now as it requires cross-service call
    // In production, this should use the client service API to verify the client exists
    // For now, we'll trust that the client_id is valid (foreign key constraint will catch invalid IDs)

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
