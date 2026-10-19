import { forwardToOrg, jsonBody, pickQuery } from "@/app/api/utils/org-proxy";

const LIST_QUERY = {
  kind: /^(markdown|html|svg|deck|pdf|sections)$/,
  search: /^.{1,200}$/,
  limit: /^\d{1,4}$/,
};

/** The caller's stories and the ones shared with them. */
export async function GET(request: Request) {
  const query = pickQuery(new URL(request.url).searchParams, LIST_QUERY);
  return forwardToOrg(["stories"], { query });
}

/** A new story with its first version. */
export async function POST(request: Request) {
  return forwardToOrg(["stories"], {
    method: "POST",
    body: await jsonBody(request),
  });
}
