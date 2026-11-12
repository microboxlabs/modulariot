import { after, type NextRequest } from "next/server";
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

/** The upstream open continues even when the browser disconnects before receiving its id. */
export async function POST(req: NextRequest, ctx: Context) {
  const path = (await ctx.params).path;
  const openingTreatment =
    path?.length === 3 && path[0] === "symptoms" && path[2] === "treatments";
  if (!openingTreatment) return proxy.POST(req, ctx);

  let abandon: (() => Promise<void>) | undefined;
  const opening = orgApiProxy("control-tower", {
    forward: async (upstreamPath, init) => {
      const response = await forwardToStreamhubModulith(upstreamPath, init);
      // A resumed episode belongs to an existing session and must survive this request.
      if (response.status === 201) {
        const episode = await response.clone().json();
        if (
          typeof episode.id === "string" &&
          /^[A-Za-z0-9_-]+$/.test(episode.id)
        ) {
          const base = upstreamPath.slice(
            0,
            upstreamPath.indexOf("/symptoms/")
          );
          abandon = async () => {
            const result = await forwardToStreamhubModulith(
              `${base}/treatments/${episode.id}/abandon`,
              { method: "POST", body: {} }
            );
            if (!result.ok)
              throw new Error("Could not abandon disconnected treatment");
          };
        }
      }
      return response;
    },
  }).POST(req, ctx);
  // Next keeps after() alive on client disconnect, with this request's auth context.
  after(async () => {
    await opening;
    if (req.signal.aborted) await abandon?.();
  });
  return opening;
}
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
