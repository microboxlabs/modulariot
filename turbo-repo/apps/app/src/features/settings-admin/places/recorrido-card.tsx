"use client";

// Tarjeta del recorrido por dirección: encabezado, lista ordenable de puntos
// (asa a la izquierda para arrastrar) y botón para agregar un punto.
import { useEffect } from "react";
import { ReactSortable } from "react-sortablejs";
import { HiCursorClick, HiPlus, HiX } from "react-icons/hi";
import { MdDragIndicator } from "react-icons/md";
import { twMerge } from "tailwind-merge";
import AddressInput from "./address-input";
import type { FormTrayecto, LatLon, Parada } from "./places.types";
import {
  MAX_PUNTOS,
  MIN_PUNTOS,
  agregarPunto,
  elegirPunto,
  etiquetaPunto,
  puedeConfirmar,
  quitarPunto,
  reordenar,
  textoPunto,
} from "./recorrido";

/** Aplica un cambio al recorrido; `foco` = punto a centrar si aún no hay ruta. */
export type OnRecorrido = (
  cambio: (t: FormTrayecto) => FormTrayecto,
  foco?: LatLon
) => void;

function FilaPunto({
  punto,
  indice,
  total,
  token,
  cerca,
  eligiendo,
  resaltado,
  onRecorrido,
  onElegirEnMapa,
  onHover,
}: {
  resaltado: boolean;
  onHover: (id: string | null) => void;
  punto: Parada;
  indice: number;
  total: number;
  token: string | undefined;
  cerca: () => LatLon | null;
  eligiendo: boolean;
  onRecorrido: OnRecorrido;
  onElegirEnMapa: (id: string) => void;
}) {
  const id = punto.id;
  const { letra, colorCls, label } = etiquetaPunto(indice, total);
  const marcarEnMapa = () => onElegirEnMapa(id);
  const quitar = () => onRecorrido((x) => quitarPunto(x, id));
  return (
    <div
      className={twMerge(
        "flex items-center gap-1 bg-white px-1.5 py-1.5 transition-colors dark:bg-gray-800",
        resaltado && "bg-blue-50 dark:bg-blue-900/30"
      )}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
    >
      <span
        className="drag-handle flex h-7 w-5 flex-none cursor-grab items-center justify-center text-gray-400 hover:text-gray-700 active:cursor-grabbing dark:hover:text-gray-200"
        title="Arrastra para cambiar el orden"
        aria-label={`Mover ${label}`}
      >
        <MdDragIndicator className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <AddressInput
          label={label}
          letra={letra}
          colorCls={colorCls}
          value={punto}
          token={token}
          cerca={cerca}
          onTexto={(t) => onRecorrido((x) => textoPunto(x, id, t))}
          onElegir={(s) => onRecorrido((x) => elegirPunto(x, id, s), s.punto)}
        />
      </div>
      <button
        type="button"
        aria-pressed={eligiendo}
        aria-label={
          eligiendo
            ? `Cancelar marcar ${label} en el mapa`
            : `Marcar ${label} en el mapa`
        }
        title={eligiendo ? "Clic en el mapa para ubicar" : "Ubicar en el mapa"}
        onClick={marcarEnMapa}
        className={twMerge(
          "flex h-7 w-7 flex-none items-center justify-center rounded-md",
          eligiendo
            ? "bg-blue-100 text-blue-700 ring-1 ring-blue-400 dark:bg-blue-900/40 dark:text-blue-300"
            : "text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-300"
        )}
      >
        <HiCursorClick className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Quitar ${label}`}
        disabled={total <= MIN_PUNTOS}
        onClick={quitar}
        className="flex h-7 w-6 flex-none items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-rose-600 disabled:hidden dark:hover:bg-gray-700"
      >
        <HiX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function sinHover() {}

function estadoRecorrido(tray: FormTrayecto, calculando: boolean): string {
  if (calculando) return "Calculando ruta…";
  if (puedeConfirmar(tray)) return "Confirma con «Listo» en el mapa";
  return `${tray.recorrido.length} puntos`;
}

export default function RecorridoCard({
  tray,
  calculando,
  token,
  cerca,
  onRecorrido,
  eligiendoPuntoId = null,
  onElegirEnMapa,
  resaltadoId = null,
  onHoverPunto = sinHover,
  className,
}: {
  className?: string;
  /** Punto resaltado (hover en la lista o en el mapa). */
  resaltadoId?: string | null;
  onHoverPunto?: (id: string | null) => void;
  tray: FormTrayecto;
  calculando: boolean;
  token: string | undefined;
  cerca: () => LatLon | null;
  onRecorrido: OnRecorrido;
  eligiendoPuntoId?: string | null;
  onElegirEnMapa: (id: string) => void;
}) {
  const total = tray.recorrido.length;
  const lleno = total >= MAX_PUNTOS;
  const iEligiendo = tray.recorrido.findIndex((p) => p.id === eligiendoPuntoId);
  const hintMapa =
    iEligiendo >= 0
      ? `Clic en el mapa para ubicar ${etiquetaPunto(iEligiendo, total).label}`
      : null;

  useEffect(() => {
    if (!eligiendoPuntoId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onElegirEnMapa(eligiendoPuntoId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eligiendoPuntoId, onElegirEnMapa]);

  return (
    // sin overflow-hidden en la tarjeta: las sugerencias de dirección se
    // despliegan dentro del área desplazable de la lista
    <div
      className={twMerge(
        "flex flex-col rounded-lg border border-gray-200 dark:border-gray-600",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700/50">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
          Recorrido
        </h3>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {hintMapa ?? estadoRecorrido(tray, calculando)}
        </span>
      </div>

      <ReactSortable
        list={tray.recorrido}
        setList={(xs) =>
          onRecorrido((t) =>
            reordenar(
              t,
              xs.map((x) => x.id)
            )
          )
        }
        handle=".drag-handle"
        animation={150}
        // la lista ocupa el alto libre y se desplaza por dentro
        className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700"
      >
        {tray.recorrido.map((p, i) => (
          <FilaPunto
            key={p.id}
            punto={p}
            indice={i}
            total={total}
            token={token}
            cerca={cerca}
            eligiendo={p.id === eligiendoPuntoId}
            resaltado={p.id === resaltadoId}
            onRecorrido={onRecorrido}
            onElegirEnMapa={onElegirEnMapa}
            onHover={onHoverPunto}
          />
        ))}
      </ReactSortable>

      <button
        type="button"
        onClick={() => onRecorrido(agregarPunto)}
        disabled={lleno}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-b-lg bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
      >
        <HiPlus className="h-3.5 w-3.5" />
        {lleno ? `Máximo ${MAX_PUNTOS} puntos` : "Agregar punto"}
      </button>
    </div>
  );
}
