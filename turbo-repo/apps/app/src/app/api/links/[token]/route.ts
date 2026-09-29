import { forwardToOrg, pickQuery } from "@/app/api/utils/org-proxy";

type Params = { params: Promise<{ token: string }> };

const PAGE_QUERY = { after: /^\d{1,19}$/, limit: /^\d{1,4}$/ };

/** A read-only snapshot of what the link points at. For a thread, `after`
 * and `limit` page its messages. */
export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const query = pickQuery(new URL(request.url).searchParams, PAGE_QUERY);
  return forwardToOrg(["links", token], { query });
}

/** Revoke a link. */
export async function DELETE(_request: Request, { params }: Params) {
  const { token } = await params;
  return forwardToOrg(["links", token], { method: "DELETE" });
}
