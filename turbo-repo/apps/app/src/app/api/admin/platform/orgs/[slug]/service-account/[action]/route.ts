import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { platformOrgPath } from "../../platform-org-path";

const ACTIONS = new Set(["disable", "enable", "check", "bigquery-connection"]);

/** POST /api/admin/platform/orgs/[slug]/service-account/{disable|enable|check|bigquery-connection} */
interface RouteParams {
  params: Promise<{ slug: string; action: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { slug, action } = await params;
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return forwardToQuarkus(platformOrgPath(slug, "service-account", action), {
    method: "POST",
  });
}
