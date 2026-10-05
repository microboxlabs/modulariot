"use client";

// Tarjeta del recorrido por dirección: encabezado, lista ordenable de puntos
// (asa a la izquierda para arrastrar) y botón para agregar un punto.
import { ReactSortable } from "react-sortablejs";
import { HiPlus, HiX } from "react-icons/hi";
import { MdDragIndicator } from "react-icons/md";
import AddressInput from "./address-input";
import type { FormTrayecto, LatLon, Parada } from "./places.types";
import {
  MAX_PUNTOS,
  MIN_PUNTOS,
  agregarPunto,
  elegirPunto,
  etiquetaPunto,
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
  onRecorrido,
}: {
  punto: Parada;
  indice: number;
  total: number;
  token: string | undefined;
  cerca: () => LatLon | null;
  onRecorrido: OnRecorrido;
}) {
  const id = punto.id;
  const { letra, colorCls, label } = etiquetaPunto(indice, total);
  return (
    <div className="flex items-center gap-1 bg-white px-1.5 py-1.5 dark:bg-gray-800">
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
        aria-label={`Quitar ${label}`}
        disabled={total <= MIN_PUNTOS}
        onClick={() => onRecorrido((x) => quitarPunto(x, id))}
        className="flex h-7 w-6 flex-none items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-rose-600 disabled:invisible dark:hover:bg-gray-700"
      >
        <HiX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function RecorridoCard({
  tray,
  calculando,
  token,
  cerca,
  onRecorrido,
}: {
  tray: FormTrayecto;
  calculando: boolean;
  token: string | undefined;
  cerca: () => LatLon | null;
  onRecorrido: OnRecorrido;
}) {
  const total = tray.recorrido.length;
  const lleno = total >= MAX_PUNTOS;

  return (
    // sin overflow-hidden: las sugerencias de dirección deben poder salir
    <div className="rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700/50">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
          Recorrido
        </h3>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {calculando ? "Calculando ruta…" : `${total} puntos`}
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
        className="divide-y divide-gray-100 dark:divide-gray-700"
      >
        {tray.recorrido.map((p, i) => (
          <FilaPunto
            key={p.id}
            punto={p}
            indice={i}
            total={total}
            token={token}
            cerca={cerca}
            onRecorrido={onRecorrido}
          />
        ))}
      </ReactSortable>

      <button
        type="button"
        onClick={() => onRecorrido(agregarPunto)}
        disabled={lleno}
        className="inline-flex w-full items-center justify-center gap-1 rounded-b-lg bg-purple-600 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
      >
        <HiPlus className="h-3.5 w-3.5" />
        {lleno ? `Máximo ${MAX_PUNTOS} puntos` : "Agregar punto"}
      </button>
    </div>
  );
}
