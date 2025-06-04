"use client";

import { useReleases } from "@/features/common/providers/client-api.provider";
import Link from "next/link";

interface Release {
  files: string[];
  // Add other release properties as needed
}

export default function OtherVersions({ version }: { version: string }) {
  const { releases, error, isLoading } = useReleases();

  if (error) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Error loading releases
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {(releases as unknown as Release).files
        .filter((release) => release.replace(".mdx", "") !== version)
        .map((release) => release.replace(".mdx", ""))
        .sort((a, b) => {
          const aParts = a.replace('v', '').split('.').map(Number);
          const bParts = b.replace('v', '').split('.').map(Number);
          
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;
            if (aPart !== bPart) {
              return bPart - aPart; // descending order
            }
          }
          return 0;
        })
        .map((version) => (
          <Link
            key={version}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
            href={`/release/${version}`}
          >
            {version}
          </Link>
        ))}
    </div>
  );
}
