import { api } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ProspectClassification, ProspectStatus } from "../agent/types";
import { validateField, Rules } from "../shared/validation";
import { requireRow } from "../shared/database";
import { wrapAsync, BusinessLogicError } from "../shared/errors";

export interface UpdateProspectRequest {
  id: number;
  classification?: ProspectClassification;
  status?: ProspectStatus;
  notes?: string;
}

const validClassifications: ProspectClassification[] = ['business_builder', 'product_customer', 'unqualified'];
const validStatuses: ProspectStatus[] = ['new', 'contacted', 'responded', 'qualified', 'converted'];

// Updates prospect information and classification.
export const update = api<UpdateProspectRequest, Prospect>(
  { expose: true, method: "PUT", path: "/prospects/:id" },
  wrapAsync(async (req) => {
    // Validate input
    validateField(req.id, "id", [Rules.required(), Rules.positive(), Rules.integer()]);
    if (req.classification !== undefined) {
      validateField(req.classification, "classification", [Rules.oneOf(validClassifications)]);
    }
    if (req.status !== undefined) {
      validateField(req.status, "status", [Rules.oneOf(validStatuses)]);
    }
    if (req.notes !== undefined) {
      validateField(req.notes, "notes", [Rules.maxLength(1000)]);
    }
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
      throw new BusinessLogicError("No fields to update", "NO_FIELDS_TO_UPDATE");
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.id);

    const query = `
      UPDATE prospects 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    return await requireRow(
      () => prospectDB.rawQueryRow<Prospect>(query, ...params),
      "prospect",
      req.id
    );
  })
);
