import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureFolder,
  resolveNodeByPath,
  uploadNodeContent,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg, requireCarrierData } from "@/app/api/utils/carrier-scope";
import { logError } from "@/lib/logger";

/**
 * Foro del recurso AMS — mismo mecanismo del expediente de servicio:
 * la conversación vive como discusión de contenido en el ECM, anclada a
 * la carpeta del recurso (-root-/AMS/{TRUCK|DRIVER}/{id}, la misma de sus
 * documentos). GET resuelve/crea la carpeta y devuelve su nodeRef; el
 * cliente usa las APIs de foro de contenido (/api/forum/content).
 * Tenant: para orgs carrier se valida que el recurso sea suyo contra el
 * maestro antes de exponer el nodeRef.
 */
const ATC_PGREST_URL = process.env.ATC_PGREST_URL ?? "http://127.0.0.1:3011";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resourceType = req.nextUrl.searchParams.get("resource_type");
  const resourceId = req.nextUrl.searchParams.get("resource_id");
  if (!resourceType || !resourceId || !["TRUCK", "DRIVER"].includes(resourceType)) {
    return NextResponse.json({ error: "resource_type y resource_id requeridos" }, { status: 400 });
  }

  try {
    const scopeResult = await resolveTenantScope();
    if (scopeResult.resolved && isCarrierOrg(scopeResult.scope)) {
      const guard = requireCarrierData(scopeResult.scope);
      if (guard) return guard;
      const orgId = scopeResult.scope.effectiveTaxIds[0];
      const listFn = resourceType === "TRUCK" ? "fn_ams_trucks" : "fn_ams_drivers";
      const propios = await fetch(`${ATC_PGREST_URL}/rpc/${listFn}`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json",
          "Content-Profile": "public" },
        body: JSON.stringify({ p_org_id: orgId }),
        cache: "no-store",
      }).then((r) => r.json());
      const esSuyo = Array.isArray(propios) && propios.some(
        (r: { id?: string }) => r.id === resourceId);
      if (!esSuyo) {
        return NextResponse.json({ error: "Recurso no pertenece a la organización" }, { status: 403 });
      }
    }

    // El backend de foros exige un nodo mintral:content como ancla (una
    // carpeta no sirve) — mismo esquema del expediente de servicio, donde
    // la discusión cuelga de un contenido. Usamos un marcador estable
    // "_foro.txt" dentro de la carpeta del recurso.
    const marcador = `AMS/${resourceType}/${resourceId}/_foro.txt`;
    let anchorId = await resolveNodeByPath(session, marcador);
    if (!anchorId) {
      const amsFolder = await ensureFolder(session, "-root-", "AMS");
      const typeFolder = await ensureFolder(session, amsFolder, resourceType);
      const resFolder = await ensureFolder(session, typeFolder, resourceId);
      const uploaded = await uploadNodeContent(session, {
        filedata: new File(["Foro del recurso AMS"], "_foro.txt", { type: "text/plain" }),
        filename: "_foro.txt",
        destination: `workspace://SpacesStore/${resFolder}`,
        contentType: "mintral:content",
        overwrite: true,
      });
      const nodeRef = (uploaded as unknown as { nodeRef?: string })?.nodeRef;
      if (!nodeRef) {
        return NextResponse.json({ error: "No se pudo crear el ancla del foro" }, { status: 502 });
      }
      anchorId = nodeRef.replace("workspace://SpacesStore/", "");
    }
    return NextResponse.json({ nodeRef: `workspace://SpacesStore/${anchorId}` });
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)),
      { message: "[ams-forum] resolve folder failed" });
    return NextResponse.json({ error: "No se pudo resolver el foro del recurso" }, { status: 500 });
  }
}
