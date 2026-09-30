import { forwardSelectables } from "../forward-selectables";

/** Drops every list and binding and puts the defaults back. */
export async function POST() {
  return forwardSelectables("/reset", { method: "POST", body: {} });
}
