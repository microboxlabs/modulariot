"use client";

// Historial de versiones de geocercas y trayectos. El backend PT4 aún no
// tiene campos de versión, así que (como las categorías de los trayectos)
// vive en este navegador, por elemento: "lugar:<id>" o "trayecto:<id>".
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
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

export type TipoVersionado = "lugar" | "trayecto";
export const claveVersion = (tipo: TipoVersionado, id: string) =>
  `${tipo}:${id}`;

function leer(): Historiales {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const r = historialSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : {};
  } catch {
    return {};
  }
}

function escribir(h: Historiales): boolean {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(h));
    return true;
  } catch {
    return false;
  }
}

/** La versión vigente: la última del historial, o la inicial. */
export function versionVigente(entradas: EntradaVersion[] | undefined): string {
  return entradas?.at(-1)?.version ?? VERSION_INICIAL;
}

export function useVersionesPlaces() {
  const [historiales, setHistoriales] = useState<Historiales>({});
  // localStorage solo existe en el cliente: cargar después de montar
  useEffect(() => setHistoriales(leer()), []);

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
      const cur = leer();
      const clave = claveVersion(tipo, id);
      const next = {
        ...cur,
        [clave]: [
          ...(cur[clave] ?? []),
          { ...entrada, fecha: new Date().toISOString() },
        ],
      };
      setHistoriales(next);
      return escribir(next);
    },
    []
  );

  return { versionDe, historialDe, registrar };
}
