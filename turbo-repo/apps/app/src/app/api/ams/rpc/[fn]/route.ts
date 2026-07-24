import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg, requireCarrierData } from "@/app/api/utils/carrier-scope";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Mantenedores AMS (flota + colaboradores) — proxy al laboratorio local
 * (:3011 atc_dev, schema public → ams). Mismas reglas que /api/atc/rpc:
 * tenant JAMÁS del cliente (p_org_id = RUT de la org carrier, inyectado),
 * allowlist estricto. Regla "manda el viaje" (decisión B): fn_ams_link /
 * fn_ams_unlink se BLOQUEAN si el camión tiene viaje en curso (live_trip
 * en StreamHub) — se responde 409 con el viaje que bloquea.
 */
const ATC_PGREST_URL = process.env.ATC_PGREST_URL ?? "http://127.0.0.1:3011";

const READ_FNS = new Set([
  "fn_ams_trucks",
  "fn_ams_drivers",
  "fn_ams_doc_status",
  "fn_ams_accreditation",
  "fn_ams_link_history",
  "fn_ams_events",
  // Capacity C0 — agenda del recurso
  "fn_cap_agenda",
  "fn_cap_availability",
]);
const WRITE_FNS = new Set([
  "fn_ams_save_truck",
  "fn_ams_save_driver",
  "fn_ams_link",
  "fn_ams_unlink",
  "fn_ams_save_doc",
  "fn_ams_delete_doc",
  // Capacity C0 — bloqueo por excepción; refresh SOLO torre (ver POST)
  "fn_cap_block",
  "fn_cap_unblock",
  "fn_cap_refresh_agenda",
]);
const TENANT_PARAM_FNS = new Set([
  "fn_ams_trucks",
  "fn_ams_drivers",
  "fn_ams_save_truck",
  "fn_ams_save_driver",
  "fn_ams_link",
  "fn_ams_unlink",
  "fn_ams_save_doc",
  "fn_ams_delete_doc",
  "fn_cap_agenda",
  "fn_cap_availability",
  "fn_cap_block",
  "fn_cap_unblock",
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

async function atcGet(fn: string, params: string): Promise<unknown> {
  const r = await fetch(`${ATC_PGREST_URL}/rpc/${fn}?${params}`, {
    headers: { accept: "application/json", "Accept-Profile": "public" },
    cache: "no-store",
  });
  if (!r.ok) return null;
  return r.json();
}

/** Decisión B — "manda el viaje": si el camión del link tiene un viaje en
 * curso (live_trip por patente), la reasignación se bloquea con 409. */
async function viajeEnCurso(truckId: string): Promise<{ trip_id: string; eta?: string } | null> {
  const trucks = (await atcGet("fn_ams_trucks", "")) as
    | Array<{ id: string; license_plate: string }>
    | null;
  const patente = trucks?.find((t) => t.id === truckId)?.license_plate;
  if (!patente) return null;
  try {
    const { fetchLiveTripByAsset } = await import("@/app/api/utils/pgrest-client");
    return await fetchLiveTripByAsset(patente);
  } catch {
    // StreamHub inalcanzable (túnel caído): fail-open documentado — el
    // bloqueo es operativo, no de seguridad; se audita igual.
    return null;
  }
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
  if (fn === "fn_cap_refresh_agenda" && orgId) {
    return NextResponse.json(
      { error: "Refresh de agenda es operación de torre" }, { status: 403 });
  }
  if (TENANT_PARAM_FNS.has(fn)) {
    if (orgId) payload.p_org_id = orgId;
    else delete payload.p_org_id;
  }

  if ((fn === "fn_ams_link" || fn === "fn_ams_unlink") && typeof payload.p_truck_id === "string") {
    const viaje = await viajeEnCurso(payload.p_truck_id);
    if (viaje) {
      return NextResponse.json(
        { ok: false, error: "viaje_en_curso",
          detalle: `El camión tiene el viaje ${viaje.trip_id} en curso — la asociación se puede cambiar cuando cierre`,
          trip: viaje },
        { status: 409 }
      );
    }
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
