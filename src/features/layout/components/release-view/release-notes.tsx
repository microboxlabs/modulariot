"use client";
import { useEffect, useState } from "react";

export default function ReleaseNotes({ version }: { version: string }) {
  const [ReleaseNotesComponent, setReleaseNotesComponent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReleaseNotes = async () => {
      setLoading(true);
      setError(null);

      try {
        // Dynamically import the MDX file based on the version
        const releaseModule = await import(`@/releases/${version}.mdx`);
        setReleaseNotesComponent(() => releaseModule.default);
      } catch (error) {
        console.error(
          `Failed to load release notes for version ${version}:`,
          error,
        );

        try {
          // Fallback to v1.1 if the requested version doesn't exist
          const fallbackModule = await import(`@/releases/v1.1.0.mdx`);
          setReleaseNotesComponent(() => fallbackModule.default);
          setError(`Version ${version} not found. Showing v1.1.0 instead.`);
        } catch (fallbackError) {
          setError("Failed to load release notes.");
          console.error("Fallback also failed:", fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadReleaseNotes();
  }, [version]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading release notes...</span>
        </div>
      </div>
    );
  }

  if (error && !ReleaseNotesComponent) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error loading release notes
            </h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg
              className="h-5 w-5 text-amber-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="ml-2 text-sm text-amber-700">{error}</span>
          </div>
        </div>
      )}

      <article className="prose prose-gray prose-lg max-w-none">
        <ReleaseNotesComponent />
      </article>

      <style jsx global>{`
        /* Enhanced typography and spacing with dark mode support */
        .prose {
          color: #374151;
          line-height: 1.75;
        }

        .dark .prose {
          color: #d1d5db;
        }

        .prose h1 {
          font-size: 2.25rem;
          font-weight: 800;
          line-height: 1.2;
          margin-top: 0;
          margin-bottom: 2rem;
          color: #111827;
          border-bottom: 3px solid #3b82f6;
          padding-bottom: 0.5rem;
        }

        .dark .prose h1 {
          color: #f9fafb;
          border-bottom-color: #60a5fa;
        }

        .prose h2 {
          font-size: 1.875rem;
          font-weight: 700;
          line-height: 1.3;
          margin-top: 3rem;
          margin-bottom: 1.5rem;
          color: #1f2937;
          position: relative;
        }

        .dark .prose h2 {
          color: #e5e7eb;
        }

        .prose h2::before {
          content: "";
          position: absolute;
          left: -1rem;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 2rem;
          background: linear-gradient(to bottom, #3b82f6, #1d4ed8);
          border-radius: 2px;
        }

        .dark .prose h2::before {
          background: linear-gradient(to bottom, #60a5fa, #3b82f6);
        }

        .prose h3 {
          font-size: 1.5rem;
          font-weight: 600;
          line-height: 1.4;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #374151;
        }

        .dark .prose h3 {
          color: #d1d5db;
        }

        .prose h4 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #4b5563;
        }

        .dark .prose h4 {
          color: #9ca3af;
        }

        .prose p {
          margin-top: 1.25rem;
          margin-bottom: 1.25rem;
          text-align: justify;
        }

        .prose hr {
          margin-top: 3rem;
          margin-bottom: 3rem;
          border: none;
          height: 1px;
          background: linear-gradient(
            to right,
            transparent,
            #d1d5db,
            transparent
          );
        }

        .dark .prose hr {
          background: linear-gradient(
            to right,
            transparent,
            #4b5563,
            transparent
          );
        }

        /* Enhanced lists */
        .prose ul,
        .prose ol {
          margin-top: 1.5rem;
          margin-bottom: 1.5rem;
          padding-left: 0;
        }

        .prose ul {
          list-style: none;
        }

        .prose ul > li {
          position: relative;
          padding-left: 2rem;
          margin-bottom: 0.75rem;
        }

        .prose ul > li::before {
          content: "•";
          position: absolute;
          left: 0.5rem;
          color: #3b82f6;
          font-weight: bold;
          font-size: 1.2em;
        }

        .dark .prose ul > li::before {
          color: #60a5fa;
        }

        .prose ol {
          counter-reset: list-counter;
          list-style: none;
        }

        .prose ol > li {
          position: relative;
          padding-left: 2.5rem;
          margin-bottom: 0.75rem;
          counter-increment: list-counter;
        }

        .prose ol > li::before {
          content: counter(list-counter) ".";
          position: absolute;
          left: 0;
          top: 0;
          color: #3b82f6;
          font-weight: 600;
          min-width: 2rem;
        }

        .dark .prose ol > li::before {
          color: #60a5fa;
        }

        .prose li > ul,
        .prose li > ol {
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }

        /* Enhanced tables */
        .prose table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 2rem;
          margin-bottom: 2rem;
          border-radius: 0.5rem;
          overflow: hidden;
          box-shadow:
            0 1px 3px 0 rgba(0, 0, 0, 0.1),
            0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }

        .dark .prose table {
          box-shadow:
            0 1px 3px 0 rgba(0, 0, 0, 0.3),
            0 1px 2px 0 rgba(0, 0, 0, 0.2);
        }

        .prose thead {
          background: linear-gradient(to right, #3b82f6, #1d4ed8);
        }

        .dark .prose thead {
          background: linear-gradient(to right, #1e40af, #1e3a8a);
        }

        .prose th {
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 1rem 1.5rem;
          text-align: left;
          border: none;
        }

        .prose td {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .dark .prose td {
          border-bottom-color: #374151;
          border-right-color: #374151;
        }

        .prose td:last-child {
          border-right: none;
        }

        .prose tbody tr:last-child td {
          border-bottom: none;
        }

        .prose tbody tr:nth-child(even) {
          background-color: #f8fafc;
        }

        .dark .prose tbody tr:nth-child(even) {
          background-color: #1f2937;
        }

        .prose tbody tr:hover {
          background-color: #f1f5f9;
          transition: background-color 0.15s ease-in-out;
        }

        .dark .prose tbody tr:hover {
          background-color: #374151;
        }

        /* Code and pre blocks */
        .prose code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          color: #dc2626;
          font-weight: 600;
        }

        .dark .prose code {
          background-color: #374151;
          color: #f87171;
        }

        .prose pre {
          background-color: #1f2937;
          color: #f9fafb;
          padding: 1.5rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin-top: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .dark .prose pre {
          background-color: #111827;
        }

        .prose pre code {
          background-color: transparent;
          color: inherit;
          padding: 0;
          border-radius: 0;
          font-weight: 400;
        }

        /* Blockquotes */
        .prose blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1.5rem;
          margin-left: 0;
          margin-top: 2rem;
          margin-bottom: 2rem;
          font-style: italic;
          color: #6b7280;
          background-color: #f8fafc;
          padding: 1.5rem;
          border-radius: 0.5rem;
        }

        .dark .prose blockquote {
          border-left-color: #60a5fa;
          color: #9ca3af;
          background-color: #1f2937;
        }

        /* Links */
        .prose a {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s ease-in-out;
        }

        .dark .prose a {
          color: #60a5fa;
        }

        .prose a:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }

        .dark .prose a:hover {
          color: #93c5fd;
        }

        /* Emoji and special characters */
        .prose h1,
        .prose h2,
        .prose h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* Strong and em */
        .prose strong {
          font-weight: 700;
          color: #111827;
        }

        .dark .prose strong {
          color: #f9fafb;
        }

        .prose em {
          font-style: italic;
          color: #4b5563;
        }

        .dark .prose em {
          color: #9ca3af;
        }

        /* Responsive design */
        @media (max-width: 640px) {
          .prose {
            font-size: 1rem;
          }

          .prose h1 {
            font-size: 1.875rem;
            margin-bottom: 1.5rem;
          }

          .prose h2 {
            font-size: 1.5rem;
            margin-top: 2rem;
            margin-bottom: 1rem;
          }

          .prose h2::before {
            left: -0.75rem;
            height: 1.5rem;
          }

          .prose table {
            font-size: 0.875rem;
          }

          .prose th,
          .prose td {
            padding: 0.75rem 1rem;
          }
        }
      `}</style>
    </div>
  );
}
