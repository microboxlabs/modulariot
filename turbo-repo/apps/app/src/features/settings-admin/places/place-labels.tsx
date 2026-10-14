"use client";

// Icono + nombre de cada lugar sobre el mapa. Las formas se muestran
// siempre; los nombres de interiores se clústerizan en el padre.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Marker, useMap, type MapRef } from "react-map-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import { twMerge } from "tailwind-merge";
import { PlaceIcon } from "./icons";
import {
  TOLERANCIA_ARRASTRE,
  centroide,
  frenar,
  type ClicMarker,
} from "./map-handles";
import { puntoBorde } from "./geofence-editor";
import { parentPlaceId } from "./inner-geofences";
import { radioLugarM } from "./geofence-lod";
import {
  colorDeLugar,
  iconoDeLugar,
  type LatLon,
  type Lugar,
} from "./places.types";

const COLOR_DEF = "#1C64F2";

/** Geometría mínima para anclar y clústerizar una etiqueta. */
export function geomEtiqueta(g: {
  geom: "circle" | "polygon";
  vertices: LatLon[];
  lat: number | null;
  lon: number | null;
  radius_m: number;
}): Pick<Lugar, "polygon" | "center" | "radius_m"> {
  return {
    polygon: g.geom === "polygon" ? g.vertices : null,
    center: g.lat != null && g.lon != null ? [g.lat, g.lon] : null,
    radius_m: g.radius_m,
  };
}

/** Punto donde va la etiqueta: centroide del polígono o centro del círculo. */
export function anclaLugar(
  l: Pick<Lugar, "polygon" | "center">
): LatLon | null {
  if (l.polygon && l.polygon.length >= 3) return centroide(l.polygon);
  return l.center ?? l.polygon?.[0] ?? null;
}

/** Centroide de un Feature ya pintado (mismo ancla que la forma en el mapa). */
export function anclaDeFeature(f: Feature): LatLon | null {
  const g = f.geometry;
  if (g.type === "Point") {
    const [lon, lat] = g.coordinates;
    if (lat == null || lon == null) return null;
    return [lat, lon];
  }
  if (g.type === "Polygon") {
    const ring = g.coordinates[0];
    if (!ring || ring.length < 3) return null;
    const verts: LatLon[] = [];
    for (const c of ring) {
      if (c[0] == null || c[1] == null) continue;
      verts.push([c[1], c[0]]);
    }
    return verts.length >= 3 ? centroide(verts) : null;
  }
  return null;
}

/** Nombres de las geocercas pintadas (propias + vista previa). */
export function itemsNombresMapa(
  fcPropios: FeatureCollection,
  prevLugarFC: FeatureCollection,
  lugares: Lugar[]
): ItemNombre[] {
  return [
    ...itemsDesdeFC(fcPropios, lugares),
    ...itemsDesdeFC(prevLugarFC, lugares),
  ];
}

/** Chips a partir de las geocercas que el mapa ya está dibujando. */
export function itemsDesdeFC(
  fc: FeatureCollection,
  lugares: Lugar[] = []
): ItemNombre[] {
  const items: ItemNombre[] = [];
  for (const f of fc.features) {
    const p = anclaDeFeature(f);
    if (!p) continue;
    const props = f.properties ?? {};
    const inner = Boolean(props.inner);
    const name =
      String(props.name ?? "").trim() || (inner ? "Interior" : "Lugar");
    const id = String(
      props.place_id ?? `${inner ? "inner" : "padre"}-${items.length}`
    );
    const lugar = lugares.find((l) => l.place_id === id);
    const radioProp = Number(props.radius_m);
    const parentId = inner
      ? String(props.parent_id ?? "") ||
        (lugar ? parentPlaceId(lugar) : "") ||
        null
      : null;
    items.push({
      id,
      name,
      color: String(props.color ?? COLOR_DEF),
      icon: String(props.icon ?? ""),
      ancla: p,
      inner,
      parentId,
      radio_m:
        Number.isFinite(radioProp) && radioProp > 0
          ? radioProp
          : lugar
            ? radioLugarM(lugar)
            : 250,
      lugar,
    });
  }
  return items;
}

