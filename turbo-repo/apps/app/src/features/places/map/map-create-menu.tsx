"use client";

import { useEffect } from "react";
import {
  HiOutlineLocationMarker,
  HiOutlineSwitchHorizontal,
} from "react-icons/hi";
import { usePlacesT } from "../i18n/places-i18n";

/** Small menu anchored at the clicked map point: create a place or a route there. */
export default function MapCreateMenu({
  x,
  y,
  onCrearLugar,
  onCrearTrayecto,
  onClose,
}: Readonly<{
  x: number;
  y: number;
  onCrearLugar: () => void;
  onCrearTrayecto: () => void;
  onClose: () => void;
}>) {
  const t = usePlacesT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const item =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700";

  return (
    <div
      role="menu"
      style={{ left: x, top: y }}
      className="absolute z-40 w-44 translate-x-1 translate-y-1 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
    >
      <button
        type="button"
        role="menuitem"
        className={item}
        onClick={onCrearLugar}
      >
        <HiOutlineLocationMarker className="h-4 w-4 text-blue-600" />
        {t("map.create_place")}
      </button>
      <button
        type="button"
        role="menuitem"
        className={item}
        onClick={onCrearTrayecto}
      >
        <HiOutlineSwitchHorizontal className="h-4 w-4 text-blue-600" />
        {t("map.create_route")}
      </button>
    </div>
  );
}
