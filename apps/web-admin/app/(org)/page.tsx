'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Spinner, Badge } from 'flowbite-react'
import { Plus, Building, User, ChevronRight } from 'lucide-react'
import CreateOrgForm from '../components/forms/CreateOrgForm'

// Mock organization type
type Organization = {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export default function OrgSelectorPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Mock fetching organizations
    const fetchOrgs = async () => {
      setLoading(true)
      // In a real app, this would be an API call
      // For now, using mock data and a timeout
      setTimeout(() => {
        setOrgs([
          { id: '01h8g7v1s4n3x5q6r8t9yazbwj', name: 'Demo Organization', slug: 'demo-org', role: 'OWNER' },
          { id: '01h8g7v2s5n4x6q7r9t0ybzcxd', name: 'Second Org', slug: 'second-org', role: 'ADMIN' },
        ])
        setLoading(false)
      }, 1000)
    }

    fetchOrgs()
  }, [])

  const handleOrgCreated = (newOrg: { id: string; name: string; slug: string }) => {
    const newOrgWithRole: Organization = { ...newOrg, role: 'OWNER' };
    setOrgs(prev => [...prev, newOrgWithRole]);
    router.push(`/org/settings?orgId=${newOrg.id}`)
  }
  
  const getRoleBadgeColor = (role: Organization['role']) => {
    switch(role) {
      case 'OWNER': return 'purple';
      case 'ADMIN': return 'info';
      case 'MEMBER': return 'gray';
      default: return 'gray';
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
            Select an Organization
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Choose an organization to manage or create a new one.
          </p>
        </div>
        <Button color="blue" onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-5 w-5" />
          Create Organization
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <Spinner aria-label="Loading organizations" size="xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.length > 0 ? (
            orgs.map((org) => (
              <Card 
                key={org.id} 
                className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => router.push(`/org/settings?orgId=${org.id}`)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-lg">
                      <Building className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <h5 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {org.name}
                      </h5>
                      <p className="font-normal text-gray-700 dark:text-gray-400 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Your role:</span>
                        <Badge color={getRoleBadgeColor(org.role)}>{org.role}</Badge>
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-6 w-6 text-gray-500" />
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <Building className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No organizations</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new organization.</p>
              <div className="mt-6">
                <Button color="blue" onClick={() => setCreateModalOpen(true)}>
                  <Plus className="mr-2 h-5 w-5" />
                  Create Organization
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      
      <CreateOrgForm
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleOrgCreated}
      />
    </div>
  )
} 