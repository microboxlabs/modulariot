import { forwardToOrg, jsonBody } from "@/app/api/utils/org-proxy";

/** Make an existing version the one the story shows. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;
  return forwardToOrg(["stories", storyId, "current-version"], {
    method: "PUT",
    body: await jsonBody(request),
  });
}
