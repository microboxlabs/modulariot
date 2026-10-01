"use client";

import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { CARRIER_PORTAL_MODULE } from "../config/carrier-matrix";

/**
 * Modo carrier (PT2): true cuando la org ACTIVA tiene el módulo
 * CARRIER_PORTAL. Gobierna la navegación visible (matriz carrier-matrix);
 * la seguridad de datos vive server-side en las API routes.
 * Mientras carga, carrierMode=false (la nav de torre igual exige groups).
 */
export function useCarrierMode() {
  const { activeOrg, isLoading } = useOrgScopes();
  const carrierMode =
    activeOrg?.modules?.includes(CARRIER_PORTAL_MODULE) ?? false;
  return { carrierMode, isLoading };
}
