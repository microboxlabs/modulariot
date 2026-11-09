"use client";

import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import type { GeomKind } from "./geofence-editor";
import { usePlacesT, type ClaveLugares } from "../i18n/places-i18n";

function IconoCirculo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

function IconoPoligono() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4 L18 7 L20 16 L12 21 L4 14 Z" />
    </svg>
  );
}

function IconoCuadrado() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </svg>
  );
}

function IconoTriangulo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5 L20 19 L4 19 Z" />
    </svg>
  );
}

const OPCIONES: { value: GeomKind; label: ClaveLugares; icono: ReactNode }[] = [
  { value: "circle", label: "shapes.circle", icono: <IconoCirculo /> },
  { value: "polygon", label: "shapes.polygon", icono: <IconoPoligono /> },
  { value: "square", label: "shapes.square", icono: <IconoCuadrado /> },
  { value: "tri", label: "shapes.triangle", icono: <IconoTriangulo /> },
];

function GeomIconButton({
  value,
  label,
  icono,
  activo,
  compact,
  onChange,
}: Readonly<{
  value: GeomKind;
  label: string;
  icono: ReactNode;
  activo: boolean;
  compact: boolean;
  onChange: (value: GeomKind) => void;
}>) {
  const elegir = () => onChange(value);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={activo}
      title={label}
      onClick={elegir}
      className={twMerge(
        "relative z-10 flex flex-1 items-center justify-center text-gray-500 transition-colors duration-200 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white",
        compact ? "py-1.5" : "py-2",
        activo && "text-white hover:text-white dark:text-white"
      )}
    >
      {icono}
    </button>
  );
}

export default function GeomIconBar({
  value,
  onChange,
  compact = false,
}: Readonly<{
  value: GeomKind;
  onChange: (value: GeomKind) => void;
  compact?: boolean;
}>) {
  const t = usePlacesT();
  const i = Math.max(
    0,
    OPCIONES.findIndex((o) => o.value === value)
  );
  const n = OPCIONES.length;

  return (
    <fieldset
      aria-label={t("shapes.geofence_shape")}
      className="min-w-0 relative flex w-full overflow-hidden border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40"
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 z-[1] rounded-md bg-blue-600 transition-transform duration-300 ease-out"
        style={{
          width: `calc(${100 / n}% - 8px)`,
          transform: `translateX(calc(${i} * 100% + ${i * 8}px))`,
        }}
      />
      {OPCIONES.map((o) => (
        <GeomIconButton
          key={o.value}
          value={o.value}
          label={t(o.label)}
          icono={o.icono}
          activo={value === o.value}
          compact={compact}
          onChange={onChange}
        />
      ))}
    </fieldset>
  );
}
