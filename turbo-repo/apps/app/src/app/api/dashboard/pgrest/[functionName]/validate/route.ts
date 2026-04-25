import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
} from "../../shared";
import { sanitizeRows } from "../../sanitize";
import { validateRows } from "../../validator";

const PGREST_PATH_REGEX = /^[a-zA-Z_][\w/]*$/;

type RouteContext = { params: Promise<{ functionName: string }> };

interface ValidateBody {
  rows?: unknown;
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
