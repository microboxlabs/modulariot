import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { relayToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

export const dynamic = "force-dynamic";

const ID = /^[0-9a-f-]{36}$/i;

/** Uploads a delivery's proof (multipart: `file`, `kind`) for `?trip=…&delivery=…` of the active organization. */
export async function POST(request: Request) {
  const query = new URL(request.url).searchParams;
  const trip = query.get("trip") ?? "";
  const delivery = query.get("delivery") ?? "";
  if (!ID.test(trip) || !ID.test(delivery)) {
    return NextResponse.json(
      { error: "Invalid trip or delivery" },
      { status: 400 }
    );
  }
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return relayToStreamhubModulith(
    `/api/v1/orgs/${org}/trips/${trip}/deliveries/${delivery}/proofs`,
    { method: "POST", body: await request.formData() }
  );
}
