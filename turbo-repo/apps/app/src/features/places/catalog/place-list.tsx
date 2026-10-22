"use client";

import { useEffect, useState } from "react";
import { HiOutlineLocationMarker } from "react-icons/hi";
import { PlaceIcon } from "../ui/icons";
import VersionBadge from "../versioning/version-badge";
import {
  ListCardRow,
  ListSection,
  marcaDe,
  type MarcasLista,
} from "./list-card";
import { parentPlaceId } from "../geofences/inner-geofences";
import { colorDeLugar, iconoDeLugar, type Lugar } from "../places.types";

function gruposLugares(lugares: Lugar[]): { padre: Lugar; hijos: Lugar[] }[] {
  const ids = new Set(lugares.map((l) => l.place_id));
  const hijos = new Map<string, Lugar[]>();
  const raiz: Lugar[] = [];
  for (const l of lugares) {
    const padre = parentPlaceId(l);
    if (padre && ids.has(padre)) {
      const xs = hijos.get(padre) ?? [];
      xs.push(l);
      hijos.set(padre, xs);
    } else {
      raiz.push(l);
    }
  }
  return raiz.map((padre) => ({
    padre,
    hijos: hijos.get(padre.place_id) ?? [],
  }));
}

function textoInteriores(nHijos: number): string {
  if (nHijos === 0) return "";
  return nHijos === 1 ? " · 1 interior" : ` · ${nHijos} interiores`;
}

function detallePadre(l: Lugar, nHijos: number): string {
  const cat = l.category ?? "sin categoría";
  const interiores = textoInteriores(nHijos);
  const dir = l.address ? ` · ${l.address}` : "";
  return `${cat}${interiores}${dir}`;
}

function vacioLugares(busqueda: string): string {
  if (busqueda) return `Sin lugares para «${busqueda}».`;
  return "Sin lugares — crea el primero.";
}

export default function PlaceList({
  lugares,
  busqueda,
  seleccionadoId,
  onIr,
  onEditar,
  onEliminar,
  onHover,
  marcas,
  versionDe,
}: Readonly<{
  /** Casillas para elegir varios (borrar en lote). */
  marcas?: MarcasLista;
  /** Versión vigente de cada lugar (las interiores van con su padre). */
  versionDe?: (placeId: string) => string | null;
  lugares: Lugar[];
  busqueda: string;
  /** Lugar abierto en la ventana flotante, resaltado en la lista. */
  seleccionadoId: string | null;
  onIr: (l: Lugar) => void;
  /** Sin permiso de edición no vienen: la fila no tiene menú. */
  onEditar?: (l: Lugar) => void;
  onEliminar?: (l: Lugar) => void;
  /** Resalta la geocerca en el mapa (filas interiores). */
  onHover?: (placeId: string | null) => void;
}>) {
  const [plegados, setPlegados] = useState<Set<string>>(() => new Set());

  const plegar = (id: string) => {
    setPlegados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!seleccionadoId) return;
    const sel = lugares.find((l) => l.place_id === seleccionadoId);
    if (!sel) return;
    const padre = parentPlaceId(sel);
    if (!padre) return;
    setPlegados((prev) => {
      if (!prev.has(padre)) return prev;
      const next = new Set(prev);
      next.delete(padre);
      return next;
    });
  }, [seleccionadoId, lugares]);

  return (
    <ListSection
      seleccion={marcas && { ids: lugares.map((l) => l.place_id), marcas }}
      titulo="Lugares"
      icono={
        <HiOutlineLocationMarker className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      }
      total={lugares.length}
      vacio={vacioLugares(busqueda)}
    >
      {gruposLugares(lugares).map(({ padre, hijos }) => {
        const plegado = plegados.has(padre.place_id);
        return (
          <PlaceGroup
            key={padre.place_id}
            padre={padre}
            hijos={hijos}
            plegado={plegado}
            seleccionadoId={seleccionadoId}
            onPlegar={plegar}
            onIr={onIr}
            onEditar={onEditar}
            onEliminar={onEliminar}
            onHover={onHover}
            marcas={marcas}
            version={versionDe?.(padre.place_id)}
          />
        );
      })}
    </ListSection>
  );
}

function PlaceGroup({
  padre,
  hijos,
  plegado,
  seleccionadoId,
  onPlegar,
  onIr,
  onEditar,
  onEliminar,
  onHover,
  marcas,
  version,
}: Readonly<{
  marcas?: MarcasLista;
  version?: string | null;
  padre: Lugar;
  hijos: Lugar[];
  plegado: boolean;
  seleccionadoId: string | null;
  onPlegar: (id: string) => void;
  onIr: (l: Lugar) => void;
  /** Sin permiso de edición no vienen: la fila no tiene menú. */
  onEditar?: (l: Lugar) => void;
  onEliminar?: (l: Lugar) => void;
  onHover?: (placeId: string | null) => void;
}>) {
  const plegarEste = () => onPlegar(padre.place_id);
  return (
    <li>
      <LugarRow
        lugar={padre}
        detalle={detallePadre(padre, hijos.length)}
        seleccionadoId={seleccionadoId}
        as="div"
        expandido={hijos.length > 0 ? !plegado : undefined}
        onExpandir={hijos.length > 0 ? plegarEste : undefined}
        onIr={onIr}
        onEditar={onEditar}
        onEliminar={onEliminar}
        onHover={onHover}
        marcas={marcas}
        version={version}
      />
      {!plegado && hijos.length > 0 && (
        <ul className="bg-gray-100 py-0.5 dark:bg-gray-900/55">
          {hijos.map((h) => (
            <LugarRow
              key={h.place_id}
              lugar={h}
              compact
              detalle=""
              seleccionadoId={seleccionadoId}
              onIr={onIr}
              onEditar={onEditar}
              onEliminar={onEliminar}
              onHover={onHover}
              marcas={marcas}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function LugarRow({
  lugar: l,
  compact = false,
  detalle,
  seleccionadoId,
  as,
  onIr,
  onEditar,
  onEliminar,
  onHover,
  onExpandir,
  expandido,
  marcas,
  version,
}: Readonly<{
  marcas?: MarcasLista;
  version?: string | null;
  lugar: Lugar;
  compact?: boolean;
  detalle: string;
  seleccionadoId: string | null;
  as?: "li" | "div";
  onIr: (l: Lugar) => void;
  /** Sin permiso de edición no vienen: la fila no tiene menú. */
  onEditar?: (l: Lugar) => void;
  onEliminar?: (l: Lugar) => void;
  onHover?: (placeId: string | null) => void;
  onExpandir?: () => void;
  expandido?: boolean;
}>) {
  const ir = () => onIr(l);
  const editar = onEditar && (() => onEditar(l));
  const eliminar = onEliminar && (() => onEliminar(l));
  const color = colorDeLugar(l);
  const marcarHover = () => onHover?.(l.place_id);
  const soltarHover = () => onHover?.(null);
  return (
    <ListCardRow
      compact={compact}
      as={as}
      onExpandir={onExpandir}
      expandido={expandido}
      icono={
        compact ? undefined : (
          <PlaceIcon
            id={iconoDeLugar(l)}
            className="h-4 w-4 flex-none"
            style={{ color }}
          />
        )
      }
      nombre={l.name}
      detalle={detalle}
      seleccionado={seleccionadoId === l.place_id}
      onIr={ir}
      onEditar={editar}
      onEliminar={eliminar}
      onHoverStart={marcarHover}
      onHoverEnd={soltarHover}
      marca={marcaDe(marcas, l.place_id)}
      extras={<VersionBadge version={version} className="mr-1" />}
    />
  );
}
