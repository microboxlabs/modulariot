"use client";

import type { CSSProperties } from "react";
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
import { IconPickerDropdown } from "@/features/common/components/icon-picker-dropdown";
import {
  ICON_REGISTRY,
  type IconKey,
} from "@/features/common/components/icon-picker-dropdown/icon-registry";
import { useRegistryIcon } from "@/features/common/components/icon-picker-dropdown/use-registry-icon";

/** Ids viejos del picker de lugares → claves del registro del dashboard. */
export const LEGACY_A_REGISTRY: Record<string, string> = {
  pin: "hi2-outline-map-pin",
  edificio: "hi2-outline-building-office-2",
  bodega: "hi2-cube",
  casa: "hi2-home",
  camion: "hi2-truck",
  comercio: "hi2-shopping-cart",
  energia: "hi2-bolt",
  control: "hi2-shield-check",
  personas: "hi2-outline-user-group",
  bandera: "hi2-flag",
  estrella: "hi2-star",
  ruta: "tb-route",
};

const FALLBACK_REGISTRY = "hi2-outline-map-pin";

/** Iconos síncronos para ids viejos, mientras carga el registro. */
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

export function claveIcono(
  id: string | null | undefined,
  fallback = "pin"
): IconKey {
  const raw = id || fallback;
  if (raw in ICON_REGISTRY) return raw as IconKey;
  const mapped = LEGACY_A_REGISTRY[raw] ?? LEGACY_A_REGISTRY[fallback];
  if (mapped && mapped in ICON_REGISTRY) return mapped as IconKey;
  return FALLBACK_REGISTRY;
}

export function PlaceIcon({
  id,
  fallback = "pin",
  className,
  style,
}: Readonly<{
  id: string | null | undefined;
  fallback?: string;
  className?: string;
  style?: CSSProperties;
}>) {
  const key = claveIcono(id, fallback);
  const RegistryIcon = useRegistryIcon(key);
  if (RegistryIcon) {
    return (
      <span className="inline-flex" style={style}>
        <RegistryIcon className={className} />
      </span>
    );
  }
  const def =
    ICONOS.find((i) => i.id === id) ??
    ICONOS.find((i) => i.id === fallback) ??
    ICONOS[0]!;
  return <def.Icon className={className} style={style} aria-hidden />;
}

/** Mismo picker del dashboard: todo el registro de iconos, con búsqueda. */
export function IconPicker({
  value,
  fallback,
  onChange,
}: Readonly<{
  value: string;
  fallback: string;
  onChange: (id: string) => void;
}>) {
  return (
    <IconPickerDropdown
      value={claveIcono(value, fallback)}
      onChange={onChange}
      title="Elegir icono"
      searchPlaceholder="Buscar iconos…"
      emptyMessage="Sin iconos"
      className="h-9 w-9 min-h-9 min-w-9 shrink-0 p-0 aspect-square"
    />
  );
}
