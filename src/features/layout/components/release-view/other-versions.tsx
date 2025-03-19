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
        .map((release) => (
          <Link
            key={release}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
            href={`/release/${release.replace(".mdx", "")}`}
          >
            {release.replace(".mdx", "")}
          </Link>
        ))}
    </div>
  );
}
