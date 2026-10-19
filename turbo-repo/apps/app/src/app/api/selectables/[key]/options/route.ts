import { forwardSelectables, keySegment } from "../../forward-selectables";

/** The options a field shows; `q`, `parent` and `limit` pass through. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { search } = new URL(request.url);
  return forwardSelectables(`${await keySegment(params)}/options${search}`);
}
