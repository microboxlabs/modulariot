import { forwardTrainerCall } from "../../trainer-proxy";

type RouteContext = { params: Promise<{ ref: string }> };

/** A past chat of the organization as a compact transcript, by thread id or
 * share token. Trainers only. */
export async function GET(request: Request, ctx: RouteContext) {
  return forwardTrainerCall(
    request,
    "transcripts",
    [(await ctx.params).ref],
    "GET"
  );
}
