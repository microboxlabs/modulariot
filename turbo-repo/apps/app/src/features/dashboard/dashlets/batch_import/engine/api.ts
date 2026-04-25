import { buildDataSourceParams } from "../../common/pgrest-utils";
import type {
  DuplicateStrategy,
  ParsedDocument,
  ParsedRow,
  RowStatus,
} from "./types";

export interface ParseResponse {
  headers: string[];
  rows: ParsedRow[];
  headerError?: string;
  allowedFields: string[];
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

export interface BatchImporterApi {
  parseFile(file: File, signal?: AbortSignal): Promise<ParseResponse>;
  parseText(text: string, signal?: AbortSignal): Promise<ParseResponse>;
  validate(rows: ParsedRow[], signal?: AbortSignal): Promise<ValidateResponse>;
  bulkSubmit(
    rows: ParsedRow[],
    duplicateStrategy: DuplicateStrategy,
    onResult: (line: BulkResultLine) => void,
    signal?: AbortSignal,
  ): Promise<void>;
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

function toParseResponse(raw: Partial<ParseResponse> & ParsedDocument): ParseResponse {
  return {
    headers: raw.headers ?? [],
    rows: raw.rows ?? [],
    headerError: raw.headerError,
    allowedFields: raw.allowedFields ?? [],
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
): BatchImporterApi {
  const parseUrl = buildBaseUrl(functionName, dataSourceId, "/parse");
  const validateUrl = buildBaseUrl(functionName, dataSourceId, "/validate");
  const bulkUrl = buildBaseUrl(functionName, dataSourceId, "/bulk");

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
    async bulkSubmit(rows, duplicateStrategy, onResult, signal) {
      const payload = {
        rows: rows.map((r) => ({ index: r.index, fields: r.fields })),
        duplicateStrategy,
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
  };
}
