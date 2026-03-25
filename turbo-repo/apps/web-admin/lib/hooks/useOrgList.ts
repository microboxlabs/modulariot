'use client';
import { useState, useEffect } from 'react';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  // Add additional fields that might be used in the UI
  role?: string;
  status?: string;
  region?: string;
  tier?: string;
}

export const useOrgList = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/organizations');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch organizations: ${response.statusText}`);
        }
        
        const data = await response.json() as Organization[];
        
        // Transform the API response to match the expected UI format
        const transformedOrgs = data.map((org) => ({
          ...org,
          role: 'OWNER', // Since the API returns user's own orgs, they're the owner
          status: 'ACTIVE', // Default status, can be updated when API provides this
          region: 'aws-us-east-1', // Default region, can be updated when API provides this
          tier: 'FREE', // Default tier, can be updated when API provides this
        }));
        
        setOrganizations(transformedOrgs);
      } catch (err) {
        console.error('Error fetching organizations:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  return { organizations, loading, error };
}; 