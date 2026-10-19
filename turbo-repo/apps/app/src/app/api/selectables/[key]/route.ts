import { forwardSelectables, keySegment } from "../forward-selectables";

type Params = { params: Promise<{ key: string }> };

export async function GET(_request: Request, { params }: Params) {
  return forwardSelectables(await keySegment(params));
}

/** Creates or replaces the list. */
export async function PUT(request: Request, { params }: Params) {
  const body = await request.json().catch(() => null);
  return forwardSelectables(await keySegment(params), { method: "PUT", body });
}

export async function DELETE(_request: Request, { params }: Params) {
  return forwardSelectables(await keySegment(params), { method: "DELETE" });
}
