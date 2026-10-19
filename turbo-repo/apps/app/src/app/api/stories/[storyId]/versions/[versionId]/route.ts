import { forwardToOrg } from "@/app/api/utils/org-proxy";

/** One version with its content. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string; versionId: string }> }
) {
  const { storyId, versionId } = await params;
  return forwardToOrg(["stories", storyId, "versions", versionId]);
}
