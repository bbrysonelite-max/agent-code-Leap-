import { api } from "encore.dev/api";
import { db } from "./db";
import * as mcpStripe from "./mcp_stripe";
import type { Subscription, CreateSubscriptionRequest, UpdateSubscriptionRequest } from "./types";

export const createSubscription = api(
  { method: "POST", path: "/subscriptions", expose: true },
  async (req: CreateSubscriptionRequest): Promise<Subscription> => {
    // Get customer from database
    const customerResult = await db.queryRow`
      SELECT stripe_customer_id FROM customers WHERE id = ${req.customerId}
    `;

    if (!customerResult) {
      throw new Error("Customer not found");
    }

    const stripeCustomerId = customerResult.stripe_customer_id;

    // Create subscription in Stripe
    const createParams: any = {
      customer: stripeCustomerId,
      items: [{
        price: req.priceId,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    };

    if (req.paymentMethodId) {
      createParams.default_payment_method = req.paymentMethodId;
    }

    const stripeSubscription = await mcpStripe.createSubscription(createParams);

    // Get plan name from Stripe price using MCP
    const price = await mcpStripe.retrievePrice(req.priceId);
    const product = await mcpStripe.retrieveProduct(price.product);

    // Store subscription in database
    const result = await db.queryRow`
      INSERT INTO subscriptions (
        customer_id, stripe_subscription_id, status, price_id, plan_name,
        current_period_start, current_period_end
      )
      VALUES (${req.customerId}, ${stripeSubscription.id}, ${stripeSubscription.status}, ${req.priceId}, ${product.name}, ${new Date(stripeSubscription.current_period_start * 1000)}, ${new Date(stripeSubscription.current_period_end * 1000)})
      RETURNING *
    `;

    if (!result) {
      throw new Error("Failed to create subscription");
    }

    const subscription = result;
    return {
      id: subscription.id,
      customerId: subscription.customer_id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      status: subscription.status,
      priceId: subscription.price_id,
      planName: subscription.plan_name,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at,
    };
  }
);

export const getSubscription = api(
  { method: "GET", path: "/subscriptions/:id", expose: true },
  async ({ id }: { id: string }): Promise<Subscription> => {
    const result = await db.queryRow`
      SELECT * FROM subscriptions WHERE id = ${id}
    `;

    if (!result) {
      throw new Error("Subscription not found");
    }

    const subscription = result;
    return {
      id: subscription.id,
      customerId: subscription.customer_id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      status: subscription.status,
      priceId: subscription.price_id,
      planName: subscription.plan_name,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at,
    };
  }
);

export const updateSubscription = api(
  { method: "PUT", path: "/subscriptions/:id", expose: true },
  async ({ id, ...req }: { id: string } & UpdateSubscriptionRequest): Promise<Subscription> => {
    // Get subscription from database
    const subResult = await db.queryRow`
      SELECT stripe_subscription_id FROM subscriptions WHERE id = ${id}
    `;

    if (!subResult) {
      throw new Error("Subscription not found");
    }

    const stripeSubscriptionId = subResult.stripe_subscription_id;

    // Update subscription in Stripe
    const updateParams: any = {};

    if (req.priceId) {
      const currentSub = await mcpStripe.retrieveSubscription(stripeSubscriptionId);
      updateParams.items = [{
        id: currentSub.items.data[0].id,
        price: req.priceId,
      }];
    }

    if (req.cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = req.cancelAtPeriodEnd;
    }

    const stripeSubscription = await mcpStripe.updateSubscription(stripeSubscriptionId, updateParams);

    // Update subscription in database
    if (req.priceId && req.cancelAtPeriodEnd !== undefined) {
      await db.exec`
        UPDATE subscriptions 
        SET price_id = ${req.priceId}, cancel_at_period_end = ${req.cancelAtPeriodEnd}, status = ${stripeSubscription.status}, updated_at = NOW()
        WHERE id = ${id}
      `;
    } else if (req.priceId) {
      await db.exec`
        UPDATE subscriptions 
        SET price_id = ${req.priceId}, status = ${stripeSubscription.status}, updated_at = NOW()
        WHERE id = ${id}
      `;
    } else if (req.cancelAtPeriodEnd !== undefined) {
      await db.exec`
        UPDATE subscriptions 
        SET cancel_at_period_end = ${req.cancelAtPeriodEnd}, status = ${stripeSubscription.status}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // Return updated subscription
    return await getSubscription({ id });
  }
);

export const cancelSubscription = api(
  { method: "DELETE", path: "/subscriptions/:id", expose: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    // Get subscription from database
    const subResult = await db.queryRow`
      SELECT stripe_subscription_id FROM subscriptions WHERE id = ${id}
    `;

    if (!subResult) {
      throw new Error("Subscription not found");
    }

    const stripeSubscriptionId = subResult.stripe_subscription_id;

    // Cancel subscription using MCP Stripe
    await mcpStripe.cancelSubscription(stripeSubscriptionId);

    // Update subscription status in database
    await db.exec`
      UPDATE subscriptions 
      SET status = 'canceled', updated_at = NOW()
      WHERE id = ${id}
    `;

    return { success: true };
  }
);

interface ListSubscriptionsResponse {
  subscriptions: Subscription[];
}

export const listSubscriptions = api(
  { method: "GET", path: "/subscriptions", expose: true },
  async ({ customerId }: { customerId?: string }): Promise<ListSubscriptionsResponse> => {
    let query = "SELECT * FROM subscriptions";
    const params: any[] = [];

    if (customerId) {
      query += " WHERE customer_id = $1";
      params.push(customerId);
    }

    query += " ORDER BY created_at DESC";

    const result = await db.rawQueryAll(query, ...params);

    return {
      subscriptions: result.map(row => ({
        id: row.id,
        customerId: row.customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        status: row.status,
        priceId: row.price_id,
        planName: row.plan_name,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    };
  }
);