import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { relayToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

export const dynamic = "force-dynamic";

const ID = /^[0-9a-f-]{36}$/i;

/**
 * Uploads a trip document (multipart: `file`, `docType`, optional `deliveryId`) for `?trip=…` of the active
 * organization. With `&doc=…` it replaces that document's file with a new version.
 */
export async function POST(request: Request) {
  const query = new URL(request.url).searchParams;
  const trip = query.get("trip") ?? "";
  const doc = query.get("doc");
  if (!ID.test(trip) || (doc !== null && !ID.test(doc))) {
    return NextResponse.json(
      { error: "Invalid trip or document" },
      { status: 400 }
    );
  }
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  const base = `/api/v1/orgs/${org}/trips/${trip}/documents`;
  return relayToStreamhubModulith(doc ? `${base}/${doc}/content` : base, {
    method: doc ? "PUT" : "POST",
    body: await request.formData(),
  });
}
