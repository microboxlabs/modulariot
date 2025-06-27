'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Search, Plus, Building } from 'lucide-react';
import Link from 'next/link';

export interface Organization {
  id: string;
  name: string;
  planId: string;
}

interface OrgSwitcherProps {
  currentOrg: Organization | null;
  organizations?: Organization[];
}

// TODO: Replace with API fetch
// const mockOrganizations: Organization[] = [
//   { id: 'mintral', name: 'Mintral', plan: 'FREE' },
//   { id: 'techcorp', name: 'TechCorp Industries', plan: 'PRO' },
//   { id: 'startupco', name: 'StartupCo', plan: 'FREE' },
// ];

export function OrgSwitcher({ currentOrg, organizations = [] }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  
  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOrgSelect = (orgId: string) => {
    router.push(`/org/${orgId}`);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getPlanBadgeColor = (plan: Organization['planId']) => {
    switch (plan) {
      case 'pro':
        return 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300';
      case 'free':
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="font-medium text-slate-900 dark:text-slate-100 max-w-[180px] truncate">
          {currentOrg?.name}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPlanBadgeColor(currentOrg?.planId ?? '')}`}>
          {currentOrg?.planId}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20">
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {filteredOrgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleOrgSelect(org.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                    <Building className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {org.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {org.planId} Plan
                    </div>
                  </div>
                  {org.id === currentOrg?.id && (
                    <div className="w-2 h-2 bg-primary-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
            
            <div className="border-t border-slate-200 dark:border-slate-700 p-2">
              <Link
                href="/org"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                <Building className="h-4 w-4" />
                All Organizations
              </Link>
              <Link
                href="/org/new"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Organization
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}