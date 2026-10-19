import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import {
  invalidJson,
  invalidPath,
  readJson,
  templatePath,
  type TemplateParams,
} from "../../../template-path";

/** POST /api/admin/platform/mail-templates/{kind}/{lang}/preview — renders an unsaved template. */
export async function POST(request: Request, ctx: TemplateParams) {
  const path = await templatePath(ctx);
  if (!path) return invalidPath();
  const json = await readJson(request);
  if (!json) return invalidJson();
  return forwardToQuarkus(`${path}/preview`, {
    method: "POST",
    body: json.body,
  });
}
