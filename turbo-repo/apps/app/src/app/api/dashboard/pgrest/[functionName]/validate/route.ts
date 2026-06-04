import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
} from "../../shared";
import { sanitizeRows } from "../../sanitize";
import { makeValidationErrorMap, validateRows } from "../../validator";
import { isAuditField } from "../../audit-fields";
import {
  getDictionary,
  getLocaleFromRequest,
} from "@/features/i18n/i18n.service";
import { locales } from "@/features/i18n/tr.service";

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
  // Audit params are server-injected by /bulk; user data shouldn't be forced
  // to provide them, so filter them out before building the Zod schema.
  const params = (introspected?.parameters ?? []).filter(
    (p) => !isAuditField(p.name)
  );
  // Prefer the explicit `lang` query (sent by clients that know their UI
  // locale via the URL `[lang]` segment) over Accept-Language, which reflects
  // browser preference and can disagree with what the user is actually viewing.
  const queryLang = req.nextUrl.searchParams.get("lang");
  const locale =
    queryLang && locales.includes(queryLang)
      ? queryLang
      : getLocaleFromRequest(req);
  // The validator builds keys dynamically (validation.${issueCode}), so it uses
  // the dynamic (unchecked) translator from the third tuple slot.
  const [, , trDyn] = await getDictionary(locale);
  const errors = validateRows(rows, params, makeValidationErrorMap(trDyn));

  return NextResponse.json({
    allowedFields: params.map((p) => p.name),
    errors,
  });
}
