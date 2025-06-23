'use client';

import Link from 'next/link';
import { Card, Badge } from 'flowbite-react';
import { ChevronRight, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Organization } from '@/lib/hooks/useOrgList';

type OrgCardProps = {
  org: Organization;
};

const tierColors: { [key: string]: string } = {
  FREE: 'gray',
  NANO: 'blue',
  PRO: 'purple',
};

export function OrgCard({ org }: OrgCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/org/settings?orgId=${org.id}`} aria-label={`View ${org.name}`}>
        <Card className="rounded-2xl shadow-md p-6 h-full hover:ring-1 hover:ring-teal-300/60">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Building className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </div>
              <div>
                <h5 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {org.name}
                </h5>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {org.status === 'ACTIVE' ? `Active` : `Paused`}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Badge color={tierColors[org.tier]} title={`Tier: ${org.tier}`}>{org.tier}</Badge>
            <Badge color="gray" title={`Region: ${org.region}`}>{org.region}</Badge>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
