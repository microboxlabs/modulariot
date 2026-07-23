import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg, requireCarrierData } from "@/app/api/utils/carrier-scope";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * PT4 — proxy hacia el laboratorio de autogestión (F3/F4, PostgREST :3011
 * sobre atc_dev, schema public). Mismas reglas que el proxy del gemelo:
 * el tenant JAMÁS viaja desde el cliente — para orgs carrier p_org_id se
 * inyecta del scope; fns fuera del allowlist ⇒ 403.
 */
const ATC_PGREST_URL = process.env.ATC_PGREST_URL ?? "http://127.0.0.1:3011";

// Lecturas: el catálogo/esquema son definición global (§C: el carrier los ve
// read-only); cuotas y auditoría llevan tenant inyectado.
const READ_FNS = new Set([
  "fn_symptom_list",
  "fn_pt4_rule_detail",
  "fn_pt4_my_rules",
  "fn_pt4_places",
  "fn_pt4_places_global",
  "fn_pt4_trayectos",
  "fn_pt4_trayectos_global",
  "fn_pt4_categorias",
  "fn_pt4_quota_status",
  "fn_pt4_criticality_scheme",
  "fn_pt4_audit_log",
]);
// Escrituras: solo el wrapper con guardas de tenant + cuota.
const WRITE_FNS = new Set([
  "fn_pt4_apply_selection",
  "fn_pt4_clone_rule",
  "fn_pt4_save_combination",
  "fn_pt4_update_rule_meta",
  "fn_pt4_delete_rule",
  "fn_pt4_estimate",
  "fn_pt4_create_place",
  "fn_pt4_update_place",
  "fn_pt4_delete_place",
  "fn_pt4_save_trayecto",
  "fn_pt4_delete_trayecto",
]);
// Fns donde p_org_id se fuerza al RUT de la org carrier activa.
const TENANT_PARAM_FNS = new Set([
  "fn_pt4_quota_status",
  "fn_pt4_audit_log",
  "fn_pt4_apply_selection",
  "fn_pt4_rule_detail",
  "fn_pt4_my_rules",
  "fn_pt4_clone_rule",
  "fn_pt4_save_combination",
  "fn_pt4_update_rule_meta",
  "fn_pt4_delete_rule",
  "fn_pt4_places",
  "fn_pt4_trayectos",
  "fn_pt4_create_place",
  "fn_pt4_update_place",
  "fn_pt4_delete_place",
  "fn_pt4_save_trayecto",
  "fn_pt4_delete_trayecto",
]);

async function carrierOrgId(): Promise<{ deny: NextResponse | null; orgId: string | null }> {
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved || !isCarrierOrg(scopeResult.scope)) {
    return { deny: null, orgId: null };
  }
  const guard = requireCarrierData(scopeResult.scope);
  if (guard) return { deny: guard, orgId: null };
  return { deny: null, orgId: scopeResult.scope.effectiveTaxIds[0] };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ fn: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { fn } = await ctx.params;
  if (!READ_FNS.has(fn)) {
    return NextResponse.json({ error: "Function not allowed" }, { status: 403 });
  }
  const { deny, orgId } = await carrierOrgId();
  if (deny) return deny;

  const params = new URLSearchParams(req.nextUrl.searchParams);
  if (orgId && TENANT_PARAM_FNS.has(fn)) params.set("p_org_id", orgId);

  const response = await fetch(`${ATC_PGREST_URL}/rpc/${fn}?${params.toString()}`, {
    headers: { accept: "application/json", "Accept-Profile": "public" },
    cache: "no-store",
  });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ fn: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { fn } = await ctx.params;
  if (!WRITE_FNS.has(fn)) {
    return NextResponse.json({ error: "Function not allowed" }, { status: 403 });
  }
  const { deny, orgId } = await carrierOrgId();
  if (deny) return deny;

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (TENANT_PARAM_FNS.has(fn)) {
    // Carrier: su org SIEMPRE; torre: nunca se acepta p_org_id del cliente
    // (la torre opera la capa global, p_org_id NULL).
    if (orgId) payload.p_org_id = orgId;
    else delete payload.p_org_id;
  }

  const response = await fetch(`${ATC_PGREST_URL}/rpc/${fn}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "Content-Profile": "public",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
