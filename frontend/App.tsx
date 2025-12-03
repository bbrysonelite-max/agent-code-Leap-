import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ClerkProvider, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from './lib/react-query';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import Sidebar from './components/Sidebar';

// Core pages
import Dashboard from './components/Dashboard';
import ClientManagement from './components/ClientManagement';
import ProspectManagement from './components/ProspectManagement';
import { PriorityProspects } from './components/PriorityProspects';
import EmailCampaigns from './components/EmailCampaigns';
import Analytics from './components/Analytics';
import AgentControls from './components/AgentControls';

// AI CRM pages
import AICRMDashboard from './components/AICRMDashboard';
import LeadsManagement from './components/LeadsManagement';
import DealsManagement from './components/DealsManagement';

// Integrations
import HubSpotIntegration from './components/HubSpotIntegration';

// Nurturing
import NurturingDashboard from './components/NurturingDashboard';

// Compliance & Audit
import ComplianceDashboard from './components/ComplianceDashboard';

// Payments
import PaymentDashboard from './components/PaymentDashboard';

// Performance
import DatabasePerformanceDashboard from './components/DatabasePerformanceDashboard';

const PUBLISHABLE_KEY = "pk_test_Y2xlYXItZmluY2gtMS5jbGVyay5hY2NvdW50cy5kZXYk";

function AppInner() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router>
          <SignedIn>
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
              <Sidebar />
              <main className="flex-1 overflow-auto">
                <ErrorBoundary>
                  <Routes>
                    {/* Core Routes */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/clients" element={<ClientManagement />} />
                    <Route path="/prospects" element={<ProspectManagement />} />
                    <Route path="/priority" element={<PriorityProspects />} />
                    <Route path="/campaigns" element={<EmailCampaigns />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/agent" element={<AgentControls />} />

                    {/* AI CRM Routes */}
                    <Route path="/ai-crm" element={<AICRMDashboard />} />
                    <Route path="/ai-crm/leads" element={<LeadsManagement />} />
                    <Route path="/ai-crm/deals" element={<DealsManagement />} />

                    {/* Integration Routes */}
                    <Route path="/hubspot" element={<HubSpotIntegration />} />

                    {/* Nurturing Routes */}
                    <Route path="/nurturing" element={<NurturingDashboard />} />
                    <Route path="/intelligent-nurturing" element={<NurturingDashboard />} />

                    {/* Compliance Routes */}
                    <Route path="/compliance" element={<ComplianceDashboard />} />

                    {/* Payment Routes */}
                    <Route path="/payments" element={<PaymentDashboard />} />

                    {/* Performance Routes */}
                    <Route path="/db-performance" element={<DatabasePerformanceDashboard />} />

                    {/* Catch-all for unimplemented routes */}
                    <Route path="*" element={
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <h1 className="text-2xl font-bold mb-2">Coming Soon</h1>
                          <p className="text-muted-foreground">This feature is under development.</p>
                        </div>
                      </div>
                    } />
                  </Routes>
                </ErrorBoundary>
              </main>
            </div>
          </SignedIn>
          <SignedOut>
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
              <div className="max-w-md w-full space-y-8 p-6">
                <div className="text-center">
                  <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                    Welcome to AI CRM Platform
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Sign in to access your dashboard
                  </p>
                </div>
                <div className="mt-8 space-y-6">
                  <SignInButton mode="modal">
                    <button className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      Sign in
                    </button>
                  </SignInButton>
                </div>
              </div>
            </div>
          </SignedOut>
          <NetworkStatus />
          <Toaster />
          <ReactQueryDevtools initialIsOpen={false} />
        </Router>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <AppInner />
    </ClerkProvider>
  );
}