/** Punto al norte, sobre el borde, para poner el nombre fuera de la geocerca. */
export function anclaFueraLugar(
  l: Pick<Lugar, "polygon" | "center" | "radius_m">
): LatLon | null {
  if (l.polygon && l.polygon.length >= 3) {
    let norte = l.polygon[0]!;
    for (const p of l.polygon) {
      if (p[0] > norte[0]) norte = p;
    }
    return norte;
  }
  if (l.center && l.radius_m) {
    return puntoBorde(l.center, l.radius_m, Math.PI / 2);
  }
  return anclaLugar(l);
}

/** Punto GeoJSON en el centroide, para dibujar el nombre sobre el mapa. */
export function puntoEtiqueta(
  p: LatLon | null,
  name: string,
  color: string,
  id: string,
  inner = false
): Feature<Point> | null {
  if (!p) return null;
  const n = name.trim() || (inner ? "Interior" : "Lugar");
  return {
    type: "Feature",
    properties: { name: n, color, place_id: id, inner },
    geometry: { type: "Point", coordinates: [p[1], p[0]] },
  };
}

/** Puntos de nombre que Mapbox pinta en el mismo canvas que las geocercas. */
export function fcNombresMapa(items: ItemNombre[]): FeatureCollection<Point> {
  return fcEtiquetas(
    items.map((i) => {
      const esInner =
        i.inner ?? (i.lugar ? Boolean(parentPlaceId(i.lugar)) : false);
      return puntoEtiqueta(i.ancla, i.name, i.color, i.id, esInner);
    })
  );
}

export function fcEtiquetas(
  features: (Feature<Point> | null)[]
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: features.filter((f): f is Feature<Point> => f != null),
  };
}

export type ItemNombre = {
  id: string;
  name: string;
  color: string;
  icon: string;
  ancla: LatLon;
  inner?: boolean;
  parentId?: string | null;
  radio_m?: number;
  vistaPrevia?: boolean;
  lugar?: Lugar;
};

export function itemsEtiquetaLugares(
  lugares: Lugar[],
  ocultarId: string | null
): ItemNombre[] {
  const items: ItemNombre[] = [];
  for (const l of lugares) {
    if (l.place_id === ocultarId) continue;
    const p = anclaLugar(l);
    if (!p) continue;
    const inner = Boolean(parentPlaceId(l));
    items.push({
      id: l.place_id,
      name: l.name.trim() || "Lugar",
      color: colorDeLugar(l, COLOR_DEF),
      icon: iconoDeLugar(l) ?? "",
      ancla: p,
      inner,
      parentId: inner ? parentPlaceId(l) : null,
      radio_m: radioLugarM(l),
      lugar: l,
    });
  }
  return items;
}

export function posicionEtiquetaPx(
  project: (lngLat: [number, number]) => { x: number; y: number },
  ancla: LatLon
): { x: number; y: number } {
  return project([ancla[1], ancla[0]]);
}

function pegarEtiqueta(
  el: HTMLDivElement,
  map: MapRef,
  ancla: LatLon,
  inner: boolean
) {
  const m = map.getMap?.() ?? map;
  const p = m.project([ancla[1], ancla[0]]);
  // El padre se sube un poco para no quedar bajo un interior en el mismo centro.
  const dy = inner ? 0 : -22;
  el.style.transform = `translate(${p.x}px, ${p.y + dy}px) translate(-50%, -50%)`;
}

function NameChip({
  map,
  item,
  interactivo,
  onSelect,
}: {
  map: MapRef;
  item: ItemNombre;
  interactivo: boolean;
  onSelect?: (l: Lugar) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lat = item.ancla[0];
  const lon = item.ancla[1];
  const inner = Boolean(item.inner);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => pegarEtiqueta(el, map, [lat, lon], inner);
    sync();
    const m = map.getMap?.();
    if (!m) return undefined;
    m.on("render", sync);
    return () => {
      m.off("render", sync);
    };
  }, [map, lat, lon, inner]);

  const clic = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (interactivo && item.lugar && onSelect) onSelect(item.lugar);
  };

  return (
    <div
      ref={ref}
      data-geofence-role={inner ? "hijo" : "padre"}
      className="pointer-events-none absolute top-0 left-0"
      style={{ zIndex: inner ? 1 : 2 }}
      onClick={clic}
    >
      <PlaceLabel
        icon={item.icon}
        name={item.name}
        color={item.color}
        conNombre
        vistaPrevia={item.vistaPrevia}
      />
    </div>
  );
}

