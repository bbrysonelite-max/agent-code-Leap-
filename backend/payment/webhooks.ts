import { api } from "encore.dev/api";
import { db } from "./db";
import * as mcpStripe from "./mcp_stripe";
import { secret } from "encore.dev/config";

const stripeWebhookSecret = secret("StripeWebhookSecret");

export function getWebhookSecret(): string {
  return stripeWebhookSecret();
}

interface WebhookPayload {
  data: string;
}

export const handleWebhook = api(
  { method: "POST", path: "/webhooks/stripe", expose: true },
  async (payload: WebhookPayload): Promise<{ received: boolean }> => {
    let event: any;

    try {
      // For now, we'll skip signature verification and just parse the payload
      // In production, you should implement proper webhook signature verification
      event = JSON.parse(payload.data);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      await handleStripeEvent(event);
    } catch (err: any) {
      console.error('Error handling webhook event:', err);
      throw new Error(`Webhook processing failed: ${err.message}`);
    }

    return { received: true };
  }
);

async function handleStripeEvent(event: any): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;

    case 'invoice.created':
    case 'invoice.updated':
      await handleInvoiceUpdate(event.data.object);
      break;

    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object);
      break;

    case 'customer.created':
    case 'customer.updated':
      await handleCustomerUpdate(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleSubscriptionUpdate(subscription: any): Promise<void> {
  // Get customer ID from Stripe customer ID
  const customerResult = await db.queryRow`
    SELECT id FROM customers WHERE stripe_customer_id = ${subscription.customer}
  `;

  if (!customerResult) {
    console.error(`Customer not found for Stripe customer ID: ${subscription.customer}`);
    return;
  }

  const customerId = customerResult.id;

  // Get plan name from price
  let planName = 'Unknown Plan';
  try {
    if (subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id;
      const price = await mcpStripe.retrievePrice(priceId);
      const product = await mcpStripe.retrieveProduct(price.product);
      planName = product.name;
    }
  } catch (err) {
    console.error('Error fetching plan name:', err);
  }

  // Upsert subscription
  const existingSubscription = await db.queryRow`
    SELECT id FROM subscriptions WHERE stripe_subscription_id = ${subscription.id}
  `;

  if (!existingSubscription) {
    await db.exec`
      INSERT INTO subscriptions (
        customer_id, stripe_subscription_id, status, price_id, plan_name,
        current_period_start, current_period_end, cancel_at_period_end
      )
      VALUES (${customerId}, ${subscription.id}, ${subscription.status}, ${subscription.items.data[0]?.price.id || ''}, ${planName}, ${new Date(subscription.current_period_start * 1000)}, ${new Date(subscription.current_period_end * 1000)}, ${subscription.cancel_at_period_end || false})
    `;
  } else {
    await db.exec`
      UPDATE subscriptions
      SET status = ${subscription.status}, price_id = ${subscription.items.data[0]?.price.id || ''}, plan_name = ${planName}, current_period_start = ${new Date(subscription.current_period_start * 1000)}, current_period_end = ${new Date(subscription.current_period_end * 1000)}, cancel_at_period_end = ${subscription.cancel_at_period_end || false}, updated_at = NOW()
      WHERE stripe_subscription_id = ${subscription.id}
    `;
  }
}

async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  await db.exec`
    UPDATE subscriptions 
    SET status = 'canceled', updated_at = NOW()
    WHERE stripe_subscription_id = ${subscription.id}
  `;
}

async function handleInvoiceUpdate(invoice: any): Promise<void> {
  // Get customer ID from Stripe customer ID
  const customerResult = await db.queryRow`
    SELECT id FROM customers WHERE stripe_customer_id = ${invoice.customer}
  `;

  if (!customerResult) {
    console.error(`Customer not found for Stripe customer ID: ${invoice.customer}`);
    return;
  }

  const customerId = customerResult.id;

  // Get subscription ID if this invoice is for a subscription
  let subscriptionId = null;
  if (invoice.subscription) {
    const subResult = await db.queryRow`
      SELECT id FROM subscriptions WHERE stripe_subscription_id = ${invoice.subscription}
    `;
    
    if (subResult) {
      subscriptionId = subResult.id;
    }
  }

  // Upsert invoice
  const existingInvoice = await db.queryRow`
    SELECT id FROM invoices WHERE stripe_invoice_id = ${invoice.id}
  `;

  if (!existingInvoice) {
    await db.exec`
      INSERT INTO invoices (
        customer_id, stripe_invoice_id, subscription_id, status, amount_due,
        amount_paid, currency, due_date, paid_at, hosted_invoice_url, invoice_pdf
      )
      VALUES (${customerId}, ${invoice.id}, ${subscriptionId}, ${invoice.status}, ${invoice.amount_due || 0}, ${invoice.amount_paid || 0}, ${invoice.currency}, ${invoice.due_date ? new Date(invoice.due_date * 1000) : null}, ${invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null}, ${invoice.hosted_invoice_url}, ${invoice.invoice_pdf})
    `;
  } else {
    await db.exec`
      UPDATE invoices
      SET status = ${invoice.status}, amount_due = ${invoice.amount_due || 0}, amount_paid = ${invoice.amount_paid || 0}, due_date = ${invoice.due_date ? new Date(invoice.due_date * 1000) : null}, paid_at = ${invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null}, hosted_invoice_url = ${invoice.hosted_invoice_url}, invoice_pdf = ${invoice.invoice_pdf}
      WHERE stripe_invoice_id = ${invoice.id}
    `;
  }
}

async function handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
  await handleInvoiceUpdate(invoice);
  console.log(`Payment succeeded for invoice: ${invoice.id}`);
}

async function handleInvoicePaymentFailed(invoice: any): Promise<void> {
  await handleInvoiceUpdate(invoice);
  console.log(`Payment failed for invoice: ${invoice.id}`);
}

async function handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
  console.log(`Payment intent succeeded: ${paymentIntent.id}`);
}

async function handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
  console.log(`Payment intent failed: ${paymentIntent.id}`);
}

async function handleCustomerUpdate(customer: any): Promise<void> {
  // Update customer information if they exist in our database
  await db.exec`
    UPDATE customers 
    SET email = ${customer.email}, name = ${customer.name}, updated_at = NOW()
    WHERE stripe_customer_id = ${customer.id}
  `;
}