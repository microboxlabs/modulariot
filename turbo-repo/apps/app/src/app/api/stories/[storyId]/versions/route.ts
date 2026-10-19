import { forwardToOrg, jsonBody } from "@/app/api/utils/org-proxy";

type Params = { params: Promise<{ storyId: string }> };

/** A story's versions, without their content. */
export async function GET(_request: Request, { params }: Params) {
  const { storyId } = await params;
  return forwardToOrg(["stories", storyId, "versions"]);
}

/** Add a version; upstream makes it the current one. */
export async function POST(request: Request, { params }: Params) {
  const { storyId } = await params;
  return forwardToOrg(["stories", storyId, "versions"], {
    method: "POST",
    body: await jsonBody(request),
  });
}
