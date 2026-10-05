import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** Every permission and role the modulith knows, with labels per language. */
export async function GET() {
  return forwardToQuarkus("/api/v1/access/catalog");
}
