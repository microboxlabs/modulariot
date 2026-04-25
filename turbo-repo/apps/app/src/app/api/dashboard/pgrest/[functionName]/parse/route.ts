import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
} from "../../shared";
import { parseDocument } from "../../parser";
import { isSpreadsheetFilename, parseSpreadsheetBuffer } from "../../xlsx-parser";

const PGREST_PATH_REGEX = /^[a-zA-Z_][\w/]*$/;

type RouteContext = { params: Promise<{ functionName: string }> };

async function parseFromRequest(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return { error: "Missing file." as const };
    }
    if (isSpreadsheetFilename(file.name)) {
      return { doc: await parseSpreadsheetBuffer(await file.arrayBuffer()) };
    }
    return { doc: parseDocument(await file.text()) };
  }

  // JSON paste path: { text: string }
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  if (!body || typeof body.text !== "string") {
    return { error: "Missing 'text'." as const };
  }
  return { doc: parseDocument(body.text) };
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
  });
}
