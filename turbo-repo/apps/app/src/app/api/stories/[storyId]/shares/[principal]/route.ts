import { forwardToOrg } from "@/app/api/utils/org-proxy";

/** Revoke one person's access to a story. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ storyId: string; principal: string }> }
) {
  const { storyId, principal } = await params;
  return forwardToOrg(["stories", storyId, "shares", principal], {
    method: "DELETE",
  });
}
