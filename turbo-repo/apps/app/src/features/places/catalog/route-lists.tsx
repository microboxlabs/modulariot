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
import { longitudM, textoDistancia } from "../routes/recorrido";
import { usePlacesT, type TextosLugares } from "../i18n/places-i18n";

/** Como en los lugares: sus categorías y, después, cuánto mide. */
function detalleTrayecto(t: Trayecto, tx: TextosLugares): string {
  const categorias =
    t.categorias_nombres ||
    t.categorias?.join(", ") ||
    tx("common.no_category");
  return `${categorias} · ${textoDistancia(longitudM(t.points), tx)}`;
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
  const tx = usePlacesT();
  return (
    <ListSection
      seleccion={marcas && { ids: trayectos.map((t) => t.trayecto_id), marcas }}
      titulo={tx("catalog.routes")}
      icono={<TbRoute className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
      total={trayectos.length}
      vacio={
        busqueda
          ? tx("catalog.no_routes_for", { busqueda })
          : tx("catalog.no_routes")
      }
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
          detalle={detalleTrayecto(t, tx)}
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
