"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import { HiOutlineDuplicate, HiRefresh } from "react-icons/hi";
import { mutate } from "swr";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import { ICON_BUTTON } from "./audience-list";
import {
  copyPlatformTemplates,
  orgMetaTemplatesKey,
  useOrgMetaTemplates,
} from "./conversations-api";
import type { TemplateCopyResult } from "./conversations-types";
import MetaStatusChip from "./meta-template-status";

function count(results: TemplateCopyResult[], status: string) {
  return String(results.filter((r) => r.status === status).length);
}

/**
 * The WhatsApp templates on the organization's own account, and copying the platform's to it. Rules send
 * templates by name, so the account needs them approved before it can send.
 */
export default function OwnTemplatesPanel({ d }: Readonly<{ d: I18nRecord }>) {
  const {
    data: templates,
    error,
    isLoading,
    isValidating,
  } = useOrgMetaTemplates();
  const [copying, setCopying] = useState(false);
  const [results, setResults] = useState<TemplateCopyResult[] | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const copy = async () => {
    setCopying(true);
    setCopyError(null);
    try {
      setResults(await copyPlatformTemplates());
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : tr("loadFailed", d));
    } finally {
      setCopying(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {tr("channelOwnTemplatesTitle", d)}
          </h3>
          <p className={`text-sm ${MUTED}`}>
            {tr("channelOwnTemplatesHint", d)}
          </p>
        </div>
        <button
          type="button"
          aria-label={tr("metaRefresh", d)}
          title={tr("metaRefresh", d)}
          className={ICON_BUTTON}
          disabled={isValidating}
          onClick={() => void mutate(orgMetaTemplatesKey)}
        >
          <HiRefresh
            className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`}
          />
        </button>
        <Button size="sm" color="light" disabled={copying} onClick={copy}>
          <HiOutlineDuplicate className="mr-1 h-4 w-4" />
          {tr("channelCopyTemplates", d)}
        </Button>
      </div>
      {results && (
        <output className="flex flex-col gap-1 text-sm">
          <span className="text-gray-900 dark:text-white">
            {tr("channelCopyResult", d, {
              copied: count(results, "COPIED"),
              exists: count(results, "EXISTS"),
              failed: count(results, "FAILED"),
            })}
          </span>
          {results
            .filter((r) => r.status === "FAILED")
            .map((r) => (
              <span
                key={`${r.name}/${r.language}`}
                className="text-xs text-red-600 dark:text-red-400"
              >
                <span className="font-mono">{r.name}</span>: {r.error}
              </span>
            ))}
        </output>
      )}
      {copyError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {copyError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error && error.message
            ? error.message
            : tr("loadFailed", d)}
        </p>
      )}
      {isLoading && <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>}
      {templates?.length === 0 && (
        <p className={`text-sm ${MUTED}`}>{tr("metaNoTemplates", d)}</p>
      )}
      {templates && templates.length > 0 && (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-gray-900 dark:text-white">
                {t.name}
              </span>
              <span className={`text-xs ${MUTED}`}>{t.language}</span>
              <MetaStatusChip status={t.status} d={d} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
