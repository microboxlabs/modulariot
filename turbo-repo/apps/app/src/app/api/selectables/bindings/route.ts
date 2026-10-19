import { forwardSelectables } from "../forward-selectables";

/** Which list each form field uses. */
export async function GET() {
  return forwardSelectables("/bindings");
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  return forwardSelectables("/bindings", { method: "PUT", body });
}
