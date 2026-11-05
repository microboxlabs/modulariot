import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { relayToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

export const dynamic = "force-dynamic";

const ID = /^[0-9a-f-]{36}$/i;

/** The file of a delivery proof, `?trip=…&proof=…`, of the active organization. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const trip = query.get("trip") ?? "";
  const proof = query.get("proof") ?? "";
  if (!ID.test(trip) || !ID.test(proof)) {
    return NextResponse.json(
      { error: "Invalid trip or proof" },
      { status: 400 }
    );
  }
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return relayToStreamhubModulith(
    `/api/v1/orgs/${org}/trips/${trip}/deliveries/proofs/${proof}/content`,
    { method: "GET" }
  );
}
