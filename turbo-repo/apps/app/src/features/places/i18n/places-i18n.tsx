"use client";

// Los textos de Lugares: viven en src/lang (es.json, en.json) bajo `places`.
// Los componentes los leen con usePlacesT(); el estado del editor y las
// funciones puras reciben un `t` (textosLugares) del diccionario del mapa.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type esDictionary from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { LeafPaths } from "@/features/i18n/tr.types";

/** Una clave bajo `places` del diccionario; se revisa al compilar. */
export type ClaveLugares = LeafPaths<(typeof esDictionary)["places"]>;

export type ParametrosTexto = Record<string, string | number>;

/** Traduce una clave de Lugares, con sus parámetros ({nombre} en el texto). */
export type TextosLugares = (
  clave: ClaveLugares,
  params?: ParametrosTexto
) => string;

let respaldo: I18nRecord = {};

/**
 * El diccionario cuando no hay proveedor ni `dict`. Solo lo fijan las pruebas
 * (src/test/setup.ts, con el español); en la app siempre hay uno.
 */
export function usarDiccionarioDeRespaldo(dict: I18nRecord): void {
  respaldo = dict;
}

const aTexto = (params: ParametrosTexto | undefined) =>
  params
    ? Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    : undefined;

/** Los textos de Lugares de un diccionario (sin él, el de respaldo). */
export function textosLugares(dict?: I18nRecord | null): TextosLugares {
  const d = dict ?? respaldo;
  return (clave, params) => trDynamic(`places.${clave}`, d, aTexto(params));
}

const DiccionarioLugares = createContext<I18nRecord | null>(null);

/** Da el diccionario de la página a todo Lugares que esté dentro. */
export function PlacesI18nProvider({
  dict,
  children,
}: Readonly<{ dict: I18nRecord; children: ReactNode }>) {
  return (
    <DiccionarioLugares.Provider value={dict}>
      {children}
    </DiccionarioLugares.Provider>
  );
}

/** Los textos de Lugares en el idioma de la página. */
export function usePlacesT(): TextosLugares {
  const dict = useContext(DiccionarioLugares);
  return useMemo(() => textosLugares(dict), [dict]);
}
