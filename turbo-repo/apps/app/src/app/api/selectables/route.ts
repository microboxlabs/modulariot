import { forwardSelectables } from "./forward-selectables";

/** The active organization's lists. */
export async function GET() {
  return forwardSelectables("");
}
