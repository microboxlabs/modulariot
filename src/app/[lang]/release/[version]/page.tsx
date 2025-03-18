"use client";

import NavbarSignIn from "@/features/auth/components/navbar-sign-in";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function Page() {
  const params = useParams();
  const releaseName = params.version;
  const version = releaseName || "v1.1";
  const [ReleaseNotes, setReleaseNotes] = useState<any>(null);

  useEffect(() => {
    const loadReleaseNotes = async () => {
      try {
        // Dynamically import the MDX file based on the version
        const module = await import(`@/releases/${version}.mdx`);
        setReleaseNotes(() => module.default);
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

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <NavbarSignIn />
      <div className="flex flex-col w-fit gap-4 pb-5 px-5 text-gray-900 dark:text-gray-100">
        <ReleaseNotes />
      </div>
    </div>
  );
}
