export interface Customer {
  id: string;
  stripeCustomerId: string;
  email: string;
  name: string;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  customerId: string;
  stripeSubscriptionId: string;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  priceId: string;
  planName: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  customerId: string;
  stripePaymentMethodId: string;
  type: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  customerId: string;
  stripeInvoiceId: string;
  subscriptionId?: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amountDue: number;
  amountPaid: number;
  currency: string;
  dueDate?: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  createdAt: Date;
}

export interface CreateCustomerRequest {
  email: string;
  name: string;
  clientId: string;
}

export interface CreateSubscriptionRequest {
  customerId: string;
  priceId: string;
  paymentMethodId?: string;
}

export interface UpdateSubscriptionRequest {
  subscriptionId: string;
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface CreatePaymentIntentRequest {
  customerId: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  stripePriceId: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  intervalCount: number;
  features: string[];
  isActive: boolean;
}