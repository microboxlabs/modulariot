// Revisa mientras se escribe si un External ID está libre: revisando, en uso por
// otro lugar (geocercas, internas y trayectos de Lugares; StreamHub no cuenta: sus
// geocercas pasan a Lugares) o libre. Mientras revisa o si está en uso, el
// formulario no sigue. Pregunta al servidor, que es quien decide; si la consulta
// falla no se muestra nada y el guardado lo vuelve a revisar.
import { useMemo } from "react";
import useSWR from "swr";
import { useDebounce } from "use-debounce";
import { z } from "zod";
import { textosLugares, type TextosLugares } from "../i18n/places-i18n";

const URL_CODIGO_EN_USO = "/app/api/places/items/code-usage";
const ESPERA_MS = 300;

const usoSchema = z.object({
  inUse: z.boolean(),
  placeId: z.string().nullable(),
  name: z.string().nullable(),
  kind: z.string().nullable(),
});
export type UsoCodigo = z.infer<typeof usoSchema>;

/** Quién tiene el código en la organización activa (el servidor decide). */
export async function leerUsoCodigo(codigo: string): Promise<UsoCodigo> {
  const r = await fetch(
    `${URL_CODIGO_EN_USO}?code=${encodeURIComponent(codigo)}`
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return usoSchema.parse(await r.json());
}

const fetcherUso = ([, , codigo]: readonly [string, string, string]) =>
  leerUsoCodigo(codigo);

/** Cómo está el código escrito; null: nada que mostrar (vacío, fijo o sin respuesta). */
export type EstadoCodigo =
  | { estado: "revisando" }
  | { estado: "libre" }
  | { estado: "en-uso"; aviso: string };

export const REVISANDO: EstadoCodigo = { estado: "revisando" };
const LIBRE: EstadoCodigo = { estado: "libre" };

/** Revisando o en uso: el formulario no sigue adelante. */
export const bloqueaCodigo = (e: EstadoCodigo | null | undefined) =>
  e?.estado === "revisando" || e?.estado === "en-uso";

/** El estado de un código ya respondido por el servidor. */
export function estadoDeUso(
  propioId: string | null,
  uso: UsoCodigo,
  t: TextosLugares = textosLugares()
): EstadoCodigo {
  const aviso = avisoDeCodigo(propioId, uso, t);
  return aviso ? { estado: "en-uso", aviso } : LIBRE;
}

/** El aviso de un código, sabiendo quién lo tiene. El propio lugar no cuenta. */
export function avisoDeCodigo(
  propioId: string | null,
  uso: UsoCodigo | undefined,
  t: TextosLugares = textosLugares()
): string | null {
  if (!uso?.inUse || uso.placeId === propioId) return null;
  return t("form.code_used_by", { nombre: uso.name ?? "" });
}

export function useCodigoEnUso({
  scope,
  codigo,
  propioId,
  activo = true,
  t = textosLugares(),
}: Readonly<{
  /** La organización activa: la respuesta de una no sirve para otra. */
  scope: string | null;
  codigo: string;
  propioId: string | null;
  /** Los textos de Lugares (el aviso de en uso). */
  t?: TextosLugares;
  /** Un External ID que no se puede editar no se revisa. */
  activo?: boolean;
}>): EstadoCodigo | null {
  const escrito = codigo.trim();
  const [consultado] = useDebounce(escrito, ESPERA_MS);
  const listo = activo && !!scope && !!consultado;
  const { data, error, isLoading } = useSWR(
    listo ? (["code-usage", scope, consultado] as const) : null,
    fetcherUso,
    { shouldRetryOnError: false }
  );
  return useMemo(() => {
    if (!activo || !scope || !escrito) return null;
    // lo respondido es del texto anterior mientras se sigue escribiendo
    if (consultado !== escrito || isLoading) return REVISANDO;
    if (error || !data) return null;
    return estadoDeUso(propioId, data, t);
  }, [activo, scope, escrito, consultado, isLoading, error, data, propioId, t]);
}
