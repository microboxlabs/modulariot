"use client";

// F3 · Fuentes de datos (doc rector §8) — el activo contado POR FUENTE:
// qué entrega datos, desde cuándo, con qué calidad. v1 modela las dos
// fuentes reales del DTO de telemetría (fn_dx_senal_detalle): el GPS
// (pulsos de posición) y el bus CAN/ECU (métricas de motor). No inventa
// fuentes sin datos; si mañana llegan dashcam/BLE, son tarjetas nuevas.
import { useState } from "react";
import {
  HiOutlineSignal, HiOutlineCpuChip, HiOutlineChevronDown, HiOutlineChevronUp,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { useFleetTruckTelemetry } from "../../hooks/use-fleet-truck-telemetry";
import type { TruckTelemetryDetail } from "../../types/truck-telemetry.types";

type EstadoFuente = "online" | "rezagado" | "offline";

const CHIP: Record<EstadoFuente, { l: string; cls: string }> = {
  online: { l: "Online", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  rezagado: { l: "Rezagado", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  offline: { l: "Sin señal", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" },
};

const METRICA_LABEL: Record<string, { l: string; u: string }> = {
  vehicle_speed_kph: { l: "Velocidad", u: "km/h" },
  odometer_km: { l: "Odómetro", u: "km" },
  engine_rpm: { l: "RPM motor", u: "rpm" },
  fuel_level_pct: { l: "Combustible", u: "%" },
  coolant_temp_c: { l: "T° refrigerante", u: "°C" },
  battery_voltage_v: { l: "Batería", u: "V" },
  engine_load_pct: { l: "Carga motor", u: "%" },
  throttle_pos_pct: { l: "Acelerador", u: "%" },
  engine_runtime_h: { l: "Horas motor", u: "h" },
};

function TarjetaFuente({ icono: Icono, nombre, proveedor, estado, resumen, detalle }: {
  icono: IconType; nombre: string; proveedor?: string | null;
  estado: EstadoFuente; resumen: string; detalle?: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  const chip = CHIP[estado];
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              onClick={() => detalle && setAbierta(!abierta)}>
        <span className={`flex items-center justify-center w-9 h-9 rounded-lg flex-none ${
          estado === "online" ? "bg-green-50 dark:bg-green-900/20"
          : estado === "rezagado" ? "bg-yellow-50 dark:bg-yellow-900/20"
          : "bg-gray-100 dark:bg-gray-700"}`}>
          <Icono className={`w-5 h-5 ${
            estado === "online" ? "text-green-600 dark:text-green-400"
            : estado === "rezagado" ? "text-yellow-600 dark:text-yellow-400"
            : "text-gray-400"}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{nombre}</span>
            {proveedor && <span className="text-xs text-gray-500">· {proveedor}</span>}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{resumen}</span>
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium flex-none ${chip.cls}`}>
          {chip.l}
        </span>
        {detalle && (abierta
          ? <HiOutlineChevronUp className="w-4 h-4 text-gray-400 flex-none" />
          : <HiOutlineChevronDown className="w-4 h-4 text-gray-400 flex-none" />)}
      </button>
      {abierta && detalle && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700/60">
          {detalle}
        </div>
      )}
    </div>
  );
}

const Dato = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between gap-3 py-1 text-sm border-b border-gray-100 dark:border-gray-700/60 last:border-0">
    <span className="text-gray-500 dark:text-gray-400">{k}</span>
    <span className="font-medium text-gray-900 dark:text-white text-right">{v}</span>
  </div>
);

function estadoGps(t: TruckTelemetryDetail | null): EstadoFuente {
  if (!t || t.signal.freshness === "SIN_SENAL") return "offline";
  return t.signal.freshness === "ACTIVO" ? "online" : "rezagado";
}

/** Contenido del panel Fuentes de datos (se monta dentro de un Panel del bento). */
export function FuentesDatos({ plate }: { plate: string }) {
  const { telemetry: t, isLoading } = useFleetTruckTelemetry(plate);
  if (isLoading) return <div className="text-sm text-gray-500 py-2">Cargando fuentes…</div>;

  const gps = estadoGps(t);
  const capacidades = Object.entries(t?.capabilities ?? {});
  const can: EstadoFuente = capacidades.length
    ? (gps === "offline" ? "rezagado" : "online") : "offline";

  return (
    <div className="flex flex-col gap-2">
      <TarjetaFuente icono={HiOutlineSignal} nombre="GPS" proveedor={t?.gps.provider}
        estado={gps}
        resumen={t?.signal.last_at
          ? `última señal ${formatDateString(t.signal.last_at)} · ${Math.round(t.signal.signals_per_day)} señales/día`
          : "sin señales en los últimos 7 días"}
        detalle={t ? (
          <div>
            <Dato k="Salud GPS" v={t.gps.health} />
            <Dato k="Estabilidad" v={t.signal.stability_pct != null ? `${t.signal.stability_pct}%` : "—"} />
            <Dato k="Señales últimos 7 días" v={String(t.signal.total_last_7d)} />
            <Dato k="Pulsos por minuto" v={t.signal.pulses_per_minute != null ? String(t.signal.pulses_per_minute) : "—"} />
            <Dato k="Horas sin señal" v={t.signal.hours_since_last != null ? `${Math.round(t.signal.hours_since_last)} h` : "—"} />
            {t.location && <Dato k="Última ubicación" v={t.location} />}
          </div>
        ) : undefined} />

      <TarjetaFuente icono={HiOutlineCpuChip} nombre="Bus CAN / ECU"
        proveedor={t?.gps.provider}
        estado={can}
        resumen={capacidades.length
          ? `${capacidades.length} ${capacidades.length === 1 ? "métrica reportando" : "métricas reportando"} · score telemetría ${t?.score.telemetry ?? "—"}`
          : "el dispositivo no reporta métricas de motor"}
        detalle={capacidades.length ? (
          <div>
            {capacidades.map(([k, v]) => {
              const m = METRICA_LABEL[k];
              return <Dato key={k} k={m?.l ?? k}
                v={`${typeof v === "number" ? v.toLocaleString("es-CL") : v} ${m?.u ?? ""}`} />;
            })}
          </div>
        ) : undefined} />

      <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-1">
        Las fuentes nuevas del activo (dashcam, sensores BLE, gateway) aparecerán
        aquí cuando entreguen datos.
      </p>
    </div>
  );
}
