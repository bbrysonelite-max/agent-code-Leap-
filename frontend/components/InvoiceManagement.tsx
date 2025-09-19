import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePayment } from '../hooks/usePayment';
import { FileText, Plus, Send, Check, ExternalLink, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function InvoiceManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([{ description: '', amount: 0, quantity: 1 }]);

  const { 
    useInvoices, 
    useCustomers,
    createInvoiceMutation,
    finalizeInvoiceMutation,
    sendInvoiceMutation
  } = usePayment();
  const { toast } = useToast();

  const { data: invoices, isLoading } = useInvoices();
  const { data: customers } = useCustomers();

  const addItem = () => {
    setItems([...items, { description: '', amount: 0, quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setItems(updatedItems);
  };

  const handleCreateInvoice = async () => {
    if (!selectedCustomerId || items.length === 0) return;

    try {
      const invoiceData = {
        customerId: selectedCustomerId,
        items: items.map(item => ({
          description: item.description,
          amount: Math.round(item.amount * 100), // Convert to cents
          quantity: item.quantity,
        })),
        description,
      };

      await createInvoiceMutation.mutateAsync(invoiceData);
      setIsCreateDialogOpen(false);
      setSelectedCustomerId('');
      setDescription('');
      setItems([{ description: '', amount: 0, quantity: 1 }]);
      
      toast({
        title: 'Success',
        description: 'Invoice created successfully',
      });
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invoice',
        variant: 'destructive',
      });
    }
  };

  const handleFinalizeInvoice = async (invoiceId: string) => {
    try {
      await finalizeInvoiceMutation.mutateAsync(invoiceId);
      toast({
        title: 'Success',
        description: 'Invoice finalized successfully',
      });
    } catch (error: any) {
      console.error('Error finalizing invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to finalize invoice',
        variant: 'destructive',
      });
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      await sendInvoiceMutation.mutateAsync(invoiceId);
      toast({
        title: 'Success',
        description: 'Invoice sent successfully',
      });
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invoice',
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
      case 'paid':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'open':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'draft':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'void':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'uncollectible':
        return 'bg-orange-50 text-orange-700 border-orange-200';
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
          <h2 className="text-2xl font-bold text-foreground">Invoice Management</h2>
          <p className="text-muted-foreground">Create and manage customer invoices</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Create a custom invoice for a customer
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Invoice description (optional)"
                />
              </div>
              
              <div>
                <Label>Line Items</Label>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Amount ($)"
                        value={item.amount}
                        onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-16"
                      />
                      {items.length > 1 && (
                        <Button variant="outline" size="sm" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addItem}>
                    Add Item
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateInvoice}
                  disabled={!selectedCustomerId || items.some(item => !item.description || item.amount <= 0)}
                >
                  Create Invoice
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Manage customer invoices and billing</CardDescription>
        </CardHeader>
        <CardContent>
          {!invoices || invoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No invoices found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by creating your first invoice.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-foreground">
                          Invoice #{invoice.stripeInvoiceId.slice(-8)}
                        </h3>
                        <Badge variant="outline" className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        Customer: {getCustomerName(invoice.customerId)}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-foreground font-medium">
                          Amount Due: ${(invoice.amountDue / 100).toFixed(2)}
                        </span>
                        {invoice.amountPaid > 0 && (
                          <span className="text-green-600">
                            Paid: ${(invoice.amountPaid / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      
                      {invoice.dueDate && (
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      {invoice.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFinalizeInvoice(invoice.id)}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Finalize
                        </Button>
                      )}
                      
                      {(invoice.status === 'open' || invoice.status === 'draft') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendInvoice(invoice.id)}
                        >
                          <Send className="mr-1 h-3 w-3" />
                          Send
                        </Button>
                      )}
                      
                      {invoice.hostedInvoiceUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.hostedInvoiceUrl!, '_blank')}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Invoice ID</p>
                        <p className="font-mono text-xs text-foreground">{invoice.id}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Currency</p>
                        <p className="text-foreground uppercase">{invoice.currency}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="text-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                      </div>
                      {invoice.paidAt && (
                        <div>
                          <p className="text-muted-foreground">Paid At</p>
                          <p className="text-foreground">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                        </div>
                      )}
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