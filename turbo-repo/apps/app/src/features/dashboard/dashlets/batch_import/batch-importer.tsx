"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Button, Spinner, Textarea } from "flowbite-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  BatchImporterApi,
  PreviewLine,
  SourceMeta,
} from "./engine/api";
import type {
  IntrospectedParam,
  ParsedDocument,
  RowState,
  RowStatus,
} from "./engine/types";
import { applyHeaderMap } from "./engine/header-map";
import type { TransformStep } from "./engine/transforms";
import { downloadCsv } from "./engine/download-csv";
import { Row } from "./components/row";
import { HeaderCell } from "./components/header-cell";
import { SchemaPanel } from "./components/schema-panel";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

const DEFAULT_STATE: RowState = { status: "unprocessed" };

/** Statuses that should survive a re-validation rebuild while an import is
 *  active. `wait` is in-flight; the three terminal successes are streamed
 *  back from /bulk and shouldn't be dropped if a rename triggers a fresh
 *  validation pass mid-import. `failed` is intentionally NOT in this set:
 *  if a rename fixes a previously-failed validation, we want the fresh
 *  pass to clear it rather than stick to the old error. */
const PRESERVE_DURING_IMPORT: ReadonlySet<RowStatus> = new Set<RowStatus>([
  "wait",
  "processed",
  "updated",
  "skipped",
]);

const ROW_HEIGHT = 36;
const STATUS_COL_WIDTH = 56;
const DATA_COL_MIN_WIDTH = 140;

/** Stable empty array used as the default `transforms` prop on header cells —
 *  passing `[]` literal would create a new reference each render and break the
 *  React.memo identity comparison on HeaderCell. */
const EMPTY_STEPS: readonly TransformStep[] = [];

export interface UseBatchImporterArgs {
  api: BatchImporterApi;
  /** RPC parameter schema — surfaced for the schema panel UI. Validation
   *  itself runs server-side via `api.validate`. */
  params?: IntrospectedParam[] | null;
  /** Optional filename prefix for the CSV download (e.g. the RPC function
   *  name). Defaults to `batch-import` when omitted. */
  filenameBase?: string;
  /** Persisted transforms keyed by mapped column name. Treated as initial
   *  state — the importer owns it from there until `onTransformsChange` runs. */
  initialTransforms?: Record<string, TransformStep[]>;
  /** Notified whenever the transforms map changes so the parent can persist
   *  it (e.g. into the dashlet's widget config). */
  onTransformsChange?: (next: Record<string, TransformStep[]>) => void;
  /** Persisted display-only date formats keyed by mapped column name. Does
   *  NOT alter the submitted value — only used by `renderDateCell` to shorten
   *  long ISO timestamps in the preview grid. */
  initialDateDisplayFormats?: Record<string, string>;
  /** Notified whenever the date-display-formats map changes so the parent
   *  can persist it. */
  onDateDisplayFormatsChange?: (next: Record<string, string>) => void;
}

export interface BatchImporterState {
  raw: string;
  /** Effective document: raw parse + the user's header renames applied. */
  doc: ParsedDocument | null;
  /** Original headers, in the same order as `doc.headers`. Passed to the UI
   *  so each header cell knows the raw name it was renamed from. */
  rawHeaders: string[];
  /** Current rename map: original header -> target name. */
  headerMap: Record<string, string>;
  /** Per-column transforms, keyed by *mapped* (post-rename) column name. */
  transforms: Record<string, TransformStep[]>;
  /** Replace the transforms list for one mapped column. Pass [] to clear. */
  setColumnTransforms: (target: string, steps: TransformStep[]) => void;
  /** Per-column display-only date formats (dayjs tokens) keyed by mapped
   *  column name. Consumed by `Row` to shorten long ISO timestamps; the
   *  value submitted to /bulk is unaffected. */
  dateDisplayFormats: Record<string, string>;
  /** Set or clear (pass empty string) the display format for one mapped
   *  column. */
  setColumnDateDisplayFormat: (target: string, value: string) => void;
  /** Names the RPC schema expects — surfaced as autocomplete options. */
  expectedNames: string[];
  /** Full schema introspection — passed through so the view can render a
   *  "what does this endpoint expect?" reference panel. */
  params: IntrospectedParam[] | null;
  renameHeader: (original: string, target: string) => void;
  rowStates: ReadonlyMap<number, RowState>;
  importing: boolean;
  parsing: boolean;
  validating: boolean;
  /** Last network error from `/validate`. Non-null means existing row error
   *  states are stale because the most recent re-validation failed; the UI
   *  should surface this so the user knows errors aren't being refreshed. */
  validationError: string | null;
  summary: Record<RowStatus | "total", number>;
  importable: boolean;
  hasFailed: boolean;
  hasResolved: boolean;
  /** True when there's at least one parsed row available to export. */
  downloadable: boolean;
  /** True when there's any state to clear (raw text, parsed doc, or row states). */
  clearable: boolean;
  load: (text: string) => void;
  loadDebounced: (text: string) => void;
  loadFile: (file: File) => Promise<void>;
  onImport: () => Promise<void>;
  onRetryFailed: () => Promise<void>;
  onReset: () => void;
  /** Trigger a browser download of the current grid (post-rename) as CSV. */
  onDownload: () => void;
  /** Drop everything: raw text, parsed doc, header renames, row states. */
  onClear: () => void;
  /** Latest payload-preview snapshot. `null` until the user clicks Preview;
   *  cleared on `onClear` and on every fresh parse so a stale preview can't
   *  mislead after the underlying rows changed. */
  preview: PreviewLine[] | null;
  /** True while a /preview request is in flight. */
  previewing: boolean;
  /** Last error from /preview, surfaced inline so the user knows the panel
   *  content is stale. */
  previewError: string | null;
  /** Trigger a /preview round-trip and stash the result on `preview`. */
  onPreview: (limit?: number) => Promise<void>;
  /** Hide the preview panel (state-only; doesn't drop the rows). */
  onClosePreview: () => void;
}

