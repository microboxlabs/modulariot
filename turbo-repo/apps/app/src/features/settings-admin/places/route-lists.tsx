"use client";

// Lista de trayectos con la misma tarjeta que los lugares.
import { PlaceIcon } from "./icons";
import { ListCard, ListCardRow, ListSection } from "./list-card";
import type { Trayecto } from "./places.types";

function detalleTrayecto(t: Trayecto): string {
  const partes = [t.kind];
  if (t.ajustado) partes.push("ajustado");
  if (t.width_m) partes.push(`${t.width_m} m`);
  partes.push(`${t.points.length} pts`);
  return partes.join(" · ");
}

export function TrayectoList({
  trayectos,
  busqueda = "",
  seleccionadoId,
  sinCard = false,
  onIr,
  onEditar,
  onEliminar,
}: {
  trayectos: Trayecto[];
  busqueda?: string;
  seleccionadoId: string | null;
  /** Solo la sección, para componerla dentro de otra tarjeta. */
  sinCard?: boolean;
  onIr: (t: Trayecto) => void;
  onEditar: (t: Trayecto) => void;
  onEliminar: (t: Trayecto) => void;
}) {
  const seccion = (
    <ListSection
      titulo="Trayectos"
      total={trayectos.length}
      vacio={`Sin trayectos${busqueda ? ` para «${busqueda}»` : ""}.`}
    >
      {trayectos.map((t) => (
        <ListCardRow
          key={t.trayecto_id}
          icono={
            <PlaceIcon
              id={t.icon}
              fallback="ruta"
              className="h-4 w-4 flex-none text-purple-600"
            />
          }
          nombre={t.name}
          detalle={detalleTrayecto(t)}
          seleccionado={seleccionadoId === t.trayecto_id}
          onIr={() => onIr(t)}
          onEditar={() => onEditar(t)}
          onEliminar={() => onEliminar(t)}
        />
      ))}
    </ListSection>
  );
  if (sinCard) return seccion;
  return <ListCard>{seccion}</ListCard>;
}
