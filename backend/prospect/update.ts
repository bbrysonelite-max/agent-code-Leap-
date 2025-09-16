import { api } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ProspectClassification, ProspectStatus } from "../agent/types";
import { validateField, Rules } from "../shared/validation";
import { requireRow } from "../shared/database";
import { wrapAsync, BusinessLogicError } from "../shared/errors";
import { auditDataChange } from "../audit/logger";

export interface UpdateProspectRequest {
  id: number;
  classification?: ProspectClassification;
  status?: ProspectStatus;
  notes?: string;
  userId?: string;
}

const validClassifications: ProspectClassification[] = ['business_builder', 'product_customer', 'unqualified'];
const validStatuses: ProspectStatus[] = ['new', 'contacted', 'responded', 'qualified', 'converted'];

// Updates prospect information and classification.
export const update = api<UpdateProspectRequest, Prospect>(
  { expose: true, method: "PUT", path: "/prospects/:id" },
  wrapAsync(async (req) => {
    // Get the existing prospect for audit trail
    const existingProspect = await prospectDB.queryRow<Prospect>`
      SELECT * FROM prospects WHERE id = ${req.id}
    `;
    
    if (!existingProspect) {
      throw new BusinessLogicError("Prospect not found", "PROSPECT_NOT_FOUND");
    }
    
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

    const result = await requireRow(
      () => prospectDB.rawQueryRow<Prospect>(query, ...params),
      "prospect",
      req.id
    );
    
    // Build old and new values for audit trail
    const oldValues: any = {};
    const newValues: any = {};
    
    if (req.classification !== undefined && req.classification !== existingProspect.classification) {
      oldValues.classification = existingProspect.classification;
      newValues.classification = req.classification;
    }
    
    if (req.status !== undefined && req.status !== existingProspect.status) {
      oldValues.status = existingProspect.status;
      newValues.status = req.status;
    }
    
    if (req.notes !== undefined && req.notes !== existingProspect.notes) {
      oldValues.notes = existingProspect.notes;
      newValues.notes = req.notes;
    }
    
    // Only audit if there were actual changes
    if (Object.keys(newValues).length > 0) {
      await auditDataChange(
        'update',
        'prospect',
        req.id.toString(),
        oldValues,
        newValues,
        req.userId,
        'prospect',
        true // Prospect data is compliance relevant
      );
    }
    
    return result;
  })
);
