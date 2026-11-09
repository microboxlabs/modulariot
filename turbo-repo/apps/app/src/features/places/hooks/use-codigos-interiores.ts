// El External ID de cada geocerca interior, con las mismas reglas que el de su
// geocerca: obligatorio, sin repetirse en la organización y fijo una vez
// guardado. Además, no puede repetir el de su geocerca ni el de otra interior del
// mismo formulario, que el servidor todavía no conoce.
import { useMemo } from "react";
import useSWR from "swr";
import { useDebounce } from "use-debounce";
import type { InnerGeofence } from "../places.types";
import {
  REVISANDO,
  estadoDeUso,
  leerUsoCodigo,
  type EstadoCodigo,
  type UsoCodigo,
} from "./use-codigo-en-uso";
import { textosLugares, type TextosLugares } from "../i18n/places-i18n";

const ESPERA_MS = 300;

type Interior = Pick<InnerGeofence, "id" | "name" | "external_id">;

const codigoDe = (i: Interior) => (i.external_id ?? "").trim();

const enUso = (t: TextosLugares, nombre: string): EstadoCodigo => ({
  estado: "en-uso",
  aviso: t("form.code_used_by", { nombre }),
});

/** Si el servidor dice que el código lo tiene una interior que se está quitando. */
const deUnaQuitada = (uso: UsoCodigo, quitadas: ReadonlySet<string>) =>
  !!uso.placeId && quitadas.has(uso.placeId);

/**
 * El estado del código de cada interior (por id): repetido en el formulario ya
 * está en uso; si no, lo que respondió el servidor (`usos`, null mientras
 * revisa). Sin código o fija, no sale. El código de una interior guardada que
 * esta edición quita (`quitadas`, por id) está libre: el servidor la borra
 * antes de guardar las nuevas.
 */
export function estadosDeInteriores(
  inners: readonly Interior[],
  padre: { codigo: string; nombre: string },
  usos: Readonly<Record<string, UsoCodigo>> | null,
  fija: (id: string) => boolean,
  quitadas: ReadonlySet<string> = new Set(),
  t: TextosLugares = textosLugares()
): Record<string, EstadoCodigo> {
  const out: Record<string, EstadoCodigo> = {};
  const delPadre = padre.codigo.trim().toLowerCase();
  inners.forEach((inner, i) => {
    const codigo = codigoDe(inner).toLowerCase();
    if (!codigo || fija(inner.id)) return;
    if (codigo === delPadre) {
      out[inner.id] = enUso(t, padre.nombre.trim() || t("form.its_geofence"));
      return;
    }
    const otra = inners.find(
      (x, j) => j !== i && codigoDe(x).toLowerCase() === codigo
    );
    if (otra) {
      out[inner.id] = enUso(t, otra.name.trim() || t("form.another_inner"));
      return;
    }
    if (!usos) {
      out[inner.id] = REVISANDO;
      return;
    }
    const uso = usos[codigo];
    if (uso && !deUnaQuitada(uso, quitadas))
      out[inner.id] = estadoDeUso(inner.id, uso, t);
  });
  return out;
}

const leerUsos = async ([, , ...codigos]: readonly string[]) => {
  const leidos = await Promise.allSettled(codigos.map(leerUsoCodigo));
  const out: Record<string, UsoCodigo> = {};
  leidos.forEach((r, i) => {
    const codigo = codigos[i];
    if (codigo && r.status === "fulfilled") out[codigo] = r.value;
  });
  return out;
};

export function useCodigosInteriores({
  scope,
  inners,
  padre,
  fija,
  quitadas,
  activo = true,
  t = textosLugares(),
}: Readonly<{
  /** Los textos de Lugares (el aviso de en uso). */
  t?: TextosLugares;
  /** La organización activa: la respuesta de una no sirve para otra. */
  scope: string | null;
  inners: readonly Interior[];
  padre: { codigo: string; nombre: string };
  /** Interior guardada con su código: ese no se revisa, no se puede cambiar. */
  fija: (id: string) => boolean;
  /** Las interiores guardadas que esta edición quita (por id): su código queda libre. */
  quitadas?: ReadonlySet<string>;
  activo?: boolean;
}>): Record<string, EstadoCodigo> {
  const escritos = useMemo(
    () =>
      [
        ...new Set(
          inners
            .filter((i) => !fija(i.id))
            .map((i) => codigoDe(i).toLowerCase())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [inners, fija]
  );
  const clave = escritos.join("\n");
  const [consultada] = useDebounce(clave, ESPERA_MS);
  const listo = activo && !!scope && !!consultada;
  const { data, error, isLoading } = useSWR(
    listo
      ? (["inner-code-usage", scope, ...consultada.split("\n")] as const)
      : null,
    leerUsos,
    { shouldRetryOnError: false }
  );
  return useMemo(() => {
    if (!activo || !scope) return {};
    // lo respondido es de otros textos mientras se sigue escribiendo
    const revisando = consultada !== clave || isLoading;
    // sin respuesta (falló la consulta), no se dice nada: el guardado lo revisa
    const respondidos = error ? {} : (data ?? {});
    const usos = revisando ? null : respondidos;
    return estadosDeInteriores(inners, padre, usos, fija, quitadas, t);
  }, [
    activo,
    scope,
    consultada,
    clave,
    isLoading,
    error,
    data,
    inners,
    padre,
    t,
    fija,
    quitadas,
  ]);
}
