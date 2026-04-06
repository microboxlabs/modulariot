import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { createResourceClient } from "../../utils/miot-resource-api-client";
import { parsePageParams, isPageParamsError } from "../../utils/page-params";
import { MiotResourceApiError } from "@microboxlabs/miot-resource-client";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { searchParams } = new URL(request.url);
  const pageParams = parsePageParams(searchParams);
  if (isPageParamsError(pageParams)) return pageParams.error;
  const { page, size } = pageParams;

  try {
    const client = createResourceClient(authResult.session);
    const trucks = await client.fleet.listTrucks({ page, size });
    return NextResponse.json(trucks);
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch trucks");
    return NextResponse.json({ error: "Failed to fetch trucks" }, { status });
  }
}
