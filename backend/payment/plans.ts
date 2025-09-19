import { api } from "encore.dev/api";
import { db } from "./db";
import { stripe } from "./stripe";
import type { Plan } from "./types";

export const syncPlansFromStripe = api(
  { method: "POST", path: "/plans/sync", expose: true },
  async (): Promise<{ synced: number }> => {
    // Get all active prices from Stripe
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });

    let syncCount = 0;

    for (const price of prices.data) {
      const product = price.product as any;
      
      // Skip if price doesn't have recurring billing
      if (!price.recurring) continue;

      // Check if plan already exists
      const existingResult = await db.queryRow`
        SELECT id FROM plans WHERE stripe_price_id = ${price.id}
      `;

      if (!existingResult) {
        // Create new plan
        await db.exec`
          INSERT INTO plans (
            name, description, stripe_price_id, amount, currency,
            interval, interval_count, features, is_active
          )
          VALUES (${product.name}, ${product.description || ''}, ${price.id}, ${price.unit_amount || 0}, ${price.currency}, ${price.recurring.interval}, ${price.recurring.interval_count}, ${JSON.stringify(product.metadata?.features ? product.metadata.features.split(',') : [])}, ${price.active})
        `;
        syncCount++;
      } else {
        // Update existing plan
        await db.exec`
          UPDATE plans 
          SET name = ${product.name}, description = ${product.description || ''}, amount = ${price.unit_amount || 0}, currency = ${price.currency}, interval = ${price.recurring.interval}, interval_count = ${price.recurring.interval_count}, is_active = ${price.active}, updated_at = NOW()
          WHERE stripe_price_id = ${price.id}
        `;
      }
    }

    return { synced: syncCount };
  }
);

interface ListPlansResponse {
  plans: Plan[];
}

export const listPlans = api(
  { method: "GET", path: "/plans", expose: true },
  async ({ activeOnly = true }: { activeOnly?: boolean }): Promise<ListPlansResponse> => {
    let query = "SELECT * FROM plans";
    const params: any[] = [];

    if (activeOnly) {
      query += " WHERE is_active = $1";
      params.push(true);
    }

    query += " ORDER BY amount ASC";

    const result = await db.rawQueryAll(query, ...params);

    return {
      plans: result.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        stripePriceId: row.stripe_price_id,
        amount: row.amount,
        currency: row.currency,
        interval: row.interval,
        intervalCount: row.interval_count,
        features: Array.isArray(row.features) ? row.features : [],
        isActive: row.is_active,
      }))
    };
  }
);

export const getPlan = api(
  { method: "GET", path: "/plans/:id", expose: true },
  async ({ id }: { id: string }): Promise<Plan> => {
    const result = await db.queryRow`
      SELECT * FROM plans WHERE id = ${id}
    `;

    if (!result) {
      throw new Error("Plan not found");
    }

    const plan = result;
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      stripePriceId: plan.stripe_price_id,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval,
      intervalCount: plan.interval_count,
      features: Array.isArray(plan.features) ? plan.features : [],
      isActive: plan.is_active,
    };
  }
);