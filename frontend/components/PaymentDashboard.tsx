import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePayment } from '../hooks/usePayment';
import { CustomerManagement } from './CustomerManagement';
import { SubscriptionManagement } from './SubscriptionManagement';
import { InvoiceManagement } from './InvoiceManagement';
import { PlanManagement } from './PlanManagement';
import { PaymentSettings } from './PaymentSettings';
import { CreditCard, Users, FileText, Package, Settings, DollarSign } from 'lucide-react';

export function PaymentDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { useCustomers, useSubscriptions, useInvoices, usePlans } = usePayment();

  const { data: customers } = useCustomers();
  const { data: subscriptions } = useSubscriptions();
  const { data: invoices } = useInvoices();
  const { data: plans } = usePlans();

  const activeSubscriptions = subscriptions?.filter(sub => sub.status === 'active') || [];
  const paidInvoices = invoices?.filter(inv => inv.status === 'paid') || [];
  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

  const stats = [
    {
      title: 'Total Customers',
      value: customers?.length || 0,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Active Subscriptions',
      value: activeSubscriptions.length,
      icon: CreditCard,
      color: 'text-green-600',
    },
    {
      title: 'Total Revenue',
      value: `$${(totalRevenue / 100).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-purple-600',
    },
    {
      title: 'Invoices',
      value: invoices?.length || 0,
      icon: FileText,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payment Dashboard</h1>
          <p className="text-muted-foreground">Manage your billing, subscriptions, and revenue</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Subscriptions</CardTitle>
                <CardDescription>Latest subscription activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeSubscriptions.slice(0, 5).map((subscription) => (
                    <div key={subscription.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{subscription.planName}</p>
                        <p className="text-sm text-muted-foreground">
                          {subscription.customerId}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {subscription.status}
                      </Badge>
                    </div>
                  ))}
                  {activeSubscriptions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No active subscriptions</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Invoices</CardTitle>
                <CardDescription>Latest billing activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {invoices?.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          ${(invoice.amountDue / 100).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge 
                        variant="outline"
                        className={
                          invoice.status === 'paid' 
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : invoice.status === 'open'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                  ))}
                  {(!invoices || invoices.length === 0) && (
                    <p className="text-sm text-muted-foreground">No invoices found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>Current subscription plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans?.map((plan) => (
                  <div key={plan.id} className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-foreground">{plan.name}</h3>
                    <p className="text-2xl font-bold text-foreground">
                      ${(plan.amount / 100).toFixed(2)}
                      <span className="text-sm text-muted-foreground">/{plan.interval}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                    {plan.features.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {plan.features.slice(0, 3).map((feature, index) => (
                          <li key={index} className="text-xs text-muted-foreground">• {feature}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {(!plans || plans.length === 0) && (
                  <p className="text-sm text-muted-foreground col-span-3">No plans available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <CustomerManagement />
        </TabsContent>

        <TabsContent value="subscriptions">
          <SubscriptionManagement />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoiceManagement />
        </TabsContent>

        <TabsContent value="plans">
          <PlanManagement />
        </TabsContent>

        <TabsContent value="settings">
          <PaymentSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}