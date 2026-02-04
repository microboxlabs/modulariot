"use client";

import { useReleases } from "@/features/common/providers/client-api.provider";
import Link from "next/link";
import { useState } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface Release {
  files: string[];
  // Add other release properties as needed
}

export default function OtherVersions({
  version,
  dict,
}: {
  version: string;
  dict: I18nRecord;
}) {
  const { releases, error, isLoading } = useReleases();
  const [showAll, setShowAll] = useState(false);

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

  const filteredReleases = (releases as unknown as Release).files
    .filter((release) => release.replace(".mdx", "") !== version)
    .map((release) => release.replace(".mdx", ""))
    .sort((a, b) => {
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
    });

  const releasesToShow = showAll
    ? filteredReleases
    : filteredReleases.slice(0, 5);
  const hasMoreReleases = filteredReleases.length > 5;

  return (
    <div className="flex flex-col gap-1">
      {releasesToShow.map((version) => (
        <Link
          key={version}
          className="text-sm text-gray-600 dark:text-gray-400 hover:underline flex justify-center items-center"
          href={`/release/${version}`}
        >
          {version}
        </Link>
      ))}

      {hasMoreReleases && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex justify-center items-center mt-2"
        >
          {showAll
            ? tr("show_less", dict.release as I18nRecord)
            : tr("show_more", dict.release as I18nRecord)}
        </button>
      )}
    </div>
  );
}
