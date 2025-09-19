import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePayment } from '../hooks/usePayment';
import { Package, RefreshCw, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function PlanManagement() {
  const { usePlans, syncPlansFromStripeMutation } = usePayment();
  const { toast } = useToast();

  const { data: plans, isLoading } = usePlans(false); // Show all plans, not just active

  const handleSyncPlans = async () => {
    try {
      const result = await syncPlansFromStripeMutation.mutateAsync();
      toast({
        title: 'Success',
        description: `Synced ${result.synced} plans from Stripe`,
      });
    } catch (error: any) {
      console.error('Error syncing plans:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync plans',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
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
          <h2 className="text-2xl font-bold text-foreground">Plan Management</h2>
          <p className="text-muted-foreground">Manage subscription plans and pricing</p>
        </div>
        
        <Button onClick={handleSyncPlans} disabled={syncPlansFromStripeMutation.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncPlansFromStripeMutation.isPending ? 'animate-spin' : ''}`} />
          Sync from Stripe
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Plans</CardTitle>
          <CardDescription>Available plans synced from your Stripe account</CardDescription>
        </CardHeader>
        <CardContent>
          {!plans || plans.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No plans found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sync your plans from Stripe to get started.
              </p>
              <Button className="mt-4" onClick={handleSyncPlans}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync from Stripe
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div key={plan.id} className="border rounded-lg p-6 relative">
                  <div className="absolute top-4 right-4">
                    {plan.isActive ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Check className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        <X className="mr-1 h-3 w-3" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-foreground">
                        {formatCurrency(plan.amount, plan.currency)}
                        <span className="text-base font-normal text-muted-foreground">
                          /{plan.intervalCount > 1 ? `${plan.intervalCount} ${plan.interval}s` : plan.interval}
                        </span>
                      </div>
                    </div>
                    
                    {plan.features.length > 0 && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Features:</h4>
                        <ul className="space-y-1">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-center">
                              <Check className="mr-2 h-3 w-3 text-green-600 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Stripe Price ID:</span>
                        <span className="font-mono text-xs text-foreground">{plan.stripePriceId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Billing Cycle:</span>
                        <span className="text-foreground">
                          {plan.intervalCount > 1 ? `Every ${plan.intervalCount} ${plan.interval}s` : `Every ${plan.interval}`}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Currency:</span>
                        <span className="text-foreground uppercase">{plan.currency}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan Statistics</CardTitle>
          <CardDescription>Overview of your subscription plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{plans?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total Plans</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {plans?.filter(p => p.isActive).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Active Plans</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {plans?.filter(p => p.interval === 'month').length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Monthly Plans</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {plans?.filter(p => p.interval === 'year').length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Yearly Plans</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}