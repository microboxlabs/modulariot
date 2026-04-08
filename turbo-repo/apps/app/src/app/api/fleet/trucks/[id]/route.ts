import { NextResponse } from "next/server";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { createResourceClient } from "../../../utils/miot-resource-api-client";
import {
  MiotResourceApiError,
  type TruckMetricView,
} from "@microboxlabs/miot-resource-client";
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
  const includeMetrics = searchParams.get("includeMetrics");
  const metricView = searchParams.get("metricView");
  const metricFields = searchParams.get("metricFields");

  try {
    const client = createResourceClient(authResult.session);
    const truck = await client.fleet.getTruck(numericId, {
      includeMetrics: includeMetrics === null ? undefined : includeMetrics === "true",
      metricView: metricView ? (metricView as TruckMetricView) : undefined,
      metricFields: metricFields ?? undefined,
    });
    return NextResponse.json(truck);
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error, id }, "Failed to fetch truck");
    return NextResponse.json({ error: "Failed to fetch truck" }, { status });
  }
}
