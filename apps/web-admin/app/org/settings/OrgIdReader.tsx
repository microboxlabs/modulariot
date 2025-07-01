'use client'
import { useSearchParams } from 'next/navigation'

export function OrgIdReader({ children }: { children: (orgId: string | null) => React.ReactNode }) {
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId');
  return <>{children(orgId)}</>;
} 