"use client";

// Control debug del permiso "Editor de lugares": según los roles del
// usuario, o forzado activo / inactivo para ver cómo queda la vista. Se
// monta solo con DEBUG_PERMISO_LUGARES (ver places-permission).
import { HiOutlineBeaker } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  useEstadoPermisoLugares,
  type ForzadoPermiso,
} from "../profiles/places-permission";

const OPCIONES: { valor: ForzadoPermiso; clave: "real" | "on" | "off" }[] = [
  { valor: "real", clave: "real" },
  { valor: "activo", clave: "on" },
  { valor: "inactivo", clave: "off" },
];

function OpcionForzado({
  etiqueta,
  elegida,
  onElegir,
}: Readonly<{ etiqueta: string; elegida: boolean; onElegir: () => void }>) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      onClick={onElegir}
      className={twMerge(
        "flex-1 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
        elegida
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      )}
    >
      {etiqueta}
    </button>
  );
}

export default function PlacesPermissionDebug({
  dict,
}: Readonly<{ dict: I18nRecord }>) {
  const { activo, real, forzado, setForzado } = useEstadoPermisoLugares();
  const t = (k: string) =>
    tr(`geographic_view.places_permission_debug.${k}`, dict);
  return (
    <section
      aria-label={t("title")}
      className="pointer-events-auto w-64 rounded-lg border border-dashed border-amber-300 bg-white/95 p-2 shadow-md backdrop-blur dark:border-amber-700 dark:bg-gray-800/95"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1 text-[11px] font-semibold text-gray-900 dark:text-white">
          <HiOutlineBeaker className="h-3.5 w-3.5 text-amber-500" />
          {t("title")}
        </h2>
        <span
          className={twMerge(
            "rounded-full px-1.5 text-[10px] font-semibold",
            activo
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          )}
        >
          {activo ? t("active") : t("inactive")}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={t("title")}
        className="mt-1.5 flex gap-0.5 rounded-lg bg-gray-50 p-0.5 dark:bg-gray-900/60"
      >
        {OPCIONES.map((o) => (
          <OpcionForzado
            key={o.valor}
            etiqueta={t(o.clave)}
            elegida={forzado === o.valor}
            onElegir={() => setForzado(o.valor)}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] leading-tight text-gray-500 dark:text-gray-400">
        {real ? t("granted") : t("denied")} · {t("hint")}
      </p>
    </section>
  );
}
