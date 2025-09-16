import { NavLink } from 'react-router-dom';
import { BarChart3, Users, Mail, Activity, Settings, Bot, Link, Target, Brain, Handshake, DollarSign, Shield, LogOut, FileBarChart, Lock, Database } from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Prospects', href: '/prospects', icon: Users },
  { name: 'Priority Leads', href: '/priority', icon: Target },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
  { name: 'Analytics', href: '/analytics', icon: Activity },
  { name: 'Agent Controls', href: '/agent', icon: Settings },
  { name: 'Salesforce CRM', href: '/salesforce', icon: Link },
];

const aiCRMNavigation = [
  { name: 'AI CRM Dashboard', href: '/ai-crm', icon: Brain },
  { name: 'CRM Leads', href: '/ai-crm/leads', icon: Users },
  { name: 'CRM Deals', href: '/ai-crm/deals', icon: DollarSign },
  { name: 'CRM Integration', href: '/ai-crm/integration', icon: Handshake },
];

const rateLimitNavigation = [
  { name: 'Rate Limit Monitor', href: '/rate-limits', icon: Shield },
  { name: 'Rate Limit Config', href: '/rate-limits/management', icon: Settings },
];

const reportingNavigation = [
  { name: 'Reports & Analytics', href: '/reporting', icon: FileBarChart },
];

const complianceNavigation = [
  { name: 'Compliance Dashboard', href: '/compliance', icon: Lock },
];

const performanceNavigation = [
  { name: 'Database Performance', href: '/db-performance', icon: Database },
];

function UserProfile() {
  const { user } = useUser();
  const { signOut } = useClerk();

  if (!user) return null;

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0 flex-1">
          <div className="flex-shrink-0">
            {user.imageUrl ? (
              <img
                className="h-8 w-8 rounded-full"
                src={user.imageUrl}
                alt={user.fullName || 'User'}
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </div>
          <div className="ml-3 min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
              {user.fullName || user.emailAddresses[0]?.emailAddress}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI CRM User
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="ml-2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <div className="flex h-full w-64 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="flex items-center px-6 py-6">
        <Bot className="h-8 w-8 text-blue-600" />
        <span className="ml-3 text-xl font-semibold text-gray-900 dark:text-white">
          AI CRM Platform
        </span>
      </div>
      
      <nav className="flex-1 space-y-1 px-3">
        <div className="pb-4">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Prospect System
          </h3>
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </div>
        
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            AI CRM
          </h3>
          {aiCRMNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </div>
        
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Rate Limiting
          </h3>
          {rateLimitNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </div>
        
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Reporting
          </h3>
          {reportingNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </div>
        
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Compliance
          </h3>
          {complianceNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </div>
        
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Performance
          </h3>
          {performanceNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </div>
      </nav>
      
      <UserProfile />
    </div>
  );
}
