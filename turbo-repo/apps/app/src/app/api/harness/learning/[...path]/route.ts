import { forwardTrainerCall } from "../../trainer-proxy";

type RouteContext = { params: Promise<{ path: string[] }> };

/** Before/after evaluations of knowledge changes, for trainers. */
export async function GET(request: Request, ctx: RouteContext) {
  return forwardTrainerCall(
    request,
    "learning",
    (await ctx.params).path,
    "GET"
  );
}

export async function POST(request: Request, ctx: RouteContext) {
  return forwardTrainerCall(
    request,
    "learning",
    (await ctx.params).path,
    "POST"
  );
}
