import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
} from "../../shared";
import { validateRows } from "../../validator";

const PGREST_PATH_REGEX = /^[a-zA-Z_][\w/]*$/;

type RouteContext = { params: Promise<{ functionName: string }> };

interface ValidateBody {
  rows?: Array<{ index?: unknown; fields?: unknown }>;
}

function sanitizeRows(
  raw: ValidateBody["rows"],
): { index: number; fields: Record<string, string> }[] {
  if (!Array.isArray(raw)) return [];
  const out: { index: number; fields: Record<string, string> }[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.index !== "number") continue;
    if (!r.fields || typeof r.fields !== "object") continue;
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.fields as Record<string, unknown>)) {
      fields[k] = typeof v === "string" ? v : v == null ? "" : String(v);
    }
    out.push({ index: r.index, fields });
  }
  return out;
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

  const body = (await req.json().catch(() => null)) as ValidateBody | null;
  const rows = sanitizeRows(body?.rows);

  const spec = await fetchPgrestSpec(parseDataSourceParam(req));
  if (spec instanceof NextResponse) return spec;

  const introspected = introspectPath(spec, functionName);
  const params = introspected?.parameters ?? [];
  const errors = validateRows(rows, params);

  return NextResponse.json({
    allowedFields: params.map((p) => p.name),
    errors,
  });
}
