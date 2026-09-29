import { forwardToOrg, jsonBody, pickQuery } from "@/app/api/utils/org-proxy";

const LIST_QUERY = {
  targetType: /^(story|thread)$/,
  targetId: /^[\w-]{1,128}$/,
};

/** The active links to a story or thread the caller owns. */
export async function GET(request: Request) {
  const query = pickQuery(new URL(request.url).searchParams, LIST_QUERY);
  return forwardToOrg(["links"], { query });
}

/** The link to a story or thread the caller owns, created if there is none. */
export async function POST(request: Request) {
  return forwardToOrg(["links"], {
    method: "POST",
    body: await jsonBody(request),
  });
}
