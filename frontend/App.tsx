import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProspectManagement from './components/ProspectManagement';
import EmailCampaigns from './components/EmailCampaigns';
import Analytics from './components/Analytics';
import AgentControls from './components/AgentControls';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/prospects" element={<ProspectManagement />} />
              <Route path="/campaigns" element={<EmailCampaigns />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/agent" element={<AgentControls />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}
