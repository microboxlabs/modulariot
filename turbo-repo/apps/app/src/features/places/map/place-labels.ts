// Dónde va el badge con el nombre de cada geocerca (y de un trayecto) sobre
// el mapa: los datos que dibuja place-name-layer.
import type { Feature, FeatureCollection } from "geojson";
import { centroide } from "./map-handles";
import { parentPlaceId } from "../geofences/inner-geofences";
import { radioLugarM } from "./geofence-lod";
import type { LatLon, Lugar } from "../places.types";

const COLOR_DEF = "#1C64F2";

/** Punto donde va la etiqueta: centroide del polígono o centro del círculo. */
export function anclaLugar(
  l: Pick<Lugar, "polygon" | "center">
): LatLon | null {
  if (l.polygon && l.polygon.length >= 3) return centroide(l.polygon);
  return l.center ?? l.polygon?.[0] ?? null;
}

/** Vértices [lat, lon] de un anillo GeoJSON [lon, lat] (sin los incompletos). */
function verticesDeAnillo(ring: number[][]): LatLon[] {
  const verts: LatLon[] = [];
  for (const [lon, lat] of ring) {
    if (lon != null && lat != null) verts.push([lat, lon]);
  }
  return verts;
}

function anclaDePoligono(ring: number[][] | undefined): LatLon | null {
  if (!ring || ring.length < 3) return null;
  const verts = verticesDeAnillo(ring);
  return verts.length >= 3 ? centroide(verts) : null;
}

/** Un trayecto: el badge va en el vértice del medio de su camino. */
function anclaDeLinea(coords: number[][]): LatLon | null {
  const medio = coords[Math.floor(coords.length / 2)];
  if (medio?.[0] == null || medio[1] == null) return null;
  return [medio[1], medio[0]];
}

/** Centroide de un Feature ya pintado (mismo ancla que la forma en el mapa). */
export function anclaDeFeature(f: Feature): LatLon | null {
  const g = f.geometry;
  if (g.type === "Point") {
    const [lon, lat] = g.coordinates;
    if (lat == null || lon == null) return null;
    return [lat, lon];
  }
  if (g.type === "Polygon") return anclaDePoligono(g.coordinates[0]);
  if (g.type === "LineString") return anclaDeLinea(g.coordinates);
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

/** El padre de una interior: el de la forma o, si no, el del lugar. */
function padreDeInterior(
  parentProp: unknown,
  lugar: Lugar | undefined
): string | null {
  const desdeForma = typeof parentProp === "string" ? parentProp : "";
  return desdeForma || (lugar ? parentPlaceId(lugar) : null) || null;
}

/** Radio del badge: el de la forma, el del lugar o 250 m por defecto. */
function radioDeItem(radioProp: unknown, lugar: Lugar | undefined): number {
  const r = Number(radioProp);
  if (Number.isFinite(r) && r > 0) return r;
  return lugar ? radioLugarM(lugar) : 250;
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
    const parentId = inner ? padreDeInterior(props.parent_id, lugar) : null;
    items.push({
      id,
      name,
      color: String(props.color ?? COLOR_DEF),
      icon: String(props.icon ?? ""),
      ancla: p,
      inner,
      parentId,
      radio_m: radioDeItem(props.radius_m, lugar),
      lugar,
    });
  }
  return items;
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
  /** Importando: badge de lo guardado con que choca, debajo de la forma. */
  abajo?: boolean;
  /** El badge es de un trayecto (no de una geocerca). */
  trayectoId?: string;
};

/** Badges de los trayectos dibujados: con su nombre, en el medio del camino. */
export function itemsTrayectos(fcTray: FeatureCollection): ItemNombre[] {
  return itemsDesdeFC(fcTray).map((i) => ({ ...i, trayectoId: i.id }));
}
