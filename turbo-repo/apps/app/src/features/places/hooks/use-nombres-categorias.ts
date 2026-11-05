// Las categorías se guardan como códigos de un seleccionable; lo que se lee en
// la lista y lo que busca la barra son sus nombres. Se buscan en el seleccionable
// de cada lugar, no en el vinculado hoy al campo.
import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { pickText } from "@/features/settings-admin/selectables/localized";
import {
  fetchSelectableOptions,
  useApiSelectables,
} from "@/features/settings-admin/selectables/selectables-api";
import type {
  Selectable,
  SelectableOption,
} from "@/features/settings-admin/selectables/types";
import { categoriasDeLugar, listaDeLugar, type Lugar } from "../places.types";

type OpcionesPorLista = Record<string, SelectableOption[]>;

/**
 * Los lugares con sus categorías como texto en `category`, unidas por coma. Un
 * código que ya no está en la lista se muestra tal cual. Sin códigos, el lugar
 * queda como venía: una geocerca de StreamHub trae su propio texto.
 */
export function conNombresDeCategoria(
  lugares: Lugar[],
  opciones: OpcionesPorLista,
  lang: string
): Lugar[] {
  return lugares.map((l) => {
    const codigos = categoriasDeLugar(l);
    if (codigos.length === 0) return l;
    const deLaLista = opciones[listaDeLugar(l) ?? ""] ?? [];
    const nombres = codigos.map((codigo) => {
      const opcion = deLaLista.find((o) => o.value === codigo);
      return (opcion && pickText(opcion.label, lang)) || codigo;
    });
    return { ...l, category: nombres.join(", ") };
  });
}

/** Una lista dinámica pide sus opciones aparte: las que fallen quedan sin nombres. */
const leerDinamicas = async ([, ...listas]: readonly string[]) => {
  const leidas = await Promise.allSettled(listas.map(fetchSelectableOptions));
  const out: OpcionesPorLista = {};
  leidas.forEach((r, i) => {
    const lista = listas[i];
    if (lista && r.status === "fulfilled") out[lista] = r.value;
  });
  return out;
};

function opcionesEstaticas(selectables: Selectable[] | undefined) {
  const out: OpcionesPorLista = {};
  for (const s of selectables ?? []) {
    if (s.source.kind === "STATIC") out[s.key] = s.options;
  }
  return out;
}

export function useLugaresConNombresDeCategoria(lugares: Lugar[]): Lugar[] {
  const lang = useParams<{ lang: string }>()?.lang ?? "es";
  const usadas = useMemo(() => {
    const listas = lugares
      .filter((l) => categoriasDeLugar(l).length > 0)
      .map(listaDeLugar)
      .filter((lista): lista is string => !!lista);
    return [...new Set(listas)].sort((a, b) => a.localeCompare(b));
  }, [lugares]);
  const { data: selectables } = useApiSelectables(usadas.length > 0);
  const dinamicas = usadas.filter((key) =>
    selectables?.some((s) => s.key === key && s.source.kind !== "STATIC")
  );
  const { data: deDinamicas } = useSWR(
    dinamicas.length > 0 ? ["places-category-options", ...dinamicas] : null,
    leerDinamicas,
    { revalidateOnFocus: false }
  );
  return useMemo(
    () =>
      conNombresDeCategoria(
        lugares,
        { ...opcionesEstaticas(selectables), ...deDinamicas },
        lang
      ),
    [lugares, selectables, deDinamicas, lang]
  );
}
