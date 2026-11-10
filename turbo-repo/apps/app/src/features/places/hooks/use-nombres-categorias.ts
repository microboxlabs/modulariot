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
import {
  categoriasDeLugar,
  listaDeLugar,
  type Lugar,
  type Trayecto,
} from "../places.types";

type OpcionesPorLista = Record<string, SelectableOption[]>;

/** Códigos guardados y la lista donde buscar sus nombres. */
type Fuente = { codigos: string[]; lista: string | null };

/** Los nombres de unos códigos, unidos por coma; uno que ya no está, tal cual. */
function nombresDe(
  { codigos, lista }: Fuente,
  opciones: OpcionesPorLista,
  lang: string
): string {
  const deLaLista = opciones[lista ?? ""] ?? [];
  return codigos
    .map((codigo) => {
      const opcion = deLaLista.find((o) => o.value === codigo);
      return (opcion && pickText(opcion.label, lang)) || codigo;
    })
    .join(", ");
}

const fuenteDeLugar = (l: Lugar): Fuente => ({
  codigos: categoriasDeLugar(l),
  lista: listaDeLugar(l),
});

const fuenteDeTrayecto = (t: Trayecto): Fuente => ({
  codigos: t.categorias ?? [],
  lista: t.categorias_lista ?? null,
});

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
    const fuente = fuenteDeLugar(l);
    if (fuente.codigos.length === 0) return l;
    return { ...l, category: nombresDe(fuente, opciones, lang) };
  });
}

/** Los trayectos con los nombres de sus categorías en `categorias_nombres`. */
export function trayectosConNombres(
  trayectos: Trayecto[],
  opciones: OpcionesPorLista,
  lang: string
): Trayecto[] {
  return trayectos.map((t) => {
    const fuente = fuenteDeTrayecto(t);
    if (fuente.codigos.length === 0) return t;
    return { ...t, categorias_nombres: nombresDe(fuente, opciones, lang) };
  });
}

const porTexto = (a: string, b: string) => a.localeCompare(b);

/** Lo más que el servidor da por pedido de opciones. */
const LIMITE_OPCIONES = 200;

/** Cada lista con los códigos guardados que hay que nombrar. */
type Pedido = [lista: string, codigos: string[]];

/**
 * Las opciones de una lista dinámica para sus códigos guardados. El servidor da
 * solo las primeras: un código que no está entre ellas se busca por sí mismo.
 */
export async function opcionesDeCodigos(
  lista: string,
  codigos: string[]
): Promise<SelectableOption[]> {
  const primeras = await fetchSelectableOptions(lista, {
    limit: LIMITE_OPCIONES,
  });
  const faltan = codigos.filter((c) => !primeras.some((o) => o.value === c));
  const buscadas = await Promise.allSettled(
    faltan.map((codigo) =>
      fetchSelectableOptions(lista, { search: codigo, limit: LIMITE_OPCIONES })
    )
  );
  const halladas = buscadas.flatMap((r, i) =>
    r.status === "fulfilled" ? r.value.filter((o) => o.value === faltan[i]) : []
  );
  return [...primeras, ...halladas];
}

/** Una lista dinámica pide sus opciones aparte: las que fallen quedan sin nombres. */
const leerDinamicas = async ([, json]: readonly [string, string]) => {
  const pedidos: Pedido[] = JSON.parse(json);
  const leidas = await Promise.allSettled(
    pedidos.map(([lista, codigos]) => opcionesDeCodigos(lista, codigos))
  );
  const out: OpcionesPorLista = {};
  leidas.forEach((r, i) => {
    const lista = pedidos[i]?.[0];
    if (lista && r.status === "fulfilled") out[lista] = r.value;
  });
  return out;
};

/** Los códigos guardados de cada lista, en orden estable. */
function pedidosDe(fuentes: Fuente[]): Pedido[] {
  const porLista = new Map<string, Set<string>>();
  for (const { lista, codigos } of fuentes) {
    if (!lista || codigos.length === 0) continue;
    const set = porLista.get(lista) ?? new Set<string>();
    codigos.forEach((c) => set.add(c));
    porLista.set(lista, set);
  }
  return [...porLista]
    .map(([lista, set]): Pedido => [lista, [...set].sort(porTexto)])
    .sort(([a], [b]) => porTexto(a, b));
}

function opcionesEstaticas(selectables: Selectable[] | undefined) {
  const out: OpcionesPorLista = {};
  for (const s of selectables ?? []) {
    if (s.source.kind === "STATIC") out[s.key] = s.options;
  }
  return out;
}

/** Los lugares y trayectos con los nombres de sus categorías, para verlos y buscarlos. */
export function useNombresDeCategoria(
  lugares: Lugar[],
  trayectos: Trayecto[]
): { lugares: Lugar[]; trayectos: Trayecto[] } {
  const lang = useParams<{ lang: string }>()?.lang ?? "es";
  const pedidos = useMemo(
    () =>
      pedidosDe([
        ...lugares.map(fuenteDeLugar),
        ...trayectos.map(fuenteDeTrayecto),
      ]),
    [lugares, trayectos]
  );
  const { data: selectables } = useApiSelectables(pedidos.length > 0);
  const dinamicas = pedidos.filter(([key]) =>
    selectables?.some((s) => s.key === key && s.source.kind !== "STATIC")
  );
  const { data: deDinamicas } = useSWR(
    dinamicas.length > 0
      ? (["places-category-options", JSON.stringify(dinamicas)] as const)
      : null,
    leerDinamicas,
    { revalidateOnFocus: false }
  );
  return useMemo(() => {
    const opciones = { ...opcionesEstaticas(selectables), ...deDinamicas };
    return {
      lugares: conNombresDeCategoria(lugares, opciones, lang),
      trayectos: trayectosConNombres(trayectos, opciones, lang),
    };
  }, [lugares, trayectos, selectables, deDinamicas, lang]);
}
