'use client';
import { useState, useEffect } from 'react';

// TODO: replace with real fetch("/api/user/organizations")
const mockOrganizations = [
  {
    "id": "01HX1DEF",
    "name": "Synth Co.",
    "slug": "synth-co",
    "role": "ADMIN",
    "status": "ACTIVE",
    "createdAt": "2025-05-10T11:00:00Z",
    "region": "aws-eu-central-1",
    "tier": "NANO"
  },
    {
    "id": "01HX1GHI",
    "name": "QuantumLeap",
    "slug": "quantumleap",
    "role": "MEMBER",
    "status": "PAUSED",
    "createdAt": "2024-02-01T09:30:00Z",
    "region": "aws-ap-southeast-1",
    "tier": "PRO"
  }
];

export type Organization = typeof mockOrganizations[0];

export const useOrgList = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOrganizations(mockOrganizations);
      setLoading(false);
    }, 1000); // Simulate network delay

    return () => clearTimeout(timer);
  }, []);

  return { organizations, loading };
}; 