/** Nombres encima del mapa (el canvas de deck.gl tapa los Marker nativos). */
export function GeofenceNameOverlay({
  items,
  interactivo,
  onSelect,
}: {
  items: ItemNombre[];
  interactivo: boolean;
  onSelect?: (l: Lugar) => void;
}) {
  const { current: map } = useMap();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const m = map?.getMap?.();
    if (!m) return undefined;
    const take = () => {
      const el = m.getContainer();
      // El wrapper del mapa (fuera de deck.gl), no el canvas de Mapbox.
      setHost(el?.parentElement ?? el);
    };
    take();
    m.on("load", take);
    return () => {
      m.off("load", take);
    };
  }, [map]);
  if (!map || !host || items.length === 0) return null;
  const ordenados = [...items].sort((a, b) => {
    const ap = a.inner ? 0 : 1;
    const bp = b.inner ? 0 : 1;
    return ap - bp;
  });
  return createPortal(
    <div
      data-testid="geofence-names"
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 25 }}
    >
      {ordenados.map((item) => (
        <NameChip
          key={item.id}
          map={map}
          item={item}
          interactivo={interactivo}
          onSelect={onSelect}
        />
      ))}
    </div>,
    host
  );
}

/** Zoom actual del mapa, en estado local (etiquetas y clúster de geocercas). */
function zoomDelMapa(
  map:
    | {
        getMap?: () => { getZoom: () => number } | undefined;
        getZoom?: () => number;
      }
    | undefined
): number {
  const raw = map?.getMap?.()?.getZoom?.() ?? map?.getZoom?.();
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.round(raw * 10) / 10;
}

/** Sube los Marker de nombres por encima del canvas de deck.gl. */
export function usePlacesLabelStack() {
  const { current: map } = useMap();
  useEffect(() => {
    const m = map?.getMap?.();
    if (!m) return undefined;
    const apply = () => m.getContainer()?.classList.add("miot-places-labels");
    apply();
    m.on("load", apply);
    return () => {
      m.off("load", apply);
      m.getContainer()?.classList.remove("miot-places-labels");
    };
  }, [map]);
}

export function useZoom(): number {
  const { current: map } = useMap();
  const [zoom, setZoom] = useState(() => zoomDelMapa(map));
  useEffect(() => {
    const m = map?.getMap?.();
    if (!m || typeof m.getZoom !== "function") return undefined;
    const alZoom = () => {
      const z = zoomDelMapa(map);
      setZoom((prev) => (prev === z ? prev : z));
    };
    alZoom();
    m.on("zoom", alZoom);
    m.on("zoomend", alZoom);
    return () => {
      m.off("zoom", alZoom);
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
        "flex max-w-[160px] items-center gap-1 rounded-full border border-gray-700 bg-gray-800/95 py-0.5 pr-2 pl-1 text-xs font-medium text-white shadow",
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

  // Hijos primero: el nombre del padre queda encima cuando coinciden centros.
  const ordenados = [...lugares].sort((a, b) => {
    const ap = parentPlaceId(a) ? 0 : 1;
    const bp = parentPlaceId(b) ? 0 : 1;
    return ap - bp;
  });

  return (
    <>
      {ordenados.map((l) => {
        if (l.place_id === ocultarId) return null;
        const p = anclaLugar(l);
        if (!p) return null;
        const esHijo = Boolean(parentPlaceId(l));
        return (
          <Marker
            key={l.place_id}
            longitude={p[1]}
            latitude={p[0]}
            anchor="center"
            offset={[0, 0]}
            style={{
              pointerEvents: interactivo ? "auto" : "none",
              zIndex: esHijo ? 2 : 6,
            }}
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
                name={l.name.trim() || "Lugar"}
                color={colorDeLugar(l, COLOR_DEF)}
                conNombre
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
  encima = false,
}: {
  ancla: LatLon | null;
  icon: string;
  name: string;
  color: string;
  encima?: boolean;
}) {
  if (!ancla) return null;
  return (
    <Marker
      longitude={ancla[1]}
      latitude={ancla[0]}
      anchor="center"
      offset={[0, 0]}
      style={{ pointerEvents: "none", zIndex: encima ? 6 : 2 }}
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
