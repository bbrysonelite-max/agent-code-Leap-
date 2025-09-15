import { api } from "encore.dev/api";
import { CRM } from "./db";
import type { Contact, CreateContactRequest } from "./types";

export const createContact = api(
  { method: "POST", path: "/ai-crm/contacts", expose: true },
  async (req: CreateContactRequest): Promise<Contact> => {
    const contact = await CRM.queryRow`
      INSERT INTO contacts (
        lead_id, name, email, phone, company, position, type,
        linkedin_profile, twitter_handle, website, address, tags
      ) VALUES (
        ${req.lead_id || null}, ${req.name}, ${req.email}, ${req.phone || null},
        ${req.company || null}, ${req.position || null}, ${req.type},
        ${req.linkedin_profile || null}, ${req.twitter_handle || null},
        ${req.website || null}, ${req.address || null}, ${req.tags || []}
      )
      RETURNING *
    `;

    return contact as Contact;
  }
);

export const listContacts = api(
  { method: "GET", path: "/ai-crm/contacts", expose: true },
  async ({ 
    type,
    company,
    limit = 50,
    offset = 0 
  }: { 
    type?: string;
    company?: string;
    limit?: number;
    offset?: number;
  }) => {
    let query = `
      SELECT * FROM contacts 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (company) {
      query += ` AND company ILIKE $${paramIndex}`;
      params.push(`%${company}%`);
      paramIndex++;
    }

    query += ` ORDER BY lifetime_value DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const contacts = await CRM.queryRows(query, ...params);
    return contacts as Contact[];
  }
);

export const getContact = api(
  { method: "GET", path: "/ai-crm/contacts/:id", expose: true },
  async ({ id }: { id: string }): Promise<Contact> => {
    const contact = await CRM.queryRow`
      SELECT * FROM contacts WHERE id = ${id}
    `;

    if (!contact) {
      throw new Error("Contact not found");
    }

    return contact as Contact;
  }
);

export const updateContact = api(
  { method: "PUT", path: "/ai-crm/contacts/:id", expose: true },
  async ({ id, ...updates }: { id: string } & Partial<CreateContactRequest>): Promise<Contact> => {
    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setParts.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (setParts.length === 0) {
      throw new Error("No updates provided");
    }

    setParts.push(`updated_at = NOW()`);

    const query = `
      UPDATE contacts 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    params.push(id);

    const contact = await CRM.queryRow(query, ...params);

    if (!contact) {
      throw new Error("Contact not found");
    }

    return contact as Contact;
  }
);

export const deleteContact = api(
  { method: "DELETE", path: "/ai-crm/contacts/:id", expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    const result = await CRM.exec`
      DELETE FROM contacts WHERE id = ${id}
    `;

    return { success: result.rowCount > 0 };
  }
);

export const searchContacts = api(
  { method: "GET", path: "/ai-crm/contacts/search", expose: true },
  async ({ query, limit = 20 }: { query: string; limit?: number }) => {
    const contacts = await CRM.queryRows`
      SELECT * FROM contacts 
      WHERE 
        name ILIKE ${`%${query}%`} OR
        email ILIKE ${`%${query}%`} OR
        company ILIKE ${`%${query}%`} OR
        position ILIKE ${`%${query}%`}
      ORDER BY lifetime_value DESC, created_at DESC
      LIMIT ${limit}
    `;

    return contacts as Contact[];
  }
);