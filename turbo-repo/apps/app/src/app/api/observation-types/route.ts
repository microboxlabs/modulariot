import { requireAuth } from "../utils/alfresco-crud-client";
import { getObservationTypes } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const appliesTo = new URL(req.url).searchParams.get("appliesTo");

  try {
    const types = await getObservationTypes(authResult.session, appliesTo);
    return NextResponse.json(types);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch observation types");
    return NextResponse.json(
      { error: "Failed to fetch observation types" },
      { status: 500 }
    );
  }
}
