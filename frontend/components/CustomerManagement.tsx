import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { usePayment } from '../hooks/usePayment';
import { Plus, Search, User, Mail, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import type { CreateCustomerRequest } from '~backend/payment/types';

export function CustomerManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<CreateCustomerRequest>({
    email: '',
    name: '',
    clientId: '',
  });

  const { useCustomers, createCustomerMutation, useSubscriptions } = usePayment();
  const { toast } = useToast();

  const { data: customers, isLoading } = useCustomers();
  const { data: allSubscriptions } = useSubscriptions();

  const filteredCustomers = customers?.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getCustomerSubscriptions = (customerId: string) => {
    return allSubscriptions?.filter(sub => sub.customerId === customerId) || [];
  };

  const handleCreateCustomer = async () => {
    try {
      await createCustomerMutation.mutateAsync(newCustomer);
      setIsCreateDialogOpen(false);
      setNewCustomer({ email: '', name: '', clientId: '' });
      toast({
        title: 'Success',
        description: 'Customer created successfully',
      });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create customer',
        variant: 'destructive',
      });
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
          <h2 className="text-2xl font-bold text-foreground">Customer Management</h2>
          <p className="text-muted-foreground">Manage your customer base and billing information</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Customer</DialogTitle>
              <DialogDescription>
                Add a new customer to your billing system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={newCustomer.clientId}
                  onChange={(e) => setNewCustomer({ ...newCustomer, clientId: e.target.value })}
                  placeholder="Client identifier"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateCustomer}
                  disabled={!newCustomer.name || !newCustomer.email || !newCustomer.clientId}
                >
                  Create Customer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No customers found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {customers?.length === 0 ? 'Get started by creating your first customer.' : 'Try adjusting your search terms.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map((customer) => {
                const customerSubscriptions = getCustomerSubscriptions(customer.id);
                const activeSubscriptions = customerSubscriptions.filter(sub => sub.status === 'active');
                
                return (
                  <div key={customer.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-foreground">{customer.name}</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Joined {new Date(customer.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-2">
                        <div className="flex space-x-2">
                          {activeSubscriptions.length > 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {activeSubscriptions.length} Active Subscription{activeSubscriptions.length !== 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                              No Active Subscriptions
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Stripe ID: {customer.stripeCustomerId}
                        </p>
                      </div>
                    </div>
                    
                    {customerSubscriptions.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-medium text-foreground mb-2">Subscriptions</h4>
                        <div className="space-y-2">
                          {customerSubscriptions.map((subscription) => (
                            <div key={subscription.id} className="flex items-center justify-between text-sm">
                              <span className="text-foreground">{subscription.planName}</span>
                              <Badge 
                                variant="outline"
                                className={
                                  subscription.status === 'active' 
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : subscription.status === 'trialing'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }
                              >
                                {subscription.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}