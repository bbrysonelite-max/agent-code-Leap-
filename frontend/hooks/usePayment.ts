import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import type { 
  Customer, 
  Subscription, 
  Plan, 
  Invoice,
  CreateCustomerRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CreatePaymentIntentRequest
} from '~backend/payment/types';

export function usePayment() {
  const queryClient = useQueryClient();

  // Customers
  const useCustomers = (clientId?: string) => {
    return useQuery({
      queryKey: ['customers', clientId],
      queryFn: async () => {
        const result = await backend.payment.listCustomers({ clientId });
        return result.customers;
      },
    });
  };

  const useCustomer = (id: string) => {
    return useQuery({
      queryKey: ['customer', id],
      queryFn: () => backend.payment.getCustomer({ id }),
      enabled: !!id,
    });
  };

  const useCustomerByEmail = (email: string) => {
    return useQuery({
      queryKey: ['customer', 'email', email],
      queryFn: async () => {
        const result = await backend.payment.getCustomerByEmail({ email });
        return result.customer;
      },
      enabled: !!email,
    });
  };

  const createCustomerMutation = useMutation({
    mutationFn: (data: CreateCustomerRequest) => backend.payment.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  // Subscriptions
  const useSubscriptions = (customerId?: string) => {
    return useQuery({
      queryKey: ['subscriptions', customerId],
      queryFn: async () => {
        const result = await backend.payment.listSubscriptions({ customerId });
        return result.subscriptions;
      },
    });
  };

  const useSubscription = (id: string) => {
    return useQuery({
      queryKey: ['subscription', id],
      queryFn: () => backend.payment.getSubscription({ id }),
      enabled: !!id,
    });
  };

  const createSubscriptionMutation = useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => backend.payment.createSubscription(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateSubscriptionRequest) => 
      backend.payment.updateSubscription({ id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: (id: string) => backend.payment.cancelSubscription({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  // Plans
  const usePlans = (activeOnly = true) => {
    return useQuery({
      queryKey: ['plans', activeOnly],
      queryFn: async () => {
        const result = await backend.payment.listPlans({ activeOnly });
        return result.plans;
      },
    });
  };

  const usePlan = (id: string) => {
    return useQuery({
      queryKey: ['plan', id],
      queryFn: () => backend.payment.getPlan({ id }),
      enabled: !!id,
    });
  };

  const syncPlansFromStripeMutation = useMutation({
    mutationFn: () => backend.payment.syncPlansFromStripe(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  // Invoices
  const useInvoices = (customerId?: string, subscriptionId?: string) => {
    return useQuery({
      queryKey: ['invoices', customerId, subscriptionId],
      queryFn: async () => {
        const result = await backend.payment.listInvoices({ customerId, subscriptionId });
        return result.invoices;
      },
    });
  };

  const useInvoice = (id: string) => {
    return useQuery({
      queryKey: ['invoice', id],
      queryFn: () => backend.payment.getInvoice({ id }),
      enabled: !!id,
    });
  };

  const createInvoiceMutation = useMutation({
    mutationFn: (data: { 
      customerId: string; 
      items: Array<{ description: string; amount: number; quantity?: number }>; 
      description?: string;
    }) => backend.payment.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const finalizeInvoiceMutation = useMutation({
    mutationFn: (id: string) => backend.payment.finalizeInvoice({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
    },
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: (id: string) => backend.payment.sendInvoice({ id }),
  });

  // Payment Intents
  const createPaymentIntentMutation = useMutation({
    mutationFn: (data: CreatePaymentIntentRequest) => backend.payment.createPaymentIntent(data),
  });

  const confirmPaymentIntentMutation = useMutation({
    mutationFn: (data: { id: string; paymentMethodId?: string }) => 
      backend.payment.confirmPaymentIntent(data),
  });

  const usePaymentIntent = (id: string) => {
    return useQuery({
      queryKey: ['paymentIntent', id],
      queryFn: () => backend.payment.getPaymentIntent({ id }),
      enabled: !!id,
    });
  };

  return {
    // Customers
    useCustomers,
    useCustomer,
    useCustomerByEmail,
    createCustomer: createCustomerMutation.mutateAsync,
    createCustomerMutation,

    // Subscriptions
    useSubscriptions,
    useSubscription,
    createSubscription: createSubscriptionMutation.mutateAsync,
    createSubscriptionMutation,
    updateSubscription: updateSubscriptionMutation.mutateAsync,
    updateSubscriptionMutation,
    cancelSubscription: cancelSubscriptionMutation.mutateAsync,
    cancelSubscriptionMutation,

    // Plans
    usePlans,
    usePlan,
    syncPlansFromStripe: syncPlansFromStripeMutation.mutateAsync,
    syncPlansFromStripeMutation,

    // Invoices
    useInvoices,
    useInvoice,
    createInvoice: createInvoiceMutation.mutateAsync,
    createInvoiceMutation,
    finalizeInvoice: finalizeInvoiceMutation.mutateAsync,
    finalizeInvoiceMutation,
    sendInvoice: sendInvoiceMutation.mutateAsync,
    sendInvoiceMutation,

    // Payment Intents
    createPaymentIntent: createPaymentIntentMutation.mutateAsync,
    createPaymentIntentMutation,
    confirmPaymentIntent: confirmPaymentIntentMutation.mutateAsync,
    confirmPaymentIntentMutation,
    usePaymentIntent,
  };
}