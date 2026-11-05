"use client";

// Handles arrastrables sobre el mapa para editar la geocerca del formulario:
// círculo (centro + borde = radio), polígono (vértices + mover todo) y
// puntos de trayecto.
import { useState, type Dispatch, type SetStateAction } from "react";
import { Marker, type MarkerDragEvent } from "react-map-gl";
import type { FormLugar, LatLon, PolyBase } from "../places.types";
import {
  TOLERANCIA_ARRASTRE,
  aLatLon,
  frenar,
  handleBorde,
  handleCentro,
} from "../map/map-handles";
import PolygonHandles from "./polygon-editor";

export const RADIO_MIN = 1;
/** Techo de seguridad (~1000 km); el input no está limitado a 5 km. */
export const RADIO_MAX = 1_000_000;
export const INNER_RADIO_MIN = 1;
export const INNER_RADIO_MAX = 1_000_000;
export const INNER_RADIO_DEFAULT = 40;
export const RECT_MIN = 1;
export const RECT_MAX = 1_000_000;
export const INNER_RECT_W_DEF = 80;
export const INNER_RECT_H_DEF = 50;

const M_POR_GRADO = 111_320;

/** Distancia en metros entre dos puntos [lat, lon] (haversine). */
export function distanciaM([lat1, lon1]: LatLon, [lat2, lon2]: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

// Desplazamiento local en metros (x = este, y = norte). Es la misma
// aproximación plana con que se dibuja el círculo, así el handle cae
// exactamente sobre el borde dibujado.
function offsetM([lat0, lon0]: LatLon, [lat, lon]: LatLon): [number, number] {
  const cos = Math.cos((lat0 * Math.PI) / 180);
  return [(lon - lon0) * M_POR_GRADO * cos, (lat - lat0) * M_POR_GRADO];
}

/** Radio en metros a partir de la posición del handle del borde, acotado y redondeado a 1 m. */
export function radioDesdeBorde(
  centro: LatLon,
  borde: LatLon,
  min = RADIO_MIN,
  max = RADIO_MAX
): number {
  const [x, y] = offsetM(centro, borde);
  const m = Math.round(Math.hypot(x, y));
  return Math.min(max, Math.max(min, m));
}

/** Ángulo (radianes, 0 = este, antihorario) del punto visto desde el centro. */
export function anguloDesde(centro: LatLon, punto: LatLon): number {
  const [x, y] = offsetM(centro, punto);
  return Math.atan2(y, x);
}

/** Punto del borde del círculo en el ángulo dado (por defecto, al este). */
export function puntoBorde(
  [lat, lon]: LatLon,
  radioM: number,
  angulo = 0
): LatLon {
  const cos = Math.cos((lat * Math.PI) / 180);
  return [
    lat + (radioM * Math.sin(angulo)) / M_POR_GRADO,
    lon + (radioM * Math.cos(angulo)) / (M_POR_GRADO * cos),
  ];
}

function offsetDesdeCentro(
  centro: LatLon,
  anchoM: number,
  altoM: number
): { lat: number; lon: number; dLat: number; dLon: number } {
  const [lat, lon] = centro;
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  return {
    lat,
    lon,
    dLat: altoM / 2 / M_POR_GRADO,
    dLon: anchoM / 2 / (M_POR_GRADO * cos),
  };
}

/** Cuatro vértices [NW, NE, SE, SW] de un rectángulo centrado en `centro`. */
export function rectanguloDesdeCentro(
  centro: LatLon,
  anchoM: number,
  altoM: number
): LatLon[] {
  const { lat, lon, dLat, dLon } = offsetDesdeCentro(centro, anchoM, altoM);
  return [
    [lat + dLat, lon - dLon],
    [lat + dLat, lon + dLon],
    [lat - dLat, lon + dLon],
    [lat - dLat, lon - dLon],
  ];
}

/** Tres vértices [cima, SE, SW] de un triángulo isósceles centrado en `centro`. */
export function trianguloDesdeCentro(
  centro: LatLon,
  anchoM: number,
  altoM: number
): LatLon[] {
  const { lat, lon, dLat, dLon } = offsetDesdeCentro(centro, anchoM, altoM);
  return [
    [lat + dLat, lon],
    [lat - dLat, lon + dLon],
    [lat - dLat, lon - dLon],
  ];
}

/** Alto de un equilátero cuya base es `anchoM`. */
export function altoEquilatero(anchoM: number): number {
  const h = Math.round((anchoM * Math.sqrt(3)) / 2);
  return Math.min(RECT_MAX, Math.max(RECT_MIN, h));
}

export function normalizarPolyBase(polyBase?: string | null): PolyBase {
  if (polyBase === "rect" || polyBase === "cuadro") return "rect";
  if (polyBase === "tri") return "tri";
  return "libre";
}

export function esRectVinculado(f: {
  polyBase?: string | null;
  rectVinculado?: boolean;
}): boolean {
  return f.rectVinculado === true || f.polyBase === "cuadro";
}

export function esPoligonoLibre(f: {
  geom: FormLugar["geom"];
  polyBase?: string | null;
}): boolean {
  return f.geom === "polygon" && normalizarPolyBase(f.polyBase) === "libre";
}

export type GeomKind = "circle" | "polygon" | "square" | "tri";

export function esFormaParametrica(kind: GeomKind): boolean {
  return kind === "square" || kind === "tri";
}

/** Alto de la forma base: vinculado sigue al ancho (equilátero si es triángulo). */
function altoVinculado(
  f: FormLugar,
  polyBase: ReturnType<typeof normalizarPolyBase>,
  rectVinculado: boolean
): number {
  if (!rectVinculado) return f.rect_h_m;
  return polyBase === "tri" ? altoEquilatero(f.rect_w_m) : f.rect_w_m;
}

/** Regenera el polígono si el formulario usa una forma base (rectángulo o triángulo). */
export function aplicarFormaBase(f: FormLugar): FormLugar {
  const polyBase = normalizarPolyBase(f.polyBase);
  const rectVinculado = esRectVinculado(f);
  const rect_h_m = altoVinculado(f, polyBase, rectVinculado);
  const next = { ...f, polyBase, rectVinculado, rect_h_m };
  if (esPoligonoLibre(next) || next.geom !== "polygon") return next;
  if (next.lat == null || next.lon == null) {
    return { ...next, vertices: [], cerrado: false };
  }
  const centro: LatLon = [next.lat, next.lon];
  return {
    ...next,
    vertices:
      polyBase === "tri"
        ? trianguloDesdeCentro(centro, next.rect_w_m, rect_h_m)
        : rectanguloDesdeCentro(centro, next.rect_w_m, rect_h_m),
    cerrado: true,
  };
}

export function geomKindDe(f: {
  geom: FormLugar["geom"];
  polyBase?: string | null;
  rectVinculado?: boolean;
}): GeomKind {
  if (f.geom === "circle") return "circle";
  const base = normalizarPolyBase(f.polyBase);
  if (base === "tri") return "tri";
  if (base === "rect") return "square";
  return "polygon";
}

function conCentroSiFalta(f: FormLugar): FormLugar {
  if (f.lat != null && f.lon != null) return f;
  if (f.vertices.length < 3) return f;
  const lat = f.vertices.reduce((s, v) => s + v[0], 0) / f.vertices.length;
  const lon = f.vertices.reduce((s, v) => s + v[1], 0) / f.vertices.length;
  return { ...f, lat, lon };
}

export function aplicarGeomKind(f: FormLugar, kind: GeomKind): FormLugar {
  if (geomKindDe(f) === kind) return f;
  if (kind === "circle") {
    return { ...f, geom: "circle", vertices: [], cerrado: false };
  }
  if (kind === "polygon") {
    if (f.geom === "polygon" && f.vertices.length >= 3) {
      return { ...f, polyBase: "libre" };
    }
    return {
      ...f,
      geom: "polygon",
      polyBase: "libre",
      cerrado: false,
      vertices: [],
    };
  }
  const base = conCentroSiFalta(f);
  return aplicarFormaBase({
    ...base,
    geom: "polygon",
    polyBase: kind === "tri" ? "tri" : "rect",
    rectVinculado: kind === "square" || kind === "tri",
  });
}

/** El próximo clic en el mapa fija el centro o agrega un vértice. */
export function mapaAgregaPunto(f: FormLugar): boolean {
  if (f.geom === "circle") return f.lat == null;
  if (!esPoligonoLibre(f)) return f.lat == null;
  return !f.cerrado;
}

function CircleHandles({
  form,
  setForm,
  radioMin = RADIO_MIN,
  radioMax = RADIO_MAX,
}: Readonly<{
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
  radioMin?: number;
  radioMax?: number;
}>) {
  // El handle del radio se queda en el ángulo al que se arrastró: si siempre
  // volviera al este, saltaría lejos del cursor en cada movimiento.
  const [angulo, setAngulo] = useState(0);
  if (form.lat == null || form.lon == null) return null;
  const centro: LatLon = [form.lat, form.lon];
  const borde = puntoBorde(centro, form.radius_m, angulo);

  const moverCentro = (e: MarkerDragEvent) => {
    const [lat, lon] = aLatLon(e);
    setForm((f) => ({ ...f, lat, lon }));
  };
  const cambiarRadio = (e: MarkerDragEvent) => {
    const p = aLatLon(e);
    const radius_m = radioDesdeBorde(centro, p, radioMin, radioMax);
    setAngulo(anguloDesde(centro, p));
    setForm((f) => ({ ...f, radius_m }));
  };

  return (
    <>
      <Marker
        longitude={centro[1]}
        latitude={centro[0]}
        draggable
        clickTolerance={TOLERANCIA_ARRASTRE}
        onDrag={moverCentro}
        onClick={frenar}
      >
        <span className={handleCentro} title="Arrastra para mover" />
      </Marker>
      <Marker
        longitude={borde[1]}
        latitude={borde[0]}
        draggable
        clickTolerance={TOLERANCIA_ARRASTRE}
        onDrag={cambiarRadio}
        onClick={frenar}
      >
        <span className="relative block">
          <span
            className={handleBorde}
            title="Arrastra para cambiar el radio"
          />
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-semibold text-blue-700 shadow dark:bg-gray-800/90 dark:text-blue-300">
            {form.radius_m} m
          </span>
        </span>
      </Marker>
    </>
  );
}

export function GeofenceHandles({
  form,
  setForm,
  radioMin,
  radioMax,
}: Readonly<{
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
  radioMin?: number;
  radioMax?: number;
}>) {
  return form.geom === "circle" ? (
    <CircleHandles
      form={form}
      setForm={setForm}
      radioMin={radioMin}
      radioMax={radioMax}
    />
  ) : (
    <PolygonHandles form={form} setForm={setForm} />
  );
}
