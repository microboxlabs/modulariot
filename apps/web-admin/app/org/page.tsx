'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, TextInput, Card, Spinner, Alert } from 'flowbite-react';
import { Plus, Search, Filter, Building2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

import { useOrgList } from '@/lib/hooks/useOrgList';
import { OrgCard } from '../components/OrgCard';
import { CTAButton } from '@modulariot/ui/cta-button';
import { getSavedState } from '@modulariot/ui/sidebar';

export default function OrganizationsPage() {
  const { organizations, loading, error } = useOrgList();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isCollapsed = getSavedState('miot_sidebar');

  return (
    <div className={`${isCollapsed ? 'ml-16' : 'ml-60'}`}>
      <div className="container px-6 mx-auto py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
            My Organizations
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose an organization to manage your IoT projects and device fleets.
          </p>
        </div>

        {/* Error state */}
        {error && (
          <Alert color="failure" icon={AlertCircle} className="mb-6">
            <span className="font-medium">Error loading organizations:</span> {error}
          </Alert>
        )}

        {/* Main toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="relative w-full sm:w-72">
            <TextInput
              id="search"
              type="search"
              icon={Search}
              placeholder="Search organizations"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
              aria-label="Search organizations"
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button disabled>
              <Filter className="h-5 w-5 mr-2" />
              Filter
            </Button>
            <CTAButton as={Link} href="/org/new" variant="primary" size="md">
              <Plus className="h-5 w-5 mr-2" />
              New organization
            </CTAButton>
          </div>
        </div>

        {/* Org grid */}
        {loading ? (
          <div className="text-center">
            <Spinner size="xl" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading organizations...</p>
          </div>
        ) : error ? (
          // Error state with retry option
          <Card className="rounded-2xl shadow-md p-6 text-center">
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-16 w-16 text-red-400" />
              <h3 className="text-xl font-semibold">Failed to load organizations</h3>
              <p className="text-gray-500">
                There was an error loading your organizations. Please try refreshing the page.
              </p>
              <Button onClick={() => window.location.reload()} className="mt-4">
                Refresh Page
              </Button>
            </div>
          </Card>
        ) : filteredOrgs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrgs.map((org, i) => (
              <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                <OrgCard org={org} />
              </motion.div>
            ))}
          </div>
        ) : (
          // Empty state
          <Card className="rounded-2xl shadow-md p-6 text-center">
            <div className="flex flex-col items-center gap-4 py-8">
              <Building2 className="h-16 w-16 text-gray-400" />
              <h3 className="text-xl font-semibold">No organizations yet</h3>
              <p className="text-gray-500">
                Get started by creating your first organization.
              </p>
              <CTAButton as={Link} href="/org/new" className="mt-4">
                <Plus className="h-5 w-5 mr-2" />
                Create your first organization
              </CTAButton>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}