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
        const fallbackModule = await import(`@/releases/v1.1.0.mdx`);
        setReleaseNotes(() => fallbackModule.default);
      }
    };

    loadReleaseNotes();
  }, [version]);

  if (!ReleaseNotes) {
    return <div>Loading...</div>;
  }

  return (
    <div className="mdx-content">
      <ReleaseNotes />
      <style jsx global>{`
        .mdx-content {
          font-size: 1rem;
          line-height: 1.75;
        }

        .mdx-content p {
          margin-bottom: 1.25rem;
        }

        .mdx-content h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
        }

        .mdx-content h2 {
          font-size: 2rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }

        .mdx-content h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .mdx-content ul {
          list-style-type: disc;
          margin-left: 1.5rem;
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        .mdx-content li {
          margin-bottom: 0.5rem;
        }

        .mdx-content ol {
          list-style-type: decimal;
          margin-left: 1.5rem;
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        .mdx-content code {
          background-color: #f1f1f1;
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }

        .mdx-content pre {
          background-color: #f1f1f1;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }

        .mdx-content a {
          color: #2563eb;
          text-decoration: underline;
        }

        .mdx-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
        }

        @media (prefers-color-scheme: dark) {
          .mdx-content code {
            background-color: #374151;
          }

          .mdx-content pre {
            background-color: #374151;
          }

          .mdx-content a {
            color: #60a5fa;
          }

          .mdx-content blockquote {
            border-left-color: #4b5563;
          }
        }
      `}</style>
    </div>
  );
}
