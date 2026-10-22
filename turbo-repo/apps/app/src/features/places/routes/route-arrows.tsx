"use client";

// Flechas de sentido sobre las líneas de los trayectos: un chevrón repetido a
// lo largo de la línea, girado con ella, que apunta de A hacia B (el orden de
// los puntos del camino).
import { useEffect } from "react";
import { Layer, useMap } from "react-map-gl";
import type { FilterSpecification } from "mapbox-gl";

export const IMAGEN_FLECHA = "flecha-ruta";
/** Píxeles entre flecha y flecha a lo largo de la línea. */
const ESPACIADO_PX = 80;
const LADO_CSS = 14;
const DPR = 2;

/** Chevrón blanco con borde azul oscuro, apuntando a la derecha (sentido). */
export function dibujarFlecha(): ImageData | null {
  const lado = LADO_CSS * DPR;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(DPR, DPR);
  ctx.beginPath();
  ctx.moveTo(4, 2.5);
  ctx.lineTo(10.5, 7);
  ctx.lineTo(4, 11.5);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1E3A8A";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.stroke();
  return ctx.getImageData(0, 0, lado, lado);
}

/**
 * Registra la imagen de la flecha en el mapa. Mapbox borra las imágenes
 * propias al cambiar de estilo: se vuelve a agregar cuando la pide.
 */
export function useFlechaRuta() {
  const { current: mapa } = useMap();
  useEffect(() => {
    const map = mapa?.getMap();
    if (!map) return;
    const agregar = () => {
      if (map.hasImage(IMAGEN_FLECHA)) return;
      const img = dibujarFlecha();
      if (img) map.addImage(IMAGEN_FLECHA, img, { pixelRatio: DPR });
    };
    const alFaltar = (e: { id: string }) => {
      if (e.id === IMAGEN_FLECHA) agregar();
    };
    agregar();
    map.on("styleimagemissing", alFaltar);
    return () => {
      map.off("styleimagemissing", alFaltar);
    };
  }, [mapa]);
}

/**
 * Capa de flechas sobre las líneas de la fuente en la que se monta.
 * `<Source>` le pasa su id como `source` a sus hijos directos: hay que
 * reenviarlo al `<Layer>`, que es el que lo necesita.
 */
export function FlechasRuta({
  id,
  filter,
  source,
}: Readonly<{
  id: string;
  filter?: FilterSpecification;
  source?: string;
}>) {
  return (
    <Layer
      id={id}
      type="symbol"
      {...(source ? { source } : {})}
      {...(filter ? { filter } : {})}
      layout={{
        "symbol-placement": "line",
        "symbol-spacing": ESPACIADO_PX,
        "icon-image": IMAGEN_FLECHA,
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        // sin esto Mapbox da vuelta los íconos "al revés" y la flecha mentiría
        "icon-keep-upright": false,
        "icon-rotation-alignment": "map",
      }}
    />
  );
}
