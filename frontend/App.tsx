import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ClerkProvider, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from './lib/react-query';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ClientManagement from './components/ClientManagement';
import ProspectManagement from './components/ProspectManagement';
import { PriorityProspects } from './components/PriorityProspects';
import EmailCampaigns from './components/EmailCampaigns';
import Analytics from './components/Analytics';
import AgentControls from './components/AgentControls';

import AICRMDashboard from './components/AICRMDashboard';
import LeadsManagement from './components/LeadsManagement';
import DealsManagement from './components/DealsManagement';
import CRMIntegration from './components/CRMIntegration';
import HubSpotIntegration from './components/HubSpotIntegration';
import RateLimitDashboard from './components/RateLimitDashboard';
import RateLimitManagement from './components/RateLimitManagement';
import RateLimitingDashboard from './components/RateLimitingDashboard';
import { ReportingDashboard } from './components/ReportingDashboard';
import { ComplianceDashboard } from './components/ComplianceDashboard';
import NurturingDashboard from './components/NurturingDashboard';
import { IntelligentNurturingDashboard } from './components/IntelligentNurturingDashboard';
import { AISequenceBuilder } from './components/AISequenceBuilder';
import RealTimeEngagementTracker from './components/RealTimeEngagementTracker';

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
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/clients" element={<ClientManagement />} />
                    <Route path="/prospects" element={<ProspectManagement />} />
                    <Route path="/priority" element={<PriorityProspects />} />
                    <Route path="/campaigns" element={<EmailCampaigns />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/agent" element={<AgentControls />} />

                    <Route path="/ai-crm" element={<AICRMDashboard />} />
                    <Route path="/ai-crm/leads" element={<LeadsManagement />} />
                    <Route path="/ai-crm/deals" element={<DealsManagement />} />
                    <Route path="/ai-crm/integration" element={<CRMIntegration />} />
                    <Route path="/hubspot" element={<HubSpotIntegration />} />
                    <Route path="/rate-limits" element={<RateLimitDashboard />} />
                    <Route path="/rate-limits/management" element={<RateLimitManagement />} />
                    <Route path="/rate-limits/advanced" element={<RateLimitingDashboard />} />
                    <Route path="/reporting" element={<ReportingDashboard />} />
                    <Route path="/compliance" element={<ComplianceDashboard />} />
                    <Route path="/nurturing" element={<NurturingDashboard />} />
                    <Route path="/intelligent-nurturing" element={<IntelligentNurturingDashboard />} />
                    <Route path="/ai-sequence-builder" element={<AISequenceBuilder onClose={() => {}} onSave={() => Promise.resolve()} />} />
                    <Route path="/engagement-tracker" element={<RealTimeEngagementTracker />} />
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
