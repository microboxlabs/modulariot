"use client";

// Piezas comunes de los handles sobre el mapa (círculo, polígono, trayecto).
import type { MarkerDragEvent } from "react-map-gl";
import { CURSOR_PUNTO_CLS } from "./cursors";
import type { LatLon } from "./places.types";

export function centroide(pts: LatLon[]): LatLon {
  const n = pts.length || 1;
  const [sLat, sLon] = pts.reduce<LatLon>(
    ([a, b], [la, lo]) => [a + la, b + lo],
    [0, 0]
  );
  return [sLat / n, sLon / n];
}

export const aLatLon = (e: MarkerDragEvent): LatLon => [
  e.lngLat.lat,
  e.lngLat.lng,
];

export const handleCentro =
  "block h-4 w-4 cursor-move rounded-full border-2 border-blue-600 bg-white shadow-md";
export const handleBorde =
  "block h-3 w-3 cursor-grab rounded-full border-2 border-white bg-blue-600 shadow-md";
export const handleVertice = `block h-3 w-3 ${CURSOR_PUNTO_CLS} rounded-full border-2 border-white bg-blue-600 shadow`;
// primer vértice cuando ya se puede cerrar: más grande, con anillo
export const handleCierre = `block h-4 w-4 ${CURSOR_PUNTO_CLS} rounded-full border-2 border-white bg-blue-600 shadow ring-4 ring-blue-500/30`;

// Píxeles que el mouse puede moverse en un clic sin que cuente como arrastre.
// Con 0 (default de Mapbox) el temblor normal de un clic movía la forma.
export const TOLERANCIA_ARRASTRE = 5;

// Un clic sobre un handle no debe llegar al mapa (agregaría otro punto).
// Lo único que se usa del evento de clic de un Marker.
export type ClicMarker = { originalEvent: MouseEvent };
export const frenar = (e: ClicMarker) => e.originalEvent.stopPropagation();

// vértice con el menú abierto
export const handleSeleccionado = `block h-3.5 w-3.5 ${CURSOR_PUNTO_CLS} rounded-full border-2 border-white bg-blue-700 shadow ring-4 ring-blue-500/40`;
// punto medio de un lado: clic o arrastre inserta un vértice
export const handleMedio = `block h-2.5 w-2.5 ${CURSOR_PUNTO_CLS} rounded-full border-2 border-blue-600 bg-white/80 shadow-sm opacity-70 hover:scale-125 hover:opacity-100 transition-transform`;
