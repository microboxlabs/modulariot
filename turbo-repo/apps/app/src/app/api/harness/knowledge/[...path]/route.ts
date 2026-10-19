import { forwardTrainerCall } from "../../trainer-proxy";

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * The harness's editable knowledge for trainers: layers, items, versions,
 * writes, deletes and reverts, through the modulith's trainer-gated proxy.
 */
export async function GET(request: Request, ctx: RouteContext) {
  return forwardTrainerCall(
    request,
    "knowledge",
    (await ctx.params).path,
    "GET"
  );
}

export async function PUT(request: Request, ctx: RouteContext) {
  return forwardTrainerCall(
    request,
    "knowledge",
    (await ctx.params).path,
    "PUT"
  );
}

export async function POST(request: Request, ctx: RouteContext) {
  return forwardTrainerCall(
    request,
    "knowledge",
    (await ctx.params).path,
    "POST"
  );
}

export async function DELETE(request: Request, ctx: RouteContext) {
  return forwardTrainerCall(
    request,
    "knowledge",
    (await ctx.params).path,
    "DELETE"
  );
}
