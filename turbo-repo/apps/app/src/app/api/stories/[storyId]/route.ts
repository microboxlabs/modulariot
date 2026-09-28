import { forwardToOrg, jsonBody } from "@/app/api/utils/org-proxy";

type Params = { params: Promise<{ storyId: string }> };

/** One story with its current version's content. */
export async function GET(_request: Request, { params }: Params) {
  const { storyId } = await params;
  return forwardToOrg(["stories", storyId]);
}

/** Rename a story or change its description. */
export async function PATCH(request: Request, { params }: Params) {
  const { storyId } = await params;
  return forwardToOrg(["stories", storyId], {
    method: "PATCH",
    body: await jsonBody(request),
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { storyId } = await params;
  return forwardToOrg(["stories", storyId], { method: "DELETE" });
}
