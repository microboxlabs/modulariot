import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { evictAllScopeCaches } from "@/app/api/utils/tenant-scope";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ID = /^[A-Za-z0-9-]+$/;

/** Accepts one of the signed-in email's invitations. */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!ID.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const response = await forwardToQuarkus(
    `/api/v1/me/invitations/${encodeURIComponent(id)}/accept`,
    { method: "POST", body: {} }
  );
  if (response.ok) evictAllScopeCaches();
  return response;
}
