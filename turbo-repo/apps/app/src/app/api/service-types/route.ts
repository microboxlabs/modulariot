import { requireAuth } from "../utils/alfresco-crud-client";
import { getServiceTypes } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  try {
    const types = await getServiceTypes(authResult.session);
    return NextResponse.json(types);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch service types");
    return NextResponse.json(
      { error: "Failed to fetch service types" },
      { status: 500 }
    );
  }
}
