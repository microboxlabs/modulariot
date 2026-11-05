"use client";

import { useState } from "react";
import { twMerge } from "tailwind-merge";
import type { IconType } from "react-icons";
import { HiOutlineLocationMarker, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { GeographicMapViewId } from "../../profiles/geographic-profile-context";
import { useGeographicProfile } from "../../profiles/geographic-profile-context";

const ITEM_SIZE = 40;

/** Ícono y X en el mismo lugar: se cruzan girando un cuarto de vuelta. */
const ICONO_CLS =
  "absolute h-4 w-4 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none";
const ICONO_DENTRO = "rotate-0 scale-100 opacity-100";
const ICONO_FUERA = "rotate-90 scale-50 opacity-0";

export type NotchItem = {
  id: GeographicMapViewId;
  icon: IconType;
  capability: "placesEditor";
};

export const NOTCH_ITEMS: NotchItem[] = [
  {
    id: "places",
    icon: HiOutlineLocationMarker,
    capability: "placesEditor",
  },
];

const NOTCH_LABELS: Record<GeographicMapViewId, string> = {
  places: "geographic_view.notch.places",
};

function notchLabel(id: GeographicMapViewId, dict: I18nRecord): string {
  return trDynamic(NOTCH_LABELS[id], dict);
}

function MapNotchItem({
  id,
  icon: Icon,
  label,
  selected,
  onToggle,
}: Readonly<{
  id: GeographicMapViewId;
  icon: IconType;
  label: string;
  selected: boolean;
  onToggle: (id: GeographicMapViewId) => void;
}>) {
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => setHovered(false);
  const handleClick = () => onToggle(id);

  return (
    <div
      className="relative h-10 w-10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        data-notch-label={hovered ? "open" : "closed"}
        className={twMerge(
          "absolute top-0 right-full z-20 mr-2 flex h-10 items-center rounded-full px-3",
          "whitespace-nowrap text-sm font-medium",
          "border border-gray-200 bg-white text-gray-900 shadow-lg",
          "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
          "pointer-events-none origin-right transition duration-200 ease-out",
          hovered ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
        )}
      >
        {label}
      </div>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={label}
        onClick={handleClick}
        className={twMerge(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200",
          selected
            ? "text-white"
            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
        )}
      >
        {/* abierto: el ícono gira y se desvanece en una X (clic = cerrar) */}
        <Icon
          aria-hidden
          data-notch-icon={selected ? "hidden" : "shown"}
          className={twMerge(ICONO_CLS, selected ? ICONO_FUERA : ICONO_DENTRO)}
        />
        <HiX
          aria-hidden
          data-notch-close={selected ? "shown" : "hidden"}
          className={twMerge(
            ICONO_CLS,
            selected ? ICONO_DENTRO : "-rotate-90 scale-50 opacity-0"
          )}
        />
      </button>
    </div>
  );
}

/**
 * La barra del notch sin estado propio: qué vistas ofrece, cuál está abierta
 * y qué hacer al tocar una. MapNotch la alimenta con el perfil de la vista
 * geográfica; otros mapas (el de viaje) la usan con su propio estado.
 */
export function MapNotchBar({
  dict,
  items,
  activeView,
  onToggle,
}: Readonly<{
  dict: I18nRecord;
  items: NotchItem[];
  activeView: GeographicMapViewId | null;
  onToggle: (id: GeographicMapViewId) => void;
}>) {
  if (items.length === 0) return null;
  const activeIndex = activeView
    ? items.findIndex((item) => item.id === activeView)
    : -1;
  return (
    <div
      role="toolbar"
      aria-label={tr("geographic_view.notch.label", dict)}
      className="pointer-events-auto relative z-10 flex flex-col overflow-visible rounded-full border border-gray-200 bg-white/95 p-0.5 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
    >
      {activeIndex >= 0 && (
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 z-[1] h-10 w-10 rounded-full bg-blue-600 transition-transform duration-300 ease-out"
          style={{ transform: `translateY(${activeIndex * ITEM_SIZE}px)` }}
        />
      )}
      {items.map((item) => (
        <MapNotchItem
          key={item.id}
          id={item.id}
          icon={item.icon}
          label={notchLabel(item.id, dict)}
          selected={activeView === item.id}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

export default function MapNotch({
  dict,
  alSalirDeLugares,
}: Readonly<{
  dict: I18nRecord;
  /**
   * Antes de dejar Lugares (cerrarlo o cambiar de vista): puede preguntar
   * por cambios sin guardar y llama a `seguir` solo si se sale.
   */
  alSalirDeLugares?: (seguir: () => void) => void;
}>) {
  const { activeView, setActiveView, can } = useGeographicProfile();
  const toggleView = (id: GeographicMapViewId) => {
    const siguiente = activeView === id ? null : id;
    const seguir = () => setActiveView(siguiente);
    if (activeView === "places" && alSalirDeLugares) alSalirDeLugares(seguir);
    else seguir();
  };
  return (
    <MapNotchBar
      dict={dict}
      items={NOTCH_ITEMS.filter((item) => can(item.capability))}
      activeView={activeView}
      onToggle={toggleView}
    />
  );
}
