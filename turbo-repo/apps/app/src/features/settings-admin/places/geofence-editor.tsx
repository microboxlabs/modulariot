"use client";

// Handles arrastrables sobre el mapa para editar la geocerca del formulario:
// círculo (centro + borde = radio), polígono (vértices + mover todo) y
// puntos de trayecto.
import { useState, type Dispatch, type SetStateAction } from "react";
import { Marker, type MarkerDragEvent } from "react-map-gl";
import type { FormLugar, LatLon } from "./places.types";
import {
  TOLERANCIA_ARRASTRE,
  aLatLon,
  frenar,
  handleBorde,
  handleCentro,
} from "./map-handles";
import { CURSOR_PUNTO_CLS } from "./cursors";
import PolygonHandles from "./polygon-editor";
import { etiquetaPunto } from "./recorrido";

export const RADIO_MIN = 50;
export const RADIO_MAX = 5000;

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

/** Radio en metros a partir de la posición del handle del borde, acotado y redondeado a 10 m. */
export function radioDesdeBorde(centro: LatLon, borde: LatLon): number {
  const [x, y] = offsetM(centro, borde);
  const m = Math.round(Math.hypot(x, y) / 10) * 10;
  return Math.min(RADIO_MAX, Math.max(RADIO_MIN, m));
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

function CircleHandles({
  form,
  setForm,
}: {
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
}) {
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
    const radius_m = radioDesdeBorde(centro, p);
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
}: {
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
}) {
  return form.geom === "circle" ? (
    <CircleHandles form={form} setForm={setForm} />
  ) : (
    <PolygonHandles form={form} setForm={setForm} />
  );
}

export function RoutePointHandles({
  pts,
  onMove,
}: {
  pts: LatLon[];
  onMove: (i: number, p: LatLon) => void;
}) {
  return (
    <>
      {pts.map((p, i) => (
        <Marker
          key={i}
          longitude={p[1]}
          latitude={p[0]}
          draggable
          clickTolerance={TOLERANCIA_ARRASTRE}
          onDrag={(e) => onMove(i, aLatLon(e))}
          onClick={frenar}
        >
          <span
            className={`block h-3 w-3 ${CURSOR_PUNTO_CLS} rounded-full border-2 border-white bg-purple-600 shadow`}
            title="Arrastra para mover el punto"
          />
        </Marker>
      ))}
    </>
  );
}

function MarcaExtremo({
  punto,
  letra,
  colorCls,
}: {
  punto: LatLon | null;
  letra: string;
  colorCls: string;
}) {
  if (!punto) return null;
  return (
    <Marker
      longitude={punto[1]}
      latitude={punto[0]}
      anchor="center"
      style={{ pointerEvents: "none" }}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow ${colorCls}`}
      >
        {letra}
      </span>
    </Marker>
  );
}

/** Puntos del recorrido por dirección con el mismo distintivo que la lista. */
export function RouteEndpoints({ puntos }: { puntos: (LatLon | null)[] }) {
  return (
    <>
      {puntos.map((p, i) => {
        const { letra, colorCls } = etiquetaPunto(i, puntos.length);
        return (
          <MarcaExtremo key={i} punto={p} letra={letra} colorCls={colorCls} />
        );
      })}
    </>
  );
}
