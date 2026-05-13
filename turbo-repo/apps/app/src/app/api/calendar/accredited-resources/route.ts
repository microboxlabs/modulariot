import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import {
  fetchAccreditedResources,
  invalidateAccreditedResourcesCache,
  type AccreditedResourceType,
  type PgrestAccreditedResourceRow,
} from "../../utils/pgrest-client";
import { logger } from "@/lib/logger";

const ALLOWED_RESOURCE_TYPES: ReadonlySet<AccreditedResourceType> = new Set([
  "DRIVER",
  "TRUCK",
  "TRAILER",
  "CARRIER",
]);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /app/api/calendar/accredited-resources
 *   ?rutMandante=<rut>
 *   &delegacion=<code>
 *   [&resourceType=DRIVER|TRUCK|TRAILER|CARRIER]
 *   [&carrierId=<resource_id>]
 *   [&q=<search>]
 *   [&ids=<resource_id>[,<resource_id>...]]  pin these rows onto page 0
 *   [&offset=<int>]  default 0
 *   [&limit=<int>]   default 50, max 200
 *   [&refresh=1]     bypass the in-memory cache
 *
 * Proxies `ams.fn_rd_accredited_resources` via pgrest. The upstream function
 * returns the full (accredited + non-accredited) set for the scope; this
 * handler caches it in-process (see `fetchAccreditedResources`), then filters
 * and slices for pagination + client-side search.
 *
 * `q` matches `resource_name` and `identifier` (case-insensitive substring).
 * The response always echoes the unfiltered total so the client can render
 * "X / Y" counters alongside the filtered page.
 *
 * `ids` lets the caller pin specific rows (typically the currently-selected
 * carrier / driver / truck / trailer) so they stay resolvable for the combobox
 * trigger even when `q`/pagination would otherwise hide them. Pinned rows are
 * returned in a separate `pinned` array on the first page only (offset 0), are
 * matched on exact `resource_id`, bypass the `q` filter, and are de-duped
 * against the page slice.
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { searchParams } = new URL(request.url);
  const rutMandante = searchParams.get("rutMandante")?.trim();
  const delegacion = searchParams.get("delegacion")?.trim();
  const resourceTypeRaw = searchParams.get("resourceType")?.trim().toUpperCase();
  const carrierId = searchParams.get("carrierId")?.trim() || undefined;
  const q = searchParams.get("q")?.trim() ?? "";
  const idsRaw = searchParams.get("ids")?.trim();
  const pinIds = idsRaw
    ? idsRaw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  const offsetRaw = searchParams.get("offset");
  const limitRaw = searchParams.get("limit");
  const refresh = searchParams.get("refresh") === "1";

  if (!rutMandante || !delegacion) {
    return NextResponse.json(
      { error: "rutMandante and delegacion are required" },
      { status: 400 }
    );
  }

  let resourceType: AccreditedResourceType | undefined;
  if (resourceTypeRaw) {
    if (!ALLOWED_RESOURCE_TYPES.has(resourceTypeRaw as AccreditedResourceType)) {
      return NextResponse.json(
        { error: `Invalid resourceType: ${resourceTypeRaw}` },
        { status: 400 }
      );
    }
    resourceType = resourceTypeRaw as AccreditedResourceType;
  }

  const offset = Math.max(0, Number.parseInt(offsetRaw ?? "0", 10) || 0);
  const rawLimit = Number.parseInt(limitRaw ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT)
  );

  try {
    if (refresh) {
      invalidateAccreditedResourcesCache({
        rutMandante,
        delegacion,
        resourceType,
        carrierId,
      });
    }

    const allRows = await fetchAccreditedResources({
      rutMandante,
      delegacion,
      resourceType,
      carrierId,
    });

    const filtered = applyQuery(allRows, q);
    const page = filtered.slice(offset, offset + limit);

    // Pin the requested rows (currently-selected resources) onto the first
    // page so the client can always resolve the combobox's selected option,
    // even when `q`/pagination would otherwise hide it. Matched on exact
    // `resource_id` against the full (unfiltered) set and de-duped against the
    // current page so a row never appears twice.
    const pageIds = new Set(page.map((row) => row.resource_id));
    const pinned: PgrestAccreditedResourceRow[] =
      offset === 0 && pinIds.length > 0
        ? pinIds
            .map((id) => allRows.find((row) => row.resource_id === id))
            .filter(
              (row): row is PgrestAccreditedResourceRow =>
                row != null && !pageIds.has(row.resource_id)
            )
        : [];

    return NextResponse.json({
      data: page,
      pinned,
      total: allRows.length,
      filteredTotal: filtered.length,
      offset,
      limit,
      hasMore: offset + page.length < filtered.length,
    });
  } catch (error) {
    logger.error(
      { err: error, rutMandante, delegacion, resourceType, q },
      "Failed to fetch accredited resources"
    );
    return NextResponse.json(
      { error: "Failed to fetch accredited resources" },
      { status: 500 }
    );
  }
}

/**
 * Case-insensitive substring filter against `resource_name` and `identifier`.
 * Runs server-side (post-cache) so the client only pays for the slice it
 * actually renders.
 */
function applyQuery(
  rows: PgrestAccreditedResourceRow[],
  q: string
): PgrestAccreditedResourceRow[] {
  if (q.length === 0) return rows;
  const needle = q.toLowerCase();
  return rows.filter((row) => {
    const name = row.resource_name?.toLowerCase();
    const identifier = row.identifier?.toLowerCase();
    return (
      name?.includes(needle) === true || identifier?.includes(needle) === true
    );
  });
}
