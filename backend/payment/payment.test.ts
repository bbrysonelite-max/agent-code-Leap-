/**
 * AI Lead OS - Payment Service Tests
 * Tests for Stripe integration, subscriptions, customers, and billing
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// TYPES
// ============================================

interface Customer {
  id: string;
  email: string;
  name?: string;
  stripeCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Subscription {
  id: string;
  customerId: string;
  stripeSubscriptionId: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
  priceId: string;
  planName: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Plan {
  id: string;
  name: string;
  priceId: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

interface Invoice {
  id: string;
  customerId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoiceUrl?: string;
  pdfUrl?: string;
  createdAt: Date;
  paidAt?: Date;
}

interface PaymentIntent {
  id: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled';
  customerId?: string;
}

interface CreateCustomerRequest {
  email: string;
  name?: string;
  paymentMethodId?: string;
}

interface CreateSubscriptionRequest {
  customerId: string;
  priceId: string;
  paymentMethodId?: string;
}

interface UpdateSubscriptionRequest {
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
}

// ============================================
// MOCK STRIPE API
// ============================================

class MockStripeAPI {
  private customers: Map<string, any> = new Map();
  private subscriptions: Map<string, any> = new Map();
  private prices: Map<string, any> = new Map();
  private products: Map<string, any> = new Map();
  private paymentMethods: Map<string, any> = new Map();
  private invoices: Map<string, any> = new Map();

  private nextCustomerId = 1;
  private nextSubscriptionId = 1;
  private nextInvoiceId = 1;

  constructor() {
    // Setup default prices and products
    this.products.set('prod_starter', { id: 'prod_starter', name: 'Starter Plan' });
    this.products.set('prod_pro', { id: 'prod_pro', name: 'Pro Plan' });
    this.products.set('prod_enterprise', { id: 'prod_enterprise', name: 'Enterprise Plan' });

    this.prices.set('price_starter_monthly', {
      id: 'price_starter_monthly',
      product: 'prod_starter',
      unit_amount: 4900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    this.prices.set('price_pro_monthly', {
      id: 'price_pro_monthly',
      product: 'prod_pro',
      unit_amount: 9900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    this.prices.set('price_enterprise_monthly', {
      id: 'price_enterprise_monthly',
      product: 'prod_enterprise',
      unit_amount: 29900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
  }

  // Customer Methods
  async createCustomer(params: { email: string; name?: string; payment_method?: string }): Promise<any> {
    const id = `cus_${this.nextCustomerId++}`;
    const customer = {
      id,
      email: params.email,
      name: params.name,
      default_payment_method: params.payment_method,
      created: Math.floor(Date.now() / 1000),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async retrieveCustomer(id: string): Promise<any> {
    const customer = this.customers.get(id);
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async updateCustomer(id: string, params: any): Promise<any> {
    const customer = this.customers.get(id);
    if (!customer) throw new Error('Customer not found');
    Object.assign(customer, params);
    return customer;
  }

  async deleteCustomer(id: string): Promise<any> {
    if (!this.customers.has(id)) throw new Error('Customer not found');
    this.customers.delete(id);
    return { id, deleted: true };
  }

  // Subscription Methods
  async createSubscription(params: any): Promise<any> {
    const id = `sub_${this.nextSubscriptionId++}`;
    const now = Math.floor(Date.now() / 1000);
    const periodEnd = now + 30 * 24 * 60 * 60; // 30 days

    const subscription = {
      id,
      customer: params.customer,
      status: 'active',
      current_period_start: now,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      items: {
        data: [{
          id: `si_${this.nextSubscriptionId}`,
          price: this.prices.get(params.items[0].price),
        }],
      },
      latest_invoice: {
        payment_intent: {
          client_secret: `pi_secret_${Date.now()}`,
        },
      },
    };

    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async retrieveSubscription(id: string): Promise<any> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) throw new Error('Subscription not found');
    return subscription;
  }

  async updateSubscription(id: string, params: any): Promise<any> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) throw new Error('Subscription not found');

    if (params.items) {
      subscription.items.data[0].price = this.prices.get(params.items[0].price);
    }
    if (params.cancel_at_period_end !== undefined) {
      subscription.cancel_at_period_end = params.cancel_at_period_end;
    }

    return subscription;
  }

  async cancelSubscription(id: string): Promise<any> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) throw new Error('Subscription not found');
    subscription.status = 'canceled';
    return subscription;
  }

  // Price & Product Methods
  async retrievePrice(id: string): Promise<any> {
    const price = this.prices.get(id);
    if (!price) throw new Error('Price not found');
    return price;
  }

  async retrieveProduct(id: string): Promise<any> {
    const product = this.products.get(id);
    if (!product) throw new Error('Product not found');
    return product;
  }

  // Invoice Methods
  async createInvoice(params: { customer: string }): Promise<any> {
    const id = `inv_${this.nextInvoiceId++}`;
    const invoice = {
      id,
      customer: params.customer,
      status: 'draft',
      amount_due: 0,
      currency: 'usd',
      created: Math.floor(Date.now() / 1000),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async retrieveInvoice(id: string): Promise<any> {
    const invoice = this.invoices.get(id);
    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  async listInvoices(params: { customer?: string }): Promise<any> {
    const invoices = Array.from(this.invoices.values());
    if (params.customer) {
      return { data: invoices.filter(i => i.customer === params.customer) };
    }
    return { data: invoices };
  }
}

// ============================================
// MOCK DATABASE
// ============================================

interface MockDB {
  customers: Customer[];
  subscriptions: Subscription[];
  invoices: Invoice[];
}

let mockDB: MockDB;
let mockStripe: MockStripeAPI;
let nextDbId = 1;

function resetMocks() {
  mockDB = {
    customers: [],
    subscriptions: [],
    invoices: [],
  };
  mockStripe = new MockStripeAPI();
  nextDbId = 1;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

async function createCustomer(req: CreateCustomerRequest): Promise<Customer> {
  // Create in Stripe
  const stripeCustomer = await mockStripe.createCustomer({
    email: req.email,
    name: req.name,
    payment_method: req.paymentMethodId,
  });

  // Create in DB
  const customer: Customer = {
    id: `customer_${nextDbId++}`,
    email: req.email,
    name: req.name,
    stripeCustomerId: stripeCustomer.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockDB.customers.push(customer);
  return customer;
}

async function getCustomer(id: string): Promise<Customer> {
  const customer = mockDB.customers.find(c => c.id === id);
  if (!customer) throw new Error('Customer not found');
  return customer;
}

async function deleteCustomer(id: string): Promise<{ success: boolean }> {
  const customer = await getCustomer(id);
  await mockStripe.deleteCustomer(customer.stripeCustomerId);

  const index = mockDB.customers.findIndex(c => c.id === id);
  mockDB.customers.splice(index, 1);

  return { success: true };
}

async function createSubscription(req: CreateSubscriptionRequest): Promise<Subscription> {
  const customer = await getCustomer(req.customerId);

  // Create in Stripe
  const stripeSubscription = await mockStripe.createSubscription({
    customer: customer.stripeCustomerId,
    items: [{ price: req.priceId }],
    default_payment_method: req.paymentMethodId,
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });

  // Get plan name
  const price = await mockStripe.retrievePrice(req.priceId);
  const product = await mockStripe.retrieveProduct(price.product);

  // Create in DB
  const subscription: Subscription = {
    id: `subscription_${nextDbId++}`,
    customerId: req.customerId,
    stripeSubscriptionId: stripeSubscription.id,
    status: stripeSubscription.status,
    priceId: req.priceId,
    planName: product.name,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockDB.subscriptions.push(subscription);
  return subscription;
}

async function getSubscription(id: string): Promise<Subscription> {
  const subscription = mockDB.subscriptions.find(s => s.id === id);
  if (!subscription) throw new Error('Subscription not found');
  return subscription;
}

async function updateSubscription(id: string, req: UpdateSubscriptionRequest): Promise<Subscription> {
  const subscription = await getSubscription(id);

  // Update in Stripe
  const updateParams: any = {};
  if (req.priceId) {
    const currentSub = await mockStripe.retrieveSubscription(subscription.stripeSubscriptionId);
    updateParams.items = [{
      id: currentSub.items.data[0].id,
      price: req.priceId,
    }];
  }
  if (req.cancelAtPeriodEnd !== undefined) {
    updateParams.cancel_at_period_end = req.cancelAtPeriodEnd;
  }

  await mockStripe.updateSubscription(subscription.stripeSubscriptionId, updateParams);

  // Update in DB
  if (req.priceId) {
    const price = await mockStripe.retrievePrice(req.priceId);
    const product = await mockStripe.retrieveProduct(price.product);
    subscription.priceId = req.priceId;
    subscription.planName = product.name;
  }
  if (req.cancelAtPeriodEnd !== undefined) {
    subscription.cancelAtPeriodEnd = req.cancelAtPeriodEnd;
  }
  subscription.updatedAt = new Date();

  return subscription;
}

async function cancelSubscription(id: string): Promise<{ success: boolean }> {
  const subscription = await getSubscription(id);

  await mockStripe.cancelSubscription(subscription.stripeSubscriptionId);

  subscription.status = 'canceled';
  subscription.updatedAt = new Date();

  return { success: true };
}

async function listSubscriptions(customerId?: string): Promise<{ subscriptions: Subscription[] }> {
  let subscriptions = [...mockDB.subscriptions];

  if (customerId) {
    subscriptions = subscriptions.filter(s => s.customerId === customerId);
  }

  return { subscriptions };
}

// ============================================
// CUSTOMER TESTS
// ============================================

describe('Customer Management', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    resetMocks();
  });

  describe('Customer Creation', () => {
    it('should create a customer', async () => {
      const customer = await createCustomer({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(customer.id).toBeDefined();
      expect(customer.email).toBe('test@example.com');
      expect(customer.name).toBe('Test User');
      expect(customer.stripeCustomerId).toMatch(/^cus_/);
    });

    it('should create customer without name', async () => {
      const customer = await createCustomer({
        email: 'noname@example.com',
      });

      expect(customer.email).toBe('noname@example.com');
      expect(customer.name).toBeUndefined();
    });

    it('should store customer in database', async () => {
      await createCustomer({ email: 'stored@example.com' });

      expect(mockDB.customers).toHaveLength(1);
      expect(mockDB.customers[0].email).toBe('stored@example.com');
    });

    it('should create corresponding Stripe customer', async () => {
      const customer = await createCustomer({ email: 'stripe@example.com' });

      const stripeCustomer = await mockStripe.retrieveCustomer(customer.stripeCustomerId);
      expect(stripeCustomer.email).toBe('stripe@example.com');
    });
  });

  describe('Customer Retrieval', () => {
    it('should get customer by ID', async () => {
      const created = await createCustomer({ email: 'get@example.com' });
      const retrieved = await getCustomer(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.email).toBe('get@example.com');
    });

    it('should throw for non-existent customer', async () => {
      await expect(getCustomer('non_existent')).rejects.toThrow('Customer not found');
    });
  });

  describe('Customer Deletion', () => {
    it('should delete customer', async () => {
      const customer = await createCustomer({ email: 'delete@example.com' });

      const result = await deleteCustomer(customer.id);

      expect(result.success).toBe(true);
      expect(mockDB.customers).toHaveLength(0);
    });

    it('should delete from Stripe', async () => {
      const customer = await createCustomer({ email: 'stripe-delete@example.com' });
      await deleteCustomer(customer.id);

      await expect(mockStripe.retrieveCustomer(customer.stripeCustomerId)).rejects.toThrow();
    });
  });
});

// ============================================
// SUBSCRIPTION TESTS
// ============================================

describe('Subscription Management', () => {
  let testCustomer: Customer;

  beforeEach(async () => {
    resetMocks();
    testCustomer = await createCustomer({ email: 'subscriber@example.com' });
  });

  describe('Subscription Creation', () => {
    it('should create a subscription', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      expect(subscription.id).toBeDefined();
      expect(subscription.customerId).toBe(testCustomer.id);
      expect(subscription.status).toBe('active');
      expect(subscription.planName).toBe('Starter Plan');
    });

    it('should set correct period dates', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      expect(subscription.currentPeriodStart).toBeInstanceOf(Date);
      expect(subscription.currentPeriodEnd).toBeInstanceOf(Date);
      expect(subscription.currentPeriodEnd > subscription.currentPeriodStart).toBe(true);
    });

    it('should link to Stripe subscription', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      expect(subscription.stripeSubscriptionId).toMatch(/^sub_/);

      const stripeSub = await mockStripe.retrieveSubscription(subscription.stripeSubscriptionId);
      expect(stripeSub).toBeDefined();
    });

    it('should create different plan subscriptions', async () => {
      const starter = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      const customer2 = await createCustomer({ email: 'pro@example.com' });
      const pro = await createSubscription({
        customerId: customer2.id,
        priceId: 'price_pro_monthly',
      });

      expect(starter.planName).toBe('Starter Plan');
      expect(pro.planName).toBe('Pro Plan');
    });
  });

  describe('Subscription Retrieval', () => {
    it('should get subscription by ID', async () => {
      const created = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      const retrieved = await getSubscription(created.id);

      expect(retrieved.id).toBe(created.id);
    });

    it('should list all subscriptions', async () => {
      await createSubscription({ customerId: testCustomer.id, priceId: 'price_starter_monthly' });

      const customer2 = await createCustomer({ email: 'sub2@example.com' });
      await createSubscription({ customerId: customer2.id, priceId: 'price_pro_monthly' });

      const { subscriptions } = await listSubscriptions();

      expect(subscriptions).toHaveLength(2);
    });

    it('should list subscriptions by customer', async () => {
      await createSubscription({ customerId: testCustomer.id, priceId: 'price_starter_monthly' });

      const customer2 = await createCustomer({ email: 'sub3@example.com' });
      await createSubscription({ customerId: customer2.id, priceId: 'price_pro_monthly' });

      const { subscriptions } = await listSubscriptions(testCustomer.id);

      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].customerId).toBe(testCustomer.id);
    });
  });

  describe('Subscription Update', () => {
    it('should upgrade subscription', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      const updated = await updateSubscription(subscription.id, {
        priceId: 'price_pro_monthly',
      });

      expect(updated.priceId).toBe('price_pro_monthly');
      expect(updated.planName).toBe('Pro Plan');
    });

    it('should downgrade subscription', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_pro_monthly',
      });

      const updated = await updateSubscription(subscription.id, {
        priceId: 'price_starter_monthly',
      });

      expect(updated.priceId).toBe('price_starter_monthly');
    });

    it('should set cancel at period end', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      expect(subscription.cancelAtPeriodEnd).toBe(false);

      const updated = await updateSubscription(subscription.id, {
        cancelAtPeriodEnd: true,
      });

      expect(updated.cancelAtPeriodEnd).toBe(true);
    });

    it('should resume subscription', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      await updateSubscription(subscription.id, { cancelAtPeriodEnd: true });
      const resumed = await updateSubscription(subscription.id, { cancelAtPeriodEnd: false });

      expect(resumed.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe('Subscription Cancellation', () => {
    it('should cancel subscription', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      const result = await cancelSubscription(subscription.id);

      expect(result.success).toBe(true);
      expect(subscription.status).toBe('canceled');
    });

    it('should update Stripe subscription', async () => {
      const subscription = await createSubscription({
        customerId: testCustomer.id,
        priceId: 'price_starter_monthly',
      });

      await cancelSubscription(subscription.id);

      const stripeSub = await mockStripe.retrieveSubscription(subscription.stripeSubscriptionId);
      expect(stripeSub.status).toBe('canceled');
    });
  });
});

// ============================================
// PLAN TESTS
// ============================================

describe('Plans', () => {
  beforeEach(() => {
    resetMocks();
  });

  const PLANS: Plan[] = [
    {
      id: 'starter',
      name: 'Starter Plan',
      priceId: 'price_starter_monthly',
      amount: 4900,
      currency: 'usd',
      interval: 'month',
      features: ['100 leads/month', '1 user', 'Email outreach', 'Basic analytics'],
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      priceId: 'price_pro_monthly',
      amount: 9900,
      currency: 'usd',
      interval: 'month',
      features: ['1000 leads/month', '5 users', 'Email + SMS outreach', 'Advanced analytics', 'API access'],
    },
    {
      id: 'enterprise',
      name: 'Enterprise Plan',
      priceId: 'price_enterprise_monthly',
      amount: 29900,
      currency: 'usd',
      interval: 'month',
      features: ['Unlimited leads', 'Unlimited users', 'All channels', 'Custom integrations', 'Dedicated support'],
    },
  ];

  it('should have three plan tiers', () => {
    expect(PLANS).toHaveLength(3);
  });

  it('should have correct pricing', () => {
    expect(PLANS.find(p => p.id === 'starter')?.amount).toBe(4900);
    expect(PLANS.find(p => p.id === 'pro')?.amount).toBe(9900);
    expect(PLANS.find(p => p.id === 'enterprise')?.amount).toBe(29900);
  });

  it('should have features for each plan', () => {
    PLANS.forEach(plan => {
      expect(plan.features.length).toBeGreaterThan(0);
    });
  });

  it('should retrieve plan from Stripe', async () => {
    const price = await mockStripe.retrievePrice('price_starter_monthly');
    const product = await mockStripe.retrieveProduct(price.product);

    expect(price.unit_amount).toBe(4900);
    expect(product.name).toBe('Starter Plan');
  });
});

// ============================================
// BILLING WORKFLOW TESTS
// ============================================

describe('Billing Workflows', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should complete full signup workflow', async () => {
    // 1. Create customer
    const customer = await createCustomer({
      email: 'newuser@example.com',
      name: 'New User',
    });

    expect(customer.id).toBeDefined();

    // 2. Create subscription
    const subscription = await createSubscription({
      customerId: customer.id,
      priceId: 'price_starter_monthly',
    });

    expect(subscription.status).toBe('active');

    // 3. Verify setup
    const retrieved = await getCustomer(customer.id);
    const subs = await listSubscriptions(customer.id);

    expect(retrieved.email).toBe('newuser@example.com');
    expect(subs.subscriptions).toHaveLength(1);
  });

  it('should handle upgrade workflow', async () => {
    // Setup customer with starter plan
    const customer = await createCustomer({ email: 'upgrader@example.com' });
    const subscription = await createSubscription({
      customerId: customer.id,
      priceId: 'price_starter_monthly',
    });

    expect(subscription.planName).toBe('Starter Plan');

    // Upgrade to pro
    const upgraded = await updateSubscription(subscription.id, {
      priceId: 'price_pro_monthly',
    });

    expect(upgraded.planName).toBe('Pro Plan');
    expect(upgraded.priceId).toBe('price_pro_monthly');
  });

  it('should handle cancellation workflow', async () => {
    // Setup
    const customer = await createCustomer({ email: 'canceler@example.com' });
    const subscription = await createSubscription({
      customerId: customer.id,
      priceId: 'price_pro_monthly',
    });

    // Schedule cancellation
    await updateSubscription(subscription.id, { cancelAtPeriodEnd: true });

    // Verify subscription will cancel but still active
    expect(subscription.status).toBe('active');
    expect(subscription.cancelAtPeriodEnd).toBe(true);
  });

  it('should handle immediate cancellation', async () => {
    const customer = await createCustomer({ email: 'immediate@example.com' });
    const subscription = await createSubscription({
      customerId: customer.id,
      priceId: 'price_starter_monthly',
    });

    await cancelSubscription(subscription.id);

    expect(subscription.status).toBe('canceled');
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('Error Handling', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should handle non-existent customer', async () => {
    await expect(getCustomer('invalid_id')).rejects.toThrow('Customer not found');
  });

  it('should handle non-existent subscription', async () => {
    await expect(getSubscription('invalid_id')).rejects.toThrow('Subscription not found');
  });

  it('should handle invalid price ID', async () => {
    const customer = await createCustomer({ email: 'error@example.com' });

    await expect(createSubscription({
      customerId: customer.id,
      priceId: 'invalid_price',
    })).rejects.toThrow();
  });

  it('should handle double cancellation', async () => {
    const customer = await createCustomer({ email: 'double@example.com' });
    const subscription = await createSubscription({
      customerId: customer.id,
      priceId: 'price_starter_monthly',
    });

    await cancelSubscription(subscription.id);

    // Second cancellation should still work (idempotent)
    const result = await cancelSubscription(subscription.id);
    expect(result.success).toBe(true);
  });
});

// ============================================
// WEBHOOK SIMULATION TESTS
// ============================================

describe('Webhook Handling', () => {
  beforeEach(() => {
    resetMocks();
  });

  interface WebhookEvent {
    type: string;
    data: {
      object: any;
    };
  }

  function simulateWebhook(event: WebhookEvent): void {
    switch (event.type) {
      case 'customer.subscription.updated':
        const subData = event.data.object;
        const sub = mockDB.subscriptions.find(s => s.stripeSubscriptionId === subData.id);
        if (sub) {
          sub.status = subData.status;
          sub.cancelAtPeriodEnd = subData.cancel_at_period_end;
          sub.updatedAt = new Date();
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSub = event.data.object;
        const toDelete = mockDB.subscriptions.find(s => s.stripeSubscriptionId === deletedSub.id);
        if (toDelete) {
          toDelete.status = 'canceled';
        }
        break;

      case 'invoice.paid':
        const invoice = event.data.object;
        mockDB.invoices.push({
          id: `invoice_${Date.now()}`,
          customerId: invoice.customer,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'paid',
          createdAt: new Date(),
          paidAt: new Date(),
        });
        break;
    }
  }

  it('should handle subscription.updated webhook', async () => {
    const customer = await createCustomer({ email: 'webhook@example.com' });
    const subscription = await createSubscription({
      customerId: customer.id,
      priceId: 'price_starter_monthly',
    });

    simulateWebhook({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: subscription.stripeSubscriptionId,
          status: 'past_due',
          cancel_at_period_end: false,
        },
      },
    });

    expect(subscription.status).toBe('past_due');
  });

  it('should handle subscription.deleted webhook', async () => {
    const customer = await createCustomer({ email: 'deleted@example.com' });
    const subscription = await createSubscription({
      customerId: customer.id,
      priceId: 'price_starter_monthly',
    });

    simulateWebhook({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: subscription.stripeSubscriptionId,
        },
      },
    });

    expect(subscription.status).toBe('canceled');
  });

  it('should handle invoice.paid webhook', async () => {
    const customer = await createCustomer({ email: 'paid@example.com' });

    simulateWebhook({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'inv_test123',
          customer: customer.stripeCustomerId,
          amount_paid: 4900,
          currency: 'usd',
        },
      },
    });

    expect(mockDB.invoices).toHaveLength(1);
    expect(mockDB.invoices[0].status).toBe('paid');
    expect(mockDB.invoices[0].amount).toBe(4900);
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should handle bulk customer creation', async () => {
    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      await createCustomer({ email: `bulk${i}@example.com` });
    }

    const duration = Date.now() - start;

    expect(mockDB.customers).toHaveLength(100);
    expect(duration).toBeLessThan(1000);
  });

  it('should handle bulk subscription listing', async () => {
    // Create 50 customers with subscriptions
    for (let i = 0; i < 50; i++) {
      const customer = await createCustomer({ email: `list${i}@example.com` });
      await createSubscription({ customerId: customer.id, priceId: 'price_starter_monthly' });
    }

    const start = Date.now();
    const { subscriptions } = await listSubscriptions();
    const duration = Date.now() - start;

    expect(subscriptions).toHaveLength(50);
    expect(duration).toBeLessThan(100);
  });
});
