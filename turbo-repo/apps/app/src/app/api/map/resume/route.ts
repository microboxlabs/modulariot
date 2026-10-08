import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";

/** Service, fleet and symptom totals shown beside the map. */
export async function GET() {
  return forwardControlTowerMap("summary");
}
