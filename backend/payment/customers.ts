import { api } from "encore.dev/api";
import { db } from "./db";
import * as mcpStripe from "./mcp_stripe";
import type { Customer, CreateCustomerRequest } from "./types";

export const createCustomer = api(
  { method: "POST", path: "/customers", expose: true },
  async (req: CreateCustomerRequest): Promise<Customer> => {
    // Create customer using MCP Stripe
    const stripeCustomer = await mcpStripe.createCustomer({
      email: req.email,
      name: req.name,
      metadata: {
        clientId: req.clientId,
      },
    });

    // Store customer in database
    const result = await db.queryRow`
      INSERT INTO customers (stripe_customer_id, email, name, client_id)
      VALUES (${stripeCustomer.id}, ${req.email}, ${req.name}, ${req.clientId})
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create customer");
    }

    const customer = result;
    return {
      id: customer.id,
      stripeCustomerId: customer.stripe_customer_id,
      email: customer.email,
      name: customer.name,
      clientId: customer.client_id,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    };
  }
);

export const getCustomer = api(
  { method: "GET", path: "/customers/:id", expose: true },
  async ({ id }: { id: string }): Promise<Customer> => {
    const result = await db.queryRow`
      SELECT * FROM customers WHERE id = ${id}
    `;

    if (!result) {
      throw new Error("Customer not found");
    }

    const customer = result;
    return {
      id: customer.id,
      stripeCustomerId: customer.stripe_customer_id,
      email: customer.email,
      name: customer.name,
      clientId: customer.client_id,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    };
  }
);

interface GetCustomerByEmailResponse {
  customer: Customer | null;
}

export const getCustomerByEmail = api(
  { method: "GET", path: "/customers/by-email/:email", expose: true },
  async ({ email }: { email: string }): Promise<GetCustomerByEmailResponse> => {
    const result = await db.queryRow`
      SELECT * FROM customers WHERE email = ${email}
    `;

    if (!result) {
      return { customer: null };
    }

    const customer = result;
    return {
      customer: {
        id: customer.id,
        stripeCustomerId: customer.stripe_customer_id,
        email: customer.email,
        name: customer.name,
        clientId: customer.client_id,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at,
      }
    };
  }
);

interface ListCustomersResponse {
  customers: Customer[];
}

export const listCustomers = api(
  { method: "GET", path: "/customers", expose: true },
  async ({ clientId }: { clientId?: string }): Promise<ListCustomersResponse> => {
    let query = "SELECT * FROM customers";
    const params: any[] = [];

    if (clientId) {
      query += " WHERE client_id = $1";
      params.push(clientId);
    }

    query += " ORDER BY created_at DESC";

    const result = await db.rawQueryAll(query, ...params);

    return {
      customers: result.map(row => ({
        id: row.id,
        stripeCustomerId: row.stripe_customer_id,
        email: row.email,
        name: row.name,
        clientId: row.client_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    };
  }
);