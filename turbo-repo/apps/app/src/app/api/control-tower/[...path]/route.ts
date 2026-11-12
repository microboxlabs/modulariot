import { after, NextResponse, type NextRequest } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { orgApiProxy } from "@/app/api/utils/org-api-proxy";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * Proxy to the Control Tower API (`/api/v1/orgs/{org}/control-tower/...`) on the
 * modulith next to the GPS data: `MIOT_STREAMHUB_API_URL`, else `MIOT_MODULITH_URL`.
 */
const proxy = orgApiProxy("control-tower", {
  forward: forwardToStreamhubModulith,
});

export const GET = proxy.GET;
type Context = { params: Promise<{ path?: string[] }> };

/** Only abandonment may select an earlier organization, and only from verified memberships. */
const abandonProxy = orgApiProxy("control-tower", {
  forward: async (upstreamPath, init) => {
    const origin = (init.body as { organizationSlug?: string } | null)
      ?.organizationSlug;
    if (!origin) return forwardToStreamhubModulith(upstreamPath, init);
    const scope = await resolveTenantScope();
    if (!scope.resolved) return scope.response;
    const allowed = scope.scope.availableOrgs.some(
      (org) => org.slug === origin
    );
    if (!allowed)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const path = upstreamPath.replace(
      /^\/api\/v1\/orgs\/[^/]+/,
      `/api/v1/orgs/${encodeURIComponent(origin)}`
    );
    return forwardToStreamhubModulith(path, { method: "POST", body: {} });
  },
});

function isWrite(
  path: string[] | undefined,
  resource: string,
  operation: string
) {
  return path?.length === 3 && path[0] === resource && path[2] === operation;
}

/** The server completes pending writes and cleanup even after the browser disconnects. */
export async function POST(req: NextRequest, ctx: Context) {
  const path = (await ctx.params).path;
  if (isWrite(path, "treatments", "abandon"))
    return abandonProxy.POST(req, ctx);
  const openingTreatment = isWrite(path, "symptoms", "treatments");
  const writingAction = isWrite(path, "treatments", "actions");
  if (!openingTreatment && !writingAction) return proxy.POST(req, ctx);

  let abandon: (() => Promise<void>) | undefined;
  const writing = orgApiProxy("control-tower", {
    forward: async (upstreamPath, init) => {
      const response = await forwardToStreamhubModulith(upstreamPath, init);
      const base = upstreamPath.match(
        /^\/api\/v1\/orgs\/[^/]+\/control-tower/
      )?.[0];
      if (!base) return response;
      let id = writingAction ? path?.[1] : undefined;
      if (openingTreatment && response.ok) {
        response.headers.set(
          "X-Control-Tower-Organization",
          decodeURIComponent(base.split("/")[4] ?? "")
        );
        // A resumed episode belongs to an existing session: only clean up new opens.
        if (response.status === 201) id = (await response.clone().json()).id;
      }
      if (typeof id === "string" && /^[A-Za-z0-9_-]+$/.test(id)) {
        const treatmentId = id;
        abandon = async () => {
          const result = await forwardToStreamhubModulith(
            `${base}/treatments/${treatmentId}/abandon`,
            { method: "POST", body: {} }
          );
          if (!result.ok)
            throw new Error("Could not abandon disconnected treatment");
        };
      }
      return response;
    },
  }).POST(req, ctx);
  after(async () => {
    await writing;
    if (req.signal.aborted) await abandon?.();
  });
  return writing;
}
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
