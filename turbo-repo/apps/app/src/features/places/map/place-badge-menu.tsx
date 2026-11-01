"use client";

import { useEffect } from "react";
import { HiOutlineCog, HiOutlineTrash } from "react-icons/hi";

/** Menú del clic derecho sobre el badge de un lugar: configurarlo o eliminarlo. */
export default function PlaceBadgeMenu({
  x,
  y,
  nombre,
  onConfigurar,
  onEliminar,
  onClose,
}: Readonly<{
  x: number;
  y: number;
  nombre: string;
  onConfigurar: () => void;
  onEliminar: () => void;
  onClose: () => void;
}>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const item =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700";

  return (
    <div
      role="menu"
      aria-label={`Opciones de ${nombre}`}
      style={{ left: x, top: y }}
      className="absolute z-40 w-44 translate-x-1 translate-y-1 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
    >
      <p className="px-2.5 pt-1 pb-1.5 break-words text-[11px] font-medium text-gray-500 dark:text-gray-400">
        {nombre}
      </p>
      <button
        type="button"
        role="menuitem"
        className={`${item} text-gray-800 dark:text-gray-100`}
        onClick={onConfigurar}
      >
        <HiOutlineCog className="h-4 w-4 text-blue-600" />
        Configuración
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${item} text-rose-600 dark:text-rose-400`}
        onClick={onEliminar}
      >
        <HiOutlineTrash className="h-4 w-4" />
        Eliminar
      </button>
    </div>
  );
}
