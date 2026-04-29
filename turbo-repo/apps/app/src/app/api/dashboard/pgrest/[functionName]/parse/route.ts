import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
  parseIntEnv,
} from "../../shared";
import { parseDocument } from "../../parser";
import { isSpreadsheetFilename, parseSpreadsheetBuffer } from "../../xlsx-parser";

const PGREST_PATH_REGEX = /^[a-zA-Z_][\w/]*$/;
const DEFAULT_MAX_PAYLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_PAYLOAD_BYTES = parseIntEnv(
  process.env.PGREST_PARSE_MAX_BYTES,
  DEFAULT_MAX_PAYLOAD_BYTES,
);

type RouteContext = { params: Promise<{ functionName: string }> };

/** Per-source provenance returned alongside the parsed doc. The bulk endpoint
 *  forwards these onto every imported row as audit metadata; computing them
 *  here means the client can't fabricate a hash that doesn't match what was
 *  actually parsed. */
export interface SourceMeta {
  type: "excel" | "csv" | "paste";
  /** Original filename for file uploads, "" for paste. */
  name: string;
  /** Lowercase hex SHA-256 of the source bytes (file bytes or UTF-8 text). */
  hash: string;
}

type ParseOutcome =
  | { doc: ReturnType<typeof parseDocument>; sourceMeta: SourceMeta }
  | { error: "Missing file." | "Missing 'text'." }
  | { tooLarge: true };

async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf =
    bytes instanceof ArrayBuffer
      ? bytes
      : new Uint8Array(bytes).buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        );
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const view = new Uint8Array(digest);
  let hex = "";
  for (const b of view) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function exceedsCap(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > MAX_PAYLOAD_BYTES;
}

async function parseFromRequest(req: NextRequest): Promise<ParseOutcome> {
  // RFC 7231 says media types are case-insensitive; normalize before matching
  // so an uppercased "MULTIPART/FORM-DATA" header doesn't slip into the JSON
  // branch.
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  // Reject upfront when Content-Length exceeds the cap so we don't buffer
  // huge bodies just to discover they're too big.
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const len = Number.parseInt(contentLength, 10);
    if (exceedsCap(len)) return { tooLarge: true };
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return { error: "Missing file." };
    }
    // Defense in depth: if Content-Length was missing or inaccurate, this is
    // the last guard before we allocate an ArrayBuffer for the whole file.
    if (exceedsCap(file.size)) return { tooLarge: true };
    // Buffer once; both the parser and the hash run off the same bytes, so a
    // re-read isn't needed and (for spreadsheets) `file.text()` would corrupt
    // the binary content anyway.
    const bytes = await file.arrayBuffer();
    const hash = await sha256Hex(bytes);
    const isSpreadsheet = isSpreadsheetFilename(file.name);
    const doc = isSpreadsheet
      ? await parseSpreadsheetBuffer(bytes)
      : parseDocument(new TextDecoder().decode(bytes));
    return {
      doc,
      sourceMeta: {
        type: isSpreadsheet ? "excel" : "csv",
        name: file.name,
        hash,
      },
    };
  }

  // JSON paste path: { text: string }
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  if (!body || typeof body.text !== "string") {
    return { error: "Missing 'text'." };
  }
  // `body.text.length` is UTF-16 code units, not bytes — strictly less than
  // the byte size for non-ASCII input. Comparing it against the byte cap is
  // therefore conservative (slightly stricter than the cap intends), which
  // is fine for the purpose of bounding memory.
  if (exceedsCap(body.text.length)) return { tooLarge: true };
  const textBytes = new TextEncoder().encode(body.text);
  const hash = await sha256Hex(textBytes);
  return {
    doc: parseDocument(body.text),
    sourceMeta: { type: "paste", name: "", hash },
  };
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { functionName } = await ctx.params;
  if (!PGREST_PATH_REGEX.test(functionName)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const parsed = await parseFromRequest(req);
  if ("tooLarge" in parsed) {
    return NextResponse.json(
      { error: `Payload too large (limit: ${MAX_PAYLOAD_BYTES} bytes).` },
      { status: 413 },
    );
  }
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const doc = parsed.doc;

  // Introspect so the client can pre-filter columns to schema-known fields.
  // Validation errors are returned by /validate, not here — keeps both
  // endpoints' wire surfaces narrow and avoids two pathways producing the
  // same error map.
  const spec = await fetchPgrestSpec(parseDataSourceParam(req));
  if (spec instanceof NextResponse) return spec;

  const introspected = introspectPath(spec, functionName);
  const allowedFields = (introspected?.parameters ?? []).map((p) => p.name);

  return NextResponse.json({
    headers: doc.headers,
    rows: doc.rows,
    headerError: doc.headerError,
    allowedFields,
    sourceMeta: parsed.sourceMeta,
  });
}
