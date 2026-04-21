"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Button } from "flowbite-react";
import type {
  DuplicateStrategy,
  ParsedDocument,
  ParsedRow,
  RowStatus,
  SubmitFn,
  SubmitResult,
} from "./engine/types";
import { parseDocument } from "./engine/parser";
import {
  clearCache,
  clearFailed,
  isResolved,
  readCache,
  writeCache,
} from "./engine/importer";
import { StatusIcon } from "./components/status-icon";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

const RESOLVED: RowStatus[] = ["processed", "updated", "skipped"];

const ROW_BG: Record<RowStatus, string> = {
  unprocessed: "",
  wait: "bg-amber-50 dark:bg-amber-900/10",
  processed: "bg-green-50 dark:bg-green-900/10",
  updated: "bg-indigo-50 dark:bg-indigo-900/10",
  skipped: "bg-gray-50 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
  failed: "bg-red-50 dark:bg-red-900/10",
};

export interface UseBatchImporterArgs {
  submit: SubmitFn;
  sourceKey: string;
  defaultStrategy?: DuplicateStrategy;
}

export interface BatchImporterState {
  raw: string;
  doc: ParsedDocument | null;
  importing: boolean;
  strategy: DuplicateStrategy;
  setStrategy: (s: DuplicateStrategy) => void;
  summary: Record<RowStatus | "total", number>;
  importable: boolean;
  hasFailed: boolean;
  hasResolved: boolean;
  load: (text: string) => void;
  loadFile: (file: File) => Promise<void>;
  onImport: () => Promise<void>;
  onRetryFailed: () => void;
  onReset: () => void;
}

export function useBatchImporter({
  submit,
  sourceKey,
  defaultStrategy = "upsert",
}: UseBatchImporterArgs): BatchImporterState {
  const [raw, setRaw] = useState<string>("");
  const [doc, setDoc] = useState<ParsedDocument | null>(null);
  const [importing, setImporting] = useState(false);
  const [strategy, setStrategy] = useState<DuplicateStrategy>(defaultStrategy);

  const load = useCallback(
    (text: string) => {
      setRaw(text);
      const parsed = parseDocument(text);
      const cache = readCache(sourceKey);
      parsed.rows = parsed.rows.map((r) => {
        const cached = cache.status[r.fingerprint];
        if (cached && (isResolved(cached) || cached === "failed")) {
          return {
            ...r,
            status: cached,
            errorMessage: cache.errorlog[r.fingerprint],
          };
        }
        return r;
      });
      setDoc(parsed);
    },
    [sourceKey],
  );

  const loadFile = useCallback(
    async (file: File) => {
      load(await file.text());
    },
    [load],
  );

  const updateRow = useCallback((idx: number, row: ParsedRow) => {
    setDoc((d) => {
      if (!d) return d;
      const next = { ...d, rows: [...d.rows] };
      next.rows[idx] = row;
      return next;
    });
  }, []);

  const runImport = useCallback(
    async (targetIndexes?: Set<number>, rowsOverride?: ParsedRow[]) => {
      const rows = rowsOverride ?? doc?.rows;
      if (!rows) return;
      setImporting(true);
      try {
        const cache = readCache(sourceKey);
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (targetIndexes && !targetIndexes.has(row.index)) continue;
          if (row.status !== "unprocessed") continue;

          updateRow(i, { ...row, status: "wait" });

          let result: SubmitResult;
          try {
            result = await submit(row, strategy);
          } catch (err) {
            result = {
              status: "failed",
              errorMessage:
                err instanceof Error ? err.message : "Submit threw",
            };
          }

          cache.status[row.fingerprint] = result.status;
          if (result.errorMessage)
            cache.errorlog[row.fingerprint] = result.errorMessage;
          else delete cache.errorlog[row.fingerprint];
          writeCache(sourceKey, cache);

          updateRow(i, {
            ...row,
            status: result.status,
            errorMessage: result.errorMessage,
          });
        }
      } finally {
        setImporting(false);
      }
    },
    [doc, sourceKey, strategy, submit, updateRow],
  );

  const onImport = useCallback(() => runImport(), [runImport]);

  const onRetryFailed = useCallback(() => {
    if (!doc) return;
    clearFailed(sourceKey);
    const failedIndexes = new Set<number>();
    const resetRows = doc.rows.map((r) => {
      if (r.status === "failed") {
        failedIndexes.add(r.index);
        return {
          ...r,
          status: "unprocessed" as RowStatus,
          errorMessage: undefined,
        };
      }
      return r;
    });
    setDoc({ ...doc, rows: resetRows });
    // Pass resetRows explicitly so the import loop doesn't read the stale
    // closure's `doc` — setDoc hasn't committed yet when runImport starts.
    void runImport(failedIndexes, resetRows);
  }, [doc, sourceKey, runImport]);

  const onReset = useCallback(() => {
    clearCache(sourceKey);
    if (raw) load(raw);
  }, [sourceKey, raw, load]);

  const summary = useMemo(() => {
    const c: Record<RowStatus | "total", number> = {
      total: 0,
      unprocessed: 0,
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      wait: 0,
    };
    doc?.rows.forEach((r) => {
      c.total++;
      c[r.status]++;
    });
    return c;
  }, [doc]);

  return {
    raw,
    doc,
    importing,
    strategy,
    setStrategy,
    summary,
    importable: summary.unprocessed > 0,
    hasFailed: summary.failed > 0,
    hasResolved: RESOLVED.reduce((n, s) => n + summary[s], 0) > 0,
    load,
    loadFile,
    onImport,
    onRetryFailed,
    onReset,
  };
}

