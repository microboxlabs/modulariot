"use client";

import { HiPlus } from "react-icons/hi";
import { LocalBadge } from "./form-ui";
import { PlaceIcon } from "./icons";
import { ListCard, ListCardRow } from "./list-card";
import { isLocalId } from "./local-store";
import { iconoDeLugar, type Lugar } from "./places.types";

export default function PlaceList({
  lugares,
  busqueda,
  seleccionadoId,
  modoCircuito,
  onIr,
  onEditar,
  onEliminar,
  onAgregarAlCircuito,
}: {
  lugares: Lugar[];
  busqueda: string;
  /** Lugar abierto en la ventana flotante, resaltado en la lista. */
  seleccionadoId: string | null;
  /** Armando un circuito: cada fila muestra "+" para sumarla como parada. */
  modoCircuito: boolean;
  onIr: (l: Lugar) => void;
  onEditar: (l: Lugar) => void;
  onEliminar: (l: Lugar) => void;
  onAgregarAlCircuito: (l: Lugar) => void;
}) {
  return (
    <ListCard
      titulo="Lugares"
      total={lugares.length}
      vacio={`Sin lugares${busqueda ? ` para «${busqueda}»` : " — crea el primero"}.`}
    >
      {lugares.map((l) => (
        <ListCardRow
          key={l.place_id}
          icono={
            <PlaceIcon
              id={iconoDeLugar(l)}
              className="h-4 w-4 flex-none"
              style={{ color: l.color ?? "#1C64F2" }}
            />
          }
          nombre={l.name}
          detalle={`${l.category ?? "sin categoría"}${l.address ? ` · ${l.address}` : ""}`}
          seleccionado={seleccionadoId === l.place_id}
          onIr={() => onIr(l)}
          onEditar={() => onEditar(l)}
          onEliminar={() => onEliminar(l)}
          extras={
            <>
              {isLocalId(l.place_id) && <LocalBadge />}
              {modoCircuito && !isLocalId(l.place_id) && (
                <button
                  type="button"
                  aria-label={`Agregar ${l.name} al circuito`}
                  title="Agregar al circuito"
                  onClick={() => onAgregarAlCircuito(l)}
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30"
                >
                  <HiPlus className="h-4 w-4" />
                </button>
              )}
            </>
          }
        />
      ))}
    </ListCard>
  );
}
