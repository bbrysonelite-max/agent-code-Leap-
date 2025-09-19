import { api } from "encore.dev/api";
import { db } from "./db";
import { stripe } from "./stripe";
import type { CreatePaymentIntentRequest } from "./types";

export const createPaymentIntent = api(
  { method: "POST", path: "/payment-intents", expose: true },
  async (req: CreatePaymentIntentRequest): Promise<{ clientSecret: string; paymentIntentId: string }> => {
    // Get customer from database
    const customerResult = await db.queryRow`
      SELECT stripe_customer_id FROM customers WHERE id = ${req.customerId}
    `;

    if (!customerResult) {
      throw new Error("Customer not found");
    }

    const stripeCustomerId = customerResult.stripe_customer_id;

    // Create payment intent in Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.amount,
      currency: req.currency,
      customer: stripeCustomerId,
      description: req.description,
      metadata: req.metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret || "",
      paymentIntentId: paymentIntent.id,
    };
  }
);

export const confirmPaymentIntent = api(
  { method: "POST", path: "/payment-intents/:id/confirm", expose: true },
  async ({ id, paymentMethodId }: { id: string; paymentMethodId?: string }): Promise<{ status: string }> => {
    const confirmParams: any = {};
    
    if (paymentMethodId) {
      confirmParams.payment_method = paymentMethodId;
    }

    const paymentIntent = await stripe.paymentIntents.confirm(id, confirmParams);

    return {
      status: paymentIntent.status,
    };
  }
);

interface GetPaymentIntentResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  metadata: Record<string, string>;
  created: number;
}

export const getPaymentIntent = api(
  { method: "GET", path: "/payment-intents/:id", expose: true },
  async ({ id }: { id: string }): Promise<GetPaymentIntentResponse> => {
    const paymentIntent = await stripe.paymentIntents.retrieve(id);
    
    return {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      description: paymentIntent.description || undefined,
      metadata: paymentIntent.metadata || {},
      created: paymentIntent.created,
    };
  }
);