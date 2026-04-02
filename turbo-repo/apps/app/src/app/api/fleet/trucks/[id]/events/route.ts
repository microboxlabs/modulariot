import { NextResponse } from "next/server";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import { createResourceClient } from "../../../../utils/miot-resource-api-client";
import { MiotResourceApiError } from "@microboxlabs/miot-resource-client";
import { logger } from "@/lib/logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id } = await params;
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;

  const client = createResourceClient(authResult.session);

  try {
    const events = await client.fleet.listTruckEvents(numericId, { limit });
    return NextResponse.json(events);
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error, id }, "Failed to fetch truck events");
    return NextResponse.json({ error: "Failed to fetch truck events" }, { status });
  }
}
