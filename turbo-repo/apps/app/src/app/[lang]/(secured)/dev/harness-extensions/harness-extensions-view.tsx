"use client";

import { useState } from "react";
import { DEFAULT_HARNESS_EXTENSIONS } from "@/features/harness-chat/extensions";
import type { HarnessExtension } from "@/features/harness-chat/harness-extension";
import { HighlightedJson } from "./json-highlight";

function buildDefinitionJson(extension: HarnessExtension): string {
  return JSON.stringify(
    {
      toolName: extension.toolName,
      description: extension.description,
      parameters: extension.parameters,
    },
    null,
    2,
  );
}

function ExtensionCard({ extension }: Readonly<{ extension: HarnessExtension }>) {
  const [copied, setCopied] = useState(false);
  const json = buildDefinitionJson(extension);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id={extension.toolName}
      className="scroll-mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div className="flex flex-col gap-1">
          <code className="w-fit rounded-md bg-blue-50 px-2 py-0.5 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {extension.toolName}
          </code>
          <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            {extension.description}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          {copied ? "Copied!" : "Copy definition"}
        </button>
      </div>
      <pre className="max-h-[32rem] overflow-auto bg-gray-50 p-4 text-xs leading-relaxed text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <HighlightedJson json={json} />
      </pre>
    </section>
  );
}

export function HarnessExtensionsView() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Harness extensions
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Every tool the chat panel can render, and the exact definition (name,
          description, JSON Schema parameters) it registers — hand this to
          whoever implements the matching tool on the harness side.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {DEFAULT_HARNESS_EXTENSIONS.map((extension) => (
          <a
            key={extension.toolName}
            href={`#${extension.toolName}`}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            {extension.toolName}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-6">
        {DEFAULT_HARNESS_EXTENSIONS.map((extension) => (
          <ExtensionCard key={extension.toolName} extension={extension} />
        ))}
      </div>
    </div>
  );
}
