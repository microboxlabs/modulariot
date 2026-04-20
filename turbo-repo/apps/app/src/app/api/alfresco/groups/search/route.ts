import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchGroups } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
} from "@/app/api/utils/api-error-handler";

/**
 * GET /app/api/alfresco/groups/search?term=<string>
 *
 * Thin proxy over Alfresco v1 `/queries/groups`. Returns an array of
 * AuthoritySuggestion entries for autocomplete.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return unauthorizedResponse();

  const term = request.nextUrl.searchParams.get("term") ?? "";
  if (term.trim().length === 0) {
    return NextResponse.json({ data: [] });
  }

  try {
    const data = await searchGroups(session, term);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "searching Alfresco groups");
  }
}
