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

  const client = createResourceClient(authResult.session);

  try {
    const trailers = await client.fleet.listTrailers({ page, size });
    return NextResponse.json(trailers);
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch trailers");
    return NextResponse.json({ error: "Failed to fetch trailers" }, { status });
  }
}
