import { NavLink } from 'react-router-dom';
import { BarChart3, Users, Mail, Activity, Settings, Bot, Link } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Prospects', href: '/prospects', icon: Users },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
  { name: 'Analytics', href: '/analytics', icon: Activity },
  { name: 'Agent Controls', href: '/agent', icon: Settings },
  { name: 'Salesforce CRM', href: '/salesforce', icon: Link },
];

export default function Sidebar() {
  return (
    <div className="flex h-full w-64 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="flex items-center px-6 py-6">
        <Bot className="h-8 w-8 text-blue-600" />
        <span className="ml-3 text-xl font-semibold text-gray-900 dark:text-white">
          NuScan Agent
        </span>
      </div>
      
      <nav className="flex-1 space-y-1 px-3">
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
      </nav>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">NS</span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Nu Skin Partner
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Prospecting Agent
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
