import { forwardToOrg, jsonBody } from "@/app/api/utils/org-proxy";

/** Give one person read or write access to a story the caller owns. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;
  return forwardToOrg(["stories", storyId, "shares"], {
    method: "POST",
    body: await jsonBody(request),
  });
}