interface ViewProps {
  state: BatchImporterState;
  sample?: string;
  acceptedFileTypes?: string;
  dictionary: I18nRecord;
}

export function BatchImporterView({
  state,
  sample,
  acceptedFileTypes,
  dictionary,
}: Readonly<ViewProps>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    raw,
    doc,
    importing,
    strategy,
    setStrategy,
    summary,
    hasFailed,
    hasResolved,
    load,
    loadFile,
    onRetryFailed,
    onReset,
  } = state;

  const statusLabel = (status: RowStatus) =>
    tr(`dashboard.dashlets.batchImport.status.${status}`, dictionary);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 text-gray-900 dark:text-gray-100">
      <div className="flex justify-end gap-2">
        {sample && (
          <Button size="xs" color="gray" onClick={() => load(sample)}>
            {tr("dashboard.dashlets.batchImport.loadSample", dictionary)}
          </Button>
        )}
        <Button
          size="xs"
          color="gray"
          onClick={() => fileRef.current?.click()}
        >
          {tr("dashboard.dashlets.batchImport.loadFile", dictionary)}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={acceptedFileTypes || ".tsv,.csv,.txt,text/plain,text/csv"}
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
          {tr("dashboard.dashlets.batchImport.pasteHint", dictionary)}
        </span>
        <textarea
          value={raw}
          onChange={(e) => load(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-200 bg-white p-2 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>

      {doc?.headerError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {tr(
            `dashboard.dashlets.batchImport.headerError.${doc.headerError}`,
            dictionary,
          )}
        </div>
      )}

      {doc && !doc.headerError && doc.headers.length > 0 && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-t-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap gap-1.5">
              <Badge label={statusLabel("unprocessed")} count={summary.unprocessed} tone="ok" />
              <Badge label={statusLabel("processed")} count={summary.processed} tone="done" />
              <Badge label={statusLabel("updated")} count={summary.updated} tone="info" />
              <Badge label={statusLabel("skipped")} count={summary.skipped} tone="mute" />
              <Badge label={statusLabel("failed")} count={summary.failed} tone="fail" />
              <Badge label={tr("dashboard.dashlets.batchImport.total", dictionary)} count={summary.total} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                {tr("dashboard.dashlets.batchImport.duplicates", dictionary)}
                <select
                  value={strategy}
                  disabled={importing}
                  onChange={(e) =>
                    setStrategy(e.target.value as DuplicateStrategy)
                  }
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="upsert">
                    {tr("dashboard.dashlets.batchImport.strategy.upsert", dictionary)}
                  </option>
                  <option value="skip">
                    {tr("dashboard.dashlets.batchImport.strategy.skip", dictionary)}
                  </option>
                  <option value="create">
                    {tr("dashboard.dashlets.batchImport.strategy.create", dictionary)}
                  </option>
                </select>
              </label>
              <Button
                size="xs"
                color="gray"
                onClick={onRetryFailed}
                disabled={!hasFailed || importing}
              >
                {tr("dashboard.dashlets.batchImport.retryFailed", dictionary, { count: String(summary.failed) })}
              </Button>
              <Button
                size="xs"
                color="gray"
                onClick={onReset}
                disabled={importing || (!hasResolved && !hasFailed)}
              >
                {tr("dashboard.dashlets.batchImport.clearCache", dictionary)}
              </Button>
            </div>
          </section>

          <div className="min-h-0 flex-1 overflow-auto rounded-b-md border border-t-0 border-gray-200 dark:border-gray-700">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                <tr>
                  <th className="w-14 border-b border-r border-gray-200 p-2 text-center dark:border-gray-700">
                    {tr("dashboard.dashlets.batchImport.statusCol", dictionary)}
                  </th>
                  {doc.headers.map((h) => (
                    <th
                      key={h}
                      className="min-w-[120px] border-b border-r border-gray-200 p-2 text-left font-semibold dark:border-gray-700"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.rows.map((row) => (
                  <tr key={row.index} className={ROW_BG[row.status]}>
                    <td className="w-14 border-b border-r border-gray-200 p-2 text-center align-top dark:border-gray-700">
                      <StatusIcon
                        status={row.status}
                        tooltip={row.errorMessage}
                        label={statusLabel(row.status)}
                      />
                    </td>
                    {doc.headers.map((h) => (
                      <td
                        key={h}
                        className="border-b border-r border-gray-200 p-2 align-top dark:border-gray-700"
                      >
                        {row.fields[h] || (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

type BadgeTone = "ok" | "done" | "fail" | "info" | "mute";

const BADGE_TONES: Record<BadgeTone, string> = {
  ok: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  fail: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  mute: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

function Badge({
  label,
  count,
  tone,
}: Readonly<{ label: string; count: number; tone?: BadgeTone }>) {
  const cls = tone ? BADGE_TONES[tone] : BADGE_TONES.mute;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] ${cls}`}>
      <strong className="mr-1 font-semibold">{count}</strong>
      {label}
    </span>
  );
}
