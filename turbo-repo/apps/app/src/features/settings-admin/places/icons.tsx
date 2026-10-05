"use client";

import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineCube,
  HiOutlineFlag,
  HiOutlineHome,
  HiOutlineLightningBolt,
  HiOutlineLocationMarker,
  HiOutlineOfficeBuilding,
  HiOutlineShieldCheck,
  HiOutlineShoppingCart,
  HiOutlineStar,
  HiOutlineSwitchHorizontal,
  HiOutlineTruck,
  HiOutlineUserGroup,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";

export const ICONOS: { id: string; label: string; Icon: IconType }[] = [
  { id: "pin", label: "Ubicación", Icon: HiOutlineLocationMarker },
  { id: "edificio", label: "Edificio", Icon: HiOutlineOfficeBuilding },
  { id: "bodega", label: "Bodega", Icon: HiOutlineCube },
  { id: "casa", label: "Casa", Icon: HiOutlineHome },
  { id: "camion", label: "Camión", Icon: HiOutlineTruck },
  { id: "comercio", label: "Comercio", Icon: HiOutlineShoppingCart },
  {
    id: "energia",
    label: "Energía / combustible",
    Icon: HiOutlineLightningBolt,
  },
  { id: "control", label: "Control / seguridad", Icon: HiOutlineShieldCheck },
  { id: "personas", label: "Personas", Icon: HiOutlineUserGroup },
  { id: "bandera", label: "Hito", Icon: HiOutlineFlag },
  { id: "estrella", label: "Destacado", Icon: HiOutlineStar },
  { id: "ruta", label: "Ruta", Icon: HiOutlineSwitchHorizontal },
];

export function PlaceIcon({
  id,
  fallback = "pin",
  className,
  style,
}: {
  id: string | null | undefined;
  fallback?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const def =
    ICONOS.find((i) => i.id === id) ??
    ICONOS.find((i) => i.id === fallback) ??
    ICONOS[0]!;
  return <def.Icon className={className} style={style} aria-hidden />;
}

/** Botón cuadrado con el icono actual; al hacer clic abre la grilla para elegir otro. */
export function IconPicker({
  value,
  fallback,
  accentCls,
  onChange,
}: {
  value: string;
  fallback: string;
  accentCls: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const elegir = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        aria-label="Elegir icono"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={twMerge(
          "flex h-[34px] w-[34px] items-center justify-center rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700/60 dark:hover:bg-gray-700",
          accentCls
        )}
      >
        <PlaceIcon id={value} fallback={fallback} className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 grid w-max grid-cols-6 gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        >
          {ICONOS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={(value || fallback) === id}
              title={label}
              aria-label={label}
              onClick={() => elegir(id)}
              className={twMerge(
                "flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                (value || fallback) === id &&
                  "bg-gray-100 ring-1 ring-gray-300 dark:bg-gray-700 dark:ring-gray-500",
                (value || fallback) === id && accentCls
              )}
            >
              <Icon className="h-4.5 w-4.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
