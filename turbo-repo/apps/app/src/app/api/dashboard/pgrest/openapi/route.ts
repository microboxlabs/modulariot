import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
} from "../shared";
import { isAuditField } from "../audit-fields";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fn = url.searchParams.get("fn");
  if (!fn) {
    return NextResponse.json(
      { error: "Missing path parameter." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchPgrestSpec(parseDataSourceParam(req));
    if (result instanceof NextResponse) return result;

    const introspected = introspectPath(result, fn);
    if (!introspected) {
      return NextResponse.json(
        { error: `Path "${fn}" not found in OpenAPI spec.` },
        { status: 404 }
      );
    }

    // Strip server-injected audit params from the schema returned to the
    // client: those fields are stamped at /bulk time, not by the user, so the
    // schema panel shouldn't mark them "required missing" and autocomplete
    // shouldn't suggest them. /bulk does its own introspection and keeps the
    // full set, which is what the meta-body filter needs to pass them through.
    return NextResponse.json({
      ...introspected,
      parameters: introspected.parameters.filter((p) => !isAuditField(p.name)),
    });
  } catch (error) {
    console.error("OpenAPI introspection error:", error);
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec." },
      { status: 502 }
    );
  }
}
