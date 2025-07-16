"use client";

import { useReleases } from "@/features/common/providers/client-api.provider";
import Link from "next/link";

interface Release {
  files: string[];
  // Add other release properties as needed
}

export default function ReleaseView({ className }: { className?: string }) {
  const { releases, error, isLoading } = useReleases();

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-500 dark:bg-gray-400 rounded-md sm:text-center animate-pulse">
        loading...
      </div>
    );
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  // all the files in release have a name like "v1.1.mdx", get the newest version and add it in version
  const compareVersions = (a: string, b: string) => {
    const aParts = a.replace("v", "").split(".").map(Number);
    const bParts = b.replace("v", "").split(".").map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      if (aPart !== bPart) {
        return bPart - aPart; // descending order
      }
    }
    return 0;
  };

  const version = (releases as unknown as Release).files
    .map((file) => file.replace(".mdx", ""))
    .sort(compareVersions)[0];

  return (
    <Link
      href={`/release/${version}`}
      className={`hover:underline text-sm text-gray-500 dark:text-gray-400 sm:text-center ${className}`}
      target="_blank"
    >
      {version}
    </Link>
  );
}
