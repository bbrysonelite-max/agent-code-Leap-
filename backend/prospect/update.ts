import { api, APIError } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ProspectClassification, ProspectStatus } from "../agent/types";

export interface UpdateProspectRequest {
  id: number;
  classification?: ProspectClassification;
  status?: ProspectStatus;
  notes?: string;
}

// Updates prospect information and classification.
export const update = api<UpdateProspectRequest, Prospect>(
  { expose: true, method: "PUT", path: "/prospects/:id" },
  async (req) => {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (req.classification !== undefined) {
      updates.push(`classification = $${paramIndex}`);
      params.push(req.classification);
      paramIndex++;
    }

    if (req.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(req.status);
      paramIndex++;
    }

    if (req.notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(req.notes);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.id);

    const query = `
      UPDATE prospects 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const row = await prospectDB.rawQueryRow<Prospect>(query, ...params);
    
    if (!row) {
      throw APIError.notFound("Prospect not found");
    }
    
    return row;
  }
);
