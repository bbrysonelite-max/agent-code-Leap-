import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from './lib/react-query';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProspectManagement from './components/ProspectManagement';
import { PriorityProspects } from './components/PriorityProspects';
import EmailCampaigns from './components/EmailCampaigns';
import Analytics from './components/Analytics';
import AgentControls from './components/AgentControls';
import SalesforceIntegration from './components/SalesforceIntegration';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router>
          <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/prospects" element={<ProspectManagement />} />
                  <Route path="/priority" element={<PriorityProspects />} />
                  <Route path="/campaigns" element={<EmailCampaigns />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/agent" element={<AgentControls />} />
                  <Route path="/salesforce" element={<SalesforceIntegration />} />
                </Routes>
              </ErrorBoundary>
            </main>
          </div>
          <NetworkStatus />
          <Toaster />
          <ReactQueryDevtools initialIsOpen={false} />
        </Router>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
