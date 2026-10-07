import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import {
  invalidJson,
  invalidPath,
  readJson,
  templatePath,
  type TemplateParams,
} from "../../template-path";

/**
 * GET / PUT / DELETE /api/admin/platform/mail-templates/{kind}/{lang} — the
 * platform's email template. Proxies to Quarkus
 * `/api/v1/platform/mail-templates/{kind}/{lang}`, which requires platform
 * ownership.
 */
export async function GET(_request: Request, ctx: TemplateParams) {
  const path = await templatePath(ctx);
  return path ? forwardToQuarkus(path) : invalidPath();
}

export async function PUT(request: Request, ctx: TemplateParams) {
  const path = await templatePath(ctx);
  if (!path) return invalidPath();
  const json = await readJson(request);
  if (!json) return invalidJson();
  return forwardToQuarkus(path, { method: "PUT", body: json.body });
}

export async function DELETE(_request: Request, ctx: TemplateParams) {
  const path = await templatePath(ctx);
  return path ? forwardToQuarkus(path, { method: "DELETE" }) : invalidPath();
}
