/**
 * Seam F — authorization / capabilities.
 *
 * Embed hosts don't have our role model — they have capabilities. The package
 * consumes a `DashboardCapabilities`; the app maps Alfresco roles onto it,
 * an embed token maps claims onto it. Defaults to full access (matching the
 * app's historical behavior); embed hosts pass a restrictive set.
 */

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export interface DashboardCapabilities {
  /** Hard read-only switch: hides all editing affordances. */
  readOnly: boolean;
  canEdit: boolean;
  canShare: boolean;
  canManagePermissions: boolean;
  canDelete: boolean;
}

export const FULL_CAPABILITIES: DashboardCapabilities = {
  readOnly: false,
  canEdit: true,
  canShare: true,
  canManagePermissions: true,
  canDelete: true,
};

export const READ_ONLY_CAPABILITIES: DashboardCapabilities = {
  readOnly: true,
  canEdit: false,
  canShare: false,
  canManagePermissions: false,
  canDelete: false,
};

const CapabilitiesContext =
  createContext<DashboardCapabilities>(FULL_CAPABILITIES);

export interface DashboardCapabilitiesProviderProps {
  capabilities?: DashboardCapabilities;
  children: ReactNode;
}

export function DashboardCapabilitiesProvider({
  capabilities,
  children,
}: DashboardCapabilitiesProviderProps) {
  return (
    <CapabilitiesContext.Provider value={capabilities ?? FULL_CAPABILITIES}>
      {children}
    </CapabilitiesContext.Provider>
  );
}

export function useDashboardCapabilities(): DashboardCapabilities {
  return useContext(CapabilitiesContext);
}
