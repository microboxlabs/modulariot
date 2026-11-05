"use client";

// Geocercas que no son de Lugares (p. ej. las del viaje en el mapa de
// síntomas): se listan con la misma fila, solo para ver e ir a ellas; no se
// editan ni se eligen para borrar.
import { PlaceIcon } from "../ui/icons";
import { ListCardRow, ListSection } from "./list-card";
import type { GeocercaExterna } from "../places.types";

/** Las que coinciden con la búsqueda, por nombre (sin mayúsculas). */
export function filtrarExternas(
  items: GeocercaExterna[],
  busqueda: string
): GeocercaExterna[] {
  const q = busqueda.trim().toLowerCase();
  if (!q) return items;
  return items.filter((g) => g.nombre.toLowerCase().includes(q));
}

export default function ExternalGeofencesList({
  titulo,
  items,
  vacio,
  onIr,
}: Readonly<{
  titulo: string;
  /** Ya filtradas por la búsqueda. */
  items: GeocercaExterna[];
  vacio: string;
  onIr: (g: GeocercaExterna) => void;
}>) {
  return (
    <ListSection
      titulo={titulo}
      total={items.length}
      vacio={vacio}
      icono={
        <PlaceIcon id="" className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      }
    >
      {items.map((g) => (
        <ListCardRow
          key={g.id}
          icono={
            <PlaceIcon id="" className="h-4 w-4 flex-none text-amber-500" />
          }
          nombre={g.nombre}
          detalle={g.detalle}
          seleccionado={false}
          onIr={() => onIr(g)}
        />
      ))}
    </ListSection>
  );
}
