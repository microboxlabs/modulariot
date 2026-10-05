"use client";

// Listas de trayectos y circuitos con la misma tarjeta que los lugares.
import { HiOutlineRefresh } from "react-icons/hi";
import { LocalBadge } from "./form-ui";
import { PlaceIcon } from "./icons";
import { ListCard, ListCardRow } from "./list-card";
import { isLocalId } from "./local-store";
import type { Circuito, Trayecto } from "./places.types";

function detalleTrayecto(t: Trayecto): string {
  const partes = [t.kind];
  if (t.ajustado) partes.push("ajustado");
  if (t.width_m) partes.push(`${t.width_m} m`);
  partes.push(`${t.points.length} pts`);
  return partes.join(" · ");
}

export function TrayectoList({
  trayectos,
  seleccionadoId,
  onIr,
  onEditar,
  onEliminar,
}: {
  trayectos: Trayecto[];
  seleccionadoId: string | null;
  onIr: (t: Trayecto) => void;
  onEditar: (t: Trayecto) => void;
  onEliminar: (t: Trayecto) => void;
}) {
  return (
    <ListCard
      titulo="Trayectos"
      total={trayectos.length}
      vacio="Sin trayectos."
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
          extras={isLocalId(t.trayecto_id) ? <LocalBadge /> : undefined}
        />
      ))}
    </ListCard>
  );
}

function detalleCircuito(c: Circuito): string {
  let d = c.stops.map((s) => s.name ?? "?").join(" → ");
  if (c.cerrado) d += " (cerrado)";
  if (c.ajustado) d += " · ajustado";
  return d;
}

export function CircuitoList({
  circuitos,
  seleccionadoId,
  onIr,
  onEditar,
  onEliminar,
}: {
  circuitos: Circuito[];
  seleccionadoId: string | null;
  onIr: (c: Circuito) => void;
  onEditar: (c: Circuito) => void;
  onEliminar: (c: Circuito) => void;
}) {
  return (
    <ListCard
      titulo="Circuitos"
      total={circuitos.length}
      vacio="Sin circuitos."
    >
      {circuitos.map((c) => (
        <ListCardRow
          key={c.route_id}
          icono={
            <HiOutlineRefresh className="h-4 w-4 flex-none text-green-600" />
          }
          nombre={c.name}
          detalle={detalleCircuito(c)}
          seleccionado={seleccionadoId === c.route_id}
          onIr={() => onIr(c)}
          onEditar={() => onEditar(c)}
          onEliminar={() => onEliminar(c)}
        />
      ))}
    </ListCard>
  );
}
