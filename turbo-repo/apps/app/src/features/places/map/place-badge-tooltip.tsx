"use client";

// Tooltip al pasar el mouse por el badge de una geocerca en el mapa: su
// nombre y, sobre todo, sus categorías. En un cluster ("N geocercas"),
// cuántas son y sus nombres.
import { OptionBadge } from "@/features/settings-admin/selectables/field/field-parts";
import { CAMPO_CATEGORIAS, useListaCampo } from "../ui/place-categories-field";
import type { BadgeMapa } from "./place-name-layer";
import { categoriasDeLugar } from "../places.types";

/** Nombres que se listan en el tooltip de un cluster. */
const MAX_NOMBRES_CLUSTER = 8;
/** Separación entre el cursor y el tooltip. */
const DESPLAZAMIENTO_PX = 14;

function CategoriasDelLugar({ codigos }: Readonly<{ codigos: string[] }>) {
  const { lang, opciones } = useListaCampo(CAMPO_CATEGORIAS);
  if (codigos.length === 0) {
    return (
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Sin categorías
      </p>
    );
  }
  return (
    <ul aria-label="Categorías" className="flex flex-wrap gap-1">
      {codigos.map((codigo) => {
        // un código que ya no está en la lista se muestra tal cual
        const opcion = opciones.find((o) => o.value === codigo) ?? {
          value: codigo,
          label: { es: codigo },
        };
        return (
          <li key={codigo}>
            <OptionBadge option={opcion} lang={lang} />
          </li>
        );
      })}
    </ul>
  );
}

function ContenidoLugar({ badge }: Readonly<{ badge: BadgeMapa }>) {
  const { item } = badge;
  const lugar = item.lugar;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {item.name}
      </p>
      {item.inner && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          Geocerca interior
        </p>
      )}
      {lugar ? (
        <>
          <CategoriasDelLugar codigos={categoriasDeLugar(lugar)} />
          {lugar.category && (
            <p className="text-[11px] text-gray-600 dark:text-gray-300">
              <span className="text-gray-500 dark:text-gray-400">
                Categoría de alerta:
              </span>{" "}
              {lugar.category}
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Importada (aún sin guardar)
        </p>
      )}
    </div>
  );
}

function ContenidoCluster({ badge }: Readonly<{ badge: BadgeMapa }>) {
  const nombres = badge.miembros.map((m) => m.name);
  const resto = nombres.length - MAX_NOMBRES_CLUSTER;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {nombres.length} geocercas
      </p>
      <ul className="space-y-0.5 text-[11px] text-gray-700 dark:text-gray-300">
        {nombres.slice(0, MAX_NOMBRES_CLUSTER).map((n, i) => (
          <li key={`${n}-${i}`} className="truncate">
            {n}
          </li>
        ))}
        {resto > 0 && (
          <li className="text-gray-500 dark:text-gray-400">+{resto} más</li>
        )}
      </ul>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Acércate para ver cada una.
      </p>
    </div>
  );
}

export default function PlaceBadgeTooltip({
  badge,
  x,
  y,
}: Readonly<{
  badge: BadgeMapa;
  x: number;
  y: number;
}>) {
  return (
    <div
      role="tooltip"
      style={{ left: x + DESPLAZAMIENTO_PX, top: y + DESPLAZAMIENTO_PX }}
      className="pointer-events-none absolute z-40 max-w-64 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      {badge.miembros.length > 1 ? (
        <ContenidoCluster badge={badge} />
      ) : (
        <ContenidoLugar badge={badge} />
      )}
    </div>
  );
}
