import { NextResponse } from "next/server";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { createResourceClient } from "../../../utils/miot-resource-api-client";
import { MiotResourceApiError } from "@microboxlabs/miot-resource-client";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id } = await params;
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid truck ID" }, { status: 400 });
  }

  try {
    const client = createResourceClient(authResult.session);
    const truck = await client.fleet.getTruck(numericId);
    return NextResponse.json(truck);
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error, id }, "Failed to fetch truck");
    return NextResponse.json({ error: "Failed to fetch truck" }, { status });
  }
}
