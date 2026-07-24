import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureFolder,
  uploadNodeContent,
  getContentNode,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg, requireCarrierData } from "@/app/api/utils/carrier-scope";
import { logError } from "@/lib/logger";

/**
 * Documentos AMS con BINARIO REAL en el ECM (Alfresco):
 * POST multipart (file + resource_type/resource_id/doc_type/valid_until) →
 *   carpeta /AMS/{TRUCK|DRIVER}/{resource_id} (ensureFolder) → upload →
 *   registro en el maestro (fn_ams_save_doc con alfresco_node_id).
 * GET ?nodeId= → descarga (stream binario con content-disposition).
 * Tenant server-side: para orgs carrier, p_org_id se inyecta y el maestro
 * valida pertenencia del recurso (mismas guardas del proxy /api/ams/rpc).
 */
const ATC_PGREST_URL = process.env.ATC_PGREST_URL ?? "http://127.0.0.1:3011";

async function carrierOrgId(): Promise<{ deny: NextResponse | null; orgId: string | null }> {
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved || !isCarrierOrg(scopeResult.scope)) {
    return { deny: null, orgId: null };
  }
  const guard = requireCarrierData(scopeResult.scope);
  if (guard) return { deny: guard, orgId: null };
  return { deny: null, orgId: scopeResult.scope.effectiveTaxIds[0] };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { deny, orgId } = await carrierOrgId();
  if (deny) return deny;

  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const resourceType = String(form.get("resource_type") ?? "");
    const resourceId = String(form.get("resource_id") ?? "");
    const docType = String(form.get("doc_type") ?? "");
    const validUntil = form.get("valid_until") ? String(form.get("valid_until")) : null;
    if (!file || !resourceType || !resourceId || !docType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Carpeta del recurso en el ECM: /AMS/{tipo}/{id} (idempotente)
    const amsFolder = await ensureFolder(session, "-root-", "AMS");
    const typeFolder = await ensureFolder(session, amsFolder, resourceType);
    const resFolder = await ensureFolder(session, typeFolder, resourceId);

    const uploaded = await uploadNodeContent(session, {
      filedata: file,
      filename: file.name,
      destination: `workspace://SpacesStore/${resFolder}`,
      overwrite: true,
    });
    const nodeRef: string | undefined = (uploaded as unknown as { nodeRef?: string }).nodeRef;
    if (!nodeRef) {
      return NextResponse.json(
        { error: "Upload to ECM failed", status: (uploaded as { status?: unknown }).status },
        { status: 502 });
    }
    const nodeId = nodeRef.replace("workspace://SpacesStore/", "");

    // Registro en el maestro (tenant + auditoría en el wrapper SQL)
    const payload: Record<string, unknown> = {
      p_resource_type: resourceType, p_resource_id: resourceId,
      p_doc_type: docType, p_filename: file.name,
      p_valid_until: validUntil, p_alfresco_node_id: nodeId,
      p_actor: "app-mantenedor",
    };
    if (orgId) payload.p_org_id = orgId;
    const reg = await fetch(`${ATC_PGREST_URL}/rpc/fn_ams_save_doc`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json",
        "Content-Profile": "public" },
      body: JSON.stringify(payload),
      cache: "no-store",
    }).then((r) => r.json());
    if (reg?.ok === false) {
      return NextResponse.json(reg, { status: reg.error === "tenant" ? 403 : 422 });
    }
    return NextResponse.json({ ok: true, doc_id: reg?.doc_id, node_id: nodeId });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { message: "[ams-docs] upload failed" });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const nodeId = req.nextUrl.searchParams.get("nodeId");
  const filename = req.nextUrl.searchParams.get("filename") ?? "documento";
  if (!nodeId) return NextResponse.json({ error: "Missing nodeId" }, { status: 400 });
  try {
    const base64 = await getContentNode(session, nodeId);
    const buffer = Buffer.from(base64, "base64");
    return new NextResponse(buffer, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { message: "[ams-docs] download failed" });
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
