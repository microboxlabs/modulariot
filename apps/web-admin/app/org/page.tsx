'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, TextInput, Card, Spinner } from 'flowbite-react';
import { Plus, Search, Filter, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { useOrgList } from '@/lib/hooks/useOrgList';
import { OrgCard } from '../components/OrgCard';

export default function OrganizationsPage() {
  const { organizations, loading } = useOrgList();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="py-8">
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
          />
        </div>
        <div className="flex items-center gap-2">
          <Button disabled>
            <Filter className="h-5 w-5 mr-2" />
            Filter
          </Button>
          <Button as={Link} href="/org/new">
            <Plus className="h-5 w-5 mr-2" />
            New organization
          </Button>
        </div>
      </div>

      {/* Org grid */}
      {loading ? (
        <div className="text-center">
          <Spinner size="xl" />
        </div>
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
            <Button as={Link} href="/org/new" className="mt-4">
              <Plus className="h-5 w-5 mr-2" />
              Create your first organization
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
} 