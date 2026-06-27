"use client";

import {
  useBuildInfo,
  useReleases,
} from "@/features/common/providers/client-api.provider";
import { useState } from "react";
import BuildInfoModal from "./build-info-modal";

interface Release {
  files: string[];
  // Add other release properties as needed
}

export default function ReleaseView({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { releases, error, isLoading } = useReleases();
  const {
    buildInfo,
    error: buildInfoError,
    isLoading: isBuildInfoLoading,
  } = useBuildInfo();
  const [isBuildInfoOpen, setIsBuildInfoOpen] = useState(false);

  if (isLoading || isBuildInfoLoading) {
    return (
      <div className="text-sm text-gray-300 dark:text-gray-700 bg-gray-300 dark:bg-gray-700 rounded-md sm:text-center animate-pulse">
        loading...
      </div>
    );
  }

  if (error && !buildInfo) {
    return <div>Error: {error.message}</div>;
  }

  const releaseFiles = (releases as unknown as Release)?.files || [];

  if (!buildInfo && releaseFiles.length === 0) {
    return (
      <div className="text-sm text-gray-300 dark:text-gray-700 bg-gray-300 dark:bg-gray-700 rounded-md sm:text-center animate-pulse">
        No releases available
      </div>
    );
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

  const latestReleaseVersion = releaseFiles
    .map((file) => file.replace(".mdx", ""))
    .sort(compareVersions)[0];
  const version =
    buildInfo?.releaseNotesVersion ||
    (buildInfo?.channel === "nightly"
      ? buildInfo.releaseVersion
      : latestReleaseVersion || buildInfo?.releaseVersion || "unknown");

  return (
    <>
      <button
        type="button"
        className={`hover:underline text-sm text-gray-500 dark:text-gray-400 sm:text-center ${className}`}
        onClick={() => {
          onClick?.();
          setIsBuildInfoOpen(true);
        }}
        title={
          buildInfoError
            ? "Build information is unavailable"
            : "Show deployed build information"
        }
      >
        {version}
      </button>
      <BuildInfoModal
        buildInfo={buildInfo}
        isOpen={isBuildInfoOpen}
        onClose={() => setIsBuildInfoOpen(false)}
      />
    </>
  );
}
