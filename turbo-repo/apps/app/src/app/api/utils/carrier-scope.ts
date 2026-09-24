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
 *
 * Nota: en esta rama solo viven las guardas de scope puro que usan la vista
 * de síntomas y el proxy de autogestión. Las variantes que consultan
 * StreamHub (getCarrierPatentes / assertCarrierTrip) llegan con el portal
 * completo.
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
