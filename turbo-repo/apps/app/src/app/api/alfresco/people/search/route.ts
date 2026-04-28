import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchPeople } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
} from "@/app/api/utils/api-error-handler";

/**
 * GET /app/api/alfresco/people/search?term=<string>
 *
 * Thin proxy over Alfresco Share's `/alfresco/s/api/people?filter=…` webscript.
 * Returns an array of AuthoritySuggestion entries for autocomplete.
 *
 * Requires a trimmed term of at least 3 characters to avoid proxying short
 * prefixes that would match too many users and waste both client and Alfresco
 * resources.
 */
const MIN_SEARCH_LENGTH = 3;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return unauthorizedResponse();

  const term = (request.nextUrl.searchParams.get("term") ?? "").trim();
  if (term.length < MIN_SEARCH_LENGTH) {
    return NextResponse.json({ data: [] });
  }

  try {
    const data = await searchPeople(session, term);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "searching Alfresco people");
  }
}
