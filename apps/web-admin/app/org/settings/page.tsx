import { Suspense } from 'react';
import { OrgIdReader } from './OrgIdReader';

export default function OrgSettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrgIdReader>
        {(orgId: string | null) => (
          <div>
            {/* Your page content using orgId */}
            Org ID: {orgId}
          </div>
        )}
      </OrgIdReader>
    </Suspense>
  );
} 