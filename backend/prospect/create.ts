import { api } from "encore.dev/api";
import { prospectDB } from "./db";
import type { Prospect, ProspectClassification } from "../agent/types";

export interface CreateProspectRequest {
  agent_id: number;
  name: string;
  email: string;
  linkedin_profile?: string;
  company?: string;
  position?: string;
  classification: ProspectClassification;
  notes?: string;
}

// Creates a new prospect for Nu Skin outreach.
export const create = api<CreateProspectRequest, Prospect>(
  { expose: true, method: "POST", path: "/prospects" },
  async (req) => {
    const row = await prospectDB.queryRow<Prospect>`
      INSERT INTO prospects (
        agent_id, name, email, linkedin_profile, company, position, classification, notes
      ) VALUES (
        ${req.agent_id}, ${req.name}, ${req.email}, ${req.linkedin_profile || null}, 
        ${req.company || null}, ${req.position || null}, ${req.classification}, ${req.notes || null}
      )
      RETURNING *
    `;
    
    if (!row) {
      throw new Error("Failed to create prospect");
    }
    
    return row;
  }
);
