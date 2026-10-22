"use client";

// Lista de trayectos con la misma tarjeta que los lugares.
import { TbRoute } from "react-icons/tb";
import { PlaceIcon } from "../ui/icons";
import VersionBadge from "../versioning/version-badge";
import {
  ListCardRow,
  ListSection,
  marcaDe,
  type MarcasLista,
} from "./list-card";
import type { Trayecto } from "../places.types";

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
  onIr,
  onEditar,
  onEliminar,
  marcas,
  versionDe,
}: Readonly<{
  /** Casillas para elegir varios (borrar en lote). */
  marcas?: MarcasLista;
  /** Versión vigente de cada trayecto. */
  versionDe?: (trayectoId: string) => string | null;
  trayectos: Trayecto[];
  busqueda?: string;
  seleccionadoId: string | null;
  onIr: (t: Trayecto) => void;
  /** Sin permiso de edición no vienen: la fila no tiene menú. */
  onEditar?: (t: Trayecto) => void;
  onEliminar?: (t: Trayecto) => void;
}>) {
  return (
    <ListSection
      seleccion={marcas && { ids: trayectos.map((t) => t.trayecto_id), marcas }}
      titulo="Trayectos"
      icono={<TbRoute className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
      total={trayectos.length}
      vacio={busqueda ? `Sin trayectos para «${busqueda}».` : "Sin trayectos."}
    >
      {trayectos.map((t) => (
        <ListCardRow
          key={t.trayecto_id}
          icono={
            <PlaceIcon
              id={t.icon}
              fallback="ruta"
              className="h-4 w-4 flex-none text-blue-600"
            />
          }
          nombre={t.name}
          detalle={detalleTrayecto(t)}
          seleccionado={seleccionadoId === t.trayecto_id}
          onIr={() => onIr(t)}
          onEditar={onEditar && (() => onEditar(t))}
          onEliminar={onEliminar && (() => onEliminar(t))}
          marca={marcaDe(marcas, t.trayecto_id)}
          extras={
            <VersionBadge
              version={versionDe?.(t.trayecto_id)}
              className="mr-1"
            />
          }
        />
      ))}
    </ListSection>
  );
}
