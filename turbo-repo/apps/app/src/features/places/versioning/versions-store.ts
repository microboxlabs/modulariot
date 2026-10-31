"use client";

// Historial de versiones de geocercas y trayectos. El backend PT4 aún no
// tiene campos de versión, así que (como las categorías de los trayectos)
// vive en este navegador, por elemento: "lugar:<id>" o "trayecto:<id>".
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { placesStorageKey } from "../data/storage-key";
import { VERSION_INICIAL, type VersionBump } from "./versioning";

const STORAGE_KEY = "miot.settings.places.versions.v1";

const entradaSchema = z.object({
  version: z.string(),
  bump: z.enum(["PATCH", "MINOR", "MAJOR"]),
  descripcion: z.string(),
  fecha: z.string(),
  cambios: z.array(z.string()),
});
export type EntradaVersion = z.infer<typeof entradaSchema>;

const historialSchema = z.record(z.string(), z.array(entradaSchema));
type Historiales = z.infer<typeof historialSchema>;
const EMPTY_HISTORY: Historiales = {};

export type TipoVersionado = "lugar" | "trayecto";
export const claveVersion = (tipo: TipoVersionado, id: string) =>
  `${tipo}:${id}`;

function leer(scope: string | null): Historiales {
  const key = placesStorageKey(STORAGE_KEY, scope);
  if (!key) return {};
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return {};
    const r = historialSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : {};
  } catch {
    return {};
  }
}

function escribir(scope: string | null, h: Historiales): boolean {
  const key = placesStorageKey(STORAGE_KEY, scope);
  if (!key || !globalThis.localStorage) return false;
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(h));
    return true;
  } catch {
    return false;
  }
}

/** La versión vigente: la última del historial, o la inicial. */
export function versionVigente(entradas: EntradaVersion[] | undefined): string {
  return entradas?.at(-1)?.version ?? VERSION_INICIAL;
}

export function useVersionesPlaces(scope: string | null) {
  const [stored, setStored] = useState<{
    scope: string | null;
    data: Historiales;
  }>({ scope, data: EMPTY_HISTORY });
  const historiales = stored.scope === scope ? stored.data : EMPTY_HISTORY;
  useEffect(() => setStored({ scope, data: leer(scope) }), [scope]);

  const versionDe = useCallback(
    (tipo: TipoVersionado, id: string | null | undefined) =>
      id ? versionVigente(historiales[claveVersion(tipo, id)]) : null,
    [historiales]
  );

  const historialDe = useCallback(
    (tipo: TipoVersionado, id: string) =>
      historiales[claveVersion(tipo, id)] ?? [],
    [historiales]
  );

  const registrar = useCallback(
    (
      tipo: TipoVersionado,
      id: string,
      entrada: Omit<EntradaVersion, "fecha"> & { bump: VersionBump }
    ) => {
      const cur = leer(scope);
      const clave = claveVersion(tipo, id);
      const next = {
        ...cur,
        [clave]: [
          ...(cur[clave] ?? []),
          { ...entrada, fecha: new Date().toISOString() },
        ],
      };
      if (!escribir(scope, next)) return false;
      setStored({ scope, data: next });
      return true;
    },
    [scope]
  );

  return { versionDe, historialDe, registrar };
}
