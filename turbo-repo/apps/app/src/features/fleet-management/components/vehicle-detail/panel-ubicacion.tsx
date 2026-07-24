"use client";

// Visualización geoespacial BÁSICA del SuperProfile (doc rector §1/§4:
// "ubicación actual"): mini-mapa con la última posición conocida.
// Camión: su propia posición (ya viaja en el Vehicle). Conductor: la
// posición del camión asignado — es su proxy operacional. Reutiliza
// MapVisualization + PinLayer (mismo motor del popover de última señal).
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { MapRef } from "react-map-gl";
import { HiOutlineMapPin } from "react-icons/hi2";
import MapVisualization from "@/features/map-visualization/map-visualization";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

function MiniMapa({ latitude, longitude }: { latitude: number; longitude: number }) {
  const mapRef = useRef<MapRef | null>(null);
  const [cargado, setCargado] = useState(false);
  const layers = useMemo(() => [
    new PinLayer({
      id: "superprofile-ubicacion-pin",
      data: [{ assetid: "ubicacion", latitude, longitude, heading: 0, speed: 0,
        location: "", timestamp: new Date().toISOString() }],
    }),
  ], [latitude, longitude]);
  useEffect(() => {
    if (cargado && mapRef.current) {
      mapRef.current.flyTo({ center: [longitude, latitude], zoom: 13, duration: 400 });
    }
  }, [latitude, longitude, cargado]);
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 h-[240px]">
      <MapVisualization mapStyle="satellite" layers={layers} mapRef={mapRef}
        onZoomChange={() => setCargado(true)} />
    </div>
  );
}

function CardUbicacion({ lat, lon, etiqueta, timestamp }: {
  lat: number | null; lon: number | null;
  etiqueta?: string | null; timestamp?: string | null;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
      <div className="flex items-center gap-2.5 px-3.5 py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex-none">
          <HiOutlineMapPin className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Ubicación</h3>
        <span className="text-xs text-gray-500 truncate max-w-[45%]">
          {etiqueta ?? (timestamp ? `última señal ${formatDateString(timestamp)}` : "")}
        </span>
        {lat != null && lon != null && (
          <a className="text-xs text-blue-600 hover:underline whitespace-nowrap"
             href={`https://www.google.com/maps?q=${lat},${lon}`}
             target="_blank" rel="noopener noreferrer">
            Google Maps →
          </a>
        )}
      </div>
      <div className="p-3.5">
        {lat != null && lon != null ? (
          <MiniMapa latitude={lat} longitude={lon} />
        ) : (
          <div className="h-[240px] rounded-lg border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-sm text-gray-500">
            Sin posición registrada — aparece con la primera señal GPS.
          </div>
        )}
      </div>
    </section>
  );
}

/** Ubicación del camión: posición que ya viaja en el Vehicle del gestor. */
export function PanelUbicacionCamion({ latitude, longitude, lastSignal, etiqueta }: {
  latitude?: number; longitude?: number; lastSignal?: string; etiqueta?: string | null;
}) {
  return (
    <CardUbicacion lat={latitude ?? null} lon={longitude ?? null}
      etiqueta={etiqueta} timestamp={lastSignal ?? null} />
  );
}

type TruckJson = {
  latestMetrics?: {
    latitude?: number; longitude?: number; timestamp?: string;
    location_label?: string;
  };
};

/** Ubicación del conductor = última posición de su camión asignado. */
export function PanelUbicacionConductor({ patente }: { patente?: string | null }) {
  const { data } = useSWR<TruckJson>(
    patente ? `/app/api/fleet/trucks/${encodeURIComponent(patente)}` : null, fetcher);
  const m = data?.latestMetrics;
  if (!patente) {
    return <CardUbicacion lat={null} lon={null}
      etiqueta="sin camión asignado — la ubicación sigue al camión" />;
  }
  return (
    <CardUbicacion
      lat={typeof m?.latitude === "number" ? m.latitude : null}
      lon={typeof m?.longitude === "number" ? m.longitude : null}
      etiqueta={m?.location_label ? `${patente} · ${m.location_label}` : `camión ${patente}`}
      timestamp={typeof m?.timestamp === "string" ? m.timestamp : null} />
  );
}
