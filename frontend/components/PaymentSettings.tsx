import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings, Key, Webhook, CreditCard, AlertTriangle } from 'lucide-react';

export function PaymentSettings() {
  const [webhookUrl, setWebhookUrl] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Payment Settings</h2>
        <p className="text-muted-foreground">Configure your payment integration settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>Stripe Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your Stripe integration settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Secrets Configuration Required</h4>
                <p className="text-sm text-blue-700 mt-1">
                  To complete your Stripe integration, you need to configure the following secrets in the Infrastructure tab:
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• <code className="bg-blue-100 px-1 rounded">StripeSecretKey</code> - Your Stripe secret key</li>
                  <li>• <code className="bg-blue-100 px-1 rounded">StripeWebhookSecret</code> - Your webhook endpoint secret</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2">API Keys Status</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stripe Secret Key</span>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Not Configured
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Webhook Secret</span>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Not Configured
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Webhook className="h-5 w-5" />
            <span>Webhook Configuration</span>
          </CardTitle>
          <CardDescription>
            Set up webhooks to receive real-time updates from Stripe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Webhook className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900">Webhook Endpoint Ready</h4>
                <p className="text-sm text-green-700 mt-1">
                  Your webhook endpoint is configured and ready to receive Stripe events:
                </p>
                <code className="block text-sm bg-green-100 text-green-800 p-2 rounded mt-2 font-mono">
                  {window.location.origin}/payment/webhooks/stripe
                </code>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-2">Supported Events</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div>• customer.subscription.created</div>
              <div>• customer.subscription.updated</div>
              <div>• customer.subscription.deleted</div>
              <div>• invoice.payment_succeeded</div>
              <div>• invoice.payment_failed</div>
              <div>• invoice.created</div>
              <div>• invoice.updated</div>
              <div>• payment_intent.succeeded</div>
              <div>• payment_intent.payment_failed</div>
              <div>• customer.created</div>
              <div>• customer.updated</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payment Processing</span>
          </CardTitle>
          <CardDescription>
            Configure payment processing settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2">Features Enabled</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subscription Management</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Enabled
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">One-time Payments</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Enabled
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invoice Management</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Enabled
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Customer Management</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Enabled
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Webhook Processing</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Enabled
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            Follow these steps to complete your payment integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Configure Stripe API Keys</h4>
                  <p className="text-sm text-muted-foreground">
                    Go to the Infrastructure tab and set your <code>StripeSecretKey</code> secret with your Stripe secret key.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Set up Stripe Webhook</h4>
                  <p className="text-sm text-muted-foreground">
                    In your Stripe dashboard, create a webhook endpoint pointing to:
                  </p>
                  <code className="block text-sm bg-gray-100 text-gray-800 p-2 rounded mt-1 font-mono">
                    {window.location.origin}/payment/webhooks/stripe
                  </code>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Configure Webhook Secret</h4>
                  <p className="text-sm text-muted-foreground">
                    Set the <code>StripeWebhookSecret</code> secret with the webhook signing secret from Stripe.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  4
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Sync Plans</h4>
                  <p className="text-sm text-muted-foreground">
                    Go to the Plans tab and sync your subscription plans from Stripe.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  ✓
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Start Processing Payments</h4>
                  <p className="text-sm text-muted-foreground">
                    Your payment system is ready! You can now create customers, subscriptions, and process payments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}