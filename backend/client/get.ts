import { api } from "encore.dev/api";
import { clientDB } from "./db";
import type { ClientConfiguration } from "./types";
import { validateField, Rules } from "../shared/validation";
import { executeQuery } from "../shared/database";
import { wrapAsync, NotFoundError } from "../shared/errors";

export interface GetClientRequest {
  id: number;
}

export const get = api<GetClientRequest, ClientConfiguration>(
  { expose: true, method: "GET", path: "/clients/:id" },
  wrapAsync(async (req) => {
    validateField(req.id, "id", [Rules.required(), Rules.positive(), Rules.integer()]);
    
    const client = await executeQuery(
      () => clientDB.queryRow<ClientConfiguration>`
        SELECT * 
        FROM client_configurations 
        WHERE id = ${req.id}
      `,
      "get client"
    );
    
    if (!client) {
      throw new NotFoundError("Client configuration not found");
    }
    
    return client;
  })
);