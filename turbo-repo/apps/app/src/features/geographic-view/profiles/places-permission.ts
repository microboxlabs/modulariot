"use client";

// Permiso "Editor de lugares" (torre de control, Ajustes › Equipo › Roles):
// sin él, el editor de lugares no aparece en la vista geográfica. Para
// probar cómo se ve con y sin el permiso, un modo debug lo fuerza en este
// navegador (mismo patrón localStorage + evento que el modo editor de campos).
import { useCallback, useEffect, useState } from "react";
import { useMyAccess } from "@/features/settings-admin/team/team-api";

export const PERMISO_EDITOR_LUGARES = "controltower:places.edit";

/**
 * Control debug del permiso, apagado por defecto. Para probar la vista de
 * Lugares sin el permiso (p. ej. contra un backend que aún no lo tiene),
 * poner NEXT_PUBLIC_DEBUG_PLACES_PERMISSION=true en .env.local y reiniciar
 * el servidor: aparece el control en el mapa y permite forzar el permiso.
 * Apagado, vale solo el real y un forzado guardado de antes no hace nada.
 *
 * Se lee una vez al cargar el módulo (Next.js lo reemplaza al compilar), no
 * en cada render.
 */
export const DEBUG_PERMISO_LUGARES =
  process.env.NEXT_PUBLIC_DEBUG_PLACES_PERMISSION === "true";

/** real: lo que dicen los roles; activo / inactivo: forzado para probar. */
export type ForzadoPermiso = "real" | "activo" | "inactivo";

const CLAVE = "miot.debug.places-permission.v1";
const EVENTO = "miot:places-permission-debug-changed";

function leer(): ForzadoPermiso {
  try {
    const v = globalThis.localStorage?.getItem(CLAVE);
    return v === "activo" || v === "inactivo" ? v : "real";
  } catch {
    return "real";
  }
}

/** El forzado del debug, compartido entre componentes y pestañas. */
function useForzadoPermisoLugares(): [
  ForzadoPermiso,
  (v: ForzadoPermiso) => void,
] {
  const [forzado, setForzado] = useState<ForzadoPermiso>("real");
  useEffect(() => {
    const sync = () => setForzado(leer());
    sync();
    globalThis.addEventListener?.(EVENTO, sync);
    globalThis.addEventListener?.("storage", sync);
    return () => {
      globalThis.removeEventListener?.(EVENTO, sync);
      globalThis.removeEventListener?.("storage", sync);
    };
  }, []);
  const cambiar = useCallback((v: ForzadoPermiso) => {
    setForzado(v);
    try {
      globalThis.localStorage?.setItem(CLAVE, v);
      globalThis.dispatchEvent?.(new Event(EVENTO));
    } catch {
      // sin almacenamiento: vale solo en esta pestaña
    }
  }, []);
  return [forzado, cambiar];
}

/** Si el permiso vale: el forzado del debug manda sobre el real. */
export function permisoEfectivo(
  real: boolean,
  forzado: ForzadoPermiso
): boolean {
  if (forzado === "real" || !DEBUG_PERMISO_LUGARES) return real;
  return forzado === "activo";
}

/** Todo el estado del permiso, para el control debug. */
export function useEstadoPermisoLugares() {
  const { can } = useMyAccess();
  const [forzado, setForzado] = useForzadoPermisoLugares();
  const real = can(PERMISO_EDITOR_LUGARES);
  return {
    /** Lo que vale en la página (con el debug aplicado). */
    activo: permisoEfectivo(real, forzado),
    /** Lo que dicen los roles del usuario. */
    real,
    forzado,
    setForzado,
  };
}

/** Si el editor de lugares está permitido en la página. */
export function usePermisoEditorLugares(): boolean {
  return useEstadoPermisoLugares().activo;
}
