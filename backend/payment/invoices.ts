import { api } from "encore.dev/api";
import { db } from "./db";
import { stripe } from "./stripe";
import type { Invoice } from "./types";

interface ListInvoicesResponse {
  invoices: Invoice[];
}

export const listInvoices = api(
  { method: "GET", path: "/invoices", expose: true },
  async ({ customerId, subscriptionId }: { customerId?: string; subscriptionId?: string }): Promise<ListInvoicesResponse> => {
    let query = "SELECT * FROM invoices";
    const params: any[] = [];
    const conditions: string[] = [];

    if (customerId) {
      conditions.push(`customer_id = $${params.length + 1}`);
      params.push(customerId);
    }

    if (subscriptionId) {
      conditions.push(`subscription_id = $${params.length + 1}`);
      params.push(subscriptionId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += " ORDER BY created_at DESC";

    const result = await db.rawQueryAll(query, ...params);

    return {
      invoices: result.map(row => ({
        id: row.id,
        customerId: row.customer_id,
        stripeInvoiceId: row.stripe_invoice_id,
        subscriptionId: row.subscription_id,
        status: row.status,
        amountDue: row.amount_due,
        amountPaid: row.amount_paid,
        currency: row.currency,
        dueDate: row.due_date,
        paidAt: row.paid_at,
        hostedInvoiceUrl: row.hosted_invoice_url,
        invoicePdf: row.invoice_pdf,
        createdAt: row.created_at,
      }))
    };
  }
);

export const getInvoice = api(
  { method: "GET", path: "/invoices/:id", expose: true },
  async ({ id }: { id: string }): Promise<Invoice> => {
    const result = await db.queryRow`
      SELECT * FROM invoices WHERE id = ${id}
    `;

    if (!result) {
      throw new Error("Invoice not found");
    }

    const invoice = result;
    return {
      id: invoice.id,
      customerId: invoice.customer_id,
      stripeInvoiceId: invoice.stripe_invoice_id,
      subscriptionId: invoice.subscription_id,
      status: invoice.status,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      createdAt: invoice.created_at,
    };
  }
);

export const createInvoice = api(
  { method: "POST", path: "/invoices", expose: true },
  async ({ customerId, items, description }: { 
    customerId: string; 
    items: Array<{ description: string; amount: number; quantity?: number }>; 
    description?: string;
  }): Promise<Invoice> => {
    // Get customer from database
    const customerResult = await db.queryRow`
      SELECT stripe_customer_id FROM customers WHERE id = ${customerId}
    `;

    if (!customerResult) {
      throw new Error("Customer not found");
    }

    const stripeCustomerId = customerResult.stripe_customer_id;

    // Create invoice items in Stripe
    const invoiceItems = [];
    for (const item of items) {
      const invoiceItem = await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        amount: item.amount,
        currency: 'usd',
        description: item.description,
        quantity: item.quantity || 1,
      });
      invoiceItems.push(invoiceItem);
    }

    // Create invoice in Stripe
    const stripeInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      description: description,
      auto_advance: false, // Don't automatically finalize
    });

    // Store invoice in database
    const result = await db.queryRow`
      INSERT INTO invoices (
        customer_id, stripe_invoice_id, status, amount_due, amount_paid,
        currency, hosted_invoice_url, invoice_pdf
      )
      VALUES (${customerId}, ${stripeInvoice.id}, ${stripeInvoice.status}, ${stripeInvoice.amount_due || 0}, ${stripeInvoice.amount_paid || 0}, ${stripeInvoice.currency}, ${stripeInvoice.hosted_invoice_url}, ${stripeInvoice.invoice_pdf})
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create invoice");
    }

    const invoice = result;
    return {
      id: invoice.id,
      customerId: invoice.customer_id,
      stripeInvoiceId: invoice.stripe_invoice_id,
      subscriptionId: invoice.subscription_id,
      status: invoice.status,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      createdAt: invoice.created_at,
    };
  }
);

export const finalizeInvoice = api(
  { method: "POST", path: "/invoices/:id/finalize", expose: true },
  async ({ id }: { id: string }): Promise<Invoice> => {
    // Get invoice from database
    const invoiceResult = await db.queryRow`
      SELECT stripe_invoice_id FROM invoices WHERE id = ${id}
    `;

    if (!invoiceResult) {
      throw new Error("Invoice not found");
    }

    const stripeInvoiceId = invoiceResult.stripe_invoice_id;

    // Finalize invoice in Stripe
    const stripeInvoice = await stripe.invoices.finalizeInvoice(stripeInvoiceId);

    // Update invoice in database
    await db.exec`
      UPDATE invoices 
      SET status = ${stripeInvoice.status}, amount_due = ${stripeInvoice.amount_due}, hosted_invoice_url = ${stripeInvoice.hosted_invoice_url}, invoice_pdf = ${stripeInvoice.invoice_pdf}, due_date = ${stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null}
      WHERE id = ${id}
    `;

    // Return updated invoice
    return await getInvoice({ id });
  }
);

export const sendInvoice = api(
  { method: "POST", path: "/invoices/:id/send", expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    // Get invoice from database
    const invoiceResult = await db.queryRow`
      SELECT stripe_invoice_id FROM invoices WHERE id = ${id}
    `;

    if (!invoiceResult) {
      throw new Error("Invoice not found");
    }

    const stripeInvoiceId = invoiceResult.stripe_invoice_id;

    // Send invoice via Stripe
    await stripe.invoices.sendInvoice(stripeInvoiceId);

    return { success: true };
  }
);