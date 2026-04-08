import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { createResourceClient } from "../../utils/miot-resource-api-client";
import { parsePageParams, isPageParamsError } from "../../utils/page-params";
import {
  MiotResourceApiError,
  type TruckMetricView,
  type TruckQueryParams,
} from "@microboxlabs/miot-resource-client";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { searchParams } = new URL(request.url);
  const pageParams = parsePageParams(searchParams);
  if (isPageParamsError(pageParams)) return pageParams.error;
  const { page, size } = pageParams;
  const includeMetrics = searchParams.get("includeMetrics");
  const metricView = searchParams.get("metricView");
  const metricFields = searchParams.get("metricFields");

  const truckQuery: TruckQueryParams = { page, size };
  if (includeMetrics !== null) {
    truckQuery.includeMetrics = includeMetrics === "true";
  }
  if (metricView) {
    truckQuery.metricView = metricView as TruckMetricView;
  }
  if (metricFields) {
    truckQuery.metricFields = metricFields;
  }

  try {
    const client = createResourceClient(authResult.session);
    const trucks = await client.fleet.listTrucks(truckQuery);
    return NextResponse.json(trucks);
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch trucks");
    return NextResponse.json({ error: "Failed to fetch trucks" }, { status });
  }
}
