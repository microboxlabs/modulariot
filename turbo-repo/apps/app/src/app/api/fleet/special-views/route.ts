import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import {
  fetchSpecialViews,
  type PgrestFleetSpecialViewRow,
} from "../../utils/pgrest-client";
import { logger } from "@/lib/logger";

/**
 * GET /api/fleet/special-views
 *
 * Returns the active "Vista Especial" cards for the current tenant from
 * `ams.fleet_special_views` (read via pgrest). Tenant filtering is enforced
 * by the table's RLS policy on the JWT `azp` claim — the M2M token used by
 * `fetchSpecialViews` carries the same client_id we want to filter on.
 *
 * Returns an empty array on upstream failure so the carousel renders nothing
 * instead of breaking the page.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  try {
    const rows = await fetchSpecialViews();
    return NextResponse.json(rows satisfies PgrestFleetSpecialViewRow[], {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logger.warn(
      { err: error },
      "Failed to fetch fleet special views from pgrest"
    );
    return NextResponse.json([] satisfies PgrestFleetSpecialViewRow[], {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  }
}
