import { buildDataSourceParams } from "../../common/pgrest-utils";
import type { ParsedDocument, ParsedRow, RowStatus } from "./types";

/** Source provenance computed by /parse and forwarded to /bulk so every
 *  imported row can carry audit metadata (filename, fingerprint, type). The
 *  bulk endpoint stamps the unspoofable bits (`p_uploaded_by`, row counts)
 *  itself; this is the informational/best-effort half. */
export interface SourceMeta {
  type: "excel" | "csv" | "paste";
  /** Original filename for file uploads, "" for paste. */
  name: string;
  /** Lowercase hex SHA-256 of the source bytes (file bytes or UTF-8 text). */
  hash: string;
}

export interface ParseResponse {
  headers: string[];
  rows: ParsedRow[];
  headerError?: string;
  allowedFields: string[];
  sourceMeta: SourceMeta;
}

export interface ValidateResponse {
  allowedFields: string[];
  errors: Record<number, string>;
}

export interface BulkResultLine {
  index: number;
  status: RowStatus;
  errorMessage?: string;
}

export interface BulkSubmitContext {
  /** Provenance forwarded from the most recent /parse response. */
  sourceMeta: SourceMeta;
}

export interface PreviewLine {
  /** Original row index (matches `ParsedRow.index`). */
  index: number;
  /** Full JSON object /bulk POSTs to PostgREST: filtered user data merged
   *  with the unconditionally-stamped audit metadata. */
  body: Record<string, string>;
  /** Just the audit-metadata subset of `body`, surfaced separately so the UI
   *  can render a "configured audit fields" breakdown. */
  meta: Record<string, string>;
}

export interface PreviewResponse {
  /** Echo of the RPC's allowed parameter set (or null when introspection
   *  failed) so the UI can explain dropped fields. */
  allowedFields: string[] | null;
  totalRows: number;
  previews: PreviewLine[];
}

export interface BatchImporterApi {
  parseFile(file: File, signal?: AbortSignal): Promise<ParseResponse>;
  parseText(text: string, signal?: AbortSignal): Promise<ParseResponse>;
  validate(rows: ParsedRow[], signal?: AbortSignal): Promise<ValidateResponse>;
  bulkSubmit(
    rows: ParsedRow[],
    onResult: (line: BulkResultLine) => void,
    context: BulkSubmitContext,
    signal?: AbortSignal,
  ): Promise<void>;
  /** Dry-run: returns the enriched bodies /bulk would POST per row without
   *  actually calling PostgREST. Capped server-side. */
  preview(
    rows: ParsedRow[],
    context: BulkSubmitContext,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<PreviewResponse>;
}

function buildBaseUrl(functionName: string, dataSourceId: string | undefined, suffix: string) {
  const base = `/app/api/dashboard/pgrest/${encodeURIComponent(functionName.trim())}${suffix}`;
  const qs = buildDataSourceParams(dataSourceId).toString();
  return qs ? `${base}?${qs}` : base;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (body as { error?: string }).error ?? `HTTP ${res.status} ${res.statusText}`,
    );
  }
  return (await res.json()) as T;
}

const EMPTY_SOURCE_META: SourceMeta = { type: "paste", name: "", hash: "" };

function toParseResponse(raw: Partial<ParseResponse> & ParsedDocument): ParseResponse {
  return {
    headers: raw.headers ?? [],
    rows: raw.rows ?? [],
    headerError: raw.headerError,
    allowedFields: raw.allowedFields ?? [],
    // Default fallback so older servers (or error paths) don't break the
    // hook's assumption that `sourceMeta` is always present after parse.
    sourceMeta: raw.sourceMeta ?? EMPTY_SOURCE_META,
  };
}

const VALID_BULK_STATUSES = new Set<RowStatus>([
  "processed",
  "updated",
  "skipped",
  "failed",
]);

function isBulkLine(value: unknown): value is BulkResultLine {
  if (!value || typeof value !== "object") return false;
  const v = value as { index?: unknown; status?: unknown };
  if (typeof v.index !== "number") return false;
  if (typeof v.status !== "string") return false;
  return VALID_BULK_STATUSES.has(v.status as RowStatus);
}

export function makePgrestBatchApi(
  functionName: string,
  dataSourceId?: string,
  lang?: string,
): BatchImporterApi {
  const parseUrl = buildBaseUrl(functionName, dataSourceId, "/parse");
  const baseValidate = buildBaseUrl(functionName, dataSourceId, "/validate");
  // Append the UI locale so server-side validation messages match what the
  // user sees in the rest of the app. Falls back server-side to Accept-Language.
  const langSeparator = baseValidate.includes("?") ? "&" : "?";
  const validateUrl = lang
    ? `${baseValidate}${langSeparator}lang=${encodeURIComponent(lang)}`
    : baseValidate;
  const bulkUrl = buildBaseUrl(functionName, dataSourceId, "/bulk");
  const previewUrl = buildBaseUrl(functionName, dataSourceId, "/preview");

  return {
    async parseFile(file, signal) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(parseUrl, { method: "POST", body: form, signal });
      return toParseResponse(await readJson(res));
    },
    async parseText(text, signal) {
      const res = await fetch(parseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });
      return toParseResponse(await readJson(res));
    },
    async validate(rows, signal) {
      const payload = rows.map((r) => ({ index: r.index, fields: r.fields }));
      const res = await fetch(validateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
        signal,
      });
      const body = await readJson<ValidateResponse>(res);
      return {
        allowedFields: body.allowedFields ?? [],
        errors: body.errors ?? {},
      };
    },
    async bulkSubmit(rows, onResult, context, signal) {
      const payload = {
        rows: rows.map((r) => ({ index: r.index, fields: r.fields })),
        sourceMeta: context.sourceMeta,
      };
      const res = await fetch(bulkUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });
      if (!res.ok || !res.body) {
        const errBody = await res
          .json()
          .catch(() => ({ error: res.statusText }));
        throw new Error(
          (errBody as { error?: string }).error ??
            `HTTP ${res.status} ${res.statusText}`,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const flushLine = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          // Skip malformed lines rather than aborting the entire stream —
          // the rest of the import is still useful.
          console.warn("batch_import: bulkSubmit skipping malformed line", trimmed);
          return;
        }
        if (isBulkLine(parsed)) onResult(parsed);
      };

      // Always release the reader lock so the stream isn't pinned if
      // `reader.read()` rejects (network error / AbortError) or `onResult`
      // throws while we're processing a buffered line.
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            flushLine(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
          }
        }
        // Final partial line (no trailing newline).
        buffer += decoder.decode();
        flushLine(buffer);
      } finally {
        reader.releaseLock();
      }
    },
    async preview(rows, context, limit, signal) {
      const payload = {
        rows: rows.map((r) => ({ index: r.index, fields: r.fields })),
        sourceMeta: context.sourceMeta,
        limit: limit ?? 1,
      };
      const res = await fetch(previewUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });
      return readJson<PreviewResponse>(res);
    },
  };
}
