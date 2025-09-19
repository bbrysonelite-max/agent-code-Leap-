import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { usePayment } from '../hooks/usePayment';
import { CreditCard, Plus, Calendar, DollarSign, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import type { CreateSubscriptionRequest, UpdateSubscriptionRequest } from '~backend/payment/types';

export function SubscriptionManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPriceId, setSelectedPriceId] = useState('');

  const { 
    useSubscriptions, 
    useCustomers, 
    usePlans,
    createSubscriptionMutation,
    updateSubscriptionMutation,
    cancelSubscriptionMutation
  } = usePayment();
  const { toast } = useToast();

  const { data: subscriptions, isLoading } = useSubscriptions();
  const { data: customers } = useCustomers();
  const { data: plans } = usePlans();

  const handleCreateSubscription = async () => {
    if (!selectedCustomerId || !selectedPriceId) return;

    try {
      const subscriptionData: CreateSubscriptionRequest = {
        customerId: selectedCustomerId,
        priceId: selectedPriceId,
      };

      await createSubscriptionMutation.mutateAsync(subscriptionData);
      setIsCreateDialogOpen(false);
      setSelectedCustomerId('');
      setSelectedPriceId('');
      
      toast({
        title: 'Success',
        description: 'Subscription created successfully',
      });
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create subscription',
        variant: 'destructive',
      });
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      await cancelSubscriptionMutation.mutateAsync(subscriptionId);
      toast({
        title: 'Success',
        description: 'Subscription canceled successfully',
      });
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel subscription',
        variant: 'destructive',
      });
    }
  };

  const handleToggleCancelAtPeriodEnd = async (subscriptionId: string, currentValue: boolean) => {
    try {
      const updateData: UpdateSubscriptionRequest = {
        subscriptionId,
        cancelAtPeriodEnd: !currentValue,
      };

      await updateSubscriptionMutation.mutateAsync({ id: subscriptionId, ...updateData });
      toast({
        title: 'Success',
        description: `Subscription ${!currentValue ? 'will be canceled' : 'will continue'} at period end`,
      });
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subscription',
        variant: 'destructive',
      });
    }
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer ? customer.name : 'Unknown Customer';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'trialing':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'past_due':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'canceled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Subscription Management</h2>
          <p className="text-muted-foreground">Manage customer subscriptions and billing cycles</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Subscription
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Subscription</DialogTitle>
              <DialogDescription>
                Create a new subscription for a customer
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customer">Customer</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="plan">Plan</Label>
                <Select value={selectedPriceId} onValueChange={setSelectedPriceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.stripePriceId}>
                        {plan.name} - ${(plan.amount / 100).toFixed(2)}/{plan.interval}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateSubscription}
                  disabled={!selectedCustomerId || !selectedPriceId}
                >
                  Create Subscription
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
          <CardDescription>Manage customer subscription plans and billing</CardDescription>
        </CardHeader>
        <CardContent>
          {!subscriptions || subscriptions.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No subscriptions found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by creating your first subscription.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-foreground">{subscription.planName}</h3>
                        <Badge variant="outline" className={getStatusColor(subscription.status)}>
                          {subscription.status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        Customer: {getCustomerName(subscription.customerId)}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {' '}
                            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {subscription.cancelAtPeriodEnd && (
                        <p className="text-sm text-orange-600">
                          ⚠️ Will be canceled at the end of the current period
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      {subscription.status === 'active' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleCancelAtPeriodEnd(subscription.id, subscription.cancelAtPeriodEnd)}
                          >
                            {subscription.cancelAtPeriodEnd ? 'Resume' : 'Cancel at Period End'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelSubscription(subscription.id)}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Cancel Now
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Subscription ID</p>
                        <p className="font-mono text-xs text-foreground">{subscription.id}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Stripe ID</p>
                        <p className="font-mono text-xs text-foreground">{subscription.stripeSubscriptionId}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="text-foreground">{new Date(subscription.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Updated</p>
                        <p className="text-foreground">{new Date(subscription.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}