function getRowState(
  rowStates: ReadonlyMap<number, RowState>,
  index: number,
): RowState {
  return rowStates.get(index) ?? DEFAULT_STATE;
}

/**
 * Build the initial rowStates map from a freshly parsed document by
 * surfacing per-row validation errors from /validate as `failed` states.
 * Rows without errors are absent from the map and default to `unprocessed`.
 *
 * `prev` lets us reuse the existing RowState reference when a row's failed
 * error string is identical between runs. Without that, every re-validation
 * (e.g. triggered by a header rename) hands React.memo'd Rows fresh state
 * objects, forcing a full re-render of every failed row — which unmounts
 * any open Tooltip/popper underneath the cursor.
 */
function hydrateStates(
  doc: ParsedDocument,
  validations: Record<number, string>,
  prev: ReadonlyMap<number, RowState>,
): Map<number, RowState> {
  const map = new Map<number, RowState>();
  for (const r of doc.rows) {
    const err = validations[r.index];
    if (!err) continue;
    const prior = prev.get(r.index);
    if (prior?.status === "failed" && prior.errorMessage === err) {
      map.set(r.index, prior);
    } else {
      map.set(r.index, { status: "failed", errorMessage: err });
    }
  }
  return map;
}

export function useBatchImporter({
  api,
  params,
  filenameBase,
  initialTransforms,
  onTransformsChange,
  initialDateDisplayFormats,
  onDateDisplayFormatsChange,
}: UseBatchImporterArgs): BatchImporterState {
  const [raw, setRaw] = useState("");
  const [rawDoc, setRawDoc] = useState<ParsedDocument | null>(null);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  const [preview, setPreview] = useState<PreviewLine[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});
  const [transforms, setTransforms] = useState<
    Record<string, TransformStep[]>
  >(() => initialTransforms ?? {});
  const [dateDisplayFormats, setDateDisplayFormats] = useState<
    Record<string, string>
  >(() => initialDateDisplayFormats ?? {});
  const [rowStates, setRowStates] = useState<ReadonlyMap<number, RowState>>(
    () => new Map(),
  );

  /** Ref-mirror of `onTransformsChange` so we don't have to list it as a
   *  dep on `setColumnTransforms` — that would force callers to memoize the
   *  callback to keep header cells from re-rendering on every parent render. */
  const onTransformsChangeRef = useRef(onTransformsChange);
  onTransformsChangeRef.current = onTransformsChange;

  const setColumnTransforms = useCallback(
    (target: string, steps: TransformStep[]) => {
      setTransforms((prev) => {
        const next = { ...prev };
        if (steps.length === 0) delete next[target];
        else next[target] = steps;
        onTransformsChangeRef.current?.(next);
        return next;
      });
    },
    [],
  );

  /** Same ref-mirror pattern as `onTransformsChangeRef` so the setter can
   *  fire the parent persistence callback without re-creating itself when
   *  the parent re-renders. */
  const onDateDisplayFormatsChangeRef = useRef(onDateDisplayFormatsChange);
  onDateDisplayFormatsChangeRef.current = onDateDisplayFormatsChange;

  const setColumnDateDisplayFormat = useCallback(
    (target: string, value: string) => {
      setDateDisplayFormats((prev) => {
        const next = { ...prev };
        const trimmed = value.trim();
        if (trimmed) next[target] = trimmed;
        else delete next[target];
        onDateDisplayFormatsChangeRef.current?.(next);
        return next;
      });
    },
    [],
  );
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  /** Ref-mirror of `importing` so the validation effect can read the latest
   *  value without listing `importing` in its deps (which would make every
   *  import start/end retrigger a full re-validation pass). */
  const importingRef = useRef(importing);
  importingRef.current = importing;

  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Increments on every parse request; the async result is dropped if a newer
   *  parse has started since, so stale worker replies can't flash old data. */
  const parseToken = useRef(0);
  /** Separate token for validation passes so a rename that triggers a new
   *  validation doesn't have to wait on an in-flight parse (or vice-versa). */
  const validateToken = useRef(0);

  /** Apply header renames + per-column transforms to the raw parse. Memoized
   *  so consumers — including React.memo'd row children — don't churn on
   *  unrelated state updates. */
  const doc = useMemo(
    () => (rawDoc ? applyHeaderMap(rawDoc, headerMap, transforms) : null),
    [rawDoc, headerMap, transforms],
  );

  const expectedNames = useMemo(
    () => (params ?? []).map((p) => p.name),
    [params],
  );

  const cancelPendingParse = useCallback(() => {
    if (parseTimer.current) {
      clearTimeout(parseTimer.current);
      parseTimer.current = null;
    }
  }, []);

  /** Parse-only (no validation). Validation happens separately in an effect
   *  keyed on [doc] so renames can re-validate without re-parsing. */
  const runParse = useCallback(
    async (text: string) => {
      const token = ++parseToken.current;
      setParsing(true);
      // A fresh parse invalidates any preview the user previously inspected —
      // dropping it here keeps the panel honest instead of showing stale rows.
      setPreview(null);
      setPreviewError(null);
      try {
        const parsed = await api.parseText(text);
        if (token !== parseToken.current) return;
        setRawDoc({
          headers: parsed.headers,
          rows: parsed.rows,
          headerError: parsed.headerError,
        });
        setSourceMeta(parsed.sourceMeta);
      } catch (err) {
        if (token !== parseToken.current) return;
        console.warn("batch_import: parseText failed", err);
        setRawDoc({ headers: [], rows: [], headerError: "parse_failed" });
        setSourceMeta(null);
      } finally {
        if (token === parseToken.current) setParsing(false);
      }
    },
    [api],
  );

  const load = useCallback(
    (text: string) => {
      cancelPendingParse();
      setRaw(text);
      void runParse(text);
    },
    [cancelPendingParse, runParse],
  );

  const loadDebounced = useCallback(
    (text: string) => {
      setRaw(text);
      cancelPendingParse();
      parseTimer.current = setTimeout(() => {
        parseTimer.current = null;
        void runParse(text);
      }, 250);
    },
    [cancelPendingParse, runParse],
  );

  const loadFile = useCallback(
    async (file: File) => {
      cancelPendingParse();
      // Turn the spinner on before the first await so the UI reflects work
      // during the upload too — big files can take seconds to transmit.
      setParsing(true);
      // Match runParse: invalidate any stale preview before the new file arrives.
      setPreview(null);
      setPreviewError(null);
      const token = ++parseToken.current;
      setRaw("");
      try {
        const parsed = await api.parseFile(file);
        if (token !== parseToken.current) return;
        setRawDoc({
          headers: parsed.headers,
          rows: parsed.rows,
          headerError: parsed.headerError,
        });
        setSourceMeta(parsed.sourceMeta);
      } catch (err) {
        if (token !== parseToken.current) return;
        console.warn("batch_import: parseFile failed", err);
        setRawDoc({ headers: [], rows: [], headerError: "parse_failed" });
        setSourceMeta(null);
      } finally {
        if (token === parseToken.current) setParsing(false);
      }
    },
    [api, cancelPendingParse],
  );

  /** Single source of truth for "what does each row's status look like right
   *  now?": merges cache (from previous import runs) with the latest
   *  validation errors. Runs whenever the effective doc changes. */
  useEffect(() => {
    if (!doc) {
      setRowStates(new Map());
      setValidationError(null);
      return;
    }

    /** Rebuild rowStates from validations. When an import is in flight,
     *  merge existing in-flight/terminal statuses back on top so a
     *  rename-triggered re-validation doesn't visually reset the streaming
     *  /bulk progress. See PRESERVE_DURING_IMPORT at module scope. */
    const applyHydrate = (validations: Record<number, string>) => {
      setRowStates((prev) => {
        const next = hydrateStates(doc, validations, prev);
        if (importingRef.current) {
          for (const [idx, state] of prev) {
            if (PRESERVE_DURING_IMPORT.has(state.status)) {
              next.set(idx, state);
            }
          }
        }
        return next;
      });
    };

    if (doc.rows.length === 0) {
      applyHydrate({});
      setValidationError(null);
      return;
    }

    const ac = new AbortController();
    const token = ++validateToken.current;
    setValidating(true);
    api
      .validate(doc.rows, ac.signal)
      .then(({ errors }) => {
        if (token !== validateToken.current) return;
        setValidationError(null);
        applyHydrate(errors);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        if (token !== validateToken.current) return;
        console.warn("batch_import: re-validation failed", err);
        // Keep prior rowStates intact — wiping them on a transient network
        // error would silently hide real validation problems and let the
        // user click Import as if the rows were clean. Surface the failure
        // via `validationError` so the UI can warn instead.
        setValidationError(
          err instanceof Error && err.message
            ? err.message
            : "Re-validation failed",
        );
      })
      .finally(() => {
        if (token === validateToken.current) setValidating(false);
      });
    return () => ac.abort();
  }, [api, doc]);

  const renameHeader = useCallback((original: string, target: string) => {
    setHeaderMap((prev) => {
      const next = { ...prev };
      const clean = target.trim();
      if (!clean || clean === original) delete next[original];
      else next[original] = clean;
      return next;
    });
  }, []);

  // Drop renames that no longer reference any header in the freshly-parsed
  // doc — otherwise a map from a previous file would silently leak into the
  // next one (and could collide with a real header name).
  useEffect(() => {
    if (!rawDoc) {
      if (Object.keys(headerMap).length > 0) setHeaderMap({});
      return;
    }
    const present = new Set(rawDoc.headers);
    const stale = Object.keys(headerMap).filter((k) => !present.has(k));
    if (stale.length > 0) {
      setHeaderMap((prev) => {
        const next = { ...prev };
        for (const k of stale) delete next[k];
        return next;
      });
    }
    // Intentionally not depending on headerMap — that would cause a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDoc]);

  // Prune transforms whose target column is no longer present in the
  // effective (post-rename) doc — same leak protection as the rename map.
  // Persisted transforms from widget config that don't match this file's
  // columns still survive in the parent's storage; only the in-memory copy
  // is trimmed so we don't fingerprint orphan keys into validation requests.
  useEffect(() => {
    if (!rawDoc) {
      if (Object.keys(transforms).length > 0) {
        setTransforms({});
        onTransformsChangeRef.current?.({});
      }
      return;
    }
    const mapped = new Set(rawDoc.headers.map((h) => headerMap[h] ?? h));
    const stale = Object.keys(transforms).filter((k) => !mapped.has(k));
    if (stale.length > 0) {
      setTransforms((prev) => {
        const next = { ...prev };
        for (const k of stale) delete next[k];
        onTransformsChangeRef.current?.(next);
        return next;
      });
    }
    // Intentionally not depending on transforms — pruning sets them, which
    // would loop. The dep on headerMap is needed because renames change
    // which mapped names exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDoc, headerMap]);

  // Same prune pattern for the display-only date format map: drop entries
  // whose mapped column no longer exists so a previous file's preferences
  // don't leak into the next one.
  useEffect(() => {
    if (!rawDoc) {
      if (Object.keys(dateDisplayFormats).length > 0) {
        setDateDisplayFormats({});
        onDateDisplayFormatsChangeRef.current?.({});
      }
      return;
    }
    const mapped = new Set(rawDoc.headers.map((h) => headerMap[h] ?? h));
    const stale = Object.keys(dateDisplayFormats).filter((k) => !mapped.has(k));
    if (stale.length > 0) {
      setDateDisplayFormats((prev) => {
        const next = { ...prev };
        for (const k of stale) delete next[k];
        onDateDisplayFormatsChangeRef.current?.(next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDoc, headerMap]);

  useEffect(() => () => cancelPendingParse(), [cancelPendingParse]);

  /** Aborts the in-flight /bulk stream so closing the modal mid-import
   *  doesn't leave a backend stream + PostgREST fan-out running orphaned.
   *  Cleared in `runImport`'s finally so the next run gets a fresh controller. */
  const importAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => importAbortRef.current?.abort(), []);

  const patchRowStates = useCallback(
    (patch: (prev: Map<number, RowState>) => void) => {
      setRowStates((prev) => {
        const next = new Map(prev);
        patch(next);
        return next;
      });
    },
    [],
  );

  const runImport = useCallback(
    async (targetIndexes?: Set<number>) => {
      // Re-entrancy guard: a rapid double-click or an Enter-triggered form
      // submit can fire onImport twice before the submit button's disabled
      // prop re-renders, which would double-submit every unprocessed row.
      if (importing) return;
      const d = doc;
      if (!d) return;
      const current = rowStates;
      const toProcess = d.rows.filter((r) => {
        // Explicit retry: caller has already decided which rows to run.
        // We can't re-check `unprocessed` here because the setState that
        // cleared the prior `failed` status hasn't reached this closure
        // yet — `current` would still show the old state.
        if (targetIndexes) return targetIndexes.has(r.index);
        return getRowState(current, r.index).status === "unprocessed";
      });
      if (toProcess.length === 0) return;

      const controller = new AbortController();
      importAbortRef.current = controller;
      setImporting(true);
      patchRowStates((m) => {
        for (const r of toProcess) m.set(r.index, { status: "wait" });
      });

      try {
        await api.bulkSubmit(
          toProcess,
          (line) => {
            patchRowStates((m) => {
              m.set(line.index, {
                status: line.status,
                errorMessage: line.errorMessage,
              });
            });
          },
          {
            // Fall back to a paste-typed empty meta if `setSourceMeta` somehow
            // hasn't fired yet (e.g. a manual retry after a parse error).
            // The server-side `allowed` filter will drop fields whose value
            // is empty so this never injects a bogus hash.
            sourceMeta: sourceMeta ?? { type: "paste", name: "", hash: "" },
          },
          controller.signal,
        );
      } catch (err) {
        // Network failure, backend rejection, or modal-close abort — mark
        // anything still `wait` as failed so the user can see what didn't
        // run. AbortError surfaces here when the user closes mid-import.
        const message = err instanceof Error ? err.message : "Bulk import failed";
        console.warn("batch_import: bulkSubmit failed", err);
        patchRowStates((m) => {
          for (const r of toProcess) {
            const s = m.get(r.index);
            if (s?.status === "wait") {
              m.set(r.index, { status: "failed", errorMessage: message });
            }
          }
        });
      } finally {
        // Only null out the ref if it's still ours — defensive against a
        // hypothetical later run replacing it (the `importing` guard above
        // already prevents that, but cheap insurance).
        if (importAbortRef.current === controller) {
          importAbortRef.current = null;
        }
        setImporting(false);
      }
    },
    [api, doc, rowStates, patchRowStates, importing, sourceMeta],
  );

  const onImport = useCallback(() => runImport(), [runImport]);

  const onRetryFailed = useCallback(async () => {
    if (!doc) return;
    const failedIndexes = new Set<number>();
    for (const r of doc.rows) {
      if (rowStates.get(r.index)?.status === "failed") {
        failedIndexes.add(r.index);
      }
    }
    if (failedIndexes.size === 0) return;
    // No need to clear the prior `failed` status here — `runImport` will
    // flip these rows to `wait` (and then to whatever /bulk reports) as
    // part of its normal flow, since `targetIndexes` is now authoritative.
    await runImport(failedIndexes);
  }, [doc, rowStates, runImport]);

  const onReset = useCallback(() => {
    if (raw) load(raw);
    else setRowStates(new Map());
  }, [raw, load]);

  /** Wipe the modal back to "just opened" state: drop the raw text, parsed
   *  doc, header renames, row statuses, and any pending parse/validate or
   *  in-flight import. Doesn't close the modal. */
  const onClear = useCallback(() => {
    cancelPendingParse();
    parseToken.current++;
    validateToken.current++;
    importAbortRef.current?.abort();
    importAbortRef.current = null;
    setRaw("");
    setRawDoc(null);
    setSourceMeta(null);
    setHeaderMap({});
    setRowStates(new Map());
    setValidationError(null);
    setParsing(false);
    setValidating(false);
    setImporting(false);
    setPreview(null);
    setPreviewing(false);
    setPreviewError(null);
  }, [cancelPendingParse]);

  /** Dry-run a /preview round-trip and surface the enriched per-row body so
   *  the user can confirm what will actually hit PostgREST before committing
   *  to a real import. Reuses the same sourceMeta the import would send. */
  const onPreview = useCallback(
    async (limit?: number) => {
      const d = doc;
      if (!d || d.rows.length === 0) return;
      setPreviewing(true);
      setPreviewError(null);
      try {
        const res = await api.preview(
          d.rows,
          {
            sourceMeta: sourceMeta ?? { type: "paste", name: "", hash: "" },
          },
          limit,
        );
        setPreview(res.previews);
      } catch (err) {
        console.warn("batch_import: preview failed", err);
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    },
    [api, doc, sourceMeta],
  );

  const onClosePreview = useCallback(() => {
    setPreview(null);
    setPreviewError(null);
  }, []);

  const onDownload = useCallback(() => {
    if (!doc || doc.rows.length === 0) return;
    downloadCsv(doc, filenameBase);
  }, [doc, filenameBase]);

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
    if (doc) {
      for (const r of doc.rows) {
        c.total++;
        c[getRowState(rowStates, r.index).status]++;
      }
    }
    return c;
  }, [doc, rowStates]);

  return {
    raw,
    doc,
    rawHeaders: rawDoc?.headers ?? [],
    headerMap,
    transforms,
    setColumnTransforms,
    dateDisplayFormats,
    setColumnDateDisplayFormat,
    expectedNames,
    params: params ?? null,
    renameHeader,
    rowStates,
    importing,
    parsing,
    validating,
    validationError,
    summary,
    importable: summary.unprocessed > 0,
    hasFailed: summary.failed > 0,
    hasResolved:
      summary.processed + summary.updated + summary.skipped > 0,
    downloadable: !!doc && doc.rows.length > 0,
    clearable: !!rawDoc || raw.length > 0,
    load,
    loadDebounced,
    loadFile,
    onImport,
    onRetryFailed,
    onReset,
    onDownload,
    onClear,
    preview,
    previewing,
    previewError,
    onPreview,
    onClosePreview,
  };
}

interface ViewProps {
  state: BatchImporterState;
  acceptedFileTypes?: string;
  dictionary: I18nRecord;
}

export function BatchImporterView({
  state,
  acceptedFileTypes,
  dictionary,
}: Readonly<ViewProps>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    raw,
    doc,
    rawHeaders,
    headerMap,
    transforms,
    setColumnTransforms,
    dateDisplayFormats,
    setColumnDateDisplayFormat,
    expectedNames,
    params,
    renameHeader,
    rowStates,
    importing,
    parsing,
    validating,
    validationError,
    summary,
    hasFailed,
    hasResolved,
    downloadable,
    clearable,
    loadDebounced,
    loadFile,
    onRetryFailed,
    onReset,
    onDownload,
    onClear,
    preview,
    previewing,
    previewError,
    onPreview,
    onClosePreview,
  } = state;

  /** Lookup table from RPC param name -> declared type ("string", "number",
   *  "integer", …). The header cell uses it to filter the transforms picker
   *  so users only see steps that make sense for the column's type. */
  const expectedTypes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of params ?? []) map[p.name] = p.type;
    return map;
  }, [params]);

  /** Lookup table from RPC param name -> declared schema format ("date",
   *  "date-time", …). Threaded into header cells so the transforms picker
   *  can surface date-scoped steps for date columns. */
  const expectedFormats = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of params ?? []) {
      if (p.format) map[p.name] = p.format;
    }
    return map;
  }, [params]);

  /** Mapped-column names whose RPC schema declares a date or date-time format.
   *  Used by the preview rows to render `2026-03-01T10:27:45.000Z` as just
   *  `2026-03-01` while keeping the full ISO string in the cell `title` (and
   *  in the underlying field value, so /bulk still POSTs the precise value
   *  the validator's `datetime({ offset: true })` requires). */
  const dateColumns = useMemo(() => {
    const set = new Set<string>();
    for (const p of params ?? []) {
      if (p.format === "date" || p.format === "date-time") set.add(p.name);
    }
    return set;
  }, [params]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-end gap-2">
        {parsing && (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-300">
            <Spinner size="sm" />
            {tr("dashboard.dashlets.batchImport.parsing", dictionary) ||
              "Parsing…"}
          </span>
        )}
        <Button
          type="button"
          size="xs"
          color="light"
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
        >
          {tr("dashboard.dashlets.batchImport.loadFile", dictionary)}
        </Button>
        {/* sr-only (not `hidden`) so `.click()` reliably opens the picker.
            Deliberately NO aria-hidden / tabIndex={-1}: Chrome treats those
            as inert and silently rejects the programmatic click. */}
        <input
          ref={fileRef}
          type="file"
          accept={
            acceptedFileTypes ||
            ".tsv,.csv,.txt,.xlsx,.xls,.xlsm,.ods,text/plain,text/csv"
          }
          className="sr-only"
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
        <Textarea
          value={raw}
          onChange={(e) => loadDebounced(e.target.value)}
          rows={4}
          className="font-mono text-xs"
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

      {params && params.length > 0 && (
        <SchemaPanel
          params={params}
          mappedHeaders={doc?.headers ?? []}
          labels={{
            title:
              tr("dashboard.dashlets.batchImport.schemaTitle", dictionary) ||
              "Expected fields",
            required:
              tr("dashboard.dashlets.batchImport.required", dictionary) ||
              "required",
            optional:
              tr("dashboard.dashlets.batchImport.optional", dictionary) ||
              "optional",
            colName:
              tr("dashboard.dashlets.batchImport.schemaColName", dictionary) ||
              "name",
            colType:
              tr("dashboard.dashlets.batchImport.schemaColType", dictionary) ||
              "type",
            colConstraints:
              tr(
                "dashboard.dashlets.batchImport.schemaColConstraints",
                dictionary,
              ) || "constraints",
            present:
              tr(
                "dashboard.dashlets.batchImport.schemaFieldPresent",
                dictionary,
              ) || "present",
            missing:
              tr(
                "dashboard.dashlets.batchImport.schemaFieldMissing",
                dictionary,
              ) || "missing",
            missingSummary: (missing, total) =>
              tr("dashboard.dashlets.batchImport.schemaMissing", dictionary, {
                missing: String(missing),
                total: String(total),
              }) || `${missing} of ${total} required missing`,
            allMappedSummary: (total) =>
              tr("dashboard.dashlets.batchImport.schemaAllMapped", dictionary, {
                total: String(total),
              }) || `all ${total} required mapped`,
          }}
        />
      )}

      {doc && !doc.headerError && doc.headers.length > 0 && (
        <VirtualPreview
          doc={doc}
          rawHeaders={rawHeaders}
          headerMap={headerMap}
          expectedNames={expectedNames}
          expectedTypes={expectedTypes}
          expectedFormats={expectedFormats}
          dateColumns={dateColumns}
          transforms={transforms}
          setColumnTransforms={setColumnTransforms}
          dateDisplayFormats={dateDisplayFormats}
          setColumnDateDisplayFormat={setColumnDateDisplayFormat}
          renameHeader={renameHeader}
          rowStates={rowStates}
          importing={importing}
          parsing={parsing}
          validating={validating}
          validationError={validationError}
          downloadable={downloadable}
          onDownload={onDownload}
          clearable={clearable}
          onClear={onClear}
          summary={summary}
          hasFailed={hasFailed}
          hasResolved={hasResolved}
          onRetryFailed={() => void onRetryFailed()}
          onReset={onReset}
          preview={preview}
          previewing={previewing}
          previewError={previewError}
          onPreview={() => void onPreview(1)}
          onClosePreview={onClosePreview}
          dictionary={dictionary}
        />
      )}

      {parsing && !doc && (
        <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-gray-200 bg-gray-50 p-6 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <Spinner size="xl" />
          <span className="text-sm">
            {tr("dashboard.dashlets.batchImport.parsing", dictionary) ||
              "Parsing…"}
          </span>
        </div>
      )}
    </div>
  );
}

