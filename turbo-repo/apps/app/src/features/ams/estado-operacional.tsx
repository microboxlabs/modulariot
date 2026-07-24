"use client";

// Estado OPERACIONAL derivado del recurso — el "¿cómo está AHORA?" del
// SuperProfile (documento rector §4): se calcula desde señales que ya
// existen, ninguna nueva: maestro AMS (estado/acreditación), live_trip
// ("manda el viaje") y frescura de señal del detalle de telemetría.
// Precedencia: taller > en viaje > bloqueado > inactivo > sin señal > disponible
// (un camión EN VIAJE se muestra en viaje aunque esté no acreditado — la
// regla de la casa es que manda el viaje; el bloqueo aplica al asignar).
import useSWR from "swr";
import { useAmsRecord, type AmsTruck, type AmsDriver } from "./ficha-ams";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

export type EstadoOperacional = {
  clave: "taller" | "viaje" | "bloqueado" | "inactivo" | "sin_senal" | "disponible" | "sin_ficha";
  etiqueta: string;
  detalle?: string;
  cls: string;   // clases del chip (color solo por estado, doc rector)
};

const ESTILO: Record<EstadoOperacional["clave"], string> = {
  viaje: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  disponible: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  taller: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  bloqueado: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  inactivo: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  sin_senal: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  sin_ficha: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

/** Estado operacional vivo del recurso (camión por patente / colaborador). */
export function useEstadoOperacional(tipo: "TRUCK" | "DRIVER", matchId?: string, matchName?: string): {
  estado: EstadoOperacional; enViaje: boolean; tripId: string | null;
  rec: AmsTruck | AmsDriver | undefined;
} {
  const { rec, cargando } = useAmsRecord(tipo, matchId, matchName);
  // patente cuya señal/viaje importa: la propia (TRUCK) o la del camión asignado (DRIVER)
  const patente = tipo === "TRUCK"
    ? matchId
    : (rec as AmsDriver | undefined)?.camion?.patente;
  const { data: live } = useSWR<{ enViaje: boolean; tripId: string | null }>(
    patente ? `/app/api/fleet/trucks/${encodeURIComponent(patente)}/live` : null,
    fetcher, { dedupingInterval: 30000 });

  const enViaje = !!live?.enViaje;
  const tripId = live?.tripId ?? null;

  let clave: EstadoOperacional["clave"];
  let detalle: string | undefined;
  if (!rec && !cargando) {
    clave = "sin_ficha"; detalle = "sin ficha en el maestro";
  } else if (rec?.status === "maintenance") {
    clave = "taller";
  } else if (enViaje) {
    clave = "viaje"; detalle = tripId ? `viaje ${tripId}` : undefined;
  } else if (rec && !rec.acreditacion.acreditado) {
    clave = "bloqueado";
    detalle = "acreditación incompleta — no asignable";
  } else if (rec?.status === "inactive") {
    clave = "inactivo"; detalle = "fuera de planificación";
  } else {
    clave = "disponible";
  }

  const ETIQUETA: Record<EstadoOperacional["clave"], string> = {
    viaje: "En viaje", disponible: "Disponible", taller: "En taller",
    bloqueado: "Bloqueado", inactivo: "Inactivo", sin_senal: "Sin señal",
    sin_ficha: "Sin ficha",
  };
  return {
    estado: { clave, etiqueta: ETIQUETA[clave], detalle, cls: ESTILO[clave] },
    enViaje, tripId, rec,
  };
}

/** Chip del estado operacional para headers (grande, con detalle al lado). */
export function EstadoOperacionalChip({ estado }: { estado: EstadoOperacional }) {
  return (
    <span className="inline-flex items-center gap-2" title={estado.detalle}>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estado.cls}`}>
        {estado.etiqueta}
      </span>
      {estado.detalle && (
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:inline">
          {estado.detalle}
        </span>
      )}
    </span>
  );
}
