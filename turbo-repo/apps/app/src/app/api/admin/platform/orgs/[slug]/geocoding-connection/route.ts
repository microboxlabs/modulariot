import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { platformOrgPath } from "../platform-org-path";

/**
 * GET / POST / DELETE /api/admin/platform/orgs/[slug]/geocoding-connection —
 * the organization's connection to the platform's geocoding provider.
 *
 * Proxies to the modulith that runs trips, where the geocoder reads the
 * connection. The modulith requires platform ownership, so the session is
 * always forwarded.
 */
interface RouteParams {
  params: Promise<{ slug: string }>;
}

async function path(params: RouteParams["params"]): Promise<string> {
  const { slug } = await params;
  return platformOrgPath(slug, "geocoding-connection");
}

export async function GET(_request: Request, { params }: RouteParams) {
  return forwardToStreamhubModulith(await path(params), { sessionOnly: true });
}

export async function POST(_request: Request, { params }: RouteParams) {
  return forwardToStreamhubModulith(await path(params), {
    method: "POST",
    sessionOnly: true,
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  return forwardToStreamhubModulith(await path(params), {
    method: "DELETE",
    sessionOnly: true,
  });
}
