"use client";

// Barra de búsqueda del catálogo: la misma del panel de planificación
// (`PlanningSearchAutocomplete` de miot-calendar-ui). Mientras se escribe dice
// si el texto está en el nombre o en la categoría de alguna geocerca y cuántas
// hay; elegir una fila deja un filtro («Categoría: planta») que se quita aparte.
// Solo el cuadro: su lista de filtros pide un `CalendarProvider`.
import { useCallback, useMemo } from "react";
import { HiOutlineLocationMarker, HiOutlineTag, HiX } from "react-icons/hi";
import {
  PlanningSearchAutocomplete,
  type SearchAutocompleteField,
} from "@microboxlabs/miot-calendar-ui";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { CampoBusqueda, EtiquetaBusqueda } from "./catalog-search";

/** Lo que la barra compara: geocercas propias y las de solo lectura. */
export type ItemBusqueda = {
  id: string;
  name: string;
  category: string | null;
};

const ICONO = "h-4 w-4 text-gray-600 dark:text-gray-400";

const CAMPOS: readonly {
  campo: CampoBusqueda;
  get: (i: ItemBusqueda) => string | undefined;
  icon: React.ReactNode;
}[] = [
  {
    campo: "category",
    get: (i) => i.category ?? undefined,
    icon: <HiOutlineTag className={ICONO} />,
  },
  {
    campo: "name",
    get: (i) => i.name,
    icon: <HiOutlineLocationMarker className={ICONO} />,
  },
];

const RAIZ = "geographic_view.places.search";

// los textos que pide la barra (los del panel de planificación) → los propios
const TEXTOS: Record<string, string> = {
  "pages.planning.sidebar.searchPlaceholder": `${RAIZ}.placeholder`,
  "pages.planning.sidebar.search.minCharacters": `${RAIZ}.min_characters`,
  "pages.planning.sidebar.search.loading": `${RAIZ}.loading`,
  "pages.planning.sidebar.search.noResults": `${RAIZ}.no_results`,
  "pages.planning.sidebar.search.noResultsFor": `${RAIZ}.no_results_for`,
};

const esCampo = (m: string): m is CampoBusqueda =>
  CAMPOS.some((c) => c.campo === m);

const mismaEtiqueta = (a: EtiquetaBusqueda, b: EtiquetaBusqueda) =>
  a.matchType === b.matchType &&
  a.value.trim().toLowerCase() === b.value.trim().toLowerCase();

export default function CatalogSearchBar({
  items,
  etiquetas,
  onEtiquetas,
  onBusca,
  dict,
  acciones,
}: Readonly<{
  items: ItemBusqueda[];
  etiquetas: EtiquetaBusqueda[];
  onEtiquetas: (next: EtiquetaBusqueda[]) => void;
  /** El texto mientras se escribe (con al menos 2 letras), para filtrar ya. */
  onBusca: (q: string) => void;
  dict: I18nRecord;
  /** Botones a la derecha del cuadro (importar, exportar), de su mismo alto. */
  acciones?: React.ReactNode;
}>) {
  const etiquetaDe = useCallback(
    (campo: string) => trDynamic(`${RAIZ}.field.${campo}`, dict),
    [dict]
  );
  const fields = useMemo<ReadonlyArray<SearchAutocompleteField<ItemBusqueda>>>(
    () =>
      CAMPOS.map(({ campo, get, icon }) => ({
        matchType: campo,
        get,
        label: etiquetaDe(campo),
        icon,
      })),
    [etiquetaDe]
  );
  const t = useCallback(
    (path: string) => trDynamic(TEXTOS[path] ?? path, dict),
    [dict]
  );

  const elegir = (matchType: string, value: string) => {
    if (!esCampo(matchType) || !value.trim()) return;
    const nueva = { matchType, value: value.trim() };
    if (etiquetas.some((e) => mismaEtiqueta(e, nueva))) return;
    onEtiquetas([...etiquetas, nueva]);
  };

  const quitar = (e: EtiquetaBusqueda) =>
    onEtiquetas(etiquetas.filter((x) => x !== e));

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      {/* los botones se estiran al alto del cuadro; los filtros, debajo */}
      <div className="flex gap-1.5">
        {/* el cuadro guarda 40 px a la derecha para su spinner: con 32 cabe
            igual y el texto llega más lejos en esta barra angosta */}
        <div className="min-w-0 flex-1 [&_input]:pr-8">
          <PlanningSearchAutocomplete
            services={items}
            fields={fields}
            t={t}
            onMatchTypeSelect={elegir}
            onQueryChange={onBusca}
          />
        </div>
        {acciones}
      </div>
      <EtiquetasElegidas
        etiquetas={etiquetas}
        etiquetaDe={etiquetaDe}
        textoQuitar={(e) =>
          trDynamic(`${RAIZ}.remove_tag`, dict, {
            tag: `${etiquetaDe(e.matchType)}: ${e.value}`,
          })
        }
        onQuitar={quitar}
      />
    </div>
  );
}

/**
 * Los filtros elegidos, con el aspecto de `PlanningSearchTags` del paquete,
 * que no sirve aquí: necesita estar dentro de un `CalendarProvider`.
 */
function EtiquetasElegidas({
  etiquetas,
  etiquetaDe,
  textoQuitar,
  onQuitar,
}: Readonly<{
  etiquetas: EtiquetaBusqueda[];
  etiquetaDe: (campo: string) => string;
  textoQuitar: (e: EtiquetaBusqueda) => string;
  onQuitar: (e: EtiquetaBusqueda) => void;
}>) {
  if (etiquetas.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {etiquetas.map((e) => (
        <li
          key={`${e.matchType}-${e.value}`}
          className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 dark:border-blue-700 dark:bg-blue-900/30"
        >
          <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
            {`${etiquetaDe(e.matchType)}: ${e.value}`}
          </span>
          <button
            type="button"
            aria-label={textoQuitar(e)}
            onClick={() => onQuitar(e)}
            className="rounded p-0.5 transition-colors hover:bg-blue-200 dark:hover:bg-blue-700"
          >
            <HiX className="h-3 w-3 text-blue-700 dark:text-blue-300" />
          </button>
        </li>
      ))}
    </ul>
  );
}
