"use client";

// Permiso "Editor de lugares" (torre de control, Ajustes › Equipo › Roles):
// sin él, el editor de lugares no aparece en la vista geográfica.
import { useMyAccess } from "@/features/settings-admin/team/team-api";

export const PERMISO_EDITOR_LUGARES = "controltower:places.edit";

/** Si los roles del usuario le dan el permiso en la organización activa. */
export function usePermisoEditorLugares(): boolean {
  const { can } = useMyAccess();
  return can(PERMISO_EDITOR_LUGARES);
}
