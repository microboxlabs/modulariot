"use client";

// Tooltip al pasar el mouse por el badge de una geocerca en el mapa: su
// nombre y, sobre todo, sus categorías. En un cluster, cuántas geocercas y
// cuántos trayectos junta, cada grupo con su icono y sus nombres.
import { useLayoutEffect, useRef, useState } from "react";
import { OptionBadge } from "@/features/settings-admin/selectables/field/field-parts";
import { CAMPO_CATEGORIAS, useListaCampo } from "../ui/place-categories-field";
import {
  HiOutlineLocationMarker,
  HiOutlineSwitchHorizontal,
} from "react-icons/hi";
import type { IconType } from "react-icons";
import { textoCluster, type BadgeMapa } from "./place-name-layer";
import { categoriasDeLugar } from "../places.types";

/**
 * Nombres que se listan en el tooltip de un cluster; el resto queda en
 * "+N más", así un cluster grande no agranda la tarjeta.
 */
export const MAX_NOMBRES_CLUSTER = 5;
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
      {item.trayectoId && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Trayecto</p>
      )}
      {lugar && (
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
      )}
      {/* sin lugar ni trayecto guardado: una forma del archivo importado */}
      {!lugar && !item.trayectoId && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Importada (aún sin guardar)
        </p>
      )}
    </div>
  );
}

/** Un tipo del cluster: su icono, cuántos son y sus nombres (hasta el tope). */
function GrupoCluster({
  icono: Icono,
  titulo,
  nombres,
}: Readonly<{ icono: IconType; titulo: string; nombres: string[] }>) {
  const resto = nombres.length - MAX_NOMBRES_CLUSTER;
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1 text-xs font-semibold text-gray-900 dark:text-white">
        <Icono className="h-3.5 w-3.5 flex-none text-blue-600" aria-hidden />
        {titulo}
      </p>
      <ul className="space-y-0.5 pl-4.5 text-[11px] text-gray-700 dark:text-gray-300">
        {nombres.slice(0, MAX_NOMBRES_CLUSTER).map((n, i) => (
          <li key={`${n}-${i}`} className="truncate">
            {n}
          </li>
        ))}
        {resto > 0 && (
          <li className="text-gray-500 dark:text-gray-400">+{resto} más</li>
        )}
      </ul>
    </div>
  );
}

function ContenidoCluster({ badge }: Readonly<{ badge: BadgeMapa }>) {
  const geocercas = badge.miembros.filter((m) => !m.trayectoId);
  const trayectos = badge.miembros.filter((m) => m.trayectoId);
  return (
    <div className="space-y-1.5">
      {geocercas.length > 0 && (
        <GrupoCluster
          icono={HiOutlineLocationMarker}
          titulo={textoCluster({ geocercas: geocercas.length, trayectos: 0 })}
          nombres={geocercas.map((m) => m.name)}
        />
      )}
      {trayectos.length > 0 && (
        <GrupoCluster
          icono={HiOutlineSwitchHorizontal}
          titulo={textoCluster({ geocercas: 0, trayectos: trayectos.length })}
          nombres={trayectos.map((m) => m.name)}
        />
      )}
      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Acércate para ver cada uno.
      </p>
    </div>
  );
}

/**
 * Dónde va la tarjeta: abajo a la derecha del cursor; si ahí no cabe en el
 * mapa, al otro lado (izquierda o arriba). Nunca sale del borde.
 */
export function posicionTooltip(
  cursor: { x: number; y: number },
  tarjeta: { ancho: number; alto: number },
  mapa: { ancho: number; alto: number }
): { left: number; top: number } {
  const eje = (c: number, tam: number, max: number) => {
    if (c + DESPLAZAMIENTO_PX + tam <= max) return c + DESPLAZAMIENTO_PX;
    return Math.max(0, c - DESPLAZAMIENTO_PX - tam);
  };
  return {
    left: eje(cursor.x, tarjeta.ancho, mapa.ancho),
    top: eje(cursor.y, tarjeta.alto, mapa.alto),
  };
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
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({
    left: x + DESPLAZAMIENTO_PX,
    top: y + DESPLAZAMIENTO_PX,
  });
  // se mide antes de pintar: la tarjeta aparece ya del lado que cabe
  useLayoutEffect(() => {
    const el = ref.current;
    const mapa = el?.offsetParent;
    if (!el || !mapa) return;
    setPos(
      posicionTooltip(
        { x, y },
        { ancho: el.offsetWidth, alto: el.offsetHeight },
        { ancho: mapa.clientWidth, alto: mapa.clientHeight }
      )
    );
  }, [x, y, badge]);
  return (
    <div
      ref={ref}
      role="tooltip"
      style={pos}
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
