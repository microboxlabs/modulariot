import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";

/** Last position of each of the active organization's assets. */
export async function GET() {
  return forwardControlTowerMap("positions");
}
