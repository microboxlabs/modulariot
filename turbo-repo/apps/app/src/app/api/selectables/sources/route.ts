import { forwardSelectables } from "../forward-selectables";

/** The system and connection sources a list can take its options from. */
export async function GET() {
  return forwardSelectables("/sources");
}
