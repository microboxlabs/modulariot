import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { relayToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

export const dynamic = "force-dynamic";

const ID = /^[0-9a-f-]{36}$/i;

/** The current file of a trip document, `?trip=…&doc=…`; `&download=1` asks the browser to save it. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const trip = query.get("trip") ?? "";
  const doc = query.get("doc") ?? "";
  if (!ID.test(trip) || !ID.test(doc)) {
    return NextResponse.json(
      { error: "Invalid trip or document" },
      { status: 400 }
    );
  }
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  const download = query.get("download") === "1" ? "?download=true" : "";
  return relayToStreamhubModulith(
    `/api/v1/orgs/${org}/trips/${trip}/documents/${doc}/content${download}`,
    { method: "GET" }
  );
}
