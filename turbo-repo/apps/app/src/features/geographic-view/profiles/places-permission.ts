"use client";

// Permiso "Editor de lugares" (torre de control, Ajustes › Equipo › Roles):
// sin él, el editor de lugares no aparece en la vista geográfica.
import { useMyAccess } from "@/features/settings-admin/team/team-api";

export const PERMISO_EDITOR_LUGARES = "controltower:places.edit";

/** Si el editor de lugares está permitido en la página. */
export function usePermisoEditorLugares(): boolean {
  return useMyAccess().can(PERMISO_EDITOR_LUGARES);
}
