import "server-only";
import { NextResponse } from "next/server";
import type { TenantScope } from "./tenant-scope";
import { CARRIER_PORTAL_MODULE } from "@/features/auth/config/carrier-matrix";

/**
 * Guardas server-side del portal de transportista (PT2).
 *
 * Regla de oro (diseno_pt1_portal.md §A.4): el tenant JAMÁS viaja desde el
 * cliente y una org carrier NUNCA degrada a "sin filtro": sin tax ids ⇒ 403.
 * (La degradación sin filtro de Phase 1 sigue permitida para orgs de torre.)
 */

export function isCarrierOrg(scope: TenantScope): boolean {
  return scope.activeOrg.modules.includes(CARRIER_PORTAL_MODULE);
}

/**
 * Para orgs carrier exige effectiveTaxIds no-vacío. Devuelve la respuesta 403
 * a retornar, o null si se puede continuar.
 */
export function requireCarrierData(scope: TenantScope): NextResponse | null {
  if (!isCarrierOrg(scope)) return null;
  if (scope.effectiveTaxIds.length > 0) return null;
  return NextResponse.json(
    { error: "Carrier organization has no tax ids configured" },
    { status: 403 }
  );
}

/**
 * Patentes del carrier (fuente canónica server-side): catálogo pgrest de
 * camiones filtrado por cust_account = effectiveTaxIds. Uppercase para
 * comparar contra assetid/asset_id (que son la patente).
 * Cache corto en memoria: mapa y señales golpean esto por request.
 */
const patentesCache = new Map<string, { set: Set<string>; expiresAt: number }>();
const PATENTES_TTL_MS = 60_000;

export async function getCarrierPatentes(scope: TenantScope): Promise<Set<string>> {
  const key = [...scope.effectiveTaxIds].sort().join(",");
  const hit = patentesCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.set;
  const { fetchTrucksCatalog, fetchCarrierTripAssets } = await import("./pgrest-client");
  // Unión de dos fuentes: catálogo de flota (cust_account) + patentes de los
  // viajes del carrier en StreamHub (carrier_id = RUT, live + 90d histórico).
  // La segunda es hoy la fuente EFECTIVA (cust_account no mapea al RUT del
  // carrier en todos los ambientes) — ver brief 2026-07-22.
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [rows, tripAssets] = await Promise.all([
    fetchTrucksCatalog({ custAccounts: scope.effectiveTaxIds }).catch(() => []),
    fetchCarrierTripAssets(scope.effectiveTaxIds, since).catch(() => []),
  ]);
  const set = new Set([
    ...rows.map((r) => r.patente.toUpperCase()),
    ...tripAssets,
  ]);
  patentesCache.set(key, { set, expiresAt: Date.now() + PATENTES_TTL_MS });
  return set;
}
