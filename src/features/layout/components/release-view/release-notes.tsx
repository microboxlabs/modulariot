"use client";
import { useEffect, useState } from "react";

export default function ReleaseNotes({ version }: { version: string }) {
  const [ReleaseNotes, setReleaseNotes] = useState<any>(null);

  useEffect(() => {
    const loadReleaseNotes = async () => {
      try {
        // Dynamically import the MDX file based on the version
        const releaseModule = await import(`@/releases/${version}.mdx`);
        setReleaseNotes(() => releaseModule.default);
      } catch (error) {
        console.error(
          `Failed to load release notes for version ${version}:`,
          error,
        );
        // Fallback to v1.1 if the requested version doesn't exist
        const fallbackModule = await import(`@/releases/v1.1.mdx`);
        setReleaseNotes(() => fallbackModule.default);
      }
    };

    loadReleaseNotes();
  }, [version]);

  if (!ReleaseNotes) {
    return <div>Loading...</div>;
  }

  return <ReleaseNotes />;
}