interface PreviewProps {
  doc: ParsedDocument;
  rawHeaders: string[];
  headerMap: Record<string, string>;
  expectedNames: string[];
  expectedTypes: Record<string, string>;
  expectedFormats: Record<string, string>;
  dateColumns: ReadonlySet<string>;
  transforms: Record<string, TransformStep[]>;
  setColumnTransforms: (target: string, steps: TransformStep[]) => void;
  dateDisplayFormats: Record<string, string>;
  setColumnDateDisplayFormat: (target: string, value: string) => void;
  renameHeader: (original: string, target: string) => void;
  rowStates: ReadonlyMap<number, RowState>;
  importing: boolean;
  parsing: boolean;
  validating: boolean;
  validationError: string | null;
  summary: Record<RowStatus | "total", number>;
  hasFailed: boolean;
  hasResolved: boolean;
  downloadable: boolean;
  clearable: boolean;
  onRetryFailed: () => void;
  onReset: () => void;
  onDownload: () => void;
  onClear: () => void;
  preview: PreviewLine[] | null;
  previewing: boolean;
  previewError: string | null;
  onPreview: () => void;
  onClosePreview: () => void;
  dictionary: I18nRecord;
}

function VirtualPreview({
  doc,
  rawHeaders,
  headerMap,
  expectedNames,
  expectedTypes,
  expectedFormats,
  dateColumns,
  transforms,
  setColumnTransforms,
  dateDisplayFormats,
  setColumnDateDisplayFormat,
  renameHeader,
  rowStates,
  importing,
  parsing,
  validating,
  validationError,
  summary,
  hasFailed,
  hasResolved,
  downloadable,
  clearable,
  onRetryFailed,
  onReset,
  onDownload,
  onClear,
  preview,
  previewing,
  previewError,
  onPreview,
  onClosePreview,
  dictionary,
}: Readonly<PreviewProps>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: doc.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const gridTemplate = useMemo(
    () =>
      `${STATUS_COL_WIDTH}px ${doc.headers
        .map(() => `minmax(${DATA_COL_MIN_WIDTH}px, 1fr)`)
        .join(" ")}`,
    [doc.headers],
  );

  /** Explicit min-width so the body can overflow the scroll container and
   *  trigger a horizontal scrollbar when headers exceed the viewport. Without
   *  this, `minmax(Npx, 1fr)` still gets squished by the flex/grid parent. */
  const contentMinWidth =
    STATUS_COL_WIDTH + doc.headers.length * DATA_COL_MIN_WIDTH;

  const statusLabels = useMemo(() => {
    const statuses: RowStatus[] = [
      "unprocessed",
      "wait",
      "processed",
      "updated",
      "skipped",
      "failed",
    ];
    const out: Record<RowStatus, string> = {} as Record<RowStatus, string>;
    for (const s of statuses) {
      out[s] = tr(`dashboard.dashlets.batchImport.status.${s}`, dictionary);
    }
    return out;
  }, [dictionary]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-t-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap gap-1.5">
          <Badge label={statusLabels.unprocessed} count={summary.unprocessed} tone="ok" />
          <Badge label={statusLabels.processed} count={summary.processed} tone="done" />
          <Badge label={statusLabels.updated} count={summary.updated} tone="info" />
          <Badge label={statusLabels.skipped} count={summary.skipped} tone="mute" />
          <Badge label={statusLabels.failed} count={summary.failed} tone="fail" />
          <Badge
            label={tr("dashboard.dashlets.batchImport.total", dictionary)}
            count={summary.total}
          />
          {Object.keys(headerMap).length > 0 && (
            <span
              className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              title={Object.entries(headerMap)
                .map(([k, v]) => `${k} → ${v}`)
                .join("\n")}
            >
              <strong className="mr-1 font-semibold">
                {Object.keys(headerMap).length}
              </strong>
              {tr("dashboard.dashlets.batchImport.renamed", dictionary) ||
                "renamed"}
            </span>
          )}
          {validating && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Spinner size="xs" />
              {tr("dashboard.dashlets.batchImport.validating", dictionary) ||
                "Validating…"}
            </span>
          )}
          {!validating && validationError && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] text-red-700 dark:bg-red-900/40 dark:text-red-300"
              title={validationError}
            >
              {tr(
                "dashboard.dashlets.batchImport.validationError",
                dictionary,
              ) || "Re-validation failed"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="xs"
            color="light"
            onClick={onRetryFailed}
            disabled={!hasFailed || importing}
          >
            {tr("dashboard.dashlets.batchImport.retryFailed", dictionary, {
              count: String(summary.failed),
            })}
          </Button>
          <Button
            type="button"
            size="xs"
            color="light"
            onClick={onDownload}
            disabled={!downloadable}
            title={
              tr(
                "dashboard.dashlets.batchImport.downloadHint",
                dictionary,
              ) || "Download the current grid as CSV"
            }
          >
            {tr("dashboard.dashlets.batchImport.download", dictionary) ||
              "Download CSV"}
          </Button>
          <Button
            type="button"
            size="xs"
            color="light"
            onClick={onReset}
            disabled={importing || (!hasResolved && !hasFailed)}
          >
            {tr("dashboard.dashlets.batchImport.reset", dictionary)}
          </Button>
          <Button
            type="button"
            size="xs"
            color="light"
            onClick={onPreview}
            disabled={previewing || doc.rows.length === 0}
            title={tr(
              "dashboard.dashlets.batchImport.previewHint",
              dictionary,
            )}
          >
            {previewing
              ? tr("dashboard.dashlets.batchImport.previewing", dictionary)
              : tr("dashboard.dashlets.batchImport.preview", dictionary)}
          </Button>
          <Button
            type="button"
            size="xs"
            color="light"
            onClick={onClear}
            disabled={importing || !clearable}
            title={
              tr(
                "dashboard.dashlets.batchImport.clearAllHint",
                dictionary,
              ) || "Clear everything and start over"
            }
          >
            {tr("dashboard.dashlets.batchImport.clearAll", dictionary) ||
              "Clear all"}
          </Button>
        </div>
      </section>

      {(preview || previewError) && (
        <PreviewPanel
          preview={preview}
          previewError={previewError}
          onClosePreview={onClosePreview}
          dictionary={dictionary}
        />
      )}

      {/* Concrete height is load-bearing here: the absolute-positioned scroll
          container would collapse to 0 (hiding the whole preview) if the
          wrapper has no sizing context. ModalBody only caps with `max-h`, so
          `flex-1` alone doesn't resolve to a real height. h-[55vh] gives the
          virtualizer a bounded viewport, which is also what enables row
          windowing to actually kick in. */}
      <div className="relative h-[55vh] min-h-[320px] flex-none">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-auto rounded-b-md border border-t-0 border-gray-200 dark:border-gray-700"
        >
          {/* Single wrapper sized with `width: max(100%, X)` — this is what
              reliably propagates horizontal overflow up to scrollRef. With
              two separate siblings each holding a `min-width`, some layouts
              (sticky element inside an absolute-positioned scroll container)
              did not consistently trigger a horizontal scrollbar. */}
          <div style={{ width: `max(100%, ${contentMinWidth}px)` }}>
            <div className="sticky top-0 z-10 bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
              <div
                className="grid border-b border-gray-200 text-xs font-semibold dark:border-gray-700"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="border-r border-gray-200 p-2 text-center dark:border-gray-700">
                  {tr("dashboard.dashlets.batchImport.statusCol", dictionary)}
                </div>
                {doc.headers.map((displayName, i) => {
                  // rawHeaders aligns with doc.headers by position —
                  // applyHeaderMap preserves order, so index i is the same
                  // column in both.
                  const original = rawHeaders[i] ?? displayName;
                  return (
                    <HeaderCell
                      key={original}
                      original={original}
                      displayName={displayName}
                      expectedNames={expectedNames}
                      expectedType={expectedTypes[displayName]}
                      expectedFormat={expectedFormats[displayName]}
                      transforms={transforms[displayName] ?? EMPTY_STEPS}
                      dateDisplayFormat={dateDisplayFormats[displayName] ?? ""}
                      onRename={renameHeader}
                      onTransformsChange={setColumnTransforms}
                      onDateDisplayFormatChange={setColumnDateDisplayFormat}
                      dictionary={dictionary}
                    />
                  );
                })}
              </div>
            </div>
            <div style={{ height: totalSize, position: "relative" }}>
              {virtualItems.map((v) => {
                // Guard against the window where the virtualizer still holds
                // a virtualItem from the previous doc but `doc.rows` has
                // already been swapped (e.g. after a header rename or a new
                // file load produced fewer rows). `doc.rows[v.index]` can be
                // undefined for one render until the virtualizer recomputes.
                const row = doc.rows[v.index];
                if (!row) return null;
                const s = rowStates.get(row.index) ?? DEFAULT_STATE;
                return (
                  // `transform: translateY(...)` on each virtual row creates
                  // its own stacking context. The StatusIcon's tooltip popper
                  // is a sibling node (Flowbite renders inline, no portal),
                  // so without `hover:z-20` later rows in DOM order paint
                  // over the popper. Lifting the hovered row above its
                  // siblings is enough — only one row is `:hover` at a time.
                  <div
                    key={v.index}
                    data-index={v.index}
                    ref={virtualizer.measureElement}
                    className="hover:z-20"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${v.start}px)`,
                    }}
                  >
                    <Row
                      row={row}
                      state={s}
                      headers={doc.headers}
                      statusLabel={statusLabels[s.status]}
                      gridTemplate={gridTemplate}
                      dateColumns={dateColumns}
                      dateDisplayFormats={dateDisplayFormats}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {parsing && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-b-md bg-white/70 dark:bg-gray-900/70">
            <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-300">
              <Spinner size="lg" />
              <span className="text-xs">
                {tr("dashboard.dashlets.batchImport.parsing", dictionary) ||
                  "Parsing…"}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
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
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] ${cls}`}
    >
      <strong className="mr-1 font-semibold">{count}</strong>
      {label}
    </span>
  );
}

interface PreviewPanelProps {
  preview: PreviewLine[] | null;
  previewError: string | null;
  onClosePreview: () => void;
  dictionary: I18nRecord;
}

function renderPreviewBody(
  preview: PreviewLine[] | null,
  previewError: string | null,
  dictionary: I18nRecord,
) {
  if (previewError) {
    return <p className="text-red-700 dark:text-red-300">{previewError}</p>;
  }
  if (!preview || preview.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400">
        {tr("dashboard.dashlets.batchImport.previewEmpty", dictionary)}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {preview.map((line) => (
        <div key={line.index}>
          <div className="mb-1 font-mono text-[10px] text-blue-800 dark:text-blue-300">
            {tr(
              "dashboard.dashlets.batchImport.previewRowLabel",
              dictionary,
              { number: String(line.index + 1) },
            )}
          </div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {tr(
              "dashboard.dashlets.batchImport.previewBodyTitle",
              dictionary,
            )}
          </div>
          <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-[11px] leading-snug text-gray-800 dark:bg-gray-900 dark:text-gray-100">
            {JSON.stringify(line.body, null, 2)}
          </pre>
          <div className="mt-2 mb-1 text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {tr(
              "dashboard.dashlets.batchImport.previewMetaTitle",
              dictionary,
            )}
          </div>
          <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-[11px] leading-snug text-gray-800 dark:bg-gray-900 dark:text-gray-100">
            {JSON.stringify(line.meta, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

/** Inline panel that surfaces the dry-run /preview result. Renders one
 *  pretty-printed JSON block per row so the user can confirm the exact body
 *  /bulk would POST to PostgREST — including server-injected `p_*` audit
 *  metadata. Sits right under the toolbar inside the import modal. */
function PreviewPanel({
  preview,
  previewError,
  onClosePreview,
  dictionary,
}: Readonly<PreviewPanelProps>) {
  return (
    <section className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900/40 dark:bg-blue-950/30">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-blue-900 dark:text-blue-200">
          {tr("dashboard.dashlets.batchImport.previewTitle", dictionary)}
        </span>
        <button
          type="button"
          onClick={onClosePreview}
          className="text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
          aria-label={tr(
            "dashboard.dashlets.batchImport.previewClose",
            dictionary,
          )}
        >
          ✕
        </button>
      </div>
      {renderPreviewBody(preview, previewError, dictionary)}
    </section>
  );
}
