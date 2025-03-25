"use client";

import { useReleases } from "@/features/common/providers/client-api.provider";
import Link from "next/link";

interface Release {
  files: string[];
  // Add other release properties as needed
}

export default function ReleaseView() {
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
  const version = (releases as unknown as Release).files
    .map((file) => file.replace(".mdx", ""))
    .sort((a, b) => b.localeCompare(a))[0];

  return (
    <Link
      href={`/release/${version}`}
      className="hover:underline text-sm text-gray-500 dark:text-gray-400 sm:text-center"
      target="_blank"
    >
      {version}
    </Link>
  );
}
