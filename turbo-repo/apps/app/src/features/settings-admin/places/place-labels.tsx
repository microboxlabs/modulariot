"use client";

// Icono + nombre de cada lugar sobre el mapa. Con poco zoom solo el icono,
// para no llenar el mapa de texto.
import { useEffect, useRef, useState } from "react";
import { Marker, useMap } from "react-map-gl";
import { twMerge } from "tailwind-merge";
import { PlaceIcon } from "./icons";
import {
  TOLERANCIA_ARRASTRE,
  centroide,
  frenar,
  type ClicMarker,
} from "./map-handles";
import { iconoDeLugar, type LatLon, type Lugar } from "./places.types";

/** Desde este zoom se muestra el nombre además del icono. */
export const ZOOM_NOMBRES = 12;
const COLOR_DEF = "#1C64F2";

/** Punto donde va la etiqueta: centroide del polígono o centro del círculo. */
export function anclaLugar(
  l: Pick<Lugar, "polygon" | "center">
): LatLon | null {
  if (l.polygon && l.polygon.length >= 3) return centroide(l.polygon);
  return l.center ?? l.polygon?.[0] ?? null;
}

/** Zoom actual del mapa, en estado local (solo re-renderiza las etiquetas). */
function useZoom(): number {
  const { current: map } = useMap();
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 0);
  useEffect(() => {
    const m = map?.getMap();
    if (!m) return;
    const alZoom = () => setZoom(m.getZoom());
    alZoom();
    m.on("zoomend", alZoom);
    return () => {
      m.off("zoomend", alZoom);
    };
  }, [map]);
  return zoom;
}

export function PlaceLabel({
  icon,
  name,
  color,
  conNombre,
  vistaPrevia = false,
}: {
  icon: string | null | undefined;
  name: string;
  color: string;
  conNombre: boolean;
  vistaPrevia?: boolean;
}) {
  if (!conNombre)
    return (
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-white shadow dark:border-gray-700 dark:bg-gray-800"
        title={name}
      >
        <PlaceIcon id={icon} className="h-3.5 w-3.5" style={{ color }} />
      </span>
    );
  return (
    <span
      className={twMerge(
        "flex max-w-[160px] items-center gap-1 rounded-full border border-gray-200 bg-white/95 py-0.5 pr-2 pl-1 text-xs font-medium text-gray-900 shadow dark:border-gray-700 dark:bg-gray-800/95 dark:text-white",
        vistaPrevia && "border-dashed border-blue-400"
      )}
    >
      <PlaceIcon id={icon} className="h-4 w-4 flex-none" style={{ color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export default function PlaceLabels({
  lugares,
  ocultarId,
  interactivo,
  onSelect,
}: {
  lugares: Lugar[];
  /** Lugar en edición: lo reemplaza la vista previa. */
  ocultarId: string | null;
  /** Solo en modo ver un clic abre el lugar; si no, los clics pasan al mapa. */
  interactivo: boolean;
  onSelect: (l: Lugar) => void;
}) {
  const conNombre = useZoom() >= ZOOM_NOMBRES;

  // Arrastrar el mapa empezando sobre una etiqueta termina en un click sobre
  // ella: solo abrir el lugar si el mouse casi no se movió.
  const presion = useRef<{ x: number; y: number } | null>(null);
  const clic = (l: Lugar, e: ClicMarker) => {
    frenar(e);
    const p = presion.current;
    presion.current = null;
    const { clientX: x, clientY: y } = e.originalEvent;
    if (p && Math.hypot(x - p.x, y - p.y) > TOLERANCIA_ARRASTRE) return;
    onSelect(l);
  };

  return (
    <>
      {lugares.map((l) => {
        const p = anclaLugar(l);
        if (!p || l.place_id === ocultarId) return null;
        return (
          <Marker
            key={l.place_id}
            longitude={p[1]}
            latitude={p[0]}
            anchor="center"
            style={{ pointerEvents: interactivo ? "auto" : "none" }}
            onClick={interactivo ? (e) => clic(l, e) : undefined}
          >
            <span
              className={interactivo ? "cursor-pointer" : undefined}
              onMouseDown={(e) =>
                (presion.current = { x: e.clientX, y: e.clientY })
              }
            >
              <PlaceLabel
                icon={iconoDeLugar(l)}
                name={l.name}
                color={l.color ?? COLOR_DEF}
                conNombre={conNombre}
              />
            </span>
          </Marker>
        );
      })}
    </>
  );
}

/** Etiqueta del lugar que se está creando/editando, bajo su centro. */
export function PlaceLabelPreview({
  ancla,
  icon,
  name,
  color,
}: {
  ancla: LatLon | null;
  icon: string;
  name: string;
  color: string;
}) {
  if (!ancla) return null;
  return (
    <Marker
      longitude={ancla[1]}
      latitude={ancla[0]}
      anchor="top"
      offset={[0, 14]}
      style={{ pointerEvents: "none" }}
    >
      <PlaceLabel
        icon={icon}
        name={name.trim() || "Nuevo lugar"}
        color={color}
        conNombre
        vistaPrevia
      />
    </Marker>
  );
}
